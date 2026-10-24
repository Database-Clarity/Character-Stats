import { describe, expect, it } from 'vitest';
import { expandCurve } from '../../core';
import { valuesToSegments } from './curveValuesConversion';

describe('valuesToSegments', () => {
    it('preserves values requiring more than three decimal places', () => {
        const values = [1.23456789, 0.00000003, -4.12345678];
        const result = valuesToSegments(values, [0, 2]);

        expect('curve' in result).toBe(true);
        if (!('curve' in result)) return;
        expect(result.curve.Round).toBe(8);
        expect(expandCurve(result.curve, [0, 2])).toEqual(values);
    });

    it('blocks conversion when the supported rounding range cannot preserve values', () => {
        const result = valuesToSegments([Math.PI, 2], [0, 1]);

        expect(result).toEqual({
            reason: 'No supported rounding value (0–12 digits) preserves every value exactly.',
        });
    });

    it('rejects non-finite or incorrectly sized arrays', () => {
        expect(valuesToSegments([1, Number.NaN], [0, 1])).toHaveProperty('reason');
        expect(valuesToSegments([1], [0, 1])).toHaveProperty('reason');
    });
});
