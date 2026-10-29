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
            description: 'Values represent how effective external sources of Melee Energy are.',
        }),

        curve('PVEMeleeDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvE Melee damage increase (%)',
            description:
                'Percentage increase to Melee Ability damage in PvE at each enhanced ' +
                'Melee stat value. No ability-specific exceptions are currently known.',
        }),

        curve('PVPMeleeDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP Melee damage increase (%)',
            description:
                'Percentage increase to Melee Ability damage in PvP at each enhanced ' +
                'Melee stat value. No ability-specific exceptions are currently known.',
        }),
    ],
};
