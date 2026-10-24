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

/** Deliberately small REST client; the token never leaves api.github.com. */
export class GitHubClient {
    constructor(
        private readonly token: string,
        readonly repo: Repository,
    ) {}
    private async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
        const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}/${path}`,
            {
                method,
                // GitHub GETs are cached for 60s; stale refs would break consecutive saves.
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
            const detail = (await response.json().catch(() => ({}))) as { message?: string };
            throw new Error(`GitHub ${response.status}: ${detail.message ?? response.statusText}`);
        }
        return (response.status === 204 ? undefined : await response.json()) as T;
    }
    forBranch(branch: string) {
        return new GitHubClient(this.token, { ...this.repo, branch });
    }
    async getFile(path: string): Promise<string> {
        const file = await this.request<FileEntry>(
            `contents/${path}?ref=${encodeURIComponent(this.repo.branch)}`,
        );
        if (!file.content || file.encoding !== 'base64')
            throw new Error(`Cannot read ${path}: expected a small UTF-8 file`);
        return new TextDecoder().decode(
            Uint8Array.from(atob(file.content.replace(/\s/g, '')), (c) => c.charCodeAt(0)),
        );
    }
    async listFiles(path: string): Promise<string[]> {
        const files = await this.request<FileEntry[]>(
            `contents/${path}?ref=${encodeURIComponent(this.repo.branch)}`,
        );
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
        return (
            await this.request<{ object: { sha: string } }>(
                `git/ref/heads/${this.branchPath(branch)}`,
            )
        ).object.sha;
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
        const parent = await this.request<{ tree: { sha: string } }>(`git/commits/${expectedHead}`);
        const tree = await Promise.all(
            Object.entries(files).map(async ([path, content]) => {
                const blob = await this.request<{ sha: string }>('git/blobs', 'POST', {
                    content,
                    encoding: 'utf-8',
                });
                return { path, mode: '100644', type: 'blob', sha: blob.sha };
            }),
        );
        const createdTree = await this.request<{ sha: string }>('git/trees', 'POST', {
            base_tree: parent.tree.sha,
            tree,
        });
        const commit = await this.request<{ sha: string }>('git/commits', 'POST', {
            message,
            tree: createdTree.sha,
            parents: [expectedHead],
        });
        const branch = newBranch ?? this.repo.branch;
        if (newBranch) await this.createBranch(branch, commit.sha);
        else
            await this.request(`git/refs/heads/${this.branchPath(branch)}`, 'PATCH', {
                sha: commit.sha,
                force: false,
            });
        return { sha: commit.sha, branch };
    }
    async createPR(branch: string, title: string, body: string): Promise<string> {
        return (
            await this.request<{ html_url: string }>('pulls', 'POST', {
                head: branch,
                base: this.repo.branch,
                title,
                body,
            })
        ).html_url;
    }
    async dispatchWorkflow(schemaVersion: string): Promise<void> {
        await this.request('actions/workflows/build-data.yml/dispatches', 'POST', {
            ref: this.repo.branch,
            inputs: { schema_version: schemaVersion },
        });
    }
    async listWorkflowRuns(): Promise<WorkflowRun[]> {
        return (
            await this.request<{ workflow_runs: WorkflowRun[] }>(
                `actions/workflows/build-data.yml/runs?branch=${encodeURIComponent(this.repo.branch)}&event=workflow_dispatch&per_page=5`,
            )
        ).workflow_runs;
    }
    get actionsUrl() {
        return `https://github.com/${encodeURIComponent(this.repo.owner)}/${encodeURIComponent(this.repo.name)}/actions/workflows/build-data.yml`;
    }
}
