import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve, numberField } from '../fields/builders';

export const healthSpec: StatSpec = {
    name: 'Health',
    hash: 392767087,
    collections: {},
    fields: [
        curve('FlinchResistance', {
            domain: [0, 100],
            items: { min: 0 },
            label: 'ADS-only flinch resistance (%)',
            description:
                'Percentage ADS-only flinch resistance at each Health stat value. ' +
                'Stat values above 100 use the value at 100.',
        }),

        curve('OrbOfPowerHealthRestore', {
            label: 'Orb of Power health restore (HP)',
            domain: [0, 100],
            items: { min: 0 },
            description:
                'How much HP picking up an Orb of Power restores at each Health ' +
                'stat value. Stat values above 100 use the value at 100.',
        }),

        numberField('PVPHealthHP', {
            label: 'PvP health (HP)',
            min: 0,
            description:
                'This number represents how much HP your Health has in most PVP ' + 'activities.',
        }),

        numberField('PVEHealthHP', {
            label: 'PvE health (HP)',
            min: 0,
            description:
                'This number represents how much HP your Health has in PVE ' + 'activities.',
        }),

        numberField('HealthRegenDelay', {
            label: 'Health regeneration delay (s)',
            min: 0,
            description:
                'This number represents how many seconds after taking damage ' +
                'Health Regeneration starts.',
        }),

        numberField('HealthRegenSpeed', {
            min: 0,
            label: 'Health regeneration (%/s)',
            description:
                'This number represents how fast your Health regens is % of total ' +
                'Health per second. Total Health can be found in the <PVPHealthHP> ' +
                'and <PVEHealthHP> properties.',
        }),

        numberField('BaseShieldHP', {
            label: 'Base shield (HP)',
            min: 0,
            description:
                'How much HP your Shields have in all activities (PVE and PVP), ' +
                'independent of the Health stat value.',
        }),

        curve('PVEBonusShieldHP', {
            label: 'PvE bonus shield (HP)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Extra Shield HP in PVE activities at each enhanced Health stat ' +
                'value, added on top of <BaseShieldHP>. Below 101 there is no ' +
                'bonus. Does not apply in PVP.',
        }),

        numberField('BaseShieldRechargeDelay', {
            label: 'Base shield recharge delay (s)',
            min: 0,
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeDelay', {
            label: 'Shield recharge delay (s)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeDelay>.',
        }),

        numberField('BaseShieldRechargeSpeed', {
            min: 0,
            label: 'Base shield recharge speed (%/s)',
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeSpeed', {
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Shield recharge speed (%/s)',
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeSpeed>.',
        }),

        numberField('PVEDamageResistance', {
            min: 0,
            label: 'PvE health damage resistance (%)',
            description:
                'This number represents the percentage damage resistance applied ' +
                'to Health, not Shields, in PVE activities, independent of the ' +
                'Health stat value. The current value is 34.5.',
        }),
    ],
};
