import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { statRegistry, validateSources, type LocaleData } from '../../core';
import type { DataSource } from '../data';
import {
    createEditorState,
    deriveEditorState,
    editorReducer,
    serializeFile,
    updateProperty,
} from './store';
import { encodeConflicts, parseRecovery } from './recovery';
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
    it('restores generic values, raw and item drafts, and the original branch base', () => {
        const state = initial();
        const values = {
            ...state.values,
            'locale/en.json': {
                ...(state.values['locale/en.json'] as Record<string, unknown>),
                RecoveryTest: 'unsaved',
            },
        };
        const snapshot = {
            id: 'recovered',
            timestamp: Date.now(),
            head: 'older-head',
            originals: state.originals,
            values,
            drafts: { 'sources/movement.json:raw': { text: '[', error: 'Invalid JSON' } },
            itemDrafts: { 'sources/movement.json:new': { Name: 'unfinished' } },
            changeCount: 3,
        };
        const restored = editorReducer(state, { type: 'restore', snapshot });
        expect(restored.source).toBe(state.source);
        expect(restored.head).toBe('older-head');
        expect(restored.values).toEqual(values);
        expect(restored.drafts).toEqual(snapshot.drafts);
        expect(restored.itemDrafts).toEqual(snapshot.itemDrafts);
        expect(deriveEditorState(restored).dirty).toContain('locale/en.json');
        const rebased = editorReducer(restored, {
            type: 'rebase',
            files: state.originals,
            head: 'newer-head',
            preserve: deriveEditorState(restored).dirty,
        });
        expect(rebased.head).toBe('newer-head');
        expect(rebased.values['locale/en.json']).toEqual(values['locale/en.json']);
        expect(rebased.itemDrafts).toEqual(snapshot.itemDrafts);
    });
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
    it('reports the missing Condition text warning that npm run validate reports', () => {
        const state = initial();
        const locale = structuredClone(state.values['locale/en.json']) as {
            Movement: { Sources: Record<string, { Condition?: string }> };
        };
        const movement = state.values['sources/movement.json'] as {
            Sources: { Hash: number; Activation: string }[];
        };
        const conditional = movement.Sources.find((s) => s.Activation === 'Conditional')!;
        delete locale.Movement.Sources[String(conditional.Hash)]!.Condition;
        const changed = editorReducer(state, {
            type: 'set',
            file: 'locale/en.json',
            value: locale,
        });
        const expected = validateSources(
            {
                stats: Object.entries(changed.values)
                    .filter(([path]) => path.startsWith('sources/stats/'))
                    .map(([, value]) => value),
                movement,
            },
            locale as unknown as LocaleData,
        );
        expect(expected.length).toBeGreaterThan(0);
        for (const issue of expected)
            expect(deriveEditorState(changed).issues).toContainEqual(issue);
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

describe('rebase merges remote edits per path', () => {
    const grenadePath = 'sources/stats/grenade.json';
    const localePath = 'locale/en.json';
    const baseFiles: Record<string, string> = {
        [grenadePath]: readFileSync(
            new URL('../../../sources/stats/grenade.json', import.meta.url),
            'utf8',
        ),
        'sources/movement.json': readFileSync(
            new URL('../../../sources/movement.json', import.meta.url),
            'utf8',
        ),
        [localePath]: readFileSync(new URL('../../../locale/en.json', import.meta.url), 'utf8'),
    };
    const ARCBOLT = 'Arcbolt Grenade';
    const AXION = 'Axion Bolt';
    interface Ability {
        Hash: number;
        Name: string;
        BaseCooldown: number;
        ChunkEnergyScalar: number;
    }
    interface GrenadeFile {
        Abilities: Ability[];
        [key: string]: unknown;
    }
    interface LocaleFile {
        Grenade: Record<string, string>;
        [key: string]: unknown;
    }
    const loaded = () =>
        createEditorState({ source, loaded: { files: baseFiles, head: 'original' } });
    type State = ReturnType<typeof loaded>;
    const grenadeOf = (state: State) => structuredClone(state.values[grenadePath]) as GrenadeFile;
    const localeOf = (state: State) => structuredClone(state.values[localePath]) as LocaleFile;
    const abilityIn = (value: unknown, name: string) =>
        (value as GrenadeFile).Abilities.find((ability) => ability.Name === name);
    const cooldownIn = (value: unknown, name: string) => abilityIn(value, name)?.BaseCooldown;
    const withCooldown = (grenade: GrenadeFile, name: string, seconds: number) => {
        abilityIn(grenade, name)!.BaseCooldown = seconds;
        return grenade;
    };
    const withLocaleLeaf = (locale: LocaleFile, key: string, value: string): LocaleFile => ({
        ...locale,
        Grenade: { ...locale.Grenade, [key]: value },
    });
    const edit = (state: State, file: string, value: unknown) =>
        editorReducer(state, { type: 'set', file, value });
    const serialize = (value: unknown) => `${JSON.stringify(value, null, 4)}\n`;
    const rebase = (state: State, remote: Record<string, string>, preserve: string[]) =>
        editorReducer(state, {
            type: 'rebase',
            files: { ...baseFiles, ...remote },
            head: 'new',
            preserve,
        });
    const bothConflicted = () => {
        const base = loaded();
        const ours = edit(
            edit(base, grenadePath, withCooldown(grenadeOf(base), ARCBOLT, 160)),
            localePath,
            withLocaleLeaf(localeOf(base), 'Overview', 'Our overview'),
        );
        return rebase(
            ours,
            {
                [grenadePath]: serialize(withCooldown(grenadeOf(base), ARCBOLT, 150)),
                [localePath]: serialize(
                    withLocaleLeaf(localeOf(base), 'Overview', 'Remote overview'),
                ),
            },
            [grenadePath, localePath],
        );
    };

    it('applies remote and local edits to different abilities in the same file', () => {
        const base = loaded();
        const ours = edit(base, grenadePath, withCooldown(grenadeOf(base), AXION, 200));
        const remoteText = serialize(withCooldown(grenadeOf(base), ARCBOLT, 150));
        const merged = rebase(ours, { [grenadePath]: remoteText }, [grenadePath]);
        expect(merged.values[grenadePath]).toEqual(
            withCooldown(withCooldown(grenadeOf(base), ARCBOLT, 150), AXION, 200),
        );
        expect(merged.conflicts).toEqual([]);
        expect(merged.mergedFiles).toEqual([grenadePath]);
        expect(merged.head).toBe('new');
        expect(merged.originals).toEqual({ ...baseFiles, [grenadePath]: remoteText });
        const derived = deriveEditorState(merged);
        expect(derived.dirty).toContain(grenadePath);
        expect(derived.changes).toHaveLength(1);
        expect(derived.changes[0]).toMatchObject({
            file: grenadePath,
            field: 'BaseCooldown',
            after: 200,
        });
    });
    it('keeps our value for the same ability until the conflict is resolved either way', () => {
        const base = loaded();
        const ours = edit(base, grenadePath, withCooldown(grenadeOf(base), ARCBOLT, 160));
        const remote = serialize(withCooldown(grenadeOf(base), ARCBOLT, 150));
        const conflicted = rebase(ours, { [grenadePath]: remote }, [grenadePath]);
        expect(conflicted.conflicts).toHaveLength(1);
        expect(conflicted.conflicts[0]).toMatchObject({
            file: grenadePath,
            base: 151.5,
            ours: 160,
            theirs: 150,
        });
        expect(cooldownIn(conflicted.values[grenadePath], ARCBOLT)).toBe(160);
        const theirs = editorReducer(conflicted, {
            type: 'resolve-conflict',
            id: conflicted.conflicts[0]!.id,
            choice: 'theirs',
        });
        expect(cooldownIn(theirs.values[grenadePath], ARCBOLT)).toBe(150);
        expect(theirs.conflicts).toEqual([]);
        const kept = editorReducer(conflicted, {
            type: 'resolve-conflict',
            id: conflicted.conflicts[0]!.id,
            choice: 'ours',
        });
        expect(cooldownIn(kept.values[grenadePath], ARCBOLT)).toBe(160);
        expect(kept.conflicts).toEqual([]);
    });
    it('re-adds an ability remotely edited after we deleted it, and removes one remotely deleted after we edited it', () => {
        const base = loaded();
        const original = grenadeOf(base);
        const axion = abilityIn(original, AXION)!;
        const withoutAxion = {
            ...original,
            Abilities: original.Abilities.filter((a) => a.Name !== AXION),
        };
        const remoteEdit = serialize(withCooldown(grenadeOf(base), AXION, 200));
        const readded = rebase(
            edit(base, grenadePath, withoutAxion),
            { [grenadePath]: remoteEdit },
            [grenadePath],
        );
        expect(readded.conflicts).toHaveLength(1);
        const restored = editorReducer(readded, {
            type: 'resolve-conflict',
            id: readded.conflicts[0]!.id,
            choice: 'theirs',
        });
        expect(restored.conflicts).toEqual([]);
        expect(abilityIn(restored.values[grenadePath], AXION)).toEqual({
            ...axion,
            BaseCooldown: 200,
        });

        const edited = edit(base, grenadePath, withCooldown(grenadeOf(base), AXION, 200));
        const remoteDelete = serialize(withoutAxion);
        const removed = rebase(edited, { [grenadePath]: remoteDelete }, [grenadePath]);
        expect(removed.conflicts).toHaveLength(1);
        const dropped = editorReducer(removed, {
            type: 'resolve-conflict',
            id: removed.conflicts[0]!.id,
            choice: 'theirs',
        });
        expect(abilityIn(dropped.values[grenadePath], AXION)).toBeUndefined();
        expect(dropped.conflicts).toEqual([]);
    });
    it('merges locale leaves per key and conflicts only when the same leaf changed differently', () => {
        const base = loaded();
        const ours = edit(
            base,
            localePath,
            withLocaleLeaf(localeOf(base), 'Overview', 'Our overview'),
        );
        const remote = serialize(
            withLocaleLeaf(localeOf(base), 'BaseStatTooltip', 'Remote tooltip'),
        );
        const both = rebase(ours, { [localePath]: remote }, [localePath]);
        expect(both.conflicts).toEqual([]);
        expect(both.values[localePath]).toEqual(
            withLocaleLeaf(
                withLocaleLeaf(localeOf(base), 'Overview', 'Our overview'),
                'BaseStatTooltip',
                'Remote tooltip',
            ),
        );

        const sameLeaf = rebase(
            edit(base, localePath, withLocaleLeaf(localeOf(base), 'Overview', 'Our overview')),
            {
                [localePath]: serialize(
                    withLocaleLeaf(localeOf(base), 'Overview', 'Remote overview'),
                ),
            },
            [localePath],
        );
        expect(sameLeaf.conflicts).toHaveLength(1);
        expect(sameLeaf.conflicts[0]).toMatchObject({
            file: localePath,
            ours: 'Our overview',
            theirs: 'Remote overview',
        });
        expect((sameLeaf.values[localePath] as LocaleFile).Grenade.Overview).toBe('Our overview');
    });
    it('takes the remote value for a file we did not preserve and keeps dirty files whose remote is unchanged', () => {
        const base = loaded();
        const remoteLocale = withLocaleLeaf(localeOf(base), 'Overview', 'Remote overview');
        const ours = edit(base, grenadePath, withCooldown(grenadeOf(base), AXION, 200));
        const merged = rebase(ours, { [localePath]: serialize(remoteLocale) }, [grenadePath]);
        expect(merged.values[localePath]).toEqual(remoteLocale);
        expect(merged.values[grenadePath]).toEqual(withCooldown(grenadeOf(base), AXION, 200));
        expect(merged.conflicts).toEqual([]);
        expect(merged.mergedFiles).toEqual([]);

        const unchanged = rebase(ours, {}, [grenadePath]);
        expect(unchanged.values[grenadePath]).toEqual(withCooldown(grenadeOf(base), AXION, 200));
        expect(unchanged.mergedFiles).toEqual([]);
        expect(unchanged.conflicts).toEqual([]);
        expect(deriveEditorState(unchanged).dirty).toEqual([grenadePath]);
    });
    it('discards conflicts for one file, or every conflict when no file is given', () => {
        const state = bothConflicted();
        expect(state.conflicts.map((conflict) => conflict.file)).toEqual([grenadePath, localePath]);
        const grenadeDiscarded = editorReducer(state, { type: 'discard', file: grenadePath });
        expect(grenadeDiscarded.conflicts.map((conflict) => conflict.file)).toEqual([localePath]);
        expect(editorReducer(state, { type: 'discard' }).conflicts).toEqual([]);
    });
    it('saves originals from the committed text, not from edits made after the snapshot', () => {
        const base = loaded();
        const v1 = withLocaleLeaf(localeOf(base), 'Overview', 'Saved overview');
        const v2 = withLocaleLeaf(localeOf(base), 'Overview', 'Later overview');
        const snapshot = edit(base, localePath, v1);
        const committed = deriveEditorState(snapshot).serialized[localePath]!;
        const later = edit(snapshot, localePath, v2);
        const saved = editorReducer(later, {
            type: 'saved',
            files: { [localePath]: committed },
            head: 'saved',
            source,
        });
        expect(saved.originalValues[localePath]).toEqual(v1);
        const derived = deriveEditorState(saved);
        expect(derived.dirty).toContain(localePath);
        expect(derived.changes.length).toBeGreaterThan(0);
        expect(
            editorReducer(saved, { type: 'discard', file: localePath }).values[localePath],
        ).toEqual(v1);
    });
    it('clears conflicts only for the files that were saved', () => {
        const state = bothConflicted();
        const saved = editorReducer(state, {
            type: 'saved',
            files: { [localePath]: deriveEditorState(state).serialized[localePath]! },
            head: 'saved',
            source,
        });
        expect(saved.conflicts.map((conflict) => conflict.file)).toEqual([grenadePath]);
    });
    it('keeps unresolved conflicts when a stored snapshot is restored', () => {
        const state = bothConflicted();
        const stored = JSON.parse(
            JSON.stringify({
                version: 1,
                snapshots: [
                    {
                        id: 'conflicted',
                        timestamp: Date.now(),
                        head: state.head,
                        originals: state.originals,
                        values: state.values,
                        drafts: state.drafts,
                        itemDrafts: state.itemDrafts,
                        changeCount: 2,
                        conflicts: encodeConflicts(state.conflicts),
                        mergedFiles: state.mergedFiles,
                    },
                ],
            }),
        );
        const [snapshot] = parseRecovery(stored).snapshots;
        const restored = editorReducer(
            createEditorState({ source, loaded: { files: baseFiles, head: 'original' } }),
            { type: 'restore', snapshot: snapshot! },
        );
        expect(restored.conflicts).toEqual(state.conflicts);
        expect(restored.conflicts).toHaveLength(2);
        expect(restored.mergedFiles).toEqual(state.mergedFiles);
        expect(cooldownIn(restored.values[grenadePath], ARCBOLT)).toBe(160);
        const resolved = editorReducer(restored, {
            type: 'resolve-conflict',
            id: restored.conflicts[0]!.id,
            choice: 'theirs',
        });
        expect(resolved.conflicts).toHaveLength(1);
    });
    it('restores a snapshot without conflicts as before', () => {
        const state = loaded();
        const restored = editorReducer(state, {
            type: 'restore',
            snapshot: {
                id: 'plain',
                timestamp: 1,
                head: 'original',
                originals: state.originals,
                values: state.values,
                drafts: {},
                itemDrafts: {},
                changeCount: 0,
            },
        });
        expect(restored.conflicts).toEqual([]);
        expect(restored.mergedFiles).toEqual([]);
    });
    it('does not overwrite an edit made after the reload when taking theirs', () => {
        const state = bothConflicted();
        const conflict = state.conflicts.find((c) => c.file === grenadePath)!;
        const edited = edit(state, grenadePath, withCooldown(grenadeOf(state), ARCBOLT, 333));
        const resolved = editorReducer(edited, {
            type: 'resolve-conflict',
            id: conflict.id,
            choice: 'theirs',
        });
        expect(cooldownIn(resolved.values[grenadePath], ARCBOLT)).toBe(333);
        expect(resolved.conflicts.map((c) => c.file)).toEqual([localePath]);
    });
    it('does not insert a bare entity when the ability was deleted after the reload', () => {
        const state = bothConflicted();
        const conflict = state.conflicts.find((c) => c.file === grenadePath)!;
        const grenade = grenadeOf(state);
        const without = {
            ...grenade,
            Abilities: grenade.Abilities.filter((a) => a.Name !== ARCBOLT),
        };
        const resolved = editorReducer(edit(state, grenadePath, without), {
            type: 'resolve-conflict',
            id: conflict.id,
            choice: 'theirs',
        });
        expect(abilityIn(resolved.values[grenadePath], ARCBOLT)).toBeUndefined();
        expect(resolved.conflicts.map((c) => c.file)).toEqual([localePath]);
    });
    it('clears the merged-files notice when discarding', () => {
        const state = bothConflicted();
        expect(state.mergedFiles).toHaveLength(2);
        expect(editorReducer(state, { type: 'discard' }).mergedFiles).toEqual([]);
        expect(editorReducer(state, { type: 'discard', file: localePath }).mergedFiles).toEqual([
            grenadePath,
        ]);
    });
});
