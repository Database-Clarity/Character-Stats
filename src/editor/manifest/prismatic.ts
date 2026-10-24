import type { ManifestEntry } from './types';

export function isPrismaticAbility(entry: ManifestEntry | undefined): boolean {
    return (
        entry?.table === 'item' && /\|\s*(?:Light|Darkness) Ability\s*$/i.test(entry.typeName ?? '')
    );
}
