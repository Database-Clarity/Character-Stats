import { describe, expect, it } from 'vitest';
import { abilitySpec, overrideSpec, movementClassSpec, validateEntity } from '../../core';
import movementData from '../../../sources/movement.json';
import {
    adjacentChange,
    changeAffectsStat,
    collectChanges,
    createItemDraft,
    editRequirement,
    followEntityIdentity,
    groupRowsByBaseCooldown,
    hasDraftIdentity,
    indexEntityRows,
    issueTarget,
    revertRequirementTable,
    selectEntityFormSession,
    sharedEntityFields,
    toggleParallel,
    updateNestedField,
    updateEntityGroupField,
} from './editing';

describe('cooldown ability groups', () => {
    it('groups strictly by equal finite BaseCooldown values', () => {
        const rows = [
            { item: { Hash: 1, BaseCooldown: 30, Scalar: 0.5 }, deleted: false, old: undefined },
            { item: { Hash: 2, BaseCooldown: 30, Scalar: 0.8 }, deleted: false, old: undefined },
            { item: { Hash: 3, BaseCooldown: 60, Scalar: 0.5 }, deleted: false, old: undefined },
            { item: { Hash: 4, BaseCooldown: Number.NaN }, deleted: false, old: undefined },
        ];
        const { groups, ungrouped } = groupRowsByBaseCooldown(rows);
        expect(
            groups.map(({ cooldown, rows: group }) => [
                cooldown,
                group.map(({ item }) => item.Hash),
            ]),
        ).toEqual([
            [30, [1, 2]],
            [60, [3]],
        ]);
        expect(ungrouped.map(({ item }) => item.Hash)).toEqual([4]);
    });

    it('offers only identical non-identity fields for group editing', () => {
        const members = [
            {
                Hash: 1,
                Name: 'Shared name',
                BaseCooldown: 30,
                ChunkEnergyScalar: 0.5,
                ChargeBasedScaling: [0.5],
                Notes: 'One entry',
            },
            {
                Hash: 2,
                Name: 'Shared name',
                BaseCooldown: 30,
                ChunkEnergyScalar: 0.8,
                ChargeBasedScaling: [0.8],
                Notes: 'Another entry',
            },
        ];
        expect(sharedEntityFields(abilitySpec, members, 'Hash').map((field) => field.key)).toEqual([
            'Name',
            'BaseCooldown',
        ]);
    });

    it('updates every group member, preserves identities, and supports per-member restores', () => {
        const items = [
            { Hash: 1, Name: 'A', BaseCooldown: 30 },
            { Hash: 2, Name: 'B', BaseCooldown: 30 },
            { Hash: 3, Name: 'C', BaseCooldown: 60 },
        ];
        const edited = updateEntityGroupField(items, 'Hash', ['1', '2'], 'BaseCooldown', () => 45);
        expect(edited).toEqual([
            { Hash: 1, Name: 'A', BaseCooldown: 45 },
            { Hash: 2, Name: 'B', BaseCooldown: 45 },
            items[2],
        ]);
        const restored = updateEntityGroupField(
            edited,
            'Hash',
            ['1', '2'],
            'BaseCooldown',
            (item) => (item.Hash === 1 ? 30 : 35),
        );
        expect(restored.map((item) => item.BaseCooldown)).toEqual([30, 35, 60]);
        expect(() =>
            updateEntityGroupField(items, 'Hash', ['1', 'missing'], 'BaseCooldown', () => 45),
        ).toThrow('An ability group member no longer exists');
    });
});

describe('nested semantic changes and reverts', () => {
    const file = 'sources/movement.json';
    const baseline = () => structuredClone(movementData);
    const changesFor = (next: unknown) =>
        collectChanges({ [file]: JSON.stringify(movementData) }, { [file]: next });

    it('targets nested rule leaves and reverts one without losing adjacent edits', () => {
        const next = updateNestedField(
            updateNestedField(baseline(), 'Rules.StrafeMultiplier', 0.8),
            'Rules.CrouchMultiplier',
            0.6,
        );
        expect(changesFor(next).map((change) => [change.tab, change.field])).toEqual([
            ['Fields', 'Rules.StrafeMultiplier'],
            ['Fields', 'Rules.CrouchMultiplier'],
        ]);
        const reverted = updateNestedField(
            next,
            'Rules.StrafeMultiplier',
            movementData.Rules.StrafeMultiplier,
        );
        expect(changesFor(reverted).map((change) => change.field)).toEqual([
            'Rules.CrouchMultiplier',
        ]);
        expect(movementData.Rules.StrafeMultiplier).toBe(0.85);
    });

    it('targets nested array fields within a collection identity', () => {
        const next = updateNestedField(baseline(), 'Sources.0.Effects.0.Values', [4, 6, 7]);
        const changes = changesFor(next);
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({
            tab: 'Sources',
            itemKey: String(movementData.Sources[0]!.Hash),
            field: 'Effects.0.Values',
            before: [3, 5, 6],
            after: [4, 6, 7],
        });
        const reverted = updateNestedField(next, 'Sources.0.Effects.0.Values', changes[0]!.before);
        expect(changesFor(reverted)).toEqual([]);
    });

    it('tracks nested optional fields and removes their key on revert', () => {
        const next = updateNestedField(baseline(), 'Sources.0.Effects.0.BoostedValues', [4, 6, 7]);
        const change = changesFor(next)[0]!;
        expect(change).toMatchObject({ kind: 'added', field: 'Effects.0.BoostedValues' });
        const reverted = updateNestedField(
            next,
            'Sources.0.Effects.0.BoostedValues',
            change.before,
        );
        expect(changesFor(reverted)).toEqual([]);
        expect((reverted.Sources as typeof movementData.Sources)[0]!.Effects[0]).not.toHaveProperty(
            'BoostedValues',
        );
    });

    it('tracks nested row add/remove at the parent and restores the whole array', () => {
        const original = movementData.Sources[0]!.Effects;
        const next = updateNestedField(baseline(), 'Sources.0.Effects', [
            ...original,
            { Type: 'SprintMultiplier', Values: [1.0625] },
        ]);
        expect(changesFor(next)[0]).toMatchObject({ field: 'Effects' });
        expect(changesFor(updateNestedField(next, 'Sources.0.Effects', original))).toEqual([]);
    });

    it('tracks row order while ignoring top-level collection order', () => {
        const next = baseline();
        const source = next.Sources.find((entry) => entry.Effects.length > 1)!;
        source.Effects.reverse();
        expect(changesFor(next).some((change) => change.field.startsWith('Effects.0.'))).toBe(true);
        source.Effects.reverse();
        next.Sources.reverse();
        expect(changesFor(next)).toEqual([]);
    });
});

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

describe('issueTarget', () => {
    const sources = {
        stats: [
            { Name: 'Health', Fields: {} },
            { Name: 'Melee', Fields: {}, Abilities: [{ Hash: 11, Name: 'A' }, { Hash: 22 }] },
        ],
        movement: { Rules: {}, Sources: [{ Hash: 7 }] },
    };

    it.each([
        ['stats[0].Fields.PVPHealthHP', { stat: 'Health', tab: 'Fields', field: 'PVPHealthHP' }],
        [
            'stats[0].Fields.CooldownScalars.Segments[1].Expression',
            { stat: 'Health', tab: 'Fields', field: 'CooldownScalars.Segments.1.Expression' },
        ],
        [
            'stats[1].Abilities[1].Name',
            { stat: 'Melee', tab: 'Abilities', itemKey: '22', field: 'Name' },
        ],
        ['stats[1].Abilities[9].Name', { stat: 'Melee', tab: 'Abilities', field: '' }],
        ['stats[1].Hash', { stat: 'Melee', tab: 'Fields', field: '' }],
        ['movement.Rules.WalkSpeed', { stat: 'Movement', tab: 'Fields', field: 'Rules.WalkSpeed' }],
        [
            'movement.Sources[0].Effects[0].Type',
            { stat: 'Movement', tab: 'Sources', itemKey: '7', field: 'Effects.0.Type' },
        ],
        [
            'locale.Melee.BaseStatTooltip',
            { stat: 'Melee', tab: 'Text', field: 'Melee.BaseStatTooltip' },
        ],
        ['locale.ChargeBasedScaling', { stat: 'Melee', tab: 'Text', field: 'ChargeBasedScaling' }],
    ])('maps %s to its editor location', (path, target) => {
        expect(issueTarget(path, sources)).toEqual(target);
    });

    it('ignores paths without an editor location', () => {
        expect(issueTarget('$', sources)).toBeUndefined();
        expect(issueTarget('stats[5].Name', sources)).toBeUndefined();
        expect(issueTarget('sources/stats/melee.json:Abilities', sources)).toBeUndefined();
    });
});
