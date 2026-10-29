import { expandCurve, validateCurve } from '../curves';
import {
    isRecord,
    type EntitySpec,
    type FieldSpec,
    type NumericConstraints,
    type ValidationIssue,
} from './types';

export function validateNumber(
    value: unknown,
    constraints: NumericConstraints = {},
    integer = false,
): string[] {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return ['Please provide a finite number'];
    }
    const errors: string[] = [];
    if (integer && !Number.isSafeInteger(value)) {
        errors.push('Please provide a safe integer');
    }
    if (constraints.min !== undefined && value < constraints.min) {
        errors.push('Must be >= ' + constraints.min);
    }
    if (constraints.max !== undefined && value > constraints.max) {
        errors.push('Must be <= ' + constraints.max);
    }
    if (constraints.exclusiveMin !== undefined && value <= constraints.exclusiveMin) {
        errors.push('Must be > ' + constraints.exclusiveMin);
    }
    if (constraints.exclusiveMax !== undefined && value >= constraints.exclusiveMax) {
        errors.push('Must be < ' + constraints.exclusiveMax);
    }
    return errors;
}

export function lengthMatches(value: unknown[], sibling: unknown, key: string): string[] {
    return Array.isArray(sibling) && value.length === sibling.length
        ? []
        : ['Array length must match ' + key + ' array length'];
}

export function validateField(
    spec: FieldSpec,
    value: unknown,
    siblings: Record<string, unknown> = {},
    path = spec.key,
): ValidationIssue[] {
    const issue = (message: string, at = path): ValidationIssue => ({
        path: at,
        message,
        severity: 'error',
    });

    if (value === undefined) {
        return spec.required ? [issue('Required field is unspecified')] : [];
    }
    if (spec.kind === 'enum') {
        return typeof value === 'string' && spec.values?.some((entry) => entry.value === value)
            ? []
            : [
                  issue(
                      'Expected one of: ' +
                          (spec.values ?? []).map((entry) => entry.value).join(', '),
                  ),
              ];
    }
    if (spec.kind === 'object') {
        return spec.entity
            ? validateEntity(spec.entity, value, path)
            : [issue('Object field has no entity spec')];
    }
    if (spec.kind === 'string' || spec.kind === 'localeRef') {
        if (typeof value !== 'string') {
            return [issue('Please provide a string')];
        }
        return spec.required && value.trim().length === 0
            ? [issue('Please provide a non-empty string')]
            : [];
    }
    if (spec.kind === 'curve') {
        if (!spec.domain) {
            return [issue('Curve field has no domain')];
        }
        const errors = validateCurve(value, spec.domain);
        if (errors.length) {
            return errors.map((e) => issue(e.message));
        }
        return expandCurve(value as Parameters<typeof expandCurve>[0], spec.domain).flatMap(
            (n, i) =>
                validateNumber(n, spec.items ?? {}, spec.items?.integer).map((m) =>
                    issue(m, path + '[' + i + ']'),
                ),
        );
    }
    if (spec.kind === 'numberArray' || spec.kind === 'intArray' || spec.kind === 'objectArray') {
        if (!Array.isArray(value)) {
            return [
                issue(
                    spec.kind === 'objectArray'
                        ? 'Expected entity array'
                        : 'Please provide an array of numbers',
                ),
            ];
        }
        const errors: ValidationIssue[] = [];
        if (value.length < (spec.minItems ?? 0)) {
            errors.push(issue('Must contain at least ' + spec.minItems + ' items'));
        }
        if (spec.maxItems !== undefined && value.length > spec.maxItems) {
            errors.push(issue('Must contain at most ' + spec.maxItems + ' items'));
        }
        if (spec.lengthOf) {
            errors.push(
                ...lengthMatches(value, siblings[spec.lengthOf], spec.lengthOf).map((m) =>
                    issue(m),
                ),
            );
        }
        if (spec.kind === 'objectArray') {
            return [
                ...errors,
                ...(spec.entity
                    ? validateCollection(spec.entity, value, path)
                    : [issue('Object array field has no entity spec')]),
            ];
        }
        const seen = new Set<unknown>();
        value.forEach((n, i) => {
            if (spec.uniqueItems && seen.has(n)) {
                errors.push(issue('Duplicate value: ' + String(n), path + '[' + i + ']'));
            }
            seen.add(n);
            errors.push(
                ...validateNumber(n, spec.items ?? {}, spec.kind === 'intArray').map((m) =>
                    issue(m, path + '[' + i + ']'),
                ),
            );
        });
        return errors;
    }
    const errors = validateNumber(
        value,
        spec.kind === 'hash' ? { min: 0, max: 4294967295, ...spec } : spec,
        spec.kind !== 'number',
    ).map((m) => issue(m));
    if (spec.kind === 'hash' && spec.warnIfZero && value === 0) {
        errors.push({ path, message: 'Unverified manifest hash (0)', severity: 'warning' });
    }
    return errors;
}

export function validateEntity(
    spec: EntitySpec,
    value: unknown,
    path = spec.name,
): ValidationIssue[] {
    if (!isRecord(value)) {
        return [{ path, message: 'Expected object', severity: 'error' }];
    }
    const errors = spec.fields.flatMap((f) =>
        validateField(f, value[f.key], value, path + '.' + f.key),
    );
    for (const key of Object.keys(value)) {
        if (!spec.fields.some((f) => f.key === key)) {
            errors.push({ path: path + '.' + key, message: 'Unknown field', severity: 'error' });
        }
    }
    if (spec.anyOf && !spec.anyOf.some((group) => group.every((key) => value[key] !== undefined))) {
        errors.push({
            path,
            message:
                'Please specify at least one of ' +
                spec.anyOf.map((g) => g.join(' and ')).join(', '),
            severity: 'error',
        });
    }
    return errors;
}

export function validateCollection(
    spec: EntitySpec,
    values: unknown,
    path = spec.name,
): ValidationIssue[] {
    if (!Array.isArray(values)) {
        return [{ path, message: 'Expected entity array', severity: 'error' }];
    }
    const seen = new Set<unknown>();
    return values.flatMap((v, i) => {
        const errors = validateEntity(spec, v, path + '[' + i + ']');
        const key = spec.uniqueKey ?? 'Hash';
        if (isRecord(v) && v[key] !== undefined) {
            if (seen.has(v[key])) {
                errors.push({
                    path: path + '[' + i + '].' + key,
                    message: 'Duplicate ' + key + ': ' + String(v[key]),
                    severity: 'error',
                });
            }
            seen.add(v[key]);
        }
        return errors;
    });
}
