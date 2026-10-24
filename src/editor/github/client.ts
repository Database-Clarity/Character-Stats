export interface Repository {
    owner: string;
    name: string;
    branch: string;
}
interface FileEntry {
    type: string;
    path: string;
    content?: string;
    encoding?: string;
}
export interface WorkflowRun {
    id: number;
    html_url: string;
    display_title: string;
    status: string;
    conclusion: string | null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, description: string): Record<string, unknown> {
    if (!isObjectRecord(value)) throw new Error(`GitHub returned an invalid ${description}`);
    return value;
}

function stringField(value: Record<string, unknown>, key: string, description: string): string {
    const field = value[key];
    if (typeof field !== 'string') throw new Error(`GitHub returned an invalid ${description}`);
    return field;
}

/** Deliberately small REST client; the token never leaves api.github.com. */
export class GitHubClient {
    constructor(
        private readonly token: string,
        readonly repo: Repository,
    ) {}
    private async request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
        const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}/${path}`,
            {
                method,
                cache: 'no-store',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            },
        );
        if (!response.ok) {
            const detail: unknown = await response.json().catch(() => undefined);
            const message =
                isObjectRecord(detail) && typeof detail.message === 'string'
                    ? detail.message
                    : response.statusText;
            throw new Error(`GitHub ${response.status}: ${message}`);
        }
        if (response.status === 204) return undefined;
        const payload: unknown = await response.json();
        return payload;
    }
    forBranch(branch: string) {
        return new GitHubClient(this.token, { ...this.repo, branch });
    }
    private contentPath(path: string): string {
        return path.split('/').map(encodeURIComponent).join('/');
    }
    async getFile(path: string): Promise<string> {
        const file = record(
            await this.request(
                `contents/${this.contentPath(path)}?ref=${encodeURIComponent(this.repo.branch)}`,
            ),
            'file response',
        );
        if (typeof file.content !== 'string' || file.encoding !== 'base64')
            throw new Error(`Cannot read ${path}: expected a small UTF-8 file`);
        return new TextDecoder().decode(
            Uint8Array.from(atob(file.content.replace(/\s/g, '')), (character) =>
                character.charCodeAt(0),
            ),
        );
    }
    async listFiles(path: string): Promise<string[]> {
        const response: unknown = await this.request(
            `contents/${this.contentPath(path)}?ref=${encodeURIComponent(this.repo.branch)}`,
        );
        if (!Array.isArray(response))
            throw new Error(`Cannot list ${path}: invalid GitHub response`);
        const files = response.map((entry): FileEntry => {
            const item = record(entry, 'directory entry');
            if (typeof item.type !== 'string' || typeof item.path !== 'string') {
                throw new Error(`Cannot list ${path}: invalid GitHub entry`);
            }
            return { type: item.type, path: item.path };
        });
        return (
            await Promise.all(
                files.map((file) =>
                    file.type === 'dir'
                        ? this.listFiles(file.path)
                        : Promise.resolve(file.path.endsWith('.json') ? [file.path] : []),
                ),
            )
        ).flat();
    }
    private branchPath(branch: string) {
        return branch.split('/').map(encodeURIComponent).join('/');
    }
    async branchHead(branch = this.repo.branch): Promise<string> {
        const ref = record(
            await this.request(`git/ref/heads/${this.branchPath(branch)}`),
            'branch reference',
        );
        const object = record(ref.object, 'branch reference object');
        return stringField(object, 'sha', 'branch head');
    }
    private async trackedFilesAt(head: string): Promise<Map<string, string>> {
        const commit = record(
            await this.request(`git/commits/${encodeURIComponent(head)}`),
            'commit response',
        );
        const commitTree = record(commit.tree, 'commit tree');
        const treeSha = stringField(commitTree, 'sha', 'commit tree SHA');
        const tree = record(
            await this.request(`git/trees/${encodeURIComponent(treeSha)}?recursive=1`),
            'tree response',
        );
        if (tree.truncated === true) {
            throw new Error('Cannot safely compare branch data: GitHub truncated the source tree.');
        }
        if (!Array.isArray(tree.tree)) throw new Error('GitHub returned an invalid source tree');
        const tracked = new Map<string, string>();
        for (const entry of tree.tree) {
            const item = record(entry, 'tree entry');
            const path = stringField(item, 'path', 'tree path');
            const type = stringField(item, 'type', 'tree entry type');
            if (type !== 'blob' || (path !== 'locale/en.json' && !path.startsWith('sources/'))) {
                continue;
            }
            tracked.set(path, stringField(item, 'sha', 'tracked file SHA'));
        }
        return tracked;
    }
    async checkTrackedFiles(expectedHead: string): Promise<{ head: string; changed: boolean }> {
        const head = await this.branchHead();
        if (head === expectedHead) return { head, changed: false };
        const [before, after] = await Promise.all([
            this.trackedFilesAt(expectedHead),
            this.trackedFilesAt(head),
        ]);
        const latestHead = await this.branchHead();
        if (latestHead !== head) return { head: latestHead, changed: true };
        const paths = new Set([...before.keys(), ...after.keys()]);
        const changed = [...paths].some((path) => before.get(path) !== after.get(path));
        return { head, changed };
    }
    async createBranch(branch: string, sha: string): Promise<void> {
        await this.request('git/refs', 'POST', { ref: `refs/heads/${branch}`, sha });
    }
    async commitFiles(
        files: Record<string, string>,
        message: string,
        expectedHead: string,
        newBranch?: string,
    ): Promise<{ sha: string; branch: string }> {
        if ((await this.branchHead()) !== expectedHead)
            throw new Error(
                'The branch changed since loading. Reload before saving to avoid overwriting another edit.',
            );
        const parent = record(
            await this.request(`git/commits/${encodeURIComponent(expectedHead)}`),
            'commit response',
        );
        const parentTree = record(parent.tree, 'commit tree');
        const baseTree = stringField(parentTree, 'sha', 'commit tree SHA');
        const tree = await Promise.all(
            Object.entries(files).map(async ([path, content]) => {
                const blob = record(
                    await this.request('git/blobs', 'POST', { content, encoding: 'utf-8' }),
                    'blob response',
                );
                return {
                    path,
                    mode: '100644',
                    type: 'blob',
                    sha: stringField(blob, 'sha', 'blob SHA'),
                };
            }),
        );
        const createdTree = record(
            await this.request('git/trees', 'POST', { base_tree: baseTree, tree }),
            'created tree response',
        );
        const commit = record(
            await this.request('git/commits', 'POST', {
                message,
                tree: stringField(createdTree, 'sha', 'created tree SHA'),
                parents: [expectedHead],
            }),
            'created commit response',
        );
        const sha = stringField(commit, 'sha', 'created commit SHA');
        const branch = newBranch ?? this.repo.branch;
        if (newBranch) await this.createBranch(branch, sha);
        else
            await this.request(`git/refs/heads/${this.branchPath(branch)}`, 'PATCH', {
                sha,
                force: false,
            });
        return { sha, branch };
    }
    async createPR(branch: string, title: string, body: string): Promise<string> {
        const response = record(
            await this.request('pulls', 'POST', {
                head: branch,
                base: this.repo.branch,
                title,
                body,
            }),
            'pull request response',
        );
        return stringField(response, 'html_url', 'pull request URL');
    }
    async dispatchWorkflow(schemaVersion: string): Promise<void> {
        await this.request('actions/workflows/build-data.yml/dispatches', 'POST', {
            ref: this.repo.branch,
            inputs: { schema_version: schemaVersion },
        });
    }
    async listWorkflowRuns(): Promise<WorkflowRun[]> {
        const response = record(
            await this.request(
                `actions/workflows/build-data.yml/runs?branch=${encodeURIComponent(this.repo.branch)}&event=workflow_dispatch&per_page=5`,
            ),
            'workflow runs response',
        );
        if (!Array.isArray(response.workflow_runs)) {
            throw new Error('GitHub returned an invalid workflow runs list');
        }
        return response.workflow_runs.map((entry): WorkflowRun => {
            const run = record(entry, 'workflow run');
            if (
                typeof run.id !== 'number' ||
                typeof run.display_title !== 'string' ||
                typeof run.html_url !== 'string' ||
                typeof run.status !== 'string' ||
                (typeof run.conclusion !== 'string' && run.conclusion !== null)
            ) {
                throw new Error('GitHub returned an invalid workflow run');
            }
            return {
                id: run.id,
                display_title: run.display_title,
                html_url: run.html_url,
                status: run.status,
                conclusion: run.conclusion,
            };
        });
    }
    get actionsUrl() {
        return `https://github.com/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}/actions/workflows/build-data.yml`;
    }
}
