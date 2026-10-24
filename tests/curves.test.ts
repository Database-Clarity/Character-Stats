import { describe, it, expect } from 'vitest';
import {
    parseExpression,
    evaluateExpression,
    ExpressionError,
    validateCurve,
    checkCoverage,
    evaluateCurve,
    expandCurve,
    type Curve,
} from '../src/core';
describe('safe expression language', () => {
    it.each([
        ['2+3*4', 0, 14],
        ['2^3^2', 0, 512],
        ['-2^2', 0, -4],
        ['2^-2', 0, 0.25],
        ['(2+3)*4', 0, 20],
        ['.5 + 1e-2*x', 5, 0.55],
        ['min(3,max(1,x))', 5, 3],
        ['clamp(x,0,2)', 5, 2],
        ['sqrt(9)+abs(-2)+floor(1.9)+ceil(1.1)+round(1.6)', 0, 10],
        ['pow(2,3)+log(100)+ln(e)+exp(0)', 0, 12],
        ['pi', 0, Math.PI],
    ])('evaluates %s', (text, x, result) =>
        expect(evaluateExpression(text, x)).toBeCloseTo(result),
    );
    it.each([
        'foo',
        'constructor(1)',
        'Math.random()',
        'process.exit()',
        'x=1',
        'x[0]',
        '2;3',
        '2x',
        'sin(x)',
        'min()',
        'pow(2)',
        'clamp(1,2)',
        '(1+2',
        '1+',
        '1e999',
    ])('rejects %s with column positions', (text) => {
        expect(() => parseExpression(text)).toThrow(/column \d+/);
    });
    it('provides a zero-based position and bounds nesting', () => {
        try {
            parseExpression('1 + nope');
        } catch (e) {
            expect(e).toBeInstanceOf(ExpressionError);
            expect((e as ExpressionError).position).toBe(4);
        }
        expect(() => parseExpression('('.repeat(200) + '1' + ')'.repeat(200))).toThrow(
            'nesting limit',
        );
        expect(() => evaluateExpression('1/0', 0)).toThrow('non-finite');
        expect(() => evaluateExpression('sqrt(-1)', 0)).toThrow('non-finite');
    });
});
describe('piecewise curves', () => {
    const curve: Curve = {
        Domain: [0, 5],
        Round: 2,
        Segments: [
            { Type: 'Constant', From: 0, To: 1, Value: 1.1234 },
            {
                Type: 'Linear',
                Points: [
                    [2, 2],
                    [3, 4],
                ],
            },
            { Type: 'Expression', From: 4, To: 5, Expression: 'x/3' },
        ],
    };
    it('evaluates constants, linear interpolation and expressions with rounding', () => {
        expect(expandCurve(curve, [0, 5])).toEqual([1.12, 1.12, 2, 4, 1.33, 1.67]);
        expect(
            evaluateCurve(
                {
                    Domain: [0, 4],
                    Segments: [
                        {
                            Type: 'Linear',
                            Points: [
                                [0, 0],
                                [4, 10],
                            ],
                        },
                    ],
                },
                2,
                [0, 4],
            ),
        ).toBe(5);
        expect(expandCurve({ Values: [4, 5] }, [101, 102])).toEqual([4, 5]);
        expect(() => evaluateCurve(curve, 6, [0, 5])).toThrow('outside');
    });
    it('reports exact gaps and overlaps on integer x values', () => {
        expect(
            checkCoverage(
                [
                    { Type: 'Constant', From: 0, To: 1, Value: 1 },
                    { Type: 'Constant', From: 1, To: 2, Value: 1 },
                ],
                [0, 3],
            ),
        ).toEqual([
            { x: 1, message: 'Overlapping x=1' },
            { x: 3, message: 'Uncovered x=3' },
        ]);
        expect(
            validateCurve(
                { Domain: [0, 3], Segments: [{ Type: 'Constant', From: 0, To: 2, Value: 1 }] },
                [0, 3],
            ),
        ).toEqual([{ x: 3, message: 'Uncovered x=3' }]);
    });
    it.each([
        null,
        [],
        { Values: [1] },
        { Values: [1, Infinity] },
        { Values: [1, 2], Segments: [] },
        { Domain: [1, 2], Segments: [] },
        { Domain: [0, 1], Round: -1, Segments: [] },
        { Domain: [0, 1], Segments: [{ Type: 'Constant', From: 0.5, To: 1, Value: 1 }] },
        {
            Domain: [0, 1],
            Segments: [
                {
                    Type: 'Linear',
                    Points: [
                        [1, 1],
                        [0, 0],
                    ],
                },
            ],
        },
        { Domain: [0, 1], Segments: [{ Type: 'Expression', From: 0, To: 1, Expression: '1/0' }] },
        { Domain: [0, 1], Segments: [{ Type: 'Expression', From: 0, To: 1, Expression: 'bad' }] },
        { Domain: [0, 1], Segments: [{ Type: 'Unknown' }] },
    ])('returns structured errors for invalid input %#', (value) =>
        expect(validateCurve(value, [0, 1]).length).toBeGreaterThan(0),
    );
});
