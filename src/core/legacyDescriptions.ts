import { generateSchema, type JsonSchema } from './schemaGen';

function collectDescriptions(): Readonly<Record<string, string>> {
    const schema = generateSchema();
    const definitions = schema.definitions as Record<string, JsonSchema>;
    const result: Record<string, string> = {};

    for (const [name, definition] of Object.entries(definitions)) {
        if (typeof definition.description === 'string') {
            result[name] = definition.description;
        }

        const properties = definition.properties as Record<string, JsonSchema> | undefined;
        for (const [key, field] of Object.entries(properties ?? {})) {
            if (typeof field.description === 'string') {
                result[name + '.' + key] = field.description;
            }
        }
    }

    return result;
}

/** Legacy lookup derived from inline specs; new code should read the specs directly. */

export const descriptions = collectDescriptions();
