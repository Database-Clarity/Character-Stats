import { describe, expect, it } from 'vitest';
import type { CurveSegment } from '../../core';
import { changedSegmentKeys, changedValueIndices } from './curveChanges';

const keys = (saved: unknown, segment: CurveSegment) => [...changedSegmentKeys(saved, segment)];

describe('changedSegmentKeys', () => {
    const constant: CurveSegment = { Type: 'Constant', From: 0, To: 10, Value: 5 };
    const expression: CurveSegment = { Type: 'Expression', From: 0, To: 10, Expression: 'x' };

    it('is empty for an unchanged segment', () => {
        expect(keys({ ...constant }, constant)).toEqual([]);
    });

    it('lists only the changed Constant inputs', () => {
        expect(keys({ ...constant, To: 9 }, constant)).toEqual(['To']);
        expect(keys({ ...constant, Value: 1 }, constant)).toEqual(['Value']);
    });

    it('marks every input of a new or retyped segment', () => {
        expect(keys(undefined, constant)).toEqual(['From', 'To', 'Value']);
        expect(keys(expression, constant)).toEqual(['From', 'To', 'Value']);
        expect(keys(undefined, expression)).toEqual(['From', 'To', 'Expression']);
    });

    it('lists changed Linear point axes and treats added points as fully changed', () => {
        const linear: CurveSegment = {
            Type: 'Linear',
            Points: [
                [0, 1],
                [10, 5],
                [20, 6],
            ],
        };
        const saved = {
            Type: 'Linear',
            Points: [
                [0, 1],
                [10, 2],
            ],
        };
        expect(keys(saved, linear)).toEqual(['Points.1.y', 'Points.2.x', 'Points.2.y']);
        expect(keys(constant, linear)).toHaveLength(6);
    });
});

describe('changedValueIndices', () => {
    it('lists indices that differ from the saved Values', () => {
        expect([...changedValueIndices({ Values: [1, 2, 3] }, [1, 4, 3, 5])]).toEqual([1, 3]);
    });

    it('marks every index when the saved form is not Values', () => {
        expect([...changedValueIndices({ Segments: [] }, [1, 2])]).toEqual([0, 1]);
        expect([...changedValueIndices(undefined, [7])]).toEqual([0]);
    });

    it('is empty when nothing changed', () => {
        expect(changedValueIndices({ Values: [1, 2] }, [1, 2]).size).toBe(0);
    });
});
