import type { Domain } from '../curves';

export interface NumericConstraints {
    min?: number;
    max?: number;
    exclusiveMin?: number;
    exclusiveMax?: number;
}

/** A field definition shared by validation, export, schema generation and editor forms. */
export interface FieldSpec extends NumericConstraints {
    key: string;
    kind:
        | 'int'
        | 'number'
        | 'string'
        | 'hash'
        | 'numberArray'
        | 'intArray'
        | 'curve'
        | 'localeRef'
        | 'enum'
        | 'object'
        | 'objectArray';
    values?: readonly { value: string; description: string }[];
    entity?: EntitySpec;
    required?: boolean;
    description: string;
    minItems?: number;
    maxItems?: number;
    lengthOf?: string;
    items?: NumericConstraints & { integer?: boolean };
    domain?: Domain;
    round?: number;
    exported?: boolean;
    published?: boolean;
    warnIfZero?: boolean;
    label?: string;
    multiline?: boolean;
    group?: string;
    itemRef?: 'ability' | 'item' | 'any';
    refSubclassFilters?: boolean;
    indexLabel?: string;
}

export type EntityRole = 'ability' | 'superAbility' | 'override' | 'movementClass';

export const isAbilityRole = (role: EntityRole | undefined): boolean =>
    role === 'ability' || role === 'superAbility';

export interface EntitySpec {
    role?: EntityRole;
    name: string;
    fields: readonly FieldSpec[];
    anyOf?: readonly (readonly string[])[];
    uniqueKey?: string;
}

export interface ValidationIssue {
    path: string;
    message: string;
    severity: 'error' | 'warning';
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

/** Reads registered collections without assuming their public JSON key names. */
export function collectionItems(
    source: unknown,
    collections: Readonly<Record<string, EntitySpec>>,
    matches: (spec: EntitySpec) => boolean,
): Record<string, unknown>[] {
    if (!isRecord(source)) return [];
    return Object.entries(collections).flatMap(([key, spec]) => {
        const items = source[key];
        return matches(spec) && Array.isArray(items) ? items.filter(isRecord) : [];
    });
}
