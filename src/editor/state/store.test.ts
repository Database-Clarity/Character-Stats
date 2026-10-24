import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
            EnhancedAthleticsHash: -1,
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
            key: 'sources/movement.json:Classes[0].WalkSpeed',
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
                EnhancedAthleticsHash: 12,
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
