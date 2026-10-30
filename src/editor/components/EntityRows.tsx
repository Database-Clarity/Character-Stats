import { useEffect, useRef, useState } from 'react';
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
import { collectionLabel, plural } from './textFormat';

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
            <div className="scroll-pane item-rows" ref={list}>
                {draft && (
                    <button
                        className="draft-row"
                        data-item-key="draft"
                        aria-pressed={selected === 'draft'}
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
                                        <details open>
                                            <summary>
                                                <strong>{baseCooldownLabel}</strong>
                                                <span className="mono">{cooldown} s</span>
                                                <span className="muted">
                                                    {plural(groupRows.length, 'entry', 'entries')}
                                                </span>
                                            </summary>
                                            {active.length > 1 && onEditGroup && (
                                                <button
                                                    className="cooldown-group-edit"
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
                                    <details open>
                                        <summary>
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
