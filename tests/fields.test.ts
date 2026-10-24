import { describe, it, expect } from 'vitest';
import {
    validateField,
    validateNumber,
    validateEntity,
    validateCollection,
    abilitySpec,
    superAbilitySpec,
    overrideSpec,
    movementClassSpec,
    validateSources,
    enumField,
    objectField,
    objectArrayField,
    numberField,
    curve,
    notesField,
    exportEntity,
    fieldSchema,
    type EntitySpec,
} from '../src/core';
import { fixture, fixtureLocale } from './fixtures';
describe('reusable validators', () => {
    it('checks finite numbers, safe integers and inclusive/exclusive ranges', () => {
        expect(validateNumber(NaN)).not.toEqual([]);
        expect(validateNumber(Infinity)).not.toEqual([]);
        expect(validateNumber('1')).not.toEqual([]);
        expect(validateNumber(1.5, {}, true)).not.toEqual([]);
        expect(validateNumber(Number.MAX_SAFE_INTEGER + 1, {}, true)).not.toEqual([]);
        expect(validateNumber(0.1, { exclusiveMin: 0.1, max: 1 })).not.toEqual([]);
        expect(validateNumber(1, { exclusiveMin: 0.1, max: 1 })).toEqual([]);
        expect(validateNumber(2, { exclusiveMax: 2 })).not.toEqual([]);
        expect(validateNumber(-1, { min: 0 })).not.toEqual([]);
    });
    it('checks required, string, hash and array constraints', () => {
        expect(
            validateField({ key: 'x', kind: 'string', required: true, description: '' }, ''),
        ).not.toEqual([]);
        expect(
            validateField({ key: 'x', kind: 'number', required: true, description: '' }, undefined),
        ).not.toEqual([]);
        expect(validateField({ key: 'x', kind: 'hash', description: '' }, -1)).not.toEqual([]);
        expect(validateField({ key: 'x', kind: 'hash', description: '' }, 4294967296)).not.toEqual(
            [],
        );
        expect(validateField({ key: 'x', kind: 'hash', description: '' }, 0)).toEqual([]);
        expect(
            validateField({ key: 'x', kind: 'intArray', description: '', minItems: 2 }, [1.5]),
        ).toHaveLength(2);
        expect(
            validateField({ key: 'x', kind: 'numberArray', description: '', maxItems: 1 }, [1, 2]),
        ).not.toEqual([]);
    });
});
describe('entity validation', () => {
    const ability = { Hash: 1, Name: 'A', BaseCooldown: 12, ChunkEnergyScalar: 0.5 };
    it('validates ability fields, charge scaling, and editor-only notes', () => {
        expect(validateEntity(abilitySpec, ability)).toEqual([]);
        for (const patch of [
            { Hash: -1 },
            { Name: '' },
            { BaseCooldown: 0 },
            { ChunkEnergyScalar: -0.1 },
            { ChargeBasedScaling: [] },
            { ChargeBasedScaling: [1, 0] },
        ]) {
            expect(validateEntity(abilitySpec, { ...ability, ...patch }).length).toBeGreaterThan(0);
        }
        expect(
            validateEntity(abilitySpec, { ...ability, ChargeBasedScaling: [1, 2], Notes: 'why' }),
        ).toEqual([]);
        expect(validateEntity(abilitySpec, { ...ability, Notes: '' })).toEqual([]);
        for (const ChunkEnergyScalar of [0, 0.1, 1.1, 10])
            expect(
                validateEntity(abilitySpec, {
                    ...ability,
                    ChunkEnergyScalar,
                    ChargeBasedScaling: [1],
                }),
            ).toEqual([]);
        expect(validateEntity(abilitySpec, { ...ability, Unknown: 1 })).not.toEqual([]);
    });
    it('allows nonnegative Super regen without an arbitrary upper bound, rejects retired tier', () => {
        const superAbility = { Hash: 1, Name: 'S', BaseCooldown: 100, ActiveRegenScalar: 1 };
        expect(validateEntity(superAbilitySpec, superAbility)).toEqual([]);
        for (const ActiveRegenScalar of [0, 2, 10]) {
            expect(
                validateEntity(superAbilitySpec, { ...superAbility, ActiveRegenScalar }),
            ).toEqual([]);
        }
        expect(
            validateEntity(superAbilitySpec, { ...superAbility, ActiveRegenScalar: -1 }),
        ).not.toEqual([]);
        expect(validateEntity(superAbilitySpec, { ...superAbility, SuperTier: 1 })).not.toEqual([]);
    });
    it('enforces lengthOf and anyOf', () => {
        const override = { Hash: 2, Name: 'O', Requirements: [0, -123, 1] };
        expect(validateEntity(overrideSpec, override)[0]?.message).toContain('at least one');
        expect(
            validateEntity(overrideSpec, { ...override, Scalar: [1] }).some((e) =>
                e.message.includes('length'),
            ),
        ).toBe(true);
        expect(validateEntity(overrideSpec, { ...override, Scalar: [1, 2, 3] })).toEqual([]);
        expect(
            validateEntity(overrideSpec, { ...override, ChunkEnergyOverride: [0.5, 1, 0.5] }),
        ).toEqual([]);
        expect(
            validateEntity(overrideSpec, { ...override, Requirements: [], CooldownOverride: 10 }),
        ).not.toEqual([]);
        expect(
            validateEntity(overrideSpec, { ...override, ChunkEnergyOverride: [-0.1, 1, 0.5] }),
        ).not.toEqual([]);
        expect(
            validateEntity(overrideSpec, { ...override, ChunkEnergyOverride: [0, 0.1, 10] }),
        ).toEqual([]);
    });
    it('enforces uniqueness within each collection, including movement class hashes', () => {
        expect(
            validateCollection(abilitySpec, [ability, ability]).some((e) =>
                e.message.includes('Duplicate Hash'),
            ),
        ).toBe(true);
        const c = fixture().movement.Classes[0]!;
        expect(
            validateCollection(movementClassSpec, [c, c]).some((e) =>
                e.message.includes('Duplicate ClassHash'),
            ),
        ).toBe(true);
        expect(validateCollection(abilitySpec, null)).not.toEqual([]);
    });
    it('validates full source sets and warns on unknown positive requirement hashes', () => {
        const data = fixture();
        expect(validateSources(data, fixtureLocale())).toEqual([]);
        data.stats.find((s) => s.Name === 'Melee')!.Overrides = [
            { Hash: 3, Name: 'O', Requirements: [999], Scalar: [1] },
        ];
        expect(validateSources(data)).toEqual([
            expect.objectContaining({
                severity: 'warning',
                message: expect.stringContaining('999'),
            }),
        ]);
        data.stats[0]!.Hash = 0;
        expect(validateSources(data).some((e) => e.severity === 'error')).toBe(true);
        expect(validateSources(null)).not.toEqual([]);
        expect(
            validateSources({ stats: [null, { Name: 'Nope' }], movement: null }).length,
        ).toBeGreaterThan(0);
    });
});

describe('generic nested fields and unpublished data', () => {
    const entry: EntitySpec = {
        name: 'Entry',
        uniqueKey: 'Kind',
        fields: [
            enumField(
                'Kind',
                [
                    { value: 'A', description: 'First kind.' },
                    { value: 'B', description: 'Second kind.' },
                ],
                { description: 'Choice.' },
            ),
            numberField('Number', { min: 0, round: 1, description: 'Nested number.' }),
            curve('Hidden', { domain: [0, 1], published: false, description: 'Measured later.' }),
            curve('Curve', { domain: [0, 1], description: 'Published curve.' }),
            notesField(),
        ],
    };
    const value = {
        Kind: 'A',
        Number: 1.234,
        Hidden: { Values: [0, 0] },
        Curve: { Values: [1, 2] },
        Notes: 'Keep in source',
    };
    const object = objectField('Settings', entry, { description: 'One nested entity.' });
    const array = objectArrayField('Entries', entry, {
        minItems: 1,
        maxItems: 2,
        description: 'Nested entities.',
    });
    it('validates nested objects, enums, lengths, duplicate keys and precise paths', () => {
        expect(validateField(object, value)).toEqual([]);
        expect(validateField(array, [value])).toEqual([]);
        expect(validateField(array, [])).toContainEqual(
            expect.objectContaining({ message: 'Must contain at least 1 items' }),
        );
        expect(
            validateField(array, [value, { ...value, Kind: 'B' }, { ...value, Kind: 'C' }]).some(
                (issue) => issue.message.includes('at most'),
            ),
        ).toBe(true);
        expect(validateField(array, [value, value])).toContainEqual(
            expect.objectContaining({ path: 'Entries[1].Kind', message: 'Duplicate Kind: A' }),
        );
        expect(
            validateField(array, [{ ...value, Kind: 'C', Number: -1, Extra: true }]).map(
                (issue) => issue.path,
            ),
        ).toEqual(['Entries[0].Kind', 'Entries[0].Number', 'Entries[0].Extra']);
        expect(validateField(object, null)[0]?.path).toBe('Settings');
        expect(validateField(array, [null])[0]?.path).toBe('Entries[0]');
        expect(validateField(array, 'bad')).not.toEqual([]);
    });
    it('recursively exports values, rounds and expands curves, and keeps unpublished input untouched', () => {
        const input = { Settings: value, Entries: [value] };
        const before = JSON.stringify(input);
        const result = exportEntity({ name: 'Container', fields: [object, array] }, input);
        const expected = { Kind: 'A', Number: 1.2, Curve: [1, 2] };
        expect(result).toEqual({ Settings: expected, Entries: [expected] });
        expect(JSON.stringify(input)).toBe(before);
        const schema = fieldSchema(array);
        expect(schema).toMatchObject({
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: {
                properties: {
                    Kind: {
                        type: 'string',
                        enum: ['A', 'B'],
                        oneOf: [
                            { const: 'A', description: 'First kind.' },
                            { const: 'B', description: 'Second kind.' },
                        ],
                    },
                },
            },
        });
        expect(JSON.stringify(schema)).not.toContain('Hidden');
        expect(
            JSON.stringify(fieldSchema({ ...object, entity: { ...entry, anyOf: [['Hidden']] } })),
        ).not.toContain('Hidden');
        expect(JSON.stringify(schema)).not.toContain('Notes');
        const published = {
            ...object,
            entity: {
                ...entry,
                fields: entry.fields.map((field) =>
                    field.key === 'Hidden' ? { ...field, published: true } : field,
                ),
            },
        };
        expect(
            exportEntity({ name: 'Container', fields: [published] }, input).Settings,
        ).toHaveProperty('Hidden', [0, 0]);
        expect(JSON.stringify(fieldSchema(published))).toContain('Hidden');
    });
    it('validates unpublished placeholders rather than allowing invalid author data', () => {
        expect(validateField(object, { ...value, Hidden: { Values: [0] } })).not.toEqual([]);
    });
});
