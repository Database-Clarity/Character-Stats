import { buildManifestEntries } from './build';
import { readCachedIndex, writeCachedIndex } from './cache';
import { createManifestSearchIndex } from './search';
import type {
    ManifestEntry,
    ManifestStatus,
    ManifestWorkerRequest,
    ManifestWorkerResponse,
} from './types';

type WorkerScope = {
    addEventListener(
        type: 'message',
        listener: (event: MessageEvent<ManifestWorkerRequest>) => void,
    ): void;
    postMessage(message: ManifestWorkerResponse): void;
};

const BUNGIE_ORIGIN = 'https://www.bungie.net';
const workerScope = self as unknown as WorkerScope;

function sendStatus(step: string, progress?: number): void {
    const status: Extract<ManifestStatus, { state: 'loading' }> =
        progress === undefined ? { state: 'loading', step } : { state: 'loading', step, progress };
    workerScope.postMessage({ type: 'progress', status });
}

function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<unknown> {
    const init: RequestInit = headers ? { headers } : {};
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`Bungie request failed (${response.status})`);
    return response.json() as Promise<unknown>;
}

function bungieUrl(path: unknown): string {
    if (typeof path !== 'string' || !path.trim())
        throw new Error('Manifest is missing a definition path');
    const url = new URL(path, BUNGIE_ORIGIN);
    if (url.origin !== BUNGIE_ORIGIN)
        throw new Error('Manifest returned an invalid definition URL');
    return url.toString();
}

function safeError(error: unknown): string {
    if (error instanceof Error && error.message) return error.message.slice(0, 400);
    return 'Manifest loading failed';
}

function sendReady(version: string, entries: ManifestEntry[]): void {
    const index = createManifestSearchIndex(entries);
    sendStatus('Building compact index', 100);
    workerScope.postMessage({ type: 'ready', version, index });
}

async function load(request: ManifestWorkerRequest): Promise<void> {
    sendStatus('Checking manifest');
    const envelope = record(
        await fetchJson(`${BUNGIE_ORIGIN}/Platform/Destiny2/Manifest/`, {
            'X-API-Key': request.apiKey,
        }),
    );
    const response = record(envelope?.Response);
    const version = typeof response?.version === 'string' ? response.version : undefined;
    const worldPaths = record(record(response?.jsonWorldComponentContentPaths)?.en);
    if (!version || !worldPaths) throw new Error('Bungie returned an incomplete manifest response');

    if (!request.force) {
        sendStatus('Checking local cache');
        const cached = await readCachedIndex(version);
        if (cached) {
            sendStatus('Loading cached index');
            sendReady(version, cached);
            return;
        }
    }

    sendStatus('Downloading item definitions');
    const itemDefinitions = await fetchJson(
        bungieUrl(worldPaths.DestinyInventoryItemLiteDefinition),
    );
    sendStatus('Downloading class definitions');
    const classDefinitions = await fetchJson(bungieUrl(worldPaths.DestinyClassDefinition));
    sendStatus('Downloading stat definitions');
    const statDefinitions = await fetchJson(bungieUrl(worldPaths.DestinyStatDefinition));
    sendStatus('Downloading item category definitions');
    const itemCategoryDefinitions = await fetchJson(
        bungieUrl(worldPaths.DestinyItemCategoryDefinition),
    );

    sendStatus('Building compact index', 0);
    const entries = buildManifestEntries(
        itemDefinitions,
        classDefinitions,
        statDefinitions,
        (processed, total) => {
            if (total > 0)
                sendStatus('Building compact index', Math.round((processed / total) * 100));
        },
        itemCategoryDefinitions,
    );
    sendStatus('Caching compact index');
    try {
        await writeCachedIndex(version, entries);
    } catch {
        // The manifest remains usable when browser storage is unavailable or full.
    }
    sendReady(version, entries);
}

workerScope.addEventListener('message', (event) => {
    if (event.data.type !== 'load') return;
    void load(event.data).catch((error: unknown) => {
        workerScope.postMessage({ type: 'error', error: safeError(error) });
    });
});
