import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
    title,
    onClose,
    children,
    busy = false,
    className = '',
}: {
    title: string;
    onClose(): void;
    children: ReactNode;
    busy?: boolean;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current!;
        const opener = document.activeElement as HTMLElement | null;
        dialog.showModal();
        // showModal() focuses the first focusable (the close button), so override it.
        (
            dialog.querySelector<HTMLElement>('[data-autofocus]') ??
            dialog.querySelector<HTMLElement>('input:not([type=checkbox]),textarea,select')
        )?.focus();
        return () => {
            dialog.close();
            if (opener?.isConnected) opener.focus();
        };
    }, []);
    return (
        <dialog
            ref={ref}
            className={className}
            aria-label={title}
            onKeyDown={(event) => {
                if (event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                if (!busy) onClose();
            }}
            onCancel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!busy) onClose();
            }}
        >
            <header className="dialog-heading">
                <h2>{title}</h2>
                <button aria-label={`Close ${title}`} disabled={busy} onClick={onClose}>
                    ×
                </button>
            </header>
            {children}
        </dialog>
    );
}
