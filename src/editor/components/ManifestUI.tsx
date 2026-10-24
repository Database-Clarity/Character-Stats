import { useEffect, useMemo, useState } from 'react';
import { ManifestIcon, useManifest, type ManifestEntry, type ManifestTable } from '../manifest';
import { identityLabel, manifestStateMessage } from './manifestHelpers';
export { collectionFilter } from './manifestHelpers';
import { Modal } from './Modal';
import { ClassIcon } from './ClassIcon';

export function HashIdentity({
    hash,
    name,
    compact = false,
    requirement = false,
    table,
}: {
    hash: number;
    name?: string | undefined;
    compact?: boolean;
    requirement?: boolean;
    table?: ManifestTable | undefined;
}) {
    const { lookup } = useManifest();
    const resolvedHash = requirement ? Math.abs(hash) : hash;
    const entry = lookup(resolvedHash, table);
    const resolved = identityLabel(hash, name || entry?.name, requirement);
    return (
        <span
            className={`hash-identity ${compact ? 'compact' : ''}`}
            title={
                entry?.name && entry.name !== resolved
                    ? `Manifest: ${entry.name}`
                    : (resolved ?? 'Unknown hash')
            }
        >
            <span className="identity-icon" aria-hidden="true">
                {entry?.table === 'class' &&
                !entry.icon &&
                entry.classType !== undefined &&
                entry.classType !== 3 ? (
                    <ClassIcon type={entry.classType} name={entry.name} size={compact ? 20 : 28} />
                ) : (
                    <ManifestIcon
                        hash={resolvedHash}
                        {...(table ? { table } : {})}
                        size={compact ? 20 : 28}
                    />
                )}
            </span>
            <span className="identity-text">
                <span title={resolved ?? 'Unknown hash'}>
                    {resolved ?? 'Unknown hash'}
                    {!entry && hash !== 0 && !name && (
                        <span className="warning"> · unknown hash</span>
                    )}
                </span>
                <small
                    className="mono muted identity-hash"
                    title={`${hash}${!compact && entry?.typeName ? ` · ${entry.typeName}` : ''}`}
                >
                    {hash}
                    {!compact && entry?.typeName ? ` · ${entry.typeName}` : ''}
                </small>
            </span>
        </span>
    );
}
export function ManifestStatusBadge() {
    const { status, refresh } = useManifest();
    const text = manifestStateMessage(status);
    if (status.state === 'error')
        return (
            <button className="manifest-status error" onClick={refresh} title={status.error}>
                ↻ Manifest unavailable - retry
            </button>
        );
    if (status.state === 'ready')
        return (
            <button
                className="manifest-status ready"
                onClick={refresh}
                title={`${text}. Click to refresh.`}
                aria-label="Refresh manifest"
            >
                ↻ Manifest
            </button>
        );
    return (
        <span className={`manifest-status ${status.state}`} title={text}>
            {text}
        </span>
    );
}
export function ManifestPicker({
    title,
    filter,
    onPick,
    onClose,
    onCreateBlank,
    table,
    chooseTable = false,
}: {
    title: string;
    filter?: (entry: ManifestEntry) => boolean;
    onPick(entry: ManifestEntry): void;
    onClose(): void;
    onCreateBlank?(): void;
    table?: ManifestTable | undefined;
    chooseTable?: boolean;
}) {
    const { search, status } = useManifest();
    const [query, setQuery] = useState('');
    const [pickedTable, setPickedTable] = useState<ManifestTable>('item');
    const searchTable = chooseTable ? pickedTable : table;
    const [debouncedQuery, setDebouncedQuery] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), 120);
        return () => clearTimeout(timer);
    }, [query]);
    const groups = useMemo(() => {
        if (status.state !== 'ready') return [];
        const inTable = (entry: ManifestEntry) => !searchTable || entry.table === searchTable;
        if (!filter)
            return [
                {
                    title: 'Matches',
                    entries: search(debouncedQuery, { filter: inTable, limit: 40 }),
                },
            ];
        return [
            {
                title: 'Suggested',
                entries: search(debouncedQuery, {
                    filter: (entry) => inTable(entry) && filter(entry),
                    limit: 40,
                }),
            },
            {
                title: 'Other matches',
                entries: search(debouncedQuery, {
                    filter: (entry) => inTable(entry) && !filter(entry),
                    limit: 40,
                }),
            },
        ];
    }, [search, status.state, debouncedQuery, filter, searchTable]);
    const count = groups.reduce((total, group) => total + group.entries.length, 0);
    function focusResult() {
        document.querySelector<HTMLButtonElement>('dialog .picker-results button')?.focus();
    }
    return (
        <Modal title={title} onClose={onClose}>
            {chooseTable && (
                <label className="inline">
                    Reference type
                    <select
                        aria-label="Manifest reference type"
                        value={pickedTable}
                        onChange={(e) =>
                            setPickedTable(
                                e.target.value === 'itemCategory' ? 'itemCategory' : 'item',
                            )
                        }
                    >
                        <option value="item">Items</option>
                        <option value="itemCategory">Item categories</option>
                    </select>
                </label>
            )}
            <label className="picker-search">
                Search manifest
                <input
                    autoFocus
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault();
                            focusResult();
                        }
                        if (event.key === 'Enter') {
                            const first = groups.flatMap((group) => group.entries)[0];
                            if (first) onPick(first);
                        }
                    }}
                    placeholder="Name or hash..."
                />
            </label>
            <p className="help" role="status">
                {status.state === 'ready'
                    ? `${count} results - up to 40 per group`
                    : manifestStateMessage(status)}
            </p>
            {status.state === 'error' && <p className="warning">{status.error}</p>}
            <div
                className="picker-results"
                onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                    const buttons = Array.from(
                        event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
                    );
                    if (!buttons.length) return;
                    event.preventDefault();
                    const current = buttons.findIndex(
                        (button) => button === document.activeElement,
                    );
                    buttons[
                        (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                            buttons.length
                    ]?.focus();
                }}
            >
                {groups.map((group) => (
                    <section key={group.title} aria-label={group.title}>
                        <h4>{group.title}</h4>
                        {group.entries.map((entry) => (
                            <button
                                key={`${entry.table}:${entry.hash}`}
                                onClick={() => onPick(entry)}
                            >
                                <HashIdentity
                                    hash={entry.hash}
                                    name={entry.name}
                                    table={entry.table}
                                />
                            </button>
                        ))}
                        {!group.entries.length && (
                            <p className="muted">No matching entries in this group.</p>
                        )}
                    </section>
                ))}
                {status.state === 'ready' && !count && (
                    <p className="muted">No matching entries.</p>
                )}
            </div>
            {onCreateBlank && (status.state !== 'ready' || !count) && (
                <button onClick={onCreateBlank}>Create blank draft</button>
            )}
        </Modal>
    );
}
