import type { CurveSegment, Domain } from '../../core';
import { niceValueAxis } from './curveValueRange';

export interface PlotPoint {
    x: number;
    current: number | undefined;
    saved: number | undefined;
}

export interface PlotViewPreferences {
    xWidthPercent: number;
    height: number;
    includeZero: boolean;
    showPoints: boolean;
    showBoundaries: boolean;
    reciprocal: boolean;
}

export interface PlotViewState extends PlotViewPreferences {
    xRange: readonly [number, number];
}

export type PlotViewMode = 'inline' | 'modal';

export const INLINE_DEFAULT_HEIGHT = 150;
export const INLINE_HEIGHT_RANGE = [150, 480] as const;
export const MODAL_DEFAULT_HEIGHT = 400;
export const MODAL_HEIGHT_RANGE = [220, 720] as const;
export const X_WIDTH_RANGE = [25, 100] as const;

export const PLOT_VIEW_STORAGE_KEYS: Record<PlotViewMode, string> = {
    inline: 'clarity:plot-view:inline',
    modal: 'clarity:plot-view:modal',
};

export function plotModeConfig(mode: PlotViewMode): {
    defaultHeight: number;
    heightRange: readonly [number, number];
} {
    return mode === 'modal'
        ? { defaultHeight: MODAL_DEFAULT_HEIGHT, heightRange: MODAL_HEIGHT_RANGE }
        : { defaultHeight: INLINE_DEFAULT_HEIGHT, heightRange: INLINE_HEIGHT_RANGE };
}

export function builtInPlotPreferences(defaultHeight: number): PlotViewPreferences {
    return {
        xWidthPercent: 100,
        height: defaultHeight,
        includeZero: false,
        showPoints: false,
        showBoundaries: true,
        reciprocal: false,
    };
}

export function applyPlotPreferences(domain: Domain, prefs: PlotViewPreferences): PlotViewState {
    return {
        ...prefs,
        xRange: [domain[0], domain[1]],
    };
}

export function defaultPlotView(domain: Domain, height: number): PlotViewState {
    return applyPlotPreferences(domain, builtInPlotPreferences(height));
}

export function extractPlotPreferences(
    view: PlotViewState,
    heightRange: readonly [number, number],
    {
        hasReciprocal = true,
        previousReciprocal = false,
    }: { hasReciprocal?: boolean; previousReciprocal?: boolean } = {},
): PlotViewPreferences {
    return {
        xWidthPercent: clampXWidth(view.xWidthPercent),
        height: clampPlotHeight(view.height, heightRange),
        includeZero: Boolean(view.includeZero),
        showPoints: Boolean(view.showPoints),
        showBoundaries: Boolean(view.showBoundaries),
        reciprocal: hasReciprocal ? Boolean(view.reciprocal) : Boolean(previousReciprocal),
    };
}

export function parsePlotPreferences(
    raw: string | null,
    defaultHeight: number,
    heightRange: readonly [number, number],
): PlotViewPreferences | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        const fallback = builtInPlotPreferences(defaultHeight);
        return {
            xWidthPercent:
                typeof record.xWidthPercent === 'number'
                    ? clampXWidth(record.xWidthPercent)
                    : fallback.xWidthPercent,
            height:
                typeof record.height === 'number'
                    ? clampPlotHeight(record.height, heightRange)
                    : fallback.height,
            includeZero:
                typeof record.includeZero === 'boolean' ? record.includeZero : fallback.includeZero,
            showPoints:
                typeof record.showPoints === 'boolean' ? record.showPoints : fallback.showPoints,
            showBoundaries:
                typeof record.showBoundaries === 'boolean'
                    ? record.showBoundaries
                    : fallback.showBoundaries,
            reciprocal:
                typeof record.reciprocal === 'boolean' ? record.reciprocal : fallback.reciprocal,
        };
    } catch {
        return null;
    }
}

export function matchesPlotPreferences(
    view: PlotViewState,
    prefs: PlotViewPreferences,
    hasReciprocal = true,
): boolean {
    return (
        view.xWidthPercent === prefs.xWidthPercent &&
        view.height === prefs.height &&
        view.includeZero === prefs.includeZero &&
        view.showPoints === prefs.showPoints &&
        view.showBoundaries === prefs.showBoundaries &&
        (!hasReciprocal || view.reciprocal === prefs.reciprocal)
    );
}

export function isPlotViewAtDefault(
    view: PlotViewState,
    domain: Domain,
    defaults: PlotViewPreferences,
    hasReciprocal = true,
): boolean {
    return (
        !isPlotZoomed(view.xRange, domain) && matchesPlotPreferences(view, defaults, hasReciprocal)
    );
}

type PlotDefaultListener = (prefs: PlotViewPreferences | null) => void;
const defaultListeners: Record<PlotViewMode, Set<PlotDefaultListener>> = {
    inline: new Set(),
    modal: new Set(),
};

function browserStorage(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
    if (storage) return storage;
    if (typeof window === 'undefined') return undefined;
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

export function loadPlotDefault(
    mode: PlotViewMode,
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): PlotViewPreferences | null {
    const store = browserStorage(storage);
    if (!store) return null;
    const { defaultHeight, heightRange } = plotModeConfig(mode);
    try {
        return parsePlotPreferences(
            store.getItem(PLOT_VIEW_STORAGE_KEYS[mode]),
            defaultHeight,
            heightRange,
        );
    } catch {
        return null;
    }
}

export function savePlotDefault(
    mode: PlotViewMode,
    prefs: PlotViewPreferences,
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
    const { heightRange } = plotModeConfig(mode);
    const normalized: PlotViewPreferences = {
        xWidthPercent: clampXWidth(prefs.xWidthPercent),
        height: clampPlotHeight(prefs.height, heightRange),
        includeZero: Boolean(prefs.includeZero),
        showPoints: Boolean(prefs.showPoints),
        showBoundaries: Boolean(prefs.showBoundaries),
        reciprocal: Boolean(prefs.reciprocal),
    };
    const store = browserStorage(storage);
    if (store) {
        try {
            store.setItem(PLOT_VIEW_STORAGE_KEYS[mode], JSON.stringify(normalized));
        } catch {
            // Ignore storage quota / privacy restrictions; still update active plots in memory.
        }
    }
    for (const listener of defaultListeners[mode]) listener(normalized);
}

export function clearPlotDefault(
    mode: PlotViewMode,
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
    const store = browserStorage(storage);
    if (store) {
        try {
            store.removeItem(PLOT_VIEW_STORAGE_KEYS[mode]);
        } catch {
            // Ignore storage errors.
        }
    }
    for (const listener of defaultListeners[mode]) listener(null);
}

export function subscribePlotDefault(
    mode: PlotViewMode,
    listener: PlotDefaultListener,
): () => void {
    defaultListeners[mode].add(listener);
    return () => {
        defaultListeners[mode].delete(listener);
    };
}

export function clampXWidth(percent: number): number {
    if (!Number.isFinite(percent)) return 100;
    return Math.round(Math.max(X_WIDTH_RANGE[0], Math.min(X_WIDTH_RANGE[1], percent)));
}

export function clampPlotHeight(height: number, bounds: readonly [number, number]): number {
    if (!Number.isFinite(height)) return bounds[0];
    return Math.round(Math.max(bounds[0], Math.min(bounds[1], height)));
}

export function clampXRange(domain: Domain, from: number, to: number): [number, number] {
    const [domainMin, domainMax] = domain;
    if (domainMax <= domainMin) return [domainMin, domainMax];
    let start = Math.round(Number.isFinite(from) ? from : domainMin);
    let end = Math.round(Number.isFinite(to) ? to : domainMax);
    if (start > end) [start, end] = [end, start];
    start = Math.max(domainMin, Math.min(domainMax, start));
    end = Math.max(domainMin, Math.min(domainMax, end));
    if (start === end) {
        if (end < domainMax) end = start + 1;
        else start = end - 1;
    }
    return [start, end];
}

export function zoomXRange(
    domain: Domain,
    current: readonly [number, number],
    factor: number,
    anchorX?: number,
): [number, number] {
    const [domainMin, domainMax] = domain;
    const totalSpan = domainMax - domainMin;
    if (totalSpan <= 0 || !(factor > 0) || !Number.isFinite(factor)) return [domainMin, domainMax];

    const [curStart, curEnd] = clampXRange(domain, current[0], current[1]);
    const curSpan = curEnd - curStart;
    let nextSpan = Math.round(curSpan * factor);
    if (factor < 1 && nextSpan >= curSpan) nextSpan = curSpan - 1;
    if (factor > 1 && nextSpan <= curSpan) nextSpan = curSpan + 1;
    nextSpan = Math.max(1, Math.min(totalSpan, nextSpan));

    const anchor =
        anchorX !== undefined && Number.isFinite(anchorX)
            ? Math.max(curStart, Math.min(curEnd, anchorX))
            : (curStart + curEnd) / 2;
    const ratio = curSpan > 0 ? (anchor - curStart) / curSpan : 0.5;
    let start = Math.round(anchor - ratio * nextSpan);
    let end = start + nextSpan;
    if (start < domainMin) {
        start = domainMin;
        end = start + nextSpan;
    }
    if (end > domainMax) {
        end = domainMax;
        start = end - nextSpan;
    }
    return [Math.max(domainMin, start), Math.min(domainMax, end)];
}

export function panXRange(
    domain: Domain,
    current: readonly [number, number],
    deltaX: number,
): [number, number] {
    const [domainMin, domainMax] = domain;
    if (domainMax <= domainMin || !Number.isFinite(deltaX)) return [domainMin, domainMax];
    const [curStart, curEnd] = clampXRange(domain, current[0], current[1]);
    const span = curEnd - curStart;
    const shift = Math.round(deltaX);
    let start = curStart + shift;
    let end = curEnd + shift;
    if (start < domainMin) {
        start = domainMin;
        end = start + span;
    }
    if (end > domainMax) {
        end = domainMax;
        start = end - span;
    }
    return [Math.max(domainMin, start), Math.min(domainMax, end)];
}

export function isPlotZoomed(xRange: readonly [number, number], domain: Domain): boolean {
    return xRange[0] > domain[0] || xRange[1] < domain[1];
}

export function isPlotViewDefault(
    view: PlotViewState,
    domain: Domain,
    defaultHeight: number,
): boolean {
    return (
        view.xWidthPercent === 100 &&
        view.height === defaultHeight &&
        !isPlotZoomed(view.xRange, domain) &&
        !view.includeZero &&
        !view.showPoints &&
        view.showBoundaries &&
        !view.reciprocal
    );
}

export function reciprocalValue(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return undefined;
    const inverted = 1 / value;
    return Number.isFinite(inverted) ? inverted : undefined;
}

export function transformPlotPoints(plot: readonly PlotPoint[], reciprocal: boolean): PlotPoint[] {
    if (!reciprocal) return [...plot];
    return plot.map((point) => ({
        x: point.x,
        current: reciprocalValue(point.current),
        saved: reciprocalValue(point.saved),
    }));
}

export function visiblePlotPoints(
    plot: readonly PlotPoint[],
    xRange: readonly [number, number],
): PlotPoint[] {
    return plot.filter((point) => point.x >= xRange[0] && point.x <= xRange[1]);
}

export function plotValueAxis(
    visible: readonly PlotPoint[],
    compare: boolean,
    includeZero: boolean,
    targetCount = 4,
): { min: number; max: number; ticks: number[]; decimals: number } {
    const values = visible
        .flatMap((point) => [point.current, ...(compare ? [point.saved] : [])])
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    if (includeZero && values.length > 0) values.push(0);
    return niceValueAxis(values, targetCount);
}

export function adaptiveTickCount(
    pixelSpan: number,
    minSpacing: number,
    minTicks: number,
    maxTicks: number,
): number {
    if (!(pixelSpan > 0) || !(minSpacing > 0)) return minTicks;
    return Math.max(minTicks, Math.min(maxTicks, Math.floor(pixelSpan / minSpacing)));
}

export function yAxisMargin(ticks: readonly number[], decimals: number): number {
    const longest = ticks.reduce((max, tick) => Math.max(max, tick.toFixed(decimals).length), 3);
    return Math.max(48, longest * 7 + 16);
}

export function domainXToPixel(
    value: number,
    xRange: readonly [number, number],
    left: number,
    plotWidth: number,
): number {
    const span = xRange[1] - xRange[0];
    if (span <= 0) return left + plotWidth / 2;
    return left + ((value - xRange[0]) / span) * plotWidth;
}

export function pixelToDomainX(
    pixelX: number,
    left: number,
    plotWidth: number,
    xRange: readonly [number, number],
): number {
    const [start, end] = xRange;
    const span = end - start;
    if (span <= 0 || !(plotWidth > 0)) return start;
    const ratio = (pixelX - left) / plotWidth;
    return Math.max(start, Math.min(end, Math.round(start + ratio * span)));
}

export function segmentBoundaryXs(
    segments: readonly CurveSegment[] | undefined,
    xRange: readonly [number, number],
): number[] {
    if (!segments || segments.length <= 1) return [];
    const [start, end] = xRange;
    const boundaries = new Set<number>();
    for (const segment of segments) {
        const edge =
            segment.Type === 'Linear'
                ? segment.Points[0]?.[0]
                : 'From' in segment
                  ? segment.From
                  : undefined;
        if (typeof edge === 'number' && Number.isFinite(edge) && edge > start && edge < end) {
            boundaries.add(edge);
        }
    }
    return [...boundaries].sort((a, b) => a - b);
}

const clean = (n: number, maxDecimals?: number) => {
    const rounded =
        maxDecimals === undefined ? Number(n.toPrecision(12)) : Number(n.toFixed(maxDecimals));
    return Object.is(rounded, -0) ? 0 : rounded;
};

export function formatPlotNumber(
    value: number | undefined,
    { maxDecimals, invalidLabel = 'invalid' }: { maxDecimals?: number; invalidLabel?: string } = {},
): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return invalidLabel;
    return String(clean(value, maxDecimals));
}

export function formatPlotDelta(
    current: number | undefined,
    saved: number | undefined,
    maxDecimals?: number,
): string | undefined {
    if (
        typeof current !== 'number' ||
        !Number.isFinite(current) ||
        typeof saved !== 'number' ||
        !Number.isFinite(saved)
    ) {
        return undefined;
    }
    const diff = clean(current - saved, maxDecimals);
    if (diff === 0) return '0';
    return diff > 0 ? `+${diff}` : String(diff);
}
