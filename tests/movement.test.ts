import { describe, expect, it } from 'vitest';
import movementData from '../sources/movement.json';
import english from '../locale/en.json';
import {
    movementSpeed,
    validateSources,
    type MovementSource,
    type MovementSpeedInput,
} from '../src/core';
import { fixture } from './fixtures';

const titan = 3655393761,
    hunter = 671679327,
    warlock = 2271682572;
const data = () => structuredClone(movementData) as unknown as MovementSource;
const input = (changes: Partial<MovementSpeedInput> = {}): MovementSpeedInput => ({
    classHash: titan,
    activity: 'PVE',
    sources: [],
    direction: 'Forward',
    posture: 'Standing',
    ...changes,
});

describe('movement calculator', () => {
    it('activates every verified Lightweight and MIDA alias with the same effects', () => {
        for (const hash of [1458010786, 2213377102, 2470575005]) {
            const entry = data().Sources.find((source) => source.Hash === hash)!;
            expect(entry.AlsoMatches?.length).toBeGreaterThan(0);
            const expected = movementSpeed(input({ sources: [{ hash }] }));
            for (const alias of entry.AlsoMatches!)
                expect(movementSpeed(input({ sources: [{ hash: alias }] }))).toEqual(expected);
        }
        const lightweight = data().Sources.find((source) => source.Hash === 1458010786)!;
        expect(lightweight.AlsoMatches).toHaveLength(28);
        expect(lightweight.AlsoMatches).toContain(3758615625);
        expect(lightweight.AlsoMatches).not.toContain(2928496916);
    });
    it('keeps Macro-Tool conditional forward movement separate from Lightweight bonuses', () => {
        const source = data();
        expect(source.Sources.find((entry) => entry.Hash === 1888623310)).toMatchObject({
            Activation: 'Conditional',
            Effects: [{ Type: 'ForwardMultiplier', Values: [1.1] }],
        });
        const sources = [{ hash: 1888623310 }];
        expect(movementSpeed(input({ sources }))).toEqual({ tier: 3, speed: 5.6 * 1.1 });
        expect(movementSpeed(input({ sources, sprint: true }))).toEqual({ tier: 3, speed: 8 });
        expect(movementSpeed(input({ sources, direction: 'Strafe' })).speed).toBeCloseTo(
            5.6 * 0.85,
            12,
        );
        expect(movementSpeed(input({ sources, posture: 'Crouched' })).speed).toBeCloseTo(
            5.6 * 1.1 * 0.55,
            12,
        );
    });
    it('rejects duplicate aliases of the same source and supports alias ADS selection', () => {
        expect(() =>
            movementSpeed(
                input({
                    sources: [{ hash: 1458010786 }, { hash: 3758615625 }],
                }),
            ),
        ).toThrow('Duplicate active movement source');
        const source = data();
        source.Sources.find((entry) => entry.Hash === 14)!.AlsoMatches = [123];
        expect(
            movementSpeed(
                input({
                    ads: true,
                    sources: [{ hash: 123 }],
                    heldWeaponSources: [123],
                }),
                source,
            ).speed,
        ).toBeCloseTo(5.6 * 0.85, 12);
    });
    it('uses current source data by default and class-specific PvE/PvP tiers', () => {
        expect(movementSpeed(input())).toEqual({ tier: 3, speed: 5.6 });
        expect(movementSpeed(input({ classHash: warlock }))).toEqual({ tier: 3, speed: 5.6 });
        expect(movementSpeed(input({ classHash: hunter }))).toEqual({ tier: 10, speed: 7 });
        expect(movementSpeed(input({ classHash: hunter, activity: 'PVP' }))).toEqual({
            tier: 7,
            speed: 6.4,
        });
        expect(movementSpeed(input({ activity: 'PVP' }))).toEqual({ tier: 3, speed: 5.6 });
    });
    it('reproduces the Compendium tier-5 ADS strafe example without rounding', () => {
        const source = data();
        source.Classes[0]!.BaseMobilityTier = 5;
        expect(movementSpeed(input({ direction: 'Strafe', ads: true }), source).speed).toBeCloseTo(
            3.825,
            12,
        );
    });
    it('reproduces tier-10 sidearm ADS plus Lightweight: 7 * 0.85 * 1.075 = 6.39625', () => {
        const source = data();
        source.Classes[0]!.BaseMobilityTier = 8;
        const options = input({
            ads: true,
            sources: [{ hash: 1458010786 }, { hash: 14 }],
            heldWeaponSources: [14],
        });
        expect(movementSpeed(options, source)).toMatchObject({ tier: 10 });
        expect(movementSpeed(options, source).speed).toBeCloseTo(6.39625, 12);
        expect(movementSpeed({ ...options, adsMultiplierOverride: 0.5 }, source).speed).toBeCloseTo(
            7 * 1.075 * 0.5,
            12,
        );
    });
    it.each([
        [1, 6],
        [2, 8],
        [3, 9],
        [9, 9],
    ])('selects cumulative Athletics values at %i stacks', (stacks, tier) => {
        expect(movementSpeed(input({ sources: [{ hash: 1133590731, stacks }] })).tier).toBe(tier);
    });
    it('clamps tiers to both ends and uses the cap tier for walking', () => {
        const source = data();
        expect(
            movementSpeed(
                input({ classHash: hunter, sources: [{ hash: 1133590731, stacks: 3 }] }),
                source,
            ),
        ).toEqual({ tier: 13, speed: 7.6 });
        source.Classes[0]!.BaseMobilityTier = -5;
        expect(movementSpeed(input(), source)).toEqual({ tier: 0, speed: 5 });
    });
    it('keeps sprint independent of Mobility and applies multiplicative sprint bonuses', () => {
        expect(movementSpeed(input({ sprint: true })).speed).toBe(8);
        expect(
            movementSpeed(input({ sprint: true, sources: [{ hash: 1133590731, stacks: 3 }] }))
                .speed,
        ).toBe(8);
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 1458010786 }] })).speed).toBe(
            8.5,
        );
        const source = data();
        source.Sources.push({
            Hash: 123,
            Name: 'Sprint bonus',
            RefType: 'item',
            Activation: 'Always',
            Effects: [{ Type: 'SprintMultiplier', Values: [1.0625] }],
        });
        expect(
            movementSpeed(
                input({ sprint: true, sources: [{ hash: 1458010786 }, { hash: 123 }] }),
                source,
            ),
        ).toEqual({ tier: 5, speed: 9, cappedBy: 'ForwardSpeedCap' });
        expect(
            movementSpeed(
                input({ classHash: hunter, sprint: true, sources: [{ hash: 1458010786 }] }),
            ),
        ).toEqual({ tier: 12, speed: 9, cappedBy: 'ForwardSpeedCap' });
    });
    it.each([12, 13, 54])(
        'applies grounded penalty %i to walking, ADS/crouch, and sprint',
        (hash) => {
            expect(movementSpeed(input({ sources: [{ hash }] })).speed).toBeCloseTo(5.6 * 0.85, 12);
            expect(
                movementSpeed(input({ posture: 'Crouched', ads: true, sources: [{ hash }] })).speed,
            ).toBeCloseTo(5.6 * 0.55 * 0.75 * 0.85, 12);
            expect(movementSpeed(input({ sprint: true, sources: [{ hash }] })).speed).toBeCloseTo(
                8 * 0.85,
                12,
            );
        },
    );
    it.each([
        ['Forward', 'Standing', 9, 'ForwardSpeedCap'],
        ['Strafe', 'Standing', 6, 'StrafeSpeedCap'],
        ['Forward', 'Crouched', 4, 'CrouchSpeedCap'],
        ['Strafe', 'Crouched', 4, 'CrouchSpeedCap'],
    ] as const)('caps %s / %s after all multipliers', (direction, posture, speed, cappedBy) => {
        const source = data();
        source.Sources.push({
            Hash: 123,
            Name: 'Fast',
            RefType: 'item',
            Activation: 'Always',
            Effects: [{ Type: 'GroundedMultiplier', Values: [100] }],
        });
        expect(
            movementSpeed(
                input({ direction, posture, ads: true, sources: [{ hash: 123 }] }),
                source,
            ),
        ).toEqual({ tier: 3, speed, cappedBy });
    });
    it.each([
        ['Forward', 'Standing', 6 * 1.075],
        ['Forward', 'Crouched', 6 * 1.075 * 0.55],
        ['Strafe', 'Standing', 6 * 0.85],
        ['Strafe', 'Crouched', 6 * 0.85 * 0.55],
    ] as const)(
        'applies Lightweight forward bonus only to %s / %s as appropriate',
        (direction, posture, speed) => {
            expect(
                movementSpeed(input({ direction, posture, sources: [{ hash: 1458010786 }] })).speed,
            ).toBeCloseTo(speed, 12);
        },
    );
    it('uses the lowest of forward, strafe, and crouch caps when both direction and posture apply', () => {
        const source = data();
        source.Rules.StrafeSpeedCap = 2;
        expect(movementSpeed(input({ direction: 'Strafe', posture: 'Crouched' }), source)).toEqual({
            tier: 3,
            speed: 2,
            cappedBy: 'StrafeSpeedCap',
        });
        source.Rules.ForwardSpeedCap = 1;
        expect(movementSpeed(input({ direction: 'Strafe', posture: 'Crouched' }), source)).toEqual({
            tier: 3,
            speed: 1,
            cappedBy: 'ForwardSpeedCap',
        });
    });
    it('evaluates ADS separately for each held weapon in a three-weapon loadout, independent of source order', () => {
        const source = data();
        for (const [Hash, value] of [
            [123, 0.6],
            [456, 0.9],
        ] as const)
            source.Sources.push({
                Hash,
                Name: 'Weapon ADS',
                RefType: 'item',
                Activation: 'WhileHeld',
                Effects: [{ Type: 'ADSMultiplier', Values: [value] }],
            });
        const sources = [{ hash: 14 }, { hash: 123 }, { hash: 456 }];
        for (const order of [sources, [...sources].reverse()]) {
            expect(movementSpeed(input({ ads: true, sources: order }), source).speed).toBeCloseTo(
                5.6 * 0.75,
                12,
            );
            for (const [hash, value] of [
                [14, 0.85],
                [123, 0.6],
                [456, 0.9],
            ] as const) {
                expect(
                    movementSpeed(
                        input({ ads: true, sources: order, heldWeaponSources: [hash] }),
                        source,
                    ).speed,
                ).toBeCloseTo(5.6 * value, 12);
            }
            expect(() =>
                movementSpeed(
                    input({ ads: true, sources: order, heldWeaponSources: [14, 123] }),
                    source,
                ),
            ).toThrow('Conflicting ADS');
            expect(
                movementSpeed(
                    input({
                        ads: true,
                        sources: order,
                        heldWeaponSources: [14, 123],
                        adsMultiplierOverride: 0.8,
                    }),
                    source,
                ).speed,
            ).toBeCloseTo(5.6 * 0.8, 12);
        }
        expect(() =>
            movementSpeed(input({ ads: true, sources, heldWeaponSources: [999] }), source),
        ).toThrow('must be present');
    });
    it('replaces boosted values only when the caller asserts all required equipment is present', () => {
        const source = data();
        source.Sources[0]!.BoostRequiresAll = [1331482397];
        source.Sources[0]!.Effects[0]!.BoostedValues = [4, 6, 7];
        expect(
            movementSpeed(
                input({ sources: [{ hash: 1133590731, stacks: 2, boosted: true }] }),
                source,
            ).tier,
        ).toBe(9);
        expect(
            movementSpeed(input({ sources: [{ hash: 1133590731, stacks: 2 }] }), source).tier,
        ).toBe(8);
    });
    it('rejects unknown classes/sources, duplicate sources, invalid stacks and ADS during sprint', () => {
        for (const options of [
            input({ classHash: 0 }),
            input({ sources: [{ hash: 0 }] }),
            input({ sources: [{ hash: 1133590731 }, { hash: 1133590731 }] }),
            ...[0, -1, 1.5, NaN, Infinity].map((stacks) =>
                input({ sources: [{ hash: 1133590731, stacks }] }),
            ),
            input({ sprint: true, ads: true }),
            input({ sprint: true, direction: 'Strafe' }),
            input({ sprint: true, posture: 'Crouched' }),
            input({ adsMultiplierOverride: NaN }),
        ])
            expect(() => movementSpeed(options)).toThrow();
    });
});

describe('movement source validation', () => {
    it('rejects ambiguous, repeated, invalid and empty aliases', () => {
        for (const aliases of [[12], [123, 123], [0], [-1], [4294967296], [1.5], []]) {
            const source = fixture();
            source.movement = data();
            source.movement.Sources[0]!.AlsoMatches = aliases;
            expect(validateSources(source).some((issue) => issue.severity === 'error')).toBe(true);
        }
    });
    it('allows tiers above the cap, negative tier effects and unbounded positive multipliers', () => {
        const source = fixture();
        source.movement.Classes[0]!.BaseMobilityTier = 20;
        source.movement.Sources = [
            {
                Hash: 123,
                Name: 'Penalty',
                RefType: 'item',
                Activation: 'Always',
                Effects: [
                    { Type: 'MobilityTiers', Values: [-2] },
                    { Type: 'ForwardMultiplier', Values: [10] },
                ],
            },
        ];
        expect(validateSources(source)).toEqual([]);
        source.movement.Sources[0]!.Effects[1]!.Values = [0];
        expect(validateSources(source).some((issue) => issue.message.includes('positive'))).toBe(
            true,
        );
    });
    it('keeps Wraithwalk on the verified inventory catalyst rather than a perk RefType', () => {
        expect(data().Sources.find((entry) => entry.Hash === 3072857252)).toMatchObject({
            RefType: 'item',
            Name: 'Wraithwalk (Heartshadow Catalyst)',
        });
        expect(data().Sources.some((entry) => entry.Hash === 3936394000)).toBe(false);
    });
    it('accepts repository sources and locale without issues', () => {
        const source = fixture();
        source.movement = data();
        expect(
            validateSources(source, english).filter(
                (issue) =>
                    issue.path.startsWith('movement') || issue.path.startsWith('locale.Movement'),
            ),
        ).toEqual([]);
    });
    it('warns for a 0 reference and a missing conditional locale string without blocking export', () => {
        const source = fixture();
        source.movement.Sources = [
            {
                Hash: 0,
                Name: 'Unverified',
                RefType: 'item',
                Activation: 'Conditional',
                Effects: [{ Type: 'MobilityTiers', Values: [0] }],
            },
        ];
        const warnings = validateSources(source, english);
        expect(warnings).toHaveLength(2);
        expect(warnings.every((issue) => issue.severity === 'warning')).toBe(true);
        expect(warnings.map((issue) => issue.path)).toEqual([
            'movement.Sources[0].Hash',
            'locale.Movement.Sources.0.Condition',
        ]);
    });
    it('rejects nested invalid effect types, stack lengths, duplicate types, and unknown keys', () => {
        const source = fixture();
        source.movement = data();
        const effect = source.movement.Sources[0]!.Effects[0]!;
        effect.BoostedValues = [1];
        source.movement.Sources[0]!.Effects.push({ ...effect });
        const errors = validateSources(source).filter((issue) => issue.severity === 'error');
        expect(
            errors.some(
                (issue) => issue.path.includes('BoostedValues') && issue.message.includes('length'),
            ),
        ).toBe(true);
        expect(errors.some((issue) => issue.message.includes('Duplicate Type'))).toBe(true);
        expect(errors.some((issue) => issue.path.endsWith('BoostRequiresAll'))).toBe(true);
    });
    it('requires integer tiers and positive multipliers', () => {
        const source = fixture();
        source.movement = data();
        source.movement.Sources[0]!.Effects[0]!.Values = [0.5];
        source.movement.Sources[1]!.Effects[1]!.Values = [0];
        expect(validateSources(source).filter((issue) => issue.severity === 'error')).toHaveLength(
            2,
        );
    });
});
