import type { ManifestEntry } from './types';

const DATABASE_NAME = 'destiny-manifest-index';
const DATABASE_VERSION = 1;
const CACHE_FORMAT_VERSION = 2;
const STORE_NAME = 'indexes';

function cacheKey(version: string): string {
    return `${version}:format-${CACHE_FORMAT_VERSION}`;
}

interface CachedManifestIndex {
    version: string;
    entries: ManifestEntry[];
    cachedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'version' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Unable to open manifest cache'));
        request.onblocked = () => reject(new Error('Manifest cache upgrade blocked'));
    });
}

export async function readCachedIndex(version: string): Promise<ManifestEntry[] | undefined> {
    let database: IDBDatabase | undefined;
    try {
        database = await openDatabase();
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(cacheKey(version));
        const cached = await new Promise<CachedManifestIndex | undefined>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as CachedManifestIndex | undefined);
            request.onerror = () =>
                reject(request.error ?? new Error('Unable to read manifest cache'));
        });
        return Array.isArray(cached?.entries) ? cached.entries : undefined;
    } catch {
        return undefined;
    } finally {
        database?.close();
    }
}

export async function writeCachedIndex(version: string, entries: ManifestEntry[]): Promise<void> {
    let database: IDBDatabase | undefined;
    try {
        database = await openDatabase();
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put({
            version: cacheKey(version),
            entries,
            cachedAt: Date.now(),
        } satisfies CachedManifestIndex);
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () =>
                reject(transaction.error ?? new Error('Unable to write manifest cache'));
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('Manifest cache write aborted'));
        });
    } finally {
        database?.close();
    }
}
