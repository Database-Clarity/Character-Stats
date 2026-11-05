import { isRecord, movementSpec, statRegistry, type EntitySpec } from '../../core';
import { identityKey, sameValue } from './editing';
import { LOCALE_FILE, MOVEMENT_FILE } from './paths';

/** A key in an object, or one entity of an identity-keyed array. */
export type PathSegment = string | { id: string; key: string };

export interface MergeConflict {
    /** Stable per file + location. */
    id: string;
    file: string;
    /** Empty for a whole-file conflict. Absent values are `undefined`. */
    path: PathSegment[];
    base: unknown;
    ours: unknown;
    theirs: unknown;
}

export type Resolution = 'ours' | 'theirs';

export interface MergeResult {
    /** The merged value; each conflict holds our value until it is resolved. */
    value: unknown;
    conflicts: MergeConflict[];
}

/** Identity field of the entity array at `path`, or undefined to merge the array as one value. */
export type IdentityAt = (path: readonly PathSegment[]) => string | undefined;

/** JSON-pointer-style escaping, plus the characters that delimit entity segments. */
const ESCAPED = '~/[]=';
const escapeText = (text: string) =>
    text.replace(/[~/[\]=]/g, (character) => `~${ESCAPED.indexOf(character)}`);
const segmentText = (segment: PathSegment) =>
    typeof segment === 'string'
        ? escapeText(segment)
        : `[${escapeText(segment.key)}=${escapeText(segment.id)}]`;
export const conflictId = (file: string, path: readonly PathSegment[]) =>
    `${file}#/${path.map(segmentText).join('/')}`;

function identities(items: readonly unknown[], key: string): string[] | undefined {
    const ids: string[] = [];
    for (const item of items) {
        if (!isRecord(item) || item[key] === undefined || item[key] === null) return undefined;
        ids.push(String(item[key]));
    }
    return new Set(ids).size === ids.length ? ids : undefined;
}

const keep = (ids: readonly string[], other: readonly string[]) =>
    ids.filter((id) => other.includes(id));
const reordered = (side: readonly string[], base: readonly string[]) =>
    keep(side, base).join('\0') !== keep(base, side).join('\0');

/**
 * Three-way merge of JSON values at path level. Non-overlapping changes apply, identical changes
 * collapse, and a path changed differently on both sides is a conflict. Entity arrays merge per
 * entity; every other array and scalar merges as one value.
 */
export function mergeJson(
    file: string,
    base: unknown,
    ours: unknown,
    theirs: unknown,
    identityAt: IdentityAt = () => undefined,
): MergeResult {
    const conflicts: MergeConflict[] = [];
    function node(b: unknown, o: unknown, t: unknown, path: PathSegment[]): unknown {
        if (sameValue(o, t)) return o;
        if (sameValue(b, o)) return t;
        if (sameValue(b, t)) return o;
        if (isRecord(o) && isRecord(t) && isRecord(b)) {
            const result: Record<string, unknown> = {};
            for (const key of new Set([...Object.keys(t), ...Object.keys(o)])) {
                const merged = node(b[key], o[key], t[key], [...path, key]);
                if (merged !== undefined) result[key] = merged;
            }
            return result;
        }
        if (Array.isArray(o) && Array.isArray(t) && Array.isArray(b)) {
            const key = identityAt(path);
            const entities = key === undefined ? undefined : mergeEntities(b, o, t, key, path);
            if (entities) return entities;
        }
        conflicts.push({ id: conflictId(file, path), file, path, base: b, ours: o, theirs: t });
        return o;
    }
    function mergeEntities(
        b: unknown[],
        o: unknown[],
        t: unknown[],
        key: string,
        path: PathSegment[],
    ): unknown[] | undefined {
        const ids = { b: identities(b, key), o: identities(o, key), t: identities(t, key) };
        if (!ids.b || !ids.o || !ids.t) return undefined;
        const byId = (items: unknown[], list: string[]) =>
            new Map(list.map((id, index) => [id, items[index]]));
        const maps = { b: byId(b, ids.b), o: byId(o, ids.o), t: byId(t, ids.t) };
        // Our order wins only when we alone reordered; otherwise follow the remote order.
        const oursFirst = reordered(ids.o, ids.b) && !reordered(ids.t, ids.b);
        const order = oursFirst ? [...ids.o, ...ids.t] : [...ids.t, ...ids.o];
        const merged: unknown[] = [];
        for (const id of new Set(order)) {
            const value = node(maps.b.get(id), maps.o.get(id), maps.t.get(id), [
                ...path,
                { id, key },
            ]);
            if (value !== undefined) merged.push(value);
        }
        return merged;
    }
    const value = node(base, ours, theirs, []);
    return { value, conflicts };
}

function findIndex(items: unknown[], segment: { id: string; key: string }): number {
    return items.findIndex((item) => isRecord(item) && String(item[segment.key]) === segment.id);
}

/** Returns `root` with the value at `path` replaced; `undefined` removes it. Pure. */
export function setAtPath(root: unknown, path: readonly PathSegment[], value: unknown): unknown {
    const [head, ...rest] = path;
    if (head === undefined) return value;
    if (typeof head === 'string') {
        const object: Record<string, unknown> = isRecord(root) ? { ...root } : {};
        const next = setAtPath(object[head], rest, value);
        if (next === undefined) delete object[head];
        else object[head] = next;
        return object;
    }
    const items = Array.isArray(root) ? [...root] : [];
    const index = findIndex(items, head);
    const next = setAtPath(index < 0 ? undefined : items[index], rest, value);
    if (next === undefined) {
        if (index >= 0) items.splice(index, 1);
    } else if (index < 0) items.push(next);
    else items[index] = next;
    return items;
}

/** The value at `path` in `root`, or undefined when any step is missing. Pure. */
export function getAtPath(root: unknown, path: readonly PathSegment[]): unknown {
    let current = root;
    for (const segment of path) {
        if (typeof segment === 'string') {
            if (!isRecord(current)) return undefined;
            current = current[segment];
        } else {
            if (!Array.isArray(current)) return undefined;
            current = current[findIndex(current, segment)];
        }
    }
    return current;
}

/** True when the working value at the conflict's path is no longer the one captured at merge. */
export const editedSinceMerge = (root: unknown, conflict: MergeConflict) =>
    !sameValue(getAtPath(root, conflict.path), conflict.ours);

/**
 * Applies the author's choice for one conflict to the current file value. A path edited after the
 * merge counts as resolved "mine": the newer edit is never overwritten.
 */
export function resolveConflict(
    root: unknown,
    conflict: MergeConflict,
    choice: Resolution,
): unknown {
    if (choice === 'ours' || editedSinceMerge(root, conflict)) return root;
    return setAtPath(root, conflict.path, conflict.theirs);
}

/** Entity identity per collection key for a file, from the registry. */
export function identityResolver(file: string, value: unknown): IdentityAt {
    if (file === LOCALE_FILE) return () => undefined;
    const spec =
        file === MOVEMENT_FILE
            ? movementSpec
            : isRecord(value)
              ? statRegistry.find((candidate) => candidate.name === value.Name)
              : undefined;
    const collections: Readonly<Record<string, EntitySpec>> = spec?.collections ?? {};
    return (path) => {
        const [collection, ...rest] = path;
        if (typeof collection !== 'string' || rest.length) return undefined;
        const entity = collections[collection];
        return entity ? identityKey(entity) : undefined;
    };
}

/** Merges one tracked file using registry identities. `base` is the value as last loaded. */
export function mergeFile(
    file: string,
    base: unknown,
    ours: unknown,
    theirs: unknown,
): MergeResult {
    const named = isRecord(theirs) ? theirs : ours;
    return mergeJson(file, base, ours, theirs, identityResolver(file, named));
}

/** True when every dirty file already matches the remote text, e.g. our earlier save landed. */
export function alreadyOnRemote(
    dirty: readonly string[],
    ours: Readonly<Record<string, string>>,
    remote: Readonly<Record<string, string>>,
): boolean {
    return dirty.length > 0 && dirty.every((path) => ours[path] === remote[path]);
}
