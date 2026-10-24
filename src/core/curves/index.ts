import { evaluateExpression, parseExpression } from './expression';
export * from './expression';

/** Inclusive integer stat values covered by a curve. */
export type Domain = readonly [number, number];

export type CurveSegment =
    | { Type: 'Constant'; From: number; To: number; Value: number }
    | { Type: 'Linear'; Points: [number, number][] }
    | { Type: 'Expression'; From: number; To: number; Expression: string };

export type Curve =
    { Values: number[] } | { Domain: Domain; Round?: number; Segments: CurveSegment[] };

export interface CurveIssue {
    message: string;
    x?: number;
}

const object = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const roundValue = (value: number, digits: number): number => Number(value.toFixed(digits));

function bounds(segment: CurveSegment): Domain {
    return segment.Type === 'Linear'
        ? [segment.Points[0]![0], segment.Points.at(-1)![0]]
        : [segment.From, segment.To];
}

export function checkCoverage(segments: readonly CurveSegment[], domain: Domain): CurveIssue[] {
    const errors: CurveIssue[] = [];
    for (let x = domain[0]; x <= domain[1]; x++) {
        const count = segments.filter((segment) => {
            const [from, to] = bounds(segment);
            return from <= x && x <= to;
        }).length;
        if (count !== 1) {
            errors.push({ x, message: (count === 0 ? 'Uncovered' : 'Overlapping') + ' x=' + x });
        }
    }
    return errors;
}

export function validateCurve(value: unknown, domain: Domain): CurveIssue[] {
    if (!object(value)) {
        return [{ message: 'Expected a curve object' }];
    }
    if ('Values' in value) {
        if (Object.keys(value).some((k) => k !== 'Values')) {
            return [{ message: 'Raw curve accepts only Values' }];
        }
        if (!Array.isArray(value.Values) || value.Values.length !== domain[1] - domain[0] + 1) {
            return [{ message: 'Values length must match domain [' + domain + ']' }];
        }
        return value.Values.flatMap((n, i) =>
            finite(n)
                ? []
                : [{ message: 'Expected finite number at x=' + (domain[0] + i), x: domain[0] + i }],
        );
    }
    const errors: CurveIssue[] = [];
    if (Object.keys(value).some((k) => !['Domain', 'Round', 'Segments'].includes(k))) {
        errors.push({ message: 'Unknown curve property' });
    }
    if (
        !Array.isArray(value.Domain) ||
        value.Domain.length !== 2 ||
        value.Domain[0] !== domain[0] ||
        value.Domain[1] !== domain[1]
    ) {
        errors.push({ message: 'Domain must equal [' + domain + ']' });
    }
    if (
        value.Round !== undefined &&
        (!Number.isInteger(value.Round) ||
            (value.Round as number) < 0 ||
            (value.Round as number) > 12)
    ) {
        errors.push({ message: 'Round must be an integer from 0 to 12' });
    }
    if (!Array.isArray(value.Segments) || value.Segments.length === 0) {
        return [...errors, { message: 'Expected at least one segment' }];
    }
    value.Segments.forEach((segment: unknown, i: number) => {
        const fail = (message: string) => errors.push({ message: 'Segment ' + i + ': ' + message });

        if (!object(segment)) {
            fail('Expected segment object');
            return;
        }
        let allowed: string[];
        switch (segment.Type) {
            case 'Linear':
                allowed = ['Type', 'Points'];
                break;
            case 'Constant':
                allowed = ['Type', 'From', 'To', 'Value'];
                break;
            default:
                allowed = ['Type', 'From', 'To', 'Expression'];
        }
        if (Object.keys(segment).some((k) => !allowed.includes(k))) {
            fail('Unknown segment property');
        }
        if (segment.Type === 'Linear') {
            if (!Array.isArray(segment.Points) || segment.Points.length < 2) {
                fail('Linear needs at least two points');
                return;
            }
            let previous = -Infinity;
            for (const point of segment.Points) {
                if (
                    !Array.isArray(point) ||
                    point.length !== 2 ||
                    !Number.isInteger(point[0]) ||
                    !finite(point[1]) ||
                    point[0] <= previous ||
                    point[0] < domain[0] ||
                    point[0] > domain[1]
                ) {
                    fail('Points must be [integer x, finite y], with ascending x inside domain');
                    return;
                }
                previous = point[0];
            }
        } else if (segment.Type === 'Constant' || segment.Type === 'Expression') {
            if (
                !Number.isInteger(segment.From) ||
                !Number.isInteger(segment.To) ||
                (segment.From as number) > (segment.To as number) ||
                (segment.From as number) < domain[0] ||
                (segment.To as number) > domain[1]
            ) {
                fail('Invalid integer segment bounds');
            }
            if (segment.Type === 'Constant' && !finite(segment.Value)) {
                fail('Expected finite constant');
            }
            if (segment.Type === 'Expression') {
                if (typeof segment.Expression !== 'string') {
                    fail('Expected expression string');
                } else {
                    try {
                        parseExpression(segment.Expression);
                    } catch (e) {
                        fail((e as Error).message);
                    }
                }
            }
        } else {
            fail('Unknown segment Type');
        }
    });
    if (errors.length) {
        return errors;
    }
    const curve = value as unknown as Extract<Curve, { Segments: CurveSegment[] }>;
    errors.push(...checkCoverage(curve.Segments, domain));
    if (!errors.length) {
        for (let x = domain[0]; x <= domain[1]; x++) {
            try {
                evaluateCurve(curve, x, domain);
            } catch (e) {
                errors.push({ x, message: (e as Error).message });
            }
        }
    }
    return errors;
}

export function evaluateCurve(curve: Curve, x: number, domain: Domain, defaultRound = 3): number {
    if (!Number.isInteger(x) || x < domain[0] || x > domain[1]) {
        throw new Error('x outside integer curve domain: ' + x);
    }
    if ('Values' in curve) {
        const value = curve.Values[x - domain[0]];
        if (value === undefined || !Number.isFinite(value)) {
            throw new Error('Missing finite curve value at x=' + x);
        }
        return value;
    }
    const matches = curve.Segments.filter((segment) => {
        const [a, b] = bounds(segment);
        return a <= x && x <= b;
    });
    if (matches.length !== 1) {
        throw new Error('Curve must cover x=' + x + ' exactly once');
    }
    const segment = matches[0]!;
    let result: number;
    if (segment.Type === 'Constant') {
        result = segment.Value;
    } else if (segment.Type === 'Expression') {
        result = evaluateExpression(segment.Expression, x);
    } else {
        const index = segment.Points.findIndex((p) => p[0] >= x);
        const nextPoint = segment.Points[index]!;
        if (nextPoint[0] === x) {
            result = nextPoint[1];
        } else {
            const previousPoint = segment.Points[index - 1]!;
            result =
                previousPoint[1] +
                ((nextPoint[1] - previousPoint[1]) * (x - previousPoint[0])) /
                    (nextPoint[0] - previousPoint[0]);
        }
    }
    if (!Number.isFinite(result)) {
        throw new Error('Non-finite curve value at x=' + x);
    }
    return roundValue(result, curve.Round ?? defaultRound);
}

export function expandCurve(curve: Curve, domain: Domain, defaultRound = 3): number[] {
    const errors = validateCurve(curve, domain);
    if (errors.length) {
        throw new Error(errors.map((e) => e.message).join('; '));
    }
    return Array.from({ length: domain[1] - domain[0] + 1 }, (_, i) =>
        evaluateCurve(curve, domain[0] + i, domain, defaultRound),
    );
}
