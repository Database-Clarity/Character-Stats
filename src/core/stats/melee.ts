import type { StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const meleeSpec: StatSpec = {
    name: 'Melee',
    hash: 4244567218,
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Melee stat (0-100). The numbers ' +
                "represent a scalar for the Melee Ability's <BaseCooldown> at each " +
                'stat point.',
        }),

        curve('EnergyGainScalar', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Melee stat (0-100). The numbers ' +
                'represent how effective external sources of Melee Energy are.',
        }),

        curve('MeleeDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Melee stat (101-200). The numbers ' +
                'represent how much increased damage your Melee Ability deals when ' +
                'the Melee stat is enhanced.',
        }),
    ],
};
