import { describe, expect, it } from 'vitest';
import { isPrismaticAbility } from './prismatic';
import type { ManifestEntry } from './types';

const entry = (typeName: string): ManifestEntry => ({
    hash: 1,
    name: 'Ability',
    table: 'item',
    typeName,
});
describe('isPrismaticAbility', () => {
    it('recognizes light and darkness manifest type names', () => {
        expect(isPrismaticAbility(entry('Arc Grenade | Light Ability'))).toBe(true);
        expect(isPrismaticAbility(entry('Stasis Melee | Darkness Ability'))).toBe(true);
    });
    it('never infers prismatic from source names or ordinary types', () => {
        expect(isPrismaticAbility({ ...entry('Arc Grenade'), name: 'Grenade (Prismatic)' })).toBe(
            false,
        );
        expect(isPrismaticAbility(entry('Light Ability'))).toBe(false);
        expect(isPrismaticAbility({ ...entry('Arc Grenade | Light Ability'), table: 'stat' })).toBe(
            false,
        );
        expect(isPrismaticAbility(undefined)).toBe(false);
    });
});
