import { describe, it, expect } from 'vitest';
import {
    calculateCooldown,
    calculateActiveRegen,
    effectiveCooldown,
    extractPlaceholders,
    validatePlaceholders,
    renderTooltip,
    resolveLocale,
    FORMATTING_TOKENS,
    type Curve,
    type Override,
} from '../src/core';
import { fixture } from './fixtures';
const curve: Curve = { Values: Array.from({ length: 101 }, (_, x) => 1 - x / 200) };
const ability = { Hash: 1, Name: 'A', BaseCooldown: 100, ChunkEnergyScalar: 0.5 };
describe('context calculations', () => {
    it('clamps above 100 and applies replacement before stacked scalars', () => {
        const overrides: Override[] = [
            { Hash: 2, Name: 'Scale', Requirements: [1], Scalar: [0.5] },
            { Hash: 3, Name: 'Replace', Requirements: [0], CooldownOverride: 80, Scalar: [2] },
            { Hash: 4, Name: 'Other', Requirements: [99], CooldownOverride: 1 },
        ];
        expect(calculateCooldown(ability, overrides, curve, 200)).toEqual({
            cooldown: 40,
            effectiveBase: 80,
            appliedOverrides: [2, 3],
            unresolved: [],
        });
        expect(calculateCooldown(ability, [], curve, 0).cooldown).toBe(100);
    });
    it('uses per-requirement scalar and reports unresolved subclass filters', () => {
        const result = calculateCooldown(
            ability,
            [{ Hash: 4, Name: 'O', Requirements: [99, 1, -123], Scalar: [9, 0.5, 2] }],
            curve,
            0,
        );
        expect(result.cooldown).toBe(50);
        expect(result.unresolved).toEqual([
            { hash: -123, message: 'subclass filter, cannot resolve' },
        ]);
    });
    it('calculates active Super regen and source convenience result', () => {
        expect(
            calculateActiveRegen(
                { Hash: 1, Name: 'S', BaseCooldown: 100, ActiveRegenScalar: 1.5 },
                curve,
                100,
            ),
        ).toBe(0.75);
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        expect(effectiveCooldown(source, source.Abilities![0]!, 0).cooldown).toBe(100);
    });
    it.each([0, 50, 100, 200])(
        'keeps Super cooldown fixed at stat %i, including overrides',
        (statValue) => {
            const source = fixture().stats.find((s) => s.Name === 'Super')!;
            const superAbility = source.SuperAbilities![0]!;
            expect(source.Fields).not.toHaveProperty('CooldownScalars');
            expect(effectiveCooldown(source, superAbility, statValue).cooldown).toBe(200);
            expect(calculateCooldown(superAbility, [], curve, statValue).cooldown).toBe(200);
            expect(
                effectiveCooldown(source, superAbility, statValue, [
                    { Hash: 3, Name: 'Scale', Requirements: [superAbility.Hash], Scalar: [0.5] },
                    {
                        Hash: 4,
                        Name: 'Replace',
                        Requirements: [0],
                        CooldownOverride: 80,
                        Scalar: [2],
                    },
                ]).cooldown,
            ).toBe(80);
        },
    );
    it.each([0, 100, 200])(
        'uses identity scaling without a cooldown curve at stat %i',
        (statValue) => {
            const source = fixture().stats.find((s) => s.Name === 'Melee')!;
            delete source.Fields.CooldownScalars;
            const overrides: Override[] = [
                { Hash: 3, Name: 'Replace', Requirements: [0], CooldownOverride: 80 },
                { Hash: 4, Name: 'Scale', Requirements: [ability.Hash], Scalar: [0.5] },
            ];
            expect(calculateCooldown(ability, [], undefined, statValue).cooldown).toBe(100);
            expect(effectiveCooldown(source, ability, statValue).cooldown).toBe(100);
            expect(effectiveCooldown(source, ability, statValue, overrides).cooldown).toBe(40);
            expect(() => calculateCooldown(ability, [], undefined, NaN)).toThrow('finite');
        },
    );
});
describe('locale helpers', () => {
    it('extracts unique placeholders and recognizes the declarative formatting token list', () => {
        expect(extractPlaceholders('{{HP}} {{ HP }} {{Value}}')).toEqual(['HP', 'Value']);
        expect(FORMATTING_TOKENS.Scalar).toBe('\u00d7');
        expect(
            validatePlaceholders(
                Object.keys(FORMATTING_TOKENS)
                    .map((k) => '{{' + k + '}}')
                    .join(' '),
                [],
            ),
        ).toEqual([]);
        expect(validatePlaceholders('{{Good}} {{Bad}}', ['Good'])).toEqual([
            expect.objectContaining({ message: 'Unknown placeholder {{Bad}}', severity: 'error' }),
        ]);
    });
    it('renders locale IDs and offset-domain curves', () => {
        expect(resolveLocale({ Melee: { Overview: 'Text' } }, 'Melee.Overview')).toBe('Text');
        expect(resolveLocale({}, 'Missing')).toBeUndefined();
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        source.Fields.MeleeDamageIncrease = { Values: Array.from({ length: 100 }, (_, i) => i) };
        const spec = {
            name: 'Melee',
            hash: source.Hash,
            fields: [
                {
                    key: 'MeleeDamageIncrease',
                    kind: 'curve' as const,
                    description: '',
                    domain: [101, 200] as const,
                },
            ],
            collections: {},
        };
        expect(
            renderTooltip(
                '{{MeleeDamageIncrease}}{{Percent}} {{AbilityName}} {{Unknown}}',
                source,
                spec,
                150,
                { AbilityName: 'A' },
            ),
        ).toBe('49% A {{Unknown}}');
        expect(renderTooltip('{{MeleeDamageIncrease}}', source, spec, 201)).toBe('99');
    });
});
