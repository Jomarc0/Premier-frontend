import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock } from 'react-icons/fi';
import { toast } from 'react-toastify';
import TotpInput from '@/components/auth/TotpInput';
import PrimaryButton from '@/components/auth/PrimaryButton';
import BrandLogo from '@/components/auth/BrandLogo';
import { BRAND_NAME, FOOTER_TEXT } from '@/constants/brand';
import { useAuth } from '../context/AuthContext';
import { captureEvent } from '../lib/posthog';

const CountdownBadge = ({ timerLabel }) => (
  <div className="inline-flex items-center gap-2 rounded-full bg-brand-primary/5 px-4 py-2 text-sm text-text-body shadow-[0_8px_18px_rgba(31,36,48,0.08)]">
    <FiClock className="text-brand-primary" />
    Authenticator refreshes in <span className="font-black text-brand-primary">{timerLabel}</span>
  </div>
);

const TotpVerifyPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const verifyingRef = useRef(false);
  const loginCompletedRef = useRef(false);

  useEffect(() => {
    if (loginCompletedRef.current) return;
    const tempToken = localStorage.getItem('tempToken');
    if (!tempToken) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const updateTimer = () => {
      const currentSecond = Math.floor(Date.now() / 1000);
      setSecondsLeft(30 - (currentSecond % 30));
    };

    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLockSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleVerify = async (nextCode = code) => {
    const cleanCode = String(nextCode).replace(/\D/g, '').slice(0, 6);
    if (verifyingRef.current || loginCompletedRef.current || lockSeconds > 0) return;
    if (cleanCode.length !== 6) {
      toast.warning('Enter your 6-digit code');
      return;
    }

    verifyingRef.current = true;
    setVerifying(true);
    try {
      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/passenger/auth/verify-totp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        const retryAfterSeconds = Number(data.data?.retryAfterSeconds || 0);
        if (retryAfterSeconds > 0) setLockSeconds(retryAfterSeconds);
        if (res.status === 401) {
          throw new Error(data.message || 'Code rejected. Please login again and enter the current authenticator code.');
        }
        throw new Error(data.message || 'Invalid code');
      }

      const { token, passengerName } = data.data;
      login(token, passengerName);
      loginCompletedRef.current = true;
      localStorage.removeItem('tempToken');
      captureEvent('passenger_web_login_success', {
        method: 'totp',
      });

      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      captureEvent('passenger_web_login_totp_failed');
      toast.error(err.message || 'Wrong code. Please try again.');
      setCode('');
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  };

  const timerLabel = `00:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <main className="grid min-h-screen place-items-center bg-page px-4 py-12 font-sans text-text-heading selection:bg-brand-primary selection:text-white">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl md:p-8">
        <div className="mb-5 text-left">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/15"
          >
            <FiArrowLeft />
            Back
          </button>
        </div>

        <BrandLogo className="h-20 w-20" />

        <h1 className="mt-5 text-2xl font-black uppercase leading-tight text-brand-primary">
          {BRAND_NAME}
        </h1>
        <p className="mt-0.5 mb-5 text-xs font-bold uppercase tracking-widest text-brand-accent">
          Secure Login
        </p>

        <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
          <h2 className="mb-1 text-xs font-black uppercase tracking-wider text-brand-primary">
            Verify Your Identity
          </h2>
          <p className="text-[11px] leading-relaxed text-text-body">
            Enter the 6-digit code from your authenticator app to continue.
          </p>
        </div>

        <div className="rounded-xl border border-border-input bg-white p-4">
          <p className="mb-3 text-left text-sm font-black text-text-heading">Authentication code</p>
          <TotpInput value={code} onChange={setCode} onComplete={handleVerify} disabled={lockSeconds > 0} />

          {lockSeconds > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              Too many incorrect codes. Try again in {Math.floor(lockSeconds / 60)}:{String(lockSeconds % 60).padStart(2, '0')}.
            </div>
          )}

          <div className="mt-5 grid">
            <PrimaryButton disabled={verifying || code.length < 6 || lockSeconds > 0} onClick={() => handleVerify()}>
              {lockSeconds > 0 ? 'Temporarily Locked' : verifying ? 'Verifying...' : 'Verify & Login'}
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-5">
          <CountdownBadge timerLabel={timerLabel} />
          <p className="mt-4 text-center text-sm text-text-body">
            Open Google Authenticator and enter the current 6-digit code.
          </p>
        </div>

        <footer className="mt-6 text-[10px] font-bold uppercase tracking-tight text-text-body">
          {FOOTER_TEXT}
        </footer>
      </section>
    </main>
  );
};

export default TotpVerifyPage;
