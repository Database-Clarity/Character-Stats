import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import {
    defaultConfig,
    isSchemaVersion,
    serializeSchema,
    serializeSource,
    statRegistry,
    validateSources,
} from '../src/core';
import { serializeUpdate } from '../src/cli/update';
import { buildData, parseArgs } from '../src/cli/build-data';
import { loadSources } from '../src/cli/io';
import { fixture, fixtureLocale } from './fixtures';

const roots: string[] = [];
const releaseTimestamp = BigInt(Date.UTC(2025, 1, 4, 23, 30)) * 1_000_000n;

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
    return root;
}

async function withSchemaVersion<T>(version: string, action: () => Promise<T>): Promise<T> {
    const descriptor = Object.getOwnPropertyDescriptor(defaultConfig, 'schemaVersion');
    if (!descriptor) throw new Error('Missing schemaVersion property descriptor');
    Object.defineProperty(defaultConfig, 'schemaVersion', { ...descriptor, value: version });
    try {
        return await action();
    } finally {
        Object.defineProperty(defaultConfig, 'schemaVersion', descriptor);
    }
}

async function setSourceField(root: string, value: number): Promise<string> {
    const spec = statRegistry[0]!,
        path = join(root, 'sources', 'stats', spec.name.toLowerCase() + '.json'),
        source = JSON.parse(await readFile(path, 'utf8')) as {
            Fields: Record<string, unknown>;
        },
        field = Object.entries(source.Fields).find(
            ([, current]) => typeof current === 'number',
        )?.[0];
    if (!field) throw new Error('Fixture stat has no numeric exported field');
    source.Fields[field] = value;
    await writeFile(path, serializeSource(source));
    return field;
}

async function setHealthScalarToNegativeZero(root: string): Promise<void> {
    const path = join(root, 'sources', 'stats', 'health.json'),
        source = await readFile(path, 'utf8'),
        token = '"PVPHealthHP": 1';
    if (!source.includes(token)) throw new Error('Expected fixture health scalar was not found');
    await writeFile(path, source.replace(token, '"PVPHealthHP": -0'));
}

async function releaseBytes(out: string): Promise<Buffer[]> {
    return Promise.all(
        [
            'update.json',
            'CHANGELOGS.md',
            'versions/2/CharacterStatInfo.json',
            'versions/2/CharacterStatInfo-NI.json',
        ].map((path) => readFile(join(out, path))),
    );
}

describe('CLI build and update serialization', () => {
    it('uses the new schema baseline and accepts only canonical full semver', () => {
        expect(defaultConfig.schemaVersion).toBe('2.0.0');
        for (const version of ['0.0.0', '2.0.0', '12.34.56']) {
            expect(isSchemaVersion(version)).toBe(true);
            expect(() => serializeUpdate(version, 1n)).not.toThrow();
        }
        for (const version of [
            '2.0',
            'v2.0.0',
            '02.0.0',
            '2.00.0',
            '2.0.00',
            '2.0.0-beta',
            '2.0.0+build',
        ]) {
            expect(isSchemaVersion(version)).toBe(false);
            expect(() => serializeUpdate(version, 1n)).toThrow('X.Y.Z');
        }
    });

    it('serializes nanoseconds as a plain integer without precision loss', () => {
        const text = serializeUpdate('2.0.0', 1738688823151009001n, {
            channel: 'stable',
            build: 7,
        });
        expect(text).toContain('"lastUpdate": 1738688823151009001');
        expect(text).not.toContain('"1738688823151009001"');
        expect(text).not.toContain('e+');
        expect(text).toContain('"channel": "stable"');
        expect(text).toContain('"build": 7');
        expect(() => JSON.parse(text)).not.toThrow();
        expect(() => serializeUpdate('../bad', 0n)).toThrow('X.Y.Z');
        expect(() => serializeUpdate('2.0.0', -1n)).toThrow('non-negative');
    });

    it('parses only supported release arguments', () => {
        expect(parseArgs(['--release-notes', 'Initial release', '--out-dir', 'out'])).toEqual({
            releaseNotes: 'Initial release',
            outDir: 'out',
        });
        expect(parseArgs(['--out-dir', 'out'])).toEqual({ outDir: 'out' });
        for (const args of [
            ['--bad', 'x'],
            ['--out-dir'],
            ['--out-dir', '--release-notes'],
            ['--release-notes'],
            ['--schema-version', '2.1.0'],
            ['--schema-version', '../../escape'],
        ]) {
            expect(() => parseArgs(args)).toThrow();
        }
    });

    it('builds the first isolated v2 release with exports, metadata, UTC changelog, and notes', async () => {
        const root = await project(),
            out = join(root, 'out');
        const result = await buildData({
            root,
            outDir: out,
            releaseNotes: 'Initial release note.',
            now: () => releaseTimestamp,
        });
        expect(result).toEqual({ changed: true, version: '2.0.0' });

        const pretty = await readFile(join(out, 'versions', '2', 'CharacterStatInfo.json'), 'utf8'),
            mini = await readFile(join(out, 'versions', '2', 'CharacterStatInfo-NI.json'), 'utf8'),
            update = await readFile(join(out, 'update.json'), 'utf8'),
            changelog = await readFile(join(out, 'CHANGELOGS.md'), 'utf8');
        expect(JSON.parse(pretty)).toEqual(JSON.parse(mini));
        expect(pretty).toContain('    "');
        expect(mini).not.toContain('\n');
        expect(update).toContain(`"lastUpdate": ${releaseTimestamp}`);
        expect(JSON.parse(update)).toMatchObject({ schemaVersion: '2.0.0' });
        expect(changelog).toContain('## v2.0.0 - February 4, 2025');
        expect(changelog).toContain(`- Added ${statRegistry[0]!.name}.`);
        expect(changelog).toContain('Initial release note.');
        await expect(readFile(join(root, 'update.json'), 'utf8')).rejects.toThrow();
    });

    it('keeps an identical release byte-for-byte unchanged, including for notes-only requests', async () => {
        const root = await project(),
            out = join(root, 'out');
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        const before = await releaseBytes(out),
            now = vi.fn(() => releaseTimestamp + 1n);

        const result = await buildData({
            root,
            outDir: out,
            releaseNotes: 'Notes alone must not create a new release.',
            now,
        });

        expect(result).toEqual({ changed: false, version: '2.0.0' });
        expect(now).not.toHaveBeenCalled();
        expect(await releaseBytes(out)).toEqual(before);
    });

    it('normalizes negative zero to its JSON output before checking for a no-op', async () => {
        const root = await project(),
            out = join(root, 'out');
        await setHealthScalarToNegativeZero(root);
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        const exportData = JSON.parse(
            await readFile(join(out, 'versions', '2', 'CharacterStatInfo.json'), 'utf8'),
        ) as Record<string, Record<string, number>>;
        expect(exportData[String(statRegistry[0]!.hash)]!.PVPHealthHP).toBe(0);
        expect(Object.is(exportData[String(statRegistry[0]!.hash)]!.PVPHealthHP, -0)).toBe(false);

        const before = await releaseBytes(out),
            now = vi.fn(() => releaseTimestamp + 1n);
        const result = await buildData({ root, outDir: out, now });

        expect(result).toEqual({ changed: false, version: '2.0.0' });
        expect(now).not.toHaveBeenCalled();
        expect(await releaseBytes(out)).toEqual(before);
    });

    it('repairs missing minified exports and rejects malformed published JSON', async () => {
        const root = await project(),
            out = join(root, 'out'),
            prettyPath = join(out, 'versions', '2', 'CharacterStatInfo.json'),
            miniPath = join(out, 'versions', '2', 'CharacterStatInfo-NI.json');
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        await rm(miniPath);

        const repairNow = vi.fn(() => releaseTimestamp + 1n),
            repaired = await buildData({ root, outDir: out, now: repairNow });
        expect(repaired).toEqual({ changed: true, version: '2.0.1' });
        expect(repairNow).toHaveBeenCalledOnce();
        const pretty = await readFile(prettyPath, 'utf8'),
            mini = await readFile(miniPath, 'utf8');
        expect(JSON.parse(pretty)).toEqual(JSON.parse(mini));
        expect(await readFile(join(out, 'CHANGELOGS.md'), 'utf8')).toContain(
            '- Regenerated consumer exports to restore missing or inconsistent output.',
        );

        const updateBeforeMalformedInput = await readFile(join(out, 'update.json'));
        await writeFile(miniPath, '{');
        const malformedNow = vi.fn(() => releaseTimestamp + 2n);
        await expect(buildData({ root, outDir: out, now: malformedNow })).rejects.toThrow(
            SyntaxError,
        );
        expect(malformedNow).not.toHaveBeenCalled();
        expect(await readFile(join(out, 'update.json'))).toEqual(updateBeforeMalformedInput);
    });

    it('increments the patch and describes named property changes', async () => {
        const root = await project(),
            out = join(root, 'out');
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        const field = await setSourceField(root, 7);
        const result = await buildData({
            root,
            outDir: out,
            now: () => releaseTimestamp + 1n,
        });

        expect(result).toEqual({ changed: true, version: '2.0.1' });
        expect(JSON.parse(await readFile(join(out, 'update.json'), 'utf8')).schemaVersion).toBe(
            '2.0.1',
        );
        expect(await readFile(join(out, 'CHANGELOGS.md'), 'utf8')).toContain(
            `- Changed ${statRegistry[0]!.name} / ${field} to 7 (from 1).`,
        );
    });

    it('inserts a patch release without consuming a longer pending version heading', async () => {
        const root = await project(),
            out = join(root, 'out');
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        const existingChangelog =
            '# Changelogs\n\n## v2.0.0 - February 4, 2025\n\nPublished v2.0.0.\n\n## v2.0.10 - TBD\n\nPlanned release 2.0.10.\n';
        await writeFile(join(out, 'CHANGELOGS.md'), existingChangelog);
        await setSourceField(root, 7);

        const result = await buildData({
            root,
            outDir: out,
            now: () => releaseTimestamp + 1n,
        });

        expect(result).toEqual({ changed: true, version: '2.0.1' });
        const changelog = await readFile(join(out, 'CHANGELOGS.md'), 'utf8');
        expect(changelog.match(/^## v2\.0\.1 - /gm)).toHaveLength(1);
        expect(changelog).toContain('## v2.0.10 - TBD\n\nPlanned release 2.0.10.');
        expect(changelog).toContain('## v2.0.0 - February 4, 2025\n\nPublished v2.0.0.');
        expect(changelog.indexOf('## v2.0.1 - ')).toBeLessThan(changelog.indexOf('## v2.0.0 - '));
    });

    it('publishes v2.0.0 from legacy v1.9 metadata without touching its published files', async () => {
        const root = await project(),
            out = join(root, 'out'),
            legacyDir = join(root, 'versions', '1.9'),
            oldUpdate =
                '{"lastUpdate": 123456789, "schemaVersion": "1.9", "channel": "stable", "extra": {"keep": true}}\n',
            oldPretty = '{\n    "legacy": true\n}\n',
            oldMini = '{"legacy":true}';
        await mkdir(legacyDir, { recursive: true });
        await writeFile(join(root, 'update.json'), oldUpdate);
        await writeFile(join(legacyDir, 'CharacterStatInfo.json'), oldPretty);
        await writeFile(join(legacyDir, 'CharacterStatInfo-NI.json'), oldMini);
        const history =
            '# Changelogs\n\n## v1.9.0 - January 1, 2024\n\nLegacy history.\n\n## v2.0.0 - TBD\n\nUpcoming placeholder.\n';
        await writeFile(join(root, 'CHANGELOGS.md'), history);

        const result = await buildData({
            root,
            outDir: out,
            releaseNotes: 'Release notes from the new publisher.',
            now: () => releaseTimestamp,
        });

        expect(result).toEqual({ changed: true, version: '2.0.0' });
        const update = JSON.parse(await readFile(join(out, 'update.json'), 'utf8'));
        expect(update).toMatchObject({
            schemaVersion: '2.0.0',
            channel: 'stable',
            extra: { keep: true },
        });
        expect(await readFile(join(root, 'update.json'), 'utf8')).toBe(oldUpdate);
        expect(await readFile(join(legacyDir, 'CharacterStatInfo.json'), 'utf8')).toBe(oldPretty);
        expect(await readFile(join(legacyDir, 'CharacterStatInfo-NI.json'), 'utf8')).toBe(oldMini);
        expect(await readFile(join(root, 'CHANGELOGS.md'), 'utf8')).toBe(history);
        expect(
            await readFile(join(out, 'versions', '2', 'CharacterStatInfo.json'), 'utf8'),
        ).toBeDefined();
        const changelog = await readFile(join(out, 'CHANGELOGS.md'), 'utf8');
        expect(changelog.match(/^## v2\.0\.0 - /gm)).toHaveLength(1);
        expect(changelog).toContain('## v2.0.0 - February 4, 2025');
        expect(changelog).toContain('Legacy history.');
        expect(changelog).toContain('Upcoming placeholder.');
        expect(changelog).toContain('Release notes from the new publisher.');
    });

    it('publishes a higher configured minor for identical data and keeps the major export directory', async () => {
        const root = await project(),
            out = join(root, 'published');
        await buildData({ root, outDir: out, now: () => releaseTimestamp });
        const versionDir = join(out, 'versions', '2'),
            prettyPath = join(versionDir, 'CharacterStatInfo.json'),
            miniPath = join(versionDir, 'CharacterStatInfo-NI.json'),
            previousPretty = await readFile(prettyPath, 'utf8'),
            previousMini = await readFile(miniPath, 'utf8');
        await writeFile(join(out, 'update.json'), '{"lastUpdate": 123, "schemaVersion": "2.0.5"}');

        const result = await withSchemaVersion('2.1.0', () =>
            buildData({ root, outDir: out, now: () => releaseTimestamp }),
        );

        expect(result).toEqual({ changed: true, version: '2.1.0' });
        expect(await readFile(prettyPath, 'utf8')).toBe(previousPretty);
        expect(await readFile(miniPath, 'utf8')).toBe(previousMini);
        expect(JSON.parse(previousPretty)).toEqual(JSON.parse(previousMini));
        expect(JSON.parse(await readFile(join(out, 'update.json'), 'utf8')).schemaVersion).toBe(
            '2.1.0',
        );
        expect(await readFile(join(out, 'CHANGELOGS.md'), 'utf8')).toContain(
            'Updated the supported schema/API from v2.0.5 to v2.1.0.',
        );
        await expect(access(join(out, 'versions', '2.1'))).rejects.toThrow();
    });

    it('rejects downgrades, malformed metadata, and missing previous snapshots before writing', async () => {
        const root = await project(),
            out = join(root, 'out');
        await writeFile(join(root, 'update.json'), '{"lastUpdate": 1, "schemaVersion": "2.1.0"}');
        await mkdir(join(root, 'versions', '2'), { recursive: true });
        await writeFile(join(root, 'versions', '2', 'CharacterStatInfo.json'), '{}');
        await writeFile(join(root, 'versions', '2', 'CharacterStatInfo-NI.json'), '{}');
        await withSchemaVersion('2.0.0', async () => {
            await expect(buildData({ root, outDir: out })).rejects.toThrow('Refusing');
        });
        await expect(access(out)).rejects.toThrow();

        await writeFile(join(root, 'update.json'), '{"lastUpdate": 1, "schemaVersion": "02.0.0"}');
        await expect(buildData({ root, outDir: out })).rejects.toThrow();
        await expect(access(out)).rejects.toThrow();

        await writeFile(join(root, 'update.json'), '{"lastUpdate": 1, "schemaVersion": "2.0.0"}');
        await rm(join(root, 'versions', '2'), { recursive: true });
        await expect(buildData({ root, outDir: out })).rejects.toThrow();
        await expect(access(out)).rejects.toThrow();
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
