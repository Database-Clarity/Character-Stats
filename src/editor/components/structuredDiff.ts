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

export function structuredDiff(before: unknown, after: unknown): StructuredDiff | undefined {
    const previous = collection(before);
    const next = collection(after);
    if (!previous && !next) return undefined;

    const kind = next?.kind ?? previous!.kind;
    const beforeValues = previous?.values ?? [];
    const afterValues = next?.values ?? [];
    const changes: StructuredChange[] = [];
    for (const key of ['Round', 'Domain']) {
        const oldValue = isRecord(before) ? before[key] : undefined;
        const newValue = isRecord(after) ? after[key] : undefined;
        if (!equal(oldValue, newValue))
            changes.push({ label: key, before: oldValue, after: newValue });
    }
    for (let index = 0; index < Math.max(beforeValues.length, afterValues.length); index++) {
        const oldValue = beforeValues[index];
        const newValue = afterValues[index];
        if (equal(oldValue, newValue)) continue;
        changes.push({
            label: `${kind === 'segment' ? 'Segment' : 'Index'} ${index}`,
            before: oldValue,
            after: newValue,
        });
    }

    return {
        kind,
        ...(previous && next && previous.kind !== next.kind
            ? {
                  formatChange: `${previous.kind === 'segment' ? 'Segments' : 'Values'} ${String.fromCharCode(0x2192)} ${next.kind === 'segment' ? 'Segments' : 'Values'}`,
              }
            : {}),
        changes,
    };
}

export function formatChangeValue(value: unknown, pretty = false): string {
    if (value === undefined) return '(not set)';
    return JSON.stringify(value, null, pretty ? 2 : undefined) ?? String(value);
}
