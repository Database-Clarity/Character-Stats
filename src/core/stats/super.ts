import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve } from '../fields/builders';
import { superAbilitySpec, overrideSpec } from '../entities';

export const superSpec: StatSpec = {
    name: 'Super',
    hash: 144602215,
    abilityKind: 'super',
    collections: { SuperAbilities: superAbilitySpec, Overrides: overrideSpec },
    fields: [
        curve('EnergyGainScalar', {
            help: 'How effective outside sources of Super energy (Orbs of Power, dealing damage, perks) are in PvE at each stat value (0–100), as a multiplier: 1 is normal. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'PvE energy gain scalar',
            description:
                'Values represent how effective external sources of Super Energy (Orbs of ' +
                'Power, exchanging damage, perks, etc.) are in PvE.',
        }),

        curve('PVPEnergyGainScalar', {
            help: 'How effective outside sources of Super energy (Orbs of Power, dealing damage, perks) are in PvP at each stat value (0–100), as a multiplier: 1 is normal. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'PvP energy gain scalar',
            description:
                'Values represent how effective external sources of Super Energy (Orbs of ' +
                'Power, exchanging damage, perks, etc.) are in PvP.',
        }),

        curve('ActiveRegenScalars', {
            help: "Multiplier on each Super's Active regeneration scalar at each Super stat value (0–100), giving its active regeneration rate. Stat values above 100 use the value at 100.",
            domain: [0, 100],
            items: { min: 0 },
            label: 'Active regeneration scalar',
            description:
                "Values multiply the Super Ability's <ActiveRegenScalar> to determine " +
                'active Super regeneration.',
        }),

        curve('SuperDamageIncrease', {
            help: 'Extra Super damage in PvE, in %, for an enhanced Super stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvE Super damage increase (%)',
            description:
                'Percentage increase to Super Ability damage in PvE at each enhanced Super stat value.',
        }),

        curve('PVPSuperDamageIncrease', {
            help: 'Extra Super damage in PvP, in %, for an enhanced Super stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP Super damage increase (%)',
            description:
                'Percentage increase to Super Ability damage in PvP at each enhanced Super stat value.',
        }),

        curve('SuperDurationIncrease', {
            help: 'Longer Super duration, in %, for an enhanced Super stat (100–200). Stat 100 means no enhancement. Only Supers with a Base duration get this increase.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Super duration increase (%)',
            description:
                'Percentage duration increase for SuperAbilities that define BaseDuration. ' +
                'Supers without BaseDuration do not receive a duration change through this field.',
        }),
    ],
};
