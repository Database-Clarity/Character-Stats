import { isRecord } from '../../core';
import { GitHubDataSource, LocalDevDataSource, type DataSource } from '../data';

export interface RecoverySnapshot {
    id: string;
    timestamp: number;
    head: string;
    originals: Record<string, string>;
    values: Record<string, unknown>;
    drafts: Record<string, { text: string; error: string }>;
    itemDrafts: Record<string, Record<string, unknown>>;
    changeCount: number;
}

export interface RecoveryRecord {
    version: 1;
    snapshots: RecoverySnapshot[];
}

export const MAX_SNAPSHOTS = 30;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DATABASE_NAME = 'character-stats-recovery';
const OBJECT_STORE_NAME = 'snapshots';

function invalidRecovery(message: string): never {
    throw new Error(`Invalid recovery data: ${message}`);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
    if (!isRecord(value)) invalidRecovery(`${description} must be an object`);
    return value;
}

function isJsonValue(value: unknown, ancestors = new WeakSet<object>()): boolean {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))
    )
        return true;
    if (typeof value !== 'object' || ancestors.has(value)) return false;

    ancestors.add(value);
    let valid = true;
    if (Array.isArray(value)) {
        valid = Object.getPrototypeOf(value) === Array.prototype;
        const keys = Reflect.ownKeys(value);
        valid &&= keys.length === value.length + 1 && !keys.some((key) => typeof key === 'symbol');
        for (let index = 0; valid && index < value.length; index++) {
            if (!Object.hasOwn(value, index)) {
                valid = false;
                break;
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            valid =
                descriptor !== undefined &&
                descriptor.enumerable === true &&
                'value' in descriptor &&
                isJsonValue(descriptor.value, ancestors);
        }
    } else {
        const prototype = Object.getPrototypeOf(value);
        valid = prototype === Object.prototype || prototype === null;
        const keys = Reflect.ownKeys(value);
        valid &&=
            keys.every((key) => typeof key === 'string') &&
            keys.length === Object.keys(value).length;
        for (const key of Object.keys(value)) {
            if (!valid) break;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            valid =
                descriptor !== undefined &&
                descriptor.enumerable === true &&
                'value' in descriptor &&
                isJsonValue(descriptor.value, ancestors);
        }
    }
    ancestors.delete(value);
    return valid;
}

function isTrackedFile(path: string): boolean {
    return (
        path === 'sources/movement.json' ||
        path === 'locale/en.json' ||
        /^sources\/stats\/[^/]+\.json$/.test(path)
    );
}

function validateSnapshot(value: unknown, index: number): RecoverySnapshot {
    const label = `snapshots[${index}]`;
    const snapshot = requireRecord(value, label);
    if (typeof snapshot.id !== 'string' || snapshot.id.trim() === '')
        invalidRecovery(`${label}.id must be a non-empty string`);
    if (
        typeof snapshot.timestamp !== 'number' ||
        !Number.isSafeInteger(snapshot.timestamp) ||
        snapshot.timestamp < 0
    )
        invalidRecovery(`${label}.timestamp must be a non-negative safe integer`);
    if (typeof snapshot.head !== 'string' || snapshot.head.trim() === '')
        invalidRecovery(`${label}.head must be a non-empty string`);
    if (
        typeof snapshot.changeCount !== 'number' ||
        !Number.isInteger(snapshot.changeCount) ||
        snapshot.changeCount < 0
    )
        invalidRecovery(`${label}.changeCount must be a non-negative integer`);

    const originals = requireRecord(snapshot.originals, `${label}.originals`);
    const values = requireRecord(snapshot.values, `${label}.values`);
    const originalPaths = Object.keys(originals);
    const valuePaths = Object.keys(values);

    for (const path of originalPaths) {
        if (!isTrackedFile(path))
            invalidRecovery(`${label}.originals contains unsupported file path "${path}"`);
        const text = originals[path];
        if (typeof text !== 'string')
            invalidRecovery(`${label}.originals["${path}"] must be a string`);
        let originalValue: unknown;
        try {
            originalValue = JSON.parse(text);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            invalidRecovery(`${label}.originals["${path}"] is not valid JSON: ${detail}`);
        }
        if (!isRecord(originalValue))
            invalidRecovery(`${label}.originals["${path}"] must contain a JSON object`);
    }
    for (const path of valuePaths) {
        if (!isTrackedFile(path))
            invalidRecovery(`${label}.values contains unsupported file path "${path}"`);
        if (!isRecord(values[path]))
            invalidRecovery(`${label}.values["${path}"] must be an object`);
    }
    if (
        originalPaths.length !== valuePaths.length ||
        originalPaths.some((path) => !Object.hasOwn(values, path))
    )
        invalidRecovery(`${label}.originals and ${label}.values must contain identical file paths`);

    const drafts = requireRecord(snapshot.drafts, `${label}.drafts`);
    for (const [key, draftValue] of Object.entries(drafts)) {
        const draft = requireRecord(draftValue, `${label}.drafts["${key}"]`);
        if (typeof draft.text !== 'string')
            invalidRecovery(`${label}.drafts["${key}"].text must be a string`);
        if (typeof draft.error !== 'string')
            invalidRecovery(`${label}.drafts["${key}"].error must be a string`);
    }

    const itemDrafts = requireRecord(snapshot.itemDrafts, `${label}.itemDrafts`);
    for (const [key, draft] of Object.entries(itemDrafts)) {
        if (!isRecord(draft)) invalidRecovery(`${label}.itemDrafts["${key}"] must be an object`);
    }

    return value as RecoverySnapshot;
}

export function parseRecovery(value: unknown): RecoveryRecord {
    const record = requireRecord(value, 'record');
    if (record.version !== 1) invalidRecovery('version must be 1');
    if (!Array.isArray(record.snapshots)) invalidRecovery('snapshots must be an array');
    const snapshots = record.snapshots.map(validateSnapshot);
    if (!isJsonValue(record))
        invalidRecovery('record must contain only JSON values and cannot contain cycles');
    return {
        version: 1,
        snapshots,
    };
}

function sameContent(
    a: unknown,
    b: unknown,
    seen = new WeakMap<object, WeakSet<object>>(),
): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    const previous = seen.get(a);
    if (previous?.has(b)) return true;
    if (previous) previous.add(b);
    else seen.set(a, new WeakSet([b]));

    if (Array.isArray(a) || Array.isArray(b)) {
        return (
            Array.isArray(a) &&
            Array.isArray(b) &&
            a.length === b.length &&
            a.every((item, index) => sameContent(item, b[index], seen))
        );
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
        aKeys.length === bKeys.length &&
        aKeys.every(
            (key) =>
                Object.hasOwn(b, key) &&
                sameContent(
                    (a as Record<string, unknown>)[key],
                    (b as Record<string, unknown>)[key],
                    seen,
                ),
        )
    );
}

function sameStateContent(a: RecoverySnapshot, b: RecoverySnapshot): boolean {
    return (
        a.head === b.head &&
        sameContent(a.originals, b.originals) &&
        sameContent(a.values, b.values) &&
        sameContent(a.drafts, b.drafts) &&
        sameContent(a.itemDrafts, b.itemDrafts)
    );
}

export function appendSnapshot(
    record: RecoveryRecord,
    snapshot: RecoverySnapshot,
    now = Date.now(),
): RecoveryRecord {
    const recentSnapshots = pruneSnapshots(record.snapshots, now);
    if (recentSnapshots.some((candidate) => sameStateContent(candidate, snapshot))) {
        return { version: 1, snapshots: recentSnapshots };
    }
    return {
        version: 1,
        snapshots: pruneSnapshots([...recentSnapshots, snapshot], now),
    };
}

function pruneSnapshots(snapshots: RecoverySnapshot[], now: number): RecoverySnapshot[] {
    return snapshots
        .filter((candidate) => candidate.timestamp >= now - MAX_AGE_MS)
        .slice(-MAX_SNAPSHOTS);
}

export function recoveryKey(source: DataSource): string {
    if (source instanceof GitHubDataSource) {
        const { owner, name, branch } = source.client.repo;
        return `github:${JSON.stringify([owner, name, branch])}`;
    }
    if (source instanceof LocalDevDataSource) return 'local:dev';
    throw new Error('Cannot create a recovery key for an unsupported data source.');
}

function openRecoveryDatabase(): Promise<IDBDatabase> {
    const factory = globalThis.indexedDB;
    if (!factory) throw new Error('IndexedDB is unavailable; recovery storage cannot be used.');
    return new Promise((resolve, reject) => {
        const request = factory.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(OBJECT_STORE_NAME))
                database.createObjectStore(OBJECT_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(request.error ?? new Error('Failed to open recovery storage.'));
    });
}

async function runStoreRequest<T>(
    mode: IDBTransactionMode,
    requestFor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const database = await openRecoveryDatabase();
    return new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction;
        let result: T;
        try {
            transaction = database.transaction(OBJECT_STORE_NAME, mode);
            const request = requestFor(transaction.objectStore(OBJECT_STORE_NAME));
            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () =>
                reject(request.error ?? new Error('Recovery storage request failed.'));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () =>
                reject(transaction.error ?? new Error('Recovery storage transaction failed.'));
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('Recovery storage transaction was aborted.'));
        } catch (error) {
            reject(error);
        }
    }).finally(() => database.close());
}

export async function readRecovery(key: string): Promise<RecoveryRecord | null> {
    const stored = await runStoreRequest<unknown>('readonly', (store) => store.get(key));
    if (stored === undefined) return null;
    const record = parseRecovery(stored);
    const snapshots = pruneSnapshots(record.snapshots, Date.now());
    if (snapshots.length === record.snapshots.length) return record;
    if (snapshots.length === 0) {
        await deleteRecovery(key);
        return null;
    }
    const prunedRecord = { version: 1 as const, snapshots };
    await writeRecovery(key, prunedRecord);
    return prunedRecord;
}

export async function writeRecovery(key: string, record: RecoveryRecord): Promise<void> {
    const validRecord = parseRecovery(record);
    await runStoreRequest<IDBValidKey>('readwrite', (store) => store.put(validRecord, key));
}

export async function deleteRecovery(key: string): Promise<void> {
    await runStoreRequest<undefined>('readwrite', (store) => store.delete(key));
}
