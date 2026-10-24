import type { FieldSpec } from '../fields';
import type { EntitySpec } from '../fields';

export interface StatSpec {
    name: string;
    hash: number;
    fields: readonly FieldSpec[];
    collections: Readonly<Record<string, EntitySpec>>;
}
