import type { StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const classSpec: StatSpec = {
    name: 'Class',
    hash: 1943323491,
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Class stat (0-100). The numbers ' +
                "represent a scalar for the Class Ability's <BaseCooldown> at each " +
                'stat point.',
        }),

        curve('EnergyGainScalar', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Class stat (0-100). The numbers ' +
                'represent how effective external sources of Class Ability Energy ' +
                'are.',
        }),

        curve('OvershieldHP', {
            domain: [101, 200],
            items: { min: 0, integer: true },
            description:
                'Array index represents the Class stat (101-200). The numbers ' +
                'represent how much Overshield HP casting your Class Ability ' +
                'grants when the Class stat is enhanced.',
        }),
    ],
};
