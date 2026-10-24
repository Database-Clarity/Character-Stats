export interface ExportConfig {
    placement: 'inStat' | 'topLevel';
    rounding: number;
    schemaVersion: string;
}

export const defaultConfig: Readonly<ExportConfig> = {
    placement: 'inStat',
    rounding: 3,
    schemaVersion: '2.0',
};

export function isSchemaVersion(value: string): boolean {
    return /^\d+\.\d+$/.test(value);
}
