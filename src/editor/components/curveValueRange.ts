export function curveValueRange(values: readonly number[]): { min: number; max: number } {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0) return { min: 0, max: 1 };

    const dataMin = Math.min(...finiteValues),
        dataMax = Math.max(...finiteValues);
    if (dataMin === dataMax) {
        const halfSpan = Math.max(Math.abs(dataMin) * 0.1, 1);
        return { min: dataMin - halfSpan, max: dataMax + halfSpan };
    }

    const padding = (dataMax - dataMin) * 0.12;
    return { min: dataMin - padding, max: dataMax + padding };
}

/** Rounds a tick step to 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(span: number, targetCount: number): number {
    const raw = span / Math.max(1, targetCount);
    if (!(raw > 0) || !Number.isFinite(raw)) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(raw)),
        residual = raw / magnitude;
    const nice =
        residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 2.5 ? 2.5 : residual <= 5 ? 5 : 10;
    return nice * magnitude;
}

const clean = (n: number) => Number(n.toPrecision(12));

/** Decimal places needed to print every multiple of `step` exactly. */
export function stepDecimals(step: number): number {
    const text = String(clean(step));
    if (text.includes('e')) return Math.min(20, Math.max(0, -Math.floor(Math.log10(step)) + 1));
    return text.split('.')[1]?.length ?? 0;
}

/**
 * Value axis for a curve plot: the data range widened outward to round tick multiples, so
 * every gridline is labeled with a round number. Flat curves keep the padded fallback span.
 */
export function niceValueAxis(
    values: readonly number[],
    targetCount = 4,
): { min: number; max: number; ticks: number[]; decimals: number } {
    const finiteValues = values.filter(Number.isFinite);
    const range =
        finiteValues.length && Math.min(...finiteValues) !== Math.max(...finiteValues)
            ? { min: Math.min(...finiteValues), max: Math.max(...finiteValues) }
            : curveValueRange(finiteValues);
    const step = niceStep(range.max - range.min, targetCount),
        first = Math.floor(clean(range.min / step)),
        last = Math.ceil(clean(range.max / step));
    const ticks = Array.from({ length: last - first + 1 }, (_, i) => clean((first + i) * step));
    return { min: ticks[0]!, max: ticks[ticks.length - 1]!, ticks, decimals: stepDecimals(step) };
}

/** Round, integer-step ticks inside a fixed stat domain such as [0, 100] or [0, 13]. */
export function domainTicks(domain: readonly [number, number], targetCount = 4): number[] {
    const [start, end] = domain;
    const nice = niceStep(end - start, targetCount),
        step = nice === 2.5 ? 2 : Math.max(1, nice);
    const ticks: number[] = [];
    for (let i = Math.ceil(clean(start / step)); clean(i * step) <= end; i++) {
        ticks.push(clean(i * step));
    }
    return ticks;
}
