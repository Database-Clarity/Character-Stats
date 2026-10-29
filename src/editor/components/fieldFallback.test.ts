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
import { MovementContext } from './MovementContext';

describe('declarative nested field controls', () => {
    it('previews validated working data and blocks invalid movement instead of showing a fallback', () => {
        const html = renderToStaticMarkup(createElement(MovementContext, { value: movementData }));
        expect(html).toContain('7.00 m/s');
        expect(html).toContain('Cap: ');
        expect(html).toContain('Preview class');
        for (const key of ['mobility', 'sprint', 'walk', 'strafe', 'crouch', 'ads'])
            expect(html).toContain(`data-stat-key="${key}"`);
        expect(html).toContain('global-only baseline');
        expect(html).not.toContain('aria-label="Direction"');
        expect(html).not.toContain('aria-label="Posture"');
        const invalid = { ...movementData, Rules: { ...movementData.Rules, StrafeMultiplier: -1 } };
        const error = renderToStaticMarkup(createElement(MovementContext, { value: invalid }));
        expect(error).toContain('Fix Movement validation errors');
        expect(error).not.toContain('5.60');
    });
    it('shows a compact cap label without changing the stat value', () => {
        const capped = {
            ...movementData,
            Rules: { ...movementData.Rules, ForwardSpeedCap: 7 },
        };
        const html = renderToStaticMarkup(createElement(MovementContext, { value: capped }));
        expect(html).toContain('7.00 m/s');
        expect(html).toContain('title="ForwardSpeedCap"');
        expect(html).toContain('Cap: Forward');
        expect(html).toContain('Cap: none');
    });
    it('formats editor speed previews to two decimal places without rounding the core result', () => {
        const source = structuredClone(movementData) as unknown as MovementSource;
        source.Classes.find((entry) => entry.ClassHash === 3655393761)!.BaseMobilityTier = 8;
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
        expect(result.speed).toBeCloseTo(6.321875, 12);
        expect(formatMovementSpeed(result.speed)).toBe('6.32');
        source.Classes.find((entry) => entry.ClassHash === 3655393761)!.BaseMobilityTier = 5;
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
        expect(result.speed).toBeCloseTo(6.321875, 12);
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
        expect(html).toContain('Kept in sources but not exported.');
        expect(html).toContain('type="number"');
        expect(html).toContain('data-field="Rules.WalkSpeed"');
        expect(html).not.toContain('Read-only preview');
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
    ])('renders $spec.kind as structured editable controls', ({ spec, value }) => {
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
        expect(html).not.toContain('Read-only preview');
        expect(html).toContain('MobilityTiers');
        expect(html).toContain('<select');
        if (spec.kind === 'objectArray') {
            expect(html).toContain('Values stacks 1');
            expect(html).toContain('Move Effects row 1 down');
            expect(html).toContain('data-field="Effects.0.Values"');
        }
    });
    it('displays nested validation paths and enum descriptions', () => {
        const spec = movementSourceSpec.fields.find((field) => field.key === 'Effects')!;
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec,
                value: [{ Type: 'Invalid', Values: [] }],
                saved: [],
                siblings: {},
                file: 'sources/movement.json',
                path: 'Effects',
                onChange() {},
            }),
        );
        expect(html).toContain('Effects[0].Type');
        expect(html).toContain('Add hidden Mobility tiers');
        expect(html).toContain('aria-invalid="true"');
    });
});
