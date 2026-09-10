import { useEffect, useRef } from 'react';
import { FiAlertTriangle, FiLoader, FiShield } from 'react-icons/fi';

export default function ConfirmModal({
    isOpen, onClose, onConfirm, title, message, warning,
    confirmText = 'Confirm', cancelText = 'Cancel', loadingText = 'Processing...',
    variant = 'danger', loading = false, confirmDisabled = false, returnFocusRef,
    ariaLabelledBy = 'confirm-modal-title', ariaDescribedBy = 'confirm-modal-description',
}) {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);
    const warningId = `${ariaDescribedBy}-warning`;
    const variantStyles = {
        danger: 'bg-red-700 hover:bg-red-800 text-white',
        warning: 'bg-amber-800 hover:bg-amber-900 text-white',
        primary: 'bg-maroon hover:bg-maroon-dark text-white',
    };

    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        const previousFocus = returnFocusRef?.current || document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        cancelRef.current?.focus();
        document.body.style.overflow = 'hidden';
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, [isOpen, returnFocusRef]);

    if (!isOpen) return null;

    return (
        <dialog
            ref={dialogRef}
            aria-modal="true"
            aria-labelledby={ariaLabelledBy}
            aria-describedby={`${ariaDescribedBy}${warning ? ` ${warningId}` : ''}`}
            className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-border-soft bg-white p-0 text-text-main shadow-[0_24px_70px_rgba(0,0,0,0.3)] backdrop:bg-black/50"
            onCancel={(event) => { event.preventDefault(); onClose(); }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled)')];
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }}
        >
            <div className="p-5 sm:p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-maroon/10 text-maroon" aria-hidden="true">
                    <FiShield className="h-6 w-6" />
                </div>
                <h2 id={ariaLabelledBy} className="text-xl font-black leading-snug text-maroon">{title}</h2>
                <p id={ariaDescribedBy} className="mt-3 text-sm leading-6 text-text-main">{message}</p>
                {warning && (
                    <div id={warningId} className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                        <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <p className="text-sm leading-6"><strong className="mb-1 block font-extrabold">Security warning</strong>{warning}</p>
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-3 border-t border-border-soft px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button ref={cancelRef} type="button" onClick={onClose}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-soft bg-white px-5 py-2.5 text-sm font-extrabold text-maroon transition hover:bg-page-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon">
                    {cancelText}
                </button>
                <button type="button" onClick={onConfirm} disabled={loading || confirmDisabled} aria-busy={loading}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon disabled:cursor-not-allowed disabled:opacity-60 ${variantStyles[variant]}`}>
                    {loading && <FiLoader className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    <span role="status" aria-live="polite">{loading ? loadingText : confirmText}</span>
                </button>
            </div>
        </dialog>
    );
}
