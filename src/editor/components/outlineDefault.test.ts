import { describe, expect, it } from 'vitest';
import { initialOutlineOpen, outlineDefaultOpen } from './outlineDefault';

describe('outline default open state', () => {
    it.each([
        { width: 1100, entries: 3, open: false },
        { width: 1100, entries: 20, open: false },
        { width: 1280, entries: 6, open: false },
        { width: 1280, entries: 7, open: true },
        { width: 1365, entries: 6, open: false },
        { width: 1366, entries: 6, open: true },
        { width: 1920, entries: 2, open: true },
    ])('width $width with $entries entries opens: $open', ({ width, entries, open }) => {
        expect(outlineDefaultOpen(width, entries)).toBe(open);
    });
});

describe('initial outline open state', () => {
    it.each([
        { width: 1280, entries: 3, choice: undefined, open: false },
        { width: 1280, entries: 3, choice: true, open: true },
        { width: 1280, entries: 20, choice: false, open: false },
        { width: 1100, entries: 20, choice: true, open: false },
        { width: 1100, entries: 20, choice: undefined, open: false },
        { width: 1101, entries: 3, choice: true, open: true },
        { width: 1920, entries: 2, choice: false, open: false },
        { width: 1920, entries: 2, choice: true, open: true },
        { width: 1920, entries: 2, choice: undefined, open: true },
    ])(
        'width $width with $entries entries and choice $choice opens: $open',
        ({ width, entries, choice, open }) => {
            expect(initialOutlineOpen(width, entries, choice)).toBe(open);
        },
    );
});
