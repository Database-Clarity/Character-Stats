import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContextPanel } from './ContextPanel';
import { QuickJump } from './QuickJump';
import { tooltipAbilityContext, previewCollections } from './previewData';
import { identityLabel, collectionFilter, manifestStateMessage } from './manifestHelpers';
import { type StatSource, collectionItems, isAbilityRole, isRecord } from '../../core';
import { type ManifestEntry } from '../manifest';

const ability = { Hash: 1, Name: 'Firebolt', BaseCooldown: 64, ChunkEnergyScalar: 1 };
const override = { Hash: 2, Name: 'Override', Requirements: [0], CooldownOverride: 152 };
const source: StatSource = {
    Hash: 1735777505,
    Name: 'Grenade',
    Fields: { CooldownScalars: { Values: Array(101).fill(1) } },
    Abilities: [ability],
    Overrides: [override],
};
vi.mock('../state/store', () => ({
    useEditor: () => ({
        values: {
            'sources/stats/grenade.json': {
                Name: 'Grenade',
                Abilities: [null, 7, 'bad', {}, { Hash: 1, Name: 'Editable' }],
            },
        },
    }),
}));

describe('audit editor regressions', () => {
    it('previews the base ability without stacking overrides', () => {
        expect(tooltipAbilityContext(source, ability, 100).Cooldown).toBe(64);
    });
    it.each([
        null,
        5,
        {},
        { ...override, Requirements: 'bad' },
        { ...override, Requirements: [null] },
    ])('keeps malformed overrides renderable: %j', (selected) => {
        expect(() =>
            renderToStaticMarkup(
                createElement(ContextPanel, {
                    source,
                    collection: 'Overrides',
                    selected: isRecord(selected) ? selected : undefined,
                }),
            ),
        ).not.toThrow();
    });
    it('ignores malformed array items in quick jump', () => {
        expect(
            renderToStaticMarkup(createElement(QuickJump, { onClose: () => {}, onGo: () => {} })),
        ).toContain('Editable');
    });
    it('uses roles even if collection names change', () => {
        expect(
            collectionItems(
                { Custom: [ability, null] },
                { Custom: { name: 'Custom', role: 'ability', fields: [] } },
                (entity) => isAbilityRole(entity.role),
            ),
        ).toEqual([ability]);
        expect(
            previewCollections({ ...source, Overrides: [{ ...override, Requirements: 'bad' }] })
                .overrides,
        ).toEqual([]);
    });
    it('reserves wildcard/subclass labels for requirement references', () => {
        expect(identityLabel(0)).toBe('Unset (0)');
        expect(identityLabel(0, undefined, true)).toBe('All abilities (wildcard)');
        expect(identityLabel(-12, 'Arc')).toBe('Unknown hash');
        expect(identityLabel(-12, 'Arc', true)).toBe('Subclass: Arc');
    });
    it('suggests real grenade abilities rather than grenade launchers', () => {
        const entry: ManifestEntry = {
            hash: 1,
            name: 'Test',
            table: 'item',
            plugCategory: 'Grenade Launcher',
        };
        expect(collectionFilter('Grenade', 'Abilities')(entry)).toBe(false);
        expect(
            collectionFilter('Grenade', 'Abilities')({ ...entry, plugCategory: 'Arc Grenade' }),
        ).toBe(true);
        expect(collectionFilter('Grenade', 'Overrides')({ ...entry, table: 'stat' })).toBe(true);
    });
    it('shows the disabled reason rather than suggesting retry', () => {
        expect(manifestStateMessage({ state: 'disabled', reason: 'No API key' })).toContain(
            'No API key',
        );
        expect(manifestStateMessage({ state: 'disabled', reason: 'No API key' })).not.toContain(
            'retry',
        );
    });
});
