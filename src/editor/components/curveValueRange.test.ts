import { describe, expect, it } from 'vitest';
import { curveValueRange, domainTicks, niceValueAxis } from './curveValueRange';

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

describe('niceValueAxis', () => {
    it('widens the data range to round tick multiples', () => {
        expect(niceValueAxis([0, 10])).toEqual({
            min: 0,
            max: 10,
            ticks: [0, 2.5, 5, 7.5, 10],
            decimals: 1,
        });
        expect(niceValueAxis([0.27, 1])).toEqual({
            min: 0.2,
            max: 1,
            ticks: [0.2, 0.4, 0.6, 0.8, 1],
            decimals: 1,
        });
    });

    it('keeps ticks free of floating-point noise', () => {
        const { ticks } = niceValueAxis([0.1, 0.7]);
        expect(ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    });

    it('labels flat curves around their value', () => {
        expect(niceValueAxis([1, 1]).ticks).toEqual([0, 0.5, 1, 1.5, 2]);
        expect(niceValueAxis([]).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });
});

describe('domainTicks', () => {
    it.each([
        [
            [0, 100],
            [0, 25, 50, 75, 100],
        ],
        [
            [100, 200],
            [100, 125, 150, 175, 200],
        ],
        [
            [0, 13],
            [0, 5, 10],
        ],
        [
            [0, 10],
            [0, 2, 4, 6, 8, 10],
        ],
        [
            [0, 3],
            [0, 1, 2, 3],
        ],
    ] as const)('uses integer ticks inside %j', (domain, ticks) => {
        expect(domainTicks(domain)).toEqual(ticks);
    });
});
