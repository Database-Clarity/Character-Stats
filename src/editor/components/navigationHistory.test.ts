import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    NavigationHistoryController,
    NAVIGATION_HISTORY_KEY,
    readNavigationSelection,
    sameNavigationSelection,
    SCROLL_HISTORY_DELAY_MS,
    type EditorNavigationSelection,
} from './navigationHistory';

class MemoryHistory {
    entries: unknown[];
    index = 0;

    constructor(initial: unknown = null) {
        this.entries = [initial];
    }

    get state(): unknown {
        return this.entries[this.index];
    }

    pushState(state: unknown): void {
        this.entries = this.entries.slice(0, this.index + 1);
        this.entries.push(state);
        this.index += 1;
    }

    replaceState(state: unknown): void {
        this.entries[this.index] = state;
    }

    back(): unknown {
        this.index = Math.max(0, this.index - 1);
        return this.state;
    }

    forward(): unknown {
        this.index = Math.min(this.entries.length - 1, this.index + 1);
        return this.state;
    }
}

const start: EditorNavigationSelection = {
    stat: 'Health',
    tab: 'Fields',
    itemKey: null,
};

function selection(
    stat: string,
    tab: string,
    itemKey: string | null = null,
    groupMembers?: string[],
): EditorNavigationSelection {
    return {
        stat,
        tab,
        itemKey,
        ...(groupMembers ? { groupMembers } : {}),
    };
}

function createController(history = new MemoryHistory()) {
    const changes: EditorNavigationSelection[] = [];
    const controller = new NavigationHistoryController(history, start, (next) =>
        changes.push(next),
    );
    return { history, changes, controller };
}

afterEach(() => vi.useRealTimers());

describe('browser navigation history', () => {
    it('pushes active selections, preserves unrelated state, and restores Back/Forward without duplicates', () => {
        const history = new MemoryHistory({ existing: { route: 'editor' } });
        const { controller } = createController(history);
        const entries = [
            selection('Grenade', 'Fields'),
            selection('Grenade', 'Abilities'),
            selection('Grenade', 'Abilities', null, ['ability-1', 'ability-2']),
            selection('Grenade', 'Abilities', 'ability-1'),
            selection('Grenade', 'Overrides', 'override-1'),
        ];
        for (const entry of entries) expect(controller.navigate(entry)).toBe(true);
        expect(controller.navigate(entries.at(-1)!)).toBe(false);
        expect(history.entries).toHaveLength(entries.length + 1);
        expect((history.entries[0] as { existing: unknown }).existing).toEqual({
            route: 'editor',
        });

        for (let index = entries.length - 2; index >= 0; index -= 1) {
            const restored = readNavigationSelection(history.back());
            expect(restored).toEqual(entries[index]);
            controller.restore(restored);
        }
        for (let index = 1; index < entries.length; index += 1) {
            const restored = readNavigationSelection(history.forward());
            expect(restored).toEqual(entries[index]);
            controller.restore(restored);
        }
        expect(controller.navigate(entries.at(-1)!)).toBe(false);
        expect(history.entries).toHaveLength(entries.length + 1);
    });

    it('commits a wheel burst only after exactly five idle seconds and resets the timer per step', () => {
        vi.useFakeTimers();
        const { history, controller } = createController(new MemoryHistory({ existing: true }));
        const firstStep = selection('Melee', 'Fields');
        const finalStep = selection('Melee', 'Abilities', 'ability-2');

        expect(controller.navigate(firstStep, 'scroll')).toBe(true);
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS - 1);
        expect(history.entries).toHaveLength(1);
        expect(controller.navigate(finalStep, 'scroll')).toBe(true);
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS - 1);
        expect(history.entries).toHaveLength(1);
        vi.advanceTimersByTime(1);

        expect(history.entries).toHaveLength(2);
        expect(readNavigationSelection(history.entries[0])).toEqual(start);
        expect(readNavigationSelection(history.entries[1])).toEqual(finalStep);
    });

    it('keeps separate scroll bursts as separate entries with the pre-burst Back target', () => {
        vi.useFakeTimers();
        const { history, controller } = createController();
        const firstBurst = selection('Melee', 'Fields');
        const secondBurst = selection('Super', 'Fields');
        controller.navigate(firstBurst, 'scroll');
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS);
        controller.navigate(secondBurst, 'scroll');
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS);

        expect(history.entries).toHaveLength(3);
        expect(readNavigationSelection(history.back())).toEqual(firstBurst);
        expect(readNavigationSelection(history.back())).toEqual(start);
        expect(readNavigationSelection(history.forward())).toEqual(firstBurst);
    });

    it('flushes pending scroll history before a click without losing either selection', () => {
        vi.useFakeTimers();
        const { history, controller } = createController();
        const scrolled = selection('Class', 'Fields');
        const clicked = selection('Weapons', 'Overrides', 'override-2');
        controller.navigate(scrolled, 'scroll');
        controller.navigate(clicked, 'click');

        expect(history.entries).toHaveLength(3);
        expect(readNavigationSelection(history.entries[1])).toEqual(scrolled);
        expect(readNavigationSelection(history.entries[2])).toEqual(clicked);
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS);
        expect(history.entries).toHaveLength(3);
    });

    it('cancels pending scroll timers on Back and restores later Forward without replay pushes', () => {
        vi.useFakeTimers();
        const { history, controller } = createController();
        const clicked = selection('Grenade', 'Fields');
        const pending = selection('Super', 'Fields');
        controller.navigate(clicked);
        controller.navigate(pending, 'scroll');

        const previous = history.back();
        controller.restore(readNavigationSelection(previous));
        expect(controller.navigate(start)).toBe(false);
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS);
        expect(history.entries).toHaveLength(2);
        expect(readNavigationSelection(history.forward())).toEqual(clicked);
        controller.restore(readNavigationSelection(history.state));
        expect(history.entries).toHaveLength(2);
    });

    it('synchronizes changed identities without adding history or extending a pending scroll', () => {
        vi.useFakeTimers();
        const { history, controller } = createController();
        const wheelSelection = selection('Grenade', 'Abilities', 'old-hash');
        const renamed = selection('Grenade', 'Abilities', 'new-hash');
        controller.navigate(wheelSelection, 'scroll');
        vi.advanceTimersByTime(2000);
        controller.sync(renamed);
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS - 2000);

        expect(history.entries).toHaveLength(2);
        expect(readNavigationSelection(history.entries[1])).toEqual(renamed);
    });

    it('keeps selection state serializable and does not capture drafts or source data', () => {
        const dirtyDraft = { Name: 'unsaved ability', SecretLikeSourceField: 'not serialized' };
        const history = new MemoryHistory({ unrelated: 'retained' });
        const { controller } = createController(history);
        const selected = selection('Super', 'Abilities', 'ability-1');
        controller.navigate(selected);

        expect(readNavigationSelection(history.state)).toEqual(selected);
        expect(history.state).not.toHaveProperty('dirtyDraft');
        expect(dirtyDraft.Name).toBe('unsaved ability');
    });

    it('distinguishes history entries from unrelated browser state', () => {
        const history = new MemoryHistory('existing primitive state');
        const { controller } = createController(history);
        controller.navigate(selection('Melee', 'Fields'));
        expect(readNavigationSelection(history.entries[0])).toEqual(start);
        expect(readNavigationSelection(history.entries[1])).toEqual(selection('Melee', 'Fields'));
        expect(
            (history.entries[0] as Record<string, unknown>).__characterStatsPreviousHistoryState,
        ).toBe('existing primitive state');
        expect(NAVIGATION_HISTORY_KEY).toBe('__characterStatsEditorNavigationV1');
    });

    it('compares optional cooldown-group identities without false matches', () => {
        expect(sameNavigationSelection(start, { ...start })).toBe(true);
        expect(
            sameNavigationSelection(
                selection('Super', 'Abilities', null, ['a', 'b']),
                selection('Super', 'Abilities', null, ['a', 'c']),
            ),
        ).toBe(false);
    });

    it('cleans up a pending timer on unmount', () => {
        vi.useFakeTimers();
        const { history, controller } = createController();
        controller.navigate(selection('Melee', 'Fields'), 'scroll');
        controller.dispose();
        vi.advanceTimersByTime(SCROLL_HISTORY_DELAY_MS);
        expect(history.entries).toHaveLength(1);
    });
});
