import { describe, expect, it } from 'vitest';
import { issuesVisible } from './draftValidation';

describe('draft validation visibility', () => {
    it('shows everything outside drafts', () => {
        expect(issuesVisible(null, 'Hash')).toBe(true);
    });
    it('hides untouched fields until they blur or an add is attempted', () => {
        const touched = new Set(['Name']);
        expect(issuesVisible({ attempted: false, touched }, 'Name')).toBe(true);
        expect(issuesVisible({ attempted: false, touched }, 'Hash')).toBe(false);
        expect(issuesVisible({ attempted: true, touched }, 'Hash')).toBe(true);
    });
});
