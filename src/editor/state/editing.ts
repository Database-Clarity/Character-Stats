import {
    isRecord,
    statRegistry,
    movementSpec,
    localeFields,
    localeId,
    type EntitySpec,
    type FieldSpec,
} from '../../core';

export const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const identityKey = (spec: EntitySpec) =>
    spec.uniqueKey ?? spec.fields.find((f) => f.kind === 'hash')?.key ?? 'Name';

export interface EntityRow {
    item: Record<string, unknown>;
    deleted: boolean;
    old: Record<string, unknown> | undefined;
}

export interface BaseCooldownGroup {
    cooldown: number;
    rows: EntityRow[];
}

export function groupRowsByBaseCooldown(rows: readonly EntityRow[]) {
    const grouped = new Map<number, EntityRow[]>(),
        ungrouped: EntityRow[] = [];
    for (const row of rows) {
        const cooldown = row.item.BaseCooldown;
        if (typeof cooldown !== 'number' || !Number.isFinite(cooldown)) {
            ungrouped.push(row);
            continue;
        }
        const group = grouped.get(cooldown);
        if (group) group.push(row);
        else grouped.set(cooldown, [row]);
    }
    return {
        groups: [...grouped]
            .map(([cooldown, groupedRows]) => ({ cooldown, rows: groupedRows }))
            .sort((a, b) => a.cooldown - b.cooldown),
        ungrouped,
    };
}

export function sharedEntityFields(
    spec: EntitySpec,
    members: readonly Record<string, unknown>[],
    idKey: string,
): FieldSpec[] {
    const first = members[0];
    if (!first || members.length < 2) return [];
    return spec.fields.filter(
        (field) =>
            field.key !== idKey &&
            members.every((member) => equal(first[field.key], member[field.key])),
    );
}

export function updateEntityGroupField(
    items: readonly Record<string, unknown>[],
    idKey: string,
    memberIds: readonly string[],
    field: string,
    valueForMember: (item: Record<string, unknown>) => unknown,
): Record<string, unknown>[] {
    const ids = new Set(memberIds);
    if (ids.size !== memberIds.length || ids.size === 0)
        throw new Error('An ability group must contain distinct member identities');
    const matched = items.filter((item) => ids.has(String(item[idKey])));
    if (matched.length !== ids.size) throw new Error('An ability group member no longer exists');
    return items.map((item) =>
        ids.has(String(item[idKey])) ? updateNestedField(item, field, valueForMember(item)) : item,
    );
}

export function indexEntityRows(
    items: Record<string, unknown>[],
    saved: Record<string, unknown>[],
    idKey: string,
) {
    const currentById = new Map(items.map((item) => [String(item[idKey]), item]));
    const savedById = new Map(saved.map((item) => [String(item[idKey]), item]));
    const rows: EntityRow[] = [
        ...items.map((item) => ({
            item,
            deleted: false,
            old: savedById.get(String(item[idKey])),
        })),
        ...saved
            .filter((item) => !currentById.has(String(item[idKey])))
            .map((item) => ({ item, deleted: true, old: item })),
    ];
    return { currentById, savedById, rows };
}

export interface EntityFormSession {
    baseline?: string | null;
    selected: string | null;
    token: number;
}

export function selectEntityFormSession(
    session: EntityFormSession,
    selected: string | null,
): EntityFormSession {
    return session.selected === selected
        ? session
        : { selected, baseline: selected, token: session.token + 1 };
}

export function followEntityIdentity(
    session: EntityFormSession,
    selected: string,
): EntityFormSession {
    return { ...session, selected };
}

export function hasDraftIdentity(spec: EntitySpec, value: Record<string, unknown>): boolean {
    const key = identityKey(spec);
    const identity = value[key];
    const hashField = spec.fields.find((field) => field.key === key && field.kind === 'hash');
    const validIdentity = hashField
        ? typeof identity === 'number' && Number.isFinite(identity)
        : typeof identity === 'string' && identity.trim().length > 0;
    return validIdentity && typeof value.Name === 'string' && value.Name.trim().length > 0;
}

export function revertRequirementTable(
    value: Record<string, unknown>,
    specs: readonly FieldSpec[],
    key: string,
    saved: Record<string, unknown>,
) {
    const next = { ...value };
    for (const name of [
        key,
        ...specs.filter((field) => field.lengthOf === key).map((f) => f.key),
    ]) {
        if (saved[name] === undefined) delete next[name];
        else next[name] = structuredClone(saved[name]);
    }
    return next;
}
export function numericDefault(field: FieldSpec, array = false): number {
    const c = array ? (field.items ?? {}) : field;
    const low = c.min ?? (c.exclusiveMin === undefined ? 0 : c.exclusiveMin + 0.1);
    return Math.min(c.max ?? Infinity, Math.max(low, 1));
}
export function fieldDefault(field: FieldSpec): unknown {
    if (field.kind === 'enum') return field.values?.[0]?.value ?? '';
    if (field.kind === 'object' || field.kind === 'objectArray') {
        const object = () =>
            Object.fromEntries(
                (field.entity?.fields ?? [])
                    .filter((f) => f.required)
                    .map((f) => [f.key, fieldDefault(f)]),
            );
        return field.kind === 'object'
            ? object()
            : Array.from({ length: field.minItems ?? 0 }, object);
    }
    if (field.kind === 'string' || field.kind === 'localeRef') return 'New item';
    if (field.kind === 'numberArray' || field.kind === 'intArray')
        return Array.from({ length: field.minItems ?? 0 }, () => numericDefault(field, true));
    if (field.kind === 'curve') return { Values: [] };
    return numericDefault(field);
}
export function updateNestedField(
    value: Record<string, unknown>,
    path: string,
    next: unknown,
): Record<string, unknown> {
    const [key, ...rest] = path.split('.');
    if (!key) return value;
    const result = { ...value };
    if (!rest.length) {
        if (next === undefined) delete result[key];
        else result[key] = structuredClone(next);
    } else if (Array.isArray(value[key])) {
        const [index, ...tail] = rest;
        const array = [...value[key]];
        const row = array[Number(index)];
        if (tail.length && isRecord(row))
            array[Number(index)] = updateNestedField(row, tail.join('.'), next);
        else if (next === undefined) array.splice(Number(index), 1);
        else array[Number(index)] = structuredClone(next);
        result[key] = array;
    } else {
        result[key] = updateNestedField(
            isRecord(value[key]) ? value[key] : {},
            rest.join('.'),
            next,
        );
    }
    return result;
}
export function createItemDraft(
    spec: EntitySpec,
    _items: Record<string, unknown>[],
    copy?: Record<string, unknown>,
) {
    const value = copy
        ? structuredClone(copy)
        : Object.fromEntries(
              spec.fields.filter((f) => f.required).map((f) => [f.key, fieldDefault(f)]),
          );
    value[identityKey(spec)] = '';
    value.Name = '';
    return value;
}
export function editRequirement(
    value: Record<string, unknown>,
    specs: readonly FieldSpec[],
    key: string,
    action:
        | { type: 'add'; hash: number }
        | { type: 'remove'; index: number }
        | { type: 'move'; index: number; to: number },
) {
    const next = { ...value };
    const keys = [
        key,
        ...specs.filter((f) => f.lengthOf === key && Array.isArray(value[f.key])).map((f) => f.key),
    ];
    for (const name of keys) {
        const current = value[name];
        const array: unknown[] = Array.isArray(current) ? [...current] : [];
        if (action.type === 'add')
            array.push(
                name === key
                    ? action.hash
                    : numericDefault(
                          specs.find((f) => f.key === name)!,
                          true,
                      ),
            );
        if (action.type === 'remove') array.splice(action.index, 1);
        if (action.type === 'move' && action.to >= 0 && action.to < array.length)
            array.splice(action.to, 0, array.splice(action.index, 1)[0]!);
        next[name] = array;
    }
    return next;
}
export function toggleParallel(value: Record<string, unknown>, field: FieldSpec, enabled: boolean) {
    const next = { ...value };
    const requirements = value[field.lengthOf!];
    if (enabled)
        next[field.key] = Array.from(
            { length: Array.isArray(requirements) ? requirements.length : 0 },
            () => numericDefault(field, true),
        );
    else delete next[field.key];
    return next;
}
export interface ChangeTarget {
    stat: string;
    tab: string;
    itemKey?: string;
    field: string;
}
export interface EditorChange extends ChangeTarget {
    id: string;
    file: string;
    item?: string;
    before: unknown;
    after: unknown;
    kind: 'added' | 'modified' | 'deleted';
    affectedStats?: string[];
}
export function collectChanges(
    originals: Record<string, string>,
    values: Record<string, unknown>,
    parsedOriginals?: Record<string, unknown>,
): EditorChange[] {
    const changes: EditorChange[] = [];
    function add(
        file: string,
        stat: string,
        tab: string,
        field: string,
        before: unknown,
        after: unknown,
        itemKey?: string,
        item?: string,
    ) {
        if (equal(before, after)) return;
        changes.push({
            id: `${file}:${stat}:${tab}:${itemKey ?? ''}:${field}`,
            file,
            stat,
            tab,
            field,
            before,
            after,
            kind: before === undefined ? 'added' : after === undefined ? 'deleted' : 'modified',
            ...(itemKey === undefined ? {} : { itemKey }),
            ...(item === undefined ? {} : { item }),
        });
    }
    function localeLeaves(
        file: string,
        stat: string,
        before: unknown,
        after: unknown,
        path: string,
    ) {
        if (isRecord(before) || isRecord(after)) {
            const a = isRecord(before) ? before : {},
                b = isRecord(after) ? after : {};
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
                localeLeaves(file, stat, a[key], b[key], `${path}.${key}`);
        } else add(file, stat, 'Text', path, before, after);
    }
    function fieldChanges(
        file: string,
        stat: string,
        tab: string,
        spec: FieldSpec,
        before: unknown,
        after: unknown,
        path: string,
        itemKey?: string,
        item?: string,
    ) {
        if (equal(before, after)) return;
        if (spec.entity && spec.kind === 'object' && isRecord(before) && isRecord(after)) {
            for (const field of spec.entity.fields)
                fieldChanges(
                    file,
                    stat,
                    tab,
                    field,
                    before[field.key],
                    after[field.key],
                    `${path}.${field.key}`,
                    itemKey,
                    item,
                );
        } else if (
            spec.entity &&
            spec.kind === 'objectArray' &&
            Array.isArray(before) &&
            Array.isArray(after) &&
            before.length === after.length
        ) {
            before.forEach((old, index) => {
                const next = after[index];
                if (isRecord(old) && isRecord(next)) {
                    for (const field of spec.entity!.fields)
                        fieldChanges(
                            file,
                            stat,
                            tab,
                            field,
                            old[field.key],
                            next[field.key],
                            `${path}.${index}.${field.key}`,
                            itemKey,
                            item,
                        );
                } else add(file, stat, tab, `${path}.${index}`, old, next, itemKey, item);
            });
        } else add(file, stat, tab, path, before, after, itemKey, item);
    }
    for (const [file, value] of Object.entries(values)) {
        const saved: unknown = parsedOriginals
            ? parsedOriginals[file]
            : JSON.parse(originals[file] ?? '{}');
        if (!isRecord(value) || !isRecord(saved)) continue;
        if (file === 'locale/en.json') {
            for (const key of new Set([...Object.keys(saved), ...Object.keys(value)])) {
                const ownSection =
                    key === movementSpec.name || statRegistry.some((spec) => spec.name === key);
                const consumers = ownSection
                    ? []
                    : statRegistry.filter((spec) =>
                          [
                              ...localeFields(
                                  Object.values(spec.collections).some(
                                      (entity) => entity.role === 'ability',
                                  ),
                              ),
                              ...spec.fields.filter((f) => f.kind === 'localeRef'),
                          ].some((field) => localeId(spec.name, field.key) === key),
                      );
                const start = changes.length;
                localeLeaves(
                    file,
                    ownSection ? key : (consumers[0]?.name ?? statRegistry[0]!.name),
                    saved[key],
                    value[key],
                    key,
                );
                if (!ownSection)
                    for (const change of changes.slice(start)) {
                        change.item = 'Shared locale';
                        change.affectedStats = consumers.map((spec) => spec.name);
                    }
            }
            continue;
        }
        const movement = file === 'sources/movement.json';
        const spec = movement ? movementSpec : statRegistry.find((s) => s.name === value.Name);
        if (!spec) continue;
        const a = movement ? saved : isRecord(saved.Fields) ? saved.Fields : {};
        const b = movement ? value : isRecord(value.Fields) ? value.Fields : {};
        for (const field of spec.fields)
            fieldChanges(file, spec.name, 'Fields', field, a[field.key], b[field.key], field.key);
        for (const [tab, entity] of Object.entries(spec.collections)) {
            const key = identityKey(entity);
            const oldItems = (Array.isArray(saved[tab]) ? saved[tab] : []).filter(isRecord);
            const newItems = (Array.isArray(value[tab]) ? value[tab] : []).filter(isRecord);
            const oldMap = new Map(oldItems.map((item) => [String(item[key]), item]));
            const newMap = new Map(newItems.map((item) => [String(item[key]), item]));
            for (const id of new Set([...oldMap.keys(), ...newMap.keys()])) {
                const old = oldMap.get(id),
                    next = newMap.get(id),
                    name = String(next?.Name ?? old?.Name ?? id);
                if (!old || !next) add(file, spec.name, tab, '', old, next, id, name);
                else
                    for (const field of entity.fields)
                        fieldChanges(
                            file,
                            spec.name,
                            tab,
                            field,
                            old[field.key],
                            next[field.key],
                            field.key,
                            id,
                            name,
                        );
            }
        }
    }
    return changes;
}
export function adjacentChange(
    changes: EditorChange[],
    current: string | undefined,
    direction: number,
): EditorChange | undefined {
    if (!changes.length) return undefined;
    const index = current ? changes.findIndex((c) => c.id === current) : -1;
    return changes[
        ((index < 0 ? (direction > 0 ? -1 : 0) : index) + direction + changes.length) %
            changes.length
    ];
}

export function changeAffectsStat(change: EditorChange, stat: string): boolean {
    return change.stat === stat || !!change.affectedStats?.includes(stat);
}
