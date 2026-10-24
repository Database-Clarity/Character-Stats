import { useEffect, useRef, useState } from 'react';
import { equal, type EntityRow } from '../state/editing';
import { HashIdentity } from './ManifestUI';
import { ItemMenu, type ItemAction } from './ItemMenu';

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
    onAdd,
    onAddFromManifest,
}: {
    collection: string;
    entityName: string;
    idKey: string;
    rows: EntityRow[];
    draft?: Record<string, unknown> | undefined;
    selected: string | null;
    search: string;
    getManifestName(hash: number): string | undefined;
    actions(item: Record<string, unknown>, isDeleted: boolean): ItemAction[];
    onSearch(value: string): void;
    onSelect(key: string | null): void;
    onAdd(): void;
    onAddFromManifest(): void;
}) {
    const [menu, setMenu] = useState<{ id: string; signal: number }>({ id: '', signal: 0 });
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => {
        list.current
            ?.querySelector<HTMLElement>('[aria-pressed="true"]')
            ?.scrollIntoView({ block: 'nearest' });
    }, [selected]);
    return (
        <section className="entity-list" aria-label={collection}>
            <div className="list-controls">
                <div className="pane-header">
                    <strong>{collection}</strong>
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
                    aria-label={`Search ${collection}`}
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
                        aria-pressed={selected === 'draft'}
                        onClick={() => onSelect('draft')}
                    >
                        <span className="badge">DRAFT</span>
                        <span>{String(draft.Name ?? '') || 'New draft'}</span>
                        <small>Not added to list</small>
                    </button>
                )}
                <ul>
                    {rows
                        .filter(({ item }) =>
                            `${item.Name} ${item[idKey]} ${getManifestName(Number(item[idKey])) ?? ''}`
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                        )
                        .map(({ item, deleted: isDeleted, old }) => {
                            const id = String(item[idKey]),
                                status = isDeleted
                                    ? 'deleted'
                                    : !old
                                      ? 'added'
                                      : !equal(item, old)
                                        ? 'modified'
                                        : '';
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
                                        aria-pressed={selected === id}
                                        onClick={() => onSelect(id)}
                                    >
                                        <HashIdentity
                                            hash={Number(item[idKey])}
                                            name={String(item.Name)}
                                        />
                                        {status && (
                                            <span className={`row-status ${status}`} title={status}>
                                                {status === 'added'
                                                    ? '+'
                                                    : status === 'deleted'
                                                      ? '−'
                                                      : '●'}
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
                        })}
                </ul>
                {!rows.length && <p className="empty-state">No items. Use + to start a draft.</p>}
            </div>
        </section>
    );
}
