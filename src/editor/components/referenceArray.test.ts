import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldInput } from './FieldInput';
import type { FieldSpec } from '../../core';

describe('plain manifest reference arrays', () => {
    it.each(['BoostRequiresAll', 'AlsoMatches'])(
        'renders %s as removable reference chips, not numeric-array rows',
        (key) => {
            const spec: FieldSpec = {
                key,
                kind: 'intArray',
                description: 'Manifest refs',
                itemRef: 'item',
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
});
