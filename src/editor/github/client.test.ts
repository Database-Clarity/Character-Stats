import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from './client';
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
            'branch changed',
        );
        expect(fetch).toHaveBeenCalledTimes(1);
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
    it('dispatches the saved branch with optional schema_version and lists branch-specific runs', async () => {
        const fetch = mockResponses([undefined, { workflow_runs: [{ id: 1 }] }]);
        await client.dispatchWorkflow('2.1');
        expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
            ref: 'feature/data',
            inputs: { schema_version: '2.1' },
        });
        expect(await client.listWorkflowRuns()).toEqual([{ id: 1 }]);
        expect(fetch.mock.calls[1]?.[0]).toContain('branch=feature%2Fdata');
    });
    it('reports REST failures without exposing the token', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ message: 'Permission denied' }), { status: 403 }),
        );
        await expect(client.branchHead()).rejects.toThrow('GitHub 403: Permission denied');
    });
});
