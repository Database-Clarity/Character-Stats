import { useEffect, useRef, useState } from 'react';
import type { EditorState } from './store';
import {
    appendSnapshot,
    deleteRecovery,
    readRecovery,
    recoveryKey,
    writeRecovery,
    type RecoveryRecord,
    type RecoverySnapshot,
} from './recovery';

function message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

export function useRecovery(
    state: EditorState,
    changeCount: number,
    dirty: boolean,
    initialSnapshot?: RecoverySnapshot,
) {
    const key = recoveryKey(state.source);
    const [record, setRecord] = useState<RecoveryRecord>({ version: 1, snapshots: [] });
    const [ready, setReady] = useState(false);
    const [offered, setOffered] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const history = useRef(record);
    const queue = useRef(Promise.resolve());
    const saveRevision = useRef(state.saveRevision);
    const previousKey = useRef(key);
    const blocked = useRef(true);
    const debounce = useRef<number | undefined>(undefined);

    function enqueue(operation: () => Promise<void>) {
        queue.current = queue.current.then(operation).catch((failure: unknown) => {
            setError(`Local recovery storage failed: ${message(failure)}`);
        });
        return queue.current;
    }

    useEffect(() => {
        let cancelled = false;
        if (saveRevision.current !== state.saveRevision) {
            blocked.current = false;
            setReady(true);
            return;
        }
        blocked.current = true;
        setReady(false);
        void queue.current
            .then(() => readRecovery(key))
            .then((stored) => {
                if (cancelled) return;
                const next = stored ?? { version: 1 as const, snapshots: [] };
                history.current = next;
                setRecord(next);
                setOffered(!initialSnapshot && next.snapshots.length > 0);
                blocked.current = !initialSnapshot && next.snapshots.length > 0;
                setReady(true);
            })
            .catch((failure: unknown) => {
                if (cancelled) return;
                setError(`Cannot read stored recovery data: ${message(failure)}`);
                setOffered(true);
                setReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    useEffect(() => {
        if (saveRevision.current === state.saveRevision) return;
        saveRevision.current = state.saveRevision;
        const savedKey = previousKey.current;
        previousKey.current = key;
        blocked.current = false;
        history.current = { version: 1, snapshots: [] };
        setRecord(history.current);
        setOffered(false);
        void enqueue(async () => {
            await deleteRecovery(savedKey);
            if (savedKey !== key) await deleteRecovery(key);
        });
    }, [state.saveRevision, key]);

    useEffect(() => {
        if (!ready || offered || blocked.current) return;
        if (!dirty && !Object.keys(state.drafts).length && !Object.keys(state.itemDrafts).length)
            return;
        const snapshot: RecoverySnapshot = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            head: state.head,
            originals: state.originals,
            values: state.values,
            drafts: state.drafts,
            itemDrafts: state.itemDrafts,
            changeCount:
                changeCount +
                Object.keys(state.itemDrafts).length +
                Object.values(state.drafts).filter((draft) => draft.error).length,
        };
        // Write each edit promptly; only the rolling history is debounced.
        const latest = appendSnapshot(history.current, snapshot);
        void enqueue(() => writeRecovery(key, latest));
        const timer = window.setTimeout(() => {
            history.current = latest;
            setRecord(latest);
        }, 750);
        debounce.current = timer;
        return () => window.clearTimeout(timer);
    }, [
        state.values,
        state.drafts,
        state.itemDrafts,
        state.head,
        state.originals,
        ready,
        offered,
        key,
        dirty,
        changeCount,
    ]);

    async function discard() {
        window.clearTimeout(debounce.current);
        try {
            await enqueue(() => deleteRecovery(key));
            // enqueue reports storage errors, so verify the deletion before proceeding.
            const remaining = await readRecovery(key);
            if (remaining) throw new Error('Stored recovery data could not be discarded.');
            history.current = { version: 1, snapshots: [] };
            setRecord(history.current);
            setError('');
            setOffered(false);
            blocked.current = false;
        } catch (failure) {
            setError(message(failure));
        }
    }

    function restored(snapshot: RecoverySnapshot) {
        setOffered(false);
        blocked.current = false;
        setNotice(
            snapshot.head !== state.head
                ? `Restored draft base ${snapshot.head.slice(0, 7)}; the loaded branch is ${state.head.slice(0, 7)}. Save will check the branch head and offer to reload while keeping edits if tracked files changed. Review the rebase before saving.`
                : 'Recovered local work. Review your changes before saving.',
        );
    }

    function continueWithoutRecovery() {
        blocked.current = true;
        setOffered(false);
        setNotice('Local recovery is disabled for this session. Export your work before leaving.');
    }

    return {
        ready,
        offered,
        snapshots: record.snapshots,
        error,
        notice,
        discard,
        restored,
        continueWithoutRecovery,
    };
}
