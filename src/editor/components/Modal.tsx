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
        dialog.showModal();
        dialog.querySelector<HTMLElement>('input:not([type=checkbox]),textarea,select')?.focus();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className={className}
            aria-label={title}
            onCancel={(e) => {
                e.preventDefault();
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
