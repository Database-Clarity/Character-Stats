import { describe, expect, it } from 'vitest';
import weaponsData from '../sources/stats/weapons.json';
import en from '../locale/en.json';
import {
    exportSources,
    generateSchema,
    renderTooltip,
    validateField,
    weaponsSpec,
    type StatSource,
} from '../src/core';
import { fixture } from './fixtures';

const source = {
    Hash: weaponsSpec.hash,
    Name: weaponsSpec.name,
    Fields: weaponsData.Fields,
} as unknown as StatSource;

describe('Weapons stat fields', () => {
    it('labels damage increases by their target combatants and weapon type', () => {
        expect(weaponsSpec.fields.map((field) => [field.key, field.label])).toEqual(
            expect.arrayContaining([
                ['NonBossDamageIncrease', 'Minor/Elite PvE damage increase (%)'],
                [
                    'SpecialDamageIncrease',
                    'Primary/Special weapon vs. Miniboss/Champion/Boss damage increase (%)',
                ],
                [
                    'PowerDamageIncrease',
                    'Power weapon vs. Miniboss/Champion/Boss damage increase (%)',
                ],
                ['PVPDamageIncrease', 'PvP damage increase vs. Players (%)'],
            ]),
        );
    });

    it('starts NonBossDamageIncrease at 0% at stat 0 and reaches 15% at stat 100', () => {
        const sources = fixture();
        const fixtureWeapons = sources.stats.find((stat) => stat.Name === weaponsSpec.name)!;
        Object.assign(fixtureWeapons.Fields, source.Fields);
        const exportedStat = exportSources(sources)[String(weaponsSpec.hash)] as Record<
            string,
            number[]
        >;
        expect(exportedStat.NonBossDamageIncrease?.[0]).toBe(0);
        expect(exportedStat.NonBossDamageIncrease?.[100]).toBe(15);
    });

    it('stores duration decreases, preserving the previous multiplier behavior', () => {
        for (const key of ['ReloadSpeed', 'Handling']) {
            const field = weaponsSpec.fields.find((candidate) => candidate.key === key)!;
            const curve = source.Fields[key];
            expect(field.label).toContain('animation duration decrease (%)');
            expect(field.items).toMatchObject({ min: 0, max: 100 });
            expect(validateField(field, curve)).toEqual([]);
            const sources = fixture();
            const fixtureWeapons = sources.stats.find((stat) => stat.Name === weaponsSpec.name)!;
            Object.assign(fixtureWeapons.Fields, source.Fields);
            const exportedStat = exportSources(sources)[String(weaponsSpec.hash)] as Record<
                string,
                unknown
            >;
            const exported = exportedStat[key] as number[];
            expect(exported).toHaveLength(101);
            expect(exported[0]).toBe(0);
            expect(exported[100]).toBe(10);
            expect(
                validateField(field, {
                    Domain: [0, 100],
                    Segments: [{ Type: 'Constant', From: 0, To: 100, Value: 101 }],
                }),
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ severity: 'error', path: key + '[0]' }),
                ]),
            );
        }
    });

    it('renders the stored percentage decreases in both weapon tooltips', () => {
        const base = renderTooltip(en.Weapons.BaseStatTooltip, source, weaponsSpec, 100);
        const enhanced = renderTooltip(en.Weapons.EnhancedStatTooltip, source, weaponsSpec, 200);

        expect(base).toContain(
            'Reload and Handling animation durations are reduced by 10% and 10%',
        );
        expect(enhanced).toContain(
            'Reload and Handling animation durations are reduced by 10% and 10%',
        );
        expect(base).toContain('increased damage against Minor and Elite combatants');
        expect(enhanced).toContain(
            'Primary and Special weapons deal 15% increased damage and Power weapons deal 10% increased damage against Minibosses, Champions, and Bosses',
        );
        expect(enhanced).toContain('increased damage against Players');
    });

    it('publishes the new duration meaning and combatant-specific damage labels in the schema', () => {
        const definitions = generateSchema().definitions as Record<
            string,
            {
                properties: Record<string, { description: string }>;
            }
        >;
        const fields = definitions.Weapons?.properties;
        expect(fields?.ReloadSpeed?.description).toContain('percentage decrease');
        expect(fields?.Handling?.description).toContain('percentage decrease');
        expect(fields?.NonBossDamageIncrease?.description).toContain('Minor and Elite combatants');
        expect(fields?.SpecialDamageIncrease?.description).toContain(
            'Minibosses, Champions, and Bosses',
        );
        expect(fields?.PowerDamageIncrease?.description).toContain(
            'Minibosses, Champions, and Bosses',
        );
        expect(fields?.PVPDamageIncrease?.description).toContain('against Players');
    });
});
