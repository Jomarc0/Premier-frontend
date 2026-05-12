import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { FiLock, FiCheck, FiArrowLeft } from 'react-icons/fi';

const TotpVerifyPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [totpCode, setTotpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const tempToken = localStorage.getItem('tempToken');
    if (!tempToken) {
      toast.error('Session expired. Please login again.');
      navigate('/login');
    }
  }, [navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (totpCode.length !== 6) { toast.warning('Enter your 6-digit code'); return; }

    setVerifying(true);
    try {
      const tempToken = localStorage.getItem('tempToken');
      if (!tempToken) {
        toast.error('Session expired. Please login again.');
        navigate('/login');
        return;
      }

      const res = await fetch('http://localhost:8080/api/passenger/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, totpCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');

      const { token, passengerName } = data.data;
      login(token, passengerName);
      localStorage.removeItem('tempToken');

      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Wrong code. Please try again.');
      setTotpCode('');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 bg-linear-to-br from-[#edf1f6] to-[#f8fafc]">
      <section className="w-full max-w-105 px-10 py-10 rounded-lg bg-white shadow-[0_18px_42px_rgba(44,36,41,0.14)] text-center">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[#8f151d] flex items-center justify-center mx-auto mb-5 shadow-[0_10px_25px_rgba(143,21,29,0.3)]">
          <FiLock className="text-white text-[1.9rem]" />
        </div>

        <h2 className="text-[1.5rem] font-black mb-2 text-[#8f151d]">
          Two-Factor Authentication
        </h2>
        <p className="text-[#717680] text-sm mb-8">
          Enter the code from your authenticator app
        </p>

        <form onSubmit={handleVerify}>
          <label className="block text-left text-sm font-semibold text-[#434854] mb-2">
            Authentication Code
          </label>

          <input
            type="text"
            inputMode="numeric"
            placeholder="000 000"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
            className="w-full text-center text-[2.5rem] font-black tracking-[0.5rem] py-5 border-2 border-[#8f151d] rounded-lg outline-none text-[#8f151d] mb-2 focus:border-[#761016] transition-colors"
          />

          <p className="text-xs text-left text-[#717680] mb-6">
            Enter the 6-digit code from Google Authenticator
          </p>

          <button
            type="submit"
            disabled={verifying || totpCode.length !== 6}
            className="w-full py-4 rounded-lg text-white font-bold text-base flex items-center justify-center gap-2 mb-5 bg-[#8f151d] hover:bg-[#761016] disabled:bg-[#a5212a] disabled:opacity-65 disabled:cursor-not-allowed transition-colors"
          >
            <FiCheck className="text-lg" />
            {verifying ? 'Verifying...' : 'Verify & Login'}
          </button>
        </form>

        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-1 mx-auto mb-6 text-sm font-medium text-[#8f151d] bg-transparent cursor-pointer hover:text-[#761016] transition-colors"
        >
          <FiArrowLeft className="text-base" /> Back to Login
        </button>

        <div className="border-t border-[#e6e8ee] pt-4">
          <p className="text-xs text-[#717680] mb-1">Lost access to your authenticator?</p>
          <a
            href="tel:+1234567890"
            className="font-bold text-sm underline text-[#8f151d]"
          >
            Contact Support: (123) 456-7890
          </a>
        </div>
      </section>
    </main>
  );
};

export default TotpVerifyPage;