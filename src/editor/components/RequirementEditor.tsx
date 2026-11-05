import { useContext, useRef, useState, type KeyboardEvent } from 'react';
import { validateField, type FieldSpec } from '../../core';
import { useManifest } from '../manifest';
import { editRequirement, equal, revertRequirementTable, toggleParallel } from '../state/editing';
import { HashIdentity } from './ManifestUI';
import { duplicateNameNotes, filterPickerGroups } from './manifestHelpers';
import { DraftValidationContext, issuesVisible } from './draftValidation';
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
    const draftValidation = useContext(DraftValidationContext);
    const [picker, setPicker] = useState(false);
    const [query, setQuery] = useState('');
    const [manual, setManual] = useState('');
    const searchBox = useRef<HTMLInputElement>(null);
    // Touch keeps the keyboard closed until the search is tapped.
    const coarse = () => window.matchMedia('(pointer: coarse)').matches;
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
    function subclassItems() {
        const entries = subclasses(),
            notes = duplicateNameNotes(entries);
        return entries.map((e) => {
            const note = notes.get(e.hash);
            return { hash: -e.hash, name: e.name, ...(note ? { note } : {}) };
        });
    }
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
                      items: subclassItems(),
                  },
              ]
            : []),
    ];
    function add(hash: number) {
        onChange(editRequirement(value, fields, field.key, { type: 'add', hash }));
    }
    const added = new Set(requirements);
    const manualHash = Number(manual);
    const manualValid =
        /^-?\d+$/.test(manual.trim()) &&
        Math.abs(manualHash) <= 4294967295 &&
        !added.has(manualHash);
    function closePicker() {
        setPicker(false);
        setQuery('');
        setManual('');
    }
    // Only errors the author may see yet; array-level ones mark the Add button, cell ones the cell.
    const shown = [field, ...parallel]
        .filter((f) => issuesVisible(draftValidation, `${fieldPrefix}${f.key}`))
        .map((f) => ({ f, issues: validateField(f, value[f.key], value) }));
    const tableInvalid = shown.some(({ issues }) =>
        issues.some((issue) => !issue.path.endsWith(']')),
    );
    const cellInvalid = (key: string, index: number) =>
        shown.some(({ issues }) => issues.some((issue) => issue.path === `${key}[${index}]`));
    function moveToResults(event: KeyboardEvent<HTMLElement>) {
        event.preventDefault();
        event.currentTarget
            .closest('dialog')
            ?.querySelector<HTMLButtonElement>('.picker-results button:not(:disabled)')
            ?.focus();
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
                    <button aria-invalid={tableInvalid} onClick={() => setPicker(true)}>
                        + Add requirement
                    </button>
                </div>
                <p className="help">{field.help ?? field.description}</p>
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
                                        <label className="check" title={f.help ?? f.description}>
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
                                        <td key={f.key} data-field={`${fieldPrefix}${f.key}`}>
                                            {Array.isArray(value[f.key]) ? (
                                                <NumberInput
                                                    inputMode={
                                                        f.kind === 'intArray' || f.items?.integer
                                                            ? 'numeric'
                                                            : 'decimal'
                                                    }
                                                    aria-label={`${f.key} requirement ${index}`}
                                                    aria-invalid={cellInvalid(f.key, index)}
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
            {shown
                .flatMap(({ issues }) => issues)
                .map((issue, i) => (
                    <p className="error" key={i}>
                        {issue.message}
                    </p>
                ))}
            {picker && (
                <Modal title="Add requirement" onClose={closePicker} focusInput={!coarse()}>
                    <label>
                        Search abilities or subclasses
                        <input
                            ref={searchBox}
                            {...(coarse() ? {} : { 'data-autofocus': true })}
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') moveToResults(e);
                            }}
                        />
                    </label>
                    <div
                        className="picker-results"
                        onKeyDown={(e) => {
                            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                            e.preventDefault();
                            const buttons = Array.from(
                                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                                    'button:not(:disabled)',
                                ),
                            );
                            const index = buttons.indexOf(
                                document.activeElement as HTMLButtonElement,
                            );
                            buttons[
                                (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                                    buttons.length
                            ]?.focus();
                        }}
                    >
                        {filterPickerGroups(options, query).map((group) => (
                            <section key={group.title}>
                                <h3>{group.title}</h3>
                                {group.items.map((item) => (
                                    <button
                                        key={item.hash}
                                        disabled={added.has(item.hash)}
                                        aria-pressed={added.has(item.hash)}
                                        onClick={() => {
                                            add(item.hash);
                                            if (!coarse()) searchBox.current?.focus();
                                        }}
                                    >
                                        <HashIdentity
                                            hash={item.hash}
                                            requirement={
                                                !!field.refSubclassFilters || !!field.itemRef
                                            }
                                            name={item.name}
                                            {...(item.note ? { note: item.note } : {})}
                                            compact
                                        />
                                        {added.has(item.hash) && (
                                            <span className="badge">✓ added</span>
                                        )}
                                    </button>
                                ))}
                            </section>
                        ))}
                    </div>
                    <label className="inline">
                        Manual hash (negative for subclass)
                        <input
                            aria-label="Manual hash (negative for subclass)"
                            // No inputMode: numeric pads on iOS have no minus key for subclass hashes.
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={11}
                            value={manual}
                            onChange={(e) => setManual(e.target.value.replace(/[^\d-]/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key !== 'Enter' || !manualValid) return;
                                e.preventDefault();
                                add(manualHash);
                                setManual('');
                            }}
                        />
                    </label>
                    <div className="dialog-actions">
                        <button
                            disabled={!manualValid}
                            onClick={() => {
                                add(manualHash);
                                setManual('');
                            }}
                        >
                            Add hash
                        </button>
                        <button className="primary" onClick={closePicker}>
                            Done
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
