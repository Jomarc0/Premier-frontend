import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiLock, FiArrowLeft, FiCopy, FiCheck } from 'react-icons/fi';

const TotpSetupPage = () => {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
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
  }, []);

  const fetchSetup = async (tempToken) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/passenger/auth/totp/setup`, {
        headers: { 'Authorization': `Bearer ${tempToken}`, 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch (e) { throw new Error(`Invalid JSON: ${text.substring(0, 100)}`); }
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}: ${text}`);
      setSetup(data.data);
    } catch (err) {
      toast.error('Failed to load QR code: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (totpCode.length !== 6) { toast.warning('Please enter 6-digit code'); return; }
    setVerifying(true);
    try {
      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) { toast.error('Session expired'); navigate('/login'); return; }

      const res = await fetch('http://localhost:8080/api/passenger/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode: totpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Verification failed');

      const { token, passengerName, passengerId } = data.data;
      if (!token) throw new Error('No authentication token received from server');

      localStorage.setItem('token', token);
      localStorage.setItem('passengerName', passengerName);
      localStorage.removeItem('tempToken');

      toast.success(`2FA setup complete! Welcome Passenger #${passengerId}`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Setup failed');
      setTotpCode('');
    } finally {
      setVerifying(false);
    }
  };

  const copyCode = () => {
    if (setup?.manualEntryKey) {
      navigator.clipboard.writeText(setup.manualEntryKey);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 2000);
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
    <main className="min-h-screen flex justify-center items-start px-4 pt-10 pb-10 bg-[#f3f4f7]">
      <div className="bg-white rounded-2xl p-9 w-full max-w-110 shadow-[0_18px_42px_rgba(44,36,41,0.14)]">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-full bg-[#8f151d] inline-flex items-center justify-center text-[1.75rem] mb-3.5 shadow-[0_4px_16px_rgba(143,21,29,0.35)]">
            <FiLock className="text-white" />
          </div>
          <h1 className="font-black text-[1.375rem] text-[#8f151d] leading-snug m-0">
            Set up Two-Factor<br />Authentication
          </h1>
          <p className="text-[#717680] text-xs mt-2">
            Secure your account with Google Authenticator
          </p>
        </div>

        {/* Step 1 */}
        <div className="border-l-4 border-[#8f151d] bg-[#fae7e9] rounded-r-lg px-4 py-3 mb-3.5 text-sm text-[#392d33]">
          <strong className="text-[#8f151d]">Step 1:</strong>{' '}
          Download Google Authenticator or Authy on your phone
        </div>

        {/* Step 2 — QR */}
        <div className="border-l-4 border-[#8f151d] bg-[#fae7e9] rounded-r-lg px-4 py-3.5 mb-3.5">
          <p className="text-sm text-[#392d33] mb-3.5">
            <strong className="text-[#8f151d]">Step 2:</strong>{' '}
            Scan this QR code with the app
          </p>
          <div className="text-center bg-white p-5 rounded-[10px] border border-[#e6e8ee] min-h-60 flex items-center justify-center">
            {setup?.qrCodeUrl ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.qrCodeUrl)}`}
                alt="Scan this QR code"
                width={200}
                height={200}
                className="block mx-auto rounded-lg"
              />
            ) : (
              <div className="text-center">
                <p className="text-[#8f151d] text-sm mb-2">Failed to load QR code</p>
                <button
                  onClick={() => { setLoading(true); fetchSetup(localStorage.getItem('tempToken')); }}
                  className="text-[#8f151d] underline bg-transparent text-[0.8125rem] cursor-pointer"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Manual Entry Key */}
        <div className="border-[1.5px] border-[#e6e8ee] rounded-[10px] px-4 py-3.5 mb-3.5">
          <p className="text-[0.8125rem] text-[#392d33] mb-2.5">
            <strong>Can't scan?</strong> Enter this code manually:
          </p>
          <button
            onClick={copyCode}
            className="w-full flex items-center gap-2 bg-[#f8f8f8] border border-[#e6e8ee] rounded-md px-3 py-2.5 cursor-pointer hover:bg-[#f0f0f0] transition-colors text-left"
          >
            <code className="flex-1 text-[0.6875rem] font-mono break-all text-[#392d33] tracking-wide leading-relaxed">
              {setup?.manualEntryKey || '—'}
            </code>
            <span className="text-[#8f151d] text-base shrink-0">
              {copied ? <FiCheck /> : <FiCopy />}
            </span>
          </button>
          <p className={`text-[0.6875rem] text-center mt-1.5 ${copied ? 'text-[#236531] font-semibold' : 'text-[#aaa]'}`}>
            {copied ? 'Copied to clipboard!' : 'Click the code above to copy'}
          </p>
        </div>

        {/* Step 3 — Verify */}
        <form onSubmit={handleVerify}>
          <p className="text-sm text-[#392d33] mb-2.5">
            <strong className="text-[#8f151d]">Step 3:</strong>{' '}
            Enter the 6-digit code from the app
          </p>

          <input
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            required
            onFocus={(e) => e.target.style.borderColor = '#8f151d'}
            onBlur={(e) => e.target.style.borderColor = '#e6e8ee'}
            className="w-full py-3.5 border-2 border-[#e6e8ee] rounded-lg text-[1.75rem] text-center tracking-[0.85rem] font-black outline-none text-[#8f151d] mb-1.5 transition-colors box-border"
          />
          <p className="text-[0.6875rem] text-[#aaa] mb-4">Code changes every 30 seconds</p>

          <button
            type="submit"
            disabled={verifying || totpCode.length !== 6}
            className="w-full py-3.5 rounded-lg bg-[#8f151d] text-white font-bold text-[0.9375rem] hover:bg-[#761016] disabled:opacity-65 disabled:cursor-not-allowed transition-colors mb-3"
          >
            {verifying ? 'Verifying...' : 'Verify & Enable 2FA'}
          </button>
        </form>

        {/* Warning */}
        <div className="bg-[#fffbea] border-[1.5px] border-[#f0d060] rounded-lg px-4 py-3 mt-2 text-[0.8125rem] text-[#392d33] leading-relaxed">
          <strong>Important:</strong> You will need this app every time you log in. Keep it safe!
        </div>

        {/* Back */}
        <button
          onClick={() => navigate('/login')}
          className="w-full mt-3.5 flex items-center justify-center gap-1 bg-transparent text-[#aaa] text-[0.8125rem] cursor-pointer hover:text-[#8f151d] transition-colors py-2"
        >
          <FiArrowLeft /> Back to Login
        </button>
      </div>
    </main>
  );
};

export default TotpSetupPage;