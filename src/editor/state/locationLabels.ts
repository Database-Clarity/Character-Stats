import { isRecord, movementSpec, statRegistry, type EntitySpec, type FieldSpec } from '../../core';
import { collectionLabel, sentenceCase } from '../components/textFormat';
import { identityKey, issueTarget, type ChangeTarget } from './editing';
import { localeEntryLabel } from './localeText';
import type { MergeConflict } from './merge';
import { LOCALE_FILE, MOVEMENT_FILE } from './paths';

const SEPARATOR = ' › ';

/** Registry labels for a dotted field path; a numeric index becomes a 1-based row number. */
export function fieldPathLabels(fields: readonly FieldSpec[] | undefined, path: string): string[] {
    const labels: string[] = [];
    let current = fields;
    for (const part of path.split('.').filter(Boolean)) {
        if (/^\d+$/.test(part)) {
            if (labels.length) labels[labels.length - 1] += ` ${Number(part) + 1}`;
            continue;
        }
        const spec = current?.find((field) => field.key === part);
        labels.push(spec?.label ?? sentenceCase(part));
        current = spec?.entity?.fields;
    }
    return labels;
}

const specFor = (stat: string) =>
    stat === movementSpec.name ? movementSpec : statRegistry.find((spec) => spec.name === stat);
const collectionsOf = (stat: string): Readonly<Record<string, EntitySpec>> =>
    specFor(stat)?.collections ?? {};

/** Readable label for the field a change or issue points at, e.g. `Base cooldown (s)`. */
export function fieldLabel(target: ChangeTarget, source?: Record<string, unknown>): string {
    const spec = specFor(target.stat);
    if (!spec || !target.field) return target.field;
    if (target.tab === 'Text')
        return localeEntryLabel(target.field, target.stat, spec.collections, source ?? {});
    const entity = target.tab === 'Fields' ? undefined : collectionsOf(target.stat)[target.tab];
    const fields = target.tab === 'Fields' ? spec.fields : entity?.fields;
    return fieldPathLabels(fields, target.field).join(SEPARATOR) || target.field;
}

type Sources = { stats: readonly unknown[]; movement: unknown };

/** The source document (stat or movement) that holds a stat's collections. */
export function statRoot(sources: Sources, stat: string): Record<string, unknown> {
    const root =
        stat === movementSpec.name
            ? sources.movement
            : sources.stats.find((s) => isRecord(s) && s.Name === stat);
    return isRecord(root) ? root : {};
}

/**
 * Readable location for a core validation path, e.g. `stats[1].Abilities[9].Name` becomes
 * `Grenade › Abilities › Flux Grenade › Name`. Falls back to the raw path when it has no
 * editor location.
 */
export function issueLocationLabel(path: string, sources: Sources): string {
    const target = issueTarget(path, sources);
    return target ? targetLocationLabel(target, sources) : path;
}

function targetLocationLabel(target: ChangeTarget, sources: Sources): string {
    const root = statRoot(sources, target.stat);
    const parts = [target.stat];
    if (target.tab === 'Text') parts.push('Text');
    else if (target.tab !== 'Fields') {
        parts.push(collectionLabel(target.tab));
        const entity = collectionsOf(target.stat)[target.tab];
        const items = root[target.tab];
        if (target.itemKey !== undefined && entity && Array.isArray(items)) {
            const key = identityKey(entity);
            const item = items.find((i) => isRecord(i) && String(i[key]) === target.itemKey);
            const name = isRecord(item) ? item.Name : undefined;
            parts.push(typeof name === 'string' && name.trim() ? name : target.itemKey);
        }
    }
    const field = fieldLabel(target, root);
    if (field) parts.push(field);
    return parts.join(SEPARATOR);
}

/** Readable location of a merge conflict, e.g. `Grenade › Abilities › Flux Grenade › Base cooldown (s)`. */
export function conflictLabel(
    conflict: MergeConflict,
    sources: Sources,
    fileValue: unknown,
): string {
    const [first, second, ...rest] = conflict.path;
    if (conflict.file === LOCALE_FILE) {
        const target = issueTarget(`locale.${conflict.path.map(String).join('.')}`, sources);
        return target ? targetLocationLabel(target, sources) : conflict.file;
    }
    const stat =
        conflict.file === MOVEMENT_FILE
            ? movementSpec.name
            : isRecord(fileValue) && typeof fileValue.Name === 'string'
              ? fileValue.Name
              : undefined;
    if (!stat) return conflict.file;
    const collection = typeof first === 'string' ? collectionsOf(stat)[first] : undefined;
    const named = (conflict.ours ?? conflict.theirs ?? conflict.base) as unknown;
    const target: ChangeTarget =
        collection && typeof first === 'string'
            ? {
                  stat,
                  tab: first,
                  ...(typeof second === 'object' ? { itemKey: second.id } : {}),
                  field: rest.map(String).join('.'),
              }
            : {
                  stat,
                  tab: 'Fields',
                  // Stat sources nest their fields under `Fields`; movement paths are used as is.
                  field: (first === 'Fields' && conflict.file !== MOVEMENT_FILE
                      ? conflict.path.slice(1)
                      : conflict.path
                  )
                      .map(String)
                      .join('.'),
              };
    const label = targetLocationLabel(target, sources);
    const entityName = isRecord(named) && typeof named.Name === 'string' ? named.Name : '';
    // A removed entity is no longer in the working copy, so fall back to its name from the conflict.
    return typeof second === 'object' &&
        rest.length === 0 &&
        entityName &&
        label.endsWith(second.id)
        ? label.slice(0, -second.id.length) + entityName
        : label;
}

/** Short single-line text for a conflict value; `undefined` means the entry was removed. */
export function summarizeValue(value: unknown, max = 80): string {
    if (value === undefined) return '(removed)';
    const text = typeof value === 'string' ? JSON.stringify(value) : (JSON.stringify(value) ?? '');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
