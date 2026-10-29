import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { movementEffectSpec, type MovementEffectType } from '../../core';
import { FieldInput } from './FieldInput';
import { boundedStepNumericValue } from './NumberInput';

function renderEffectValues(
    key: 'Values' | 'BoostedValues',
    type: MovementEffectType,
    values: number[],
): { html: string; changes: unknown[] } {
    const spec = movementEffectSpec.fields.find((field) => field.key === key);
    if (!spec) throw new Error(`Missing movement effect field ${key}`);
    const changes: unknown[] = [];
    const html = renderToStaticMarkup(
        createElement(FieldInput, {
            spec,
            value: values,
            siblings: { Type: type },
            file: 'sources/movement.json',
            path: `Effects.0.${key}`,
            onChange: (value) => changes.push(value),
        }),
    );
    return { html, changes };
}

describe('movement effect numeric stepping', () => {
    it.each([
        ['Values', 'Values'],
        ['BoostedValues', 'Boosted values'],
    ] as const)(
        'uses whole-tier increments for %s only when the effect is MobilityTiers',
        (key, label) => {
            const tiers = renderEffectValues(key, 'MobilityTiers', [2.5]);
            expect(tiers.html).toContain(`aria-label="Increase ${label} stacks 1 by 1"`);
            expect(tiers.html).toContain('value="2.5"');
            expect(tiers.changes).toEqual([]);
            expect(boundedStepNumericValue(2.5, 1, 1)).toBe('3.5');

            const multiplier = renderEffectValues(key, 'ForwardMultiplier', [0.875]);
            expect(multiplier.html).toContain(`aria-label="Increase ${label} stacks 1 by 0.01"`);
            expect(multiplier.html).toContain('value="0.875"');
            expect(multiplier.changes).toEqual([]);
            expect(boundedStepNumericValue(0.875, 0.01, 1)).toBe('0.885');
        },
    );
});
