import type { StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const grenadeSpec: StatSpec = {
    name: 'Grenade',
    hash: 1735777505,
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Grenade stat (0-100). The numbers ' +
                "represent a scalar for the Grenade Ability's <BaseCooldown> at " +
                'each stat point.',
        }),

        curve('EnergyGainScalar', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Grenade stat (0-100). The numbers ' +
                'represent how effective external sources of Grenade Energy are.',
        }),

        curve('GrenadeDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Grenade stat (101-200). The numbers ' +
                'represent how much increased damage your Grenade Ability deals ' +
                'when the Grenade stat is enhanced.',
        }),
    ],
};
