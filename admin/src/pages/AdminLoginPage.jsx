import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiLogIn, FiShield } from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';
import logo from '../assets/image/premier-logo.png';

const AdminLoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAdminAuth();
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            console.log('Logging in:', form.username);

            const res = await adminAPI.post('/auth/login', form);

            console.log('LOGIN SUCCESS:', {
                status: res.data.status,
                role: res.data.data.role,
                fullName: res.data.data.fullName,
                tokenPreview: res.data.data.token?.substring(0, 20) + '...'
            });

            const { token, fullName, username, role } = res.data.data;

            if (!token) {
                toast.error('No token received from server');
                return;
            }

            login(token, fullName, username, role);

            toast.success(`Welcome, ${fullName}! (${role})`);

            setTimeout(() => {
                window.location.href = '/admin/transactions';
            }, 800);

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

    return (
        <div className="min-h-screen grid place-items-center px-4 py-8 bg-[linear-gradient(135deg,#edf1f6_0%,#f8fafc_100%)]">
            <div className="grid grid-cols-[minmax(280px,1fr)_minmax(320px,1fr)] w-full max-w-240 min-h-140 overflow-hidden rounded-2xl bg-white shadow-[0_22px_52px_rgba(44,36,41,0.18)] max-[860px]:grid-cols-1">
                {/* Brand panel */}
                <div className="grid place-content-center p-8 text-white text-center bg-[linear-gradient(180deg,#6f2f3c_0%,#572631_100%)] max-[860px]:min-h-64">
                    <div>
                        <div className="w-[5.6rem] h-[5.6rem] mx-auto mb-[1.45rem] border-4 border-white/75 rounded-full bg-white grid place-items-center text-maroon font-black text-[1.6rem] tracking-wider overflow-hidden shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
                            <img src={logo} alt="Premier Transit" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <h1 className="m-0 text-[clamp(1.65rem,3vw,2.05rem)] font-black tracking-wider">PREMIER TRANSIT</h1>
                        <p className="mt-[0.9rem] mb-0 text-gold font-extrabold tracking-wider">Admin Panel</p>
                    </div>
                </div>

                {/* Form panel */}
                <div className="grid content-center p-[clamp(2rem,5vw,3.5rem)] bg-white">
                    <h2 className="m-0 text-maroon text-[clamp(1.55rem,3vw,1.9rem)] font-black">Welcome Back</h2>
                    <p className="mt-[0.2rem] mb-[1.8rem] text-text-muted text-[0.92rem]">
                        Sign in to manage your transit operations
                    </p>

                    <form onSubmit={handleLogin}>
                        <label htmlFor="admin-username" className="block mb-2 text-[#343946] font-extrabold text-[0.86rem]">
                            Username
                        </label>
                        <div className="flex items-center gap-[0.7rem] min-h-[3.1rem] mb-[1.15rem] px-[0.95rem] border-2 border-[#d9dce2] rounded-lg bg-white text-maroon transition-all focus-within:border-gold focus-within:shadow-[0_0_0_4px_rgba(232,189,71,0.18)]">
                            <FiUser />
                            <input
                                id="admin-username"
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="Enter your username"
                                required
                                className="w-full min-w-0 border-0 outline-0 bg-transparent text-text-main text-[0.95rem]"
                            />
                        </div>

                        <label htmlFor="admin-password" className="block mb-2 text-[#343946] font-extrabold text-[0.86rem]">
                            Password
                        </label>
                        <div className="flex items-center gap-[0.7rem] min-h-[3.1rem] mb-[1.15rem] px-[0.95rem] border-2 border-[#d9dce2] rounded-lg bg-white text-maroon transition-all focus-within:border-gold focus-within:shadow-[0_0_0_4px_rgba(232,189,71,0.18)]">
                            <FiLock />
                            <input
                                id="admin-password"
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Enter your password"
                                required
                                className="w-full min-w-0 border-0 outline-0 bg-transparent text-text-main text-[0.95rem]"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-[0.55rem] w-full min-h-[3.1rem] px-[1.2rem] rounded-lg bg-maroon text-white font-black text-[0.95rem] cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(111,47,60,0.22)] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:transform-none disabled:hover:bg-maroon"
                        >
                            <FiLogIn />
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <div className="inline-flex items-center justify-center gap-[0.4rem] mt-[1.6rem] text-text-muted text-[0.8rem]">
                        <FiShield className="text-maroon" />
                        Secure admin access · All actions are logged
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLoginPage;
