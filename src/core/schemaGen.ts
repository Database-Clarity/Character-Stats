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
    const schema: JsonSchema = { description: field.description };
    if (field.kind === 'localeRef') {
        return { $ref: '#/definitions/' + field.key, ...schema };
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
    const exported = fields.filter((f) => f.exported !== false);
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
    return {
        title: spec.name,
        ...objectSchema(spec.fields),
        ...(spec.anyOf ? { anyOf: spec.anyOf.map((required) => ({ required })) } : {}),
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
            'value of the <FlinchResistance> property of the Character Stat.',
    };
    for (const f of localeFields(true)) {
        definitions[f.key] = {
            $ref:
                '#/definitions/' + (f.key === 'Overview' ? 'LocaleString' : 'DynamicLocaleString'),
            description: f.description,
        };
    }
    for (const spec of Object.values(entityRegistry)) {
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
                [...localeFields('Abilities' in stat.collections), ...stat.fields],
                config.placement === 'inStat' ? collections : {},
            ),
        };
    }
    definitions.Movement = objectSchema(movementSpec.fields, {
        Classes: { type: 'array', items: { $ref: '#/definitions/MovementClass' } },
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
        type: 'object',
        additionalProperties: false,
        properties,
        required: Object.keys(properties),
    };
    return {
        $schema: 'http://json-schema.org/draft-06/schema',
        $id: 'https://github.com/StardustD2/Destiny-2-Character-Stats/blob/main/schema.json',
        $ref: '#/definitions/CharacterStats',
        definitions,
    };
}

export const serializeSchema = (schema = generateSchema()): string =>
    JSON.stringify(schema, null, 4) + '\n';
