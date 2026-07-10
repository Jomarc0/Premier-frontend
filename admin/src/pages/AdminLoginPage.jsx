import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiLogIn, FiShield, FiUser } from 'react-icons/fi';
import TotpVerify from '@/components/auth/TotpVerify';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';
import BrandLogo from '../components/auth/BrandLogo';
import PasswordInput from '../components/auth/PasswordInput';
import { BRAND_NAME } from '../constants/brand';

const TotpNotice = ({ message, onClose }) => {
    useEffect(() => {
        const timer = window.setTimeout(onClose, 4500);
        return () => window.clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed right-4 top-4 z-50 flex max-w-xs items-start gap-3 rounded-lg border border-border-input bg-white px-4 py-3 text-text-heading shadow-lg">
            <FiShield className="mt-0.5 shrink-0 text-brand-primary" />
            <p className="text-sm font-semibold leading-snug">{message}</p>
            <button
                type="button"
                onClick={onClose}
                className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded text-text-body transition-colors hover:bg-brand-primary/10 hover:text-brand-primary"
                aria-label="Close notification"
            >
                ×
            </button>
        </div>
    );
};

const AdminLoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAdminAuth();
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [totpRequired, setTotpRequired] = useState(false);
    const [challengeName, setChallengeName] = useState('');
    const [showTotpNotice, setShowTotpNotice] = useState(false);

    const adminName = challengeName || form.username;

    const finishLogin = (loginData) => {
        const { token, fullName, username, role, is2FaEnabled } = loginData;

        if (!token) {
            toast.error('No token received from server');
            return;
        }

        login(token, fullName, username, role);

        const needsTotpSetup = role !== 'STAFF' && !is2FaEnabled;
        navigate(needsTotpSetup ? '/admin/security' : '/admin/analytics', { replace: true });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await adminAPI.post('/auth/login', form);
            const loginData = res.data?.data || {};

            if (loginData.requiresTotp && !loginData.token) {
                setTotpRequired(true);
                setChallengeName(loginData.fullName || loginData.username || form.username);
                setShowTotpNotice(true);
                return;
            }

            finishLogin(loginData);
        } catch (err) {
            console.error('LOGIN ERROR:', {
                status: err.response?.status,
                message: err.response?.data?.message || err.message
            });
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (code) => {
        try {
            const res = await adminAPI.post('/auth/login', {
                username: form.username,
                password: form.password,
                totpCode: code
            });
            finishLogin(res.data?.data || {});
        } catch (err) {
            console.error('TOTP VERIFY ERROR:', {
                status: err.response?.status,
                message: err.response?.data?.message || err.message
            });
            toast.error(err.response?.data?.message || 'Verification failed');
            throw err;
        }
    };

    const handleBackToLogin = () => {
        setTotpRequired(false);
        setChallengeName('');
        setShowTotpNotice(false);
    };

    if (totpRequired) {
        return (
            <>
                {showTotpNotice && (
                    <TotpNotice
                        message="Enter your Google Authenticator code to continue"
                        onClose={() => setShowTotpNotice(false)}
                    />
                )}

                <TotpVerify
                    mode="login"
                    title="Verify Admin Access"
                    subtitle={`Enter the 6-digit code from Google Authenticator for ${adminName}.`}
                    onVerify={(code) => handleVerify(code)}
                    topSlot={
                        <button
                            type="button"
                            onClick={handleBackToLogin}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/15"
                        >
                            <FiArrowLeft />
                            Back
                        </button>
                    }
                    footerSlot={
                        <p className="text-center text-sm text-text-body">
                            Lost access to your authenticator?{' '}
                            <button
                                type="button"
                                className="font-semibold text-brand-primary hover:underline"
                            >
                                Contact system administrator
                            </button>
                        </p>
                    }
                />
            </>
        );
    }

    return (
        <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#edf1f6_0%,#f8fafc_100%)] px-4 py-8">
            <div className="grid min-h-140 w-full max-w-240 grid-cols-[minmax(280px,1fr)_minmax(320px,1fr)] overflow-hidden rounded-2xl bg-white shadow-[0_22px_52px_rgba(44,36,41,0.18)] max-[860px]:grid-cols-1">
                <div className="grid place-content-center bg-brand-primary p-8 text-center text-white max-[860px]:min-h-64">
                    <div>
                        <BrandLogo />
                        <h1 className="m-0 text-[clamp(1.65rem,3vw,2.05rem)] font-black tracking-wider">{BRAND_NAME}</h1>
                        <p className="mt-[0.9rem] mb-0 font-extrabold tracking-wider text-brand-accent">Admin Panel</p>
                    </div>
                </div>

                <div className="grid content-center bg-white p-[clamp(2rem,5vw,3.5rem)]">
                    <h2 className="m-0 text-[clamp(1.55rem,3vw,1.9rem)] font-black text-brand-primary">
                        Welcome Back
                    </h2>
                    <p className="mt-[0.2rem] mb-[1.8rem] text-[0.92rem] text-text-muted">
                        Sign in to manage your transit operations
                    </p>

                    <form onSubmit={handleLogin}>
                        <label htmlFor="admin-username" className="mb-2 block text-[0.86rem] font-extrabold text-[#343946]">
                            Username
                        </label>
                        <div className="mb-[1.15rem] flex min-h-[3.1rem] items-center gap-[0.7rem] rounded-lg border-2 border-border-input bg-white px-[0.95rem] text-brand-primary transition-all focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(92,32,40,0.14)]">
                            <FiUser />
                            <input
                                id="admin-username"
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="Enter your username"
                                required
                                className="w-full min-w-0 border-0 bg-transparent text-[0.95rem] text-text-heading outline-0 placeholder:text-text-placeholder"
                            />
                        </div>

                        <label htmlFor="admin-password" className="mb-2 block text-[0.86rem] font-extrabold text-[#343946]">
                            Password
                        </label>
                        <PasswordInput
                            id="admin-password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Enter your password"
                            required
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex min-h-[3.1rem] w-full cursor-pointer items-center justify-center gap-[0.55rem] rounded-lg bg-brand-primary px-[1.2rem] text-[0.95rem] font-black text-white transition-all hover:-translate-y-px hover:bg-brand-primary-dark hover:shadow-[0_10px_20px_rgba(92,32,40,0.22)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0 disabled:hover:bg-brand-primary"
                        >
                            <FiLogIn />
                            {loading ? 'Please wait...' : 'Log In'}
                        </button>
                    </form>

                    <div className="mt-[1.6rem] inline-flex items-center justify-center gap-[0.4rem] text-[0.8rem] text-text-muted">
                        <FiShield className="text-brand-primary" />
                        Secure admin access - Google Authenticator supported
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLoginPage;
