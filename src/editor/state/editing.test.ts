import { describe, expect, it } from 'vitest';
import { abilitySpec, overrideSpec, movementClassSpec, validateEntity } from '../../core';
import {
    adjacentChange,
    changeAffectsStat,
    collectChanges,
    createItemDraft,
    editRequirement,
    followEntityIdentity,
    hasDraftIdentity,
    indexEntityRows,
    revertRequirementTable,
    selectEntityFormSession,
    toggleParallel,
} from './editing';

describe('requirement and parallel-array editing', () => {
    const value = {
        Requirements: [11, 22],
        Scalar: [0.5, 0.8],
        ChunkEnergyOverride: [0.3, 0.4],
        Notes: 'keep',
    };
    it('adds a row to every enabled parallel array without mutating the source', () => {
        const next = editRequirement(value, overrideSpec.fields, 'Requirements', {
            type: 'add',
            hash: 0,
        });
        expect(next.Requirements).toEqual([11, 22, 0]);
        expect(next.Scalar).toEqual([0.5, 0.8, 1]);
        expect(next.ChunkEnergyOverride).toEqual([0.3, 0.4, 1]);
        expect(value.Requirements).toEqual([11, 22]);
    });
    it('removes and reorders corresponding values atomically', () => {
        const moved = editRequirement(value, overrideSpec.fields, 'Requirements', {
            type: 'move',
            index: 0,
            to: 1,
        });
        expect(moved).toMatchObject({
            Requirements: [22, 11],
            Scalar: [0.8, 0.5],
            ChunkEnergyOverride: [0.4, 0.3],
        });
        expect(
            editRequirement(moved, overrideSpec.fields, 'Requirements', {
                type: 'remove',
                index: 0,
            }),
        ).toMatchObject({ Requirements: [11], Scalar: [0.5], ChunkEnergyOverride: [0.3] });
    });
    it('does not create disabled arrays when adding requirements', () => {
        expect(
            editRequirement({ Requirements: [1] }, overrideSpec.fields, 'Requirements', {
                type: 'add',
                hash: -123,
            }),
        ).toEqual({ Requirements: [1, -123] });
    });
    it('enables optional columns at the current requirement length and removes disabled keys', () => {
        const field = overrideSpec.fields.find((f) => f.key === 'Scalar')!;
        expect(toggleParallel({ Requirements: [1, 2, 3] }, field, true)).toEqual({
            Requirements: [1, 2, 3],
            Scalar: [1, 1, 1],
        });
        expect(toggleParallel(value, field, false)).not.toHaveProperty('Scalar');
    });
});
describe('malformed requirement recovery', () => {
    it('does not trust length-like objects when enabling a parallel array', () => {
        const scalar = overrideSpec.fields.find((field) => field.key === 'Scalar')!;
        expect(
            toggleParallel({ Requirements: { length: 1000000000 } }, scalar, true).Scalar,
        ).toEqual([]);
    });
});

describe('atomic requirement table revert', () => {
    it('restores Requirements and every parallel array together', () => {
        const saved = {
            Requirements: [11, 22],
            Scalar: [0.5, 0.8],
            ChunkEnergyOverride: [0.3, 0.4],
        };
        const changed = {
            Requirements: [22, 11],
            Scalar: [0.8, 0.5],
            ChunkEnergyOverride: [0.4, 0.3],
            Notes: 'keep this edit',
        };
        expect(revertRequirementTable(changed, overrideSpec.fields, 'Requirements', saved)).toEqual(
            { ...saved, Notes: 'keep this edit' },
        );
    });

    it('removes optional parallel arrays absent in the saved table', () => {
        expect(
            revertRequirementTable(
                { Requirements: [22], Scalar: [0.5] },
                overrideSpec.fields,
                'Requirements',
                { Requirements: [11] },
            ),
        ).toEqual({ Requirements: [11] });
    });
});

describe('entity form selection sessions', () => {
    it('keeps the form token when selection follows an edited identity', () => {
        const selected = selectEntityFormSession({ selected: null, token: 0 }, '11');
        const renamed = followEntityIdentity(selected, '22');
        expect(renamed).toEqual({ selected: '22', baseline: '11', token: selected.token });
        expect(selectEntityFormSession(renamed, '33')).toEqual({
            selected: '33',
            baseline: '33',
            token: 2,
        });
    });
});

describe('entity row indexing', () => {
    it('indexes current and saved items once and emits added, changed, and deleted rows', () => {
        const current = [
            { Hash: 1, Name: 'Changed' },
            { Hash: 3, Name: 'Added' },
        ];
        const saved = [
            { Hash: 1, Name: 'Original' },
            { Hash: 2, Name: 'Deleted' },
        ];
        const index = indexEntityRows(current, saved, 'Hash');
        expect(index.currentById.get('1')).toBe(current[0]);
        expect(index.savedById.get('1')).toBe(saved[0]);
        expect(index.rows).toEqual([
            { item: current[0], deleted: false, old: saved[0] },
            { item: current[1], deleted: false, old: undefined },
            { item: saved[1], deleted: true, old: saved[1] },
        ]);
    });
});

describe('item draft creation', () => {
    it('starts new drafts without a Hash or Name and requires both before adding', () => {
        const draft = createItemDraft(abilitySpec, []);
        expect(draft.Hash).toBe('');
        expect(draft.Name).toBe('');
        expect(hasDraftIdentity(abilitySpec, draft)).toBe(false);
        expect(hasDraftIdentity(abilitySpec, { ...draft, Hash: 123, Name: 'Intentional' })).toBe(
            true,
        );
    });

    it('copies non-identity fields into isolated duplicates that still require identity', () => {
        const item = {
            Hash: 1,
            Name: 'Test',
            BaseCooldown: 100,
            ChunkEnergyScalar: 1,
            ChargeBasedScaling: [1, 2],
        };
        const draft = createItemDraft(abilitySpec, [item, { Hash: 2 }], item);
        expect(draft.Hash).toBe('');
        expect(draft.Name).toBe('');
        expect(draft.BaseCooldown).toBe(100);
        expect(hasDraftIdentity(abilitySpec, draft)).toBe(false);
        (draft.ChargeBasedScaling as number[])[0] = 9;
        expect(item.ChargeBasedScaling[0]).toBe(1);
    });
    it('uses spec constraints for required numeric arrays while leaving identity blank', () => {
        const draft = createItemDraft(movementClassSpec, []);
        expect(draft.BaseMobilityTier).toBe(1);
        expect(draft.BaseSprintSpeed).toBe(1);
        expect(draft.ClassHash).toBe('');
        expect(draft.Name).toBe('');
        expect(validateEntity(movementClassSpec, draft).some((i) => i.severity === 'error')).toBe(
            true,
        );
    });
    it('does not invent optional override effects, so an incomplete override is invalid', () => {
        const draft = createItemDraft(overrideSpec, []);
        expect(draft).not.toHaveProperty('Scalar');
        expect(validateEntity(overrideSpec, draft).some((i) => i.severity === 'error')).toBe(true);
    });
});
describe('semantic change navigation', () => {
    const file = 'sources/stats/grenade.json';
    const before = {
        Hash: 1735777505,
        Name: 'Grenade',
        Fields: { CooldownScalars: { Values: [1] } },
        Abilities: [
            { Hash: 11, Name: 'A', BaseCooldown: 100, ChunkEnergyScalar: 1 },
            { Hash: 22, Name: 'B', BaseCooldown: 200, ChunkEnergyScalar: 1 },
        ],
        Overrides: [],
    };
    it('matches collection items by identity instead of their array index', () => {
        const after = {
            ...before,
            Abilities: [before.Abilities[1], { ...before.Abilities[0], BaseCooldown: 150 }],
        };
        const changes = collectChanges({ [file]: JSON.stringify(before) }, { [file]: after });
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            stat: 'Grenade',
            tab: 'Abilities',
            itemKey: '11',
            field: 'BaseCooldown',
            before: 100,
            after: 150,
        });
    });
    it('tracks added and deleted records once, and targets nested locale leaves', () => {
        const changes = collectChanges(
            {
                [file]: JSON.stringify(before),
                'locale/en.json': JSON.stringify({ Grenade: { Nested: { Line: 'Old' } } }),
            },
            {
                [file]: { ...before, Abilities: [before.Abilities[0], { Hash: 33, Name: 'C' }] },
                'locale/en.json': { Grenade: { Nested: { Line: 'New' } } },
            },
        );
        expect(changes.map((c) => c.kind)).toEqual(['deleted', 'added', 'modified']);
        expect(changes[2]).toMatchObject({
            stat: 'Grenade',
            tab: 'Text',
            field: 'Grenade.Nested.Line',
        });
    });
    it('wraps forward and backward and tolerates the active change disappearing', () => {
        const changes = collectChanges(
            { [file]: JSON.stringify(before) },
            { [file]: { ...before, Abilities: [] } },
        );
        expect(adjacentChange(changes, undefined, 1)).toBe(changes[0]);
        expect(adjacentChange(changes, undefined, -1)).toBe(changes.at(-1));
        expect(adjacentChange(changes, changes.at(-1)!.id, 1)).toBe(changes[0]);
        expect(adjacentChange(changes, 'missing', 1)).toBe(changes[0]);
        expect(adjacentChange([], undefined, 1)).toBeUndefined();
    });
});

describe('shared locale change routing', () => {
    it('counts a shared string once and routes it to a registered consumer', () => {
        const changes = collectChanges(
            { 'locale/en.json': JSON.stringify({ ChargeBasedScaling: 'Old' }) },
            { 'locale/en.json': { ChargeBasedScaling: 'New' } },
        );
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            stat: 'Melee',
            tab: 'Text',
            field: 'ChargeBasedScaling',
            item: 'Shared locale',
        });
        expect(changeAffectsStat(changes[0]!, 'Grenade')).toBe(true);
        expect(changeAffectsStat(changes[0]!, 'Health')).toBe(false);
    });
});
