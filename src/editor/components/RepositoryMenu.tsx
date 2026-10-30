import { useEffect, useRef, useState } from 'react';

export function RepositoryMenu({
    accountLabel,
    sourceLabel,
    onRecovery,
    onSignOut,
}: {
    accountLabel: string;
    sourceLabel: string;
    onRecovery(): void;
    onSignOut(): void;
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    function focusItem(last = false) {
        requestAnimationFrame(() => {
            const items = panelRef.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
            );
            (last ? items?.[items.length - 1] : items?.[0])?.focus();
        });
    }
    function openMenu(last = false) {
        setOpen(true);
        focusItem(last);
    }
    useEffect(() => {
        if (!open) return;
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
    }, [open]);
    return (
        <div
            className="more-menu"
            ref={menuRef}
            onBlur={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (!menuRef.current?.contains(nextTarget) || nextTarget === triggerRef.current)
                    setOpen(false);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && open) {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    triggerRef.current?.focus();
                    return;
                }
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                if (
                    event.target === triggerRef.current &&
                    !open &&
                    (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    openMenu(event.key === 'ArrowUp');
                    return;
                }
                const items = Array.from(
                    panelRef.current?.querySelectorAll<HTMLButtonElement>(
                        '[role="menuitem"]:not(:disabled)',
                    ) ?? [],
                );
                if (!items.length) return;
                event.preventDefault();
                event.stopPropagation();
                const index = items.indexOf(event.target as HTMLButtonElement);
                const next =
                    event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? items.length - 1
                          : event.target === triggerRef.current
                            ? event.key === 'ArrowDown'
                                ? 0
                                : items.length - 1
                            : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                              items.length;
                items[next]?.focus();
            }}
        >
            <button
                ref={triggerRef}
                className="more-menu-trigger"
                type="button"
                aria-label="Repository options"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? 'repository-options-menu' : undefined}
                title={`Repository options · ${accountLabel}`}
                onClick={() => {
                    if (open) setOpen(false);
                    else openMenu();
                }}
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            {open && (
                <div
                    ref={panelRef}
                    id="repository-options-menu"
                    className="more-menu-panel"
                    role="menu"
                    aria-label="Repository options"
                >
                    <div
                        className="more-menu-identity"
                        role="group"
                        aria-label="Repository identity"
                    >
                        <span>Repository</span>
                        <strong className="account-repo" title={sourceLabel}>
                            {accountLabel}
                        </strong>
                    </div>
                    <div className="more-menu-actions" role="group" aria-label="Actions">
                        <button
                            role="menuitem"
                            tabIndex={-1}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                // The menu item unmounts; give the dialog a live opener to return focus to.
                                triggerRef.current?.focus();
                                onRecovery();
                            }}
                        >
                            Recovery
                        </button>
                        <button
                            role="menuitem"
                            tabIndex={-1}
                            type="button"
                            className="account-button"
                            title="Sign out of this repository"
                            onClick={() => {
                                setOpen(false);
                                // The menu item unmounts; give the dialog a live opener to return focus to.
                                triggerRef.current?.focus();
                                onSignOut();
                            }}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                aria-hidden="true"
                            >
                                <path d="M10 4H4v16h6M10 12h11m-5-5 5 5-5 5" />
                            </svg>
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
