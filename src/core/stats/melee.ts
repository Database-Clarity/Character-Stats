import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const meleeSpec: StatSpec = {
    name: 'Melee',
    hash: 4244567218,
    abilityKind: 'melee',
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            help: "Multiplier on every ability's cooldown at each stat value (0–100): 1 keeps the base cooldown, 0.5 halves it. Stat values above 100 use the value at 100. Cooldown = Base cooldown (or a matching Cooldown override) × matching override Cooldown scalars × this value. Pick an ability to see the result in the Cooldown context panel.",
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
            help: 'How effective outside sources of Melee energy (such as perks) are at each stat value (0–100), as a multiplier: 1 is normal. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'Energy gain scalar',
            description: 'Values represent how effective external sources of Melee Energy are.',
        }),

        curve('PVEMeleeDamageIncrease', {
            help: 'Extra Melee ability damage in PvE, in %, for an enhanced Melee stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvE Melee damage increase (%)',
            description:
                'Percentage increase to Melee Ability damage in PvE at each enhanced ' +
                'Melee stat value. No ability-specific exceptions are currently known.',
        }),

        curve('PVPMeleeDamageIncrease', {
            help: 'Extra Melee ability damage in PvP, in %, for an enhanced Melee stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP Melee damage increase (%)',
            description:
                'Percentage increase to Melee Ability damage in PvP at each enhanced ' +
                'Melee stat value. No ability-specific exceptions are currently known.',
        }),
    ],
};
