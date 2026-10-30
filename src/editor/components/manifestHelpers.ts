import { isAbilityRole, movementSpec, statRegistry, type EntitySpec } from '../../core';
import { abilityKindOf, type ManifestEntry, type ManifestStatus } from '../manifest';

export function identityLabel(hash: number, name?: string, requirement = false): string {
    if (requirement && hash === 0) return 'All abilities (wildcard)';
    if (requirement && hash < 0) return `Subclass: ${name ?? Math.abs(hash)}`;
    if (hash === 0) return 'Unset (0)';
    if (hash < 0 || !Number.isFinite(hash)) return 'Unknown hash';
    return name || 'Unknown hash';
}

export function collectionFilter(
    statName: string,
    collection: string,
): (entry: ManifestEntry) => boolean {
    const stat = statRegistry.find((spec) => spec.name === statName);
    const spec = statName === movementSpec.name ? movementSpec : stat;
    const collections: Readonly<Record<string, EntitySpec>> = spec?.collections ?? {};
    const entity = collections[collection];
    if (entity?.role === 'movementClass') return (entry) => entry.table === 'class';
    if (entity && isAbilityRole(entity.role) && stat?.abilityKind) {
        return (entry) => abilityKindOf(entry) === stat.abilityKind;
    }
    return () => true;
}

export function manifestStateMessage(status: ManifestStatus): string {
    switch (status.state) {
        case 'disabled':
            return `Manifest unavailable: ${status.reason}`;
        case 'error':
            return 'Manifest unavailable';
        case 'loading':
            return `Manifest loading: ${status.step}`;
        case 'ready':
            return `Manifest ${status.version}`;
    }
}

/** Applies a manifest pick to a hash field, also filling an empty Name from the manifest. */
export function pickedEntry(
    spec: EntitySpec,
    value: Record<string, unknown>,
    key: string,
    entry: Pick<ManifestEntry, 'hash' | 'name'>,
): Record<string, unknown> {
    const next = { ...value, [key]: entry.hash };
    const name = value.Name;
    if (spec.fields.some((f) => f.key === 'Name') && !(typeof name === 'string' && name.trim()))
        next.Name = entry.name;
    return next;
}

export interface PickerGroup {
    title: string;
    items: { hash: number; name: string; note?: string }[];
}

const CLASS_NAMES = ['Titan', 'Hunter', 'Warlock'];

/**
 * Notes (hash -> text) for entries whose name is shared, so identical rows tell apart. Every
 * member of a shared name gets one: the class when all members have a distinct one, else the hash.
 */
export function duplicateNameNotes(
    entries: readonly { hash: number; name: string; classType?: number | undefined }[],
): Map<number, string> {
    const byName = new Map<string, typeof entries>();
    for (const entry of entries) byName.set(entry.name, [...(byName.get(entry.name) ?? []), entry]);
    const notes = new Map<number, string>();
    for (const members of byName.values()) {
        if (members.length < 2) continue;
        const classes = members.map(({ classType }) =>
            classType === undefined ? undefined : CLASS_NAMES[classType],
        );
        const byClass = classes.every((label) => label) && new Set(classes).size === members.length;
        members.forEach(({ hash }, index) =>
            notes.set(hash, byClass ? classes[index]! : `${hash}`),
        );
    }
    return notes;
}

/** Filters picker groups by name or hash, dropping groups left empty while a query is typed. */
export function filterPickerGroups(groups: readonly PickerGroup[], query: string): PickerGroup[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [...groups];
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) =>
                `${item.name} ${item.hash}`.toLowerCase().includes(needle),
            ),
        }))
        .filter((group) => group.items.length);
}
