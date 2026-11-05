import { describe, expect, it } from 'vitest';
import { abilitySpec, overrideSpec, type EntitySpec } from '../../core';
import { duplicateNameNotes, filterPickerGroups, pickedEntry } from './manifestHelpers';

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

describe('duplicateNameNotes', () => {
    it('labels each repeated name with its class when every class is distinct', () => {
        const notes = duplicateNameNotes([
            { hash: 1, name: 'Unfocused Arc Energy', classType: 0 },
            { hash: 2, name: 'Unfocused Arc Energy', classType: 1 },
            { hash: 3, name: 'Unfocused Arc Energy', classType: 2 },
        ]);
        expect(Object.fromEntries(notes)).toEqual({ 1: 'Titan', 2: 'Hunter', 3: 'Warlock' });
    });

    it('falls back to the hash on every member when no class is usable', () => {
        const notes = duplicateNameNotes([
            { hash: 1, name: 'Unfocused Arc Energy', classType: 3 },
            { hash: 2, name: 'Unfocused Arc Energy' },
            { hash: 3, name: 'Unfocused Arc Energy', classType: 3 },
        ]);
        expect(Object.fromEntries(notes)).toEqual({ 1: '1', 2: '2', 3: '3' });
    });

    it('falls back to the hash when one member has no usable class', () => {
        const notes = duplicateNameNotes([
            { hash: 5, name: 'Striker', classType: 0 },
            { hash: 6, name: 'Striker', classType: 3 },
        ]);
        expect(Object.fromEntries(notes)).toEqual({ 5: '5', 6: '6' });
    });

    it('falls back to the hash when two members share a class', () => {
        const notes = duplicateNameNotes([
            { hash: 5, name: 'Striker', classType: 0 },
            { hash: 6, name: 'Striker', classType: 0 },
        ]);
        expect(Object.fromEntries(notes)).toEqual({ 5: '5', 6: '6' });
    });

    it('leaves unique names alone', () => {
        const notes = duplicateNameNotes([
            { hash: 4, name: 'Arcstrider', classType: 1 },
            { hash: 5, name: 'Striker', classType: 0 },
            { hash: 6, name: 'Striker', classType: 3 },
        ]);
        expect(Object.fromEntries(notes)).toEqual({ 5: '5', 6: '6' });
    });

    it('returns no notes for an empty list', () => {
        expect(Object.fromEntries(duplicateNameNotes([]))).toEqual({});
    });
});
