import { isRecord, type EntitySpec, type LocaleData } from '../../core';
import { identityKey } from './editing';
import { sentenceCase } from '../components/textFormat';

export function updateLocaleText(locale: LocaleData, id: string, text: string): LocaleData {
    const keys = id.split('.'),
        result = structuredClone(locale);
    let node = result;
    for (const key of keys.slice(0, -1)) {
        if (!isRecord(node[key])) node[key] = {};
        node = node[key] as LocaleData;
    }
    node[keys.at(-1)!] = text;
    return result;
}

function localeTextLeaves(value: unknown, prefix: string): string[] {
    return typeof value === 'string'
        ? [prefix]
        : isRecord(value)
          ? Object.entries(value).flatMap(([key, next]) =>
                localeTextLeaves(next, `${prefix}.${key}`),
            )
          : [];
}

function localeValueAt(locale: LocaleData, id: string): unknown {
    let value: unknown = locale;
    for (const key of id.split('.')) {
        if (!isRecord(value) || !Object.hasOwn(value, key)) return undefined;
        value = value[key];
    }
    return value;
}

export function localeTextIds(locale: LocaleData, prefix: string): string[] {
    return localeTextLeaves(localeValueAt(locale, prefix), prefix);
}

export function entryLocaleTextIds(
    locale: LocaleData,
    stat: string,
    collection: string,
    spec: EntitySpec,
    entry: Record<string, unknown>,
): string[] {
    const identity = entry[identityKey(spec)];
    if (typeof identity !== 'number' || !Number.isFinite(identity)) return [];
    return localeTextIds(locale, `${stat}.${collection}.${identity}`);
}

/** Readable title for a locale ID; the raw ID stays available as the dimmed key. */
export function localeEntryLabel(
    id: string,
    stat: string,
    collections: Readonly<Record<string, EntitySpec>>,
    source: Record<string, unknown>,
): string {
    const plain = () =>
        (id.startsWith(stat + '.') ? id.slice(stat.length + 1) : id)
            .split('.')
            .map(sentenceCase)
            .join(' · ');
    const [idStat, collection, identity, ...field] = id.split('.');
    if (idStat !== stat || !collection || !identity || !field.length || !/^\d+$/.test(identity))
        return plain();
    const entitySpec = collections[collection];
    if (!entitySpec) return plain();
    const key = identityKey(entitySpec);

    const entries = source[collection];
    if (!Array.isArray(entries)) return plain();
    const entry = entries.find(
        (candidate) =>
            isRecord(candidate) &&
            String(candidate[key]) === identity &&
            typeof candidate.Name === 'string' &&
            candidate.Name.trim().length > 0,
    );
    if (!isRecord(entry) || typeof entry.Name !== 'string') return plain();
    return `${entry.Name} · ${field.map(sentenceCase).join(' · ')}`;
}
