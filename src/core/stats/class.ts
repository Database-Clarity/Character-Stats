import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve, numberField } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const classSpec: StatSpec = {
    name: 'Class',
    hash: 1943323491,
    abilityKind: 'class',
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'Cooldown scalar',
            description:
                'Dimensionless cooldown multiplier at each stat value. Start with BaseCooldown ' +
                'in seconds, replace it with applicable CooldownOverride (last matching replacement ' +
                'in collection order), multiply all matching Scalar entries, then multiply by ' +
                'CooldownScalars[min(stat value, 100)]. Requirements select with 0 as wildcard, ' +
                'positive ability hash, or negative subclass hash requiring consumer-side resolution.',
        }),

        curve('EnergyGainScalar', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'Energy gain scalar',
            description:
                'Values represent how effective external sources of Class Ability Energy ' + 'are.',
        }),

        curve('PVEOvershieldHP', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Values represent how much Overshield HP casting your Class Ability ' +
                'grants in PvE when the Class stat is enhanced. This is raw HP, not ' +
                'effective HP after damage resistance.',
        }),

        curve('PVPOvershieldHP', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Values represent how much raw Overshield HP casting your Class Ability ' +
                'grants in PvP when the Class stat is enhanced. PvP Overshields have ' +
                '50% damage resistance; this value is not effective HP.',
        }),

        numberField('PVPOvershieldDamageResistance', {
            min: 0,
            label: 'PvP Overshield damage resistance (%)',
            description:
                'PvP Overshield damage resistance as a percentage. Do not apply this ' +
                'value to PvE; PvE Overshield damage resistance is unknown.',
        }),

        curve('PVEClassAbilityDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvE Class Ability damage increase (%)',
            description:
                'Percentage increase to Class Ability damage in PvE at each enhanced ' +
                'Class stat value.',
        }),

        curve('PVPClassAbilityDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP Class Ability damage increase (%)',
            description:
                'Percentage increase to Class Ability damage in PvP at each enhanced ' +
                'Class stat value.',
        }),
    ],
};
