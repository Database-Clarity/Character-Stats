export const SCROLL_HISTORY_DELAY_MS = 5000;
export const NAVIGATION_HISTORY_KEY = '__characterStatsEditorNavigationV1';

export interface EditorNavigationSelection {
    stat: string;
    tab: string;
    itemKey: string | null;
    groupMembers?: string[];
}

type HistoryState = Pick<History, 'state' | 'pushState' | 'replaceState'>;
export type NavigationMode = 'click' | 'scroll' | 'sync';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sameNavigationSelection(
    left: EditorNavigationSelection,
    right: EditorNavigationSelection,
): boolean {
    return (
        left.stat === right.stat &&
        left.tab === right.tab &&
        left.itemKey === right.itemKey &&
        left.groupMembers?.length === right.groupMembers?.length &&
        left.groupMembers?.every((member, index) => member === right.groupMembers?.[index]) !==
            false
    );
}

export function readNavigationSelection(state: unknown): EditorNavigationSelection | undefined {
    if (!isRecord(state)) return undefined;
    const value = state[NAVIGATION_HISTORY_KEY];
    if (!isRecord(value)) return undefined;
    if (
        typeof value.stat !== 'string' ||
        typeof value.tab !== 'string' ||
        !(typeof value.itemKey === 'string' || value.itemKey === null)
    )
        return undefined;
    if (
        value.groupMembers !== undefined &&
        (!Array.isArray(value.groupMembers) ||
            !value.groupMembers.every((member) => typeof member === 'string'))
    )
        return undefined;
    return {
        stat: value.stat,
        tab: value.tab,
        itemKey: value.itemKey,
        ...(Array.isArray(value.groupMembers)
            ? { groupMembers: [...value.groupMembers] as string[] }
            : {}),
    };
}

function withNavigationSelection(
    state: unknown,
    selection: EditorNavigationSelection,
): Record<string, unknown> {
    const next: Record<string, unknown> =
        isRecord(state) && Object.getPrototypeOf(state) === Object.prototype
            ? { ...state }
            : { __characterStatsPreviousHistoryState: state };
    next[NAVIGATION_HISTORY_KEY] = {
        ...selection,
        ...(selection.groupMembers ? { groupMembers: [...selection.groupMembers] } : {}),
    };
    return next;
}

export class NavigationHistoryController {
    private current: EditorNavigationSelection;
    private pendingScroll:
        { baseline: EditorNavigationSelection; selection: EditorNavigationSelection } | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private readonly history: HistoryState,
        initial: EditorNavigationSelection,
        private readonly onChange: (selection: EditorNavigationSelection) => void,
    ) {
        this.current = initial;
    }

    navigate(selection: EditorNavigationSelection, mode: NavigationMode = 'click'): boolean {
        if (mode === 'sync') {
            if (sameNavigationSelection(this.current, selection)) return false;
            this.sync(selection);
            return true;
        }
        if (mode === 'scroll') {
            if (sameNavigationSelection(this.current, selection)) return false;
            if (!this.pendingScroll) {
                this.pendingScroll = { baseline: this.current, selection };
            } else {
                this.pendingScroll.selection = selection;
            }
            this.current = selection;
            this.onChange(selection);
            this.restartTimer();
            return true;
        }

        this.flushScroll();
        if (sameNavigationSelection(this.current, selection)) return false;
        this.push(selection, this.current);
        this.current = selection;
        this.onChange(selection);
        return true;
    }

    sync(selection: EditorNavigationSelection): void {
        this.current = selection;
        if (this.pendingScroll) this.pendingScroll.selection = selection;
        else if (readNavigationSelection(this.history.state)) {
            this.history.replaceState(withNavigationSelection(this.history.state, selection), '');
        }
        this.onChange(selection);
    }

    restore(selection: EditorNavigationSelection | undefined, replaceInvalid = false): void {
        this.cancelScroll();
        if (!selection) return;
        this.current = selection;
        if (replaceInvalid) {
            this.history.replaceState(withNavigationSelection(this.history.state, selection), '');
        }
        this.onChange(selection);
    }

    dispose(): void {
        this.cancelScroll();
    }

    private restartTimer(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.flushScroll();
        }, SCROLL_HISTORY_DELAY_MS);
    }

    private cancelScroll(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = undefined;
        this.pendingScroll = undefined;
    }

    private flushScroll(): void {
        if (this.timer !== undefined) clearTimeout(this.timer);
        this.timer = undefined;
        const pending = this.pendingScroll;
        this.pendingScroll = undefined;
        if (!pending || sameNavigationSelection(pending.baseline, pending.selection)) return;
        this.push(pending.selection, pending.baseline);
    }

    private push(selection: EditorNavigationSelection, baseline: EditorNavigationSelection): void {
        const current = readNavigationSelection(this.history.state);
        if (!current || !sameNavigationSelection(current, baseline))
            this.history.replaceState(withNavigationSelection(this.history.state, baseline), '');
        this.history.pushState(withNavigationSelection(this.history.state, selection), '');
    }
}
