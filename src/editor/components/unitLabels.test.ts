import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CurveEditor } from './CurveEditor';
import { FieldInput } from './FieldInput';

describe('numeric input unit labels', () => {
    it('uses descriptive scalar labels for numeric array entries', () => {
        const spec = {
            key: 'EnergyGainScalar',
            kind: 'numberArray' as const,
            description: 'Scalar energy gain.',
            label: 'Energy gain scalar',
            required: true,
        };
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec,
                value: [1],
                saved: [1],
                siblings: {},
                file: 'sources/stats/grenade.json',
                path: 'Abilities.0.EnergyGainScalar',
                onChange() {},
            }),
        );

        expect(html).toContain('aria-label="Energy gain scalar index 0"');
        expect(html).toContain('aria-label="Increase Energy gain scalar index 0 by 1"');
    });

    it('uses descriptive percentage labels for curve values', () => {
        const spec = {
            key: 'DamageIncrease',
            kind: 'curve' as const,
            description: 'Damage increase percentage.',
            domain: [0, 0] as const,
            label: 'Damage increase (%)',
        };
        const html = renderToStaticMarkup(
            createElement(CurveEditor, {
                spec,
                value: { Values: [12.5] },
                saved: { Values: [12.5] },
                file: 'sources/stats/weapons.json',
                path: 'Fields.DamageIncrease',
                onChange() {},
            }),
        );

        expect(html).toContain('aria-label="Damage increase (%) value 0"');
    });

    it('keeps percentage units in segment value labels', () => {
        const spec = {
            key: 'DamageIncrease',
            kind: 'curve' as const,
            description: 'Damage increase percentage.',
            domain: [0, 0] as const,
            label: 'Damage increase (%)',
        };
        const html = renderToStaticMarkup(
            createElement(CurveEditor, {
                spec,
                value: {
                    Segments: [{ Type: 'Constant' as const, From: 0, To: 0, Value: 12.5 }],
                },
                saved: {
                    Segments: [{ Type: 'Constant' as const, From: 0, To: 0, Value: 12.5 }],
                },
                file: 'sources/stats/weapons.json',
                path: 'Fields.DamageIncrease',
                onChange() {},
            }),
        );

        expect(html).toContain('aria-label="Damage increase (%) rounding digits"');
        expect(html).toContain('aria-label="Damage increase (%) segment 1 Value"');
        expect(html).toContain('aria-label="Increase Damage increase (%) segment 1 Value by');
    });
});
