import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import {
    isRecord,
    movementSpec,
    statRegistry,
    parseMovementSource,
    parseStatSource,
    serializeSource,
    validatePlaceholders,
    validateSources,
    type LocaleData,
    type SourceSet,
    type StatSource,
    type MovementSource,
    type ValidationIssue,
} from '../../core';
import type { DataSource, LoadedData } from '../data';
export interface Draft {
    text: string;
    error: string;
}
export interface EditorState {
    source: DataSource;
    head: string;
    originals: Record<string, string>;
    values: Record<string, unknown>;
    drafts: Record<string, Draft>;
}
type Action =
    | { type: 'clear-drafts'; prefix: string }
    | { type: 'set'; file: string; value: unknown }
    | { type: 'draft'; key: string; draft: Draft }
    | { type: 'discard'; file?: string }
    | { type: 'saved'; files: Record<string, string>; head: string; source: DataSource };
export function serializeFile(path: string, value: unknown): string {
    return path === 'locale/en.json'
        ? JSON.stringify(value, null, 4) + '\n'
        : serializeSource(value as StatSource | MovementSource);
}
function parseFiles(files: Record<string, string>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(files).map(([path, text]) => {
            if (path === 'locale/en.json') {
                const value: unknown = JSON.parse(text);
                if (!isRecord(value)) throw new Error('English locale must be an object');
                return [path, value];
            }
            const parsed =
                path === 'sources/movement.json'
                    ? parseMovementSource(text)
                    : parseStatSource(text);
            if (!parsed.value)
                throw new Error(`${path}: ${parsed.issues.map((i) => i.message).join('; ')}`);
            return [path, parsed.value];
        }),
    );
}
export function editorReducer(state: EditorState, action: Action): EditorState {
    switch (action.type) {
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
        case 'discard': {
            const files = action.file
                ? { [action.file]: state.originals[action.file]! }
                : state.originals;
            return {
                ...state,
                values: { ...state.values, ...parseFiles(files) },
                drafts: Object.fromEntries(
                    Object.entries(state.drafts).filter(
                        ([key]) => action.file && !key.startsWith(action.file + ':'),
                    ),
                ),
            };
        }
        case 'saved':
            return {
                ...state,
                source: action.source,
                head: action.head,
                originals: { ...state.originals, ...action.files },
                drafts: {},
            };
    }
}
export function createEditorState({
    source,
    loaded,
}: {
    source: DataSource;
    loaded: LoadedData;
}): EditorState {
    return {
        source,
        head: loaded.head,
        originals: loaded.files,
        values: parseFiles(loaded.files),
        drafts: {},
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
        .map(([, value]) => value as StatSource);
    const sources: SourceSet = {
        stats,
        movement: state.values['sources/movement.json'] as MovementSource,
    };
    const locale = state.values['locale/en.json'] as LocaleData;
    const allIssues = [
        ...validateSources(sources, locale),
        ...[...statRegistry, movementSpec].flatMap((spec) =>
            validateLocaleSection(
                locale[spec.name],
                spec.fields.map((f) => f.key),
                `locale.${spec.name}`,
            ),
        ),
    ];
    const issues: ValidationIssue[] = [
        ...new Map(allIssues.map((issue) => [`${issue.path}:${issue.message}`, issue])).values(),
        ...Object.entries(state.drafts)
            .filter(([, d]) => d.error)
            .map(([path, d]) => ({ path, message: d.error, severity: 'error' as const })),
    ];
    const serialized = Object.fromEntries(
        Object.entries(state.values).map(([path, value]) => [path, serializeFile(path, value)]),
    );
    const dirty = Object.keys(state.values).filter((path) => {
        const original = parseFiles({ [path]: state.originals[path]! })[path];
        return (
            serializeFile(path, original) !== serialized[path] ||
            Object.entries(state.drafts).some(([key, d]) => key.startsWith(path + ':') && d.error)
        );
    });
    return { sources, locale, issues, serialized, dirty };
}
function useEditorState(source: DataSource, loaded: LoadedData) {
    const [state, dispatch] = useReducer(editorReducer, { source, loaded }, createEditorState);
    const derived = useMemo(
        () => deriveEditorState(state),
        [state.values, state.originals, state.drafts],
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
