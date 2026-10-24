import { useEffect, useState } from 'react';
import { statRegistry } from '../core';
import type { DataSource, LoadedData } from './data';
import { EditorProvider, useEditor } from './state/store';
import {
    adjacentChange,
    changeAffectsStat,
    type ChangeTarget,
    type EditorChange,
} from './state/editing';
import { ManifestProvider, ManifestIcon } from './manifest';
import { LoginScreen, forgetLogin } from './components/LoginScreen';
import { StatView, movementViewSpec, type NavigationRequest } from './components/StatView';
import { PendingChanges } from './components/PendingChanges';
import { SaveDialog } from './components/SaveDialog';
import { PublishDialog } from './components/PublishDialog';
import { QuickJump } from './components/QuickJump';
import { ManifestStatusBadge } from './components/ManifestUI';
import logo from './assets/clarity-logo.svg';
function Workspace({ onDisconnect }: { onDisconnect(): void }) {
    const state = useEditor(),
        [section, setSection] = useState<string>(statRegistry[0]!.name),
        [dialog, setDialog] = useState<'pending' | 'save' | 'publish' | 'jump' | null>(null),
        [request, setRequest] = useState<NavigationRequest | null>(null),
        [currentChange, setCurrentChange] = useState<string>();
    const errors = state.issues.filter((i) => i.severity === 'error'),
        warnings = state.issues.filter((i) => i.severity === 'warning');
    function go(target: ChangeTarget) {
        setSection(target.stat);
        setRequest({ ...target, sequence: Date.now() });
        setDialog(null);
    }
    function goChange(change: EditorChange) {
        setCurrentChange(change.id);
        go(change);
    }
    function next(direction: number) {
        const change = adjacentChange(state.changes, currentChange, direction);
        if (change) goChange(change);
    }
    useEffect(() => {
        const listener = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        if (state.dirty.length || Object.keys(state.itemDrafts).length)
            window.addEventListener('beforeunload', listener);
        return () => window.removeEventListener('beforeunload', listener);
    }, [state.dirty.length, state.itemDrafts]);
    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setDialog('jump');
            } else if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                next(event.key === 'ArrowDown' ? 1 : -1);
            } else if (
                event.key === '/' &&
                !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) &&
                !dialog
            ) {
                event.preventDefault();
                const input = document.querySelector<HTMLInputElement>('[data-collection-search]');
                if (input) input.focus();
                else setDialog('jump');
            }
        };
        window.addEventListener('keydown', listener);
        return () => window.removeEventListener('keydown', listener);
    });
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
                    <img src={logo} alt="Clarity" />
                    <strong>Clarity</strong>
                    <span>data editor</span>
                </div>
                <span className="source-label" title={state.source.label}>
                    {state.source.readOnly ? 'Character-Stats / local dev' : state.source.label}
                </span>
                <button
                    className="quick-jump-button"
                    onClick={() => setDialog('jump')}
                    title="Quick jump (Ctrl+K)"
                >
                    Jump… <kbd>Ctrl K</kbd>
                </button>
                <ManifestStatusBadge />
                <div className="toolbar">
                    <div className="change-controls">
                        <button
                            className={
                                state.changes.length
                                    ? 'changes-indicator has-changes'
                                    : 'changes-indicator'
                            }
                            onClick={() => setDialog('pending')}
                        >
                            ◉ Changes <span className="count-badge">{state.changes.length}</span>
                        </button>
                        <button
                            className="icon-button"
                            aria-label="Previous change"
                            title="Previous change (Alt+↑)"
                            disabled={!state.changes.length}
                            onClick={() => next(-1)}
                        >
                            ↑
                        </button>
                        <button
                            className="icon-button"
                            aria-label="Next change"
                            title="Next change (Alt+↓)"
                            disabled={!state.changes.length}
                            onClick={() => next(1)}
                        >
                            ↓
                        </button>
                    </div>
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
                        className="account-button"
                        title="Disconnect account"
                        aria-label="Disconnect"
                        onClick={() => {
                            if (
                                (state.dirty.length || Object.keys(state.itemDrafts).length) &&
                                !window.confirm('Disconnect and discard unsaved edits and drafts?')
                            )
                                return;
                            forgetLogin();
                            onDisconnect();
                        }}
                    >
                        ↪
                    </button>
                </div>
            </header>
            <nav className="sidebar" aria-label="Stats">
                <h2>CHARACTER STATS</h2>
                {[...statRegistry, movementViewSpec].map((item) => {
                    const count = state.changes.filter((c) =>
                        changeAffectsStat(c, item.name),
                    ).length;
                    return (
                        <button
                            key={item.name}
                            aria-current={section === item.name ? 'page' : undefined}
                            onClick={() => {
                                setSection(item.name);
                                setRequest(null);
                            }}
                        >
                            <ManifestIcon hash={item.hash} size={20} />
                            <span>{item.name}</span>
                            {count > 0 && <span className="count-badge">{count}</span>}
                        </button>
                    );
                })}
                <div className="sidebar-footer">
                    <span className="status-dot" />
                    {state.source.readOnly ? 'Local · in-memory edits' : 'Connected to GitHub'}
                    <p className="help">
                        Ctrl K · Quick jump
                        <br />
                        Alt ↑ / ↓ · Changes
                    </p>
                </div>
            </nav>
            <main id="main" className="main" tabIndex={-1}>
                <details className={`validation ${errors.length ? 'has-errors' : ''}`}>
                    <summary aria-live="polite">
                        <span className={errors.length ? 'error' : 'success'}>
                            {errors.length ? '!' : '✓'}
                        </span>{' '}
                        {errors.length ? `${errors.length} errors` : 'Sources valid'}
                        <span className="muted"> · {warnings.length} warnings</span>
                        <span className="validation-hint">Shared core validation</span>
                    </summary>
                    <div className="validation-issues">
                        {!state.issues.length ? (
                            <p className="success">
                                All sources and English placeholders are valid.
                            </p>
                        ) : (
                            state.issues.map((issue, i) => (
                                <p
                                    key={i}
                                    className={issue.severity === 'error' ? 'error' : 'warning'}
                                >
                                    <code>{issue.path}</code>: {issue.message}
                                </p>
                            ))
                        )}
                    </div>
                </details>
                {file ? (
                    <StatView
                        key={section}
                        spec={spec}
                        file={file}
                        movement={section === 'Movement'}
                        request={request}
                    />
                ) : (
                    <p className="error">No source file found for {section}.</p>
                )}
            </main>
            {dialog === 'pending' && (
                <PendingChanges onClose={() => setDialog(null)} onGo={goChange} />
            )}{' '}
            {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}{' '}
            {dialog === 'publish' && <PublishDialog onClose={() => setDialog(null)} />}{' '}
            {dialog === 'jump' && <QuickJump onClose={() => setDialog(null)} onGo={go} />}
        </div>
    );
}
export default function App() {
    const [connection, setConnection] = useState<{ source: DataSource; loaded: LoadedData } | null>(
        null,
    );
    return connection ? (
        <ManifestProvider>
            <EditorProvider source={connection.source} loaded={connection.loaded}>
                <Workspace onDisconnect={() => setConnection(null)} />
            </EditorProvider>
        </ManifestProvider>
    ) : (
        <LoginScreen onLoad={(source, loaded) => setConnection({ source, loaded })} />
    );
}
