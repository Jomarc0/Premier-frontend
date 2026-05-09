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
        <div className="admin-login-page">
            <div className="admin-login-shell">
            {/* Brand panel */}
            <div className="admin-login-brand">
                <div>
                    <div className="brand-circle">
                        <img src={logo} alt="Premier Transit" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    </div>
                    <h1>PREMIER TRANSIT</h1>
                    <p>Admin Panel</p>
                </div>
            </div>

                {/* Form panel */}
                <div className="admin-login-form-panel">
                    <h2>Welcome Back</h2>
                    <p className="subtitle">
                        Sign in to manage your transit operations
                    </p>

                    <form onSubmit={handleLogin}>
                        <label htmlFor="admin-username" className="field-label">
                            Username
                        </label>
                        <div className="field-input">
                            <FiUser />
                            <input
                                id="admin-username"
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="Enter your username"
                                required
                            />
                        </div>

                        <label htmlFor="admin-password" className="field-label">
                            Password
                        </label>
                        <div className="field-input">
                            <FiLock />
                            <input
                                id="admin-password"
                                type="password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="primary-button"
                        >
                            <FiLogIn />
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>

                    <div className="secure-note">
                        <FiShield />
                        Secure admin access · All actions are logged
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLoginPage;
