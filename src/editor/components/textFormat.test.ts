import { describe, expect, it } from 'vitest';
import { collectionLabel, plural, sentenceCase } from './textFormat';

describe('plural', () => {
    it('picks the singular only for exactly one', () => {
        expect(plural(0, 'error')).toBe('0 errors');
        expect(plural(1, 'error')).toBe('1 error');
        expect(plural(2, 'entry', 'entries')).toBe('2 entries');
    });
});

describe('collectionLabel', () => {
    it('splits camel-case collection keys into sentence case', () => {
        expect(collectionLabel('SuperAbilities')).toBe('Super abilities');
        expect(collectionLabel('Abilities')).toBe('Abilities');
    });
});

describe('sentenceCase', () => {
    it('splits identifiers and keeps acronyms', () => {
        expect(sentenceCase('BaseStatTooltip')).toBe('Base stat tooltip');
        expect(sentenceCase('WhileHeld')).toBe('While held');
        expect(sentenceCase('MobilityTiers')).toBe('Mobility tiers');
        expect(sentenceCase('item')).toBe('Item');
        expect(sentenceCase('itemCategory')).toBe('Item category');
        expect(sentenceCase('ADSSpeed')).toBe('ADS speed');
        expect(sentenceCase('PVPHealth')).toBe('PVP health');
    });
});
