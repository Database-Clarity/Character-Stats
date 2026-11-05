import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    alreadyOnRemote,
    conflictId,
    editedSinceMerge,
    getAtPath,
    identityResolver,
    mergeFile,
    mergeJson,
    resolveConflict,
    type IdentityAt,
    type MergeConflict,
    type PathSegment,
} from './merge';

interface Item {
    Hash: number;
    Name: string;
    CD: number;
    Tags: number[];
}

interface Doc {
    Name: string;
    Cooldown: number;
    Items: Item[];
    Notes?: string;
    Other?: number;
}

interface Ability {
    Hash: number;
    Name: string;
    BaseCooldown: number;
}

interface StatFile {
    Name: string;
    Abilities: Ability[];
}

interface Locale {
    Grenade: { Overview: string };
    Melee: { Overview: string };
}

const identityAt: IdentityAt = (path) =>
    path.length === 1 && path[0] === 'Items' ? 'Hash' : undefined;

const base: Doc = {
    Name: 'X',
    Cooldown: 10,
    Items: [
        { Hash: 1, Name: 'A', CD: 1, Tags: [1] },
        { Hash: 2, Name: 'B', CD: 2, Tags: [2] },
    ],
};

const clone = (): Doc => structuredClone(base);

/** Finds the entry with the given hash, failing loudly when a fixture is wrong. */
const byHash = <T extends { Hash: number }>(items: readonly T[], hash: number): T => {
    const item = items.find((candidate) => candidate.Hash === hash);
    if (!item) throw new Error(`No item with Hash ${hash}`);
    return item;
};
const itemOf = (doc: Doc, hash: number) => byHash(doc.Items, hash);
const mergedItem = (value: unknown, hash: number) =>
    (value as Doc).Items.find((item) => item.Hash === hash);
const hashesOf = (value: unknown) => (value as Doc).Items.map((item) => item.Hash);
const seg = (id: number): PathSegment => ({ id: String(id), key: 'Hash' });
const dropHash2 = (doc: Doc): Doc => ({
    ...doc,
    Items: doc.Items.filter((item) => item.Hash !== 2),
});
const reorder = (doc: Doc, hashes: number[]): Doc => {
    const copy = structuredClone(doc);
    copy.Items = hashes.map((hash) => itemOf(copy, hash));
    return copy;
};
const only = (conflicts: MergeConflict[]): MergeConflict => {
    expect(conflicts).toHaveLength(1);
    return conflicts[0]!;
};
/** Same data with every object's keys in reverse order. */
const reverseKeys = (value: unknown): unknown =>
    Array.isArray(value)
        ? value.map(reverseKeys)
        : typeof value === 'object' && value !== null
          ? Object.fromEntries(
                Object.entries(value)
                    .reverse()
                    .map(([key, child]) => [key, reverseKeys(child)]),
            )
          : value;

describe('mergeJson', () => {
    describe('entity arrays', () => {
        it('keeps entities added on both sides, remote order first', () => {
            const ours = clone();
            ours.Items.push({ Hash: 3, Name: 'C', CD: 3, Tags: [] });
            const theirs = clone();
            theirs.Items.push({ Hash: 4, Name: 'D', CD: 4, Tags: [] });
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([1, 2, 4, 3]);
        });

        it('collapses an identical addition on both sides into one entity', () => {
            const ours = clone();
            ours.Items.push({ Hash: 3, Name: 'C', CD: 3, Tags: [] });
            const theirs = clone();
            theirs.Items.push({ Hash: 3, Name: 'C', CD: 3, Tags: [] });
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([1, 2, 3]);
        });

        it('conflicts when the same new entity differs on both sides', () => {
            const ours = clone();
            ours.Items.push({ Hash: 5, Name: 'E', CD: 5, Tags: [] });
            const theirs = clone();
            theirs.Items.push({ Hash: 5, Name: 'E', CD: 6, Tags: [] });
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual(['Items', seg(5)]);
            expect(conflict.base).toBeUndefined();
            expect(conflict.ours).toEqual({ Hash: 5, Name: 'E', CD: 5, Tags: [] });
            expect(conflict.theirs).toEqual({ Hash: 5, Name: 'E', CD: 6, Tags: [] });
            expect(mergedItem(result.value, 5)).toEqual(conflict.ours);
        });

        it('applies edits to different fields of the same entity', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = clone();
            itemOf(theirs, 1).Name = 'A2';
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(mergedItem(result.value, 1)).toEqual({ Hash: 1, Name: 'A2', CD: 5, Tags: [1] });
        });

        it('applies edits to different entities', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = clone();
            itemOf(theirs, 2).CD = 9;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(mergedItem(result.value, 1)?.CD).toBe(5);
            expect(mergedItem(result.value, 2)?.CD).toBe(9);
        });

        it('conflicts when the same field of one entity changes differently', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = clone();
            itemOf(theirs, 1).CD = 6;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict).toMatchObject({
                path: ['Items', seg(1), 'CD'],
                ours: 5,
                theirs: 6,
                base: 1,
            });
            expect(mergedItem(result.value, 1)?.CD).toBe(5);
        });

        it('does not conflict when both sides make the same field change', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = clone();
            itemOf(theirs, 1).CD = 5;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(mergedItem(result.value, 1)?.CD).toBe(5);
        });

        it('conflicts when we delete an entity theirs edited, keeping the deletion provisionally', () => {
            const ours = dropHash2(clone());
            const theirs = clone();
            itemOf(theirs, 2).CD = 9;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual(['Items', seg(2)]);
            expect(conflict.ours).toBeUndefined();
            expect(conflict.theirs).toEqual({ Hash: 2, Name: 'B', CD: 9, Tags: [2] });
            expect(conflict.base).toEqual({ Hash: 2, Name: 'B', CD: 2, Tags: [2] });
            expect(hashesOf(result.value)).toEqual([1]);
        });

        it('conflicts when they delete an entity we edited, keeping our edit provisionally', () => {
            const ours = clone();
            itemOf(ours, 2).CD = 9;
            const theirs = dropHash2(clone());
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual(['Items', seg(2)]);
            expect(conflict.ours).toEqual({ Hash: 2, Name: 'B', CD: 9, Tags: [2] });
            expect(conflict.theirs).toBeUndefined();
            expect(hashesOf(result.value)).toEqual([1, 2]);
            expect(mergedItem(result.value, 2)?.CD).toBe(9);
        });

        it('deletes an entity when only we delete it', () => {
            const result = mergeJson('f.json', base, dropHash2(clone()), clone(), identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([1]);
        });

        it('deletes an entity when only they delete it', () => {
            const result = mergeJson('f.json', base, clone(), dropHash2(clone()), identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([1]);
        });

        it('deletes an entity when both sides delete it', () => {
            const result = mergeJson(
                'f.json',
                base,
                dropHash2(clone()),
                dropHash2(clone()),
                identityAt,
            );
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([1]);
        });

        it('applies our reorder alongside their edit', () => {
            const ours = reorder(clone(), [2, 1]);
            const theirs = clone();
            itemOf(theirs, 1).CD = 5;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([2, 1]);
            expect(mergedItem(result.value, 1)?.CD).toBe(5);
        });

        it('applies their reorder alongside our edit', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = reorder(clone(), [2, 1]);
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([2, 1]);
            expect(mergedItem(result.value, 1)?.CD).toBe(5);
        });

        it('follows the remote order when both sides reorder differently', () => {
            const three = clone();
            three.Items.push({ Hash: 3, Name: 'C', CD: 3, Tags: [3] });
            const ours = reorder(three, [3, 1, 2]);
            const theirs = reorder(three, [2, 3, 1]);
            const result = mergeJson('f.json', three, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(hashesOf(result.value)).toEqual([2, 3, 1]);
        });

        it('merges an entity array as one value when an item lacks its identity', () => {
            const ours = clone();
            const item = itemOf(ours, 1);
            item.CD = 5;
            delete (item as Partial<Item>).Hash;
            const theirs = clone();
            itemOf(theirs, 1).CD = 6;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(only(result.conflicts).path).toEqual(['Items']);
            expect(result.value).toEqual(ours);
        });

        it('merges an entity array as one value when identities repeat', () => {
            const ours = clone();
            ours.Items.push({ Hash: 1, Name: 'A2', CD: 7, Tags: [] });
            const theirs = clone();
            itemOf(theirs, 2).CD = 9;
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(only(result.conflicts).path).toEqual(['Items']);
            expect(result.value).toEqual(ours);
        });
    });

    describe('scalars', () => {
        it('conflicts when both sides change a value differently', () => {
            const ours = { ...clone(), Cooldown: 11 };
            const theirs = { ...clone(), Cooldown: 12 };
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual(['Cooldown']);
            expect(conflict.ours).toBe(11);
            expect(conflict.theirs).toBe(12);
            expect((result.value as Doc).Cooldown).toBe(11);
        });

        it('takes the value from whichever side changed alone', () => {
            const onlyOurs = mergeJson('f.json', base, { ...clone(), Cooldown: 11 }, clone());
            expect(onlyOurs.conflicts).toEqual([]);
            expect((onlyOurs.value as Doc).Cooldown).toBe(11);

            const onlyTheirs = mergeJson('f.json', base, clone(), { ...clone(), Cooldown: 12 });
            expect(onlyTheirs.conflicts).toEqual([]);
            expect((onlyTheirs.value as Doc).Cooldown).toBe(12);
        });

        it('accepts an identical change on both sides', () => {
            const result = mergeJson(
                'f.json',
                base,
                { ...clone(), Cooldown: 12 },
                { ...clone(), Cooldown: 12 },
                identityAt,
            );
            expect(result.conflicts).toEqual([]);
            expect((result.value as Doc).Cooldown).toBe(12);
        });
    });

    describe('non-entity arrays', () => {
        it('conflicts when both sides change a nested array differently', () => {
            const ours = clone();
            itemOf(ours, 1).Tags = [1, 9];
            const theirs = clone();
            itemOf(theirs, 1).Tags = [1, 8];
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual(['Items', seg(1), 'Tags']);
            expect(mergedItem(result.value, 1)?.Tags).toEqual([1, 9]);
        });

        it('applies a nested array changed on one side only', () => {
            const ours = clone();
            itemOf(ours, 1).Tags = [1, 9];
            const result = mergeJson('f.json', base, ours, clone(), identityAt);
            expect(result.conflicts).toEqual([]);
            expect(mergedItem(result.value, 1)?.Tags).toEqual([1, 9]);
        });
    });

    describe('without an identity function', () => {
        it('conflicts on the whole Items array when both sides change it differently', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const theirs = clone();
            itemOf(theirs, 2).CD = 9;
            const result = mergeJson('f.json', base, ours, theirs);
            expect(only(result.conflicts).path).toEqual(['Items']);
            expect(result.value).toEqual(ours);
        });

        it('applies the whole Items array when only one side changes it', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const result = mergeJson('f.json', base, ours, clone());
            expect(result.conflicts).toEqual([]);
            expect(result.value).toEqual(ours);
        });
    });

    describe('object keys', () => {
        it('keeps keys added on each side', () => {
            const ours = { ...clone(), Notes: 'n' };
            const theirs = { ...clone(), Other: 1 };
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(result.value).toMatchObject({ Notes: 'n', Other: 1 });
        });

        it('removes a key deleted on one side only', () => {
            const ours: Partial<Doc> = clone();
            delete ours.Cooldown;
            const result = mergeJson('f.json', base, ours, clone(), identityAt);
            expect(result.conflicts).toEqual([]);
            expect(result.value).not.toHaveProperty('Cooldown');
        });

        it('conflicts when one side deletes a key the other changed', () => {
            const ours: Partial<Doc> = clone();
            delete ours.Cooldown;
            const theirs = { ...clone(), Cooldown: 12 };
            const result = mergeJson('f.json', base, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict).toMatchObject({
                path: ['Cooldown'],
                base: 10,
                ours: undefined,
                theirs: 12,
            });
        });
    });

    describe('key order', () => {
        it('ignores key order when both sides hold the same data', () => {
            const edited = clone();
            itemOf(edited, 1).CD = 5;
            edited.Cooldown = 12;
            const ours = reverseKeys(edited);
            expect(JSON.stringify(ours)).not.toBe(JSON.stringify(edited));
            const result = mergeJson('f.json', base, ours, edited, identityAt);
            expect(result.conflicts).toEqual([]);
            expect(result.value).toEqual(edited);
        });
    });

    describe('whole-file conflicts', () => {
        it('conflicts when both sides create the file differently', () => {
            const ours = clone();
            const theirs = { ...clone(), Cooldown: 12 };
            const result = mergeJson('f.json', undefined, ours, theirs, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual([]);
            expect(conflict.base).toBeUndefined();
            expect(result.value).toEqual(ours);
        });

        it('conflicts when the file is deleted remotely while edited locally', () => {
            const ours = clone();
            itemOf(ours, 1).CD = 5;
            const result = mergeJson('f.json', base, ours, undefined, identityAt);
            const conflict = only(result.conflicts);
            expect(conflict.path).toEqual([]);
            expect(conflict.theirs).toBeUndefined();
            expect(result.value).toEqual(ours);
        });
    });
});

describe('resolveConflict', () => {
    it('takes the remote value for a scalar conflict', () => {
        const ours = { ...clone(), Cooldown: 11 };
        const theirs = { ...clone(), Cooldown: 12 };
        const result = mergeJson('f.json', base, ours, theirs, identityAt);
        const conflict = only(result.conflicts);
        const before = structuredClone(result.value);
        const resolved = resolveConflict(result.value, conflict, 'theirs');
        expect((resolved as Doc).Cooldown).toBe(12);
        expect(result.value).toEqual(before);
    });

    it('re-adds a deleted entity from theirs when they chose to keep it', () => {
        const ours = dropHash2(clone());
        const theirs = clone();
        itemOf(theirs, 2).CD = 9;
        const result = mergeJson('f.json', base, ours, theirs, identityAt);
        const conflict = only(result.conflicts);
        const before = structuredClone(result.value);
        const resolved = resolveConflict(result.value, conflict, 'theirs');
        expect(hashesOf(resolved)).toEqual([1, 2]);
        expect(mergedItem(resolved, 2)).toEqual({ Hash: 2, Name: 'B', CD: 9, Tags: [2] });
        expect(result.value).toEqual(before);
    });

    it('removes an entity we edited when they chose the deletion', () => {
        const ours = clone();
        itemOf(ours, 2).CD = 9;
        const theirs = dropHash2(clone());
        const result = mergeJson('f.json', base, ours, theirs, identityAt);
        const conflict = only(result.conflicts);
        const before = structuredClone(result.value);
        const resolved = resolveConflict(result.value, conflict, 'theirs');
        expect(hashesOf(resolved)).toEqual([1]);
        expect(result.value).toEqual(before);
    });

    it('returns the same root reference when choosing ours', () => {
        const ours = { ...clone(), Cooldown: 11 };
        const theirs = { ...clone(), Cooldown: 12 };
        const result = mergeJson('f.json', base, ours, theirs, identityAt);
        const conflict = only(result.conflicts);
        expect(resolveConflict(result.value, conflict, 'ours')).toBe(result.value);
    });

    it('returns the remote value itself for a whole-file conflict', () => {
        const ours = clone();
        const theirs = { ...clone(), Cooldown: 12 };
        const result = mergeJson('f.json', undefined, ours, theirs, identityAt);
        const conflict = only(result.conflicts);
        expect(resolveConflict(result.value, conflict, 'theirs')).toBe(conflict.theirs);
    });
});

describe('conflictId', () => {
    it('is stable for the same file and path', () => {
        const ours = { ...clone(), Cooldown: 11 };
        const theirs = { ...clone(), Cooldown: 12 };
        const first = mergeJson('f.json', base, ours, theirs, identityAt);
        const second = mergeJson('f.json', base, ours, theirs, identityAt);
        expect(only(first.conflicts).id).toBe(only(second.conflicts).id);
    });

    it('differs between conflicts at different paths', () => {
        const ours = { ...clone(), Cooldown: 11 };
        const theirs = { ...clone(), Cooldown: 12 };
        ours.Items[0]!.CD = 5;
        theirs.Items[0]!.CD = 6;
        const result = mergeJson('f.json', base, ours, theirs, identityAt);
        expect(result.conflicts).toHaveLength(2);
        const [first, second] = result.conflicts;
        expect(first!.id).not.toBe(second!.id);
        expect(conflictId('f.json', first!.path)).toBe(first!.id);
    });
});

describe('conflictId escaping', () => {
    it('keeps keys containing separators distinct from nested paths', () => {
        const ids = [
            conflictId('f', ['a.b']),
            conflictId('f', ['a', 'b']),
            conflictId('f', ['a/b']),
            conflictId('f', ['a~1b']),
            conflictId('f', ['[Hash=1]']),
            conflictId('f', [seg(1)]),
            conflictId('f', []),
        ];
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('getAtPath', () => {
    const doc = clone();
    it('walks keys and entity references', () => {
        expect(getAtPath(doc, ['Cooldown'])).toBe(10);
        expect(getAtPath(doc, ['Items', seg(2), 'CD'])).toBe(2);
        expect(getAtPath(doc, [])).toBe(doc);
    });
    it('returns undefined for missing steps', () => {
        expect(getAtPath(doc, ['Items', seg(9), 'CD'])).toBeUndefined();
        expect(getAtPath(doc, ['Cooldown', 'x'])).toBeUndefined();
        expect(getAtPath(undefined, ['Items', seg(1)])).toBeUndefined();
    });
});

describe('resolveConflict against edits made after the merge', () => {
    const conflictFor = (ours: Doc, theirs: Doc) =>
        only(mergeJson('f.json', base, ours, theirs, identityAt).conflicts);
    const ours = { ...clone(), Cooldown: 11 };
    const theirs = { ...clone(), Cooldown: 12 };
    const conflict = conflictFor(ours, theirs);

    it('takes theirs when the path is unchanged since the merge', () => {
        expect(editedSinceMerge(ours, conflict)).toBe(false);
        expect((resolveConflict(ours, conflict, 'theirs') as Doc).Cooldown).toBe(12);
    });
    it('keeps a newer edit instead of overwriting it', () => {
        const edited = { ...ours, Cooldown: 33 };
        expect(editedSinceMerge(edited, conflict)).toBe(true);
        expect(resolveConflict(edited, conflict, 'theirs')).toBe(edited);
    });
    it('does not insert a bare entity after the entity was deleted', () => {
        const o = clone();
        o.Items[0]!.CD = 5;
        const t = clone();
        t.Items = t.Items.filter((item) => item.Hash !== 1);
        const entityConflict = conflictFor(o, t);
        const deleted = { ...o, Items: o.Items.filter((item) => item.Hash !== 1) };
        expect(hashesOf(resolveConflict(deleted, entityConflict, 'theirs'))).toEqual([2]);
    });
    it('does not re-add an entity the author deleted and the remote edited', () => {
        const o = clone();
        o.Items = o.Items.filter((item) => item.Hash !== 1);
        const t = clone();
        t.Items[0]!.CD = 9;
        const entityConflict = conflictFor(o, t);
        expect(hashesOf(resolveConflict(o, entityConflict, 'theirs'))).toEqual([2, 1]);
        const readded = clone();
        readded.Items[0]!.CD = 7;
        expect(resolveConflict(readded, entityConflict, 'theirs')).toBe(readded);
    });
});

describe('alreadyOnRemote', () => {
    const ours = { 'a.json': '1', 'b.json': '2' };

    it('is true when every dirty file matches the remote text', () => {
        expect(alreadyOnRemote(['a.json', 'b.json'], ours, { ...ours })).toBe(true);
    });

    it('is false when one dirty file differs remotely', () => {
        expect(alreadyOnRemote(['a.json', 'b.json'], ours, { ...ours, 'b.json': '3' })).toBe(false);
    });

    it('is false when a dirty file is missing remotely', () => {
        expect(alreadyOnRemote(['a.json', 'b.json'], ours, { 'a.json': '1' })).toBe(false);
    });

    it('is false when nothing is dirty', () => {
        expect(alreadyOnRemote([], ours, { ...ours })).toBe(false);
    });
});

describe('mergeFile with the stat registry', () => {
    const grenadePath = 'sources/stats/grenade.json';
    const grenade = JSON.parse(
        readFileSync(new URL('../../../sources/stats/grenade.json', import.meta.url), 'utf8'),
    ) as StatFile;
    const ARCBOLT = 1582574009;
    const COLDSNAP = 1399219;

    it('resolves the Abilities identity from the registry', () => {
        expect(identityResolver(grenadePath, grenade)(['Abilities'])).toBe('Hash');
    });

    it('applies changes to different abilities in the same stat file', () => {
        const ours = structuredClone(grenade);
        byHash(ours.Abilities, ARCBOLT).BaseCooldown = 100;
        const theirs = structuredClone(grenade);
        byHash(theirs.Abilities, COLDSNAP).BaseCooldown = 200;
        const result = mergeFile(grenadePath, grenade, ours, theirs);
        expect(result.conflicts).toEqual([]);
        const merged = result.value as StatFile;
        expect(byHash(merged.Abilities, ARCBOLT).BaseCooldown).toBe(100);
        expect(byHash(merged.Abilities, COLDSNAP).BaseCooldown).toBe(200);
    });

    it('conflicts when the same ability changes differently', () => {
        const ours = structuredClone(grenade);
        byHash(ours.Abilities, ARCBOLT).BaseCooldown = 100;
        const theirs = structuredClone(grenade);
        byHash(theirs.Abilities, ARCBOLT).BaseCooldown = 200;
        const result = mergeFile(grenadePath, grenade, ours, theirs);
        const conflict = only(result.conflicts);
        expect(conflict.path).toEqual([
            'Abilities',
            { id: String(ARCBOLT), key: 'Hash' },
            'BaseCooldown',
        ]);
        expect(conflict).toMatchObject({ ours: 100, theirs: 200 });
    });
});

describe('mergeFile with the locale file', () => {
    const locale = JSON.parse(
        readFileSync(new URL('../../../locale/en.json', import.meta.url), 'utf8'),
    ) as Locale;

    it('applies edits to different locale strings', () => {
        const ours = structuredClone(locale);
        ours.Grenade.Overview = 'Grenade edited locally.';
        const theirs = structuredClone(locale);
        theirs.Melee.Overview = 'Melee edited remotely.';
        const result = mergeFile('locale/en.json', locale, ours, theirs);
        expect(result.conflicts).toEqual([]);
        const merged = result.value as Locale;
        expect(merged.Grenade.Overview).toBe('Grenade edited locally.');
        expect(merged.Melee.Overview).toBe('Melee edited remotely.');
    });

    it('conflicts when the same locale string changes differently', () => {
        const ours = structuredClone(locale);
        ours.Grenade.Overview = 'Ours.';
        const theirs = structuredClone(locale);
        theirs.Grenade.Overview = 'Theirs.';
        const result = mergeFile('locale/en.json', locale, ours, theirs);
        const conflict = only(result.conflicts);
        expect(conflict.path).toEqual(['Grenade', 'Overview']);
        expect(conflict).toMatchObject({
            ours: 'Ours.',
            theirs: 'Theirs.',
            base: locale.Grenade.Overview,
        });
    });
});
