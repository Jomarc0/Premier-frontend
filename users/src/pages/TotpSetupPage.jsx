import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft } from 'react-icons/fi';
import { Copy } from 'lucide-react';
import TotpInput from '@/components/auth/TotpInput';
import PrimaryButton from '@/components/auth/PrimaryButton';
import BrandLogo from '@/components/auth/BrandLogo';
import { BRAND_NAME, FOOTER_TEXT } from '@/constants/brand';
import { captureEvent } from '../lib/posthog';
import { useAuth } from '../context/AuthContext';
import { apiOrigin } from '../api/apiOrigin';

const TotpSetupPage = ({ accountType = 'passenger' }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const tempToken = localStorage.getItem('tempToken');
    if (!tempToken) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
      return;
    }
    fetchSetup(tempToken);
  }, [navigate]);

  const fetchSetup = async (tempToken) => {
    try {
      const res = await fetch(`${apiOrigin}/api/passenger/auth/totp/setup`, {
        headers: { Authorization: `Bearer ${tempToken}`, 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
      }
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}: ${text}`);
      setSetup(data.data);
    } catch (err) {
      toast.error(`Failed to load QR code: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (nextCode = code) => {
    const cleanCode = String(nextCode).replace(/\D/g, '').slice(0, 6);
    if (verifying) return;
    if (cleanCode.length !== 6) {
      toast.warning('Please enter 6-digit code');
      return;
    }

    setVerifying(true);
    try {
      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) {
        toast.error('Session expired');
        navigate('/login');
        return;
      }

      const res = await fetch(`${apiOrigin}/api/passenger/auth/verify-totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Verification failed');

      const { token, passengerName, passengerId } = data.data;
      if (!token) throw new Error('No authentication token received from server');

      login(token, passengerName);
      localStorage.removeItem('tempToken');
      captureEvent('passenger_web_login_success', {
        method: 'totp_setup',
      });

      const nextAction = localStorage.getItem('postLoginAction');
      localStorage.removeItem('postLoginAction');
      if (nextAction === 'REPORT_LOST_CARD') {
        navigate('/report-lost-card');
      } else {
        toast.success(`2FA setup complete! Welcome Passenger #${passengerId}`);
        navigate('/dashboard');
      }
    } catch (error) {
      captureEvent('passenger_web_totp_setup_failed');
      toast.error(error.message || 'Setup failed');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleAutoVerify = (completedCode) => {
    handleVerify(completedCode);
  };

  const handleCopy = () => {
    if (setup?.manualEntryKey) {
      navigator.clipboard.writeText(setup.manualEntryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#f3f4f7]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#fae7e9] border-t-[#8f151d] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#717680] text-sm">Loading your 2FA setup...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 py-10 font-sans text-text-heading selection:bg-brand-primary selection:text-white">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl md:p-7">
        <div className="mb-4 text-left">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/15"
          >
            <FiArrowLeft /> Back
          </button>
        </div>

        <div className="text-center">
          <BrandLogo className="h-20 w-20" />
          <h1 className="mt-4 text-2xl font-black uppercase leading-tight text-brand-primary">
            {BRAND_NAME}
          </h1>
          <p className="mt-0.5 mb-4 text-xs font-bold uppercase tracking-widest text-brand-accent">
            Secure Setup
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
          <h2 className="mb-1 text-xs font-black uppercase tracking-wider text-brand-primary">
            Set up two-factor authentication
          </h2>
          <p className="text-[11px] leading-relaxed text-text-body">
            Scan the QR code, then enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <div className="grid gap-4 text-left md:grid-cols-[230px_minmax(0,1fr)]">
          <div className="rounded-xl border border-border-input bg-white p-4">
            <p className="mb-3 text-sm font-black text-text-heading">Scan QR code</p>
            <div className="grid place-items-center rounded-lg border border-slate-100 bg-slate-50 p-3">
              {setup?.qrCodeUrl ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(setup.qrCodeUrl)}`}
                  alt="Scan this QR code"
                  width={160}
                  height={160}
                  className="block rounded-md"
                />
              ) : (
                <div className="text-center">
                  <p className="mb-2 text-sm text-brand-primary">Failed to load QR code</p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      fetchSetup(localStorage.getItem('tempToken'));
                    }}
                    className="bg-transparent text-sm text-brand-primary underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-xl border border-border-input bg-white p-4">
              <p className="mb-2 text-sm text-text-heading">
                <strong>Can't scan?</strong> Copy this setup key.
              </p>
              <div className="relative">
                <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-page p-3 font-mono text-xs tracking-wider">
                  <span className="min-w-0 flex-1 break-all">{setup?.manualEntryKey || '-'}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 text-brand-primary hover:text-brand-primary-dark"
                    aria-label="Copy setup key"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                {copied && (
                  <div className="absolute right-2 top-[-2.2rem] rounded-md bg-brand-primary px-2.5 py-1 text-xs font-semibold text-white shadow-lg">
                    Copied!
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-input bg-white p-4">
              <p className="mb-3 text-sm font-black text-text-heading">Enter 6-digit code</p>
              <TotpInput value={code} onChange={setCode} onComplete={handleAutoVerify} />
              <p className="mt-3 mb-4 text-xs text-text-body">Code changes every 30 seconds.</p>

              <div className="grid">
                <PrimaryButton disabled={verifying || code.length < 6} onClick={() => handleVerify()}>
                  {verifying ? 'Verifying...' : 'Verify & Enable 2FA'}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 text-left text-xs text-text-body">
          <strong className="text-brand-primary">Important:</strong> Keep your authenticator app available for future logins.
        </p>

        <footer className="mt-5 text-center text-[10px] font-bold uppercase tracking-tight text-text-body">
          {FOOTER_TEXT}
        </footer>
      </section>
    </main>
  );
};

export default TotpSetupPage;
