import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statRegistry } from '../../core';
import type { DataSource } from '../data';
import {
    createEditorState,
    deriveEditorState,
    editorReducer,
    serializeFile,
    updateProperty,
} from './store';
const files = Object.fromEntries(
    [
        'sources/movement.json',
        'locale/en.json',
        ...readdirSync('sources/stats')
            .filter((name) => name.endsWith('.json'))
            .map((name) => `sources/stats/${name}`),
    ].map((path) => [path, readFileSync(path, 'utf8')]),
);
const source: DataSource = {
    label: 'Test data',
    readOnly: true,
    async load() {
        return { files, head: 'original' };
    },
};
const initial = () => createEditorState({ source, loaded: { files, head: 'original' } });
describe('editor in-memory state', () => {
    it('loads the real source set with no dirty files or validation issues', () => {
        const state = deriveEditorState(initial());
        expect(state.dirty).toEqual([]);
        expect(state.issues).toEqual([]);
        expect(state.sources.stats).toHaveLength(statRegistry.length);
    });
    it('validates edits using core rules and discards a file without mutating originals', () => {
        const state = initial();
        const path = 'sources/movement.json';
        const value = {
            ...(state.values[path] as Record<string, unknown>),
            Rules: {
                ...(state.values[path] as { Rules: Record<string, unknown> }).Rules,
                MaxMobilityTier: -1,
            },
        };
        const changed = editorReducer(state, { type: 'set', file: path, value });
        expect(deriveEditorState(changed).dirty).toEqual([path]);
        expect(deriveEditorState(changed).issues.some((issue) => issue.severity === 'error')).toBe(
            true,
        );
        expect(state.originals[path]).toBe(files[path]);
        expect(
            deriveEditorState(editorReducer(changed, { type: 'discard', file: path })).dirty,
        ).toEqual([]);
    });
    it('retains unparsed drafts as dirty, blocks save, and clears them on discard', () => {
        const state = editorReducer(initial(), {
            type: 'draft',
            key: 'sources/movement.json:Rules.WalkSpeed',
            draft: { text: '[', error: 'Invalid JSON' },
        });
        expect(deriveEditorState(state).dirty).toEqual(['sources/movement.json']);
        expect(
            deriveEditorState(state).issues.some((issue) => issue.message === 'Invalid JSON'),
        ).toBe(true);
        expect(editorReducer(state, { type: 'discard' }).drafts).toEqual({});
    });
    it('validates movement placeholders, not only stat text', () => {
        const state = initial();
        const locale = structuredClone(state.values['locale/en.json']) as Record<
            string,
            Record<string, unknown>
        >;
        locale.Movement!.Overview = '{{UnknownToken}}';
        const changed = editorReducer(state, {
            type: 'set',
            file: 'locale/en.json',
            value: locale,
        });
        expect(deriveEditorState(changed).issues).toContainEqual({
            path: 'locale.Movement.Overview',
            severity: 'error',
            message: 'Unknown placeholder {{UnknownToken}}',
        });
    });
    it('preserves locale key order and serializes with four-space indent and trailing LF', () => {
        expect(serializeFile('locale/en.json', { Z: 'last', A: 'first' })).toBe(
            '{\n    "Z": "last",\n    "A": "first"\n}\n',
        );
    });
    it('marks committed values clean and switches the working source/branch', () => {
        const state = initial();
        const path = 'sources/movement.json';
        const changed = editorReducer(state, {
            type: 'set',
            file: path,
            value: {
                ...(state.values[path] as Record<string, unknown>),
                Notes: 'pending movement update',
            },
        });
        const serialized = deriveEditorState(changed).serialized[path]!;
        const nextSource = { ...source, label: 'new branch' };
        const saved = editorReducer(changed, {
            type: 'saved',
            source: nextSource,
            head: 'commit',
            files: { [path]: serialized },
        });
        expect(saved.head).toBe('commit');
        expect(saved.source.label).toBe('new branch');
        expect(deriveEditorState(saved).dirty).toEqual([]);
    });
    it('removes optional properties rather than writing undefined', () => {
        expect(updateProperty({ Notes: 'hello', Hash: 1 }, 'Notes', undefined)).toEqual({
            Hash: 1,
        });
    });
});

describe('isolated item drafts', () => {
    it('keeps unadded drafts out of validation, serialization and pending changes', () => {
        const state = editorReducer(initial(), {
            type: 'item-draft',
            key: 'sources/movement.json:Classes',
            value: { Name: 'Incomplete draft' },
        });
        expect(deriveEditorState(state).dirty).toEqual([]);
        expect(deriveEditorState(state).changes).toEqual([]);
        expect(deriveEditorState(state).issues).toEqual([]);
        expect(state.itemDrafts['sources/movement.json:Classes']).toEqual({
            Name: 'Incomplete draft',
        });
    });
    it('retains drafts across unrelated edits and saves, and supports explicit discard', () => {
        const key = 'sources/movement.json:Classes';
        const draft = editorReducer(initial(), {
            type: 'item-draft',
            key,
            value: { Name: 'Draft' },
        });
        const saved = editorReducer(draft, { type: 'saved', files: {}, head: 'next', source });
        expect(saved.itemDrafts[key]).toEqual({ Name: 'Draft' });
        expect(editorReducer(saved, { type: 'item-draft', key }).itemDrafts).toEqual({});
    });
    it('clears only drafts belonging to a discarded file', () => {
        let state = editorReducer(initial(), {
            type: 'item-draft',
            key: 'sources/movement.json:Classes',
            value: {},
        });
        state = editorReducer(state, {
            type: 'item-draft',
            key: 'sources/stats/grenade.json:Abilities',
            value: {},
        });
        expect(
            Object.keys(
                editorReducer(state, { type: 'discard', file: 'sources/movement.json' }).itemDrafts,
            ),
        ).toEqual(['sources/stats/grenade.json:Abilities']);
        expect(editorReducer(state, { type: 'discard' }).itemDrafts).toEqual({});
    });
});

describe('branch fast-forward and rebase state', () => {
    it('fast-forwards the head without changing clean originals or values', () => {
        const state = initial();
        const advanced = editorReducer(state, { type: 'fast-forward', head: 'published-commit' });
        expect(advanced.head).toBe('published-commit');
        expect(advanced.originals).toBe(state.originals);
        expect(advanced.values).toBe(state.values);
    });
    it('reloads remote originals while retaining pending file values for a rebase attempt', () => {
        const state = initial();
        const path = 'sources/movement.json';
        const pendingValue = {
            ...(state.values[path] as Record<string, unknown>),
            Notes: 'pending movement update',
        };
        const pending = editorReducer(state, { type: 'set', file: path, value: pendingValue });
        const remoteValue = {
            ...(state.originalValues[path] as Record<string, unknown>),
            Notes: 'remote update',
        };
        const remoteFiles = { ...files, [path]: serializeFile(path, remoteValue) };
        const rebased = editorReducer(pending, {
            type: 'rebase',
            files: remoteFiles,
            head: 'latest-head',
            preserve: [path],
        });
        expect(rebased.head).toBe('latest-head');
        expect(rebased.originals[path]).toBe(remoteFiles[path]);
        expect(rebased.originalValues[path]).toEqual(JSON.parse(remoteFiles[path]!));
        expect(rebased.values[path]).toEqual(pendingValue);
        expect(deriveEditorState(rebased).dirty).toContain(path);
    });
    it('keeps malformed edited JSON unknown and reports validation instead of casting it', () => {
        const state = editorReducer(initial(), {
            type: 'set',
            file: 'locale/en.json',
            value: 7,
        });
        const derived = deriveEditorState(state);
        expect(derived.locale).toEqual({});
        expect(derived.issues).toContainEqual({
            path: 'locale/en.json',
            message: 'English locale must be an object',
            severity: 'error',
        });
        expect(derived.serialized['locale/en.json']).toBe('7\n');
    });
});

describe('per-file derivation caches', () => {
    it('does not reparse originals while deriving subsequent edits', () => {
        let state = initial();
        const parse = vi.spyOn(JSON, 'parse');
        try {
            deriveEditorState(state);
            const file = 'sources/movement.json';
            state = editorReducer(state, {
                type: 'set',
                file,
                value: {
                    ...(state.originalValues[file] as Record<string, unknown>),
                    Notes: 'Edited',
                },
            });
            deriveEditorState(state);
            expect(parse).not.toHaveBeenCalled();
        } finally {
            parse.mockRestore();
        }
    });
});
