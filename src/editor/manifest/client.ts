import type {
    ManifestLoadResult,
    ManifestStatus,
    ManifestWorkerRequest,
    ManifestWorkerResponse,
} from './types';

export function loadManifestInWorker(
    apiKey: string,
    force: boolean,
    signal: AbortSignal,
    onStatus: (status: Extract<ManifestStatus, { state: 'loading' }>) => void,
): Promise<ManifestLoadResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        let settled = false;

        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            signal.removeEventListener('abort', abort);
            worker.terminate();
            callback();
        };
        const abort = () => finish(() => reject(new Error('Manifest load cancelled')));

        if (signal.aborted) {
            abort();
            return;
        }

        signal.addEventListener('abort', abort, { once: true });
        worker.addEventListener('message', (event: MessageEvent<ManifestWorkerResponse>) => {
            const response = event.data;
            if (response.type === 'progress') {
                onStatus(response.status);
            } else if (response.type === 'ready') {
                finish(() => resolve({ version: response.version, index: response.index }));
            } else {
                finish(() => reject(new Error(response.error)));
            }
        });
        worker.addEventListener('error', (event) => {
            finish(() => reject(new Error(event.message || 'Manifest worker failed')));
        });

        const request: ManifestWorkerRequest = { type: 'load', apiKey, force };
        worker.postMessage(request);
    });
}
