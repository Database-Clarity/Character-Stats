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
