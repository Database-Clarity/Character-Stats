import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
    title,
    onClose,
    children,
    busy = false,
}: {
    title: string;
    onClose(): void;
    children: ReactNode;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current!;
        dialog.showModal();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
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
