import { describe, expect, it } from 'vitest';
import { expandCurve } from '../../core';
import { convertCurve, valuesToSegments } from './curveValuesConversion';

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

describe('convertCurve', () => {
    const segments = {
        Domain: [0, 2] as [number, number],
        Round: 3,
        Segments: [
            {
                Type: 'Linear' as const,
                Points: [[0, 0] as [number, number], [2, 1] as [number, number]],
            },
        ],
    };

    it('converts to values and back to an equivalent segmented curve', () => {
        const values = convertCurve(segments, 'values', [0, 2]);
        expect(values).toEqual({ curve: { Values: [0, 0.5, 1] } });
        if (!('curve' in values)) return;
        const back = convertCurve(values.curve, 'segments', [0, 2]);
        expect('curve' in back && expandCurve(back.curve, [0, 2])).toEqual([0, 0.5, 1]);
    });

    it('restores the original form, including Round, on a round trip', () => {
        const values = convertCurve(segments, 'values', [0, 2]);
        if (!('curve' in values)) throw new Error('conversion failed');
        expect(convertCurve(values.curve, 'segments', [0, 2], [segments])).toEqual({
            curve: segments,
        });
    });

    it('ignores candidates that changed meaning', () => {
        const edited = { Values: [0, 0.7, 1] };
        const result = convertCurve(edited, 'segments', [0, 2], [segments]);
        expect('curve' in result && result.curve).not.toBe(segments);
        expect('curve' in result && expandCurve(result.curve, [0, 2])).toEqual([0, 0.7, 1]);
    });
});
