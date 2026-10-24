import type { FieldSpec } from '../fields';
import type { EntitySpec } from '../fields';

export interface StatSpec {
    name: string;
    hash: number;
    abilityKind?: 'grenade' | 'melee' | 'class' | 'super';
    fields: readonly FieldSpec[];
    collections: Readonly<Record<string, EntitySpec>>;
}
