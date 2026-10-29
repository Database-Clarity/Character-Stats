import { describe, expect, it } from 'vitest';
import {
    calculateSuperDuration,
    effectiveSuperDuration,
    renderTooltip,
    resolveLocale,
    superSpec,
    type SuperAbility,
} from '../src/core';
import { validateProject } from '../src/cli/io';
import english from '../locale/en.json';
import { tooltipAbilityContext } from '../src/editor/components/previewData';

const expected = [
    { statValue: 100, increase: 0, duration: 30, damage: 0 },
    { statValue: 150, increase: 16.5, duration: 34.95, damage: 22.5 },
    { statValue: 200, increase: 33, duration: 39.9, damage: 45 },
] as const;

describe('enhanced duration for support Supers', () => {
    it.each(expected)(
        'calculates and previews support durations at stat $statValue',
        async ({ statValue, increase, duration, damage }) => {
            const project = await validateProject();
            expect(project.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
            if (!project.sources || !project.data) throw new Error('Project did not validate');

            const source = project.sources.stats.find((entry) => entry.Name === 'Super');
            if (!source) throw new Error('Missing Super source');
            const exported = project.data[String(superSpec.hash)] as {
                SuperDurationIncrease: number[];
                SuperDamageIncrease: number[];
                SuperAbilities: SuperAbility[];
            };
            const exportedIncrease = exported.SuperDurationIncrease[statValue - 100];
            expect(exportedIncrease).toBe(increase);
            expect(exported.SuperDamageIncrease[statValue - 100]).toBe(damage);

            for (const abilityName of ['Ward of Dawn', 'Well of Radiance']) {
                const ability = source.SuperAbilities?.find((entry) => entry.Name === abilityName);
                if (!ability) throw new Error(`Missing ${abilityName}`);
                expect(ability.BaseDuration).toBe(30);
                expect(effectiveSuperDuration(source, ability, statValue)).toBe(duration);

                const exportedAbility = exported.SuperAbilities.find(
                    (entry) => entry.Hash === ability.Hash,
                );
                expect(exportedAbility).toMatchObject({
                    BaseDuration: 30,
                    EnhancedDurationTooltip: ability.EnhancedDurationTooltip,
                });
                const exportedDuration = calculateSuperDuration(
                    exportedAbility!,
                    { Values: exported.SuperDurationIncrease },
                    statValue,
                );
                expect(exportedDuration).toBe(duration);

                const localeId = ability.EnhancedDurationTooltip;
                if (!localeId) throw new Error(`${abilityName} has no duration tooltip locale ID`);
                const text = resolveLocale(english, localeId);
                if (!text) throw new Error(`Missing tooltip text ${localeId}`);
                expect(
                    renderTooltip(
                        text,
                        source,
                        superSpec,
                        statValue,
                        tooltipAbilityContext(source, ability, statValue, ability.Name),
                    ),
                ).toBe(
                    `Enhanced Super stat increases ${ability.Name}'s duration by ${increase}%, from 30s to ${duration}s. Whether this duration benefit replaces or adds to the Super Damage increase is unconfirmed.`,
                );
            }
        },
    );

    it.each(expected.map(({ statValue }) => statValue))(
        'does not apply duration enhancement to non-support Supers at stat %i',
        async (statValue) => {
            const project = await validateProject();
            if (!project.sources || !project.data) throw new Error('Project did not validate');
            const source = project.sources.stats.find((entry) => entry.Name === 'Super');
            if (!source) throw new Error('Missing Super source');
            const ability = source.SuperAbilities?.find((entry) => entry.Name === 'Arc Staff');
            if (!ability) throw new Error('Missing Arc Staff');

            expect(ability.BaseDuration).toBeUndefined();
            expect(ability.EnhancedDurationTooltip).toBeUndefined();
            expect(effectiveSuperDuration(source, ability, statValue)).toBeUndefined();
            expect(tooltipAbilityContext(source, ability, statValue)).not.toHaveProperty(
                'SuperDuration',
            );
            const exported = project.data[String(superSpec.hash)] as {
                SuperAbilities: SuperAbility[];
            };
            const exportedAbility = exported.SuperAbilities.find(
                (entry) => entry.Hash === ability.Hash,
            );
            expect(exportedAbility).not.toHaveProperty('BaseDuration');
            expect(exportedAbility).not.toHaveProperty('EnhancedDurationTooltip');
        },
    );
});
