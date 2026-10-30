import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import {
    baseCooldownLabel,
    equal,
    groupRowsByBaseCooldown,
    nextCooldownSnapshot,
    type CooldownSnapshot,
    type EntityRow,
} from '../state/editing';
import { HashIdentity } from './ManifestUI';
import { ItemMenu, type ItemAction } from './ItemMenu';
import type { ManifestTable } from '../manifest';
import { rovingIndex } from './navigationShortcuts';
import { collectionLabel, plural } from './textFormat';

const groupKey = (id: string) => `group:${id}`;
const editKey = (id: string) => `edit:${id}`;

export function EntityRows({
    collection,
    entityName,
    idKey,
    rows,
    draft,
    selected,
    search,
    getManifestName,
    actions,
    onSearch,
    onSelect,
    onNavigate,
    onEditGroup,
    onAdd,
    onAddFromManifest,
    getManifestTable,
    groupByCooldown = false,
    editingGroup,
    typing = false,
}: {
    collection: string;
    entityName: string;
    idKey: string;
    rows: EntityRow[];
    draft?: Record<string, unknown> | undefined;
    selected: string | null;
    search: string;
    getManifestName(hash: number, item: Record<string, unknown>): string | undefined;
    getManifestTable(item: Record<string, unknown>): ManifestTable | undefined;
    actions(item: Record<string, unknown>, isDeleted: boolean): ItemAction[];
    onSearch(value: string): void;
    onSelect(key: string | null): void;
    onNavigate(key: string | null): void;
    onEditGroup?(memberIds: string[]): void;
    onAdd(): void;
    onAddFromManifest(): void;
    groupByCooldown?: boolean;
    editingGroup?: string[] | null;
    /** A text field in the editor has focus: rows keep their cooldown group until it ends. */
    typing?: boolean;
}) {
    const [menu, setMenu] = useState<{ id: string; signal: number }>({ id: '', signal: 0 });
    const list = useRef<HTMLDivElement>(null);
    const hintId = useId();
    // Roving tabindex: one Tab stop in the list, arrows/Home/End move it, collapsed groups drop out.
    const [tabKey, setTabKey] = useState<string | null>(null);
    const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
    // Rows keep their group while a BaseCooldown is typed; any other value change regroups.
    const snapshot = useRef<CooldownSnapshot | undefined>(undefined);
    snapshot.current = nextCooldownSnapshot(
        snapshot.current,
        `${selected}|${editingGroup?.join(',') ?? ''}`,
        typing,
        rows,
        idKey,
    );
    const grouped = groupByCooldown
        ? groupRowsByBaseCooldown(rows, (row) => {
              const id = String(row.item[idKey]);
              return snapshot.current?.cooldowns.has(id)
                  ? snapshot.current.cooldowns.get(id)
                  : row.item.BaseCooldown;
          })
        : undefined;
    const matchesSearch = ({ item }: EntityRow) =>
        `${item.Name} ${item[idKey]} ${getManifestName(Number(item[idKey]), item) ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase());
    const rowKey = ({ item }: EntityRow) => String(item[idKey]);
    const canEditGroup = (groupRows: EntityRow[]) =>
        !!onEditGroup && groupRows.filter((row) => !row.deleted).length > 1;
    // Roving order: group header, its Edit group button, then its rows (when open and non-empty).
    const groupKeys = (id: string, groupRows: EntityRow[], withEdit: boolean) => {
        const visible = groupRows.filter(matchesSearch);
        if (!visible.length) return [];
        return closed.has(id)
            ? [groupKey(id)]
            : [groupKey(id), ...(withEdit ? [editKey(id)] : []), ...visible.map(rowKey)];
    };
    const visibleKeys = [
        ...(draft ? ['draft'] : []),
        ...(grouped
            ? [
                  ...grouped.groups.flatMap(({ cooldown, rows: groupRows }) =>
                      groupKeys(String(cooldown), groupRows, canEditGroup(groupRows)),
                  ),
                  ...groupKeys('none', grouped.ungrouped, false),
              ]
            : rows.filter(matchesSearch).map(rowKey)),
    ];
    const tabStop =
        tabKey !== null && visibleKeys.includes(tabKey)
            ? tabKey
            : selected !== null && visibleKeys.includes(selected)
              ? selected
              : visibleKeys[0];
    const groupToggle = (key: string) => (event: SyntheticEvent<HTMLDetailsElement>) => {
        const open = event.currentTarget.open;
        setClosed((previous) => {
            if (open !== previous.has(key)) return previous;
            const next = new Set(previous);
            if (open) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    /** Roving-tabindex props for a non-row stop (group header, Edit group button). */
    const roving = (key: string) => ({
        'data-item-key': key,
        tabIndex: tabStop === key ? 0 : -1,
        onFocus: () => setTabKey(key),
    });
    const rowButton = (key: string) =>
        list.current?.querySelector<HTMLElement>(`[data-item-key="${CSS.escape(key)}"]`);
    function onRowKeys(event: KeyboardEvent<HTMLElement>) {
        const target = event.target;
        if (!(target instanceof HTMLElement) || target.dataset.itemKey === undefined) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const key = target.dataset.itemKey;
        if (
            target.classList.contains('row-select') &&
            (event.key === 'ContextMenu' ||
                (event.key === 'F10' && event.shiftKey) ||
                (event.key === 'ArrowRight' && !event.shiftKey))
        ) {
            event.preventDefault();
            setMenu({ id: key, signal: Date.now() });
            return;
        }
        if (event.shiftKey || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = rovingIndex(visibleKeys.length, visibleKeys.indexOf(key), event.key);
        const nextKey = next === undefined ? undefined : visibleKeys[next];
        if (nextKey === undefined) return;
        setTabKey(nextKey);
        rowButton(nextKey)?.focus();
    }
    function renderRow({ item, deleted: isDeleted, old }: EntityRow) {
        const id = String(item[idKey]),
            status = isDeleted ? 'deleted' : !old ? 'added' : !equal(item, old) ? 'modified' : '';
        return (
            <li
                key={id}
                className={`item-row ${status} ${selected === id ? 'selected' : ''}`}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onSelect(id);
                    setMenu({ id, signal: Date.now() });
                }}
            >
                <button
                    className="row-select"
                    data-item-key={id}
                    aria-pressed={selected === id}
                    tabIndex={tabStop === id ? 0 : -1}
                    onFocus={() => setTabKey(id)}
                    onClick={() => onNavigate(id)}
                >
                    <HashIdentity
                        hash={Number(item[idKey])}
                        name={String(item.Name)}
                        table={getManifestTable(item)}
                    />
                    {status && (
                        <span className={`row-status ${status}`} title={status}>
                            {status === 'added' ? '+' : status === 'deleted' ? '−' : '●'}
                            <span className="sr-only">{status}</span>
                        </span>
                    )}
                </button>
                <ItemMenu
                    label={`Actions for ${item.Name}`}
                    actions={actions(item, isDeleted)}
                    openSignal={menu.id === id ? menu.signal : 0}
                    onSignalHandled={() =>
                        setMenu((current) => (current.id === id ? { id: '', signal: 0 } : current))
                    }
                    tabStop={false}
                    focusOnClose={() => rowButton(id)}
                />
            </li>
        );
    }
    useEffect(() => {
        list.current
            ?.querySelector<HTMLElement>('[aria-pressed="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [selected, typing]);
    return (
        <section className="entity-list" aria-label={collectionLabel(collection)}>
            <div className="list-controls">
                <div className="pane-header">
                    <h2>{collectionLabel(collection)}</h2>
                    <span className="muted mono">{rows.filter((row) => !row.deleted).length}</span>
                    <div className="toolbar">
                        <button
                            className="icon-button"
                            aria-label={`Add ${entityName} draft`}
                            title="Create draft"
                            onClick={onAdd}
                        >
                            +
                        </button>
                        <button
                            className="icon-button"
                            disabled={!!draft}
                            aria-label="Add from manifest"
                            title="Add from manifest"
                            onClick={onAddFromManifest}
                        >
                            ◈+
                        </button>
                    </div>
                </div>
                <input
                    aria-label={`Search ${collectionLabel(collection)}`}
                    data-collection-search
                    type="search"
                    value={search}
                    placeholder="Filter by name or hash…"
                    onChange={(e) => onSearch(e.target.value)}
                />
            </div>
            <div
                className="scroll-pane item-rows"
                role="group"
                aria-label={`${collectionLabel(collection)} items`}
                aria-describedby={hintId}
                ref={list}
                onKeyDown={onRowKeys}
            >
                <span id={hintId} className="sr-only">
                    Use arrow keys to move
                </span>
                {draft && (
                    <button
                        className="draft-row"
                        data-item-key="draft"
                        aria-pressed={selected === 'draft'}
                        tabIndex={tabStop === 'draft' ? 0 : -1}
                        onFocus={() => setTabKey('draft')}
                        onClick={() => onNavigate('draft')}
                    >
                        <span className="badge">DRAFT</span>
                        <span>{String(draft.Name ?? '') || 'New draft'}</span>
                        <small>Not added to list</small>
                    </button>
                )}
                <ul>
                    {grouped ? (
                        <>
                            {grouped.groups.map(({ cooldown, rows: groupRows }) => {
                                const visible = groupRows.filter(matchesSearch);
                                if (!visible.length) return null;
                                const active = groupRows.filter((row) => !row.deleted),
                                    ids = active.map((row) => String(row.item[idKey]));
                                const isEditing =
                                    editingGroup?.length === ids.length &&
                                    ids.every((id) => editingGroup.includes(id));
                                return (
                                    <li className="cooldown-group" key={cooldown}>
                                        <details
                                            open={!closed.has(String(cooldown))}
                                            onToggle={groupToggle(String(cooldown))}
                                        >
                                            <summary {...roving(groupKey(String(cooldown)))}>
                                                <strong>{baseCooldownLabel}</strong>
                                                <span className="mono">{cooldown} s</span>
                                                <span className="muted">
                                                    {plural(groupRows.length, 'entry', 'entries')}
                                                </span>
                                            </summary>
                                            {canEditGroup(groupRows) && onEditGroup && (
                                                <button
                                                    className="cooldown-group-edit"
                                                    {...roving(editKey(String(cooldown)))}
                                                    aria-pressed={isEditing}
                                                    aria-label={`Edit shared fields for all ${active.length} entries with base cooldown ${cooldown} seconds`}
                                                    title={`Edit shared fields for all ${active.length} entries in this cooldown group`}
                                                    onClick={() => onEditGroup(ids)}
                                                >
                                                    Edit group ({active.length})
                                                </button>
                                            )}
                                            <ul>{visible.map(renderRow)}</ul>
                                        </details>
                                    </li>
                                );
                            })}
                            {grouped.ungrouped.some(matchesSearch) && (
                                <li className="cooldown-group">
                                    <details
                                        open={!closed.has('none')}
                                        onToggle={groupToggle('none')}
                                    >
                                        <summary {...roving(groupKey('none'))}>
                                            <strong>No {baseCooldownLabel.toLowerCase()}</strong>
                                        </summary>
                                        <ul>
                                            {grouped.ungrouped.filter(matchesSearch).map(renderRow)}
                                        </ul>
                                    </details>
                                </li>
                            )}
                        </>
                    ) : (
                        rows.filter(matchesSearch).map(renderRow)
                    )}
                </ul>
                {!rows.length && <p className="empty-state">No items. Use + to start a draft.</p>}
                {rows.length > 0 && search && !rows.some(matchesSearch) && (
                    <p className="empty-state">No items match “{search}”.</p>
                )}
            </div>
        </section>
    );
}
