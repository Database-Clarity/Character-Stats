import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { boundedStepNumericValue, NumberInput, stepNumericValue } from './NumberInput';

describe('NumberInput', () => {
    it('steps by the supplied decimal amount without rounding the current value', () => {
        expect(stepNumericValue(0.855, 0.01, 1)).toBe('0.865');
        expect(stepNumericValue(82.123, 0.01, 1)).toBe('82.133');
        expect(stepNumericValue(82.12345678901234, 0.01, 1)).toBe('82.13345678901234');
        expect(stepNumericValue(0.855, 0.01, -1)).toBe('0.845');
    });

    it('respects inclusive and exclusive bounds without discarding manual precision', () => {
        expect(boundedStepNumericValue(0.855, 0.01, 1, { max: 0.875 })).toBe('0.865');
        expect(boundedStepNumericValue(0.855, 0.01, -1, { min: 0.85 })).toBe('0.855');
        expect(boundedStepNumericValue(0.01, 0.01, -1, { exclusiveMin: 0 })).toBe('0.01');
        expect(boundedStepNumericValue(0.99, 0.01, 1, { exclusiveMax: 1 })).toBe('0.99');
        expect(boundedStepNumericValue(-2.855, 1, 1, { min: 0 })).toBe('-1.855');
        expect(boundedStepNumericValue('0.1234567890123456789', 0.01, 1)).toBe(
            '0.1334567890123456789',
        );
    });

    it('leaves browser step validation unrestricted for manually precise values', () => {
        const html = renderToStaticMarkup(
            createElement(NumberInput, {
                'aria-label': 'Cooldown',
                step: 0.01,
                value: 0.855,
                constraints: { min: 0, max: 1 },
                onChangeValue: () => {},
            }),
        );
        expect(html).toContain('step="any"');
        expect(html).toContain('value="0.855"');
        expect(html).toContain('min="0"');
        expect(html).toContain('max="1"');
        expect(html).toContain('Increase Cooldown by 0.01');
    });
});
