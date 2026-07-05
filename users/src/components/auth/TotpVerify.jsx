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
  contentTopSlot,
  children,
}) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isReady = code.length === 6;
  const panelLabel = mode === 'setup' ? 'Secure Setup' : 'Secure Login';

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
    <main className="grid min-h-screen place-items-center bg-page px-4 py-8">
      <section className="grid w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-[2fr_3fr]">
        <aside className="grid place-content-center bg-brand-primary p-8 text-center text-white">
          <BrandLogo />
          <h1 className="mt-6 text-2xl font-black">{BRAND_NAME}</h1>
          <p className="mt-2 text-sm font-semibold text-brand-accent">{panelLabel}</p>
          <p className="mt-8 text-sm leading-relaxed text-white/75">{FOOTER_TEXT}</p>
        </aside>

        <form onSubmit={handleSubmit} className="p-8">
          {contentTopSlot ? <div className="mb-6">{contentTopSlot}</div> : null}

          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-primary text-white">
            <LockIcon />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-text-heading">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-body">{subtitle}</p>
          </div>

          {children ? <div className="mt-6">{children}</div> : null}

          <div className="mt-6">
            <TotpInput value={code} onChange={setCode} />
          </div>

          <div className="mt-6">
            <PrimaryButton disabled={!isReady || submitting} onClick={handleSubmit} icon={<LockIcon />}>
              {submitting ? 'Verifying...' : mode === 'setup' ? 'Verify & Enable 2FA' : 'Verify & Login'}
            </PrimaryButton>
          </div>

          <div className="mt-5 text-center text-sm text-text-body">
            {onResend ? (
              <button type="button" onClick={onResend} className="font-semibold text-brand-primary hover:text-brand-primary-dark">
                Resend code
              </button>
            ) : null}
            {footerSlot ? <div className="mt-3">{footerSlot}</div> : null}
          </div>
        </form>
      </section>
    </main>
  );
}
