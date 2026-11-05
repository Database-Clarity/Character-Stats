import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { defaultConfig, isSchemaVersion, isRecord, statRegistry } from '../core';
import { readJson, reportIssues, validateProject } from './io';
import { serializeUpdate } from './update';

export interface BuildOptions {
    root?: string;
    outDir?: string;
    releaseNotes?: string;
    now?: () => bigint;
}

export function parseArgs(args: string[]): Pick<BuildOptions, 'outDir' | 'releaseNotes'> {
    const result: Pick<BuildOptions, 'outDir' | 'releaseNotes'> = {};
    for (let i = 0; i < args.length; i++) {
        const key = args[i],
            value = args[++i];
        if (
            (key !== '--release-notes' && key !== '--out-dir') ||
            value === undefined ||
            (key === '--out-dir' && (!value || value.startsWith('--')))
        ) {
            throw new Error('Usage: build:data [--release-notes text] [--out-dir directory]');
        }
        if (key === '--release-notes') {
            result.releaseNotes = value;
        } else {
            result.outDir = value;
        }
    }
    return result;
}

async function readOptional(path: string): Promise<string | undefined> {
    try {
        return await readFile(path, 'utf8');
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return undefined;
    }
}

function versionParts(version: string, legacy = false): [number, number, number] {
    if (!(isSchemaVersion(version) || (legacy && /^1\.(0|[1-9]\d*)$/.test(version)))) {
        throw new Error('Schema version must have format X.Y.Z (legacy v1 X.Y is also readable)');
    }
    const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
    if (![major, minor, patch].every(Number.isSafeInteger)) {
        throw new Error('Schema version components must be safe integers');
    }
    return [major, minor, patch];
}

function summarizeChanges(previous: unknown, next: unknown, path: string): string[] {
    if (isDeepStrictEqual(previous, next)) return [];
    if (previous === undefined) return [`Added ${path}.`];
    if (next === undefined) return [`Removed ${path}.`];
    if (isRecord(previous) && isRecord(next)) {
        return [...new Set([...Object.keys(previous), ...Object.keys(next)])].flatMap((key) =>
            summarizeChanges(previous[key], next[key], path ? `${path} / ${key}` : key),
        );
    }
    if (Array.isArray(previous) && Array.isArray(next)) {
        const entities = [...previous, ...next];
        if (entities.length > 0 && entities.every((entry) => isRecord(entry) && 'Hash' in entry)) {
            const before = new Map(previous.map((entry) => [String(entry.Hash), entry])),
                after = new Map(next.map((entry) => [String(entry.Hash), entry]));
            if (before.size === previous.length && after.size === next.length) {
                const changes = [...new Set([...before.keys(), ...after.keys()])].flatMap(
                    (hash) => {
                        const old = before.get(hash),
                            current = after.get(hash),
                            label = current?.Name ?? old?.Name ?? hash;
                        return summarizeChanges(old, current, `${path} / ${label} (${hash})`);
                    },
                );
                return changes.length ? changes : [`Updated ${path} order.`];
            }
        }
        return [`Updated ${path} values.`];
    }
    return [`Changed ${path} to ${JSON.stringify(next)} (from ${JSON.stringify(previous)}).`];
}

function releaseChangelog(
    existing: string,
    version: string,
    timestamp: bigint,
    previous: Record<string, unknown> | undefined,
    data: Record<string, unknown>,
    notes: string,
    schemaNotice?: string,
): string {
    const instant = new Date(Number(timestamp / 1_000_000n));
    if (timestamp < 0n || !Number.isFinite(instant.getTime())) {
        throw new Error('Publication timestamp must be a non-negative valid date');
    }
    const date = instant.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    });
    const changes = [...new Set([...Object.keys(previous ?? {}), ...Object.keys(data)])].flatMap(
        (key) => {
            const label = statRegistry.find((stat) => String(stat.hash) === key)?.name ?? key;
            return summarizeChanges(previous?.[key], data[key], label);
        },
    );
    if (schemaNotice) changes.unshift(schemaNotice);
    if (changes.length === 0) {
        changes.push('Regenerated consumer exports to restore missing or inconsistent output.');
    }
    const body =
        changes.map((change) => '- ' + change).join('\n') +
        (notes.trim() ? '\n\n' + notes.trim() : '');
    // Complete a hand-written upcoming release instead of duplicating its heading.
    const pending = new RegExp(
        `^## v${version.replaceAll('.', '\\.')}\\b([^\\n]*) - TBD\\r?$`,
        'm',
    );
    if (pending.test(existing)) {
        const dated = existing.replace(pending, `## v${version}$1 - ${date}`),
            heading = dated.search(new RegExp(`^## v${version.replaceAll('.', '\\.')}\\b`, 'm')),
            following = dated.indexOf('\n## ', heading + 1),
            end = following < 0 ? dated.length : following;
        return (
            dated.slice(0, end).trimEnd() + '\n\n' + body + '\n\n' + dated.slice(end).trimStart()
        );
    }
    const entry = `## v${version} - ${date}\n\n${body}\n\n`;
    const firstRelease = existing.search(/^## /m);
    return firstRelease < 0
        ? existing.trimEnd() + '\n\n' + entry
        : existing.slice(0, firstRelease) + entry + existing.slice(firstRelease);
}

export async function buildData(
    options: BuildOptions = {},
): Promise<{ changed: boolean; version: string }> {
    const root = resolve(options.root ?? process.cwd()),
        out = resolve(options.outDir ?? root);
    let baseline = out;
    let updateText = await readOptional(join(out, 'update.json'));
    if (updateText === undefined && out !== root) {
        baseline = root;
        updateText = await readOptional(join(root, 'update.json'));
    }
    const update: unknown = updateText === undefined ? {} : JSON.parse(updateText);
    if (!isRecord(update)) throw new Error('update.json must contain an object');
    const [major, minor, configuredPatch] = versionParts(defaultConfig.schemaVersion);
    if (configuredPatch !== 0) throw new Error('Code-defined schemaVersion patch must be 0');
    const published = update.schemaVersion;
    if (updateText !== undefined && published === undefined) {
        throw new Error('update.json schemaVersion is required');
    }
    if (published !== undefined && typeof published !== 'string') {
        throw new Error('update.json schemaVersion must be a string');
    }
    const prior = published === undefined ? undefined : versionParts(published, true);
    if (prior && (major < prior[0] || (major === prior[0] && minor < prior[1]))) {
        throw new Error('Refusing to publish an older major.minor than update.json');
    }
    const baselineChanged = !prior || major !== prior[0] || minor !== prior[1];
    let previous: Record<string, unknown> | undefined;
    let previousCompact: unknown;
    if (published !== undefined && prior) {
        const directory = prior[0] >= 2 ? String(prior[0]) : published;
        const value = await readJson(
            join(baseline, 'versions', directory, 'CharacterStatInfo.json'),
        );
        if (!isRecord(value)) throw new Error('Previous published export must contain an object');
        previous = value;
        const compact = await readOptional(
            join(baseline, 'versions', directory, 'CharacterStatInfo-NI.json'),
        );
        if (compact !== undefined) {
            previousCompact = JSON.parse(compact);
            if (!isRecord(previousCompact)) {
                throw new Error('Previous minified export must contain an object');
            }
        }
    }
    const { issues, data } = await validateProject(root);
    reportIssues(issues);
    if (issues.some((i) => i.severity === 'error') || !data) {
        throw new Error('Data build blocked by validation errors');
    }
    const minified = JSON.stringify(data);
    const consumerData: unknown = JSON.parse(minified);
    if (!isRecord(consumerData)) throw new Error('Generated export must contain an object');
    if (
        previous &&
        published !== undefined &&
        !baselineChanged &&
        isDeepStrictEqual(previous, consumerData) &&
        isDeepStrictEqual(previousCompact, consumerData)
    ) {
        console.log('No consumer data changes; release metadata and changelog are unchanged.');
        return { changed: false, version: published };
    }
    const patch = prior && !baselineChanged ? prior[2] + 1 : 0;
    if (!Number.isSafeInteger(patch)) throw new Error('Schema version patch exceeds safe integers');
    const version = `${major}.${minor}.${patch}`,
        timestamp = options.now?.() ?? BigInt(Date.now()) * 1_000_000n,
        changelog = (await readOptional(join(baseline, 'CHANGELOGS.md'))) ?? '# Changelogs\n';
    const updatedChangelog = releaseChangelog(
        changelog,
        version,
        timestamp,
        previous,
        consumerData,
        options.releaseNotes ?? '',
        baselineChanged && published !== undefined
            ? `Updated the supported schema/API from v${published} to v${version}.`
            : undefined,
    );
    const metadata = serializeUpdate(version, timestamp, update);
    const directory = join(out, 'versions', String(major));
    await mkdir(directory, { recursive: true });
    await writeFile(
        join(directory, 'CharacterStatInfo.json'),
        JSON.stringify(consumerData, null, 4) + '\n',
    );
    await writeFile(join(directory, 'CharacterStatInfo-NI.json'), minified);
    await writeFile(join(out, 'CHANGELOGS.md'), updatedChangelog);
    await writeFile(join(out, 'update.json'), metadata);
    console.log(`Built versions/${major} (schemaVersion ${version})`);
    return { changed: true, version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        await buildData(parseArgs(process.argv.slice(2)));
    } catch (e) {
        console.error((e as Error).message);
        process.exitCode = 1;
    }
}
