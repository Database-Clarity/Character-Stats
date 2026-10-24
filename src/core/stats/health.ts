import type { StatSpec } from './types';
import { curve, integerField, numberField } from '../fields/builders';

export const healthSpec: StatSpec = {
    name: 'Health',
    hash: 392767087,
    collections: {},
    fields: [
        curve('FlinchResistance', {
            domain: [0, 200],
            items: { min: 0 },
            description:
                'Array index represents the Health stat (0-200). The numbers ' +
                'represent the percentage flinch resistance granted at each stat ' +
                'point.',
        }),

        curve('OrbOfPowerHealthRestore', {
            domain: [0, 200],
            items: { min: 0, integer: true },
            description: 'How much HP picking up an Orb of Power restores.',
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

        integerField('PVPShieldHP', {
            min: 0,
            description:
                'This number represents how much HP your Shields have in PVP ' + 'activities.',
        }),

        curve('PVEShieldHP', {
            domain: [0, 200],
            items: { min: 0, integer: true },
            description:
                'This number represents how much HP your Shields have in PVE ' + 'activities.',
        }),

        curve('ShieldRechargeDelay', {
            domain: [0, 200],
            items: { min: 0 },
            description:
                'This number represents how many seconds after taking damage you ' +
                'Shields start recharging.',
        }),

        curve('ShieldRechargeSpeed', {
            domain: [0, 200],
            items: { min: 0 },
            description:
                'This number represents how fast your Shields recharge in % of ' +
                'total Shield HP per second. Total Shield HP can be found in the ' +
                '<PVPShieldHP> and <PVEShieldHP> properties.',
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
