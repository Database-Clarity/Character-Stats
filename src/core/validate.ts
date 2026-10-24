import { isRecord, validateEntity, validateCollection, type ValidationIssue } from './fields';
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
        let abilities: unknown[] = [];
        if (Array.isArray(source.Abilities)) {
            abilities = source.Abilities;
        } else if (Array.isArray(source.SuperAbilities)) {
            abilities = source.SuperAbilities;
        }
        const hashes = new Set(abilities.filter(isRecord).map((a) => a.Hash));
        if (Array.isArray(source.Overrides)) {
            source.Overrides.forEach((o: unknown, j: number) => {
                if (isRecord(o) && Array.isArray(o.Requirements)) {
                    o.Requirements.forEach((hash: unknown, k: number) => {
                        if (typeof hash === 'number' && hash > 0 && !hashes.has(hash)) {
                            issues.push({
                                path: path + '.Overrides[' + j + '].Requirements[' + k + ']',
                                message: 'Ability hash ' + hash + ' is not present in this stat',
                                severity: 'warning',
                            });
                        }
                    });
                }
            });
        }
        if (locale) {
            for (const f of localeFields('Abilities' in spec.collections)) {
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
