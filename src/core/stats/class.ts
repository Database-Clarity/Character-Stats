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
            help: "Multiplier on every ability's cooldown at each stat value (0–100): 1 keeps the base cooldown, 0.5 halves it. Stat values above 100 use the value at 100. Cooldown = Base cooldown (or a matching Cooldown override) × matching override Cooldown scalars × this value. Pick an ability to see the result in the Cooldown context panel.",
            domain: [0, 100],
            items: { min: 0 },
            label: 'Cooldown scalar',
            reciprocalLabel: 'Recharge rate (1/y)',
            description:
                'Dimensionless cooldown multiplier at each stat value. Start with BaseCooldown ' +
                'in seconds, replace it with applicable CooldownOverride (last matching replacement ' +
                'in collection order), multiply all matching Scalar entries, then multiply by ' +
                'CooldownScalars[min(stat value, 100)]. Requirements select with 0 as wildcard, ' +
                'positive ability hash, or negative subclass hash requiring consumer-side resolution.',
        }),

        curve('EnergyGainScalar', {
            help: 'How effective outside sources of Class ability energy (such as perks) are at each stat value (0–100), as a multiplier: 1 is normal. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'Energy gain scalar',
            description:
                'Values represent how effective external sources of Class Ability Energy ' + 'are.',
        }),

        curve('PVEOvershieldHP', {
            help: 'Raw Overshield HP from casting your Class ability in PvE, for an enhanced Class stat (100–200). Stat 100 means no enhancement. Enter raw HP, not effective HP after damage resistance.',
            label: 'PvE overshield (HP)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Values represent how much Overshield HP casting your Class Ability ' +
                'grants in PvE when the Class stat is enhanced. This is raw HP, not ' +
                'effective HP after damage resistance.',
        }),

        curve('PVPOvershieldHP', {
            help: 'Raw Overshield HP from casting your Class ability in PvP, for an enhanced Class stat (100–200). Stat 100 means no enhancement. Enter raw HP; damage resistance is tracked separately below.',
            label: 'PvP overshield (HP)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Values represent how much raw Overshield HP casting your Class Ability ' +
                'grants in PvP when the Class stat is enhanced. This value is raw HP, ' +
                'separate from damage resistance.',
        }),

        numberField('PVEOvershieldDamageResistance', {
            help: 'Damage resistance of the Class ability Overshield against combatants in PvE, in %.',
            min: 0,
            label: 'PvE Overshield damage resistance (%)',
            description:
                'PvE Class Overshield damage resistance against combatants as a percentage.',
        }),

        numberField('PVPOvershieldDamageResistance', {
            help: 'Damage resistance of the Class ability Overshield against players in PvP, in %.',
            min: 0,
            label: 'PvP Overshield damage resistance (%)',
            description: 'PvP Class Overshield damage resistance against players as a percentage.',
        }),

        curve('PVEClassAbilityDamageIncrease', {
            help: 'Extra Class ability damage in PvE, in %, for an enhanced Class stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvE Class Ability damage increase (%)',
            description:
                'Percentage increase to Class Ability damage in PvE at each enhanced ' +
                'Class stat value.',
        }),

        curve('PVPClassAbilityDamageIncrease', {
            help: 'Extra Class ability damage in PvP, in %, for an enhanced Class stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP Class Ability damage increase (%)',
            description:
                'Percentage increase to Class Ability damage in PvP at each enhanced ' +
                'Class stat value.',
        }),
    ],
};
