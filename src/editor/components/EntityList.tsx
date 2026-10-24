import { useState } from 'react';
import { validateEntity, type EntitySpec, type FieldSpec } from '../../core';
import { updateProperty, useEditor } from '../state/store';
import { FieldInput } from './FieldInput';
function initialValue(field: FieldSpec): unknown {
    if (field.kind === 'string' || field.kind === 'localeRef') return 'New item';
    if (field.kind === 'numberArray' || field.kind === 'intArray') return [];
    if (field.kind === 'curve') return { Values: [] };
    return 0;
}
export function EntityForm({
    spec,
    value,
    file,
    path,
    onChange,
}: {
    spec: EntitySpec;
    value: Record<string, unknown>;
    file: string;
    path: string;
    onChange(next: Record<string, unknown>): void;
}) {
    const issues = validateEntity(spec, value);
    return (
        <div className="entity-form">
            <h3>{String(value.Name ?? spec.name)}</h3>
            {spec.fields.map((field) => (
                <FieldInput
                    key={field.key}
                    spec={field}
                    value={value[field.key]}
                    siblings={value}
                    file={file}
                    path={`${path}.${field.key}`}
                    onChange={(next) => onChange(updateProperty(value, field.key, next))}
                />
            ))}
            {issues
                .filter((i) => i.path === spec.name)
                .map((issue, i) => (
                    <p className="error" key={i}>
                        {issue.message}
                    </p>
                ))}
        </div>
    );
}
export function EntityList({
    spec,
    items,
    file,
    collection,
    selected,
    onSelect,
    onChange,
}: {
    spec: EntitySpec;
    items: Record<string, unknown>[];
    file: string;
    collection: string;
    selected: number | null;
    onSelect(index: number | null): void;
    onChange(next: Record<string, unknown>[]): void;
}) {
    const [search, setSearch] = useState('');
    const { dispatch } = useEditor();
    const idKey = spec.uniqueKey ?? spec.fields.find((field) => field.kind === 'hash')?.key;
    function nextKey() {
        return (
            Math.max(
                0,
                ...items.map((item) =>
                    typeof item[idKey ?? ''] === 'number' ? (item[idKey!] as number) : 0,
                ),
            ) + 1
        );
    }
    function add(duplicate = false) {
        const current = selected === null ? undefined : items[selected];
        const value: Record<string, unknown> =
            duplicate && current
                ? structuredClone(current)
                : Object.fromEntries(
                      spec.fields.filter((f) => f.required).map((f) => [f.key, initialValue(f)]),
                  );
        if (idKey) value[idKey] = nextKey();
        if (duplicate && typeof value.Name === 'string') value.Name += ' (copy)';
        onChange([...items, value]);
        onSelect(items.length);
        setSearch('');
    }
    return (
        <div className="entity-layout">
            <section className="entity-list" aria-label={collection}>
                <label>
                    Search {collection}
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <div className="toolbar">
                    <button onClick={() => add()}>Add {spec.name}</button>
                    <button disabled={selected === null} onClick={() => add(true)}>
                        Duplicate
                    </button>
                    <button
                        className="danger"
                        disabled={selected === null}
                        onClick={() => {
                            if (
                                !window.confirm(
                                    'Delete this item? This can be undone by discarding the file.',
                                )
                            )
                                return;
                            onChange(items.filter((_, i) => i !== selected));
                            onSelect(null);
                            dispatch({ type: 'clear-drafts', prefix: `${file}:${collection}` });
                        }}
                    >
                        Delete
                    </button>
                </div>
                <ul>
                    {items
                        .map((item, index) => ({ item, index }))
                        .filter(({ item }) =>
                            `${item.Name ?? ''} ${item[idKey ?? ''] ?? ''}`
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                        )
                        .map(({ item, index }) => (
                            <li key={index}>
                                <button
                                    aria-pressed={selected === index}
                                    onClick={() => onSelect(index)}
                                >
                                    {String(item.Name ?? `Item ${index + 1}`)}
                                    <small>{String(item[idKey ?? ''] ?? '')}</small>
                                </button>
                            </li>
                        ))}
                </ul>
            </section>
            {selected !== null && items[selected] ? (
                <EntityForm
                    key={`${file}:${collection}:${selected}`}
                    spec={spec}
                    value={items[selected]!}
                    file={file}
                    path={`${collection}[${selected}]`}
                    onChange={(next) =>
                        onChange(items.map((item, index) => (index === selected ? next : item)))
                    }
                />
            ) : (
                <p className="muted">Select an item or add a new one.</p>
            )}
        </div>
    );
}
