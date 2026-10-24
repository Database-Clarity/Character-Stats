import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultConfig, isSchemaVersion, isRecord } from '../core';
import { readJson, reportIssues, validateProject } from './io';
import { serializeUpdate } from './update';

export interface BuildOptions {
    root?: string;
    outDir?: string;
    schemaVersion?: string;
    now?: () => bigint;
}

export function parseArgs(args: string[]): Pick<BuildOptions, 'outDir' | 'schemaVersion'> {
    const result: Pick<BuildOptions, 'outDir' | 'schemaVersion'> = {};
    for (let i = 0; i < args.length; i++) {
        const key = args[i],
            value = args[++i];
        if (
            (key !== '--schema-version' && key !== '--out-dir') ||
            !value ||
            value.startsWith('--')
        ) {
            throw new Error('Usage: build:data [--schema-version X.Y] [--out-dir directory]');
        }
        if (key === '--schema-version') {
            result.schemaVersion = value;
        } else {
            result.outDir = value;
        }
    }
    if (result.schemaVersion !== undefined && !isSchemaVersion(result.schemaVersion)) {
        throw new Error('Schema version must have format X.Y');
    }
    return result;
}

export async function buildData(options: BuildOptions = {}): Promise<void> {
    const root = resolve(options.root ?? process.cwd()),
        out = resolve(options.outDir ?? root);
    let update: Record<string, unknown> = {};
    try {
        const existing = await readJson(join(out, 'update.json'));
        if (!isRecord(existing)) {
            throw new Error('update.json must contain an object');
        }
        update = existing;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw e;
        }
    }
    // Isolated output inherits the repository release unless explicitly overridden.
    if (out !== root && Object.keys(update).length === 0) {
        try {
            const existing = await readJson(join(root, 'update.json'));
            if (isRecord(existing)) {
                update = existing;
            }
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw e;
            }
        }
    }
    const version =
        options.schemaVersion ??
        (typeof update.schemaVersion === 'string'
            ? update.schemaVersion
            : defaultConfig.schemaVersion);
    if (!isSchemaVersion(version)) {
        throw new Error('Schema version must have format X.Y');
    }
    // Never overwrite published releases of an older data model (e.g. versions/1.9).
    const major = (v: string) => Number(v.split('.')[0]);
    if (major(version) < major(defaultConfig.schemaVersion)) {
        throw new Error(
            `Refusing to write versions/${version}: this generator produces schema ` +
                `${defaultConfig.schemaVersion}+ data. Pass --schema-version ` +
                `${defaultConfig.schemaVersion} (or newer) for the first release.`,
        );
    }
    const { issues, data } = await validateProject(root);
    reportIssues(issues);
    if (issues.some((i) => i.severity === 'error') || !data) {
        throw new Error('Data build blocked by validation errors');
    }
    const directory = join(out, 'versions', version);
    await mkdir(directory, { recursive: true });
    await writeFile(
        join(directory, 'CharacterStatInfo.json'),
        JSON.stringify(data, null, 4) + '\n',
    );
    await writeFile(join(directory, 'CharacterStatInfo-NI.json'), JSON.stringify(data));
    const timestamp = options.now?.() ?? BigInt(Date.now()) * 1_000_000n;
    await writeFile(join(out, 'update.json'), serializeUpdate(version, timestamp, update));
    console.log('Built versions/' + version + ' (schemaVersion ' + version + ')');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        await buildData(parseArgs(process.argv.slice(2)));
    } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
    }
}
