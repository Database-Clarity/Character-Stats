import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { abilitySpec, superAbilitySpec } from '../../core';
import { AbilityGroupEditor } from './AbilityGroupEditor';
import { formatMemberDetailValue, memberClickAction, memberDetailValues } from './MemberDetailIcon';

describe('cooldown group member details', () => {
    it('keeps ordinary and Ctrl clicks on tooltips and defers double-click navigation', () => {
        const click = { detail: 1, ctrlKey: false, shiftKey: false };
        expect(memberClickAction(click)).toBe('tooltip');
        expect(memberClickAction({ ...click, detail: 2 })).toBe('defer');
        expect(memberClickAction({ ...click, ctrlKey: true })).toBe('tooltip');
        expect(memberClickAction({ ...click, shiftKey: true })).toBe('navigate');
    });

    it('lists each ability and resolves manifest names with source-name fallback', () => {
        const members = [
            { Hash: 1, Name: 'Firebolt', BaseCooldown: 64, ChunkEnergyScalar: 1 },
            { Hash: 2, Name: 'Source name', BaseCooldown: 64, ChunkEnergyScalar: 0.8 },
        ];
        const html = renderToStaticMarkup(
            createElement(AbilityGroupEditor, {
                spec: abilitySpec,
                items: members,
                members,
                memberIds: ['1', '2'],
                idKey: 'Hash',
                collection: 'Abilities',
                file: 'sources/stats/grenade.json',
                savedById: new Map(),
                getManifestName: (hash) => (hash === 2 ? 'Manifest name' : undefined),
                hasContext: false,
                contextOpen: false,
                onToggleContext: () => {},
                onBack: () => {},
                onOpenMember: () => {},
                onChange: () => {},
            }),
        );
        expect(html.match(/class="member-detail-icon member-detail-icon-card"/g)).toHaveLength(2);
        expect(html.match(/class="member-detail-card-name"/g)).toHaveLength(2);
        expect(html.match(/class="member-detail-card-hash mono"/g)).toHaveLength(2);
        expect(html).toContain('Show details for Firebolt (hash 1)');
        expect(html).toContain('Show details for Manifest name (hash 2)');
        expect(html).not.toContain('identity-text');
        expect(html.indexOf('Base cooldown')).toBeLessThan(
            html.indexOf('class="cooldown-group-members"'),
        );
    });

    it('includes each schema-defined relevant value and marks optional values as absent', () => {
        const ability = memberDetailValues(abilitySpec, {
            Hash: 1,
            Name: 'Firebolt',
            BaseCooldown: 64,
            ChunkEnergyScalar: 1,
        });
        expect(ability.filter(({ field }) => field).map(({ field }) => field?.key)).toEqual(
            abilitySpec.fields
                .map(({ key }) => key)
                .filter((key) => key !== 'Hash' && key !== 'Name'),
        );
        const optional = ability.find(({ field }) => field?.key === 'ChargeBasedScaling');
        expect(formatMemberDetailValue(optional?.value, optional?.field)).toBe(
            'Not set (optional)',
        );

        const superAbility = memberDetailValues(superAbilitySpec, {
            Hash: 3,
            Name: 'Nova Bomb',
            BaseCooldown: 600,
            ActiveRegenScalar: 1.25,
        });
        expect(superAbility.filter(({ field }) => field).map(({ field }) => field?.key)).toEqual(
            superAbilitySpec.fields
                .map(({ key }) => key)
                .filter((key) => key !== 'Hash' && key !== 'Name'),
        );
        expect(superAbility.find(({ field }) => field?.key === 'ActiveRegenScalar')?.value).toBe(
            1.25,
        );
    });

    it('formats structured fields without truncating their current values', () => {
        const chargeValues = [{ Charges: 2, Multiplier: 0.855 }];
        const details = memberDetailValues(abilitySpec, {
            Hash: 1,
            Name: 'Firebolt',
            BaseCooldown: 82.123,
            ChunkEnergyScalar: 0.855,
            ChargeBasedScaling: chargeValues,
        });
        expect(
            formatMemberDetailValue(
                details.find(({ field }) => field?.key === 'ChargeBasedScaling')?.value,
                abilitySpec.fields.find(({ key }) => key === 'ChargeBasedScaling'),
            ),
        ).toContain('"Multiplier": 0.855');
        expect(
            formatMemberDetailValue(
                details.find(({ field }) => field?.key === 'BaseCooldown')?.value,
                abilitySpec.fields.find(({ key }) => key === 'BaseCooldown'),
            ),
        ).toBe('82.123');
    });
});
