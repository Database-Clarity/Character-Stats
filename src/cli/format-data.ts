import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serializeSource } from '../core';

/** Tracked data files, relative to the repository root. */
export async function trackedDataFiles(root: string): Promise<string[]> {
    const stats = (await readdir(join(root, 'sources', 'stats')))
        .filter((file) => file.endsWith('.json'))
        .sort()
        .map((file) => `sources/stats/${file}`);
    return [...stats, 'sources/movement.json', 'locale/en.json'];
}

/** The exact text the editor writes on Save (see serializeFile in src/editor/state/store.tsx). */
export function canonicalDataText(path: string, text: string): string {
    const value: unknown = JSON.parse(text);
    return path === 'locale/en.json'
        ? JSON.stringify(value, null, 4) + '\n'
        : serializeSource(value);
}

/** Rewrites (or, with `check`, lists) tracked data files that differ from the editor's format. */
export async function formatData(
    options: { root?: string; check?: boolean } = {},
): Promise<string[]> {
    const root = resolve(options.root ?? process.cwd());
    const changed: string[] = [];
    for (const path of await trackedDataFiles(root)) {
        const file = join(root, path);
        const text = await readFile(file, 'utf8');
        const canonical = canonicalDataText(path, text);
        if (canonical === text) continue;
        changed.push(path);
        if (!options.check) await writeFile(file, canonical);
    }
    return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const check = process.argv.includes('--check');
        const changed = await formatData({ check });
        if (check && changed.length) {
            console.error(
                `Not in the editor's save format (run npm run format:data): ${changed.join(', ')}`,
            );
            process.exitCode = 1;
        } else {
            console.log(
                changed.length
                    ? `${check ? 'Would format' : 'Formatted'} ${changed.join(', ')}`
                    : 'Data files already use the editor save format',
            );
        }
    } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
    }
}
