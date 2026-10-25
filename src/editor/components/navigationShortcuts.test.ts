import { describe, expect, it } from 'vitest';
import {
    consumeWheelNavigation,
    hasExactCtrlAltModifiers,
    nextCollectionSelection,
    normalizeWheelDeltaY,
    resetWheelNavigation,
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
});
