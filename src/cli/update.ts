import { isSchemaVersion } from '../core';

export function serializeUpdate(
    schemaVersion: string,
    lastUpdate: bigint,
    extra: Record<string, unknown> = {},
): string {
    if (!isSchemaVersion(schemaVersion)) {
        throw new Error('Schema version must have format X.Y.Z');
    }
    if (lastUpdate < 0n) {
        throw new Error('Timestamp must be non-negative');
    }
    const fields = Object.entries(extra)
        .filter(([key]) => key !== 'lastUpdate' && key !== 'schemaVersion')
        .map(([key, value]) => JSON.stringify(key) + ': ' + JSON.stringify(value));
    return (
        '{"lastUpdate": ' +
        lastUpdate.toString() +
        ', "schemaVersion": ' +
        JSON.stringify(schemaVersion) +
        (fields.length ? ', ' + fields.join(', ') : '') +
        '}\n'
    );
}
