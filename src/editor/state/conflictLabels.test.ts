import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conflictLabel, summarizeValue } from './locationLabels';
import type { MergeConflict } from './merge';

const grenade = JSON.parse(
    readFileSync(new URL('../../../sources/stats/grenade.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const abilities = grenade.Abilities as { Hash: number; Name: string }[];
const FLUX_HASH = 4198689901;
const flux = abilities.find((ability) => ability.Hash === FLUX_HASH);
const fluxId = String(FLUX_HASH);

const conflictAt = (
    file: string,
    path: MergeConflict['path'],
    ours: unknown = undefined,
    theirs: unknown = undefined,
): MergeConflict => ({ id: `${file}#test`, file, path, base: undefined, ours, theirs });

describe('conflictLabel', () => {
    const sources = { stats: [grenade], movement: {} };

    it('labels an ability field with the ability name and registry label', () => {
        expect(flux?.Name).toBe('Flux Grenade');
        const conflict = conflictAt(
            'sources/stats/grenade.json',
            ['Abilities', { id: fluxId, key: 'Hash' }, 'BaseCooldown'],
            105.4,
            110,
        );
        expect(conflictLabel(conflict, sources, grenade)).toBe(
            'Grenade › Abilities › Flux Grenade › Base cooldown (s)',
        );
    });

    it('names a removed entity from the conflict value', () => {
        const withoutFlux = {
            ...grenade,
            Abilities: abilities.filter((ability) => ability.Hash !== FLUX_HASH),
        };
        const conflict = conflictAt(
            'sources/stats/grenade.json',
            ['Abilities', { id: fluxId, key: 'Hash' }],
            undefined,
            flux,
        );
        const label = conflictLabel(conflict, { stats: [withoutFlux], movement: {} }, withoutFlux);
        expect(label).toBe('Grenade › Abilities › Flux Grenade');
        expect(label.endsWith(String(flux?.Name))).toBe(true);
    });

    it('labels a locale entry under the stat Text tab', () => {
        const conflict = conflictAt('locale/en.json', ['Grenade', 'Overview'], 'ours', 'theirs');
        expect(conflictLabel(conflict, sources, undefined)).toMatch(/^Grenade › Text/);
    });

    it('labels a top-level stat field with its registry label', () => {
        const conflict = conflictAt(
            'sources/stats/grenade.json',
            ['Fields', 'EnergyGainScalar'],
            1,
            2,
        );
        expect(conflictLabel(conflict, sources, grenade)).toBe('Grenade › Energy gain scalar');
    });

    it('falls back to the file path when the file value is not a record', () => {
        const conflict = conflictAt('sources/unknown.json', ['Name'], 'a', 'b');
        expect(conflictLabel(conflict, sources, 'not a record')).toBe('sources/unknown.json');
        expect(conflictLabel(conflict, sources, 42)).toBe('sources/unknown.json');
    });
});

describe('summarizeValue', () => {
    it('shows removed entries', () => {
        expect(summarizeValue(undefined)).toBe('(removed)');
    });

    it('formats numbers and strings as JSON', () => {
        expect(summarizeValue(5)).toBe('5');
        expect(summarizeValue('hi')).toBe('"hi"');
    });

    it('compacts objects to one line of JSON', () => {
        expect(summarizeValue({ Name: 'Flux Grenade', BaseCooldown: 105.4 })).toBe(
            '{"Name":"Flux Grenade","BaseCooldown":105.4}',
        );
    });

    it('truncates to 80 characters ending in an ellipsis', () => {
        const text = summarizeValue('x'.repeat(200));
        expect(text).toHaveLength(80);
        expect(text.endsWith('…')).toBe(true);
        expect(text).toBe(`"${'x'.repeat(78)}…`);
    });

    it('keeps text that is exactly 80 characters as it is', () => {
        expect(summarizeValue('x'.repeat(78))).toBe(`"${'x'.repeat(78)}"`);
    });

    it('respects a custom maximum length', () => {
        expect(summarizeValue('abcdefghij', 6)).toBe('"abcd…');
    });
});
