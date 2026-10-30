import { describe, expect, it } from 'vitest';
import { fieldLabel, fieldPathLabels, issueLocationLabel } from './locationLabels';

const sources = {
    stats: [
        { Name: 'Health', Fields: {} },
        {
            Name: 'Melee',
            Fields: { CooldownScalars: { Values: [] } },
            Abilities: [{ Hash: 11, Name: 'Flux Fist' }, { Hash: 22 }],
        },
    ],
    movement: { Rules: {}, Sources: [{ Hash: 7, Name: 'Machine Gun' }] },
};

describe('issueLocationLabel', () => {
    it.each([
        ['stats[1].Abilities[0].BaseCooldown', 'Melee › Abilities › Flux Fist › Base cooldown (s)'],
        ['stats[1].Abilities[0].Name', 'Melee › Abilities › Flux Fist › Name'],
        ['stats[1].Abilities[1].Name', 'Melee › Abilities › 22 › Name'],
        ['stats[1].Abilities[9].Name', 'Melee › Abilities'],
        [
            'stats[1].Fields.CooldownScalars.Segments[1].Expression',
            'Melee › Cooldown scalar › Segments 2 › Expression',
        ],
        ['movement.Rules.WalkSpeed', 'Movement › Rules › Walk speed (m/s)'],
        [
            'movement.Sources[0].Effects[1].Type',
            'Movement › Sources › Machine Gun › Effects 2 › Effect type',
        ],
        ['locale.Melee.BaseStatTooltip', 'Melee › Text › Base stat tooltip'],
        ['locale.ChargeBasedScaling', 'Melee › Text › Charge based scaling'],
    ])('describes %s', (path, label) => {
        expect(issueLocationLabel(path, sources)).toBe(label);
    });

    it('keeps the raw path when there is no editor location', () => {
        expect(issueLocationLabel('$', sources)).toBe('$');
        expect(issueLocationLabel('stats[5].Name', sources)).toBe('stats[5].Name');
    });
});

describe('field labels', () => {
    it('uses registry labels, readable fallbacks and 1-based rows', () => {
        expect(fieldPathLabels(undefined, 'CooldownScalars.Segments.1.Expression')).toEqual([
            'Cooldown scalars',
            'Segments 2',
            'Expression',
        ]);
        expect(fieldLabel({ stat: 'Melee', tab: 'Abilities', field: 'BaseCooldown' })).toBe(
            'Base cooldown (s)',
        );
        expect(fieldLabel({ stat: 'Melee', tab: 'Fields', field: '' })).toBe('');
    });
});
