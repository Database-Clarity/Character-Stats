import { validateEntity, type EntitySpec } from '../../core';
import { updateProperty } from '../state/store';
import { FieldInput } from './FieldInput';
import { Collapse } from './EditorPrimitives';
import { RequirementEditor } from './RequirementEditor';

export function EntityForm({
    spec,
    value,
    saved,
    file,
    path,
    abilities,
    fieldPrefix = '',
    onChange,
}: {
    spec: EntitySpec;
    value: Record<string, unknown>;
    saved: Record<string, unknown>;
    file: string;
    path: string;
    abilities: Record<string, unknown>[];
    fieldPrefix?: string;
    onChange(next: Record<string, unknown>): void;
}) {
    const requirements = spec.fields.filter(
        (f) =>
            f.itemRef &&
            f.kind === 'intArray' &&
            (f.refSubclassFilters || spec.fields.some((column) => column.lengthOf === f.key)),
    );
    const normal = spec.fields.filter(
        (f) => !requirements.includes(f) && !requirements.some((r) => f.lengthOf === r.key),
    );
    const groups = [...new Set(normal.map((f) => f.group ?? 'Properties'))];
    const issues = validateEntity(spec, value);
    return (
        <div className="entity-form">
            {groups.map((group) => (
                <Collapse key={group} storageKey={`${file}:${path}:${group}`} title={group}>
                    {normal
                        .filter((f) => (f.group ?? 'Properties') === group)
                        .map((field) => (
                            <FieldInput
                                key={field.key}
                                spec={field}
                                value={value[field.key]}
                                saved={saved[field.key]}
                                siblings={value}
                                file={file}
                                path={`${path}.${field.key}`}
                                fieldPath={`${fieldPrefix}${field.key}`}
                                onChange={(next) =>
                                    onChange(updateProperty(value, field.key, next))
                                }
                            />
                        ))}
                </Collapse>
            ))}
            {requirements.map((field) => (
                <Collapse
                    key={field.key}
                    storageKey={`${file}:${path}:${field.key}`}
                    title={field.label ?? field.key}
                >
                    <RequirementEditor
                        field={field}
                        fields={spec.fields}
                        value={value}
                        saved={saved}
                        abilities={abilities}
                        fieldPrefix={fieldPrefix}
                        onChange={onChange}
                    />
                </Collapse>
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
