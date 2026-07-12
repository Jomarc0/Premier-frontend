import { useEffect } from 'react';
import { FiShield, FiX } from 'react-icons/fi';

export default function PrivacyNoticeModal({ open, required = false, onClose, onAccept }) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !required) onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open, required]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!required && event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-brand-primary">
              <FiShield size={21} />
            </span>
            <h2 id="privacy-notice-title" className="text-xl font-black text-brand-primary">
              Privacy Notice
            </h2>
          </div>

          {!required && (
            <button
              type="button"
              aria-label="Close Privacy Notice"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-brand-primary transition hover:bg-red-100"
            >
              <FiX size={22} />
            </button>
          )}
        </header>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5 text-sm leading-6 text-slate-700">
          <p>
            Premier Transport uses your RFID card number to verify your passenger account and allow access to your card balance, fare payment, and transaction features.
          </p>
          <p>
            For account security, the app may ask for a 6-digit code from Google Authenticator. The app does not collect your Google Authenticator password or personal Google account. The code is used only to confirm that you are the authorized card user.
          </p>
          <p>
            Your card number and authentication activity are used only for login, account protection, fare services, and system security.
          </p>
          <p>
            By continuing, you acknowledge that your information will be processed for these purposes in accordance with the Data Privacy Act of 2012.
          </p>
        </div>

        <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onAccept || onClose}
            className="w-full rounded-xl bg-brand-primary px-5 py-3.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-brand-primary-dark active:scale-[0.99]"
          >
            I Understand
          </button>
        </footer>
      </section>
    </div>
  );
}
