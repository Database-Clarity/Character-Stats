export type NavigationDirection = -1 | 1;

export interface WheelNavigationState {
    accumulated: number;
    direction: NavigationDirection | null;
    lastNavigation: number;
}

type ModifierEvent = Pick<
    KeyboardEvent,
    'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'getModifierState'
>;

export function normalizeWheelDeltaY(
    deltaY: number,
    deltaMode: number,
    pageHeight: number,
): number {
    return deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(pageHeight, 1) : 1);
}

export function hasExactCtrlAltModifiers(event: ModifierEvent, isComposing = false): boolean {
    return (
        event.ctrlKey &&
        event.altKey &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.getModifierState('AltGraph') &&
        !isComposing
    );
}

export function consumeWheelNavigation(
    state: WheelNavigationState,
    delta: number,
    now: number,
): NavigationDirection | undefined {
    if (delta === 0) return undefined;
    const direction: NavigationDirection = delta > 0 ? 1 : -1;
    if (state.direction !== direction) {
        state.direction = direction;
        state.accumulated = 0;
    }
    state.accumulated += delta;
    if (Math.abs(state.accumulated) < 40 || now - state.lastNavigation < 140) return undefined;
    state.lastNavigation = now;
    state.accumulated = 0;
    return direction;
}

export function resetWheelNavigation(state: WheelNavigationState): void {
    state.accumulated = 0;
    state.direction = null;
    state.lastNavigation = 0;
}

export function nextCollectionSelection(
    visibleKeys: readonly string[],
    selectedKey: string | null,
    direction: NavigationDirection,
): string | undefined {
    if (!visibleKeys.length) return undefined;
    const currentIndex = selectedKey === null ? -1 : visibleKeys.indexOf(selectedKey);
    const nextIndex =
        currentIndex < 0 ? (direction > 0 ? 0 : visibleKeys.length - 1) : currentIndex + direction;
    return visibleKeys[nextIndex];
}

/**
 * Next index of a roving-tabindex list for a navigation key, or undefined when the key is not
 * one (or is a no-op at an end). `horizontal` also accepts ←/→, for strips laid out in a row.
 */
export function rovingIndex(
    count: number,
    current: number,
    key: string,
    horizontal = false,
): number | undefined {
    if (count < 1) return undefined;
    const step =
        key === 'ArrowDown' || (horizontal && key === 'ArrowRight')
            ? 1
            : key === 'ArrowUp' || (horizontal && key === 'ArrowLeft')
              ? -1
              : 0;
    const next =
        key === 'Home'
            ? 0
            : key === 'End'
              ? count - 1
              : step
                ? Math.min(
                      count - 1,
                      Math.max(0, current < 0 ? (step > 0 ? 0 : count - 1) : current + step),
                  )
                : undefined;
    return next === undefined || next === current ? undefined : next;
}
