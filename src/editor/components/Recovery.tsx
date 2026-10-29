import { Component, useEffect, useState, type ReactNode } from 'react';
import type { DataSource } from '../data';
import {
    deleteRecovery,
    readRecovery,
    recoveryKey,
    type RecoverySnapshot,
} from '../state/recovery';
import { useEditor } from '../state/store';
import { Modal } from './Modal';
import { plural } from './textFormat';

function detail(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function exportSnapshot(snapshot: RecoverySnapshot) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify({ version: 1, snapshots: [snapshot] }, null, 4)], {
            type: 'application/json',
        }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `clarity-recovery-${snapshot.timestamp}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SnapshotList({
    snapshots,
    head,
    restore,
}: {
    snapshots: RecoverySnapshot[];
    head?: string;
    restore(snapshot: RecoverySnapshot): void;
}) {
    return (
        <>
            <p>
                Local snapshots keep up to 30 states for 7 days. Restoring replaces the current
                working state. Export a snapshot first if you want to keep a separate backup.
            </p>
            {!snapshots.length && <p>No recoverable snapshots are available.</p>}
            <ul>
                {[...snapshots].reverse().map((snapshot) => (
                    <li key={snapshot.id}>
                        <strong>{new Date(snapshot.timestamp).toLocaleString()}</strong>
                        {' · '}
                        {plural(snapshot.changeCount, 'change')} · base {snapshot.head.slice(0, 7)}
                        {head && head !== snapshot.head && (
                            <p className="warning">
                                The loaded branch head differs. The original draft base is
                                preserved; Save will reconcile branch changes before committing.
                            </p>
                        )}
                        <div className="toolbar">
                            <button onClick={() => restore(snapshot)}>Restore snapshot</button>
                            <button onClick={() => exportSnapshot(snapshot)}>Export JSON</button>
                        </div>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function RecoveryDialog({ onClose }: { onClose(): void }) {
    const state = useEditor();
    return (
        <Modal title="Local recovery" onClose={onClose}>
            {state.recovery.error && (
                <p role="alert" className="error">
                    {state.recovery.error}
                </p>
            )}
            <SnapshotList
                snapshots={state.recovery.snapshots}
                head={state.head}
                restore={(snapshot) => {
                    state.dispatch({ type: 'restore', snapshot });
                    state.recovery.restored(snapshot);
                    onClose();
                }}
            />
            <button className="danger" onClick={() => void state.recovery.discard()}>
                Discard stored recovery data
            </button>
        </Modal>
    );
}

export function RecoveryGate({ children }: { children: ReactNode }) {
    const state = useEditor();
    if (!state.recovery.ready)
        return (
            <main className="main">
                <p>Checking local recovery…</p>
            </main>
        );
    if (state.recovery.offered)
        return (
            <main className="main">
                <h1>Recover unsaved work</h1>
                <p>Stored local work was found for {state.source.label}.</p>
                {state.recovery.error && (
                    <p className="error" role="alert">
                        {state.recovery.error}
                    </p>
                )}
                <SnapshotList
                    snapshots={state.recovery.snapshots}
                    head={state.head}
                    restore={(snapshot) => {
                        state.dispatch({ type: 'restore', snapshot });
                        state.recovery.restored(snapshot);
                    }}
                />
                <button className="danger" onClick={() => void state.recovery.discard()}>
                    Discard stored recovery data and start fresh
                </button>
                {state.recovery.error && (
                    <button onClick={state.recovery.continueWithoutRecovery}>
                        Continue without local recovery
                    </button>
                )}
            </main>
        );
    return children;
}

function CrashRecovery({
    source,
    error,
    recover,
}: {
    source: DataSource;
    error: Error;
    recover(snapshot?: RecoverySnapshot): void;
}) {
    const [snapshots, setSnapshots] = useState<RecoverySnapshot[]>([]);
    const [storageError, setStorageError] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        void readRecovery(recoveryKey(source))
            .then((record) => setSnapshots(record?.snapshots ?? []))
            .catch((failure: unknown) => setStorageError(detail(failure)))
            .finally(() => setLoading(false));
    }, [source]);
    return (
        <main className="main">
            <h1>The editor encountered an error</h1>
            <p role="alert" className="error">
                {error.message}
            </p>
            <p>
                Restore an earlier snapshot, export it for safekeeping, or discard local recovery.
            </p>
            {loading ? (
                <p>Reading snapshots…</p>
            ) : (
                <SnapshotList snapshots={snapshots} restore={recover} />
            )}
            {storageError && (
                <p className="error" role="alert">
                    {storageError}
                </p>
            )}
            <button
                disabled={loading}
                className="danger"
                onClick={() => {
                    void deleteRecovery(recoveryKey(source))
                        .then(() => recover())
                        .catch((failure: unknown) => setStorageError(detail(failure)));
                }}
            >
                Discard recovery data and reload editor
            </button>
        </main>
    );
}

export class EditorCrashBoundary extends Component<
    {
        source: DataSource;
        recover(snapshot?: RecoverySnapshot): void;
        children: ReactNode;
    },
    { error: Error | null }
> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: unknown) {
        return { error: error instanceof Error ? error : new Error(detail(error)) };
    }
    componentDidCatch(error: Error) {
        console.error('Editor crashed; local recovery is available.', error);
    }
    render() {
        return this.state.error ? (
            <CrashRecovery
                source={this.props.source}
                error={this.state.error}
                recover={this.props.recover}
            />
        ) : (
            this.props.children
        );
    }
}
