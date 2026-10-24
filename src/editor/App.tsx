import { useEffect, useState } from 'react';
import { statRegistry } from '../core';
import type { DataSource, LoadedData } from './data';
import { EditorProvider, useEditor } from './state/store';
import { LoginScreen, forgetLogin } from './components/LoginScreen';
import { StatView, movementViewSpec } from './components/StatView';
import { PendingChanges } from './components/PendingChanges';
import { SaveDialog } from './components/SaveDialog';
import { PublishDialog } from './components/PublishDialog';
function Workspace({ onDisconnect }: { onDisconnect(): void }) {
    const state = useEditor();
    const [section, setSection] = useState<string>(statRegistry[0]!.name);
    const [dialog, setDialog] = useState<'pending' | 'save' | 'publish' | null>(null);
    const errors = state.issues.filter((i) => i.severity === 'error');
    const warnings = state.issues.filter((i) => i.severity === 'warning');
    useEffect(() => {
        const listener = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        if (state.dirty.length) window.addEventListener('beforeunload', listener);
        return () => window.removeEventListener('beforeunload', listener);
    }, [state.dirty.length]);
    const spec =
        section === 'Movement' ? movementViewSpec : statRegistry.find((s) => s.name === section)!;
    const file =
        section === 'Movement'
            ? 'sources/movement.json'
            : Object.keys(state.values).find(
                  (path) =>
                      path.startsWith('sources/stats/') &&
                      (state.values[path] as { Name?: string }).Name === section,
              );
    return (
        <div className="workspace">
            <a className="skip-link" href="#main">
                Skip to editor
            </a>
            <header className="topbar">
                <div className="brand">
                    CHARACTER STATS <span>EDITOR</span>
                </div>
                <span className="source-label">{state.source.label}</span>
                <div className="toolbar">
                    <button onClick={() => setDialog('pending')}>
                        Pending changes ({state.dirty.length})
                    </button>
                    <button
                        className="primary"
                        disabled={state.source.readOnly || !state.dirty.length}
                        onClick={() => setDialog('save')}
                    >
                        Save
                    </button>
                    <button disabled={state.source.readOnly} onClick={() => setDialog('publish')}>
                        Publish
                    </button>
                    <button
                        onClick={() => {
                            if (
                                state.dirty.length &&
                                !window.confirm('Disconnect and discard all unsaved changes?')
                            )
                                return;
                            forgetLogin();
                            onDisconnect();
                        }}
                    >
                        Disconnect
                    </button>
                </div>
            </header>
            <nav className="sidebar" aria-label="Stats">
                <h2>Stats</h2>
                {[...statRegistry, movementViewSpec].map((item) => (
                    <button
                        key={item.name}
                        aria-current={section === item.name ? 'page' : undefined}
                        onClick={() => setSection(item.name)}
                    >
                        {item.name}
                        {Object.entries(state.values).some(
                            ([path, value]) =>
                                state.dirty.includes(path) &&
                                (value as { Name?: string }).Name === item.name,
                        ) ||
                        (item.name === 'Movement' && state.dirty.includes('sources/movement.json'))
                            ? ' •'
                            : ''}
                    </button>
                ))}
                <p className="help">
                    {state.source.readOnly
                        ? 'Local read-only data. Edits are in memory; saving and publishing are disabled.'
                        : 'Edits stay in memory until you save.'}
                </p>
            </nav>
            <main id="main" className="main" tabIndex={-1}>
                <details className={`validation ${errors.length ? 'has-errors' : ''}`}>
                    <summary aria-live="polite">
                        {errors.length} validation error(s) · {warnings.length} warning(s)
                    </summary>
                    {!state.issues.length ? (
                        <p className="success">All sources and English placeholders are valid.</p>
                    ) : (
                        <ul>
                            {state.issues.map((issue, i) => (
                                <li
                                    key={i}
                                    className={issue.severity === 'error' ? 'error' : 'warning'}
                                >
                                    <code>{issue.path}</code>: {issue.message}
                                </li>
                            ))}
                        </ul>
                    )}
                </details>
                {file ? (
                    <StatView
                        key={section}
                        spec={spec}
                        file={file}
                        movement={section === 'Movement'}
                    />
                ) : (
                    <p className="error">
                        No source file found for {section}. Add the source file in the repository,
                        then reconnect.
                    </p>
                )}
            </main>
            {dialog === 'pending' && <PendingChanges onClose={() => setDialog(null)} />}
            {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
            {dialog === 'publish' && <PublishDialog onClose={() => setDialog(null)} />}
        </div>
    );
}
export default function App() {
    const [connection, setConnection] = useState<{ source: DataSource; loaded: LoadedData } | null>(
        null,
    );
    return connection ? (
        <EditorProvider source={connection.source} loaded={connection.loaded}>
            <Workspace onDisconnect={() => setConnection(null)} />
        </EditorProvider>
    ) : (
        <LoginScreen onLoad={(source, loaded) => setConnection({ source, loaded })} />
    );
}
