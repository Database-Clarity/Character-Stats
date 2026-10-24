import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
export interface ItemAction {
    label: string;
    onSelect(): void;
    danger?: boolean;
    disabled?: boolean;
}
export function ItemMenu({
    actions,
    label,
    openSignal = 0,
}: {
    actions: ItemAction[];
    label: string;
    openSignal?: number;
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const popup = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (openSignal) setOpen(true);
    }, [openSignal]);
    useEffect(() => {
        if (!open) return;
        const menu = popup.current!;
        const box = trigger.current!.getBoundingClientRect();
        const height = menu.offsetHeight;
        setPosition({
            left: Math.max(8, Math.min(window.innerWidth - 172, box.right - 164)),
            top:
                box.bottom + height + 4 > window.innerHeight
                    ? Math.max(8, box.top - height - 4)
                    : box.bottom + 4,
        });
        menu.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
        function close(event: PointerEvent) {
            if (
                !menu.contains(event.target as Node) &&
                !root.current?.contains(event.target as Node)
            )
                setOpen(false);
        }
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);
    return (
        <div
            className="item-menu"
            ref={root}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    setOpen(false);
                    trigger.current?.focus();
                    e.stopPropagation();
                }
                if (e.key === 'Tab') setOpen(false);
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault();
                    if (!open) {
                        setOpen(true);
                        return;
                    }
                    const buttons = Array.from(
                        popup.current!.querySelectorAll<HTMLButtonElement>(
                            '[role="menuitem"]:not(:disabled)',
                        ),
                    );
                    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    buttons[
                        e.key === 'Home'
                            ? 0
                            : e.key === 'End'
                              ? buttons.length - 1
                              : (index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                                buttons.length
                    ]?.focus();
                }
            }}
        >
            <button
                ref={trigger}
                className="icon-button menu-trigger"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                ⋯
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popup}
                        role="menu"
                        aria-label={label}
                        className="menu-popup"
                        style={{ position: 'fixed', top: position.top, left: position.left }}
                    >
                        {actions.map((action) => (
                            <button
                                key={action.label}
                                role="menuitem"
                                disabled={action.disabled}
                                className={action.danger ? 'danger' : ''}
                                onClick={() => {
                                    setOpen(false);
                                    action.onSelect();
                                    trigger.current?.focus();
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
