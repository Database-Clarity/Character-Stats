import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadManifestInWorker } from './client';
import { createManifestSearchIndex, lookupManifestEntry, searchManifestEntries } from './search';
import type { ManifestSearchOptions } from './search';
import type { ManifestEntry, ManifestSearchIndex, ManifestStatus, ManifestTable } from './types';

export interface ManifestContextValue {
    status: ManifestStatus;
    lookup(hash: number, table?: ManifestTable): ManifestEntry | undefined;
    search(query: string, options?: ManifestSearchOptions): ManifestEntry[];
    subclasses(): ManifestEntry[];
    refresh(): void;
}

const emptyIndex = createManifestSearchIndex([]);
const disabledValue: ManifestContextValue = {
    status: { state: 'disabled', reason: 'Manifest is not available outside a provider.' },
    lookup: () => undefined,
    search: () => [],
    subclasses: () => [],
    refresh: () => undefined,
};

const ManifestContext = createContext<ManifestContextValue>(disabledValue);

export function ManifestProvider(props: { children: ReactNode }): React.JSX.Element {
    const apiKey = import.meta.env.VITE_BUNGIE_API_KEY?.trim() ?? '';
    const [reloadCount, setReloadCount] = useState(0);
    const [index, setIndex] = useState<ManifestSearchIndex>(emptyIndex);
    const [status, setStatus] = useState<ManifestStatus>(() =>
        apiKey
            ? { state: 'loading', step: 'Starting manifest worker' }
            : { state: 'disabled', reason: 'No API key (VITE_BUNGIE_API_KEY is not configured).' },
    );

    useEffect(() => {
        if (!apiKey) {
            setIndex(emptyIndex);
            setStatus({
                state: 'disabled',
                reason: 'No API key (VITE_BUNGIE_API_KEY is not configured).',
            });
            return;
        }

        const controller = new AbortController();
        setStatus({ state: 'loading', step: 'Starting manifest worker' });
        void loadManifestInWorker(apiKey, reloadCount > 0, controller.signal, setStatus)
            .then(({ version, index: loadedIndex }) => {
                if (controller.signal.aborted) return;
                setIndex(loadedIndex);
                setStatus({ state: 'ready', version });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setStatus({
                    state: 'error',
                    error: error instanceof Error ? error.message : 'Manifest loading failed',
                });
            });
        return () => controller.abort();
    }, [apiKey, reloadCount]);

    const lookup = useCallback(
        (hash: number, table?: ManifestTable) => lookupManifestEntry(index, hash, table),
        [index],
    );
    const search = useCallback(
        (query: string, options?: ManifestSearchOptions) =>
            searchManifestEntries(index, query, options),
        [index],
    );
    const subclasses = useCallback(() => index.subclassEntries, [index]);
    const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

    const value = useMemo<ManifestContextValue>(
        () => ({ status, lookup, search, subclasses, refresh }),
        [status, lookup, search, subclasses, refresh],
    );
    return <ManifestContext.Provider value={value}>{props.children}</ManifestContext.Provider>;
}

export function useManifest(): ManifestContextValue {
    return useContext(ManifestContext);
}
