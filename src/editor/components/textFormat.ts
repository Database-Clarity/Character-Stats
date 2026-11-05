/** Formats a count with the matching singular or plural noun, e.g. `1 error`, `2 errors`. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Display name for a collection key, e.g. `SuperAbilities` -> `Super abilities`. */
export function collectionLabel(key: string): string {
    return key.replace(/([a-z])([A-Z])/g, (_, lower: string, upper: string) => {
        return `${lower} ${upper.toLowerCase()}`;
    });
}

/**
 * Sentence-case split of an identifier, e.g. `BaseStatTooltip` -> `Base stat tooltip`,
 * `ADSSpeed` -> `ADS speed`. All-caps acronyms keep their case.
 */
export function sentenceCase(key: string): string {
    const words = key
        .replace(/([a-z\d])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .split(/[\s_]+/)
        .filter(Boolean)
        .map((word) => (/^[A-Z\d]{2,}$/.test(word) ? word : word.toLowerCase()));
    const text = words.join(' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Naive singular of a plural field label, e.g. `Effects` -> `Effect`, `Entries` -> `Entry`. */
export function singular(label: string): string {
    return /ies$/i.test(label) ? label.replace(/ies$/i, 'y') : label.replace(/(?<!s)s$/i, '');
}
