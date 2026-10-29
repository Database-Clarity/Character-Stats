import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve } from '../fields/builders';

export const weaponsSpec: StatSpec = {
    name: 'Weapons',
    hash: 2996146975,
    collections: {},
    fields: [
        curve('ReloadSpeed', {
            help: 'How much shorter weapon reload animations are, in %, at each Weapons stat value (0–100). From a duration multiplier, use (1 − multiplier) × 100: a 0.9× duration is a 10% decrease. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0, max: 100 },
            label: 'Reload animation duration decrease (%)',
            description:
                'Values are the percentage decrease in weapon Reload animation duration at ' +
                'each stat point. Convert a duration multiplier to a decrease with ' +
                '(1 - multiplier) × 100.',
        }),

        curve('Handling', {
            help: 'How much shorter weapon handling animations (ready, stow, aim) are, in %, at each Weapons stat value (0–100). From a duration multiplier, use (1 − multiplier) × 100. Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0, max: 100 },
            label: 'Handling animation duration decrease (%)',
            description:
                'Values are the percentage decrease in weapon Handling animation duration ' +
                'at each stat point. Convert a duration multiplier to a decrease with ' +
                '(1 - multiplier) × 100.',
        }),

        curve('NonBossDamageIncrease', {
            help: 'Extra weapon damage against Minor, Elite and Miniboss combatants, in %, at each Weapons stat value (0–100). Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'Minor/Elite/Miniboss PvE damage increase (%)',
            description:
                'Values represent how much increased damage your weapons deal against ' +
                'Minor, Elite, and Miniboss combatants.',
        }),

        curve('SpecialDamageIncrease', {
            help: 'Extra damage Special weapons deal to Bosses, in %, for an enhanced Weapons stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Special weapon vs. Boss damage increase (%)',
            description:
                'Values represent how much increased damage Special weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PowerDamageIncrease', {
            help: 'Extra damage Power weapons deal to Bosses, in %, for an enhanced Weapons stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Power weapon vs. Boss damage increase (%)',
            description:
                'Values represent how much increased damage Power weapons deal against ' +
                'Bosses when the Weapons stat is enhanced.',
        }),

        curve('PVPDamageIncrease', {
            help: 'Extra weapon damage against players, in %, for an enhanced Weapons stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'PvP damage increase vs. Players (%)',
            description:
                'Values represent how much increased damage your weapons deal against ' +
                'Players when the Weapons stat is enhanced.',
        }),

        curve('LargeAmmoBrickChance', {
            help: 'Chance, in %, that the Ammo Meter spawns a Large Ammo Brick, for an enhanced Weapons stat (100–200). Stat 100 means no enhancement.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Large ammo brick chance (%)',
            description:
                'Values represent the chance of spawning Large Ammo Bricks through the ' +
                'Ammo Meter system when the Weapons stat is enhanced.',
        }),
    ],
};
