/** Below this width the outline is a floating disclosure that starts closed. */
export const OUTLINE_FLOATING_MAX = 1100;
/** Below this width a short outline starts collapsed instead of taking a side column. */
export const OUTLINE_SHORT_MAX = 1365;
export const OUTLINE_SHORT_ENTRIES = 6;

/** A remembered explicit choice wins above the floating breakpoint; otherwise the default. */
export function initialOutlineOpen(
    width: number,
    entries: number,
    choice: boolean | undefined,
): boolean {
    return choice !== undefined && width > OUTLINE_FLOATING_MAX
        ? choice
        : outlineDefaultOpen(width, entries);
}

export function outlineDefaultOpen(width: number, entries: number): boolean {
    if (width <= OUTLINE_FLOATING_MAX) return false;
    return !(width <= OUTLINE_SHORT_MAX && entries <= OUTLINE_SHORT_ENTRIES);
}
