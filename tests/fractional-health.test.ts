import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    exportSources,
    generateSchema,
    classSpec,
    movementClassSpec,
    parseStatSource,
    serializeSource,
    healthSpec,
    validateField,
    validateSources,
} from '../src/core';
import { validateExport, validateProject } from '../src/cli/io';
import { FieldInput } from '../src/editor/components/FieldInput';
import { fixture } from './fixtures';

const field = (key: string) => {
    const result = healthSpec.fields.find((candidate) => candidate.key === key);
    if (!result) throw new Error(`Missing Health field ${key}`);
    return result;
};

describe('fractional HP values', () => {
    it('renders direct HP inputs as unrestricted decimal number inputs', () => {
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec: field('PVPHealthHP'),
                value: 100.25,
                siblings: {},
                file: 'health.json',
                path: 'Health',
                onChange: () => {},
            }),
        );

        expect(html).toContain('type="number"');
        expect(html).toContain('step="any"');
        expect(html).toContain('min="0"');
        expect(html).toContain('value="100.25"');
    });

    it('renders Orb restore values with decimal input and increments', () => {
        const html = renderToStaticMarkup(
            createElement(FieldInput, {
                spec: field('OrbOfPowerHealthRestore'),
                value: {
                    Domain: [0, 100],
                    Round: 3,
                    Segments: [{ Type: 'Constant', From: 0, To: 100, Value: 1.25 }],
                },
                siblings: {},
                file: 'health.json',
                path: 'Health',
                onChange: () => {},
            }),
        );

        expect(html).toContain('type="number"');
        expect(html).toContain('step="any"');
        expect(html).toContain('min="0"');
        expect(html).toContain('value="1.25"');
        expect(html).toContain('Increase OrbOfPowerHealthRestore segment 1 Value by 0.01');
    });

    it('validates, serializes and exports fractional Health and Shield HP values', () => {
        const sources = fixture();
        const health = sources.stats.find((stat) => stat.Name === 'Health')!;
        health.Fields.PVPHealthHP = 100.25;
        health.Fields.PVEHealthHP = 70.125;
        health.Fields.BaseShieldHP = 130.5;
        health.Fields.PVEBonusShieldHP = {
            Domain: [100, 200],
            Segments: [{ Type: 'Constant', From: 100, To: 200, Value: 2.375 }],
        };

        expect(validateSources(sources).filter((issue) => issue.severity === 'error')).toEqual([]);

        const serialized = serializeSource(health);
        const parsed = parseStatSource(serialized);
        expect(parsed.issues).toEqual([]);
        const parsedHealth = parsed.value as { Fields: Record<string, unknown> };
        expect(parsedHealth.Fields).toMatchObject({
            PVPHealthHP: 100.25,
            PVEHealthHP: 70.125,
            BaseShieldHP: 130.5,
            PVEBonusShieldHP: { Segments: [{ Value: 2.375 }] },
        });

        const exported = exportSources(sources);
        const exportedHealth = exported['392767087'] as Record<string, unknown>;
        expect(exportedHealth).toMatchObject({
            PVPHealthHP: 100.25,
            PVEHealthHP: 70.125,
            BaseShieldHP: 130.5,
            PVEBonusShieldHP: Array(101).fill(2.375),
        });
        expect(validateExport(exported, generateSchema())).toEqual([]);
    });

    it('validates, serializes, and exports fractional Orb restoration values', () => {
        const sources = fixture();
        const health = sources.stats.find((stat) => stat.Name === 'Health')!;
        health.Fields.OrbOfPowerHealthRestore = {
            Domain: [0, 100],
            Round: 3,
            Segments: [{ Type: 'Constant', From: 0, To: 100, Value: 1.25 }],
        };

        expect(validateSources(sources).filter((issue) => issue.severity === 'error')).toEqual([]);

        const parsed = parseStatSource(serializeSource(health));
        expect(parsed.issues).toEqual([]);
        const parsedHealth = parsed.value as { Fields: Record<string, unknown> };
        expect(parsedHealth.Fields.OrbOfPowerHealthRestore).toMatchObject({
            Round: 3,
            Segments: [{ Value: 1.25 }],
        });

        const exported = exportSources(sources);
        const exportedHealth = exported['392767087'] as Record<string, unknown>;
        expect(exportedHealth.OrbOfPowerHealthRestore).toEqual(Array(101).fill(1.25));
        expect(validateExport(exported, generateSchema())).toEqual([]);
    });

    it('evaluates authored fractional Orb restoration and bonus Shield HP', async () => {
        const project = await validateProject();
        expect(project.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
        const health = project.data?.['392767087'] as Record<string, unknown> | undefined;
        if (!health) throw new Error('Missing exported Health data');
        const orbValues = health.OrbOfPowerHealthRestore as number[];
        expect(orbValues[0]).toBe(0);
        expect(orbValues[1]).toBe(0.7);
        expect(orbValues[50]).toBe(35);
        expect(orbValues[100]).toBe(70);

        const values = health.PVEBonusShieldHP as number[];
        expect(values[0]).toBe(0);
        expect(values[1]).toBe(0.3);
        expect(values[50]).toBe(15);
        expect(values[51]).toBe(15.1);
    });

    it('keeps nonnegative bounds and unrelated integer-only field validation', () => {
        for (const spec of [
            field('PVPHealthHP'),
            field('PVEHealthHP'),
            field('BaseShieldHP'),
            field('OrbOfPowerHealthRestore'),
            field('PVEBonusShieldHP'),
        ]) {
            expect(spec.min ?? spec.items?.min).toBe(0);
        }
        expect(validateField(field('PVPHealthHP'), -0.25).map((issue) => issue.message)).toContain(
            'Must be >= 0',
        );
        expect(
            validateField(field('PVEBonusShieldHP'), {
                Domain: [100, 200],
                Segments: [{ Type: 'Constant', From: 100, To: 200, Value: -0.25 }],
            }).map((issue) => issue.message),
        ).toContain('Must be >= 0');
        expect(
            validateField(field('OrbOfPowerHealthRestore'), {
                Domain: [0, 100],
                Segments: [{ Type: 'Constant', From: 0, To: 100, Value: 1.25 }],
            }),
        ).toEqual([]);
        expect(
            validateField(field('OrbOfPowerHealthRestore'), {
                Domain: [0, 100],
                Segments: [{ Type: 'Constant', From: 0, To: 100, Value: -0.25 }],
            }).map((issue) => issue.message),
        ).toContain('Must be >= 0');
        expect(
            validateField(
                classSpec.fields.find((candidate) => candidate.key === 'PVEOvershieldHP')!,
                {
                    Domain: [100, 200],
                    Segments: [{ Type: 'Constant', From: 100, To: 200, Value: 1.25 }],
                },
            ),
        ).toEqual([]);
        expect(
            validateField(
                movementClassSpec.fields.find((candidate) => candidate.key === 'BaseMobilityTier')!,
                2.5,
            ).map((issue) => issue.message),
        ).toContain('Please provide a safe integer');

        const definitions = generateSchema().definitions as Record<
            string,
            {
                properties: Record<
                    string,
                    { type?: string; minimum?: number; items?: { type?: string } }
                >;
            }
        >;
        const health = definitions.Health!.properties;
        expect(health.PVPHealthHP).toMatchObject({ type: 'number', minimum: 0 });
        expect(health.PVEHealthHP).toMatchObject({ type: 'number', minimum: 0 });
        expect(health.BaseShieldHP).toMatchObject({ type: 'number', minimum: 0 });
        expect(health.OrbOfPowerHealthRestore?.items).toMatchObject({ type: 'number', minimum: 0 });
        expect(health.PVEBonusShieldHP?.items).toMatchObject({ type: 'number', minimum: 0 });
        expect(definitions.Class?.properties.PVEOvershieldHP?.items).toMatchObject({
            type: 'number',
            minimum: 0,
        });
        expect(field('PVPHealthHP').precision).toBe(3);
        expect(field('PVEBonusShieldHP').precision).toBe(3);
        expect(
            movementClassSpec.fields.find((candidate) => candidate.key === 'BaseMobilityTier')
                ?.kind,
        ).toBe('int');
    });
});
