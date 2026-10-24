import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv from 'ajv';
import draft06 from 'ajv/dist/refs/json-schema-draft-06.json';
import {
    exportSources,
    validateSources,
    type SourceSet,
    type LocaleData,
    type ValidationIssue,
} from '../core';

export async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function loadSources(root = process.cwd()): Promise<SourceSet> {
    const dir = join(root, 'sources', 'stats');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    const stats = await Promise.all(files.map((f) => readJson(join(dir, f))));
    return { stats, movement: await readJson(join(root, 'sources', 'movement.json')) } as SourceSet;
}

export function validateExport(data: unknown, schema: object): ValidationIssue[] {
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajv.addMetaSchema(draft06);
    const validate = ajv.compile(schema);
    if (validate(data)) {
        return [];
    }
    return (validate.errors ?? []).map((e) => ({
        path: 'export' + e.instancePath,
        message: e.message ?? 'Schema validation error',
        severity: 'error',
    }));
}

export async function validateProject(root = process.cwd()): Promise<{
    sources: SourceSet;
    issues: ValidationIssue[];
    data?: ReturnType<typeof exportSources>;
}> {
    const sources = await loadSources(root);
    const locale = (await readJson(join(root, 'locale', 'en.json'))) as LocaleData;
    const issues = validateSources(sources, locale);
    if (issues.some((i) => i.severity === 'error')) {
        return { sources, issues };
    }
    const data = exportSources(sources);
    const schema = (await readJson(join(root, 'schema.json'))) as object;
    issues.push(...validateExport(data, schema));
    return { sources, issues, data };
}

export function reportIssues(issues: readonly ValidationIssue[]): void {
    for (const issue of issues) {
        console[issue.severity === 'error' ? 'error' : 'warn'](
            issue.severity + ': ' + issue.path + ': ' + issue.message,
        );
    }
}
