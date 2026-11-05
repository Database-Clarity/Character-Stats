import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import Ajv from 'ajv';
import draft06 from 'ajv/dist/refs/json-schema-draft-06.json';
import {
    exportSources,
    isRecord,
    validateSources,
    type SourceSet,
    type LocaleData,
    type ValidationIssue,
} from '../core';

export async function readJson(path: string): Promise<unknown> {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    return value;
}

export async function loadSources(root = process.cwd()): Promise<unknown> {
    const dir = join(root, 'sources', 'stats');
    const files = (await readdir(dir)).filter((file) => file.endsWith('.json')).sort();
    const stats = await Promise.all(files.map((file) => readJson(join(dir, file))));
    const movement = await readJson(join(root, 'sources', 'movement.json'));
    return { stats, movement };
}

function isSourceSet(value: unknown): value is SourceSet {
    return (
        isRecord(value) &&
        Array.isArray(value.stats) &&
        value.stats.every(isRecord) &&
        isRecord(value.movement)
    );
}

export function validateExport(data: unknown, schema: object): ValidationIssue[] {
    const ajv = new Ajv({ allErrors: true, strict: false });
    ajv.addMetaSchema(draft06);
    const validate = ajv.compile(schema);
    if (validate(data)) {
        return [];
    }
    return (validate.errors ?? []).map((error) => ({
        path: 'export' + error.instancePath,
        message: error.message ?? 'Schema validation error',
        severity: 'error',
    }));
}

export async function validateProject(root = process.cwd()): Promise<{
    sources?: SourceSet;
    issues: ValidationIssue[];
    data?: ReturnType<typeof exportSources>;
}> {
    const sourceValue = await loadSources(root);
    const localeValue = await readJson(join(root, 'locale', 'en.json'));
    const locale: LocaleData | undefined = isRecord(localeValue) ? localeValue : undefined;
    const issues = validateSources(sourceValue, locale);
    if (!locale) {
        issues.unshift({
            path: 'locale/en.json',
            message: 'English locale must be an object',
            severity: 'error',
        });
    }
    if (issues.some((issue) => issue.severity === 'error')) return { issues };
    if (!locale || !isSourceSet(sourceValue)) {
        return {
            issues: [
                ...issues,
                { path: '$', message: 'Expected a validated source set', severity: 'error' },
            ],
        };
    }

    const schemaValue = await readJson(join(root, 'schema.json'));
    if (!isRecord(schemaValue)) {
        return {
            sources: sourceValue,
            issues: [
                ...issues,
                { path: 'schema.json', message: 'Expected schema object', severity: 'error' },
            ],
        };
    }
    const data = exportSources(sourceValue);
    issues.push(...validateExport(data, schemaValue));
    return { sources: sourceValue, issues, data };
}

export function reportIssues(issues: readonly ValidationIssue[]): void {
    for (const issue of issues) {
        console[issue.severity === 'error' ? 'error' : 'warn'](
            issue.severity + ': ' + issue.path + ': ' + issue.message,
        );
    }
}
