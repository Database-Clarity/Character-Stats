import { Modal } from './Modal';

export function ConfirmDialog({
    title,
    message,
    confirmLabel,
    onConfirm,
    onClose,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm(): void;
    onClose(): void;
}) {
    return (
        <Modal title={title} onClose={onClose}>
            <p>{message}</p>
            <div className="toolbar">
                <button autoFocus onClick={onClose}>
                    Cancel
                </button>
                <button className="danger" onClick={onConfirm}>
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}
