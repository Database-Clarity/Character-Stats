import { useState, type ReactNode } from 'react';
import { validateField, type FieldSpec } from '../../core';
import { useManifest, type ManifestTable } from '../manifest';
import { HashIdentity, ManifestPicker } from './ManifestUI';
import { NumberInput } from './NumberInput';

const collapseAbove = 6;

/** "Lightweight Frame ×21, Other, Third + 2 more": identical names are counted, not repeated. */
function summarize(refs: unknown[], nameOf: (hash: number) => string | undefined): string {
    const counts = new Map<string, number>();
    for (const hash of refs) {
        const name =
            (typeof hash === 'number' ? nameOf(hash) : undefined) ?? `hash ${String(hash)}`;
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const parts = [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
    return (
        `${refs.length}: ` +
        parts.slice(0, 3).join(', ') +
        (parts.length > 3 ? ` + ${parts.length - 3} more` : '')
    );
}

function ChipList({
    summary,
    open,
    children,
}: {
    summary: string | undefined;
    /** Opens the collapsed list when an entry needs attention or was just added. */
    open: boolean;
    children: ReactNode;
}) {
    return summary === undefined ? (
        <div className="reference-chips">{children}</div>
    ) : (
        <details className="reference-details" open={open || undefined}>
            <summary title={summary}>{summary}</summary>
            <div className="reference-chips">{children}</div>
        </details>
    );
}

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
    const { lookup } = useManifest();
    const label = spec.label ?? spec.key;
    const [picker, setPicker] = useState(false);
    const [manual, setManual] = useState('');
    const [duplicateError, setDuplicateError] = useState<string>();
    const [added, setAdded] = useState(false);
    const refs: unknown[] = Array.isArray(value) ? value : [];
    // Long lists (for example 24 identically named frames) collapse to a one-line summary.
    const collapsible = refs.length > collapseAbove;
    const unknown = refs.filter((hash) => typeof hash !== 'number' || !lookup(hash, table)).length;
    const summary = collapsible
        ? summarize(refs, (hash) => lookup(hash, table)?.name) +
          (unknown ? ` · ${unknown} unknown` : '')
        : '';
    const full = spec.maxItems !== undefined && refs.length >= spec.maxItems;
    const candidateIssues =
        manual.trim() === ''
            ? []
            : validateField(
                  { ...spec, required: true, minItems: 1 },
                  [...refs, Number(manual)],
                  {},
              );
    const canAdd =
        manual.trim() !== '' && candidateIssues.every((issue) => issue.severity !== 'error');
    function add(hash: number) {
        if (spec.uniqueItems && refs.includes(hash)) {
            setDuplicateError(`Duplicate ${label} reference: ${hash}`);
            setPicker(false);
            return;
        }
        onChange([...refs, hash]);
        setAdded(true);
        setDuplicateError(undefined);
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
                        aria-label={`Enable ${label}`}
                    />
                    Enabled
                </label>
            )}
            {(spec.required || value !== undefined) && (
                <>
                    <ChipList
                        summary={collapsible ? summary : undefined}
                        open={added || unknown > 0}
                    >
                        {refs.map((hash, index) => (
                            <div className="reference-chip" key={index}>
                                <HashIdentity
                                    hash={typeof hash === 'number' ? hash : NaN}
                                    table={table}
                                    compact
                                />
                                <button
                                    className="icon-button danger"
                                    aria-label={`Remove ${
                                        (typeof hash === 'number'
                                            ? lookup(hash, table)?.name
                                            : undefined) ?? `hash ${String(hash)}`
                                    } from ${label}`}
                                    onClick={() => onChange(refs.filter((_, i) => i !== index))}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </ChipList>
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
                            onChangeValue={(next) => {
                                setManual(next);
                                setDuplicateError(undefined);
                            }}
                        />
                    </label>
                    <button disabled={full || !canAdd} onClick={() => add(Number(manual))}>
                        Add hash
                    </button>
                    {duplicateError && <p className="error">{duplicateError}</p>}
                    {candidateIssues
                        .filter((issue) => issue.message.startsWith('Duplicate'))
                        .map((issue, index) => (
                            <p className="error" key={index}>
                                {issue.message}
                            </p>
                        ))}
                </>
            )}
            {picker && (
                <ManifestPicker
                    title={`Add ${label}`}
                    table={table ?? 'item'}
                    onClose={() => setPicker(false)}
                    onPick={(entry) => add(entry.hash)}
                />
            )}
        </div>
    );
}
