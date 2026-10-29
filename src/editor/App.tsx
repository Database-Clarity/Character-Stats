import { useEffect, useRef, useState } from 'react';
import { isRecord, statRegistry } from '../core';
import type { DataSource, LoadedData } from './data';
import { EditorProvider, useEditor } from './state/store';
import { statFilePath } from './state/paths';
import {
    adjacentChange,
    changeAffectsStat,
    identityKey,
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
import mobility from './assets/mobility.png';
import { ConfirmDialog } from './components/ConfirmDialog';
import { EditorCrashBoundary, RecoveryDialog, RecoveryGate } from './components/Recovery';
import type { RecoverySnapshot } from './state/recovery';
import {
    consumeWheelNavigation,
    hasExactCtrlAltModifiers,
    nextCollectionSelection,
    normalizeWheelDeltaY,
    resetWheelNavigation,
    type WheelNavigationState,
} from './components/navigationShortcuts';
import {
    NavigationHistoryController,
    readNavigationSelection,
    sameNavigationSelection,
    type EditorNavigationSelection,
    type NavigationMode,
} from './components/navigationHistory';
import { RepositoryMenu } from './components/RepositoryMenu';
import { ValidationPanel } from './components/ValidationPanel';

const mainNavigationItems = [...statRegistry, movementViewSpec];
const initialNavigationSelection: EditorNavigationSelection = {
    stat: statRegistry[0]!.name,
    tab: 'Fields',
    itemKey: null,
};

function ConnectionObserver({
    onChange,
}: {
    onChange(connection: { source: DataSource; loaded: LoadedData }): void;
}) {
    const { source, head, originals } = useEditor();
    useEffect(() => {
        onChange({ source, loaded: { head, files: originals } });
    }, [source, head, originals, onChange]);
    return null;
}
function Workspace({ onDisconnect }: { onDisconnect(): void }) {
    const state = useEditor(),
        [navigationSelection, setNavigationSelection] = useState<EditorNavigationSelection>(
            initialNavigationSelection,
        ),
        [dialog, setDialog] = useState<'pending' | 'save' | 'publish' | 'jump' | 'recovery' | null>(
            null,
        ),
        [request, setRequest] = useState<NavigationRequest | null>(null),
        [currentChange, setCurrentChange] = useState<string>();
    const [disconnecting, setDisconnecting] = useState(false);
    const [statNavigationActive, setStatNavigationActive] = useState(false);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const navigationHistoryRef = useRef<NavigationHistoryController | null>(null);
    const normalizeNavigationRef = useRef<
        (selection: EditorNavigationSelection) => EditorNavigationSelection
    >(() => initialNavigationSelection);
    if (!navigationHistoryRef.current) {
        navigationHistoryRef.current = new NavigationHistoryController(
            window.history,
            initialNavigationSelection,
            setNavigationSelection,
        );
    }
    const navigationHistory = navigationHistoryRef.current;
    const section = navigationSelection.stat;
    const isComposing = useRef(false);
    const statWheelNavigation = useRef<WheelNavigationState>({
        accumulated: 0,
        direction: null,
        lastNavigation: 0,
    });
    const accountLabel = state.source.readOnly ? 'Local dev' : state.source.label;
    function disconnect() {
        forgetLogin();
        onDisconnect();
    }
    function navigateSelection(
        selection: EditorNavigationSelection,
        mode: NavigationMode = 'click',
    ) {
        const changed = navigationHistory.navigate(selection, mode);
        if (changed && mode !== 'sync') setRequest(null);
    }
    function normalizeNavigation(selection: EditorNavigationSelection): EditorNavigationSelection {
        const targetSpec = mainNavigationItems.find((item) => item.name === selection.stat),
            stat = targetSpec?.name ?? initialNavigationSelection.stat,
            spec = targetSpec ?? mainNavigationItems[0]!;
        const tab = ['Fields', ...Object.keys(spec.collections), 'Text'].includes(selection.tab)
            ? selection.tab
            : 'Fields';
        const file = statFilePath(state.values, stat);
        if (!file || !isRecord(state.values[file])) {
            return { stat, tab: 'Fields', itemKey: null };
        }
        const targetValue = state.values[file];
        const collectionSpec = spec.collections[tab];
        if (!collectionSpec) return { stat, tab, itemKey: null };
        const idKey = identityKey(collectionSpec),
            currentItems = (Array.isArray(targetValue[tab]) ? targetValue[tab] : []).filter(
                isRecord,
            ),
            originalFile = state.originalValues[file],
            originalItems = (
                isRecord(originalFile) && Array.isArray(originalFile[tab]) ? originalFile[tab] : []
            ).filter(isRecord),
            draftKey = `${file}:${tab}`;
        let itemKey = selection.itemKey;
        if (
            itemKey === 'draft'
                ? !state.itemDrafts[draftKey]
                : itemKey !== null &&
                  !currentItems.some((item) => String(item[idKey]) === itemKey) &&
                  !originalItems.some((item) => String(item[idKey]) === itemKey)
        )
            itemKey = null;
        const group = selection.groupMembers;
        const groupItems = group?.map((id) =>
            currentItems.find((item) => String(item[idKey]) === id),
        );
        const firstGroupItem = groupItems?.[0];
        const validGroup =
            group !== undefined &&
            (collectionSpec.role === 'ability' || collectionSpec.role === 'superAbility') &&
            group.length > 1 &&
            groupItems !== undefined &&
            firstGroupItem !== undefined &&
            groupItems.every(
                (item) => item !== undefined && item.BaseCooldown === firstGroupItem.BaseCooldown,
            );
        return {
            stat,
            tab,
            itemKey: validGroup ? null : itemKey,
            ...(validGroup ? { groupMembers: group } : {}),
        };
    }
    normalizeNavigationRef.current = normalizeNavigation;
    function go(target: ChangeTarget) {
        navigateSelection({
            stat: target.stat,
            tab: target.tab,
            itemKey: target.itemKey ?? null,
        });
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
    function selectStat(name: string, mode: NavigationMode = 'click') {
        if (name === navigationSelection.stat) {
            if (mode === 'click') navigateSelection(navigationSelection);
            return;
        }
        navigateSelection({ stat: name, tab: 'Fields', itemKey: null }, mode);
    }
    useEffect(() => {
        const onPopState = () => {
            const recorded = readNavigationSelection(window.history.state);
            if (!recorded) {
                navigationHistory.restore(undefined);
                return;
            }
            const normalized = normalizeNavigationRef.current(recorded);
            navigationHistory.restore(normalized, !sameNavigationSelection(recorded, normalized));
            setRequest(null);
        };
        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
            navigationHistory.dispose();
        };
    }, [navigationHistory]);
    useEffect(() => {
        const listener = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        if (
            state.dirty.length ||
            Object.keys(state.itemDrafts).length ||
            Object.keys(state.drafts).length
        )
            window.addEventListener('beforeunload', listener);
        return () => window.removeEventListener('beforeunload', listener);
    }, [state.dirty.length, state.itemDrafts, state.drafts]);
    const latest = useRef({ next, selectStat, dialog });
    latest.current = { next, selectStat, dialog };
    useEffect(() => {
        const workspace = workspaceRef.current;
        if (!workspace) return;
        const updateStatNavigationHighlight = (event: KeyboardEvent) => {
            const active = hasExactCtrlAltModifiers(
                event,
                isComposing.current || event.isComposing,
            );
            setStatNavigationActive(active);
            if (!active) resetWheelNavigation(statWheelNavigation.current);
        };
        const listener = (event: KeyboardEvent) => {
            updateStatNavigationHighlight(event);
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setDialog('jump');
            } else if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                latest.current.next(event.key === 'ArrowDown' ? 1 : -1);
            } else if (
                event.key === '/' &&
                !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) &&
                !latest.current.dialog
            ) {
                event.preventDefault();
                const input = document.querySelector<HTMLInputElement>('[data-collection-search]');
                if (input) input.focus();
                else setDialog('jump');
            }
        };
        const resetOnModifierRelease = (event: KeyboardEvent) => {
            updateStatNavigationHighlight(event);
        };
        const clearStatNavigation = () => {
            setStatNavigationActive(false);
            resetWheelNavigation(statWheelNavigation.current);
        };
        const clearWhenHidden = () => {
            if (document.visibilityState !== 'visible') clearStatNavigation();
        };
        const startComposition = () => {
            isComposing.current = true;
            clearStatNavigation();
        };
        const endComposition = () => {
            isComposing.current = false;
            clearStatNavigation();
        };
        const onWheel = (event: WheelEvent) => {
            if (!hasExactCtrlAltModifiers(event, isComposing.current) || event.deltaY === 0) return;
            event.preventDefault();
            event.stopPropagation();
            setStatNavigationActive(true);
            const delta = normalizeWheelDeltaY(event.deltaY, event.deltaMode, window.innerHeight);
            const direction = consumeWheelNavigation(
                statWheelNavigation.current,
                delta,
                Date.now(),
            );
            if (direction === undefined) return;

            const targets = Array.from(
                workspace.querySelectorAll<HTMLButtonElement>(
                    '.sidebar > button[data-stat-navigation]',
                ),
            )
                .filter((button) => !button.disabled && button.getClientRects().length > 0)
                .flatMap((button) =>
                    button.dataset.statName ? [{ button, name: button.dataset.statName }] : [],
                );
            const selectedName =
                targets.find(({ button }) => button.getAttribute('aria-current') === 'page')
                    ?.name ?? null;
            const nextName = nextCollectionSelection(
                targets.map(({ name }) => name),
                selectedName,
                direction,
            );
            const nextTarget = targets.find(({ name }) => name === nextName);
            if (!nextTarget) return;
            latest.current.selectStat(nextTarget.name, 'scroll');
            nextTarget.button.scrollIntoView({ block: 'nearest' });
        };
        const wheelOptions: AddEventListenerOptions = { capture: true, passive: false };
        window.addEventListener('keydown', listener);
        window.addEventListener('keyup', resetOnModifierRelease);
        window.addEventListener('blur', clearStatNavigation);
        document.addEventListener('visibilitychange', clearWhenHidden);
        window.addEventListener('compositionstart', startComposition);
        window.addEventListener('compositionend', endComposition);
        workspace.addEventListener('wheel', onWheel, wheelOptions);
        return () => {
            window.removeEventListener('keydown', listener);
            window.removeEventListener('keyup', resetOnModifierRelease);
            window.removeEventListener('blur', clearStatNavigation);
            document.removeEventListener('visibilitychange', clearWhenHidden);
            window.removeEventListener('compositionstart', startComposition);
            window.removeEventListener('compositionend', endComposition);
            workspace.removeEventListener('wheel', onWheel, wheelOptions);
        };
    }, []);
    const spec =
        section === 'Movement' ? movementViewSpec : statRegistry.find((s) => s.name === section)!;
    const file = statFilePath(state.values, section);
    return (
        <div className="workspace" ref={workspaceRef}>
            <a className="skip-link" href="#main">
                Skip to editor
            </a>
            <header className="topbar">
                <div className="brand">
                    <img src={logo} alt="Clarity" />
                    <strong>Clarity</strong>
                    <span>data editor</span>
                </div>
                <button
                    className="quick-jump-button"
                    onClick={() => setDialog('jump')}
                    title="Quick jump (Ctrl+K)"
                >
                    Jump… <kbd>Ctrl K</kbd>
                </button>
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
                        title="Writes source edits (sources/, locale/en.json) to the branch, or opens a PR. On master this redeploys the site and sends English text to Crowdin; the data apps download does not change."
                    >
                        Save
                    </button>
                    <button
                        disabled={state.source.readOnly}
                        onClick={() => setDialog('publish')}
                        title="Regenerates the data apps download (versions/<v>/ and update.json) from committed source edits. On master it also redeploys the site."
                    >
                        Publish
                    </button>
                    <div className="toolbar-manifest">
                        <ManifestStatusBadge />
                    </div>
                    <RepositoryMenu
                        accountLabel={accountLabel}
                        sourceLabel={state.source.label}
                        onRecovery={() => setDialog('recovery')}
                        onSignOut={() => {
                            if (
                                state.dirty.length ||
                                Object.keys(state.itemDrafts).length ||
                                Object.keys(state.drafts).length
                            )
                                setDisconnecting(true);
                            else disconnect();
                        }}
                    />
                </div>
            </header>
            <nav
                className="sidebar"
                aria-label="Stats"
                data-navigation-active={statNavigationActive ? 'true' : undefined}
            >
                <h2>CHARACTER STATS</h2>
                {mainNavigationItems.map((item) => {
                    const count = state.changes.filter((c) =>
                        changeAffectsStat(c, item.name),
                    ).length;
                    return (
                        <button
                            key={item.name}
                            data-stat-navigation
                            data-stat-name={item.name}
                            aria-current={section === item.name ? 'page' : undefined}
                            onClick={() => {
                                selectStat(item.name);
                            }}
                        >
                            {item.name === 'Movement' ? (
                                <img src={mobility} width={20} height={20} alt="Mobility" />
                            ) : (
                                <ManifestIcon hash={item.hash} size={20} />
                            )}
                            <span>{item.name}</span>
                            {count > 0 && <span className="count-badge">{count}</span>}
                        </button>
                    );
                })}
                <div className="sidebar-footer">
                    <span className="status-dot" />
                    {state.source.readOnly ? 'Local · recovery enabled' : 'Connected to GitHub'}
                    <p className="help">
                        Ctrl K · Quick jump
                        <br />
                        Alt ↑ / ↓ · Changes
                        <br />
                        Ctrl+Alt + scroll · Navigate stats
                    </p>
                </div>
            </nav>
            <main id="main" className="main" tabIndex={-1}>
                {state.recovery.error && (
                    <p role="alert" className="error">
                        {state.recovery.error}
                    </p>
                )}
                {state.recovery.notice && <p role="status">{state.recovery.notice}</p>}
                <ValidationPanel onGo={go} />
                {file ? (
                    <StatView
                        key={section}
                        spec={spec}
                        file={file}
                        movement={section === 'Movement'}
                        request={request}
                        selection={navigationSelection}
                        onNavigate={navigateSelection}
                    />
                ) : (
                    <p className="error">No source file found for {section}.</p>
                )}
            </main>
            {dialog === 'pending' && (
                <PendingChanges onClose={() => setDialog(null)} onGo={goChange} />
            )}
            {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} />}
            {dialog === 'publish' && <PublishDialog onClose={() => setDialog(null)} />}
            {dialog === 'jump' && <QuickJump onClose={() => setDialog(null)} onGo={go} />}
            {dialog === 'recovery' && <RecoveryDialog onClose={() => setDialog(null)} />}
            {disconnecting && (
                <ConfirmDialog
                    title="Sign out"
                    message="Sign out? Unsaved work remains in local recovery on this browser. Use Recovery to discard stored data."
                    confirmLabel="Sign out"
                    onClose={() => setDisconnecting(false)}
                    onConfirm={disconnect}
                />
            )}
        </div>
    );
}
export default function App() {
    const [recovery, setRecovery] = useState<{
        revision: number;
        snapshot?: RecoverySnapshot | undefined;
    }>({
        revision: 0,
    });
    const [connection, setConnection] = useState<{ source: DataSource; loaded: LoadedData } | null>(
        null,
    );
    return connection ? (
        <EditorCrashBoundary
            key={recovery.revision}
            source={connection.source}
            recover={(snapshot) =>
                setRecovery(({ revision }) => ({ revision: revision + 1, snapshot }))
            }
        >
            <ManifestProvider>
                <EditorProvider
                    source={connection.source}
                    loaded={connection.loaded}
                    snapshot={recovery.snapshot}
                >
                    <ConnectionObserver onChange={setConnection} />
                    <RecoveryGate>
                        <Workspace
                            onDisconnect={() => {
                                setRecovery({ revision: 0 });
                                setConnection(null);
                            }}
                        />
                    </RecoveryGate>
                </EditorProvider>
            </ManifestProvider>
        </EditorCrashBoundary>
    ) : (
        <LoginScreen onLoad={(source, loaded) => setConnection({ source, loaded })} />
    );
}
