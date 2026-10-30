import { expandCurve, roundValue, type Curve, type CurveSegment, type Domain } from '../../core';

type SegmentedCurve = Extract<Curve, { Segments: CurveSegment[] }>;

type ValuesToSegmentsResult = { curve: SegmentedCurve } | { reason: string };

export function valuesToSegments(
    values: readonly number[],
    domain: Domain,
): ValuesToSegmentsResult {
    if (
        values.length !== domain[1] - domain[0] + 1 ||
        values.some((value) => !Number.isFinite(value))
    ) {
        return { reason: 'Values must contain one finite number for every stat in the domain.' };
    }

    const digits = Array.from({ length: 13 }, (_, index) => index).find((rounding) =>
        values.every((value) => roundValue(value, rounding) === value),
    );
    if (digits === undefined) {
        return {
            reason: 'No supported rounding value (0–12 digits) preserves every value exactly.',
        };
    }

    const curve: SegmentedCurve = {
        Domain: domain,
        Round: digits,
        Segments: [
            {
                Type: 'Linear',
                Points: values.map((value, index): [number, number] => [domain[0] + index, value]),
            },
        ],
    };

    try {
        const expanded = expandCurve(curve, domain);
        if (
            expanded.length !== values.length ||
            expanded.some((value, index) => value !== values[index])
        ) {
            return { reason: 'The Segments curve did not expand to the original values exactly.' };
        }
    } catch {
        return { reason: 'The Segments curve could not be validated.' };
    }

    return { curve };
}

export type CurveMode = 'values' | 'segments';

function modeOf(curve: unknown): CurveMode | undefined {
    if (typeof curve !== 'object' || curve === null) return undefined;
    if (Array.isArray((curve as { Values?: unknown }).Values)) return 'values';
    if (Array.isArray((curve as { Segments?: unknown }).Segments)) return 'segments';
    return undefined;
}

function expandsTo(curve: unknown, values: readonly number[], domain: Domain): boolean {
    try {
        const expanded = expandCurve(curve as Curve, domain);
        return (
            expanded.length === values.length &&
            expanded.every((value, index) => value === values[index])
        );
    } catch {
        return false;
    }
}

/**
 * Converts a curve between stored formats. Switching is a format change, so a round trip must
 * not leave a pending change: `previous` (the form before the last switch) or the saved curve is
 * reused when it has the requested format and expands to exactly the same values.
 */
export function convertCurve(
    value: unknown,
    next: CurveMode,
    domain: Domain,
    candidates: readonly unknown[] = [],
): { curve: Curve } | { reason: string } {
    const values = expandCurve(value as Curve, domain);
    const reusable = candidates.find(
        (candidate) => modeOf(candidate) === next && expandsTo(candidate, values, domain),
    );
    if (reusable !== undefined) return { curve: reusable as Curve };
    if (next === 'values') return { curve: { Values: values } };
    return valuesToSegments(values, domain);
}
