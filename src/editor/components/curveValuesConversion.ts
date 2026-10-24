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
