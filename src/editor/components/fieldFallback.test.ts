import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import movementData from '../../../sources/movement.json';
import {
    movementSpec,
    movementSourceSpec,
    movementEffectSpec,
    movementSpeed,
    type MovementSource,
} from '../../core';
import { formatMovementSpeed } from './previewData';
import { FieldInput } from './FieldInput';

describe('new declarative field fallback', () => {
    it('formats editor speed previews to two decimal places without rounding the core result', () => {
        const source = structuredClone(movementData) as unknown as MovementSource;
        source.Classes[0]!.BaseMobilityTier = 8;
        const result = movementSpeed(
            {
                classHash: 3655393761,
                activity: 'PVE',
                direction: 'Forward',
                posture: 'Standing',
                ads: true,
                sources: [{ hash: 1458010786 }, { hash: 14 }],
                heldWeaponSources: [14],
            },
            source,
        );
        expect(result.speed).toBeCloseTo(6.39625, 12);
        expect(formatMovementSpeed(result.speed)).toBe('6.40');
        source.Classes[0]!.BaseMobilityTier = 5;
        const strafe = movementSpeed(
            {
                classHash: 3655393761,
                activity: 'PVE',
                direction: 'Strafe',
                posture: 'Standing',
                ads: true,
                sources: [],
            },
            source,
        );
        expect(formatMovementSpeed(strafe.speed)).toBe('3.83');
        expect(formatMovementSpeed(9)).toBe('9.00');
        expect(result.speed).toBeCloseTo(6.39625, 12);
    });
    it('renders Rules without a manifest or editor context and marks JumpHeight unpublished', () => {
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec: movementSpec.fields[0]!,
                value: movementData.Rules,
                saved: movementData.Rules,
                siblings: movementData,
                file: 'sources/movement.json',
                path: 'Rules',
                onChange() {},
            }),
        );
        expect(html).toContain('JumpHeight');
        expect(html).toContain('Unpublished');
        expect(html).toContain('coming in step 2');
        expect(html).not.toContain('type="number"');
    });
    it.each([
        {
            spec: movementSourceSpec.fields.find((field) => field.key === 'Effects')!,
            value: movementData.Sources[0]!.Effects,
        },
        {
            spec: movementEffectSpec.fields.find((field) => field.key === 'Type')!,
            value: 'MobilityTiers',
        },
    ])('renders $spec.kind as a safe read-only preview', ({ spec, value }) => {
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec,
                value,
                saved: value,
                siblings: {},
                file: 'sources/movement.json',
                path: spec.key,
                onChange() {},
            }),
        );
        expect(html).toContain('Read-only preview');
        expect(html).toContain('MobilityTiers');
        expect(html).not.toContain('type="number"');
    });
});
