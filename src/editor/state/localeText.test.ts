import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { movementSpec, resolveLocale, type LocaleData } from '../../core';
import type { DataSource } from '../data';
import { createEditorState, deriveEditorState, editorReducer } from './store';
import { entryLocaleTextIds, localeEntryLabel, updateLocaleText } from './localeText';

const files = Object.fromEntries(
    [
        'sources/movement.json',
        'locale/en.json',
        ...readdirSync('sources/stats')
            .filter((name) => name.endsWith('.json'))
            .map((name) => `sources/stats/${name}`),
    ].map((path) => [path, readFileSync(path, 'utf8')]),
);
const source: DataSource = {
    label: 'Test data',
    readOnly: true,
    async load() {
        return { files, head: 'original' };
    },
};
const initial = () => createEditorState({ source, loaded: { files, head: 'original' } });

describe('entry-associated locale text', () => {
    it('updates the shared locale tree and persists it as a dirty locale file', () => {
        const state = initial(),
            locale = state.values['locale/en.json'] as LocaleData,
            id = 'Movement.Classes.671679327.Description',
            updated = updateLocaleText(locale, id, 'Edited from the entry tab');
        expect(resolveLocale(locale, id)).not.toBe('Edited from the entry tab');
        const changed = editorReducer(state, {
            type: 'set',
            file: 'locale/en.json',
            value: updated,
        });
        expect(deriveEditorState(changed).dirty).toContain('locale/en.json');
        expect(deriveEditorState(changed).serialized['locale/en.json']).toContain(
            'Edited from the entry tab',
        );
    });

    it('lists only hash-associated entry text and leaves unrelated text labels unchanged', () => {
        const locale = {
            Movement: {
                Classes: {
                    '671679327': { Description: 'Hunter text' },
                },
                Overview: 'General text',
            },
        };
        const entitySpec = movementSpec.collections.Classes!;
        expect(
            entryLocaleTextIds(locale, 'Movement', 'Classes', entitySpec, { ClassHash: 671679327 }),
        ).toEqual(['Movement.Classes.671679327.Description']);
        expect(
            entryLocaleTextIds(locale, 'Movement', 'Classes', entitySpec, { Name: 'Hunter' }),
        ).toEqual([]);
        expect(
            entryLocaleTextIds(
                {
                    Movement: {
                        Sources: {
                            '12': { Description: 'Source text' },
                        },
                    },
                },
                'Movement',
                'Sources',
                movementSpec.collections.Sources!,
                { Hash: 12 },
            ),
        ).toEqual(['Movement.Sources.12.Description']);
        expect(
            localeEntryLabel(
                'Movement.Classes.671679327.Description',
                'Movement',
                movementSpec.collections,
                { Classes: [{ ClassHash: 671679327, Name: 'Hunter' }] },
            ),
        ).toBe('Classes / Hunter (671679327) / Description');
        expect(
            localeEntryLabel(
                'Movement.Sources.12.Description',
                'Movement',
                movementSpec.collections,
                { Sources: [{ Hash: 12, Name: 'Machine Gun' }] },
            ),
        ).toBe('Sources / Machine Gun (12) / Description');
        expect(
            localeEntryLabel('Movement.Overview', 'Movement', movementSpec.collections, {}),
        ).toBe('Movement.Overview');
    });
});
