import type { CurveSegment } from '../../core';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Which inputs of a segment differ from its saved form, as `From`, `To`, `Value`, `Expression`,
 * `Points.<i>.x` or `Points.<i>.y`. A new or retyped segment marks every input.
 */
export function changedSegmentKeys(saved: unknown, segment: CurveSegment): Set<string> {
    const keys = new Set<string>();
    const old =
        typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
    const same = old.Type === segment.Type;
    if (segment.Type === 'Linear') {
        const before = same && Array.isArray(old.Points) ? (old.Points as unknown[]) : [];
        segment.Points.forEach((point, i) => {
            const was = before[i];
            (['x', 'y'] as const).forEach((axis, a) => {
                if (!Array.isArray(was) || !equal(was[a], point[a]))
                    keys.add(`Points.${i}.${axis}`);
            });
        });
        return keys;
    }
    const fields =
        segment.Type === 'Constant' ? ['From', 'To', 'Value'] : ['From', 'To', 'Expression'];
    for (const key of fields)
        if (!same || !equal(old[key], (segment as unknown as Record<string, unknown>)[key]))
            keys.add(key);
    return keys;
}

/** Indices of raw curve values that differ from the saved values (all when the format differs). */
export function changedValueIndices(saved: unknown, values: readonly unknown[]): Set<number> {
    const before =
        typeof saved === 'object' &&
        saved !== null &&
        Array.isArray((saved as { Values?: unknown }).Values)
            ? (saved as { Values: unknown[] }).Values
            : [];
    return new Set(values.flatMap((value, i) => (equal(before[i], value) ? [] : [i])));
}
