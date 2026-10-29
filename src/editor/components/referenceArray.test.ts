import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldInput } from './FieldInput';
import { movementSourceSpec, type FieldSpec } from '../../core';

describe('plain manifest reference arrays', () => {
    it.each(['BoostRequiresAll', 'AlsoMatches'])(
        'renders %s as removable reference chips, not numeric-array rows',
        (key) => {
            const spec: FieldSpec = {
                key,
                kind: 'intArray',
                description: 'Manifest refs',
                itemRef: 'item',
                ...(key === 'AlsoMatches' ? { uniqueItems: true } : {}),
            };
            const html = renderToStaticMarkup(
                createElement(FieldInput, {
                    spec,
                    value: [0, 123],
                    saved: [0, 123],
                    siblings: {},
                    file: 'test',
                    path: key,
                    onChange: () => {},
                }),
            );
            expect(html).toContain('reference-chip');
            expect(html).toContain('Add reference');
            expect(html).toContain(`Remove ${key} reference 1`);
            expect(html).toContain('Unset (0)');
            expect(html).not.toContain('wildcard');
            expect(html).not.toContain('Subclass:');
            expect(html).not.toContain('Add value');
        },
    );
    it('reports repeated movement aliases and preserves both chips for correction', () => {
        const spec = movementSourceSpec.fields.find((field) => field.key === 'AlsoMatches')!;
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec,
                value: [123, 123],
                saved: [123, 123],
                siblings: {},
                file: 'sources/movement.json',
                path: 'Sources.0.AlsoMatches',
                onChange: () => {},
            }),
        );

        expect(html).toContain('Duplicate value: 123');
        expect(html.match(/class="reference-chip"/g)).toHaveLength(2);
    });
});
