import { type EntitySpec, type FieldSpec } from './fields';
import { entityRegistry } from './entities';
import { statRegistry, localeFields } from './stats';
import { movementSpec } from './movement';
import { defaultConfig, type ExportConfig } from './config';

export type JsonSchema = Record<string, unknown>;

function numeric(spec: {
    min?: number;
    max?: number;
    exclusiveMin?: number;
    exclusiveMax?: number;
}): JsonSchema {
    return {
        ...(spec.min === undefined ? {} : { minimum: spec.min }),
        ...(spec.max === undefined ? {} : { maximum: spec.max }),
        ...(spec.exclusiveMin === undefined ? {} : { exclusiveMinimum: spec.exclusiveMin }),
        ...(spec.exclusiveMax === undefined ? {} : { exclusiveMaximum: spec.exclusiveMax }),
    };
}

export function fieldSchema(field: FieldSpec): JsonSchema {
    const mapping =
        field.kind === 'curve' && field.domain
            ? ` Stat values ${field.domain[0]}-${field.domain[1]}: index = stat value${field.domain[0] === 0 ? '' : ` - ${field.domain[0]}`}.`
            : '';
    const schema: JsonSchema = { description: field.description + mapping };
    if (field.kind === 'localeRef') {
        return { $ref: '#/definitions/' + field.key, ...schema };
    }
    if (field.kind === 'enum') {
        return {
            type: 'string',
            enum: (field.values ?? []).map((entry) => entry.value),
            oneOf: (field.values ?? []).map((entry) => ({
                const: entry.value,
                description: entry.description,
            })),
            ...schema,
        };
    }
    if (field.kind === 'object' && field.entity)
        return { ...entitySchema(field.entity), ...schema };
    if (field.kind === 'objectArray' && field.entity) {
        return {
            type: 'array',
            items: entitySchema(field.entity),
            ...(field.minItems === undefined ? {} : { minItems: field.minItems }),
            ...(field.maxItems === undefined ? {} : { maxItems: field.maxItems }),
            ...schema,
        };
    }
    if (field.kind === 'string') {
        return { type: 'string', ...(field.required ? { minLength: 1 } : {}), ...schema };
    }
    if (field.kind === 'curve' || field.kind === 'intArray' || field.kind === 'numberArray') {
        const length = field.domain ? field.domain[1] - field.domain[0] + 1 : undefined;
        return {
            type: 'array',
            items: {
                type: field.kind === 'intArray' || field.items?.integer ? 'integer' : 'number',
                ...numeric(field.items ?? {}),
            },
            ...(length !== undefined
                ? { minItems: length, maxItems: length }
                : {
                      ...(field.minItems === undefined ? {} : { minItems: field.minItems }),
                      ...(field.maxItems === undefined ? {} : { maxItems: field.maxItems }),
                  }),
            ...(field.uniqueItems ? { uniqueItems: true } : {}),
            ...schema,
        };
    }
    return {
        type: field.kind === 'number' ? 'number' : 'integer',
        ...numeric(field.kind === 'hash' ? { min: 0, max: 4294967295, ...field } : field),
        ...schema,
    };
}

function objectSchema(
    fields: readonly FieldSpec[],
    extra: Record<string, JsonSchema> = {},
): JsonSchema {
    const exported = fields.filter((f) => f.exported !== false && f.published !== false);
    return {
        type: 'object',
        additionalProperties: false,
        properties: {
            ...Object.fromEntries(exported.map((f) => [f.key, fieldSchema(f)])),
            ...extra,
        },
        required: [...exported.filter((f) => f.required).map((f) => f.key), ...Object.keys(extra)],
    };
}

function entitySchema(spec: EntitySpec): JsonSchema {
    const anyOf = spec.anyOf?.map((group) =>
        group.filter((key) =>
            spec.fields.some(
                (field) =>
                    field.key === key && field.exported !== false && field.published !== false,
            ),
        ),
    );
    return {
        title: spec.name,
        ...objectSchema(spec.fields),
        ...(anyOf?.length && anyOf.every((group) => group.length)
            ? { anyOf: anyOf.map((required) => ({ required })) }
            : {}),
    };
}

export function generateSchema(options: Partial<ExportConfig> = {}): JsonSchema {
    const config = { ...defaultConfig, ...options };
    const definitions: Record<string, JsonSchema> = {};
    definitions.LocaleString = {
        type: 'string',
        description:
            'Contains a locale ID that you can use to grab the description for ' +
            'the item in your selected language. The ID is provided in a ' +
            '[key].[value] format where there can be an arbitrary number of ' +
            "keys (though it'll usually be 1). Then you can use these keys and " +
            'values to query the <./locale/[language code].json> files for the ' +
            'desired description. These descriptions are intended to be ' +
            'surfaced to users of apps using the data in this repository and ' +
            'provide crucial context to the values shown to them.',
    };
    definitions.DynamicLocaleString = {
        type: 'string',
        description:
            'The difference between this and LocaleString is that this one ' +
            'supports dynamically replaceable substrings, such as ' +
            '{{FlinchResistance}} or {{OrbOfPowerHealthRestore}} which will be ' +
            'filled-in from a property of each Character Stat with the same ' +
            'name. For example, {{FlinchResistance}} will be replaced with the ' +
            'value of the <FlinchResistance> property of the Character Stat. ' +
            'A numeric property can use an explicit formatter, such as ' +
            '{{EnergyGainScalar|ScalarPercent}}, to multiply a scalar by 100 ' +
            'and append a percent sign. This does not change the value of the ' +
            'exported property or the behavior of the existing {{Field}}{{Percent}} ' +
            'form, where Percent is a literal percent sign. ' +
            'AbilityName, ChargeCount, ChargeBasedScaling, BaseDuration and SuperDuration ' +
            'are contextual tokens supplied by the consumer per ability, not stat properties. ' +
            '{{ChargeBasedScaling|ChargeList}} lists the increase per stored charge joined ' +
            'by | (for example 0%|41.5%|125%) and {{ChargeCount|ChargeList}} lists the matching ' +
            'charge counts (0|1|2). ' +
            'BaseDuration is the source ability duration; SuperDuration is the calculated ' +
            'duration after applying SuperDurationIncrease where BaseDuration is defined.',
    };
    for (const f of localeFields(true)) {
        definitions[f.key] = {
            $ref:
                '#/definitions/' + (f.key === 'Overview' ? 'LocaleString' : 'DynamicLocaleString'),
            description: f.description,
        };
    }
    for (const spec of Object.values(entityRegistry)) {
        for (const field of spec.fields.filter((entry) => entry.kind === 'localeRef')) {
            definitions[field.key] = {
                $ref: '#/definitions/DynamicLocaleString',
                description: field.description,
            };
        }
        definitions[spec.name] = entitySchema(spec);
    }
    const topLevelCollections: Record<string, Record<string, JsonSchema>> = {};
    for (const stat of statRegistry) {
        const collections = Object.fromEntries(
            Object.entries(stat.collections).map(([key, entity]) => [
                key,
                { type: 'array', items: { $ref: '#/definitions/' + entity.name } },
            ]),
        );
        if (config.placement === 'topLevel') {
            for (const [key, schema] of Object.entries(collections)) {
                (topLevelCollections[key] ??= {})[String(stat.hash)] = schema;
            }
        }
        definitions[stat.name] = {
            title: stat.name + ' Stat',
            ...objectSchema(
                [
                    ...localeFields(
                        Object.values(stat.collections).some((entity) => entity.role === 'ability'),
                    ),
                    ...stat.fields,
                ],
                config.placement === 'inStat' ? collections : {},
            ),
        };
    }
    definitions.Movement = objectSchema(movementSpec.fields, {
        ...Object.fromEntries(
            Object.entries(movementSpec.collections).map(([key, entity]) => [
                key,
                { type: 'array', items: { $ref: '#/definitions/' + entity.name } },
            ]),
        ),
        ...Object.fromEntries(
            movementSpec.localeKeys.map((k) => [
                k,
                { type: 'string', description: 'Locale ID for Movement.' + k },
            ]),
        ),
    });
    const properties: Record<string, JsonSchema> = {
        ...Object.fromEntries(
            statRegistry.map((s) => [String(s.hash), { $ref: '#/definitions/' + s.name }]),
        ),
        Movement: { $ref: '#/definitions/Movement' },
    };
    for (const [key, collections] of Object.entries(topLevelCollections)) {
        properties[key] = {
            type: 'object',
            additionalProperties: false,
            properties: collections,
            required: Object.keys(collections),
        };
    }
    definitions.CharacterStats = {
        title: 'CharacterStats',
        description:
            'Root keys are decimal-string stat manifest hashes plus the non-hash Movement key.',
        type: 'object',
        additionalProperties: false,
        properties,
        required: Object.keys(properties),
    };
    return {
        $schema: 'http://json-schema.org/draft-06/schema',
        $id: 'https://github.com/Database-Clarity/Character-Stats/blob/master/schema.json',
        $ref: '#/definitions/CharacterStats',
        definitions,
    };
}

export const serializeSchema = (schema = generateSchema()): string =>
    JSON.stringify(schema, null, 4) + '\n';
