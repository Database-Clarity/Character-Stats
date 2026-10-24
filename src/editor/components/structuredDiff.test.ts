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

    it('lists changed curve segments by segment index', () => {
        expect(
            structuredDiff(
                {
                    Segments: [
                        { Type: 'Constant', Value: 1 },
                        { Type: 'Linear', Value: 2 },
                    ],
                },
                {
                    Segments: [
                        { Type: 'Constant', Value: 1 },
                        { Type: 'Linear', Value: 3 },
                    ],
                },
            ),
        ).toEqual({
            kind: 'segment',
            changes: [
                {
                    label: 'Segment 1',
                    before: { Type: 'Linear', Value: 2 },
                    after: { Type: 'Linear', Value: 3 },
                },
            ],
        });
    });

    it('handles inserted and removed entries and reports curve mode changes', () => {
        expect(structuredDiff([1, 2], [1])).toEqual({
            kind: 'index',
            changes: [{ label: 'Index 1', before: 2, after: undefined }],
        });
        expect(structuredDiff({ Values: [1] }, { Segments: [{ Value: 1 }] })).toEqual({
            kind: 'segment',
            formatChange: `Values ${String.fromCharCode(0x2192)} Segments`,
            changes: [{ label: 'Segment 0', before: 1, after: { Value: 1 } }],
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
