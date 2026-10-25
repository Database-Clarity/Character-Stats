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
