import { useState } from 'react';
import { validateField, type FieldSpec } from '../../core';
import type { ManifestTable } from '../manifest';
import { HashIdentity, ManifestPicker } from './ManifestUI';
import { NumberInput } from './NumberInput';

export function ReferenceArrayInput({
    spec,
    value,
    table,
    onChange,
}: {
    spec: FieldSpec;
    value: unknown;
    table?: ManifestTable | undefined;
    onChange(value: unknown): void;
}) {
    const [picker, setPicker] = useState(false);
    const [manual, setManual] = useState('');
    const refs: unknown[] = Array.isArray(value) ? value : [];
    const full = spec.maxItems !== undefined && refs.length >= spec.maxItems;
    const canAdd =
        manual.trim() !== '' &&
        validateField(
            { ...spec, required: true, minItems: 1 },
            [...refs, Number(manual)],
            {},
        ).every((issue) => issue.severity !== 'error');
    function add(hash: number) {
        onChange([...refs, hash]);
        setPicker(false);
        setManual('');
    }
    return (
        <div className="reference-array">
            {!spec.required && (
                <label className="check">
                    <input
                        type="checkbox"
                        checked={value !== undefined}
                        onChange={(event) => onChange(event.target.checked ? [] : undefined)}
                    />
                    Enabled
                </label>
            )}
            {(spec.required || value !== undefined) && (
                <>
                    <div className="reference-chips">
                        {refs.map((hash, index) => (
                            <div className="reference-chip" key={index}>
                                <HashIdentity
                                    hash={typeof hash === 'number' ? hash : NaN}
                                    table={table}
                                    compact
                                />
                                <button
                                    className="icon-button danger"
                                    aria-label={`Remove ${spec.key} reference ${index}`}
                                    onClick={() => onChange(refs.filter((_, i) => i !== index))}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <button disabled={full} onClick={() => setPicker(true)}>
                        + Add reference
                    </button>
                    <label className="inline">
                        Manual hash
                        <NumberInput
                            aria-label="Manual hash"
                            step={1}
                            constraints={{ min: 0, max: 4294967295 }}
                            value={manual}
                            onChangeValue={setManual}
                        />
                    </label>
                    <button disabled={full || !canAdd} onClick={() => add(Number(manual))}>
                        Add hash
                    </button>
                </>
            )}
            {picker && (
                <ManifestPicker
                    title={`Add ${spec.label ?? spec.key}`}
                    table={table ?? 'item'}
                    onClose={() => setPicker(false)}
                    onPick={(entry) => add(entry.hash)}
                />
            )}
        </div>
    );
}
