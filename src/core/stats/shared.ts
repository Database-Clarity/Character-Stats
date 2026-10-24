import type { Domain } from '../curves';
import type { FieldSpec } from '../fields/types';
import { localeField } from '../fields/builders';
import { statRegistry } from './index';

export function localeFields(abilities = false): FieldSpec[] {
    const fields = [
        localeField('Overview', {
            description:
                'Contains a high-level overview of the Character Stat and ' +
                "essentially serves as a replacement of Bungie's native stat " +
                'description.',
        }),

        localeField('BaseStatTooltip', {
            description:
                'Contains a dynamic tooltip for the base version of the stat ' +
                '(0-100 points). These properties can either be numbers or arrays ' +
                "of numbers, depending on the property. If it's an array, the " +
                'index of the array will be used to determine which value to use ' +
                'based on the Character Stat value. For example, if the ' +
                '<FlinchResistance> property is an array, then ' +
                '{{FlinchResistance}} will be replaced with the value at the index ' +
                'corresponding to the stat value, clamped to the field domain (0-100 for ' +
                'FlinchResistance).',
        }),

        localeField('EnhancedStatTooltip', {
            description:
                'Contains a dynamic tooltip for the enhanced version of the stat ' +
                '(100-200 points). These properties can either be numbers or ' +
                "arrays of numbers, depending on the property. If it's an array, " +
                'the index of the array will be used to determine which value to ' +
                'use based on the Character Stat value. For example, if the ' +
                '<FlinchResistance> property is an array, then ' +
                '{{FlinchResistance}} will be replaced with the value at the index ' +
                'corresponding to the stat value, clamped to the field domain (0-100 for ' +
                'FlinchResistance).',
        }),
    ];

    if (abilities) {
        fields.push(
            localeField('ChargeBasedScalingTooltip', {
                description:
                    'This is a description of the Charge-based Scaling behavior of ' +
                    'certain abilities. It is used to explain how the passive recharge ' +
                    'speed of an ability may be increased by the number of active ' +
                    'charges stored up. AbilityName, ChargeCount and ChargeBasedScaling are ' +
                    'contextual tokens supplied by the consumer per ability, not stat properties. This tooltip is intended to be displayed only ' +
                    'if the <ChargeBasedScaling> property is present in the <Ability> ' +
                    'object. You can see an example of how this should be formatted ' +
                    'here: ' +
                    'https://github.com/Database-Clarity/Character-Stats/' +
                    'blob/master/CBSD_example.md',
            }),
        );
    }

    return fields;
}

function registeredField(stat: string, key: string): FieldSpec {
    const spec = statRegistry.find((spec) => spec.name === stat);
    const field = spec?.fields.find((field) => field.key === key);

    if (!field) {
        throw new Error('Unknown registered field: ' + stat + '.' + key);
    }

    return field;
}

/** Compatibility helper; new stat definitions should use the explicit curve builder. */

export function curveField(stat: string, key: string, domain: Domain, integer = false): FieldSpec {
    const field = registeredField(stat, key);

    return {
        ...field,
        kind: 'curve',
        domain,
        items: { min: 0, ...(integer ? { integer: true } : {}) },
    };
}

/** Compatibility helper; new definitions should use numberField or integerField. */

export function scalarField(stat: string, key: string, integer = false): FieldSpec {
    return {
        ...registeredField(stat, key),
        kind: integer ? 'int' : 'number',
        min: 0,
    };
}
