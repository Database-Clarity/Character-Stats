import { describe, expect, it } from 'vitest';
import type { CurveSegment } from '../../core';
import {
    INLINE_DEFAULT_HEIGHT,
    INLINE_HEIGHT_RANGE,
    MODAL_DEFAULT_HEIGHT,
    adaptiveTickCount,
    applyPlotPreferences,
    builtInPlotPreferences,
    clampPlotHeight,
    clampXRange,
    clampXWidth,
    clearPlotDefault,
    defaultPlotView,
    domainXToPixel,
    extractPlotPreferences,
    formatPlotDelta,
    formatPlotNumber,
    isPlotViewAtDefault,
    isPlotViewDefault,
    isPlotZoomed,
    loadPlotDefault,
    matchesPlotPreferences,
    panXRange,
    parsePlotPreferences,
    pixelToDomainX,
    plotValueAxis,
    reciprocalValue,
    savePlotDefault,
    segmentBoundaryXs,
    subscribePlotDefault,
    transformPlotPoints,
    visiblePlotPoints,
    yAxisMargin,
    zoomXRange,
} from './curvePlotView';

describe('curvePlotView', () => {
    it('clamps width, height, and x-range bounds cleanly', () => {
        expect(clampXWidth(10)).toBe(25);
        expect(clampXWidth(62.4)).toBe(62);
        expect(clampXWidth(140)).toBe(100);
        expect(clampXWidth(Number.NaN)).toBe(100);

        expect(clampPlotHeight(90, [150, 480])).toBe(150);
        expect(clampPlotHeight(320, [150, 480])).toBe(320);
        expect(clampPlotHeight(900, [150, 480])).toBe(480);

        expect(clampXRange([0, 100], 60, 20)).toEqual([20, 60]);
        expect(clampXRange([0, 100], -10, 150)).toEqual([0, 100]);
        expect(clampXRange([0, 100], 50, 50)).toEqual([50, 51]);
        expect(clampXRange([0, 100], 100, 100)).toEqual([99, 100]);
        expect(clampXRange([0, 0], 0, 0)).toEqual([0, 0]);
    });

    it('zooms around an anchor and pans while keeping span intact', () => {
        expect(zoomXRange([0, 100], [0, 100], 0.5)).toEqual([25, 75]);
        expect(zoomXRange([0, 100], [0, 100], 0.5, 0)).toEqual([0, 50]);
        expect(zoomXRange([0, 100], [0, 100], 0.5, 100)).toEqual([50, 100]);
        expect(zoomXRange([0, 100], [20, 22], 0.5)).toEqual([21, 22]);
        expect(zoomXRange([0, 100], [20, 40], 2)).toEqual([10, 50]);
        expect(zoomXRange([0, 0], [0, 0], 0.5)).toEqual([0, 0]);

        expect(panXRange([0, 100], [20, 40], 15)).toEqual([35, 55]);
        expect(panXRange([0, 100], [20, 40], -30)).toEqual([0, 20]);
        expect(panXRange([0, 100], [80, 100], 25)).toEqual([80, 100]);
    });

    it('refits the y-axis to visible points and optional zero baseline', () => {
        const plot = [
            { x: 0, current: 0.4, saved: 1 },
            { x: 50, current: 0.65, saved: 1 },
            { x: 100, current: 0.9, saved: 1 },
        ];
        const zoomed = visiblePlotPoints(plot, [50, 100]);
        expect(zoomed.map((p) => p.x)).toEqual([50, 100]);

        const autoAxis = plotValueAxis(zoomed, false, false, 4);
        expect(autoAxis.min).toBeGreaterThan(0);
        expect(autoAxis.max).toBeLessThanOrEqual(1);

        const zeroAxis = plotValueAxis(zoomed, false, true, 4);
        expect(zeroAxis.min).toBe(0);

        const compareAxis = plotValueAxis(zoomed, true, false, 4);
        expect(compareAxis.max).toBeGreaterThanOrEqual(1);
    });

    it('maps domain x to and from pixels without NaN on single-point domains', () => {
        expect(domainXToPixel(50, [0, 100], 50, 200)).toBe(150);
        expect(domainXToPixel(0, [0, 0], 50, 200)).toBe(150);

        expect(pixelToDomainX(150, 50, 200, [0, 100])).toBe(50);
        expect(pixelToDomainX(0, 50, 200, [0, 100])).toBe(0);
        expect(pixelToDomainX(500, 50, 200, [0, 100])).toBe(100);
        expect(pixelToDomainX(120, 50, 200, [0, 0])).toBe(0);
    });

    it('adapts tick counts and left axis margin to container dimensions', () => {
        expect(adaptiveTickCount(200, 72, 2, 10)).toBe(2);
        expect(adaptiveTickCount(800, 72, 2, 10)).toBe(10);
        expect(yAxisMargin([0, 1], 1)).toBe(48);
        expect(yAxisMargin([0, 12345.67], 2)).toBeGreaterThan(48);
    });

    it('extracts interior segment boundaries inside the visible x-range', () => {
        const segments: CurveSegment[] = [
            { Type: 'Constant', From: 0, To: 27, Value: 0.4 },
            { Type: 'Expression', From: 28, To: 82, Expression: 'x' },
            {
                Type: 'Linear',
                Points: [
                    [83, 0.8],
                    [100, 0.9],
                ],
            },
        ];
        expect(segmentBoundaryXs(segments, [0, 100])).toEqual([28, 83]);
        expect(segmentBoundaryXs(segments, [28, 83])).toEqual([]);
        expect(segmentBoundaryXs(segments, [20, 50])).toEqual([28]);
        expect(segmentBoundaryXs([segments[0]!], [0, 100])).toEqual([]);
    });

    it('formats plot numbers, signed deltas, and default view state', () => {
        expect(formatPlotNumber(-0)).toBe('0');
        expect(formatPlotNumber(undefined)).toBe('invalid');
        expect(formatPlotDelta(0.9, 0.4)).toBe('+0.5');
        expect(formatPlotDelta(0.364, 0.4)).toBe('-0.036');
        expect(formatPlotDelta(1, 1)).toBe('0');
        expect(formatPlotDelta(1, undefined)).toBeUndefined();

        const view = defaultPlotView([0, 100], INLINE_DEFAULT_HEIGHT);
        expect(isPlotZoomed(view.xRange, [0, 100])).toBe(false);
        expect(isPlotViewDefault(view, [0, 100], INLINE_DEFAULT_HEIGHT)).toBe(true);
        expect(
            isPlotViewDefault({ ...view, xWidthPercent: 60 }, [0, 100], INLINE_DEFAULT_HEIGHT),
        ).toBe(false);
        expect(
            isPlotViewDefault({ ...view, reciprocal: true }, [0, 100], INLINE_DEFAULT_HEIGHT),
        ).toBe(false);
    });

    it('transforms plot points into finite reciprocals and skips zero or invalid entries', () => {
        expect(reciprocalValue(0.5)).toBe(2);
        expect(reciprocalValue(0)).toBeUndefined();
        expect(reciprocalValue(Number.NaN)).toBeUndefined();
        expect(reciprocalValue(undefined)).toBeUndefined();

        const raw = [
            { x: 0, current: 1, saved: 1 },
            { x: 50, current: 0.5, saved: 0.4 },
            { x: 100, current: 0, saved: 0.25 },
        ];
        expect(transformPlotPoints(raw, false)).toEqual(raw);
        expect(transformPlotPoints(raw, true)).toEqual([
            { x: 0, current: 1, saved: 1 },
            { x: 50, current: 2, saved: 2.5 },
            { x: 100, current: undefined, saved: 4 },
        ]);

        expect(formatPlotNumber(1 / 0.364, { maxDecimals: 4 })).toBe('2.7473');
        expect(formatPlotNumber(undefined, { invalidLabel: 'undefined' })).toBe('undefined');
        expect(formatPlotDelta(1 / 0.364, 1 / 0.319, 4)).toBe('-0.3875');
    });

    it('persists, parses, notifies, and clears saved default plot views', () => {
        const backing = new Map<string, string>();
        const memoryStorage = {
            getItem: (key: string) => backing.get(key) ?? null,
            setItem: (key: string, value: string) => {
                backing.set(key, value);
            },
            removeItem: (key: string) => {
                backing.delete(key);
            },
        };

        expect(loadPlotDefault('inline', memoryStorage)).toBeNull();
        expect(
            parsePlotPreferences('not json', INLINE_DEFAULT_HEIGHT, INLINE_HEIGHT_RANGE),
        ).toBeNull();
        expect(parsePlotPreferences('[]', INLINE_DEFAULT_HEIGHT, INLINE_HEIGHT_RANGE)).toBeNull();

        const observed: unknown[] = [];
        const unsubscribe = subscribePlotDefault('inline', (prefs) => observed.push(prefs));

        const prefs = extractPlotPreferences(
            {
                ...defaultPlotView([0, 100], 260),
                xWidthPercent: 55,
                includeZero: true,
                showPoints: true,
                reciprocal: true,
            },
            INLINE_HEIGHT_RANGE,
        );
        savePlotDefault('inline', prefs, memoryStorage);

        const loaded = loadPlotDefault('inline', memoryStorage);
        expect(loaded).toEqual(prefs);
        expect(observed).toEqual([prefs]);

        // Saving from a non-reciprocal curve preserves a previously saved reciprocal default.
        const preserved = extractPlotPreferences(
            { ...applyPlotPreferences([100, 200], prefs), reciprocal: false },
            INLINE_HEIGHT_RANGE,
            { hasReciprocal: false, previousReciprocal: loaded?.reciprocal ?? false },
        );
        expect(preserved.reciprocal).toBe(true);

        const view = applyPlotPreferences([0, 100], prefs);
        expect(matchesPlotPreferences(view, prefs, true)).toBe(true);
        expect(isPlotViewAtDefault(view, [0, 100], prefs, true)).toBe(true);
        expect(isPlotViewAtDefault({ ...view, xRange: [10, 50] }, [0, 100], prefs, true)).toBe(
            false,
        );

        clearPlotDefault('inline', memoryStorage);
        expect(loadPlotDefault('inline', memoryStorage)).toBeNull();
        expect(observed).toEqual([prefs, null]);
        unsubscribe();

        // Modal defaults clamp to modal height bounds independently of inline defaults.
        savePlotDefault(
            'modal',
            { ...builtInPlotPreferences(MODAL_DEFAULT_HEIGHT), height: 999, xWidthPercent: 10 },
            memoryStorage,
        );
        expect(loadPlotDefault('modal', memoryStorage)).toMatchObject({
            height: 720,
            xWidthPercent: 25,
        });
    });
});
