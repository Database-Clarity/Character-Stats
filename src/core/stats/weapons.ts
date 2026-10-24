import type { StatSpec } from './types';
import { curve } from '../fields/builders';

export const weaponsSpec: StatSpec = {
    name: 'Weapons',
    hash: 2996146975,
    collections: {},
    fields: [
        curve('ReloadSpeed', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (0-100). The numbers ' +
                'represent a scalar for the Reload animation durations of your ' +
                'weapons at each stat point.',
        }),

        curve('Handling', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (0-100). The numbers ' +
                'represent a scalar for the Handling animation durations of your ' +
                'weapons at each stat point.',
        }),

        curve('NonBossDamageIncrease', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (0-100). The numbers ' +
                'represent how much increased damage your weapons deal against ' +
                'Minor, Elite, and Miniboss combatants.',
        }),

        curve('SpecialDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (101-200). The numbers ' +
                'represent how much increased damage Special weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PowerDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (101-200). The numbers ' +
                'represent how much increased damage Power weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PVPDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (101-200). The numbers ' +
                'represent how much increased damage your weapons deal against ' +
                'Players when the Weapons stat is enhanced.',
        }),

        curve('LargeAmmoBrickChance', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Array index represents the Weapons stat (101-200). The numbers ' +
                'represent the chance of spawning Large Ammo Bricks through the ' +
                'Ammo Meter system when the Weapons stat is enhanced.',
        }),
    ],
};
