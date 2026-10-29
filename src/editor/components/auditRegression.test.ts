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
    it('uses a manifest ability name for tooltip context and leaves it unavailable otherwise', () => {
        expect(tooltipAbilityContext(source, ability, 100, 'Manifest Firebolt')).toMatchObject({
            AbilityName: 'Manifest Firebolt',
            Cooldown: 64,
        });
        expect(tooltipAbilityContext(source, ability, 100)).not.toHaveProperty('AbilityName');
        expect(tooltipAbilityContext(source, undefined, 100, 'Unused')).toEqual({});
    });
    it('renders fixed Super cooldowns without a stat control', () => {
        const superAbility = {
            Hash: 7,
            Name: 'Nova Bomb',
            BaseCooldown: 600,
            ActiveRegenScalar: 1,
        };
        const fixed: StatSource = {
            Hash: 1,
            Name: 'Super',
            Fields: {},
            SuperAbilities: [superAbility],
        };
        for (const statValue of [0, 59, 100, 200])
            expect(tooltipAbilityContext(fixed, superAbility, statValue).Cooldown).toBe(600);
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source: fixed,
                collection: 'SuperAbilities',
                selected: superAbility,
            }),
        );
        expect(html).toContain('600 s');
        expect(html).toContain('Base cooldown');
        expect(html).not.toContain('Context stat value');
        expect(html).not.toContain('No cooldown context');
    });
    it('labels an unscaled ability value as its base cooldown', () => {
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source,
                collection: 'Abilities',
                selected: ability,
            }),
        );
        expect(html).toContain('Base cooldown');
        expect(html).not.toContain('Base cooldown at');
    });
    it('shows group members per applicable override without a duplicate aggregate table', () => {
        const second = { ...ability, Hash: 3, Name: 'Flashpoint' };
        const groupedSource: StatSource = {
            ...source,
            Abilities: [ability, second],
            Overrides: [override],
        };
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source: groupedSource,
                collection: 'Abilities',
                selected: undefined,
                groupMembers: [ability, second],
            }),
        );
        const table =
            html.split('class="context-group-overrides-table"')[1]?.split('</table>')[0] ?? '';
        expect(table.match(/<tr>/g)).toHaveLength(2);
        expect(table).toContain('Firebolt');
        expect(table).toContain('Flashpoint');
        expect(table).toContain('64 → 152');
        expect(table).toContain('<th>Before <span class="mono">→</span> after</th>');
        expect(html).not.toContain('context-group-results');
        expect(html).toContain('class="member-detail-icon"');
        expect(html).not.toContain('member-detail-icon-card');
        expect(html).toContain('<summary>Applicable overrides</summary>');
        expect(html).not.toContain('<summary>Affected abilities</summary>');
    });
    it('identifies affected group members when an override matches only one entry', () => {
        const second = { ...ability, Hash: 3, Name: 'Flashpoint' };
        const groupedSource: StatSource = {
            ...source,
            Abilities: [ability, second],
            Overrides: [{ ...override, Requirements: [ability.Hash] }],
        };
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source: groupedSource,
                collection: 'Abilities',
                selected: undefined,
                groupMembers: [ability, second],
            }),
        );
        const table =
            html.split('class="context-group-overrides-table"')[1]?.split('</table>')[0] ?? '';
        expect(table.match(/<tr>/g)).toHaveLength(2);
        expect(table).toContain('Firebolt');
        expect(table).not.toContain('Flashpoint');
        expect(table).toContain('64 → 152');
        expect(html).toContain('class="member-detail-icon"');
        expect(html).toContain('context-body-with-group');
        expect(html).toContain('context-group-overrides-collapse');
    });
    it('keeps grouped override icons in a multi-column grid without dropping members', () => {
        const members = Array.from({ length: 4 }, (_, index) => ({
            ...ability,
            Hash: index + 1,
            Name: `Ability ${index + 1}`,
        }));
        const groupedSource: StatSource = { ...source, Abilities: members, Overrides: [override] };
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source: groupedSource,
                collection: 'Abilities',
                selected: undefined,
                groupMembers: members,
            }),
        );
        const table =
            html.split('class="context-group-overrides-table"')[1]?.split('</table>')[0] ?? '';
        expect(table).toContain('data-min-columns="3"');
        expect(table.match(/class="member-detail-icon"/g)).toHaveLength(4);
    });
    it('populates group context for SuperAbilities without adding a stat control', () => {
        const first = {
            Hash: 7,
            Name: 'Nova Bomb',
            BaseCooldown: 600,
            ActiveRegenScalar: 1,
        };
        const second = { ...first, Hash: 8, Name: 'Ward of Dawn' };
        const superSource: StatSource = {
            Hash: 1,
            Name: 'Super',
            Fields: {},
            SuperAbilities: [first, second],
            Overrides: [override],
        };
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source: superSource,
                collection: 'SuperAbilities',
                selected: undefined,
                groupMembers: [first, second],
            }),
        );
        expect(html).not.toContain('Group cooldowns');
        expect(html).toContain('Show details for Nova Bomb (hash 7)');
        expect(html).toContain('Show details for Ward of Dawn (hash 8)');
        expect(html).toContain('600 → 152');
        expect(html).toContain('<summary>Applicable overrides</summary>');
        expect(html).not.toContain('Context stat value');
        expect(html).not.toContain('<summary>Affected abilities</summary>');
    });
    it('shows the empty context prompt without stale group results after deselection', () => {
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source,
                collection: 'Abilities',
                selected: undefined,
            }),
        );
        expect(html).toContain(
            'Select an ability, cooldown group, or override to inspect its effects.',
        );
        expect(html).not.toContain('Group cooldowns');
        expect(html).not.toContain('<summary>Affected abilities</summary>');
    });
    it('uses the shared member-detail icon for abilities affected by a selected override', () => {
        const html = renderToStaticMarkup(
            createElement(ContextPanel, {
                source,
                collection: 'Overrides',
                selected: override,
            }),
        );
        expect(html).toContain('class="member-detail-icon"');
        expect(html).toContain('Show details for Firebolt (hash 1)');
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
