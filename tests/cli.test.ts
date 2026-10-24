import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { serializeSchema, serializeSource, validateSources } from '../src/core';
import { serializeUpdate } from '../src/cli/update';
import { buildData, parseArgs } from '../src/cli/build-data';
import { loadSources } from '../src/cli/io';
import { fixture, fixtureLocale } from './fixtures';
const roots: string[] = [];
afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function project(): Promise<string> {
    const root = resolve('.test-output-' + randomUUID());
    roots.push(root);
    await mkdir(join(root, 'sources', 'stats'), { recursive: true });
    await mkdir(join(root, 'locale'), { recursive: true });
    const data = fixture();
    for (const s of data.stats) {
        await writeFile(
            join(root, 'sources', 'stats', s.Name.toLowerCase() + '.json'),
            serializeSource(s),
        );
    }
    await writeFile(join(root, 'sources', 'movement.json'), serializeSource(data.movement));
    await writeFile(join(root, 'locale', 'en.json'), JSON.stringify(fixtureLocale()));
    await writeFile(join(root, 'schema.json'), serializeSchema());
    await writeFile(
        join(root, 'update.json'),
        '{"lastUpdate": 1738688823151009000, "schemaVersion":"2.0"}',
    );
    return root;
}

describe('CLI build and update serialization', () => {
    it('serializes nanoseconds as a plain integer without precision loss', () => {
        const text = serializeUpdate('2.0', 1738688823151009001n);
        expect(text).toContain('"lastUpdate": 1738688823151009001');
        expect(text).not.toContain('"1738688823151009001"');
        expect(text).not.toContain('e+');
        expect(() => JSON.parse(text)).not.toThrow();
        expect(() => serializeUpdate('../bad', 0n)).toThrow('X.Y');
    });
    it('parses and checks arguments', () => {
        expect(parseArgs(['--schema-version', '2.1', '--out-dir', 'out'])).toEqual({
            schemaVersion: '2.1',
            outDir: 'out',
        });
        for (const args of [['--bad', 'x'], ['--out-dir'], ['--schema-version', '../../escape']]) {
            expect(() => parseArgs(args)).toThrow();
        }
    });
    it('builds isolated pretty/minified exports and updates release metadata', async () => {
        const root = await project(),
            out = join(root, 'out');
        await buildData({
            root,
            outDir: out,
            schemaVersion: '2.1',
            now: () => 1738688823151009001n,
        });
        const pretty = await readFile(
            join(out, 'versions', '2.1', 'CharacterStatInfo.json'),
            'utf8',
        );
        const mini = await readFile(
            join(out, 'versions', '2.1', 'CharacterStatInfo-NI.json'),
            'utf8',
        );
        expect(JSON.parse(pretty)).toEqual(JSON.parse(mini));
        expect(pretty).toContain('    "');
        expect(mini).not.toContain('\n');
        expect(await readFile(join(out, 'update.json'), 'utf8')).toContain('1738688823151009001');
        expect(JSON.parse(await readFile(join(out, 'update.json'), 'utf8')).schemaVersion).toBe(
            '2.1',
        );
        expect(JSON.parse(await readFile(join(root, 'update.json'), 'utf8')).schemaVersion).toBe(
            '2.0',
        );
    });
    it('refuses to overwrite releases of an older data model', async () => {
        const root = await project(),
            out = join(root, 'out');
        await writeFile(
            join(root, 'update.json'),
            '{"lastUpdate": 1738688823151009000, "schemaVersion": "1.9"}',
        );
        await expect(buildData({ root, outDir: out })).rejects.toThrow('Refusing');
        await expect(access(join(out, 'versions', '1.9'))).rejects.toThrow();
        await buildData({ root, outDir: out, schemaVersion: '2.0' });
        await access(join(out, 'versions', '2.0', 'CharacterStatInfo.json'));
    });
    it('fails before writing any outputs when locale or export schema is invalid', async () => {
        const root = await project(),
            out = join(root, 'out');
        await writeFile(join(root, 'schema.json'), '{"type":"null"}');
        await expect(buildData({ root, outDir: out })).rejects.toThrow('blocked');
        await expect(access(out)).rejects.toThrow();
        await writeFile(join(root, 'schema.json'), serializeSchema());
        const locale = fixtureLocale();
        (locale.Melee as Record<string, string>).BaseStatTooltip = '{{Unknown}}';
        await writeFile(join(root, 'locale', 'en.json'), JSON.stringify(locale));
        await expect(buildData({ root, outDir: out })).rejects.toThrow('blocked');
        await expect(access(out)).rejects.toThrow();
    });
});
let sourcesExist = false;
try {
    await access('sources');
    sourcesExist = true;
} catch {
    /* Optional real-data smoke test. */
}
it.skipIf(!sourcesExist)(
    'validates real sources when available (without coupling unit fixtures to repository data)',
    async () => {
        const issues = validateSources(await loadSources());
        expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    },
);
