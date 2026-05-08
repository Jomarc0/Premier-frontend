import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCreditCard, FiLogIn } from 'react-icons/fi';

const LoginPage = () => {
  const navigate = useNavigate();
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8080/api/passenger/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      const { tempToken, requireSetup } = data.data;

      if (!tempToken) {
        toast.error('Login failed: no session token received.');
        return;
      }

      localStorage.setItem('tempToken', tempToken);

      if (requireSetup) {
        toast.info('Please set up Google Authenticator');
        navigate('/totp-setup');
      } else {
        toast.info('Enter your Google Authenticator code');
        navigate('/verify-totp');
      }
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center px-4 py-8 bg-linear-to-br from-[#edf1f6] to-[#f8fafc]">
      <section className="w-full max-w-105 px-7 pt-11 pb-8 rounded-lg bg-white shadow-[0_18px_42px_rgba(44,36,41,0.14)] text-center">

        {/* Logo */}
        <div className="w-16 h-16 rounded-full bg-[#8f151d] border-[3px] border-[#f2f3f5] flex items-center justify-center mx-auto mb-5 shadow-[0_8px_18px_rgba(70,60,65,0.12)]">
          <span className="text-white font-black text-lg">PT</span>
        </div>

        <h1 className="text-[#8f151d] font-black text-[clamp(1.35rem,4vw,1.65rem)] tracking-wide m-0">
          PREMIER TRANSIT
        </h1>
        <p className="text-[#68717d] text-base mt-2 mb-8">Safe Travel for Everyone</p>
        <h2 className="text-[#8f151d] font-extrabold text-lg mb-6">Welcome Back</h2>

        <form onSubmit={handleLogin} className="text-left">

          <label htmlFor="cardNumber" className="block text-sm font-extrabold text-[#434854] mb-2">
            Card Number / ID Number
          </label>

          {/* Input with icon */}
          <div className="flex items-center gap-2.5 min-h-[3.45rem] px-3.5 rounded-lg border-2 border-[#d9dce2] bg-white text-[#a5abb5] focus-within:border-[#8f151d] transition-colors mb-2">
            <FiCreditCard className="text-lg shrink-0" />
            <input
              id="cardNumber"
              type="text"
              placeholder="1234567890"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              required
              className="w-full border-0 outline-none bg-transparent text-[#392d33] text-[1.05rem]"
            />
          </div>

          <p className="text-[#6d747e] text-[0.92rem] mt-2 mb-5">
            Find this number on your Premier Transit card
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[3.2rem] rounded-lg bg-[#8f151d] text-white font-extrabold hover:bg-[#761016] hover:shadow-[0_10px_20px_rgba(143,21,29,0.25)] hover:-translate-y-px disabled:opacity-65 disabled:cursor-not-allowed transition-all"
          >
            <FiLogIn className="text-lg" />
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-6 mb-1.5 text-[#717680]">Need help with your Card Number?</p>
        <a href="tel:+1234567890" className="text-[#f4c84d] font-black">
          Call Support: (123) 456-7890
        </a>

        <footer className="mt-7 text-[#868c96] text-sm">
          © 2026 Premier Class 3 Transport Corp. | Safe and Secure Access
        </footer>
      </section>
    </main>
  );
};

export default LoginPage;