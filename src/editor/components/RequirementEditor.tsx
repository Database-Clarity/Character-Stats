import { useState } from 'react';
import { validateField, type FieldSpec } from '../../core';
import { useManifest } from '../manifest';
import { editRequirement, equal, revertRequirementTable, toggleParallel } from '../state/editing';
import { HashIdentity } from './ManifestUI';
import { Modal } from './Modal';
import { numberStep } from './numberStep';
import { NumberInput } from './NumberInput';

export function RequirementEditor({
    field,
    fields,
    value,
    saved,
    abilities,
    onChange,
    fieldPrefix = '',
}: {
    field: FieldSpec;
    fields: readonly FieldSpec[];
    value: Record<string, unknown>;
    saved: Record<string, unknown>;
    abilities: Record<string, unknown>[];
    onChange(value: Record<string, unknown>): void;
    fieldPrefix?: string;
}) {
    const { subclasses, search } = useManifest();
    const [picker, setPicker] = useState(false);
    const [query, setQuery] = useState('');
    const [manual, setManual] = useState('');
    const rawRequirements = value[field.key];
    const requirements: unknown[] = Array.isArray(rawRequirements) ? rawRequirements : [];
    const abilityNames = new Map(
        abilities.flatMap((ability): [number, string][] =>
            typeof ability.Hash === 'number' && typeof ability.Name === 'string'
                ? [[ability.Hash, ability.Name]]
                : [],
        ),
    );
    const parallel = fields.filter((f) => f.lengthOf === field.key);
    const tableChanged = [field, ...parallel].some((f) => !equal(value[f.key], saved[f.key]));
    const options = [
        { title: 'All abilities', items: [{ hash: 0, name: 'All abilities (wildcard)' }] },
        {
            title: field.itemRef === 'any' ? 'Manifest items' : 'Abilities in this stat',
            items:
                field.itemRef === 'any'
                    ? search(query, { filter: (entry) => entry.table === 'item', limit: 80 }).map(
                          (entry) => ({ hash: entry.hash, name: entry.name }),
                      )
                    : abilities.map((a) => ({ hash: Number(a.Hash), name: String(a.Name) })),
        },
        ...(field.refSubclassFilters
            ? [
                  {
                      title: 'Subclass filters',
                      items: subclasses().map((e) => ({ hash: -e.hash, name: e.name })),
                  },
              ]
            : []),
    ];
    function add(hash: number) {
        onChange(editRequirement(value, fields, field.key, { type: 'add', hash }));
        setPicker(false);
        setQuery('');
    }
    return (
        <div className="requirements-editor">
            <div
                data-field={`${fieldPrefix}${field.key}`}
                className={`field-frame ${tableChanged ? 'is-modified' : ''}`}
            >
                {tableChanged && (
                    <button
                        className="revert-field"
                        aria-label="Revert requirements table"
                        title="Revert requirements table"
                        onClick={() =>
                            onChange(revertRequirementTable(value, fields, field.key, saved))
                        }
                    >
                        <span className="modified-dot" /> ↶
                    </button>
                )}
                <div className="section-bar">
                    <span className="muted">
                        {requirements.length}{' '}
                        {requirements.length === 1 ? 'reference' : 'references'}
                    </span>
                    <button onClick={() => setPicker(true)}>+ Add requirement</button>
                </div>
                <p className="help" title={field.description}>
                    {field.description}
                </p>
                <div className="table-scroll">
                    <table className="requirement-table">
                        <thead>
                            <tr>
                                <th>Requirement</th>
                                {parallel.map((f) => (
                                    <th
                                        key={f.key}
                                        data-field={`${fieldPrefix}${f.key}`}
                                        className={
                                            !equal(value[f.key], saved[f.key]) ? 'is-modified' : ''
                                        }
                                    >
                                        <label className="check" title={f.description}>
                                            <input
                                                type="checkbox"
                                                checked={value[f.key] !== undefined}
                                                onChange={(e) =>
                                                    onChange(
                                                        toggleParallel(value, f, e.target.checked),
                                                    )
                                                }
                                            />
                                            {f.label ?? f.key}
                                        </label>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {requirements.map((hash, index) => (
                                <tr key={index}>
                                    <td>
                                        <div className="requirement-row">
                                            <span className="mono muted">{index}</span>
                                            <HashIdentity
                                                hash={typeof hash === 'number' ? hash : Number.NaN}
                                                requirement={
                                                    !!field.refSubclassFilters || !!field.itemRef
                                                }
                                                name={
                                                    typeof hash === 'number'
                                                        ? abilityNames.get(hash)
                                                        : undefined
                                                }
                                                compact
                                            />
                                            <span className="chip-actions">
                                                <button
                                                    className="icon-button"
                                                    aria-label={`Move requirement ${index} up`}
                                                    disabled={!index}
                                                    onClick={() =>
                                                        onChange(
                                                            editRequirement(
                                                                value,
                                                                fields,
                                                                field.key,
                                                                {
                                                                    type: 'move',
                                                                    index,
                                                                    to: index - 1,
                                                                },
                                                            ),
                                                        )
                                                    }
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    className="icon-button"
                                                    aria-label={`Move requirement ${index} down`}
                                                    disabled={index === requirements.length - 1}
                                                    onClick={() =>
                                                        onChange(
                                                            editRequirement(
                                                                value,
                                                                fields,
                                                                field.key,
                                                                {
                                                                    type: 'move',
                                                                    index,
                                                                    to: index + 1,
                                                                },
                                                            ),
                                                        )
                                                    }
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    className="icon-button danger"
                                                    aria-label={`Remove requirement ${index}`}
                                                    onClick={() =>
                                                        onChange(
                                                            editRequirement(
                                                                value,
                                                                fields,
                                                                field.key,
                                                                {
                                                                    type: 'remove',
                                                                    index,
                                                                },
                                                            ),
                                                        )
                                                    }
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        </div>
                                    </td>
                                    {parallel.map((f) => (
                                        <td key={f.key}>
                                            {Array.isArray(value[f.key]) ? (
                                                <NumberInput
                                                    aria-label={`${f.key} requirement ${index}`}
                                                    step={numberStep(
                                                        (value[f.key] as number[])[index],
                                                        f.items,
                                                        f.kind === 'intArray' || f.items?.integer,
                                                    )}
                                                    constraints={f.items}
                                                    value={
                                                        Number.isFinite(
                                                            (value[f.key] as number[])[index],
                                                        )
                                                            ? String(
                                                                  (value[f.key] as number[])[index],
                                                              )
                                                            : ''
                                                    }
                                                    onChangeValue={(raw) =>
                                                        onChange({
                                                            ...value,
                                                            [f.key]: (value[f.key] as number[]).map(
                                                                (n, i) =>
                                                                    i === index
                                                                        ? raw === ''
                                                                            ? NaN
                                                                            : Number(raw)
                                                                        : n,
                                                            ),
                                                        })
                                                    }
                                                />
                                            ) : (
                                                <span className="muted">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {[field, ...parallel]
                .flatMap((f) => validateField(f, value[f.key], value))
                .map((issue, i) => (
                    <p className="error" key={i}>
                        {issue.message}
                    </p>
                ))}
            {picker && (
                <Modal title="Add requirement" onClose={() => setPicker(false)}>
                    <label>
                        Search abilities or subclasses
                        <input
                            autoFocus
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </label>
                    <div className="picker-results">
                        {options.map((group) => (
                            <section key={group.title}>
                                <h3>{group.title}</h3>
                                {group.items
                                    .filter((item) =>
                                        `${item.name} ${item.hash}`
                                            .toLowerCase()
                                            .includes(query.toLowerCase()),
                                    )
                                    .map((item) => (
                                        <button key={item.hash} onClick={() => add(item.hash)}>
                                            <HashIdentity
                                                hash={item.hash}
                                                requirement={
                                                    !!field.refSubclassFilters || !!field.itemRef
                                                }
                                                name={item.name}
                                                compact
                                            />
                                        </button>
                                    ))}
                            </section>
                        ))}
                    </div>
                    <label className="inline">
                        Manual hash (negative for subclass)
                        <NumberInput
                            aria-label="Manual hash (negative for subclass)"
                            step={1}
                            value={manual}
                            onChangeValue={setManual}
                        />
                    </label>
                    <button
                        disabled={
                            !manual.trim() ||
                            !Number.isInteger(Number(manual)) ||
                            Math.abs(Number(manual)) > 4294967295
                        }
                        onClick={() => add(Number(manual))}
                    >
                        Add hash
                    </button>
                </Modal>
            )}
        </div>
    );
}
