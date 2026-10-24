import type { StatSpec } from './types';
import { curve, integerField, numberField } from '../fields/builders';

export const healthSpec: StatSpec = {
    name: 'Health',
    hash: 392767087,
    collections: {},
    fields: [
        curve('FlinchResistance', {
            domain: [0, 100],
            items: { min: 0 },
            description:
                'Percentage flinch resistance while aiming down sights at each ' +
                'Health stat value. Stat values above 100 use the value at 100.',
        }),

        curve('OrbOfPowerHealthRestore', {
            domain: [0, 100],
            items: { min: 0, integer: true },
            description:
                'How much HP picking up an Orb of Power restores at each Health ' +
                'stat value. Stat values above 100 use the value at 100.',
        }),

        integerField('PVPHealthHP', {
            min: 0,
            description:
                'This number represents how much HP your Health has in most PVP ' + 'activities.',
        }),

        integerField('PVEHealthHP', {
            min: 0,
            description:
                'This number represents how much HP your Health has in PVE ' + 'activities.',
        }),

        numberField('HealthRegenDelay', {
            min: 0,
            description:
                'This number represents how many seconds after taking damage ' +
                'Health Regeneration starts.',
        }),

        numberField('HealthRegenSpeed', {
            min: 0,
            description:
                'This number represents how fast your Health regens is % of total ' +
                'Health per second. Total Health can be found in the <PVPHealthHP> ' +
                'and <PVEHealthHP> properties.',
        }),

        integerField('BaseShieldHP', {
            min: 0,
            description:
                'How much HP your Shields have in all activities (PVE and PVP), ' +
                'independent of the Health stat value.',
        }),

        curve('PVEBonusShieldHP', {
            domain: [101, 200],
            items: { min: 0, integer: true },
            description:
                'Extra Shield HP in PVE activities at each enhanced Health stat ' +
                'value, added on top of <BaseShieldHP>. Below 101 there is no ' +
                'bonus. Does not apply in PVP.',
        }),

        numberField('BaseShieldRechargeDelay', {
            min: 0,
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeDelay', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeDelay>.',
        }),

        numberField('BaseShieldRechargeSpeed', {
            min: 0,
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeSpeed', {
            domain: [101, 200],
            items: { min: 0 },
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeSpeed>.',
        }),

        numberField('PVEDamageResistance', {
            min: 0,
            description:
                'This number represents the percentage damage resistance granted ' +
                'in PVE activities, independent of the Health stat value. The ' +
                'current value is 34.5.',
        }),
    ],
};
