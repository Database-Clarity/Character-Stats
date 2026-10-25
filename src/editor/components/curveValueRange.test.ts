import { describe, expect, it } from 'vitest';
import { curveValueRange } from './curveValueRange';

describe('curveValueRange', () => {
    it('pads both ends of the plotted range by 12 percent', () => {
        expect(curveValueRange([10, 20])).toEqual({ min: 8.8, max: 21.2 });
    });

    it('gives flat curves a non-zero span around their value', () => {
        expect(curveValueRange([0, 0])).toEqual({ min: -1, max: 1 });
        expect(curveValueRange([-40, -40])).toEqual({ min: -44, max: -36 });
    });

    it('uses a sensible fallback for empty or non-finite data', () => {
        expect(curveValueRange([])).toEqual({ min: 0, max: 1 });
        expect(curveValueRange([Number.NaN, Number.POSITIVE_INFINITY])).toEqual({
            min: 0,
            max: 1,
        });
    });
});
