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
