import { describe, expect, it } from 'vitest';
import movementData from '../sources/movement.json';
import english from '../locale/en.json';
import {
    movementSpeed as calculateMovementSpeed,
    validateSources,
    type MovementSource,
    type MovementSpeedInput,
} from '../src/core';
import { fixture } from './fixtures';

// Most cases use the repository's movement rules.
const movementSpeed = (
    input: MovementSpeedInput,
    source = movementData as unknown as MovementSource,
) => calculateMovementSpeed(input, source);

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
        for (const hash of [1458010786, 2213377102]) {
            const entry = data().Sources.find((source) => source.Hash === hash)!;
            expect(entry.AlsoMatches?.length).toBeGreaterThan(0);
            const expected = movementSpeed(input({ sources: [{ hash }] }));
            for (const alias of entry.AlsoMatches!)
                expect(movementSpeed(input({ sources: [{ hash: alias }] }))).toEqual(expected);
        }
        const lightweight = data().Sources.find((source) => source.Hash === 1458010786)!;
        expect(lightweight.AlsoMatches).toHaveLength(35);
        expect(lightweight.AlsoMatches).toContain(3758615625);
        expect(lightweight.AlsoMatches).toContain(540070330);
        expect(lightweight.AlsoMatches).toContain(745725302);
        expect(lightweight.AlsoMatches).toContain(1278053348);
        expect(lightweight.AlsoMatches).toContain(4024789138);
        expect(lightweight.AlsoMatches).toContain(2167115920);
        expect(lightweight.AlsoMatches).toContain(4108848057);
        expect(lightweight.AlsoMatches).toContain(425960662);
        expect(lightweight.AlsoMatches).not.toContain(2753228730);
        expect(lightweight.AlsoMatches).not.toContain(3377988521);
        expect(lightweight.AlsoMatches).not.toContain(2928496916);
        const midaSynergy = data().Sources.find((source) => source.Hash === 2213377102)!;
        expect(midaSynergy.AlsoMatches).toContain(2470575005);
    });
    it('applies MIDA Multi-Tool, boosted MIDA Synergy, Wraithwalk, and The Scientific Method', () => {
        const multiTool = movementSpeed(input({ sources: [{ hash: 377257911 }] }));
        expect(multiTool.mobility).toBe(50);
        expect(multiTool.speed).toBeCloseTo(6 * 1.1102, 12);

        const boostedSmg = movementSpeed(input({ sources: [{ hash: 2213377102, boosted: true }] }));
        expect(boostedSmg.mobility).toBe(50);
        expect(boostedSmg.speed).toBeCloseTo(6 * 1.1102, 12);

        for (const hash of [25692695, 3072857252]) {
            expect(movementSpeed(input({ sources: [{ hash }] })).speed).toBeCloseTo(5.6 * 1.5, 12);
            expect(movementSpeed(input({ sources: [{ hash }], sprint: true }))).toEqual({
                mobility: 30,
                speed: 9,
                cappedBy: 'ForwardSpeedCap',
            });
            expect(
                movementSpeed(input({ sources: [{ hash }], direction: 'Strafe' })).speed,
            ).toBeCloseTo(5.6 * 0.85, 12);
        }
    });
    it('applies the boosted Macro-Tool mobility and forward bonus only when MIDA Multi-Tool is equipped', () => {
        const source = data();
        expect(source.Sources.find((entry) => entry.Hash === 1888623310)).toMatchObject({
            Activation: 'WhileHeld',
            Effects: [
                { Type: 'Mobility', Values: [0], BoostedValues: [20] },
                { Type: 'ForwardMultiplier', Values: [1], BoostedValues: [1.1102] },
            ],
            BoostRequiresAll: [1331482397],
        });
        const sources = [{ hash: 1888623310 }];
        expect(movementSpeed(input({ sources })).speed).toBe(5.6);
        expect(movementSpeed(input({ sources, sprint: true })).speed).toBe(8);
        const boostedWalk = movementSpeed(
            input({ sources: [{ hash: 1888623310, boosted: true }] }),
        );
        expect(boostedWalk.mobility).toBe(50);
        expect(boostedWalk.speed).toBeCloseTo(6 * 1.1102, 12);
        expect(
            movementSpeed(input({ sources: [{ hash: 1888623310, boosted: true }], sprint: true }))
                .speed,
        ).toBeCloseTo(8 * 1.1102, 12);
        expect(movementSpeed(input({ sources, direction: 'Strafe' })).speed).toBeCloseTo(
            5.6 * 0.85,
            12,
        );
        expect(
            movementSpeed(
                input({ sources: [{ hash: 1888623310, boosted: true }], posture: 'Crouched' }),
            ).speed,
        ).toBeCloseTo(6 * 1.1102 * 0.55, 12);
    });
    it('rejects duplicate aliases of the same source', () => {
        expect(() =>
            movementSpeed(
                input({
                    sources: [{ hash: 1458010786 }, { hash: 3758615625 }],
                }),
            ),
        ).toThrow('Duplicate active movement source');
    });
    it('uses current source data by default and class-specific PvE/PvP Mobility and sprint speeds', () => {
        expect(movementSpeed(input())).toEqual({ mobility: 30, speed: 5.6 });
        expect(movementSpeed(input({ classHash: warlock }))).toEqual({ mobility: 30, speed: 5.6 });
        expect(movementSpeed(input({ classHash: hunter }))).toEqual({ mobility: 100, speed: 7 });
        expect(movementSpeed(input({ classHash: hunter, activity: 'PVP' }))).toEqual({
            mobility: 70,
            speed: 6.4,
        });
        expect(movementSpeed(input({ activity: 'PVP' }))).toEqual({ mobility: 30, speed: 5.6 });
        expect(movementSpeed(input({ classHash: hunter, sprint: true }))).toEqual({
            mobility: 100,
            speed: 8.6,
        });
    });
    it('reproduces 50-Mobility strafe and 100-Mobility Lightweight speeds without rounding', () => {
        const source = data();
        source.Classes[0]!.BaseMobility = 50;
        expect(
            movementSpeed(input({ classHash: hunter, direction: 'Strafe' }), source).speed,
        ).toBeCloseTo(5.1, 12);
        source.Classes[0]!.BaseMobility = 80;
        const options = input({
            classHash: hunter,
            sources: [{ hash: 1458010786 }],
        });
        expect(movementSpeed(options, source)).toMatchObject({ mobility: 100 });
        expect(movementSpeed(options, source).speed).toBeCloseTo(7 * 1.0625, 12);
    });
    it.each([
        [1, 60],
        [2, 80],
        [3, 90],
        [9, 90],
    ])('selects cumulative Athletics values at %i stacks', (stacks, mobility) => {
        expect(movementSpeed(input({ sources: [{ hash: 1133590731, stacks }] })).mobility).toBe(
            mobility,
        );
    });
    it('clamps Mobility to both ends and uses flat 5.6 m/s walk speed below 30 Mobility', () => {
        const source = data();
        expect(
            movementSpeed(
                input({ classHash: hunter, sources: [{ hash: 1133590731, stacks: 3 }] }),
                source,
            ),
        ).toEqual({ mobility: 130, speed: 7.6 });
        source.Classes[0]!.BaseMobility = -50;
        expect(movementSpeed(input({ classHash: hunter }), source)).toEqual({
            mobility: 0,
            speed: 5.6,
        });
    });
    it('keeps sprint independent of Mobility, applies non-stacking SprintBoost, and multiplies sprint bonuses', () => {
        expect(movementSpeed(input({ sprint: true })).speed).toBe(8);
        expect(
            movementSpeed(input({ sprint: true, sources: [{ hash: 1133590731, stacks: 3 }] }))
                .speed,
        ).toBe(8);
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 1458010786 }] }))).toEqual({
            mobility: 50,
            speed: 8.5,
        });
        // Non-stacking 8.5 m/s SprintBoost raises Titan/Warlock base sprint to 8.5, does not stack with itself,
        // is redundant on Hunter (base 8.6), and stacks with ForwardMultiplier up to ForwardSpeedCap.
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 3241194942 }] }))).toEqual({
            mobility: 30,
            speed: 8.5,
        });
        expect(
            movementSpeed(
                input({
                    sprint: true,
                    sources: [{ hash: 3241194942 }, { hash: 3347978673 }],
                }),
            ),
        ).toEqual({ mobility: 30, speed: 8.5 });
        expect(
            movementSpeed(
                input({ classHash: hunter, sprint: true, sources: [{ hash: 1694242450 }] }),
            ),
        ).toEqual({ mobility: 100, speed: 8.6 });
        expect(
            movementSpeed(
                input({
                    sprint: true,
                    sources: [{ hash: 3241194942 }, { hash: 1458010786 }],
                }),
            ),
        ).toEqual({ mobility: 50, speed: 9, cappedBy: 'ForwardSpeedCap' });
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
        ).toEqual({ mobility: 50, speed: 9, cappedBy: 'ForwardSpeedCap' });
        expect(
            movementSpeed(
                input({ classHash: hunter, sprint: true, sources: [{ hash: 1458010786 }] }),
            ),
        ).toEqual({ mobility: 120, speed: 9, cappedBy: 'ForwardSpeedCap' });
    });
    it('applies StrafeAdditive, CrouchAdditive, CrouchMultiplier, Peacekeepers, and Speed Booster', () => {
        // Peacekeepers: +30 Mobility (60 -> 6.2 m/s), SprintBoost 8.5
        const pk = movementSpeed(input({ sources: [{ hash: 3241194941 }] }));
        expect(pk.mobility).toBe(60);
        expect(pk.speed).toBeCloseTo(6.2, 12);
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 3241194941 }] })).speed).toBe(
            8.5,
        );
        // Killing Wind: +50 Mobility (80 -> 6.6 m/s)
        expect(movementSpeed(input({ sources: [{ hash: 2450788523 }] }))).toEqual({
            mobility: 80,
            speed: 6.6,
        });
        // Amplified: +50 Mobility (80 -> 6.6 m/s), +1 m/s strafe additive -> 6.6*0.85 + 1 = 6.61 -> 6 cap
        expect(movementSpeed(input({ direction: 'Strafe', sources: [{ hash: 1 }] }))).toEqual({
            mobility: 80,
            speed: 6,
            cappedBy: 'StrafeSpeedCap',
        });
        // Transversive Steps (+5 crouch additive) & Echo of Dilation (x2 crouch) hit CrouchSpeedCap
        for (const hash of [3347978673, 2272984656]) {
            expect(movementSpeed(input({ posture: 'Crouched', sources: [{ hash }] }))).toEqual({
                mobility: 30,
                speed: 4,
                cappedBy: 'CrouchSpeedCap',
            });
        }
        // Speed Booster hits forward/sprint 9 m/s cap and strafe 6 m/s cap
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 2 }] }))).toEqual({
            mobility: 30,
            speed: 9,
            cappedBy: 'ForwardSpeedCap',
        });
        expect(movementSpeed(input({ direction: 'Strafe', sources: [{ hash: 2 }] }))).toEqual({
            mobility: 30,
            speed: 6,
            cappedBy: 'StrafeSpeedCap',
        });
    });
    it('stacks forward, sprint and grounded multipliers before capping sprint, independent of source order', () => {
        const source = data();
        source.Sources.push({
            Hash: 123,
            Name: 'Grounded movement',
            RefType: 'item',
            Activation: 'Always',
            Effects: [{ Type: 'GroundedMultiplier', Values: [0.85] }],
        });
        const sources = [{ hash: 1888623310 }, { hash: 1458010786 }, { hash: 12 }, { hash: 123 }];
        for (const order of [sources, [...sources].reverse()]) {
            const result = movementSpeed(input({ sprint: true, sources: order }), source);
            expect(result.mobility).toBe(50);
            expect(result.speed).toBeCloseTo(8 * 1.0625 * 0.85, 12);
            expect(result.cappedBy).toBeUndefined();
        }
        expect(
            movementSpeed(
                input({ sprint: true, sources: [{ hash: 1888623310 }, { hash: 1458010786 }] }),
            ),
        ).toEqual({ mobility: 50, speed: 8.5 });
    });
    it.each([
        { hash: 12, name: 'Machine Gun' },
        { hash: 13, name: 'Rocket Launcher' },
    ])('uses the real $name category as a hip-fire overweight penalty', ({ hash, name }) => {
        const source = data();
        const entry = source.Sources.find((candidate) => candidate.Hash === hash);
        expect(entry).toMatchObject({
            Name: name,
            RefType: 'itemCategory',
            Activation: 'WhileHeld',
            Effects: [{ Type: 'OverweightMultiplier', Values: [0.85] }],
        });
        expect(movementSpeed(input({ sources: [{ hash }] }), source).speed).toBeCloseTo(
            5.6 * 0.85,
            12,
        );
        expect(
            movementSpeed(input({ direction: 'Strafe', sources: [{ hash }] }), source).speed,
        ).toBeCloseTo(5.6 * 0.85 * 0.85, 12);
        expect(
            movementSpeed(input({ posture: 'Crouched', sources: [{ hash }] }), source).speed,
        ).toBeCloseTo(5.6 * 0.55 * 0.85, 12);
        expect(movementSpeed(input({ sprint: true, sources: [{ hash }] }), source).speed).toBe(8);
    });
    it('applies sword-guarding penalty to grounded movement but not sprint', () => {
        const source = data();
        const guard = source.Sources.find((entry) => entry.Hash === 54)!;
        expect(guard).toMatchObject({
            Name: 'Sword guarding',
            RefType: 'itemCategory',
            Activation: 'Conditional',
            Effects: [{ Type: 'GroundedNonSprintMultiplier', Values: [0.85] }],
        });
        expect(movementSpeed(input({ sources: [{ hash: 54 }] }), source).speed).toBeCloseTo(
            5.6 * 0.85,
            12,
        );
        expect(
            movementSpeed(input({ posture: 'Crouched', sources: [{ hash: 54 }] }), source).speed,
        ).toBeCloseTo(5.6 * 0.55 * 0.85, 12);
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 54 }] }), source).speed).toBe(
            8,
        );
    });
    it('keeps sword guard multiplicative with other active sources without changing sprint applicability', () => {
        const source = data();
        const sources = [{ hash: 54 }, { hash: 1888623310, boosted: true }];
        expect(movementSpeed(input({ sources }), source).speed).toBeCloseTo(6 * 0.85 * 1.1102, 12);
        expect(movementSpeed(input({ sprint: true, sources }), source).speed).toBeCloseTo(
            8 * 1.1102,
            12,
        );
    });
    it('keeps GroundedMultiplier applicable to sprint', () => {
        const source = data();
        source.Sources.push({
            Hash: 123,
            Name: 'Grounded movement',
            RefType: 'item',
            Activation: 'Always',
            Effects: [{ Type: 'GroundedMultiplier', Values: [0.85] }],
        });
        expect(movementSpeed(input({ sprint: true, sources: [{ hash: 123 }] }), source).speed).toBe(
            8 * 0.85,
        );
    });
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
            movementSpeed(input({ direction, posture, sources: [{ hash: 123 }] }), source),
        ).toEqual({ mobility: 30, speed, cappedBy });
    });
    it.each([
        ['Forward', 'Standing', 6 * 1.0625],
        ['Forward', 'Crouched', 6 * 1.0625 * 0.55],
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
            mobility: 30,
            speed: 2,
            cappedBy: 'StrafeSpeedCap',
        });
        source.Rules.ForwardSpeedCap = 1;
        expect(movementSpeed(input({ direction: 'Strafe', posture: 'Crouched' }), source)).toEqual({
            mobility: 30,
            speed: 1,
            cappedBy: 'ForwardSpeedCap',
        });
    });
    it('replaces boosted values only when the caller asserts all required equipment is present', () => {
        const source = data();
        const athletics = source.Sources.find((entry) => entry.Hash === 1133590731)!;
        athletics.BoostRequiresAll = [1331482397];
        athletics.Effects[0]!.BoostedValues = [40, 60, 70];
        expect(
            movementSpeed(
                input({ sources: [{ hash: 1133590731, stacks: 2, boosted: true }] }),
                source,
            ).mobility,
        ).toBe(90);
        expect(
            movementSpeed(input({ sources: [{ hash: 1133590731, stacks: 2 }] }), source).mobility,
        ).toBe(80);
    });
    it('rejects unknown classes/sources, duplicate sources, invalid stacks and invalid sprint states', () => {
        for (const options of [
            input({ classHash: 0 }),
            input({ sources: [{ hash: 0 }] }),
            input({ sources: [{ hash: 1133590731 }, { hash: 1133590731 }] }),
            ...[0, -1, 1.5, NaN, Infinity].map((stacks) =>
                input({ sources: [{ hash: 1133590731, stacks }] }),
            ),
            input({ sprint: true, direction: 'Strafe' }),
            input({ sprint: true, posture: 'Crouched' }),
        ])
            expect(() => movementSpeed(options)).toThrow();
    });
});

describe('movement source validation', () => {
    it('rejects repeated aliases without rewriting the source data', () => {
        const source = fixture();
        source.movement = data();
        const entry = source.movement.Sources.find((item) => item.Hash === 1458010786)!;
        const sourceIndex = source.movement.Sources.indexOf(entry);
        const aliases = [...entry.AlsoMatches!];
        entry.AlsoMatches = [aliases[0]!, aliases[0]!];

        const errors = validateSources(source).filter((issue) => issue.severity === 'error');
        expect(errors).toContainEqual(
            expect.objectContaining({
                path: `movement.Sources[${sourceIndex}].AlsoMatches[1]`,
                message: 'Duplicate value: ' + aliases[0],
                severity: 'error',
            }),
        );
        expect(entry.AlsoMatches).toEqual([aliases[0], aliases[0]]);
    });
    it('rejects aliases overlapping another source identity and accepts distinct aliases', () => {
        const source = fixture();
        source.movement = data();
        const first = source.movement.Sources[0]!;
        const second = source.movement.Sources[1]!;
        const firstAliases = first.AlsoMatches === undefined ? undefined : [...first.AlsoMatches];
        const secondAliases =
            second.AlsoMatches === undefined ? undefined : [...second.AlsoMatches];

        first.AlsoMatches = [first.Hash];
        expect(
            validateSources(source).some(
                (issue) =>
                    issue.path === 'movement.Sources[0].AlsoMatches[0]' &&
                    issue.message.includes('Duplicate movement source hash or alias'),
            ),
        ).toBe(true);

        if (firstAliases === undefined) delete first.AlsoMatches;
        else first.AlsoMatches = firstAliases;
        second.AlsoMatches = [...(secondAliases ?? []), first.Hash];
        expect(
            validateSources(source).some(
                (issue) =>
                    issue.path ===
                        `movement.Sources[1].AlsoMatches[${secondAliases?.length ?? 0}]` &&
                    issue.message.includes('Duplicate movement source hash or alias'),
            ),
        ).toBe(true);

        if (secondAliases === undefined) delete second.AlsoMatches;
        else second.AlsoMatches = secondAliases;
        expect(
            validateSources(source).filter(
                (issue) => issue.severity === 'error' && issue.path.startsWith('movement.Sources'),
            ),
        ).toEqual([]);
    });
    it('rejects ambiguous, repeated, invalid and empty aliases', () => {
        for (const aliases of [[12], [123, 123], [0], [-1], [4294967296], [1.5], []]) {
            const source = fixture();
            source.movement = data();
            source.movement.Sources[0]!.AlsoMatches = aliases;
            expect(validateSources(source).some((issue) => issue.severity === 'error')).toBe(true);
        }
    });
    it('allows Mobility above the cap, negative Mobility effects and unbounded positive multipliers', () => {
        const source = fixture();
        source.movement.Classes[0]!.BaseMobility = 200;
        source.movement.Sources = [
            {
                Hash: 123,
                Name: 'Penalty',
                RefType: 'item',
                Activation: 'Always',
                Effects: [
                    { Type: 'Mobility', Values: [-20] },
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
                Effects: [{ Type: 'Mobility', Values: [0] }],
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
        const athletics = source.movement.Sources.find((entry) => entry.Hash === 1133590731)!;
        const effect = athletics.Effects[0]!;
        effect.BoostedValues = [10];
        athletics.Effects.push({ ...effect });
        const errors = validateSources(source).filter((issue) => issue.severity === 'error');
        expect(
            errors.some(
                (issue) => issue.path.includes('BoostedValues') && issue.message.includes('length'),
            ),
        ).toBe(true);
        expect(errors.some((issue) => issue.message.includes('Duplicate Type'))).toBe(true);
        expect(errors.some((issue) => issue.path.endsWith('BoostRequiresAll'))).toBe(true);
    });
    it('requires integer Mobility points and positive multipliers', () => {
        const source = fixture();
        source.movement = data();
        const athletics = source.movement.Sources.find((entry) => entry.Hash === 1133590731)!;
        const lightweight = source.movement.Sources.find((entry) => entry.Hash === 1458010786)!;
        athletics.Effects[0]!.Values = [0.5];
        lightweight.Effects[1]!.Values = [0];
        expect(validateSources(source).filter((issue) => issue.severity === 'error')).toHaveLength(
            2,
        );
    });
    it('models passive weapon strafe modifiers and Radiant Dance Machines hip-fire bonuses', () => {
        const repo = data();
        const titan = 3655393761;
        const hunter = 671679327;
        // Sleeper Simulant & One Thousand Voices slow strafe while leaving forward/sprint unchanged
        for (const intrinsic of [3884127242, 1657056865]) {
            const strafe = movementSpeed(
                {
                    classHash: titan,
                    activity: 'PVE',
                    sources: [{ hash: intrinsic }],
                    direction: 'Strafe',
                    posture: 'Standing',
                },
                repo,
            );
            const forward = movementSpeed(
                {
                    classHash: titan,
                    activity: 'PVE',
                    sources: [{ hash: intrinsic }],
                    direction: 'Forward',
                    posture: 'Standing',
                },
                repo,
            );
            expect(strafe.speed).toBeCloseTo(5.6 * 0.85 * 0.8333333, 6);
            expect(forward.speed).toBeCloseTo(5.6, 10);
        }
        // Radiant Dance Machines hip-fire bonus (+30 Mobility, 1.045x forward/sprint, 1.1x strafe)
        const rdmForward = movementSpeed(
            {
                classHash: hunter,
                activity: 'PVP',
                sources: [{ hash: 117669763 }],
                direction: 'Forward',
                posture: 'Standing',
            },
            repo,
        );
        expect(rdmForward.mobility).toBe(100);
        expect(rdmForward.speed).toBeCloseTo(7.0 * 1.045, 10);
        const rdmSprint = movementSpeed(
            {
                classHash: hunter,
                activity: 'PVP',
                sources: [{ hash: 117669763 }],
                direction: 'Forward',
                posture: 'Standing',
                sprint: true,
            },
            repo,
        );
        expect(rdmSprint.speed).toBeCloseTo(8.6 * 1.045, 10);
        const rdmStrafe = movementSpeed(
            {
                classHash: titan,
                activity: 'PVE',
                sources: [{ hash: 117669763 }],
                direction: 'Strafe',
                posture: 'Standing',
            },
            repo,
        );
        expect(rdmStrafe.mobility).toBe(60);
        expect(rdmStrafe.speed).toBeCloseTo(6.2 * 0.85 * 1.1, 10);
    });
});
