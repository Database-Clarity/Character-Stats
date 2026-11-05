export type ManifestTable = 'item' | 'class' | 'stat' | 'itemCategory';

export interface ManifestEntry {
    hash: number;
    name: string;
    icon?: string;
    description?: string;
    typeName?: string;
    table: ManifestTable;
    classType?: 0 | 1 | 2 | 3;
    plugCategory?: string;
    isSubclass?: boolean;
    isExotic?: boolean;
}

export interface ManifestSearchIndex {
    entries: ManifestEntry[];
    byHash: Map<number, ManifestEntry>;
    byTableHash: Map<ManifestTable, Map<number, ManifestEntry>>;
    lowerNames: string[];
    words: string[][];
    subclassEntries: ManifestEntry[];
}

export type ManifestStatus =
    | { state: 'disabled'; reason: string }
    | { state: 'loading'; step: string; progress?: number }
    | { state: 'ready'; version: string }
    | { state: 'error'; error: string };

export interface ManifestWorkerRequest {
    type: 'load';
    apiKey: string;
    force: boolean;
}

export type ManifestWorkerResponse =
    | { type: 'progress'; status: Extract<ManifestStatus, { state: 'loading' }> }
    | { type: 'ready'; version: string; index: ManifestSearchIndex }
    | { type: 'error'; error: string };

export interface ManifestLoadResult {
    version: string;
    index: ManifestSearchIndex;
}
