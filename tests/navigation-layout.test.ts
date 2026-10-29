import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const forms = await readFile(new URL('../src/editor/styles/forms.css', import.meta.url), 'utf8');
const editorStyles = await readFile(new URL('../src/editor/styles.css', import.meta.url), 'utf8');

describe('field outline layout', () => {
    it('lets the desktop outline grow to fit labels and wraps only when space is limited', () => {
        const pageLayout = forms.match(/\.long-page\s*\{([^}]*)\}/)?.[1] ?? '';
        const buttonStyles = forms.match(/\.outline\s*>\s*button\s*\{([^}]*)\}/)?.[1] ?? '';

        expect(pageLayout).toContain('fit-content(min(32vw, 360px))');
        expect(buttonStyles).toContain('white-space: normal');
        expect(buttonStyles).toContain('overflow-wrap: anywhere');
        expect(buttonStyles).not.toContain('text-overflow: ellipsis');
    });

    it('keeps the outline as a bounded overlay on narrow screens', () => {
        expect(editorStyles).toMatch(
            /@media \(max-width: 1100px\)\s*\{[\s\S]*?\.long-page\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
        );
        expect(editorStyles).toContain('max-width: min(90vw, 360px)');
    });
});
