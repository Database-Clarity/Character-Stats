import { ENHANCED_STAT_DOMAIN, type StatSpec } from './types';
import { curve, numberField } from '../fields/builders';

export const healthSpec: StatSpec = {
    name: 'Health',
    hash: 392767087,
    collections: {},
    fields: [
        curve('FlinchResistance', {
            help: 'Flinch resistance while aiming down sights, in %, at each Health stat value (0–100). Stat values above 100 use the value at 100.',
            domain: [0, 100],
            items: { min: 0 },
            label: 'ADS-only flinch resistance (%)',
            description:
                'Percentage ADS-only flinch resistance at each Health stat value. ' +
                'Stat values above 100 use the value at 100.',
        }),

        curve('OrbOfPowerHealthRestore', {
            help: 'HP restored when you pick up an Orb of Power, at each Health stat value (0–100). Stat values above 100 use the value at 100.',
            label: 'Orb of Power health restore (HP)',
            domain: [0, 100],
            items: { min: 0 },
            description:
                'How much HP picking up an Orb of Power restores at each Health ' +
                'stat value. Stat values above 100 use the value at 100.',
        }),

        numberField('PVPHealthHP', {
            help: 'Total Health HP in most PvP activities. Health regeneration (%/s) is a percentage of this.',
            label: 'PvP health (HP)',
            min: 0,
            description:
                'This number represents how much HP your Health has in most PVP ' + 'activities.',
        }),

        numberField('PVEHealthHP', {
            help: 'Total Health HP in PvE activities. Health regeneration (%/s) is a percentage of this.',
            label: 'PvE health (HP)',
            min: 0,
            description:
                'This number represents how much HP your Health has in PVE ' + 'activities.',
        }),

        numberField('HealthRegenDelay', {
            help: 'Seconds after taking damage before Health starts regenerating.',
            label: 'Health regeneration delay (s)',
            min: 0,
            description:
                'This number represents how many seconds after taking damage ' +
                'Health Regeneration starts.',
        }),

        numberField('HealthRegenSpeed', {
            help: 'How fast Health regenerates once it starts, as a percentage of total Health (PvP health or PvE health) per second.',
            min: 0,
            label: 'Health regeneration (%/s)',
            description:
                'This number represents how fast your Health regens is % of total ' +
                'Health per second. Total Health can be found in the <PVPHealthHP> ' +
                'and <PVEHealthHP> properties.',
        }),

        numberField('BaseShieldHP', {
            help: 'Shield HP in all activities. It does not change with the Health stat; PvE bonus shield adds to it when Health is enhanced.',
            label: 'Base shield (HP)',
            min: 0,
            description:
                'How much HP your Shields have in all activities (PVE and PVP), ' +
                'independent of the Health stat value.',
        }),

        curve('PVEBonusShieldHP', {
            help: 'Extra Shield HP in PvE on top of Base shield, for an enhanced Health stat (100–200). Stat 100 means no enhancement. Does not apply in PvP.',
            label: 'PvE bonus shield (HP)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'Extra Shield HP in PVE activities at each enhanced Health stat ' +
                'value, added on top of <BaseShieldHP>. Below 101 there is no ' +
                'bonus. Does not apply in PVP.',
        }),

        numberField('BaseShieldRechargeDelay', {
            help: 'Seconds after taking damage before Shields start recharging, while Health is 100 or lower. Enhanced Health uses Shield recharge delay instead.',
            label: 'Base shield recharge delay (s)',
            min: 0,
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeDelay', {
            help: 'Seconds after taking damage before Shields start recharging, for an enhanced Health stat (100–200). Stat 100 means no enhancement. At 100 or lower, Base shield recharge delay applies.',
            label: 'Shield recharge delay (s)',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            description:
                'How many seconds after taking damage your Shields start ' +
                'recharging at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeDelay>.',
        }),

        numberField('BaseShieldRechargeSpeed', {
            help: 'Shield recharge rate, as a percentage of total Shield HP per second, while Health is 100 or lower. Enhanced Health uses Shield recharge speed instead.',
            min: 0,
            label: 'Base shield recharge speed (%/s)',
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, while the Health stat is not enhanced (100 or below).',
        }),

        curve('ShieldRechargeSpeed', {
            help: 'Shield recharge rate, as a percentage of total Shield HP per second, for an enhanced Health stat (100–200). Stat 100 means no enhancement. At 100 or lower, Base shield recharge speed applies.',
            domain: ENHANCED_STAT_DOMAIN,
            items: { min: 0 },
            label: 'Shield recharge speed (%/s)',
            description:
                'How fast your Shields recharge, in % of total Shield HP per ' +
                'second, at each enhanced Health stat value. Below 101, use ' +
                '<BaseShieldRechargeSpeed>.',
        }),

        numberField('PVEDamageResistance', {
            help: 'Damage resistance on Health (not Shields) in PvE, in %. It does not change with the Health stat.',
            min: 0,
            label: 'PvE health damage resistance (%)',
            description:
                'This number represents the percentage damage resistance applied ' +
                'to Health, not Shields, in PVE activities, independent of the ' +
                'Health stat value. The current value is 34.5.',
        }),
    ],
};
