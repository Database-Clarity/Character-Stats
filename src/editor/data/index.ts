import { GitHubClient } from '../github/client';
export interface LoadedData {
    files: Record<string, string>;
    head: string;
}
export interface DataSource {
    readonly label: string;
    readonly readOnly: boolean;
    load(): Promise<LoadedData>;
}
export class GitHubDataSource implements DataSource {
    readonly readOnly = false;
    constructor(readonly client: GitHubClient) {}
    get label() {
        const r = this.client.repo;
        return `${r.owner}/${r.name} @ ${r.branch}`;
    }
    async load(): Promise<LoadedData> {
        const head = await this.client.branchHead();
        const paths = [...(await this.client.listFiles('sources')), 'locale/en.json'];
        const files = Object.fromEntries(
            await Promise.all(paths.map(async (path) => [path, await this.client.getFile(path)])),
        );
        if (head !== (await this.client.branchHead()))
            throw new Error('Branch changed while loading. Please try again.');
        return { files, head };
    }
}
export class LocalDevDataSource implements DataSource {
    readonly label = 'Local (read-only dev)';
    readonly readOnly = true;
    async load(): Promise<LoadedData> {
        if (!import.meta.env.DEV) throw new Error('Local data is available only in development.');
        const modules = {
            ...import.meta.glob<string>('../../../sources/**/*.json', {
                query: '?raw',
                import: 'default',
            }),
            ...import.meta.glob<string>('../../../locale/en.json', {
                query: '?raw',
                import: 'default',
            }),
        };
        const files = Object.fromEntries(
            await Promise.all(
                Object.entries(modules).map(async ([path, load]) => [
                    path.replace('../../../', ''),
                    await load(),
                ]),
            ),
        );
        return { files, head: 'local' };
    }
}
