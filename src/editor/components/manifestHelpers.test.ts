import { describe, expect, it } from 'vitest';
import { abilitySpec, overrideSpec, type EntitySpec } from '../../core';
import { filterPickerGroups, pickedEntry } from './manifestHelpers';

describe('pickedEntry', () => {
    const entry = { hash: 123, name: 'Marksman' };

    it('sets the hash and fills a blank Name', () => {
        expect(pickedEntry(abilitySpec, { Hash: 0, Name: '' }, 'Hash', entry)).toEqual({
            Hash: 123,
            Name: 'Marksman',
        });
        expect(pickedEntry(abilitySpec, { Hash: 0, Name: '  ' }, 'Hash', entry).Name).toBe(
            'Marksman',
        );
        expect(pickedEntry(abilitySpec, { Hash: 0 }, 'Hash', entry).Name).toBe('Marksman');
    });

    it('keeps an existing Name and does not mutate the input', () => {
        const value = { Hash: 0, Name: 'Custom' };
        expect(pickedEntry(abilitySpec, value, 'Hash', entry)).toEqual({
            Hash: 123,
            Name: 'Custom',
        });
        expect(value).toEqual({ Hash: 0, Name: 'Custom' });
    });

    it('leaves Name alone for entities that have no Name field', () => {
        const noName: EntitySpec = {
            ...overrideSpec,
            fields: overrideSpec.fields.filter((field) => field.key !== 'Name'),
        };
        expect('Name' in pickedEntry(noName, { Hash: 0 }, 'Hash', entry)).toBe(false);
    });
});

describe('filterPickerGroups', () => {
    const groups = [
        {
            title: 'A',
            items: [
                { hash: 1, name: 'Healing Grenade' },
                { hash: 22, name: 'Bolt' },
            ],
        },
        { title: 'B', items: [{ hash: 3, name: 'Heal Rift' }] },
        { title: 'C', items: [] },
    ];

    it('returns every group for a blank query', () => {
        expect(filterPickerGroups(groups, '  ')).toEqual(groups);
    });

    it('matches names case-insensitively and drops emptied groups', () => {
        expect(filterPickerGroups(groups, 'HEAL')).toEqual([
            { title: 'A', items: [{ hash: 1, name: 'Healing Grenade' }] },
            { title: 'B', items: [{ hash: 3, name: 'Heal Rift' }] },
        ]);
    });

    it('matches hashes and trims the query', () => {
        expect(filterPickerGroups(groups, ' 22 ')).toEqual([
            { title: 'A', items: [{ hash: 22, name: 'Bolt' }] },
        ]);
        expect(filterPickerGroups(groups, 'nothing')).toEqual([]);
    });
});
