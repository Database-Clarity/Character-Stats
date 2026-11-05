import type { ManifestEntry } from './types';

type Definition = Record<string, unknown>;
type DefinitionTable = Record<string, unknown>;
type TableName = ManifestEntry['table'];
type ProgressCallback = (processed: number, total: number, table: TableName) => void;

const BUNGIE_ORIGIN = 'https://www.bungie.net';
const SUBCLASS_BUCKET_HASH = 3284755031;
const SUBCLASS_CATEGORY_HASH = 50;

function asRecord(value: unknown): Definition | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Definition)
        : undefined;
}

function asTable(value: unknown): DefinitionTable {
    return asRecord(value) ?? {};
}

function nonEmptyString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function validClassType(value: unknown): 0 | 1 | 2 | 3 | undefined {
    return value === 0 || value === 1 || value === 2 || value === 3 ? value : undefined;
}

function bungieIcon(value: unknown): string | undefined {
    const icon = nonEmptyString(value);
    if (!icon) return undefined;
    if (icon.startsWith(`${BUNGIE_ORIGIN}/`)) return icon;
    if (/^https?:\/\//i.test(icon)) {
        try {
            const url = new URL(icon);
            if (
                url.hostname.toLowerCase() !== 'bungie.net' &&
                url.hostname.toLowerCase() !== 'www.bungie.net'
            ) {
                return undefined;
            }
            return `${BUNGIE_ORIGIN}${url.pathname}${url.search}`;
        } catch {
            return undefined;
        }
    }
    return `${BUNGIE_ORIGIN}/${icon.replace(/^\/+/, '')}`;
}

function abilityKindFromCategory(
    category: string,
): 'grenade' | 'melee' | 'class' | 'super' | undefined {
    const normalized = category.toLowerCase();
    if (/\bclass\s+ability\b/.test(normalized)) return 'class';
    if (/\bsuper(?:\s+ability)?\b/.test(normalized)) return 'super';
    if (/\bmelee\b/.test(normalized)) return 'melee';
    if (/\bgrenade\b/.test(normalized) && !/\bgrenade\s+launcher\b/.test(normalized)) {
        return 'grenade';
    }
    return undefined;
}

/**
 * Lite definitions omit plug and trait fields. For ability plugs, itemTypeDisplayName is the
 * available equivalent signal (for example "Arc Grenade" or "Class Ability"); it is retained
 * verbatim in plugCategory so collection filters can distinguish the displayed ability groups.
 */
function plugCategoryOf(
    definition: Definition,
    itemTypeDisplayName: string | undefined,
): string | undefined {
    const plug = asRecord(definition.plug);
    const identifier = nonEmptyString(plug?.plugCategoryIdentifier);
    if (identifier) return identifier;
    return itemTypeDisplayName && abilityKindFromCategory(itemTypeDisplayName)
        ? itemTypeDisplayName
        : undefined;
}

function isDisplayPropertiesRedacted(definition: Definition, display: Definition): boolean {
    const name = nonEmptyString(display.name);
    return (
        definition.redacted === true ||
        display.redacted === true ||
        !name ||
        /^(?:redacted|classified)$/i.test(name)
    );
}

function makeEntry(
    hashText: string,
    rawDefinition: unknown,
    table: TableName,
): ManifestEntry | undefined {
    const definition = asRecord(rawDefinition);
    if (!definition) return undefined;
    const hash = Number(hashText);
    if (!Number.isInteger(hash) || hash < 0 || hash > 0xffffffff) return undefined;
    const display = asRecord(definition.displayProperties);
    if (!display || isDisplayPropertiesRedacted(definition, display)) return undefined;

    const name = nonEmptyString(display.name);
    if (!name) return undefined;
    const entry: ManifestEntry = { hash: hash >>> 0, name, table };
    const icon = bungieIcon(display.icon);
    if (icon) entry.icon = icon;
    const description = nonEmptyString(display.description);
    if (description) entry.description = description;

    const classType = validClassType(definition.classType);
    if (classType !== undefined) entry.classType = classType;

    if (table === 'item') {
        const typeName = nonEmptyString(definition.itemTypeDisplayName);
        if (typeName) entry.typeName = typeName;
        const itemType = definition.itemType;
        const inventory = asRecord(definition.inventory);
        const bucketTypeHash = inventory?.bucketTypeHash;
        const categories = Array.isArray(definition.itemCategoryHashes)
            ? definition.itemCategoryHashes
            : [];
        entry.isSubclass =
            itemType === 16 ||
            bucketTypeHash === SUBCLASS_BUCKET_HASH ||
            categories.includes(SUBCLASS_CATEGORY_HASH);
        if (typeof inventory?.tierType === 'number') entry.isExotic = inventory.tierType === 6;
        const plugCategory = plugCategoryOf(definition, typeName);
        if (plugCategory) entry.plugCategory = plugCategory;
    } else if (table === 'class') {
        entry.typeName = 'Class';
    } else if (table === 'stat') {
        entry.typeName = 'Stat';
    }

    return entry;
}

function orderedDefinitions(source: unknown): Array<[string, unknown]> {
    return Object.entries(asTable(source)).sort(([leftHash, left], [rightHash, right]) => {
        const leftIndex = asRecord(left)?.index;
        const rightIndex = asRecord(right)?.index;
        const leftOrder = typeof leftIndex === 'number' ? leftIndex : Number.MAX_SAFE_INTEGER;
        const rightOrder = typeof rightIndex === 'number' ? rightIndex : Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || Number(leftHash) - Number(rightHash);
    });
}

export function buildManifestEntries(
    itemDefinitions: unknown,
    classDefinitions: unknown,
    statDefinitions: unknown,
    onProgress?: ProgressCallback,
    itemCategoryDefinitions?: unknown,
): ManifestEntry[] {
    const tables: Array<[TableName, unknown]> = [
        ['item', itemDefinitions],
        ['class', classDefinitions],
        ['stat', statDefinitions],
        ['itemCategory', itemCategoryDefinitions],
    ];
    const ordered = tables.map(([table, source]) => [table, orderedDefinitions(source)] as const);
    const total = ordered.reduce((sum, [, definitions]) => sum + definitions.length, 0);
    const entries: ManifestEntry[] = [];
    let processed = 0;

    for (const [table, definitions] of ordered) {
        for (const [hash, rawDefinition] of definitions) {
            const entry = makeEntry(hash, rawDefinition, table);
            if (entry) entries.push(entry);
            processed += 1;
            if (onProgress && (processed % 2500 === 0 || processed === total)) {
                onProgress(processed, total, table);
            }
        }
    }

    return entries;
}

export function abilityKindOf(
    entry: ManifestEntry,
): 'grenade' | 'melee' | 'class' | 'super' | undefined {
    return entry.table === 'item' && entry.plugCategory
        ? abilityKindFromCategory(entry.plugCategory)
        : undefined;
}
