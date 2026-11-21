import { describe, it, expect } from 'vitest';
import {
    calculateCooldown,
    calculateActiveRegen,
    effectiveActiveRegen,
    effectiveCooldown,
    extractPlaceholders,
    formatChargeList,
    validatePlaceholders,
    renderTooltip,
    resolveLocale,
    statRegistry,
    FORMATTING_TOKENS,
    type Curve,
    type Override,
    type SuperAbility,
    type SuperOverride,
} from '../src/core';
import { fixture } from './fixtures';
import superData from '../sources/stats/super.json';
import classData from '../sources/stats/class.json';
import type { StatSource } from '../src/core';
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
    it('calculates active Super regen with activity mode and Super overrides', () => {
        const superAbility: SuperAbility = {
            Hash: 1,
            Name: 'S',
            BaseCooldown: 556,
            ActiveRegenScalar: 2.7,
            PVPActiveRegenScalar: 0.9,
        };
        const nighthawk: SuperOverride = {
            Hash: 3960926756,
            Name: 'Celestial Nighthawk',
            Requirements: [1],
            ActiveRegenOverride: [0.9],
        };
        expect(calculateActiveRegen(superAbility, curve, 100)).toBeCloseTo(1.35, 12);
        expect(calculateActiveRegen(superAbility, curve, 100, [nighthawk], 'PVE')).toBeCloseTo(
            0.45,
            12,
        );
        expect(calculateActiveRegen(superAbility, curve, 100, [], 'PVP')).toBeCloseTo(0.45, 12);
        const superSource = fixture().stats.find((s) => s.Name === 'Super')!;
        expect(effectiveActiveRegen(superSource, superAbility, 100, [nighthawk], 'PVE')).toBe(0.9);
        expect(effectiveActiveRegen(superSource, superAbility, 100, [], 'PVP')).toBe(0.9);
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        expect(effectiveCooldown(source, source.Abilities![0]!, 0).cooldown).toBe(100);
    });
    it('applies the 0.9x PvP active regen penalty to Prismatic Supers and preserves it under Celestial Nighthawk', () => {
        const superSource = superData as unknown as StatSource;
        const solarMarksman = superSource.SuperAbilities!.find((a) => a.Hash === 375052468)!;
        const prismMarksman = superSource.SuperAbilities!.find((a) => a.Hash === 2370269390)!;
        const prismDeadfall = superSource.SuperAbilities!.find((a) => a.Hash === 2370269389)!;
        const nighthawk = (superSource.Overrides as SuperOverride[]).find(
            (o) => o.Hash === 3960926756,
        )!;
        expect(effectiveActiveRegen(superSource, solarMarksman, 100, [], 'PVP')).toBeCloseTo(
            0.9 * 1.15,
            12,
        );
        expect(effectiveActiveRegen(superSource, prismMarksman, 100, [], 'PVP')).toBeCloseTo(
            0.81 * 1.15,
            12,
        );
        expect(
            effectiveActiveRegen(superSource, solarMarksman, 100, [nighthawk], 'PVP'),
        ).toBeCloseTo(0.9 * 1.15, 12);
        expect(
            effectiveActiveRegen(superSource, prismMarksman, 100, [nighthawk], 'PVP'),
        ).toBeCloseTo(0.81 * 1.15, 12);
        expect(effectiveActiveRegen(superSource, prismDeadfall, 100, [], 'PVP')).toBeCloseTo(
            0.99 * 1.15,
            12,
        );
    });
    it('applies Threaded Specter - Prismatic cooldown scalar to Acrobat’s Dodge - Prismatic', () => {
        const classSource = classData as unknown as StatSource;
        const prismAcrobat = classSource.Abilities!.find((a) => a.Hash === 2711519343)!;
        const threadedSpecter = (classSource.Overrides as Override[]).find(
            (o) => o.Hash === 2835214897,
        )!;
        expect(
            effectiveCooldown(classSource, prismAcrobat, 0, [threadedSpecter], 'PVE').cooldown,
        ).toBeCloseTo(56 * 1.6666666667, 2);
    });
    it('supports PvP base cooldowns, cooldown overrides, and scalars when activity is PVP', () => {
        const pvpAbility = {
            Hash: 10,
            Name: "Acrobat's Dodge",
            BaseCooldown: 73,
            PVPBaseCooldown: 148.5,
            ChunkEnergyScalar: 0.7,
        };
        const pvpOverride: Override = {
            Hash: 20,
            Name: 'Bastion',
            Requirements: [10],
            CooldownOverride: 108,
            PVPCooldownOverride: 135,
            Scalar: [1],
            PVPScalar: [1.1],
        };
        expect(calculateCooldown(pvpAbility, [], curve, 0, 'PVE').cooldown).toBe(73);
        expect(calculateCooldown(pvpAbility, [], curve, 0, 'PVP').cooldown).toBe(148.5);
        expect(calculateCooldown(pvpAbility, [pvpOverride], curve, 0, 'PVE').cooldown).toBe(108);
        expect(calculateCooldown(pvpAbility, [pvpOverride], curve, 0, 'PVP').cooldown).toBeCloseTo(
            135 * 1.1,
            12,
        );
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
        expect(extractPlaceholders('{{HP}} {{ HP }} {{Value}} {{Value|ScalarPercent}}')).toEqual([
            'HP',
            'Value',
            'Value|ScalarPercent',
        ]);
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
        expect(validatePlaceholders('{{Value|ScalarPercent}}', ['Value'])).toEqual([]);
        expect(
            validatePlaceholders('{{Value|Percent}} {{Missing|ScalarPercent}}', ['Value']),
        ).toEqual([
            expect.objectContaining({
                message: 'Unknown placeholder formatter in {{Value|Percent}}',
                severity: 'error',
            }),
            expect.objectContaining({
                message: 'Unknown placeholder {{Missing}}',
                severity: 'error',
            }),
        ]);
    });
    it('renders locale IDs and offset-domain curves', () => {
        expect(resolveLocale({ Melee: { Overview: 'Text' } }, 'Melee.Overview')).toBe('Text');
        expect(resolveLocale({}, 'Missing')).toBeUndefined();
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        source.Fields.PVEMeleeDamageIncrease = {
            Values: Array.from({ length: 100 }, (_, i) => i),
        };
        const spec = {
            name: 'Melee',
            hash: source.Hash,
            fields: [
                {
                    key: 'PVEMeleeDamageIncrease',
                    kind: 'curve' as const,
                    description: '',
                    domain: [101, 200] as const,
                },
            ],
            collections: {},
        };
        expect(
            renderTooltip(
                '{{PVEMeleeDamageIncrease}}{{Percent}} {{AbilityName}} {{AbilityName}} {{Unknown}}',
                source,
                spec,
                150,
                { AbilityName: 'Manifest ability', ChargeCount: 2 },
            ),
        ).toBe('49% Manifest ability Manifest ability {{Unknown}}');
        expect(
            renderTooltip('{{AbilityName}} {{ChargeCount}} {{Unknown}}', source, spec, 150, {
                ChargeCount: 2,
            }),
        ).toBe('{{AbilityName}} 2 {{Unknown}}');
        expect(renderTooltip('{{PVEMeleeDamageIncrease}}', source, spec, 201)).toBe('99');
    });
    it.each([
        [1, '100%'],
        [0.01, '1%'],
        [0.856, '85.6%'],
        [0.29, '29%'],
    ])('formats explicit scalar percentages: %s -> %s', (scalar, expected) => {
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        source.Fields.EnergyGainScalar = { Values: Array(101).fill(scalar) };
        const spec = {
            name: 'Melee',
            hash: source.Hash,
            fields: [
                {
                    key: 'EnergyGainScalar',
                    kind: 'curve' as const,
                    description: '',
                    domain: [0, 100] as const,
                },
            ],
            collections: {},
        };
        expect(renderTooltip('{{EnergyGainScalar|ScalarPercent}}', source, spec, 0)).toBe(expected);
        expect(renderTooltip('{{EnergyGainScalar}}', source, spec, 0)).toBe(String(scalar));
        expect(renderTooltip('{{EnergyGainScalar}}{{Percent}}', source, spec, 0)).toBe(
            String(scalar) + '%',
        );
    });
});

describe('ChargeList formatter', () => {
    it('lists the increase per stored charge and the matching charge counts', () => {
        expect(formatChargeList([1, 1.415, 2.25])).toEqual({
            ChargeBasedScaling: '0%|41.5%|125%',
            ChargeCount: '0|1|2',
        });
    });

    it('is valid only on the charge tokens', () => {
        expect(
            validatePlaceholders(
                '{{ChargeBasedScaling|ChargeList}} {{ChargeCount|ChargeList}}',
                [],
            ),
        ).toEqual([]);
        expect(validatePlaceholders('{{Value|ChargeList}}', ['Value'])).toEqual([
            expect.objectContaining({
                message: 'Unknown placeholder formatter in {{Value|ChargeList}}',
            }),
        ]);
    });

    it('renders from the supplied context and leaves the token without one', () => {
        const source = fixture().stats.find((s) => s.Name === 'Melee')!;
        const spec = statRegistry.find((s) => s.name === 'Melee')!;
        const text = 'by {{ChargeBasedScaling|ChargeList}} with {{ChargeCount|ChargeList}}';
        expect(renderTooltip(text, source, spec, 0, formatChargeList([1, 1.35, 1.7]))).toBe(
            'by 0%|35%|70% with 0|1|2',
        );
        expect(renderTooltip(text, source, spec, 0)).toBe(text);
    });
});
