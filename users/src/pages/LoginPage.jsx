import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCreditCard, FiLogIn, FiShield } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { BRAND_NAME, FOOTER_TEXT } from '../constants/brand';
import BrandLogo from '../components/auth/BrandLogo';
import PrivacyNoticeModal from '../components/PrivacyNoticeModal';
import { PRIVACY_NOTICE_ACCEPTED_KEY } from '../constants/privacy';
import { captureEvent } from '../lib/posthog';
import { apiOrigin } from '../api/apiOrigin';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [lostCardFlow, setLostCardFlow] = useState(false);
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(
    () => localStorage.getItem(PRIVACY_NOTICE_ACCEPTED_KEY) !== 'true',
  );
  const [privacyAcceptanceRequired, setPrivacyAcceptanceRequired] = useState(
    () => localStorage.getItem(PRIVACY_NOTICE_ACCEPTED_KEY) !== 'true',
  );

  const acceptPrivacyNotice = () => {
    localStorage.setItem(PRIVACY_NOTICE_ACCEPTED_KEY, 'true');
    setPrivacyAcceptanceRequired(false);
    setPrivacyNoticeOpen(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    captureEvent('passenger_web_login_started');

    if (lostCardFlow) {
      localStorage.setItem('postLoginAction', 'REPORT_LOST_CARD');
    } else {
      localStorage.removeItem('postLoginAction');
    }

    try {
      const res = await fetch(`${apiOrigin}/api/passenger/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || 'Login failed');

      const { tempToken, requireSetup } = data.data;

      if (!tempToken) {
        toast.error('Login failed: no session token received.');
        return;
      }

      localStorage.setItem('tempToken', tempToken);

      if (requireSetup) {
        captureEvent('passenger_web_login_totp_setup_required');
        toast.info('Please set up Google Authenticator');
        navigate('/totp-setup');
      } else {
        captureEvent('passenger_web_login_totp_required');
        toast.info('Enter your Google Authenticator code');
        navigate('/verify-totp');
      }
    } catch (err) {
      captureEvent('passenger_web_login_failed');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const beginLostCardReport = () => setLostCardFlow(true);

  const returnToNormalLogin = () => {
    localStorage.removeItem('postLoginAction');
    setLostCardFlow(false);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 py-12 font-sans text-text-heading selection:bg-brand-primary selection:text-white">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
        <BrandLogo className="h-20 w-20" />

        <h1 className="mt-5 text-2xl font-black uppercase leading-tight text-brand-primary">
          {BRAND_NAME}
        </h1>
        <p className="mt-0.5 mb-6 text-xs font-bold uppercase tracking-widest text-brand-accent">
          Safe Travel for Everyone
        </p>

        <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
          <h2 className="mb-1 text-xs font-black uppercase tracking-wider text-brand-primary">
            {lostCardFlow ? 'Secure your lost card' : 'Welcome Back, Passenger'}
          </h2>
          <p className="text-[11px] leading-relaxed text-text-body">
            {lostCardFlow
              ? 'Sign in with your card number and Google Authenticator to review the final freeze confirmation.'
              : 'Enter your card number to securely access your transport account.'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label htmlFor="cardNumber" className="mb-1.5 block text-xs font-black uppercase tracking-wider text-text-body">
              Card Number
            </label>

            <div className="flex items-center gap-2 rounded-xl border border-border-input bg-slate-50 px-3 py-3 transition-all focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
              <FiCreditCard className="shrink-0 text-text-placeholder" size={18} />
              <input
                id="cardNumber"
                type="text"
                placeholder="e.g. 9205854310"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                required
                className="w-full border-0 bg-transparent font-mono text-sm font-bold text-text-heading outline-none placeholder:text-text-placeholder"
              />
            </div>

            <p className="mt-1.5 text-[10px] font-medium italic text-text-body">
              Find this number on your physical Premier Transit card or tag.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-brand-primary-dark active:scale-95 disabled:cursor-wait disabled:bg-brand-primary/40"
          >
            <FiLogIn size={16} />
            {loading ? 'Signing in...' : lostCardFlow ? 'Continue to secure verification' : 'Log In'}
          </button>

          {lostCardFlow ? (
            <button
              type="button"
              onClick={returnToNormalLogin}
              className="flex w-full items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest text-text-body transition hover:text-brand-primary"
            >
              Return to normal sign in
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={beginLostCardReport}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 py-3 text-xs font-black uppercase tracking-widest text-rose-800 transition hover:bg-rose-100"
              >
                <FiShield size={16} />
                Report a lost card
              </button>
              <p className="-mt-2 text-center text-[10px] leading-relaxed text-text-body">
                Secure verification is required before a card can be frozen.
              </p>
            </>
          )}

          <p className="text-center text-[11px] leading-relaxed text-text-body">
            By continuing, you acknowledge the{' '}
            <button
              type="button"
              onClick={() => setPrivacyNoticeOpen(true)}
              className="font-black text-brand-primary underline underline-offset-2 hover:text-brand-primary-dark"
            >
              Privacy Notice
            </button>
            .
          </p>
        </form>

        <div className="mt-8 space-y-1 border-t border-slate-100 pt-5 text-xs text-text-body">
          <p>Need help with your Card Number?</p>
          <a href="tel:+028888171" className="inline-block font-black text-brand-primary hover:text-brand-primary-dark hover:underline">
            Call Support Hotline: (02) 8888-171
          </a>
        </div>

        <footer className="mt-6 text-[10px] font-bold uppercase tracking-tight text-text-body">
          {FOOTER_TEXT}
        </footer>
      </section>

      <PrivacyNoticeModal
        open={privacyNoticeOpen}
        required={privacyAcceptanceRequired}
        onClose={() => setPrivacyNoticeOpen(false)}
        onAccept={privacyAcceptanceRequired ? acceptPrivacyNotice : undefined}
      />
    </main>
  );
};

export default LoginPage;
