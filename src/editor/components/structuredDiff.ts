export type StructuredChangeKind = 'index' | 'segment';

export interface StructuredChange {
    label: string;
    before: unknown;
    after: unknown;
}

export interface StructuredDiff {
    kind: StructuredChangeKind;
    formatChange?: string;
    changes: StructuredChange[];
}

interface Collection {
    kind: StructuredChangeKind;
    values: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collection(value: unknown): Collection | undefined {
    if (Array.isArray(value)) return { kind: 'index', values: value };
    if (!isRecord(value)) return undefined;
    if (Array.isArray(value.Values)) return { kind: 'index', values: value.Values };
    if (Array.isArray(value.Segments)) return { kind: 'segment', values: value.Segments };
    return undefined;
}

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const ARROW = String.fromCharCode(0x2192);

/** Property-level changes inside one segment, or the whole segment when its shape changed. */
function segmentChanges(index: number, before: unknown, after: unknown): StructuredChange[] {
    const label = `Segment ${index + 1}`;
    if (!isRecord(before) || !isRecord(after) || before.Type !== after.Type)
        return [{ label, before, after }];
    const changes: StructuredChange[] = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (equal(before[key], after[key])) continue;
        const old = before[key];
        const next = after[key];
        if (key === 'Points' && Array.isArray(old) && Array.isArray(next)) {
            for (let point = 0; point < Math.max(old.length, next.length); point++) {
                const a: unknown = old[point];
                const b: unknown = next[point];
                if (equal(a, b)) continue;
                if (Array.isArray(a) && Array.isArray(b))
                    (['x', 'y'] as const).forEach((axis, i) => {
                        if (!equal(a[i], b[i]))
                            changes.push({
                                label: `${label} · Point ${point} ${axis}`,
                                before: a[i],
                                after: b[i],
                            });
                    });
                else changes.push({ label: `${label} · Point ${point}`, before: a, after: b });
            }
        } else changes.push({ label: `${label} · ${key}`, before: old, after: next });
    }
    return changes;
}

export function structuredDiff(before: unknown, after: unknown): StructuredDiff | undefined {
    const previous = collection(before);
    const next = collection(after);
    if (!previous && !next) return undefined;

    const kind = next?.kind ?? previous!.kind;
    const changes: StructuredChange[] = [];
    for (const key of ['Round', 'Domain']) {
        const oldValue = isRecord(before) ? before[key] : undefined;
        const newValue = isRecord(after) ? after[key] : undefined;
        if (!equal(oldValue, newValue))
            changes.push({ label: key, before: oldValue, after: newValue });
    }
    if (previous && next && previous.kind !== next.kind) {
        const name = (k: StructuredChangeKind) => (k === 'segment' ? 'Segments' : 'Values');
        const noun = next.kind === 'segment' ? 'segment' : 'value';
        const count = `${next.values.length} ${next.values.length === 1 ? noun : `${noun}s`}`;
        return {
            kind,
            formatChange: `Converted ${name(previous.kind)} ${ARROW} ${name(next.kind)} (${count})`,
            changes,
        };
    }
    const beforeValues = previous?.values ?? [];
    const afterValues = next?.values ?? [];
    for (let index = 0; index < Math.max(beforeValues.length, afterValues.length); index++) {
        const oldValue = beforeValues[index];
        const newValue = afterValues[index];
        if (equal(oldValue, newValue)) continue;
        if (kind === 'segment' && index < beforeValues.length && index < afterValues.length)
            changes.push(...segmentChanges(index, oldValue, newValue));
        else
            changes.push({
                label: kind === 'segment' ? `Segment ${index + 1}` : `Index ${index}`,
                before: oldValue,
                after: newValue,
            });
    }
    return { kind, changes };
}

export function formatChangeValue(value: unknown, pretty = false): string {
    if (value === undefined) return '(not set)';
    return JSON.stringify(value, null, pretty ? 2 : undefined) ?? String(value);
}
