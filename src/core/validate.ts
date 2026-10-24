import {
    collectionItems,
    isAbilityRole,
    isRecord,
    validateEntity,
    validateCollection,
    type ValidationIssue,
} from './fields';
import { statRegistry, localeFields } from './stats';
import { movementSpec } from './movement';
import { localeId, resolveLocale, validatePlaceholders, type LocaleData } from './locale';

/** Checks a complete source set; warnings are reported but do not block publishing. */
export function validateSources(input: unknown, locale?: LocaleData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const error = (path: string, message: string) =>
        issues.push({ path, message, severity: 'error' });

    if (!isRecord(input)) {
        return [{ path: '$', message: 'Expected SourceSet', severity: 'error' }];
    }
    if (!Array.isArray(input.stats)) {
        error('stats', 'Expected stat source array');
    }
    const stats: unknown[] = Array.isArray(input.stats) ? input.stats : [];
    const seen = new Set<string>();
    stats.forEach((source, i) => {
        const path = 'stats[' + i + ']';
        if (!isRecord(source)) {
            error(path, 'Expected stat source object');
            return;
        }
        const spec = statRegistry.find((s) => s.name === source.Name);
        if (!spec) {
            error(path + '.Name', 'Unknown stat');
            return;
        }
        if (seen.has(spec.name)) {
            error(path + '.Name', 'Duplicate stat ' + spec.name);
        }
        seen.add(spec.name);
        if (source.Hash !== spec.hash) {
            error(path + '.Hash', 'Expected manifest hash ' + spec.hash);
        }
        issues.push(
            ...validateEntity(
                { name: spec.name, fields: spec.fields },
                source.Fields,
                path + '.Fields',
            ),
        );
        for (const key of Object.keys(source)) {
            if (
                !['Hash', 'Name', 'Fields', 'Notes', ...Object.keys(spec.collections)].includes(key)
            ) {
                error(path + '.' + key, 'Unknown source field or collection');
            }
        }
        for (const [key, entity] of Object.entries(spec.collections)) {
            issues.push(...validateCollection(entity, source[key], path + '.' + key));
        }
        const abilities = collectionItems(source, spec.collections, (entity) =>
            isAbilityRole(entity.role),
        );
        const hashes = new Set(abilities.map((ability) => ability.Hash));
        for (const [key, entity] of Object.entries(spec.collections)) {
            if (entity.role !== 'override' || !Array.isArray(source[key])) continue;
            source[key].forEach((override: unknown, index: number) => {
                if (!isRecord(override)) return;
                for (const field of entity.fields.filter((field) => field.itemRef === 'ability')) {
                    const requirements = override[field.key];
                    if (!Array.isArray(requirements)) continue;
                    requirements.forEach((hash: unknown, requirementIndex: number) => {
                        if (typeof hash === 'number' && hash > 0 && !hashes.has(hash)) {
                            issues.push({
                                path: `${path}.${key}[${index}].${field.key}[${requirementIndex}]`,
                                message: 'Ability hash ' + hash + ' is not present in this stat',
                                severity: 'warning',
                            });
                        }
                    });
                }
            });
        }
        if (locale) {
            for (const f of localeFields(
                Object.values(spec.collections).some((entity) => entity.role === 'ability'),
            )) {
                const id = localeId(spec.name, f.key),
                    text = resolveLocale(locale, id);
                if (text === undefined) {
                    error('locale.' + id, 'Missing English locale string');
                } else {
                    issues.push(
                        ...validatePlaceholders(
                            text,
                            spec.fields.map((f) => f.key),
                            'locale.' + id,
                        ),
                    );
                }
            }
        }
    });
    for (const spec of statRegistry) {
        if (!seen.has(spec.name)) {
            error('stats', 'Missing stat ' + spec.name);
        }
    }
    const movement = input.movement;
    if (!isRecord(movement)) {
        error('movement', 'Expected Movement source');
    } else {
        const fields = Object.fromEntries(movementSpec.fields.map((f) => [f.key, movement[f.key]]));
        issues.push(
            ...validateEntity(
                { name: 'Movement', fields: movementSpec.fields },
                fields,
                'movement',
            ),
        );
        for (const [key, spec] of Object.entries(movementSpec.collections)) {
            issues.push(...validateCollection(spec, movement[key], 'movement.' + key));
        }
        if (Array.isArray(movement.Sources)) {
            movement.Sources.forEach((source: unknown, index: number) => {
                if (!isRecord(source)) return;
                const path = 'movement.Sources[' + index + ']';
                if (
                    source.Activation === 'Conditional' &&
                    locale &&
                    !resolveLocale(
                        locale,
                        'Movement.Sources.' + String(source.Hash) + '.Condition',
                    )?.trim()
                ) {
                    issues.push({
                        path: 'locale.Movement.Sources.' + String(source.Hash) + '.Condition',
                        message: 'Conditional movement source is missing English Condition text',
                        severity: 'warning',
                    });
                }
                if (Array.isArray(source.Effects))
                    source.Effects.forEach((effect: unknown, effectIndex: number) => {
                        if (!isRecord(effect)) return;
                        if (
                            effect.BoostedValues !== undefined &&
                            !Array.isArray(source.BoostRequiresAll)
                        )
                            error(
                                path + '.BoostRequiresAll',
                                'BoostedValues requires BoostRequiresAll',
                            );
                        for (const key of ['Values', 'BoostedValues']) {
                            const values = effect[key];
                            if (!Array.isArray(values)) continue;
                            values.forEach((value: unknown, valueIndex: number) => {
                                if (typeof value !== 'number') return;
                                if (
                                    effect.Type === 'MobilityTiers'
                                        ? !Number.isSafeInteger(value)
                                        : value <= 0
                                ) {
                                    error(
                                        path +
                                            '.Effects[' +
                                            effectIndex +
                                            '].' +
                                            key +
                                            '[' +
                                            valueIndex +
                                            ']',
                                        effect.Type === 'MobilityTiers'
                                            ? 'Mobility tiers must be safe integers'
                                            : 'Movement multipliers must be positive',
                                    );
                                }
                            });
                        }
                    });
            });
        }
        if (locale)
            for (const key of movementSpec.localeKeys) {
                const id = 'Movement.' + key;
                const text = resolveLocale(locale, id);
                if (text === undefined) error('locale.' + id, 'Missing English locale string');
                else issues.push(...validatePlaceholders(text, [], 'locale.' + id));
            }
        for (const key of Object.keys(movement)) {
            if (
                ![
                    ...movementSpec.fields.map((f) => f.key),
                    ...Object.keys(movementSpec.collections),
                    'Notes',
                ].includes(key)
            ) {
                error('movement.' + key, 'Unknown movement field');
            }
        }
    }
    return issues;
}

export const validateSourceSet = validateSources;
