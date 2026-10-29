import type { FieldSpec } from '../fields';
import type { EntitySpec } from '../fields';

export const ENHANCED_STAT_DOMAIN = [100, 200] as const;

export interface StatSpec {
    name: string;
    hash: number;
    abilityKind?: 'grenade' | 'melee' | 'class' | 'super';
    fields: readonly FieldSpec[];
    collections: Readonly<Record<string, EntitySpec>>;
}
