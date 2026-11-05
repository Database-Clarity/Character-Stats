import type { EntitySpec, FieldSpec } from './types';

export type FieldOptions = Omit<FieldSpec, 'key' | 'kind'>;

function field(key: string, kind: FieldSpec['kind'], options: FieldOptions): FieldSpec {
    return { key, kind, required: true, ...options };
}

export function numberField(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'number', { precision: 3, ...options });
}

export function integerField(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'int', options);
}

export function numberArrayField(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'numberArray', {
        ...options,
        items: { precision: 3, ...(options.items ?? {}) },
    });
}

export function integerArrayField(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'intArray', options);
}

export function curve(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'curve', { precision: 3, items: { min: 0 }, ...options });
}

export function localeField(key: string, options: FieldOptions): FieldSpec {
    return field(key, 'localeRef', options);
}

export function hashField(key = 'Hash', options: Partial<FieldOptions> = {}): FieldSpec {
    return field(key, 'hash', {
        label: 'Manifest hash',
        help: 'Destiny manifest hash for this entry. Use Pick item to search the manifest instead of typing it.',
        description: 'D2 Manifest inventoryItem hash',
        ...options,
    });
}

export function nameField(options: Partial<FieldOptions> = {}): FieldSpec {
    return field('Name', 'string', {
        label: 'Name',
        help: "Your name for this entry in the editor and source files. It doesn't have to match the manifest name; Use manifest name copies it when they differ.",
        description:
            'For organization/debugging purposes only. Does not necessarily ' +
            'match the inventoryItem entry name from the D2 Manifest.',
        ...options,
    });
}

export function notesField(): FieldSpec {
    return field('Notes', 'string', {
        label: 'Notes',
        help: 'Private notes for authors, such as sources or open questions. Saved in the source files but never exported to apps.',
        required: false,
        exported: false,
        multiline: true,
        description: 'Editor-only author notes.',
    });
}

export function enumField(
    key: string,
    values: NonNullable<FieldSpec['values']>,
    options: FieldOptions,
): FieldSpec {
    return field(key, 'enum', { ...options, values });
}

export function objectField(key: string, entity: EntitySpec, options: FieldOptions): FieldSpec {
    return field(key, 'object', { ...options, entity });
}

export function objectArrayField(
    key: string,
    entity: EntitySpec,
    options: FieldOptions,
): FieldSpec {
    return field(key, 'objectArray', { ...options, entity });
}
