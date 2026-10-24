import type { ManifestEntry, ManifestSearchIndex } from './types';

export interface ManifestSearchOptions {
    filter?: (entry: ManifestEntry) => boolean;
    limit?: number;
}

function duplicateKey(entry: ManifestEntry): string {
    return [
        entry.table === 'itemCategory' ? entry.table : '',
        entry.name.toLowerCase(),
        entry.icon ?? '',
        entry.typeName?.toLowerCase() ?? '',
    ].join('\u0000');
}

export function createManifestSearchIndex(entries: ManifestEntry[]): ManifestSearchIndex {
    const byHash = new Map<number, ManifestEntry>();
    const byTableHash = new Map<ManifestEntry['table'], Map<number, ManifestEntry>>();
    const lowerNames = new Array<string>(entries.length);
    const words = new Array<string[]>(entries.length);
    const subclassEntries: ManifestEntry[] = [];

    entries.forEach((entry, index) => {
        if (!byHash.has(entry.hash)) byHash.set(entry.hash, entry);
        let tableEntries = byTableHash.get(entry.table);
        if (!tableEntries) {
            tableEntries = new Map<number, ManifestEntry>();
            byTableHash.set(entry.table, tableEntries);
        }
        if (!tableEntries.has(entry.hash)) tableEntries.set(entry.hash, entry);
        lowerNames[index] = entry.name.toLowerCase();
        words[index] = lowerNames[index].split(/[\s_-]+/u).filter(Boolean);
        if (entry.isSubclass) subclassEntries.push(entry);
    });

    return { entries, byHash, byTableHash, lowerNames, words, subclassEntries };
}

export function lookupManifestEntry(
    index: ManifestSearchIndex,
    hash: number,
    table?: ManifestEntry['table'],
): ManifestEntry | undefined {
    if (!Number.isFinite(hash) || hash < 0) return undefined;
    return table ? index.byTableHash.get(table)?.get(hash) : index.byHash.get(hash);
}

export function searchManifestEntries(
    index: ManifestSearchIndex,
    query: string,
    options: ManifestSearchOptions = {},
): ManifestEntry[] {
    const limit = options.limit ?? 50;
    if (!Number.isFinite(limit) || limit <= 0) return [];
    const maxResults = Math.floor(limit);
    if (maxResults === 0) return [];

    const normalizedQuery = query.trim().toLowerCase();
    const buckets: [ManifestEntry[], ManifestEntry[], ManifestEntry[]] = [[], [], []];
    const seen = new Set<string>();

    for (let indexInList = 0; indexInList < index.entries.length; indexInList += 1) {
        const entry = index.entries[indexInList];
        if (!entry) continue;

        let rank: number;
        if (!normalizedQuery || String(entry.hash) === normalizedQuery) {
            rank = 0;
        } else {
            const lowerName = index.lowerNames[indexInList] ?? '';
            if (lowerName.startsWith(normalizedQuery)) rank = 0;
            else if (
                (index.words[indexInList] ?? []).some((word) => word.startsWith(normalizedQuery))
            ) {
                rank = 1;
            } else if (lowerName.includes(normalizedQuery)) rank = 2;
            else continue;
        }

        const bucket = buckets[rank];
        if (!bucket || bucket.length >= maxResults || (options.filter && !options.filter(entry))) {
            continue;
        }
        const key = duplicateKey(entry);
        if (seen.has(key)) continue;
        seen.add(key);
        bucket.push(entry);

        if ((buckets[0]?.length ?? 0) >= maxResults) break;
    }

    return [...buckets[0], ...buckets[1], ...buckets[2]].slice(0, maxResults);
}
