import { isRecord, movementSpec } from '../../core';

export const MOVEMENT_FILE = 'sources/movement.json';
export const LOCALE_FILE = 'locale/en.json';
export const STATS_DIR = 'sources/stats/';

export function isStatFile(path: string): boolean {
    return path.startsWith(STATS_DIR);
}

export function statFilePath(
    values: Record<string, unknown>,
    statName: string,
): string | undefined {
    if (statName === movementSpec.name) return MOVEMENT_FILE;
    return Object.keys(values).find((path) => {
        const value = values[path];
        return isStatFile(path) && isRecord(value) && value.Name === statName;
    });
}
