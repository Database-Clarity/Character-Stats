import type { StatSpec } from './types';
import { curve } from '../fields/builders';
import { superAbilitySpec, overrideSpec } from '../entities';

export const superSpec: StatSpec = {
    name: 'Super',
    hash: 144602215,
    abilityKind: 'super',
    collections: { SuperAbilities: superAbilitySpec, Overrides: overrideSpec },
    fields: [
        curve('EnergyGainScalar', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'Energy gain scalar',
            description:
                'Values represent how effective external sources of Super Energy (Orbs of ' +
                'Power, exchanging damage, perks, etc.) are.',
        }),

        curve('ActiveRegenScalars', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'Active regeneration scalar',
            description:
                "Values multiply the Super Ability's <ActiveRegenScalar> to determine " +
                'active Super regeneration.',
        }),

        curve('SuperDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            label: 'Super damage increase (%)',
            description:
                'Values represent how much increased damage your Super Ability deals when ' +
                'the Super stat is enhanced.',
        }),
    ],
};
