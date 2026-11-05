import { describe, expect, it } from 'vitest';
import { structuredDiff } from './structuredDiff';

describe('structuredDiff', () => {
    it('lists only changed indices in curve values with old and new values', () => {
        expect(structuredDiff({ Values: [1, 2, 3] }, { Values: [1, 4, 3, 5] })).toEqual({
            kind: 'index',
            changes: [
                { label: 'Index 1', before: 2, after: 4 },
                { label: 'Index 3', before: undefined, after: 5 },
            ],
        });
    });

    it('lists changed segment properties with 1-based segment numbers', () => {
        expect(
            structuredDiff(
                {
                    Segments: [
                        { Type: 'Constant', From: 0, To: 70, Value: 1 },
                        { Type: 'Constant', From: 71, To: 100, Value: 2 },
                    ],
                },
                {
                    Segments: [
                        { Type: 'Constant', From: 0, To: 69, Value: 1 },
                        { Type: 'Constant', From: 71, To: 100, Value: 3 },
                    ],
                },
            ),
        ).toEqual({
            kind: 'segment',
            changes: [
                { label: 'Segment 1 · To', before: 70, after: 69 },
                { label: 'Segment 2 · Value', before: 2, after: 3 },
            ],
        });
    });

    it('lists linear point axes and whole segments when the type changes or one is added', () => {
        expect(
            structuredDiff(
                {
                    Segments: [
                        {
                            Type: 'Linear',
                            Points: [
                                [0, 1],
                                [10, 2],
                            ],
                        },
                        { Type: 'Constant', Value: 1 },
                    ],
                },
                {
                    Segments: [
                        {
                            Type: 'Linear',
                            Points: [
                                [0, 1],
                                [10, 5],
                                [20, 6],
                            ],
                        },
                        { Type: 'Expression', Expression: 'x' },
                        { Type: 'Constant', Value: 9 },
                    ],
                },
            )?.changes,
        ).toEqual([
            { label: 'Segment 1 · Point 1 y', before: 2, after: 5 },
            { label: 'Segment 1 · Point 2', before: undefined, after: [20, 6] },
            {
                label: 'Segment 2',
                before: { Type: 'Constant', Value: 1 },
                after: { Type: 'Expression', Expression: 'x' },
            },
            { label: 'Segment 3', before: undefined, after: { Type: 'Constant', Value: 9 } },
        ]);
    });

    it('summarizes a format conversion on one line in both directions', () => {
        const segments = { Segments: [{ Type: 'Linear', Points: [] }] };
        const arrow = String.fromCharCode(0x2192);
        expect(structuredDiff(segments, { Values: [1, 2, 3] })).toEqual({
            kind: 'index',
            formatChange: `Converted Segments ${arrow} Values (3 values)`,
            changes: [],
        });
        expect(structuredDiff({ Values: [1, 2, 3] }, segments)).toEqual({
            kind: 'segment',
            formatChange: `Converted Values ${arrow} Segments (1 segment)`,
            changes: [],
        });
    });

    it('pluralizes a single converted value and keeps rounding and domain changes', () => {
        const arrow = String.fromCharCode(0x2192);
        expect(
            structuredDiff({ Domain: [0, 2], Round: 1, Segments: [] }, { Round: 2, Values: [5] }),
        ).toEqual({
            kind: 'index',
            formatChange: `Converted Segments ${arrow} Values (1 value)`,
            changes: [
                { label: 'Round', before: 1, after: 2 },
                { label: 'Domain', before: [0, 2], after: undefined },
            ],
        });
    });

    it('handles inserted and removed entries', () => {
        expect(structuredDiff([1, 2], [1])).toEqual({
            kind: 'index',
            changes: [{ label: 'Index 1', before: 2, after: undefined }],
        });
    });

    it('includes rounding and domain changes even when segments stay unchanged', () => {
        expect(
            structuredDiff(
                { Round: 3, Domain: [0, 100], Segments: [] },
                { Round: 7, Domain: [101, 200], Segments: [] },
            )?.changes,
        ).toEqual([
            { label: 'Round', before: 3, after: 7 },
            { label: 'Domain', before: [0, 100], after: [101, 200] },
        ]);
    });

    it('does not treat ordinary objects as structured arrays', () => {
        expect(structuredDiff({ Name: 'old' }, { Name: 'new' })).toBeUndefined();
    });
});
