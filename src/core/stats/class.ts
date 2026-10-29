import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve } from '../fields/builders';
import { abilitySpec, overrideSpec } from '../entities';

export const classSpec: StatSpec = {
    name: 'Class',
    hash: 1943323491,
    abilityKind: 'class',
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
            description:
                'Values represent how effective external sources of Class Ability Energy ' + 'are.',
        }),

        curve('OvershieldHP', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0, integer: true },
            description:
                'Values represent how much Overshield HP casting your Class Ability ' +
                'grants when the Class stat is enhanced.',
        }),
    ],
};
