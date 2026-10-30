import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BranchExistsError,
    GitHubClient,
    GitHubError,
    NetworkError,
    StaleHeadError,
    describeFailure,
} from './client';
const repo = { owner: 'example', name: 'stats', branch: 'feature/data' };
const client = new GitHubClient('test-token', repo);
function mockResponses(responses: unknown[]) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const body = responses.shift();
        return body === undefined
            ? new Response(null, { status: 204 })
            : new Response(JSON.stringify(body), { status: 200 });
    });
}
afterEach(() => vi.restoreAllMocks());
interface Snapshot {
    sources: string;
    localeDir: string;
    localeBlob: string;
    truncated?: boolean;
}
/** Routes by URL because the two commits are read concurrently. `heads` answers branch reads. */
function mockTracked(heads: string[], old: Snapshot, next: Snapshot) {
    const side = (name: string, snap: Snapshot) => ({
        [`git/commits/${name}-head`]: { tree: { sha: `${name}-tree` } },
        [`git/trees/${name}-tree`]: {
            truncated: snap.truncated === true,
            tree: [
                { path: 'sources', type: 'tree', sha: snap.sources },
                { path: 'locale', type: 'tree', sha: snap.localeDir },
                { path: 'README.md', type: 'blob', sha: `readme-${name}` },
            ],
        },
        [`git/trees/${snap.localeDir}`]: {
            truncated: false,
            tree: [
                { path: 'en.json', type: 'blob', sha: snap.localeBlob },
                { path: 'fr.json', type: 'blob', sha: `fr-${snap.localeDir}` },
            ],
        },
    });
    const routes: Record<string, unknown> = { ...side('old', old), ...side('new', next) };
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/git/ref/heads/'))
            return new Response(JSON.stringify({ object: { sha: heads.shift() } }));
        const route = Object.keys(routes).find((key) => url.endsWith(`/${key}`));
        return route
            ? new Response(JSON.stringify(routes[route]))
            : new Response('{"message":"Not Found"}', { status: 404 });
    });
}
const snap = (sources = 'src', localeDir = 'loc', localeBlob = 'en'): Snapshot => ({
    sources,
    localeDir,
    localeBlob,
});
type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;
function mockReplies(replies: Reply[]) {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        const reply = replies.shift();
        if (!reply) throw new Error('unexpected fetch');
        if (reply instanceof Error) throw reply;
        return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
            status: reply.status,
            ...(reply.headers ? { headers: reply.headers } : {}),
        });
    });
}
const ref = (sha: string): Reply => ({ status: 200, body: { object: { sha } } });
/** Replies for a commit that reaches the ref update step. */
const commitReplies = (): Reply[] => [
    ref('head'),
    { status: 200, body: { tree: { sha: 'tree' } } },
    { status: 201, body: { sha: 'blob' } },
    { status: 201, body: { sha: 'tree2' } },
    { status: 201, body: { sha: 'commit' } },
];
describe('GitHub editor REST client', () => {
    it('decodes UTF-8 file contents and encodes branch names', async () => {
        const text = 'English → 日本語';
        const fetch = mockResponses([
            { content: Buffer.from(text).toString('base64'), encoding: 'base64' },
        ]);
        expect(await client.getFile('locale/en.json')).toBe(text);
        expect(fetch.mock.calls[0]?.[0]).toContain('ref=feature%2Fdata');
        expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
            Authorization: 'Bearer test-token',
        });
    });
    it('lists branches across pages of 100', async () => {
        const firstPage = Array.from({ length: 100 }, (_, index) => ({ name: `branch-${index}` }));
        const fetch = mockResponses([firstPage, [{ name: 'branch-100' }]]);
        expect(await client.listBranches()).toHaveLength(101);
        expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
            'https://api.github.com/repos/example/stats/branches?per_page=100&page=1',
            'https://api.github.com/repos/example/stats/branches?per_page=100&page=2',
        ]);
        expect(fetch.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    });
    it('discovers nested JSON sources without filename assumptions', async () => {
        mockResponses([
            [
                { type: 'dir', path: 'sources/stats' },
                { type: 'file', path: 'sources/movement.json' },
                { type: 'file', path: 'sources/notes.txt' },
            ],
            [{ type: 'file', path: 'sources/stats/new-stat.json' }],
        ]);
        expect(await client.listFiles('sources')).toEqual([
            'sources/stats/new-stat.json',
            'sources/movement.json',
        ]);
    });
    it('saves several UTF-8 files in exactly one commit, then updates the branch without force', async () => {
        const fetch = mockResponses([
            { object: { sha: 'head' } },
            { tree: { sha: 'old-tree' } },
            { sha: 'blob-a' },
            { sha: 'blob-b' },
            { sha: 'new-tree' },
            { sha: 'new-commit' },
            {},
        ]);
        expect(
            await client.commitFiles(
                { 'sources/a.json': 'a', 'locale/en.json': 'é' },
                'Update data',
                'head',
            ),
        ).toEqual({ sha: 'new-commit', branch: 'feature/data' });
        const calls = fetch.mock.calls.map(([url, init]) => ({
            url: String(url),
            method: init?.method,
            body: init?.body
                ? (JSON.parse(String(init.body)) as Record<string, unknown>)
                : undefined,
        }));
        expect(
            calls.filter((call) => call.url.endsWith('/git/commits') && call.method === 'POST'),
        ).toHaveLength(1);
        expect(calls[4]?.body).toMatchObject({
            base_tree: 'old-tree',
            tree: [
                { path: 'sources/a.json', sha: 'blob-a' },
                { path: 'locale/en.json', sha: 'blob-b' },
            ],
        });
        expect(calls[5]?.body).toMatchObject({
            parents: ['head'],
            tree: 'new-tree',
            message: 'Update data',
        });
        expect(calls[6]).toMatchObject({
            method: 'PATCH',
            body: { sha: 'new-commit', force: false },
        });
        expect(
            calls.every((call) =>
                call.url.startsWith('https://api.github.com/repos/example/stats/'),
            ),
        ).toBe(true);
    });
    it('refuses to save if the loaded branch head is stale', async () => {
        const fetch = mockResponses([{ object: { sha: 'someone-else' } }]);
        await expect(client.commitFiles({ a: 'a' }, 'Change', 'head')).rejects.toThrow(
            StaleHeadError,
        );
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('fast-forwards across commits that only change untracked files', async () => {
        const fetch = mockTracked(
            ['new-head', 'new-head'],
            snap('src', 'loc-old', 'en'),
            snap('src', 'loc-new', 'en'),
        );
        expect(await client.checkTrackedFiles('old-head')).toEqual({
            head: 'new-head',
            changed: false,
        });
        // Never a recursive whole-repo tree.
        expect(fetch.mock.calls.some(([url]) => String(url).includes('recursive'))).toBe(false);
    });
    it('requires reload when the sources tree changed', async () => {
        mockTracked(['new-head', 'new-head'], snap('src-before'), snap('src-after'));
        expect(await client.checkTrackedFiles('old-head')).toEqual({
            head: 'new-head',
            changed: true,
        });
    });
    it('treats a changed English locale file as a tracked conflict', async () => {
        mockTracked(
            ['new-head', 'new-head'],
            snap('src', 'loc-old', 'old-locale'),
            snap('src', 'loc-new', 'new-locale'),
        );
        expect(await client.checkTrackedFiles('old-head')).toEqual({
            head: 'new-head',
            changed: true,
        });
    });
    it('reports a head that moved again during the comparison as changed', async () => {
        mockTracked(['new-head', 'newer-head'], snap(), snap());
        expect(await client.checkTrackedFiles('old-head')).toEqual({
            head: 'newer-head',
            changed: true,
        });
    });
    it('refuses to compare a truncated Git tree rather than risk an overwrite', async () => {
        mockTracked(['new-head', 'new-head'], snap(), { ...snap(), truncated: true });
        await expect(client.checkTrackedFiles('old-head')).rejects.toThrow('truncated');
    });
    it('creates a new branch pointing at the single commit without changing the base branch', async () => {
        const fetch = mockResponses([
            { object: { sha: 'head' } },
            { tree: { sha: 'tree' } },
            { sha: 'blob' },
            { sha: 'tree2' },
            { sha: 'commit' },
            {},
        ]);
        expect(await client.commitFiles({ a: 'a' }, 'Change', 'head', 'editor/change')).toEqual({
            sha: 'commit',
            branch: 'editor/change',
        });
        expect(fetch.mock.calls.at(-1)?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({ ref: 'refs/heads/editor/change', sha: 'commit' }),
        });
        expect(fetch.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    });
    it('opens a PR against the original working branch', async () => {
        const fetch = mockResponses([{ html_url: 'https://github.com/example/stats/pull/1' }]);
        expect(await client.createPR('editor/change', 'New data', 'Details')).toContain('/pull/1');
        expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
            head: 'editor/change',
            base: 'feature/data',
            title: 'New data',
            body: 'Details',
        });
    });
    it('dispatches the saved branch with freeform release notes and lists branch-specific runs', async () => {
        const fetch = mockResponses([
            undefined,
            {
                workflow_runs: [
                    {
                        id: 1,
                        html_url: 'https://github.com/example/stats/actions/runs/1',
                        display_title: 'Build data',
                        status: 'completed',
                        conclusion: 'success',
                        created_at: '2026-10-30T12:00:00Z',
                    },
                ],
            },
        ]);
        const releaseNotes = 'Added a new stat export.\n- Updated movement data.';
        await client.dispatchWorkflow(releaseNotes);
        expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
            ref: 'feature/data',
            inputs: { release_notes: releaseNotes },
        });
        expect(await client.listWorkflowRuns()).toEqual([
            {
                id: 1,
                html_url: 'https://github.com/example/stats/actions/runs/1',
                display_title: 'Build data',
                status: 'completed',
                conclusion: 'success',
                created_at: '2026-10-30T12:00:00Z',
            },
        ]);
        expect(fetch.mock.calls[1]?.[0]).toContain('branch=feature%2Fdata');
    });
    it('dispatches with empty release notes', async () => {
        const fetch = mockResponses([undefined]);
        await client.dispatchWorkflow('');
        expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
            ref: 'feature/data',
            inputs: { release_notes: '' },
        });
    });
    it('reports REST failures without exposing the token', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ message: 'Permission denied' }), { status: 403 }),
        );
        await expect(client.branchHead()).rejects.toThrow('GitHub 403: Permission denied');
    });
    it('turns a rejected non-fast-forward ref update into a typed stale-head error', async () => {
        mockReplies([
            ...commitReplies(),
            { status: 422, body: { message: 'Update is not a fast forward' } },
        ]);
        await expect(client.commitFiles({ a: 'a' }, 'Change', 'head')).rejects.toBeInstanceOf(
            StaleHeadError,
        );
    });
    it('leaves other 422 ref failures as GitHub errors', async () => {
        mockReplies([
            ...commitReplies(),
            { status: 422, body: { message: 'Object does not exist' } },
        ]);
        const error = await client.commitFiles({ a: 'a' }, 'Change', 'head').catch((e) => e);
        expect(error).toBeInstanceOf(GitHubError);
        expect(error.status).toBe(422);
    });
    it('maps a duplicate new branch to a clear message', async () => {
        mockReplies([
            ...commitReplies(),
            { status: 422, body: { message: 'Reference already exists' } },
        ]);
        const error = await client
            .commitFiles({ a: 'a' }, 'Change', 'head', 'editor/x')
            .catch((e) => e);
        expect(error).toBeInstanceOf(BranchExistsError);
        expect(error.message).toContain('"editor/x" already exists');
    });
    it('says nothing was saved for network failures before the ref update', async () => {
        mockReplies([
            ref('head'),
            { status: 200, body: { tree: { sha: 'tree' } } },
            new TypeError('Failed to fetch'),
        ]);
        const error = await client.commitFiles({ a: 'a' }, 'Change', 'head').catch((e) => e);
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.message).toBe(
            'Network error \u2014 check your connection; nothing was saved.',
        );
        expect(error.maybeSaved).toBe(false);
    });
    it('flags a network failure during the ref update as possibly saved', async () => {
        mockReplies([...commitReplies(), new TypeError('Failed to fetch')]);
        const error = await client.commitFiles({ a: 'a' }, 'Change', 'head').catch((e) => e);
        expect(error).toBeInstanceOf(NetworkError);
        expect(error.maybeSaved).toBe(true);
    });
    it('reports a network failure on reads as a network error', async () => {
        mockReplies([new TypeError('Failed to fetch')]);
        await expect(client.branchHead()).rejects.toThrow('Network error');
    });
    it('reads the rate limit reset header into a retry time', async () => {
        const reset = Math.floor(new Date(2026, 9, 30, 14, 5).getTime() / 1000);
        mockReplies([
            {
                status: 403,
                body: { message: 'API rate limit exceeded' },
                headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
            },
        ]);
        await expect(client.branchHead()).rejects.toThrow(
            'GitHub 403: Rate limit reached. Try again at 14:05.',
        );
    });
});

describe('describeFailure', () => {
    const now = new Date(2026, 9, 30, 12, 0, 0);
    it('explains an invalid or expired token', () => {
        expect(describeFailure({ status: 401, message: 'Bad credentials' })).toMatch(
            /^GitHub 401: .*invalid or has expired/,
        );
    });
    it('explains a fine-grained token without permission', () => {
        const text = describeFailure({
            status: 403,
            message: 'Resource not accessible by personal access token',
        });
        expect(text).toMatch(/^GitHub 403: Resource not accessible by personal access token/);
        expect(text).toMatch(/Contents.*Pull requests.*Actions/);
    });
    it('uses retry-after seconds for secondary rate limits', () => {
        const secondary = { status: 403, message: 'secondary rate limit', retryAfter: '90' };
        expect(describeFailure(secondary, now)).toBe(
            'GitHub 403: Rate limit reached. Try again at 12:01.',
        );
        expect(
            describeFailure({ status: 429, message: 'Too Many Requests', retryAfter: '3600' }, now),
        ).toContain('Try again at 13:00.');
    });
    it('falls back to a generic wait when no reset time is known', () => {
        expect(describeFailure({ status: 429, message: 'slow down' }, now)).toBe(
            'GitHub 429: Rate limit reached. Try again in a few minutes.',
        );
    });
    it('treats a plain 403 as a permission error, not a rate limit', () => {
        expect(describeFailure({ status: 403, message: 'Permission denied' })).toBe(
            'GitHub 403: Permission denied',
        );
    });
    it('explains 404', () => {
        expect(describeFailure({ status: 404, message: 'Not Found' })).toMatch(
            /^GitHub 404: Not found.*no access/,
        );
    });
    it('keeps unknown statuses verbatim', () => {
        expect(describeFailure({ status: 422, message: 'Validation Failed' })).toBe(
            'GitHub 422: Validation Failed',
        );
    });
});
