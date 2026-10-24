import { useId } from 'react';
import { validateField, type FieldSpec } from '../../core';
import { CurveEditor } from './CurveEditor';
import { HashIdentity } from './ManifestUI';
import { Modified } from './EditorPrimitives';
import { numericDefault } from '../state/editing';

export function NumberArrayInput({
    spec,
    value,
    onChange,
}: {
    spec: FieldSpec;
    value: unknown;
    onChange(value: unknown): void;
}) {
    const array = Array.isArray(value) ? (value as number[]) : [];
    return (
        <div className="number-array">
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
                                    {spec.indexLabel ?? 'Index'}: {i}
                                    <input
                                        aria-label={`${spec.key} ${spec.indexLabel ?? 'index'} ${i}`}
                                        type="number"
                                        step={spec.kind === 'intArray' ? 1 : 'any'}
                                        value={Number.isFinite(number) ? number : ''}
                                        onChange={(e) =>
                                            onChange(
                                                array.map((n, index) =>
                                                    index === i
                                                        ? e.target.value === ''
                                                            ? NaN
                                                            : Number(e.target.value)
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
    onChange,
}: {
    spec: FieldSpec;
    value: unknown;
    saved?: unknown;
    siblings: Record<string, unknown>;
    file: string;
    path: string;
    onChange(value: unknown): void;
}) {
    const id = useId();
    const issues = validateField(spec, value, siblings);
    const label = `${spec.label ?? spec.key}${spec.required ? ' *' : ''}`;
    return (
        <Modified
            field={spec.key}
            value={value}
            saved={saved}
            onRevert={() => onChange(structuredClone(saved))}
        >
            {spec.published === false && <span className="badge">Unpublished</span>}
            {spec.kind === 'enum' || spec.kind === 'object' || spec.kind === 'objectArray' ? (
                <div className="field">
                    <label className="field-label" title={spec.description}>
                        {label}
                    </label>
                    <p className="muted">Read-only preview ? editing coming in step 2.</p>
                    {spec.entity?.fields
                        .filter((field) => field.published === false)
                        .map((field) => (
                            <span className="badge" key={field.key}>
                                {field.label ?? field.key}: Unpublished
                            </span>
                        ))}
                    <pre>{JSON.stringify(value, null, 2) ?? 'Not set'}</pre>
                    {issues.map((issue, index) => (
                        <p className={issue.severity} key={index}>
                            {issue.message}
                        </p>
                    ))}
                </div>
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
                        {label}
                        <span className="field-help" title={spec.description}>
                            ⓘ
                        </span>
                    </label>
                    <div
                        className={`field-value ${spec.kind === 'hash' ? 'hash-field-value' : ''}`}
                    >
                        {spec.kind === 'numberArray' || spec.kind === 'intArray' ? (
                            <NumberArrayInput spec={spec} value={value} onChange={onChange} />
                        ) : spec.kind === 'string' || spec.kind === 'localeRef' ? (
                            spec.multiline ? (
                                <textarea
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
                                <input
                                    id={id}
                                    aria-required={!!spec.required}
                                    aria-invalid={issues.length > 0}
                                    type="number"
                                    step={spec.kind === 'number' ? 'any' : 1}
                                    value={
                                        typeof value === 'number' && Number.isFinite(value)
                                            ? value
                                            : ''
                                    }
                                    aria-describedby={`${id}-help`}
                                    onChange={(e) =>
                                        onChange(
                                            e.target.value === ''
                                                ? undefined
                                                : Number(e.target.value),
                                        )
                                    }
                                />
                                {spec.kind === 'hash' && typeof value === 'number' && (
                                    <div className="hash-resolution">
                                        <HashIdentity hash={value} />
                                    </div>
                                )}
                            </>
                        )}
                        <span className="sr-only" id={`${id}-help`}>
                            {spec.description}
                        </span>
                        {issues.map((issue, i) => (
                            <p key={i} className="error">
                                {issue.message}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </Modified>
    );
}
