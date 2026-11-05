import { expandCurve, roundValue, type Curve } from './curves';
import { defaultConfig, type ExportConfig } from './config';
import { statRegistry, localeFields } from './stats';
import { movementSpec } from './movement';
import { localeId } from './locale';
import type { SourceSet } from './sources';
import type { EntitySpec, FieldSpec } from './fields';

export type ExportData = Record<string, unknown>;

export function exportFields(
    fields: readonly FieldSpec[],
    value: object,
    config: ExportConfig = defaultConfig,
): Record<string, unknown> {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
        fields
            .filter(
                (f) => f.exported !== false && f.published !== false && object[f.key] !== undefined,
            )
            .map((f) => {
                let result = object[f.key];
                if (f.kind === 'object' && f.entity) {
                    result = exportEntity(f.entity, result as object, config);
                } else if (f.kind === 'objectArray' && f.entity) {
                    result = (result as object[]).map((item) =>
                        exportEntity(f.entity!, item, config),
                    );
                } else if (f.kind === 'curve' && f.domain) {
                    result = expandCurve(result as Curve, f.domain, config.rounding);
                } else if (typeof result === 'number' && f.round !== undefined) {
                    result = roundValue(result, f.round);
                }
                return [f.key, result];
            }),
    );
}

export const exportEntity = (
    spec: EntitySpec,
    value: object,
    config: ExportConfig = defaultConfig,
): Record<string, unknown> => exportFields(spec.fields, value, config);

/** Builds the consumer JSON: locale IDs, expanded curves and exported fields only. */
export function exportSources(sources: SourceSet, options: Partial<ExportConfig> = {}): ExportData {
    const config = { ...defaultConfig, ...options };
    const result: ExportData = {};
    for (const spec of statRegistry) {
        const source = sources.stats.find((s) => s.Hash === spec.hash);
        if (!source) {
            throw new Error('Missing stat ' + spec.name);
        }
        const stat = {
            ...Object.fromEntries(
                localeFields(
                    Object.values(spec.collections).some((entity) => entity.role === 'ability'),
                ).map((f) => [f.key, localeId(spec.name, f.key)]),
            ),
            ...exportFields(spec.fields, source.Fields, config),
        };
        for (const [key, entity] of Object.entries(spec.collections)) {
            const entities = (source as unknown as Record<string, object[]>)[key] ?? [];
            const values = entities.map((v) => exportEntity(entity, v, config));
            if (config.placement === 'inStat') {
                stat[key] = values;
            } else {
                const collection = (result[key] ??= {}) as Record<string, unknown>;
                collection[String(spec.hash)] = values;
            }
        }
        result[String(spec.hash)] = stat;
    }
    result.Movement = {
        ...exportFields(movementSpec.fields, sources.movement, config),
        ...Object.fromEntries(
            Object.entries(movementSpec.collections).map(([key, entity]) => {
                const source = sources.movement as unknown as Record<string, object[]>;
                return [key, (source[key] ?? []).map((item) => exportEntity(entity, item, config))];
            }),
        ),
        ...Object.fromEntries(movementSpec.localeKeys.map((k) => [k, 'Movement.' + k])),
    };
    return result;
}

export const exportSourceSet = exportSources;
