import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import {
    isRecord,
    movementSpec,
    statRegistry,
    serializeSource,
    validatePlaceholders,
    validateSources,
    type LocaleData,
    type StatSource,
    type MovementSource,
    type ValidationIssue,
} from '../../core';
import type { DataSource, LoadedData } from '../data';
import { collectChanges } from './editing';
export interface Draft {
    text: string;
    error: string;
}
export interface EditorState {
    source: DataSource;
    head: string;
    originals: Record<string, string>;
    originalValues: Record<string, unknown>;
    originalSerialized: Record<string, string>;
    values: Record<string, unknown>;
    drafts: Record<string, Draft>;
    itemDrafts: Record<string, Record<string, unknown>>;
}
type Action =
    | { type: 'item-draft'; key: string; value?: Record<string, unknown> }
    | { type: 'clear-drafts'; prefix: string }
    | { type: 'set'; file: string; value: unknown }
    | { type: 'draft'; key: string; draft: Draft }
    | { type: 'discard'; file?: string }
    | { type: 'fast-forward'; head: string }
    | { type: 'rebase'; files: Record<string, string>; head: string; preserve: string[] }
    | { type: 'saved'; files: Record<string, string>; head: string; source: DataSource };

function isStatSource(value: unknown): value is StatSource {
    if (!isRecord(value)) return false;
    return !validateSources({ stats: [value], movement: {} }).some(
        (issue) => issue.severity === 'error' && issue.path.startsWith('stats[0]'),
    );
}

function isMovementSource(value: unknown): value is MovementSource {
    if (!isRecord(value)) return false;
    return !validateSources({ stats: [], movement: value }).some(
        (issue) =>
            issue.severity === 'error' &&
            (issue.path === 'movement' || issue.path.startsWith('movement.')),
    );
}

function jsonText(value: unknown): string {
    const text = JSON.stringify(value, null, 4);
    return text === undefined ? `${String(value)}\n` : `${text}\n`;
}

export function serializeFile(path: string, value: unknown): string {
    if (path === 'locale/en.json') return jsonText(value);
    if (path === 'sources/movement.json' && isMovementSource(value)) return serializeSource(value);
    if (path.startsWith('sources/stats/') && isStatSource(value)) return serializeSource(value);
    return jsonText(value);
}

function parseFiles(files: Record<string, string>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(files).map(([path, text]) => {
            let value: unknown;
            try {
                value = JSON.parse(text);
            } catch (error) {
                throw new Error(
                    `${path}: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
            if (!isRecord(value)) {
                throw new Error(
                    path === 'locale/en.json'
                        ? 'English locale must be an object'
                        : `${path}: Expected source object`,
                );
            }
            return [path, value];
        }),
    );
}

const serializedValueCache = new WeakMap<object, Map<string, string>>();
function serializeCurrentFile(path: string, value: unknown): string {
    if (typeof value !== 'object' || value === null) return serializeFile(path, value);
    let byPath = serializedValueCache.get(value);
    if (!byPath) {
        byPath = new Map();
        serializedValueCache.set(value, byPath);
    }
    let serialized = byPath.get(path);
    if (serialized === undefined) {
        serialized = serializeFile(path, value);
        byPath.set(path, serialized);
    }
    return serialized;
}

const changeCache = new WeakMap<
    object,
    Map<string, { original: string | undefined; changes: ReturnType<typeof collectChanges> }>
>();
function changesForFile(
    path: string,
    value: unknown,
    original: string | undefined,
    originalValue: unknown,
): ReturnType<typeof collectChanges> {
    if (typeof value !== 'object' || value === null) {
        return collectChanges(
            original === undefined ? {} : { [path]: original },
            {
                [path]: value,
            },
            { [path]: originalValue },
        );
    }
    let byFile = changeCache.get(value);
    if (!byFile) {
        byFile = new Map();
        changeCache.set(value, byFile);
    }
    const cached = byFile.get(path);
    if (cached && cached.original === original) return cached.changes;
    const changes = collectChanges(
        original === undefined ? {} : { [path]: original },
        {
            [path]: value,
        },
        { [path]: originalValue },
    );
    byFile.set(path, { original, changes });
    return changes;
}

const statValidationCache = new WeakMap<object, WeakMap<object, ValidationIssue[]>>();
const movementValidationCache = new WeakMap<object, ValidationIssue[]>();
const localeValidationCache = new WeakMap<object, ValidationIssue[]>();

function statIssues(
    value: unknown,
    locale: LocaleData | undefined,
    index: number,
): ValidationIssue[] {
    let local: ValidationIssue[];
    if (typeof value === 'object' && value !== null && locale) {
        let byLocale = statValidationCache.get(value);
        if (!byLocale) {
            byLocale = new WeakMap();
            statValidationCache.set(value, byLocale);
        }
        const cached = byLocale.get(locale);
        if (cached) local = cached;
        else {
            local = validateSources({ stats: [value], movement: {} }, locale).filter(
                (issue) => issue.path.startsWith('stats[0]') || issue.path.startsWith('locale.'),
            );
            byLocale.set(locale, local);
        }
    } else {
        local = validateSources({ stats: [value], movement: {} }, locale).filter(
            (issue) => issue.path.startsWith('stats[0]') || issue.path.startsWith('locale.'),
        );
    }
    return local.map((issue) =>
        issue.path.startsWith('stats[0]')
            ? { ...issue, path: issue.path.replace('stats[0]', `stats[${index}]`) }
            : issue,
    );
}

function movementIssues(value: unknown): ValidationIssue[] {
    if (typeof value === 'object' && value !== null) {
        const cached = movementValidationCache.get(value);
        if (cached) return cached;
        const issues = validateSources({ stats: [], movement: value }).filter(
            (issue) => issue.path === 'movement' || issue.path.startsWith('movement.'),
        );
        movementValidationCache.set(value, issues);
        return issues;
    }
    return validateSources({ stats: [], movement: value }).filter(
        (issue) => issue.path === 'movement' || issue.path.startsWith('movement.'),
    );
}

function localeIssues(locale: LocaleData): ValidationIssue[] {
    const cached = localeValidationCache.get(locale);
    if (cached) return cached;
    const issues = [...statRegistry, movementSpec].flatMap((spec) =>
        validateLocaleSection(
            locale[spec.name],
            spec.fields.map((field) => field.key),
            `locale.${spec.name}`,
        ),
    );
    localeValidationCache.set(locale, issues);
    return issues;
}

function originalSerialization(values: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(values).map(([path, value]) => [path, serializeCurrentFile(path, value)]),
    );
}

export function editorReducer(state: EditorState, action: Action): EditorState {
    switch (action.type) {
        case 'item-draft': {
            const itemDrafts = { ...state.itemDrafts };
            if (action.value) itemDrafts[action.key] = action.value;
            else delete itemDrafts[action.key];
            return { ...state, itemDrafts };
        }
        case 'clear-drafts':
            return {
                ...state,
                drafts: Object.fromEntries(
                    Object.entries(state.drafts).filter(([key]) => !key.startsWith(action.prefix)),
                ),
            };
        case 'set':
            return { ...state, values: { ...state.values, [action.file]: action.value } };
        case 'draft':
            return { ...state, drafts: { ...state.drafts, [action.key]: action.draft } };
        case 'fast-forward':
            return { ...state, head: action.head };
        case 'rebase': {
            const originalValues = parseFiles(action.files);
            const values = { ...originalValues };
            for (const path of action.preserve) {
                if (Object.hasOwn(state.values, path)) values[path] = state.values[path];
            }
            return {
                ...state,
                head: action.head,
                originals: action.files,
                originalValues,
                originalSerialized: originalSerialization(originalValues),
                values,
            };
        }
        case 'discard': {
            const restoredValues = action.file
                ? { [action.file]: state.originalValues[action.file]! }
                : state.originalValues;
            return {
                ...state,
                values: { ...state.values, ...restoredValues },
                itemDrafts: Object.fromEntries(
                    Object.entries(state.itemDrafts).filter(
                        ([key]) => action.file && !key.startsWith(action.file + ':'),
                    ),
                ),
                drafts: Object.fromEntries(
                    Object.entries(state.drafts).filter(
                        ([key]) => action.file && !key.startsWith(action.file + ':'),
                    ),
                ),
            };
        }
        case 'saved': {
            const originalValues = { ...state.originalValues };
            for (const path of Object.keys(action.files)) {
                if (Object.hasOwn(state.values, path)) originalValues[path] = state.values[path];
            }
            return {
                ...state,
                source: action.source,
                head: action.head,
                originals: { ...state.originals, ...action.files },
                originalValues,
                originalSerialized: { ...state.originalSerialized, ...action.files },
                drafts: {},
            };
        }
    }
}

export function createEditorState({
    source,
    loaded,
}: {
    source: DataSource;
    loaded: LoadedData;
}): EditorState {
    const originalValues = parseFiles(loaded.files);
    return {
        source,
        head: loaded.head,
        originals: loaded.files,
        originalValues,
        originalSerialized: originalSerialization(originalValues),
        values: originalValues,
        drafts: {},
        itemDrafts: {},
    };
}

function validateLocaleSection(
    value: unknown,
    fieldKeys: readonly string[],
    path: string,
): ValidationIssue[] {
    if (typeof value === 'string') return validatePlaceholders(value, fieldKeys, path);
    return isRecord(value)
        ? Object.entries(value).flatMap(([key, next]) =>
              validateLocaleSection(next, fieldKeys, `${path}.${key}`),
          )
        : [];
}

export function deriveEditorState(state: EditorState) {
    const stats = Object.entries(state.values)
        .filter(([path]) => path.startsWith('sources/stats/'))
        .map(([, value]) => value);
    const movement = state.values['sources/movement.json'];
    const localeValue = state.values['locale/en.json'];
    const locale = isRecord(localeValue) ? localeValue : undefined;
    const allIssues = stats.flatMap((value, index) => statIssues(value, locale, index));
    allIssues.push(...movementIssues(movement));
    if (!locale) {
        allIssues.push({
            path: 'locale/en.json',
            message: 'English locale must be an object',
            severity: 'error',
        });
    } else {
        allIssues.push(...localeIssues(locale));
    }
    const seenStats = new Set<string>();
    const presentStats = new Set<string>();
    stats.forEach((value, index) => {
        if (!isRecord(value)) return;
        const spec = statRegistry.find((candidate) => candidate.name === value.Name);
        if (!spec) return;
        if (seenStats.has(spec.name)) {
            allIssues.push({
                path: `stats[${index}].Name`,
                message: `Duplicate stat ${spec.name}`,
                severity: 'error',
            });
        }
        seenStats.add(spec.name);
        presentStats.add(spec.name);
    });
    for (const spec of statRegistry) {
        if (!presentStats.has(spec.name)) {
            allIssues.push({
                path: 'stats',
                message: 'Missing stat ' + spec.name,
                severity: 'error',
            });
        }
    }
    const serialized = Object.fromEntries(
        Object.entries(state.values).map(([path, value]) => [
            path,
            serializeCurrentFile(path, value),
        ]),
    );
    const dirty = Object.keys(state.values).filter((path) => {
        return (
            state.originalSerialized[path] !== serialized[path] ||
            Object.entries(state.drafts).some(
                ([key, draft]) => key.startsWith(path + ':') && draft.error,
            )
        );
    });
    const issues: ValidationIssue[] = [
        ...new Map(allIssues.map((issue) => [`${issue.path}:${issue.message}`, issue])).values(),
        ...Object.entries(state.drafts)
            .filter(([, draft]) => draft.error)
            .map(([path, draft]) => ({ path, message: draft.error, severity: 'error' as const })),
    ];
    return {
        sources: { stats, movement },
        locale: locale ?? {},
        issues,
        serialized,
        dirty,
        changes: Object.entries(state.values).flatMap(([path, value]) =>
            changesForFile(path, value, state.originals[path], state.originalValues[path]),
        ),
    };
}

function useEditorState(source: DataSource, loaded: LoadedData) {
    const [state, dispatch] = useReducer(editorReducer, { source, loaded }, createEditorState);
    const derived = useMemo(
        () => deriveEditorState(state),
        [state.values, state.originals, state.originalSerialized, state.drafts],
    );
    return { ...state, ...derived, dispatch };
}
const Context = createContext<ReturnType<typeof useEditorState> | null>(null);
export function EditorProvider({
    source,
    loaded,
    children,
}: {
    source: DataSource;
    loaded: LoadedData;
    children: ReactNode;
}) {
    const value = useEditorState(source, loaded);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useEditor() {
    const state = useContext(Context);
    if (!state) throw new Error('EditorProvider missing');
    return state;
}
export function updateProperty(
    value: Record<string, unknown>,
    key: string,
    next: unknown,
): Record<string, unknown> {
    const result = { ...value };
    if (next === undefined) delete result[key];
    else result[key] = next;
    return result;
}
