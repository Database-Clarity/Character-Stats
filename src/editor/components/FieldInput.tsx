import { useId, useState } from 'react';
import { isRecord, validateField, type FieldSpec } from '../../core';
import { CurveEditor } from './CurveEditor';
import { HashIdentity, ManifestPicker } from './ManifestUI';
import { Modified, Collapse, FieldName } from './EditorPrimitives';
import { fieldDefault, numericDefault, updateNestedField } from '../state/editing';
import { EntityForm } from './EntityForm';
import { numberStep } from './numberStep';
import { ReferenceArrayInput } from './ReferenceArrayInput';
import { NumberInput } from './NumberInput';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export function NumberArrayInput({
    spec,
    value,
    onChange,
    stackCounts = false,
    integerValues = false,
}: {
    spec: FieldSpec;
    value: unknown;
    onChange(value: unknown): void;
    stackCounts?: boolean;
    integerValues?: boolean;
}) {
    const array = Array.isArray(value) ? (value as number[]) : [];
    return (
        <div className={`number-array${stackCounts ? ' number-array-stacks' : ''}`}>
            {!spec.required && (
                <label className="check">
                    <input
                        type="checkbox"
                        checked={value !== undefined}
                        onChange={(e) =>
                            onChange(
                                e.target.checked
                                    ? Array.from({ length: spec.minItems ?? 1 }, () =>
                                          numericDefault(spec, true),
                                      )
                                    : undefined,
                            )
                        }
                    />
                    Enabled
                </label>
            )}
            {(spec.required || value !== undefined) && (
                <>
                    <div className="array-elements">
                        {array.map((number, i) => (
                            <div className="array-element" key={i}>
                                <label>
                                    {stackCounts ? 'Stacks' : (spec.indexLabel ?? 'Index')}:{' '}
                                    {stackCounts ? i + 1 : i}
                                    <NumberInput
                                        aria-label={`${spec.label ?? spec.key} ${stackCounts ? 'stacks' : (spec.indexLabel ?? 'index')} ${stackCounts ? i + 1 : i}`}
                                        step={numberStep(
                                            number,
                                            spec.items,
                                            integerValues ||
                                                spec.kind === 'intArray' ||
                                                spec.items?.integer,
                                        )}
                                        constraints={spec.items}
                                        value={Number.isFinite(number) ? number : ''}
                                        onChangeValue={(raw) =>
                                            onChange(
                                                array.map((n, index) =>
                                                    index === i
                                                        ? raw === ''
                                                            ? NaN
                                                            : Number(raw)
                                                        : n,
                                                ),
                                            )
                                        }
                                    />
                                </label>
                                <button
                                    className="icon-button danger"
                                    aria-label={`Remove ${spec.key} index ${i}`}
                                    onClick={() =>
                                        onChange(array.filter((_, index) => i !== index))
                                    }
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        disabled={spec.maxItems !== undefined && array.length >= spec.maxItems}
                        onClick={() => onChange([...array, numericDefault(spec, true)])}
                    >
                        + Add value
                    </button>
                </>
            )}
        </div>
    );
}
export function FieldInput({
    spec,
    value,
    saved,
    siblings,
    file,
    path,
    fieldPath = spec.key,
    modified,
    revertTitle,
    onRevert,
    onChange,
}: {
    spec: FieldSpec;
    value: unknown;
    saved?: unknown;
    siblings: Record<string, unknown>;
    file: string;
    path: string;
    fieldPath?: string;
    modified?: boolean | undefined;
    revertTitle?: string | undefined;
    onRevert?(): void;
    onChange(value: unknown): void;
}) {
    const id = useId();
    const [picker, setPicker] = useState(false);
    const issues = validateField(spec, value, siblings);
    const label = `${spec.label ?? spec.key}${spec.required ? ' *' : ''}`;
    const table =
        siblings.RefType === 'itemCategory'
            ? 'itemCategory'
            : siblings.RefType === 'item'
              ? 'item'
              : undefined;
    const nested = spec.entity;
    const rows: unknown[] = Array.isArray(value) ? value : [];
    return (
        <Modified
            field={fieldPath}
            value={value}
            saved={saved}
            modified={modified}
            revertTitle={revertTitle}
            onRevert={onRevert ?? (() => onChange(structuredClone(saved)))}
        >
            {spec.published === false && (
                <span className="badge unpublished" title="Kept in sources but not exported.">
                    Unpublished
                </span>
            )}
            {(spec.kind === 'object' || spec.kind === 'objectArray') && nested ? (
                <Collapse
                    storageKey={`${file}:${path}`}
                    title={
                        <span title={spec.description}>
                            <FieldName spec={spec} markRequired />
                        </span>
                    }
                    className="nested-object"
                >
                    {!spec.required && (
                        <label className="check">
                            <input
                                type="checkbox"
                                checked={value !== undefined}
                                onChange={(e) =>
                                    onChange(e.target.checked ? fieldDefault(spec) : undefined)
                                }
                            />
                            Enabled
                        </label>
                    )}
                    {spec.kind === 'object' && isRecord(value) && (
                        <EntityForm
                            spec={nested}
                            value={value}
                            saved={isRecord(saved) ? saved : {}}
                            file={file}
                            path={path}
                            fieldPrefix={`${fieldPath}.`}
                            abilities={[]}
                            onChange={onChange}
                        />
                    )}
                    {spec.kind === 'objectArray' && (spec.required || value !== undefined) && (
                        <>
                            {rows.map((row, index) => (
                                <div
                                    className="nested-row"
                                    key={index}
                                    data-field={`${fieldPath}.${index}`}
                                >
                                    <div className="section-bar">
                                        <strong>
                                            {nested.name} {index + 1}
                                        </strong>
                                        <div className="toolbar">
                                            <button
                                                aria-label={`Move ${spec.key} row ${index + 1} up`}
                                                disabled={index === 0}
                                                onClick={() => {
                                                    const next = [...rows];
                                                    next.splice(
                                                        index - 1,
                                                        0,
                                                        next.splice(index, 1)[0],
                                                    );
                                                    onChange(next);
                                                }}
                                            >
                                                Up
                                            </button>
                                            <button
                                                aria-label={`Move ${spec.key} row ${index + 1} down`}
                                                disabled={index === rows.length - 1}
                                                onClick={() => {
                                                    const next = [...rows];
                                                    next.splice(
                                                        index + 1,
                                                        0,
                                                        next.splice(index, 1)[0],
                                                    );
                                                    onChange(next);
                                                }}
                                            >
                                                Down
                                            </button>
                                            <button
                                                className="danger"
                                                aria-label={`Remove ${spec.key} row ${index + 1}`}
                                                onClick={() =>
                                                    onChange(rows.filter((_, i) => i !== index))
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                    {isRecord(row) ? (
                                        nested.fields.map((field) => (
                                            <FieldInput
                                                key={field.key}
                                                spec={field}
                                                value={row[field.key]}
                                                saved={
                                                    Array.isArray(saved) && isRecord(saved[index])
                                                        ? saved[index][field.key]
                                                        : undefined
                                                }
                                                siblings={row}
                                                file={file}
                                                path={`${path}.${index}.${field.key}`}
                                                fieldPath={`${fieldPath}.${index}.${field.key}`}
                                                onChange={(next) =>
                                                    onChange(
                                                        rows.map((item, i) =>
                                                            i === index
                                                                ? updateNestedField(
                                                                      row,
                                                                      field.key,
                                                                      next,
                                                                  )
                                                                : item,
                                                        ),
                                                    )
                                                }
                                            />
                                        ))
                                    ) : (
                                        <p className="error">
                                            Expected an object. Remove this row and add a new one.
                                        </p>
                                    )}
                                </div>
                            ))}
                            <button
                                disabled={
                                    spec.maxItems !== undefined && rows.length >= spec.maxItems
                                }
                                onClick={() => {
                                    const defaults = fieldDefault({ ...spec, kind: 'object' });
                                    const unique = nested.fields.find(
                                        (f) => f.key === nested.uniqueKey,
                                    );
                                    if (isRecord(defaults) && unique?.kind === 'enum') {
                                        defaults[unique.key] =
                                            unique.values?.find(
                                                (entry) =>
                                                    !rows.some(
                                                        (row) =>
                                                            isRecord(row) &&
                                                            row[unique.key] === entry.value,
                                                    ),
                                            )?.value ?? defaults[unique.key];
                                    }
                                    onChange([...rows, defaults]);
                                }}
                            >
                                + Add row
                            </button>
                        </>
                    )}
                    {issues.map((issue, index) => (
                        <p className={issue.severity} key={index}>
                            {issue.path}: {issue.message}
                        </p>
                    ))}
                </Collapse>
            ) : spec.kind === 'curve' && spec.domain ? (
                <CurveEditor
                    spec={spec}
                    value={value}
                    saved={saved}
                    file={file}
                    path={path}
                    onChange={onChange}
                />
            ) : (
                <div className="field">
                    <label className="field-label" htmlFor={id} title={spec.description}>
                        <FieldName spec={spec} markRequired />
                        <span className="field-help" title={spec.description}>
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 11v6" />
                                <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
                            </svg>
                        </span>
                    </label>
                    <div
                        className={`field-value ${spec.kind === 'hash' ? 'hash-field-value' : ''}`}
                    >
                        {spec.kind === 'enum' ? (
                            <select
                                id={id}
                                value={String(value ?? '')}
                                aria-invalid={issues.some((i) => i.severity === 'error')}
                                title={
                                    spec.values?.find((entry) => entry.value === value)?.description
                                }
                                onChange={(e) => onChange(e.target.value || undefined)}
                            >
                                {(!spec.required ||
                                    !spec.values?.some((entry) => entry.value === value)) && (
                                    <option value={String(value ?? '')}>
                                        {value === undefined ? 'Not set' : String(value)}
                                    </option>
                                )}
                                {spec.values?.map((entry) => (
                                    <option
                                        key={entry.value}
                                        value={entry.value}
                                        title={entry.description}
                                    >
                                        {entry.value}
                                    </option>
                                ))}
                            </select>
                        ) : spec.kind === 'intArray' && spec.itemRef ? (
                            <ReferenceArrayInput
                                spec={spec}
                                value={value}
                                table={table}
                                onChange={onChange}
                            />
                        ) : spec.kind === 'numberArray' || spec.kind === 'intArray' ? (
                            <NumberArrayInput
                                spec={spec}
                                value={value}
                                onChange={onChange}
                                integerValues={
                                    siblings.Type === 'MobilityTiers' &&
                                    (spec.key === 'Values' || spec.key === 'BoostedValues')
                                }
                                stackCounts={
                                    typeof siblings.Type === 'string' &&
                                    (spec.key === 'Values' || spec.key === 'BoostedValues')
                                }
                            />
                        ) : spec.kind === 'string' || spec.kind === 'localeRef' ? (
                            spec.multiline ? (
                                <AutoResizeTextarea
                                    id={id}
                                    aria-required={!!spec.required}
                                    aria-invalid={issues.length > 0}
                                    rows={2}
                                    value={String(value ?? '')}
                                    aria-describedby={`${id}-help`}
                                    onChange={(e) =>
                                        onChange(
                                            !spec.required && !e.target.value
                                                ? undefined
                                                : e.target.value,
                                        )
                                    }
                                />
                            ) : (
                                <input
                                    id={id}
                                    aria-required={!!spec.required}
                                    aria-invalid={issues.length > 0}
                                    value={String(value ?? '')}
                                    onChange={(e) =>
                                        onChange(
                                            !spec.required && !e.target.value
                                                ? undefined
                                                : e.target.value,
                                        )
                                    }
                                />
                            )
                        ) : (
                            <>
                                <NumberInput
                                    id={id}
                                    aria-label={label}
                                    aria-required={!!spec.required}
                                    aria-invalid={issues.length > 0}
                                    step={numberStep(value, spec, spec.kind !== 'number')}
                                    constraints={spec}
                                    value={
                                        typeof value === 'number' && Number.isFinite(value)
                                            ? value
                                            : ''
                                    }
                                    aria-describedby={`${id}-help`}
                                    onChangeValue={(raw) =>
                                        onChange(raw === '' ? undefined : Number(raw))
                                    }
                                />
                                {spec.kind === 'hash' && typeof value === 'number' && (
                                    <div className="hash-resolution">
                                        <HashIdentity hash={value} table={table} />
                                    </div>
                                )}
                                {spec.kind === 'hash' && (
                                    <button onClick={() => setPicker(true)}>
                                        Pick {table === 'itemCategory' ? 'category' : 'item'}
                                    </button>
                                )}
                            </>
                        )}
                        <span className="sr-only" id={`${id}-help`}>
                            {spec.description}
                        </span>
                        {issues.map((issue, i) => (
                            <p key={i} className={issue.severity}>
                                {issue.message}
                            </p>
                        ))}
                    </div>
                </div>
            )}
            {picker && (
                <ManifestPicker
                    title={`Choose ${spec.label ?? spec.key}`}
                    table={table}
                    onClose={() => setPicker(false)}
                    onPick={(entry) => {
                        onChange(entry.hash);
                        setPicker(false);
                    }}
                />
            )}
        </Modified>
    );
}
