import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ENHANCED_STAT_DOMAIN,
    expandCurve,
    generateSchema,
    classSpec,
    grenadeSpec,
    healthSpec,
    meleeSpec,
    renderTooltip,
    resolveLocale,
    statRegistry,
    type Curve,
    type LocaleData,
    type StatSource,
} from '../src/core';
import { readJson, validateProject } from '../src/cli/io';
import { CurveEditor } from '../src/editor/components/CurveEditor';

describe('enhanced stat curve domains', () => {
    it('uses the 100-200 domain and preserves the 101-200 values in preview and export', async () => {
        const project = await validateProject();
        expect(project.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
        if (!project.sources || !project.data) throw new Error('Project did not validate');

        const enhancedFields = statRegistry.flatMap((stat) =>
            stat.fields
                .filter(
                    (field) =>
                        field.kind === 'curve' &&
                        field.domain?.[0] === ENHANCED_STAT_DOMAIN[0] &&
                        field.domain[1] === ENHANCED_STAT_DOMAIN[1],
                )
                .map((field) => ({ stat, field })),
        );
        expect(enhancedFields.map(({ stat, field }) => `${stat.name}.${field.key}`).sort()).toEqual(
            [
                'Class.PVEClassAbilityDamageIncrease',
                'Class.PVEOvershieldHP',
                'Class.PVPClassAbilityDamageIncrease',
                'Class.PVPOvershieldHP',
                'Grenade.PVEGrenadeDamageIncrease',
                'Grenade.PVPGrenadeDamageIncrease',
                'Health.PVEBonusShieldHP',
                'Health.ShieldRechargeDelay',
                'Health.ShieldRechargeSpeed',
                'Melee.PVEMeleeDamageIncrease',
                'Melee.PVPMeleeDamageIncrease',
                'Super.SuperDamageIncrease',
                'Super.SuperDurationIncrease',
                'Weapons.LargeAmmoBrickChance',
                'Weapons.PVPDamageIncrease',
                'Weapons.PowerDamageIncrease',
                'Weapons.SpecialDamageIncrease',
            ].sort(),
        );

        const definitions = generateSchema().definitions as Record<
            string,
            {
                properties: Record<
                    string,
                    { minItems?: number; maxItems?: number; description?: string }
                >;
            }
        >;

        for (const { stat, field } of enhancedFields) {
            const source = project.sources.stats.find((entry) => entry.Name === stat.name);
            if (!source) throw new Error(`Missing ${stat.name} source`);
            const curve = source.Fields[field.key] as Curve;
            const exportedStat = project.data[String(stat.hash)] as Record<string, unknown>;
            const exportedCurve = exportedStat[field.key] as number[];
            expect(field.domain).toEqual([100, 200]);
            expect('Domain' in curve ? curve.Domain : undefined).toEqual([100, 200]);
            expect(expandCurve(curve, field.domain!)).toEqual(exportedCurve);
            expect(exportedCurve).toHaveLength(101);
            expect(definitions[stat.name]!.properties[field.key]).toMatchObject({
                minItems: 101,
                maxItems: 101,
            });
            expect(definitions[stat.name]!.properties[field.key]!.description).toContain(
                'Stat values 100-200: index = stat value - 100.',
            );
        }
    });

    it('uses measured PvE/PvP Class curves in source, placeholders, editor schema, and export', async () => {
        const project = await validateProject();
        if (!project.sources || !project.data) throw new Error('Project did not validate');
        const classSource = project.sources.stats.find((entry) => entry.Name === 'Class') as
            StatSource | undefined;
        if (!classSource) throw new Error('Missing Class source');
        const exported = project.data[String(classSpec.hash)] as Record<string, unknown>;
        const locale = (await readJson('locale/en.json')) as LocaleData;
        const tooltip = resolveLocale(locale, 'Class.EnhancedStatTooltip');
        if (!tooltip) throw new Error('Missing Class enhanced tooltip');

        const checkpoints = [100, 150, 200];
        const expected = {
            PVEOvershieldHP: [0, 20, 40],
            PVPOvershieldHP: [0, 5, 10],
            PVEClassAbilityDamageIncrease: [0, 32.5, 65],
            PVPClassAbilityDamageIncrease: [0, 5, 10],
        } as const;
        for (const [key, values] of Object.entries(expected)) {
            const curve = classSource.Fields[key] as Curve;
            const exportedValues = exported[key] as number[];
            expect(exportedValues).toHaveLength(101);
            expect(checkpoints.map((statValue) => exportedValues[statValue - 100])).toEqual(values);
            expect(
                checkpoints.map((statValue) =>
                    renderTooltip(`{{${key}}}`, classSource, classSpec, statValue),
                ),
            ).toEqual(values.map(String));
            const field = classSpec.fields.find((entry) => entry.key === key)!;
            const html = renderToStaticMarkup(
                createElement(CurveEditor, {
                    spec: field,
                    value: curve,
                    saved: curve,
                    file: 'sources/stats/class.json',
                    path: `Fields.${key}`,
                    onChange() {},
                }),
            );
            expect(html).toContain('100–200');
        }

        expect(classSource.Fields.PVPOvershieldDamageResistance).toBe(50);
        expect(exported.PVPOvershieldDamageResistance).toBe(50);
        expect(exported).not.toHaveProperty('PVEOvershieldDamageResistance');
        expect(
            checkpoints.map((statValue) =>
                renderTooltip(tooltip, classSource, classSpec, statValue, { Cooldown: 1 }),
            ),
        ).toEqual([
            expect.stringContaining(
                '0 HP raw Overshield HP in PvE and 0 HP raw Overshield HP in PvP',
            ),
            expect.stringContaining(
                '20 HP raw Overshield HP in PvE and 5 HP raw Overshield HP in PvP',
            ),
            expect.stringContaining(
                '40 HP raw Overshield HP in PvE and 10 HP raw Overshield HP in PvP',
            ),
        ]);
        expect(tooltip).toContain('{{PVPOvershieldDamageResistance}}{{Percent}}');
        expect(tooltip).toContain('{{PVEClassAbilityDamageIncrease}}{{Percent}}');
        expect(tooltip).toContain('{{PVPClassAbilityDamageIncrease}}{{Percent}}');
    });

    it('uses placeholder PvE/PvP Grenade and Melee damage curves in source, schema, tooltip, and export', async () => {
        const project = await validateProject();
        if (!project.sources || !project.data) throw new Error('Project did not validate');

        const checkpoints = [100, 125, 150, 175, 200];
        const definitions = generateSchema().definitions as Record<
            string,
            {
                properties: Record<
                    string,
                    { minItems?: number; maxItems?: number; description?: string }
                >;
            }
        >;
        const stats = [
            {
                name: 'Grenade',
                spec: grenadeSpec,
                maximums: { PVEGrenadeDamageIncrease: 65, PVPGrenadeDamageIncrease: 20 },
            },
            {
                name: 'Melee',
                spec: meleeSpec,
                maximums: { PVEMeleeDamageIncrease: 30, PVPMeleeDamageIncrease: 20 },
            },
        ] as const;

        for (const { name, spec, maximums } of stats) {
            const source = project.sources.stats.find((entry) => entry.Name === name) as
                StatSource | undefined;
            if (!source) throw new Error(`Missing ${name} source`);
            expect(source.Notes).toContain('Placeholder');

            const exported = project.data[String(spec.hash)] as Record<string, unknown>;
            const exportedFields = Object.keys(maximums);
            expect(exported).not.toHaveProperty(
                name === 'Grenade' ? 'GrenadeDamageIncrease' : 'MeleeDamageIncrease',
            );

            for (const [key, maximum] of Object.entries(maximums)) {
                const expected = checkpoints.map(
                    (statValue) => ((statValue - 100) * maximum) / 100,
                );
                const curve = source.Fields[key] as Curve;
                const values = exported[key] as number[];
                const field = spec.fields.find((entry) => entry.key === key)!;

                expect(curve).toMatchObject({
                    Domain: [100, 200],
                    Segments: [
                        {
                            Type: 'Linear',
                            Points: [
                                [100, 0],
                                [200, maximum],
                            ],
                        },
                    ],
                });
                expect(values).toHaveLength(101);
                expect(checkpoints.map((statValue) => values[statValue - 100])).toEqual(expected);
                expect(
                    checkpoints.map((statValue) =>
                        renderTooltip(`{{${key}}}`, source, spec, statValue),
                    ),
                ).toEqual(expected.map(String));
                expect(field.domain).toEqual([100, 200]);
                expect(definitions[name]!.properties[key]).toMatchObject({
                    minItems: 101,
                    maxItems: 101,
                });
                expect(definitions[name]!.properties[key]!.description).toContain(
                    key.startsWith('PVE') ? 'in PvE' : 'in PvP',
                );
            }

            expect(exportedFields).toHaveLength(2);
            expect(exportedFields.every((key) => key in source.Fields)).toBe(true);

            const locale = (await readJson('locale/en.json')) as LocaleData;
            const tooltip = resolveLocale(locale, `${name}.EnhancedStatTooltip`);
            if (!tooltip) throw new Error(`Missing ${name} enhanced tooltip`);
            const pveKey = exportedFields.find((key) => key.startsWith('PVE'))!;
            const pvpKey = exportedFields.find((key) => key.startsWith('PVP'))!;
            expect(tooltip).toContain(`{{${pveKey}}}{{Percent}}`);
            expect(tooltip).toContain(`{{${pvpKey}}}{{Percent}}`);
            expect(
                checkpoints.map((statValue) =>
                    renderTooltip(tooltip, source, spec, statValue, { Cooldown: 1 }),
                ),
            ).toEqual(
                checkpoints.map((statValue) =>
                    expect.stringContaining(
                        `deals ${((statValue - 100) * maximums[pveKey as keyof typeof maximums]) / 100}% increased damage in PvE and ${((statValue - 100) * maximums[pvpKey as keyof typeof maximums]) / 100}% increased damage in PvP`,
                    ),
                ),
            );
        }
    });

    it('keeps Health baseline values and enhanced breakpoints consistent in preview and export', async () => {
        const project = await validateProject();
        if (!project.sources || !project.data) throw new Error('Project did not validate');
        const health = project.sources.stats.find((entry) => entry.Name === 'Health') as
            StatSource | undefined;
        if (!health) throw new Error('Missing Health source');
        const exported = project.data[String(healthSpec.hash)] as Record<string, number[]>;

        expect(
            [100, 101, 150, 151, 200].map((statValue) => {
                const arrayValue = exported.PVEBonusShieldHP![statValue - 100]!;
                const previewValue = renderTooltip(
                    '{{PVEBonusShieldHP}}',
                    health,
                    healthSpec,
                    statValue,
                );
                expect(previewValue).toBe(String(arrayValue));
                return arrayValue;
            }),
        ).toEqual([0, 0.3, 15, 15.1, 20]);

        expect(
            [100, 101, 150, 200].map((statValue) => {
                const arrayValue = exported.ShieldRechargeDelay![statValue - 100]!;
                const previewValue = renderTooltip(
                    '{{ShieldRechargeDelay}}',
                    health,
                    healthSpec,
                    statValue,
                );
                expect(previewValue).toBe(String(arrayValue));
                return arrayValue;
            }),
        ).toEqual([4.9, 4.89, 4.29, 3.67]);
        expect(
            [100, 101, 150, 200].map((statValue) => {
                const arrayValue = exported.ShieldRechargeSpeed![statValue - 100]!;
                const previewValue = renderTooltip(
                    '{{ShieldRechargeSpeed}}',
                    health,
                    healthSpec,
                    statValue,
                );
                expect(previewValue).toBe(String(arrayValue));
                return arrayValue;
            }),
        ).toEqual([34.48, 34.64, 42.24, 50]);
    });

    it('lets the editor enter stat 100 for an enhanced linear curve', async () => {
        const project = await validateProject();
        if (!project.sources) throw new Error('Project did not validate');
        const health = project.sources.stats.find((entry) => entry.Name === 'Health');
        if (!health) throw new Error('Missing Health source');
        const curve = health.Fields.PVEBonusShieldHP;
        const html = renderToStaticMarkup(
            createElement(CurveEditor, {
                spec: healthSpec.fields.find((field) => field.key === 'PVEBonusShieldHP')!,
                value: curve,
                saved: curve,
                file: 'sources/stats/health.json',
                path: 'Fields.PVEBonusShieldHP',
                onChange() {},
            }),
        );

        expect(html).toContain('100–200');
        expect(html).toContain('PVEBonusShieldHP segment 1 point 0 stat value');
        expect(html).toContain('min="100"');
        expect(html).toContain('max="200"');
    });
});
