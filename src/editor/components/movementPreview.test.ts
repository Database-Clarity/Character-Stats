import { describe, expect, it } from 'vitest';
import movementData from '../../../sources/movement.json';
import { movementSpeed, type MovementSource } from '../../core';
import {
    calculateMovementStats,
    formatMovementDelta,
    movementStackCount,
    reconcileMovementSources,
    reconcileWhileHeldSources,
    setMovementSourceActive,
    type ActiveMovementSource,
    type ActiveMovementSources,
} from './movementPreview';

const titan = 3655393761;
const source = () => structuredClone(movementData) as unknown as MovementSource;
const selection: ActiveMovementSource = { stacks: 1, boosted: false, held: false };

function row(stats: ReturnType<typeof calculateMovementStats>, key: string) {
    return stats.find((stat) => stat.key === key)!;
}

describe('movement preview calculations', () => {
    it('calculates all six global-only baseline rows through the core calculator', () => {
        const data = source();
        const stats = calculateMovementStats(data, titan, 'PVE', {});
        const walk = movementSpeed(
            {
                classHash: titan,
                activity: 'PVE',
                sources: [],
                direction: 'Forward',
                posture: 'Standing',
            },
            data,
        );
        expect(stats.map((stat) => stat.key)).toEqual([
            'mobility',
            'sprint',
            'walk',
            'strafe',
            'crouch',
            'ads',
        ]);
        expect(row(stats, 'mobility')).toMatchObject({
            value: walk.tier,
            baseline: walk.tier,
            delta: 0,
            unit: 'tier',
        });
        for (const stat of stats) expect(stat.delta).toBe(0);
    });

    it.each([
        { hash: 12, name: 'Machine Gun' },
        { hash: 13, name: 'Rocket Launcher' },
    ])('keeps real $name sprint unchanged while applying its grounded penalty', ({ hash }) => {
        const data = source();
        const stats = calculateMovementStats(data, titan, 'PVE', {
            [hash]: selection,
        });
        expect(row(stats, 'sprint')).toMatchObject({ value: 8, baseline: 8, delta: 0 });
        expect(row(stats, 'walk').value).toBeCloseTo(4.76, 12);
        expect(row(stats, 'walk').baseline).toBeCloseTo(5.6, 12);
        expect(row(stats, 'walk').delta).toBeCloseTo(-0.84, 12);
        expect(row(stats, 'strafe').delta).toBeCloseTo(-0.714, 12);
        expect(row(stats, 'crouch').delta).toBeCloseTo(-0.462, 12);
    });

    it('previews sword guarding as grounded-only and keeps other selected source effects', () => {
        const data = source();
        const guard = data.Sources.find((entry) => entry.Hash === 54)!;
        expect(guard.Effects).toEqual([{ Type: 'GroundedNonSprintMultiplier', Values: [0.85] }]);
        const stats = calculateMovementStats(data, titan, 'PVE', {
            54: selection,
            1888623310: { ...selection, boosted: true },
        });
        expect(row(stats, 'sprint')).toMatchObject({ baseline: 8, value: 8.8 });
        expect(row(stats, 'sprint').delta).toBeCloseTo(0.8, 12);
        expect(row(stats, 'walk')).toMatchObject({
            baseline: 5.6,
            value: 5.236,
        });
    });

    it('reports positive mobility and sprint changes from a real Lightweight source', () => {
        const stats = calculateMovementStats(source(), titan, 'PVE', {
            1458010786: selection,
        });
        expect(row(stats, 'mobility')).toMatchObject({ baseline: 3, value: 5, delta: 2 });
        expect(row(stats, 'sprint')).toMatchObject({ baseline: 8, value: 8.5, delta: 0.5 });
        expect(row(stats, 'sprint').cappedBy).toBeUndefined();
    });

    it('keeps core calculation errors visible without substituting fallback speeds', () => {
        const stats = calculateMovementStats(source(), 0, 'PVE', {});
        for (const stat of stats) {
            expect(stat.value).toBeUndefined();
            expect(stat.delta).toBeUndefined();
            expect(stat.error).toContain('Unknown movement class 0');
        }
    });

    it('formats signed accessible deltas and treats rounded-to-zero changes neutrally', () => {
        expect(formatMovementDelta(1.25, 'm/s')).toMatchObject({
            direction: 'increase',
            arrow: '↑',
            text: '+1.25 m/s',
        });
        expect(formatMovementDelta(-0.5, 'm/s')).toMatchObject({
            direction: 'decrease',
            arrow: '↓',
            text: '-0.50 m/s',
        });
        expect(formatMovementDelta(0, 'tier')).toMatchObject({
            direction: 'neutral',
            arrow: '—',
            text: '0.00 tiers',
            accessibleLabel: 'No change from the global-only baseline',
        });
        expect(formatMovementDelta(0.0000004, 'm/s').direction).toBe('neutral');
        expect(formatMovementDelta(0.000001, 'm/s').text).toBe('+0.000001 m/s');
    });
});

describe('exclusive WhileHeld source selection', () => {
    it('replaces and clears WhileHeld sources while preserving Always and Conditional sources', () => {
        const data = source();
        const always = data.Sources.find((entry) => entry.Activation === 'Always')!;
        const conditional = data.Sources.find((entry) => entry.Activation === 'Conditional')!;
        const machineGun = data.Sources.find((entry) => entry.Hash === 12)!;
        const rocketLauncher = data.Sources.find((entry) => entry.Hash === 13)!;
        expect(machineGun.Activation).toBe('WhileHeld');
        expect(rocketLauncher.Activation).toBe('WhileHeld');

        let active: ActiveMovementSources = {};
        active = setMovementSourceActive(active, data.Sources, always.Hash, true);
        active = setMovementSourceActive(active, data.Sources, conditional.Hash, true);
        active = setMovementSourceActive(active, data.Sources, machineGun.Hash, true);
        active = setMovementSourceActive(active, data.Sources, rocketLauncher.Hash, true);
        expect(active).toEqual({
            [always.Hash]: selection,
            [conditional.Hash]: selection,
            [rocketLauncher.Hash]: selection,
        });

        active = setMovementSourceActive(active, data.Sources, rocketLauncher.Hash, false);
        expect(active).toEqual({
            [always.Hash]: selection,
            [conditional.Hash]: selection,
        });
    });
});

describe('movement stack selection', () => {
    it('derives one stack for single-value sources and multiple choices from all effects', () => {
        const data = source();
        const single = data.Sources.find((entry) => entry.Hash === 1888623310)!;
        expect(movementStackCount(single)).toBe(1);
        const multiple = data.Sources.find((entry) => entry.Hash === 1133590731)!;
        expect(movementStackCount(multiple)).toBe(3);

        const stackable = data.Sources.find((entry) => entry.Hash === 1458010786)!;
        stackable.Effects = [
            { Type: 'MobilityTiers', Values: [1, 2, 3], BoostedValues: [2, 4] },
            { Type: 'SprintMultiplier', Values: [1.01, 1.02] },
        ];
        stackable.BoostRequiresAll = [123];
        expect(movementStackCount(stackable)).toBe(3);
        expect(movementStackCount(stackable, true)).toBe(2);
    });

    it('applies the selected stack effect and clamps selection after boost or source edits', () => {
        const data = source();
        const stackable = data.Sources.find((entry) => entry.Hash === 1458010786)!;
        stackable.Effects = [
            { Type: 'MobilityTiers', Values: [1, 2, 3], BoostedValues: [2, 4] },
            { Type: 'SprintMultiplier', Values: [1.01, 1.02, 1.03] },
        ];
        stackable.BoostRequiresAll = [123];

        const atFirstStack = calculateMovementStats(data, titan, 'PVE', {
            [stackable.Hash]: { stacks: 1, boosted: false, held: false },
        });
        expect(row(atFirstStack, 'mobility').value).toBe(4);
        expect(row(atFirstStack, 'sprint').value).toBeCloseTo(8.08, 12);

        const atSecondStack = calculateMovementStats(data, titan, 'PVE', {
            [stackable.Hash]: { stacks: 2, boosted: false, held: false },
        });
        expect(row(atSecondStack, 'mobility').value).toBe(5);
        expect(row(atSecondStack, 'sprint').value).toBeCloseTo(8.16, 12);

        const boosted = reconcileMovementSources(
            { [stackable.Hash]: { stacks: 3, boosted: true, held: true } },
            data.Sources,
        );
        expect(boosted[stackable.Hash]).toEqual({ stacks: 3, boosted: true, held: false });
        const boostedStats = calculateMovementStats(data, titan, 'PVE', boosted);
        expect(row(boostedStats, 'mobility').value).toBe(7);
        expect(row(boostedStats, 'sprint').value).toBeCloseTo(8.24, 12);

        stackable.Effects[0]!.BoostedValues = [2];
        stackable.Effects[1]!.Values = [1.02];
        const edited = reconcileMovementSources(boosted, data.Sources);
        expect(edited[stackable.Hash]).toEqual({ stacks: 1, boosted: true, held: false });

        delete stackable.BoostRequiresAll;
        stackable.Effects = [{ Type: 'MobilityTiers', Values: [1, 2, 3] }];
        const noLongerBoostable = reconcileMovementSources(edited, data.Sources);
        expect(noLongerBoostable[stackable.Hash]).toEqual({
            stacks: 1,
            boosted: false,
            held: false,
        });
    });
});

describe('exclusive WhileHeld source reconciliation', () => {
    it('reconciles stale multiple WhileHeld entries deterministically and keeps other sources', () => {
        const data = source();
        const always = data.Sources.find((entry) => entry.Activation === 'Always')!;
        const reconciled = reconcileWhileHeldSources(
            { 12: selection, 13: selection, [always.Hash]: selection },
            data.Sources,
        );
        expect(reconciled).toEqual({ 12: selection, [always.Hash]: selection });
    });
});
