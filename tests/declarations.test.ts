import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { exportSources, generateDeclarations, type SourceSet } from '../src/core';
import { loadSources } from '../src/cli/io';
import { fixture } from './fixtures';

const dir = resolve('.test-output-' + randomUUID());
afterAll(() => rm(dir, { recursive: true, force: true }));

/** Compiles a snippet that imports the committed declarations; returns the diagnostics. */
async function check(name: string, body: string): Promise<string[]> {
    await mkdir(dir, { recursive: true });
    const file = join(dir, name + '.ts');
    await writeFile(
        file,
        `import type { CharacterStatInfo, UpdateInfo } from '../character-stats';\n${body}`,
    );
    const program = ts.createProgram([file], {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        types: [],
        lib: ['lib.es2022.d.ts'],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
    });
    return ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('character-stats.d.ts', () => {
    it('equals the generated declarations', async () => {
        const generated = generateDeclarations();
        expect(generateDeclarations()).toBe(generated);
        expect(await readFile('character-stats.d.ts', 'utf8')).toBe(generated);
        expect(generated).toContain('export interface CharacterStatInfo');
        expect(generated).toContain('export interface UpdateInfo');
        expect(generated).toContain('Base cooldown in seconds at a stat value of 0.');
    });

    it('type-checks an export and rejects a mistyped one', async () => {
        const data = JSON.stringify(exportSources(fixture()));
        expect(await check('valid', `export const data: CharacterStatInfo = ${data};\n`)).toEqual(
            [],
        );
        expect(
            await check(
                'update',
                'export const u: UpdateInfo = { lastUpdate: 1, schemaVersion: "2.0.0" };\n',
            ),
        ).toEqual([]);
        const wrong = JSON.stringify({ ...exportSources(fixture()), Movement: 1 });
        expect(
            (await check('invalid', `export const data: CharacterStatInfo = ${wrong};\n`)).length,
        ).toBeGreaterThan(0);
    });

    it('type-checks the export of the real sources', async () => {
        const data = JSON.stringify(exportSources((await loadSources()) as SourceSet));
        expect(await check('real', `export const data: CharacterStatInfo = ${data};\n`)).toEqual(
            [],
        );
    });
});
