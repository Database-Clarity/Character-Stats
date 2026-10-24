import { describe, expect, it } from 'vitest';
import { numberStep } from './numberStep';

describe('numberStep', () => {
    it.each([
        [0.875, 0.001],
        [91, 1],
        [-1.25, 0.01],
        [1e-7, 1e-7],
        [1.25e-7, 1e-9],
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
    it('keeps integer controls integral', () => {
        expect(numberStep(0.875, { min: 0, max: 1 }, true)).toBe(1);
    });
    it('never underflows to a zero step', () => {
        expect(numberStep(Number.MIN_VALUE)).toBe(Number.MIN_VALUE);
    });
});
