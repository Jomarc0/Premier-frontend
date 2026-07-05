import { useState } from 'react';
import { BRAND_NAME, FOOTER_TEXT } from '../../constants/brand';
import PrimaryButton from './PrimaryButton';
import TotpInput from './TotpInput';
import BrandLogo from './BrandLogo';

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
      <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function TotpVerify({
  mode = 'login',
  title,
  subtitle,
  onVerify,
  onResend,
  footerSlot,
  topSlot,
  children,
}) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isReady = code.length === 6;
  const panelLabel = mode === 'setup' ? 'Secure Setup' : 'Admin Panel';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isReady || submitting) return;

    try {
      setSubmitting(true);
      await onVerify?.(code);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#edf1f6_0%,#f8fafc_100%)] px-4 py-8">
      <section className="grid min-h-140 w-full max-w-240 grid-cols-[minmax(280px,1fr)_minmax(320px,1fr)] overflow-hidden rounded-2xl bg-white shadow-[0_22px_52px_rgba(44,36,41,0.18)] max-[860px]:grid-cols-1">
        <aside className="grid place-content-center bg-brand-primary p-8 text-center text-white max-[860px]:min-h-64">
          <BrandLogo className="h-20 w-20" />
          <h1 className="m-0 text-[clamp(1.65rem,3vw,2.05rem)] font-black tracking-wider">{BRAND_NAME}</h1>
          <p className="mt-[0.9rem] mb-0 font-extrabold tracking-wider text-brand-accent">{panelLabel}</p>
          <p className="mt-8 text-sm leading-relaxed text-white/75">{FOOTER_TEXT}</p>
        </aside>

        <form onSubmit={handleSubmit} className="grid content-center bg-white p-[clamp(2rem,5vw,3.5rem)]">
          <div className="mx-auto w-full max-w-md text-center">
            {topSlot ? <div className="mb-6 text-left">{topSlot}</div> : null}

            <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full bg-brand-primary text-white">
              <LockIcon />
            </div>
            <h2 className="m-0 text-[clamp(1.55rem,3vw,1.9rem)] font-black text-text-heading">{title}</h2>
            <p className="mx-auto mt-3 max-w-sm text-[0.92rem] leading-relaxed text-text-body">{subtitle}</p>

            {children ? <div className="mt-6">{children}</div> : null}

            <div className="mt-7">
              <TotpInput value={code} onChange={setCode} />
            </div>

            <div className="mx-auto mt-7 grid max-w-xs">
              <PrimaryButton disabled={!isReady || submitting} onClick={handleSubmit} icon={<LockIcon />}>
                {submitting ? 'Verifying...' : mode === 'setup' ? 'Verify & Enable 2FA' : 'Verify & Login'}
              </PrimaryButton>
            </div>

            <div className="mt-6 text-center text-sm text-text-body">
              {onResend ? (
                <button type="button" onClick={onResend} className="font-semibold text-brand-primary hover:text-brand-primary-dark">
                  Resend code
                </button>
              ) : null}
              {footerSlot ? <div className="mt-3">{footerSlot}</div> : null}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
