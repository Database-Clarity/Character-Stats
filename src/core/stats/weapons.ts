import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve } from '../fields/builders';

export const weaponsSpec: StatSpec = {
    name: 'Weapons',
    hash: 2996146975,
    collections: {},
    fields: [
        curve('ReloadSpeed', {
            domain: [0, 100],
            items: { min: 0, max: 100 },
            label: 'Reload animation duration decrease (%)',
            description:
                'Values are the percentage decrease in weapon Reload animation duration at ' +
                'each stat point. Convert a duration multiplier to a decrease with ' +
                '(1 - multiplier) × 100.',
        }),

        curve('Handling', {
            domain: [0, 100],
            items: { min: 0, max: 100 },
            label: 'Handling animation duration decrease (%)',
            description:
                'Values are the percentage decrease in weapon Handling animation duration ' +
                'at each stat point. Convert a duration multiplier to a decrease with ' +
                '(1 - multiplier) × 100.',
        }),

        curve('NonBossDamageIncrease', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'Minor/Elite/Miniboss PvE damage increase (%)',
            description:
                'Values represent how much increased damage your weapons deal against ' +
                'Minor, Elite, and Miniboss combatants.',
        }),

        curve('SpecialDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Special weapon vs. Boss damage increase (%)',
            description:
                'Values represent how much increased damage Special weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PowerDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Power weapon vs. Boss damage increase (%)',
            description:
                'Values represent how much increased damage Power weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PVPDamageIncrease', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP damage increase vs. Players (%)',
            description:
                'Values represent how much increased damage your weapons deal against ' +
                'Players when the Weapons stat is enhanced.',
        }),

        curve('LargeAmmoBrickChance', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Large ammo brick chance (%)',
            description:
                'Values represent the chance of spawning Large Ammo Bricks through the ' +
                'Ammo Meter system when the Weapons stat is enhanced.',
        }),
    ],
};
