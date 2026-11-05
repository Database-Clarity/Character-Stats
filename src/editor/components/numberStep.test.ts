import { describe, expect, it } from 'vitest';
import { overrideSpec } from '../../core';
import { numberStep } from './numberStep';

describe('numberStep', () => {
    it.each([
        [0.875, 0.01],
        [91, 1],
        [-1.25, 0.01],
        [1e-7, 0.01],
        [1.25e-7, 0.01],
        [1e21, 1],
        [0, 1],
        [NaN, 1],
        [undefined, 1],
    ])('uses decimal precision for %s', (value, step) => {
        expect(numberStep(value)).toBeCloseTo(step, 12);
    });
    it('uses hundredths for a bounded 0–1 field, including endpoints', () => {
        for (const value of [0, 0.875, 1, undefined])
            expect(numberStep(value, { min: 0, max: 1 })).toBe(0.01);
        expect(numberStep(1, { exclusiveMin: 0, max: 1 })).toBe(0.01);
    });
    it('uses declared field precision for integral values', () => {
        const scalar = overrideSpec.fields.find((field) => field.key === 'Scalar');
        const chunkEnergy = overrideSpec.fields.find(
            (field) => field.key === 'ChunkEnergyOverride',
        );
        if (!scalar || !chunkEnergy) throw new Error('Missing override parallel fields');

        expect(numberStep(1, scalar.items)).toBe(0.01);
        expect(numberStep(1, chunkEnergy.items)).toBe(0.01);
        expect(numberStep(1, { round: 2 })).toBe(0.01);
    });
    it('keeps integer controls integral', () => {
        expect(numberStep(0.875, { min: 0, max: 1 }, true)).toBe(1);
    });
    it('uses hundredths even for values smaller than the supported arrow precision', () => {
        expect(numberStep(Number.MIN_VALUE)).toBe(0.01);
    });
});
