import type { Ability, SuperAbility, Override, MovementClass } from './entities';
import type { Curve } from './curves';
import { entityRegistry } from './entities';
import { statRegistry } from './stats';
import { movementSpec } from './movement';
import { isRecord, type ValidationIssue } from './fields';

export type FieldValue = number | number[] | Curve;

export interface StatSource {
    Hash: number;
    Name: string;
    Fields: Record<string, FieldValue>;
    Abilities?: Ability[];
    SuperAbilities?: SuperAbility[];
    Overrides?: Override[];
    Notes?: string;
}

export interface MovementSource {
    EnhancedAthleticsHash: number;
    Classes: MovementClass[];
    Notes?: string;
}

export interface SourceSet {
    stats: StatSource[];
    movement: MovementSource;
}

/** Parsing checks JSON syntax and the root object; validateSources checks its contents. */
export type ParseResult<T> =
    { value: T; issues: [] } | { value?: never; issues: ValidationIssue[] };

function parse<T>(text: string): ParseResult<T> {
    try {
        const value: unknown = JSON.parse(text);
        if (!isRecord(value)) {
            return {
                issues: [{ path: '$', message: 'Expected source object', severity: 'error' }],
            };
        }
        return { value: value as T, issues: [] };
    } catch (e) {
        return { issues: [{ path: '$', message: (e as Error).message, severity: 'error' }] };
    }
}

export const parseStatSource = (text: string): ParseResult<StatSource> => parse<StatSource>(text);

export const parseMovementSource = (text: string): ParseResult<MovementSource> =>
    parse<MovementSource>(text);

function compare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

const entityCollectionKeys = new Set([
    ...statRegistry.flatMap((stat) => Object.keys(stat.collections)),
    ...Object.keys(movementSpec.collections),
]);

const order = [
    ...new Set([
        'Hash',
        'Name',
        'Fields',
        'EnhancedAthleticsHash',
        'Classes',
        'ClassHash',
        ...statRegistry.flatMap((s) => s.fields.map((f) => f.key)),
        ...Object.values(entityRegistry).flatMap((e) => e.fields.map((f) => f.key)),
        'Abilities',
        'SuperAbilities',
        'Overrides',
        'Values',
        'Domain',
        'Round',
        'Segments',
        'Type',
        'From',
        'To',
        'Value',
        'Points',
        'Expression',
        'Notes',
    ]),
];

function canonical(value: unknown, key = ''): unknown {
    if (Array.isArray(value)) {
        const list = [...value];
        if (entityCollectionKeys.has(key)) {
            list.sort((a: unknown, b: unknown) =>
                compare(
                    isRecord(a) ? String(a.Name ?? '') : '',
                    isRecord(b) ? String(b.Name ?? '') : '',
                ),
            );
        }
        return list.map((v) => canonical(v));
    }
    if (!isRecord(value)) {
        return value;
    }
    return Object.fromEntries(
        Object.keys(value)
            .sort((a, b) => {
                const ai = order.indexOf(a),
                    bi = order.indexOf(b);
                return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi) || compare(a, b);
            })
            .map((k) => [k, canonical(value[k], k)]),
    );
}

/** Stable four-space JSON with LF endings, sorted entity names and no input mutation. */
export const serializeSource = (value: StatSource | MovementSource): string =>
    JSON.stringify(canonical(value), null, 4) + '\n';

export const serializeStatSource = serializeSource;

export const serializeMovementSource = serializeSource;
