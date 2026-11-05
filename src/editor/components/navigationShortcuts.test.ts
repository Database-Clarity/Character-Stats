import { describe, expect, it } from 'vitest';
import {
    consumeWheelNavigation,
    hasExactCtrlAltModifiers,
    nextCollectionSelection,
    normalizeWheelDeltaY,
    resetWheelNavigation,
    rovingIndex,
    type WheelNavigationState,
} from './navigationShortcuts';

describe('editor navigation shortcuts', () => {
    it('normalizes wheel lines and pages to pixel deltas', () => {
        expect(normalizeWheelDeltaY(2, 0, 300)).toBe(2);
        expect(normalizeWheelDeltaY(2, 1, 300)).toBe(32);
        expect(normalizeWheelDeltaY(-1, 2, 300)).toBe(-300);
    });

    it('accepts only the exact Ctrl+Alt chord outside composition', () => {
        const event = {
            ctrlKey: true,
            altKey: true,
            shiftKey: false,
            metaKey: false,
            getModifierState: () => false,
        };
        expect(hasExactCtrlAltModifiers(event)).toBe(true);
        expect(hasExactCtrlAltModifiers({ ...event, ctrlKey: false })).toBe(false);
        expect(hasExactCtrlAltModifiers({ ...event, shiftKey: true })).toBe(false);
        expect(hasExactCtrlAltModifiers({ ...event, metaKey: true })).toBe(false);
        expect(
            hasExactCtrlAltModifiers({
                ...event,
                getModifierState: (key: string) => key === 'AltGraph',
            }),
        ).toBe(false);
        expect(hasExactCtrlAltModifiers(event, true)).toBe(false);
    });

    it('normalizes, accumulates, throttles, and resets wheel gestures', () => {
        const state: WheelNavigationState = {
            accumulated: 0,
            direction: null,
            lastNavigation: 0,
        };
        expect(consumeWheelNavigation(state, 20, 1000)).toBeUndefined();
        expect(consumeWheelNavigation(state, 20, 1020)).toBe(1);
        expect(consumeWheelNavigation(state, 20, 1100)).toBeUndefined();
        expect(consumeWheelNavigation(state, 20, 1160)).toBe(1);
        expect(consumeWheelNavigation(state, -40, 1200)).toBeUndefined();
        expect(consumeWheelNavigation(state, -40, 1300)).toBe(-1);
        resetWheelNavigation(state);
        expect(state).toEqual({ accumulated: 0, direction: null, lastNavigation: 0 });
    });

    it('navigates visible collection entries without wrapping', () => {
        const filteredKeys = ['draft', 'ability-1', 'ability-3'];
        expect(nextCollectionSelection(filteredKeys, 'ability-1', 1)).toBe('ability-3');
        expect(nextCollectionSelection(filteredKeys, 'ability-3', 1)).toBeUndefined();
        expect(nextCollectionSelection(filteredKeys, 'draft', -1)).toBeUndefined();
        expect(nextCollectionSelection(filteredKeys, null, 1)).toBe('draft');
        expect(nextCollectionSelection(filteredKeys, null, -1)).toBe('ability-3');
        expect(nextCollectionSelection([], null, 1)).toBeUndefined();
    });

    it('navigates the stat order in either direction and stops at both ends', () => {
        const stats = ['Health', 'Melee', 'Grenade', 'Super', 'Class', 'Weapons', 'Movement'];
        expect(nextCollectionSelection(stats, 'Super', -1)).toBe('Grenade');
        expect(nextCollectionSelection(stats, 'Super', 1)).toBe('Class');
        expect(nextCollectionSelection(stats, 'Health', -1)).toBeUndefined();
        expect(nextCollectionSelection(stats, 'Movement', 1)).toBeUndefined();
    });

    describe('rovingIndex', () => {
        it.each([
            { count: 5, current: 1, key: 'ArrowDown', horizontal: false, expected: 2 },
            { count: 5, current: 1, key: 'ArrowUp', horizontal: false, expected: 0 },
            { count: 5, current: 3, key: 'Home', horizontal: false, expected: 0 },
            { count: 5, current: 1, key: 'End', horizontal: false, expected: 4 },
            { count: 5, current: 1, key: 'ArrowRight', horizontal: true, expected: 2 },
            { count: 5, current: 1, key: 'ArrowLeft', horizontal: true, expected: 0 },
            { count: 3, current: -1, key: 'ArrowDown', horizontal: false, expected: 0 },
            { count: 3, current: -1, key: 'ArrowUp', horizontal: false, expected: 2 },
        ])(
            'moves $key from $current in $count items to $expected',
            ({ count, current, key, horizontal, expected }) => {
                expect(rovingIndex(count, current, key, horizontal)).toBe(expected);
            },
        );

        it('clamps at both ends without wrapping', () => {
            expect(rovingIndex(5, 4, 'ArrowDown')).toBeUndefined();
            expect(rovingIndex(5, 0, 'ArrowUp')).toBeUndefined();
            expect(rovingIndex(5, 0, 'Home')).toBeUndefined();
            expect(rovingIndex(5, 4, 'End')).toBeUndefined();
        });

        it('ignores left and right arrows unless the list is horizontal', () => {
            expect(rovingIndex(5, 1, 'ArrowRight')).toBeUndefined();
            expect(rovingIndex(5, 1, 'ArrowLeft')).toBeUndefined();
        });

        it('ignores unrelated keys and empty lists', () => {
            expect(rovingIndex(5, 1, 'a')).toBeUndefined();
            expect(rovingIndex(0, -1, 'ArrowDown')).toBeUndefined();
        });
    });
});
