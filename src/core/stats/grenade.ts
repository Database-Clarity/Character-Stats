import type { StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const grenadeSpec: StatSpec = {
    name: 'Grenade',
    hash: 1735777505,
    abilityKind: 'grenade',
    collections: { Abilities: abilitySpec, Overrides: overrideSpec },
    fields: [
        curve('CooldownScalars', {
            domain: [0, 100],
            items: { min: 0 },
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
            description: 'Values represent how effective external sources of Grenade Energy are.',
        }),

        curve('GrenadeDamageIncrease', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'Values represent how much increased damage your Grenade Ability deals ' +
                'when the Grenade stat is enhanced.',
        }),
    ],
};
