import { describe, expect, it } from 'vitest';
import { abilityKindOf, buildManifestEntries } from './build';
import { createManifestSearchIndex, lookupManifestEntry, searchManifestEntries } from './search';

const itemDefinitions = {
    '101': {
        index: 10,
        displayProperties: {
            name: 'Arcbolt Grenade',
            icon: '/icons/arc.png',
            description: 'A grenade.',
        },
        itemType: 19,
        itemTypeDisplayName: 'Arc Grenade',
        itemCategoryHashes: [59],
        classType: 3,
        inventory: { tierType: 6, tierTypeName: 'Exotic' },
    },
    '102': {
        index: 2,
        displayProperties: {
            name: 'Arcbolt Grenade',
            icon: '/icons/arc.png',
            description: 'Duplicate copy.',
        },
        itemType: 19,
        itemTypeDisplayName: 'Arc Grenade',
        itemCategoryHashes: [59],
        classType: 3,
        inventory: { tierType: 6 },
    },
    '103': {
        index: 1,
        displayProperties: { name: 'Stasis Arcbolt Grenade', icon: '/icons/stasis.png' },
        itemType: 19,
        itemTypeDisplayName: 'Stasis Grenade',
        classType: 3,
        inventory: { tierType: 5 },
    },
    '104': {
        index: 4,
        displayProperties: { name: 'Arc subclass', icon: '/icons/subclass.png' },
        itemType: 16,
        itemTypeDisplayName: 'Hunter Subclass',
        itemCategoryHashes: [50, 52],
        classType: 1,
        inventory: { bucketTypeHash: 3284755031, tierType: 5 },
    },
    '105': { displayProperties: { name: '   ', icon: '/icons/blank.png' } },
    '106': { redacted: true, displayProperties: { name: 'Classified', icon: '/icons/hidden.png' } },
};

const classDefinitions = {
    '301': {
        index: 0,
        classType: 0,
        displayProperties: { name: 'Titan', icon: '/icons/titan.png' },
    },
};
const statDefinitions = {
    '401': { index: 0, displayProperties: { name: 'Melee', icon: '/icons/melee.png' } },
};

describe('manifest definition transformation', () => {
    it('builds compact entries from Lite, class, and stat definitions', () => {
        const entries = buildManifestEntries(itemDefinitions, classDefinitions, statDefinitions);
        expect(entries).toHaveLength(6);
        expect(entries.find((entry) => entry.hash === 102)).toMatchObject({
            hash: 102,
            name: 'Arcbolt Grenade',
            icon: 'https://www.bungie.net/icons/arc.png',
            description: 'Duplicate copy.',
            typeName: 'Arc Grenade',
            table: 'item',
            classType: 3,
            plugCategory: 'Arc Grenade',
            isSubclass: false,
            isExotic: true,
        });
        expect(entries.find((entry) => entry.hash === 104)?.isSubclass).toBe(true);
        expect(entries.find((entry) => entry.hash === 301)).toMatchObject({
            name: 'Titan',
            typeName: 'Class',
            table: 'class',
            classType: 0,
        });
        expect(entries.find((entry) => entry.hash === 401)).toMatchObject({
            name: 'Melee',
            typeName: 'Stat',
            table: 'stat',
        });
        expect(abilityKindOf(entries.find((entry) => entry.hash === 102)!)).toBe('grenade');
    });

    it('ranks prefix and word matches before substring matches and deduplicates by index order', () => {
        const entries = buildManifestEntries(itemDefinitions, classDefinitions, statDefinitions);
        const index = createManifestSearchIndex(entries);
        const results = searchManifestEntries(index, 'ARCbolt', {
            filter: (entry) => entry.table === 'item',
            limit: 10,
        });
        expect(results.map((entry) => entry.hash)).toEqual([102, 103]);
        expect(
            searchManifestEntries(index, 'Arcbolt', { filter: (entry) => entry.table === 'stat' }),
        ).toEqual([]);
    });

    it('includes item categories and supports table-scoped hash lookup', () => {
        const categoryDefinitions = {
            '301': { index: 0, displayProperties: { name: 'Armor' } },
            '501': { index: 1, displayProperties: { name: 'Weapons' } },
        };
        const progress: Array<[number, number, string]> = [];
        const entries = buildManifestEntries(
            itemDefinitions,
            classDefinitions,
            statDefinitions,
            (processed, total, table) => progress.push([processed, total, table]),
            categoryDefinitions,
        );
        expect(progress[progress.length - 1]).toEqual([10, 10, 'itemCategory']);
        const index = createManifestSearchIndex(entries);

        expect(
            entries.find((entry) => entry.hash === 301 && entry.table === 'itemCategory'),
        ).toEqual({
            hash: 301,
            name: 'Armor',
            table: 'itemCategory',
        });
        expect(lookupManifestEntry(index, 301)?.name).toBe('Titan');
        expect(lookupManifestEntry(index, 301, 'itemCategory')?.name).toBe('Armor');
        expect(searchManifestEntries(index, 'Weapons').map((entry) => entry.table)).toEqual([
            'itemCategory',
        ]);
    });

    it('looks up hashes in constant time and rejects negative hashes', () => {
        const index = createManifestSearchIndex(
            buildManifestEntries(itemDefinitions, classDefinitions, statDefinitions),
        );
        expect(lookupManifestEntry(index, 301)?.name).toBe('Titan');
        expect(searchManifestEntries(index, '301').map((entry) => entry.name)).toEqual(['Titan']);
        expect(lookupManifestEntry(index, -301)).toBeUndefined();
    });
});
