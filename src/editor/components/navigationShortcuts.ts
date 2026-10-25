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
