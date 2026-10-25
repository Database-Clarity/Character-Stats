import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from '../github/client';
import { GitHubDataSource, LocalDevDataSource } from '../data';
import {
    appendSnapshot,
    MAX_AGE_MS,
    MAX_SNAPSHOTS,
    parseRecovery,
    readRecovery,
    recoveryKey,
    deleteRecovery,
    writeRecovery,
    type RecoverySnapshot,
} from './recovery';

function snapshot(id = 'snapshot-1', timestamp = 1): RecoverySnapshot {
    return {
        id,
        timestamp,
        head: 'head-1',
        originals: {
            'sources/movement.json': '{"Rules":{"WalkSpeed":5}}',
            'locale/en.json': '{"Movement":{"WalkSpeed":"Walk speed"}}',
        },
        values: {
            'sources/movement.json': { Rules: { WalkSpeed: 5 } },
            'locale/en.json': { Movement: { WalkSpeed: 'Walk speed' } },
        },
        drafts: { 'movement:WalkSpeed': { text: '6', error: '' } },
        itemDrafts: { 'sources/movement.json:Classes': { 'class-1': { text: 'Scout' } } },
        changeCount: 1,
    };
}

function createIndexedDBMock() {
    const values = new Map<string, unknown>();
    let hasObjectStore = false;
    let database: IDBDatabase;

    const clone = <T>(value: T): T => structuredClone(value);
    const request = <T>(run: () => T, complete: () => void): IDBRequest<T> => {
        const result = {
            result: undefined as T,
            error: null as DOMException | null,
            onsuccess: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
        };
        queueMicrotask(() => {
            try {
                result.result = run();
                result.onsuccess?.(new Event('success'));
                complete();
            } catch (error) {
                result.error = error as DOMException;
                result.onerror?.(new Event('error'));
            }
        });
        return result as unknown as IDBRequest<T>;
    };

    const transaction = (): IDBTransaction => {
        const value = {
            error: null as DOMException | null,
            oncomplete: null as ((event: Event) => void) | null,
            onerror: null as ((event: Event) => void) | null,
            onabort: null as ((event: Event) => void) | null,
            objectStore: () => {
                const store = {
                    get: (key: IDBValidKey) =>
                        request(
                            () => clone(values.get(String(key))),
                            () => finish(),
                        ),
                    put: (entry: unknown, key: IDBValidKey) =>
                        request(
                            () => {
                                values.set(String(key), clone(entry));
                                return key;
                            },
                            () => finish(),
                        ),
                    delete: (key: IDBValidKey) =>
                        request(
                            () => {
                                values.delete(String(key));
                                return undefined;
                            },
                            () => finish(),
                        ),
                };
                return store as unknown as IDBObjectStore;
            },
        };
        function finish() {
            queueMicrotask(() => value.oncomplete?.(new Event('complete')));
        }
        return value as unknown as IDBTransaction;
    };

    database = {
        objectStoreNames: {
            contains: (name: string) => name === 'snapshots' && hasObjectStore,
        },
        createObjectStore: () => {
            hasObjectStore = true;
            return {} as IDBObjectStore;
        },
        transaction: () => transaction(),
        close: () => undefined,
    } as unknown as IDBDatabase;

    const factory = {
        open: () => {
            const result = {
                result: database,
                error: null as DOMException | null,
                onupgradeneeded: null as ((event: IDBVersionChangeEvent) => void) | null,
                onsuccess: null as ((event: Event) => void) | null,
                onerror: null as ((event: Event) => void) | null,
            };
            queueMicrotask(() => {
                if (!hasObjectStore)
                    result.onupgradeneeded?.(new Event('upgradeneeded') as IDBVersionChangeEvent);
                result.onsuccess?.(new Event('success'));
            });
            return result as unknown as IDBOpenDBRequest;
        },
    } as unknown as IDBFactory;

    return {
        factory,
        set(key: string, value: unknown) {
            values.set(key, value);
        },
        get(key: string) {
            return clone(values.get(key));
        },
        has(key: string) {
            return values.has(key);
        },
    };
}

afterEach(() => vi.unstubAllGlobals());

describe('recovery snapshots', () => {
    it('parses valid records and rejects incompatible or malformed data', () => {
        const record = { version: 1, snapshots: [snapshot()] };
        expect(parseRecovery(record)).toEqual(record);
        expect(() => parseRecovery({ version: 2, snapshots: [] })).toThrow(
            'Invalid recovery data: version must be 1',
        );
        expect(() =>
            parseRecovery({
                version: 1,
                snapshots: [{ ...snapshot(), timestamp: Number.NaN }],
            }),
        ).toThrow('timestamp must be a non-negative safe integer');
        expect(() =>
            parseRecovery({
                version: 1,
                snapshots: [{ ...snapshot(), head: '' }],
            }),
        ).toThrow('head must be a non-empty string');
        expect(() =>
            parseRecovery({
                version: 1,
                snapshots: [{ ...snapshot(), originals: { 'sources/movement.json': '{' } }],
            }),
        ).toThrow('is not valid JSON');
        expect(() =>
            parseRecovery({
                version: 1,
                snapshots: [
                    {
                        ...snapshot(),
                        values: { ...snapshot().values, 'sources/other.json': {} },
                    },
                ],
            }),
        ).toThrow('unsupported file path');
        expect(() =>
            parseRecovery({
                version: 1,
                snapshots: [{ ...snapshot(), values: { 'sources/movement.json': {} } }],
            }),
        ).toThrow('must contain identical file paths');
    });

    it('rejects values that are not JSON-compatible or contain cycles', () => {
        const withDate = snapshot();
        withDate.values['sources/movement.json'] = { when: new Date() };
        expect(() => parseRecovery({ version: 1, snapshots: [withDate] })).toThrow(
            'only JSON values',
        );

        const withUndefined = snapshot();
        withUndefined.values['sources/movement.json'] = { missing: undefined };
        expect(() => parseRecovery({ version: 1, snapshots: [withUndefined] })).toThrow(
            'only JSON values',
        );

        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        const withCycle = snapshot();
        withCycle.values['sources/movement.json'] = cycle;
        expect(() => parseRecovery({ version: 1, snapshots: [withCycle] })).toThrow(
            'cannot contain cycles',
        );
    });

    it('deduplicates state while ignoring identity, timestamp, and change count', () => {
        const original = snapshot('first', 100);
        const duplicate = { ...snapshot('second', 200), changeCount: 9 };
        const result = appendSnapshot({ version: 1, snapshots: [original] }, duplicate, 200);
        expect(result.snapshots).toEqual([original]);
    });

    it('removes aged snapshots and keeps only the newest configured count', () => {
        const now = MAX_AGE_MS + 1000;
        const aged = snapshot('aged', 1);
        const fresh = Array.from({ length: MAX_SNAPSHOTS + 2 }, (_, index) => ({
            ...snapshot(`fresh-${index}`, now - MAX_AGE_MS + index + 1),
            head: `head-${index}`,
        }));
        const result = appendSnapshot(
            { version: 1, snapshots: [aged, ...fresh.slice(0, -1)] },
            fresh[fresh.length - 1]!,
            now,
        );
        expect(result.snapshots).toHaveLength(MAX_SNAPSHOTS);
        expect(result.snapshots[0]!.id).toBe('fresh-2');
        expect(result.snapshots.at(-1)!.id).toBe(`fresh-${MAX_SNAPSHOTS + 1}`);
    });

    it('scopes keys by repository, branch, and local development source without credentials', () => {
        const source = (owner: string, name: string, branch: string) =>
            new GitHubDataSource(new GitHubClient('sensitive-token', { owner, name, branch }));
        const key = recoveryKey(source('owner', 'repo', 'main'));
        expect(key).toBe(recoveryKey(source('owner', 'repo', 'main')));
        expect(key).not.toBe(recoveryKey(source('owner', 'repo', 'feature')));
        expect(key).not.toBe(recoveryKey(source('other', 'repo', 'main')));
        expect(key).not.toContain('sensitive-token');
        expect(recoveryKey(new LocalDevDataSource())).toBe('local:dev');
    });
});

describe('recovery IndexedDB persistence', () => {
    it('propagates unavailable IndexedDB instead of falling back silently', async () => {
        vi.stubGlobal('indexedDB', undefined);
        await expect(readRecovery('scope')).rejects.toThrow(
            'IndexedDB is unavailable; recovery storage cannot be used.',
        );
    });

    it('round-trips records, keeps source scopes separate, and deletes records', async () => {
        const indexedDB = createIndexedDBMock();
        vi.stubGlobal('indexedDB', indexedDB.factory);

        const firstKey = recoveryKey(
            new GitHubDataSource(
                new GitHubClient('token', { owner: 'a', name: 'b', branch: 'main' }),
            ),
        );
        const otherKey = recoveryKey(
            new GitHubDataSource(
                new GitHubClient('token', { owner: 'a', name: 'b', branch: 'dev' }),
            ),
        );
        const record = { version: 1 as const, snapshots: [snapshot('snapshot-1', Date.now())] };

        await writeRecovery(firstKey, record);
        expect(await readRecovery(firstKey)).toEqual(record);
        expect(await readRecovery(otherKey)).toBeNull();
        await deleteRecovery(firstKey);
        expect(await readRecovery(firstKey)).toBeNull();
    });

    it('rejects corrupt and incompatible data stored in IndexedDB', async () => {
        const indexedDB = createIndexedDBMock();
        vi.stubGlobal('indexedDB', indexedDB.factory);
        indexedDB.set('incompatible', { version: 2, snapshots: [] });
        indexedDB.set('corrupt', {
            version: 1,
            snapshots: [{ ...snapshot(), originals: { 'sources/movement.json': 'not JSON' } }],
        });

        await expect(readRecovery('incompatible')).rejects.toThrow('version must be 1');
        await expect(readRecovery('corrupt')).rejects.toThrow('is not valid JSON');
    });

    it('prunes aged and excess snapshots when reading a stored record', async () => {
        const indexedDB = createIndexedDBMock();
        vi.stubGlobal('indexedDB', indexedDB.factory);
        const now = Date.now();
        const snapshots = Array.from({ length: MAX_SNAPSHOTS + 2 }, (_, index) => ({
            ...snapshot(`snapshot-${index}`, now - 1000 + index),
            head: `head-${index}`,
        }));
        snapshots[0] = { ...snapshots[0]!, timestamp: now - MAX_AGE_MS - 1 };
        indexedDB.set('pruned', { version: 1, snapshots });

        const result = await readRecovery('pruned');
        expect(result?.snapshots).toHaveLength(MAX_SNAPSHOTS);
        expect(result?.snapshots[0]!.id).toBe('snapshot-2');
        expect(result?.snapshots.at(-1)!.id).toBe(`snapshot-${MAX_SNAPSHOTS + 1}`);
        const persisted = indexedDB.get('pruned') as { snapshots: RecoverySnapshot[] };
        expect(persisted.snapshots).toHaveLength(MAX_SNAPSHOTS);
        expect(persisted.snapshots[0]!.id).toBe('snapshot-2');
    });

    it('deletes the stored record when every snapshot has expired', async () => {
        const indexedDB = createIndexedDBMock();
        vi.stubGlobal('indexedDB', indexedDB.factory);
        indexedDB.set('expired', {
            version: 1,
            snapshots: [snapshot('expired', Date.now() - MAX_AGE_MS - 1)],
        });

        expect(await readRecovery('expired')).toBeNull();
        expect(indexedDB.has('expired')).toBe(false);
    });
});
