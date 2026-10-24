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
    kind: 'int' | 'number' | 'string' | 'hash' | 'numberArray' | 'intArray' | 'curve' | 'localeRef';
    required?: boolean;
    description: string;
    minItems?: number;
    maxItems?: number;
    lengthOf?: string;
    items?: NumericConstraints & { integer?: boolean };
    domain?: Domain;
    round?: number;
    exported?: boolean;
    label?: string;
    multiline?: boolean;
    group?: string;
}

export interface EntitySpec {
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
