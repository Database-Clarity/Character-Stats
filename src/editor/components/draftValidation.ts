import { createContext, useContext } from 'react';

/** Which field-level errors a new draft shows: untouched fields stay quiet until Add is tried. */
export interface DraftValidation {
    attempted: boolean;
    touched: ReadonlySet<string>;
}

/** `null` outside drafts, where every error is shown. */
export const DraftValidationContext = createContext<DraftValidation | null>(null);

export function issuesVisible(state: DraftValidation | null, path: string): boolean {
    return !state || state.attempted || state.touched.has(path);
}

export function useIssuesVisible(path: string): boolean {
    return issuesVisible(useContext(DraftValidationContext), path);
}
