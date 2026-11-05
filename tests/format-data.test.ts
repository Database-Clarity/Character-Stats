import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalDataText, formatData, trackedDataFiles } from '../src/cli/format-data';
import { serializeFile } from '../src/editor/state/store';

const temps: string[] = [];
afterEach(async () => {
    await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function copyData(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'format-data-'));
    temps.push(root);
    await cp('sources', join(root, 'sources'), { recursive: true });
    await cp('locale', join(root, 'locale'), { recursive: true });
    return root;
}

describe('format:data', () => {
    it('keeps the committed data files in the editor save format', async () => {
        expect(await formatData({ check: true })).toEqual([]);
    });

    it('matches what the editor writes on Save for every tracked file', async () => {
        for (const path of await trackedDataFiles('.')) {
            const text = await readFile(path, 'utf8');
            expect(canonicalDataText(path, text), path).toBe(serializeFile(path, JSON.parse(text)));
        }
    });

    it('reports drift with --check and fixes it otherwise, without changing the data', async () => {
        const root = await copyData();
        const file = join(root, 'sources', 'stats', 'grenade.json');
        const original = await readFile(file, 'utf8');
        await writeFile(file, JSON.stringify(JSON.parse(original)));
        expect(await formatData({ root, check: true })).toEqual(['sources/stats/grenade.json']);
        expect(await readFile(file, 'utf8')).not.toBe(original);
        expect(await formatData({ root })).toEqual(['sources/stats/grenade.json']);
        expect(await readFile(file, 'utf8')).toBe(original);
    });
});
