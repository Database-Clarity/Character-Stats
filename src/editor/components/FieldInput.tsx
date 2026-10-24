import { useId } from 'react';
import { validateField, type FieldSpec } from '../../core';
import { CurveEditor } from './CurveEditor';
import { JsonInput } from './JsonInput';
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
    if (spec.kind === 'curve' && spec.domain)
        return (
            <CurveEditor
                spec={spec}
                value={value}
                saved={saved}
                file={file}
                path={path}
                onChange={onChange}
            />
        );
    const isArray = spec.kind === 'numberArray' || spec.kind === 'intArray';
    const issues = validateField(spec, value, siblings);
    const label = `${spec.label ?? spec.key}${spec.required ? ' *' : ''}`;
    return (
        <div className="field">
            <div className="field-title">
                {isArray ? <span>{label}</span> : <label htmlFor={id}>{label}</label>}
            </div>
            <p id={id + '-help'} className="help">
                {spec.description}
            </p>
            {isArray ? (
                <JsonInput
                    file={file}
                    path={path}
                    label={`${spec.key} JSON array`}
                    value={value}
                    onChange={onChange}
                    optional={!spec.required}
                />
            ) : spec.kind === 'string' || spec.kind === 'localeRef' ? (
                spec.multiline ? (
                    <textarea
                        id={id}
                        value={String(value ?? '')}
                        aria-describedby={id + '-help'}
                        onChange={(e) =>
                            onChange(
                                !spec.required && e.target.value === ''
                                    ? undefined
                                    : e.target.value,
                            )
                        }
                    />
                ) : (
                    <input
                        id={id}
                        value={String(value ?? '')}
                        aria-describedby={id + '-help'}
                        onChange={(e) =>
                            onChange(
                                !spec.required && e.target.value === ''
                                    ? undefined
                                    : e.target.value,
                            )
                        }
                    />
                )
            ) : (
                <input
                    id={id}
                    type="number"
                    step={spec.kind === 'number' ? 'any' : 1}
                    value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
                    aria-describedby={id + '-help'}
                    aria-invalid={issues.length > 0}
                    onChange={(e) =>
                        onChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                />
            )}
            {issues.map((issue, i) => (
                <p key={i} className="error">
                    {issue.message}
                </p>
            ))}
        </div>
    );
}
