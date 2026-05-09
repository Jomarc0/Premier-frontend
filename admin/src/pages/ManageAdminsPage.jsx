import { useEffect, useState } from 'react';
import {
    FiUsers,
    FiPlus,
    FiCheck,
    FiX,
    FiTrash2,
    FiLock,
    FiUnlock,
    FiShield,
    FiUser,
    FiStar,
    FiCheckCircle,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { useAdminAuth } from '../context/AdminAuthContext';
import { toast } from 'react-toastify';

const ManageAdminsPage = () => {
    const { isSuperAdmin } = useAdminAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        username: '', password: '',
        fullName: '', email: '',
        phoneNumber: '', role: 'ADMIN'
    });

    useEffect(() => { fetchAdmins(); }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.get('/admins');
            setAdmins(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load admins');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.username || !form.password ||
            !form.fullName || !form.email) {
            toast.warning('Please fill all required fields');
            return;
        }
        try {
            await adminAPI.post('/admins/create', form);
            toast.success('Admin created successfully!');
            setShowCreate(false);
            setForm({
                username: '', password: '',
                fullName: '', email: '',
                phoneNumber: '', role: 'ADMIN'
            });
            fetchAdmins();
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Failed to create admin');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(
            'Are you sure you want to delete this admin?'))
            return;
        try {
            await adminAPI.delete(`/admins/${id}`);
            toast.success('Admin deleted');
            fetchAdmins();
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Failed');
        }
    };

    const handleToggleActive = async (id, active) => {
        try {
            await adminAPI.put(`/admins/${id}`, {
                active: !active
            });
            toast.success(
                !active ? 'Admin activated' : 'Admin deactivated');
            fetchAdmins();
        } catch (err) {
            toast.error('Failed to update admin');
        }
    };

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Administration</span>
                        <h1>Manage Admins</h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreate(!showCreate)}
                        className="admin-action gold"
                    >
                        <FiPlus />
                        Create Admin
                    </button>
                </header>

                {/* Create Form */}
                {showCreate && (
                    <section className="inline-create-card">
                        <h2>Create New Admin</h2>
                        <div className="form-grid-2">
                            <div>
                                <label className="field-label">Full Name *</label>
                                <div className="field-input">
                                    <FiUser />
                                    <input
                                        type="text"
                                        placeholder="Enter full name"
                                        value={form.fullName}
                                        onChange={(e) => setForm({
                                            ...form,
                                            fullName: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="field-label">Username *</label>
                                <div className="field-input">
                                    <FiUser />
                                    <input
                                        type="text"
                                        placeholder="Enter username"
                                        value={form.username}
                                        onChange={(e) => setForm({
                                            ...form,
                                            username: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="field-label">Email *</label>
                                <div className="field-input">
                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        value={form.email}
                                        onChange={(e) => setForm({
                                            ...form,
                                            email: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="field-label">Phone Number</label>
                                <div className="field-input">
                                    <input
                                        type="text"
                                        placeholder="e.g. 09171234567"
                                        value={form.phoneNumber}
                                        onChange={(e) => setForm({
                                            ...form,
                                            phoneNumber: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="field-label">Password *</label>
                                <div className="field-input">
                                    <FiLock />
                                    <input
                                        type="password"
                                        placeholder="Enter password"
                                        value={form.password}
                                        onChange={(e) => setForm({
                                            ...form,
                                            password: e.target.value
                                        })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="field-label">Role *</label>
                                <div className="field-input">
                                    <FiShield />
                                    <select
                                        value={form.role}
                                        onChange={(e) => setForm({
                                            ...form, role: e.target.value
                                        })}
                                        style={{
                                            width: '100%', border: 0, outline: 0,
                                            background: 'transparent', color: 'var(--text-main)',
                                            fontSize: '0.95rem',
                                        }}
                                    >
                                        <option value="ADMIN">Admin</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="primary-button"
                                style={{ width: 'auto', minHeight: '2.65rem', padding: '0 1.5rem' }}
                            >
                                <FiCheck />
                                Create Admin
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="secondary-button"
                                style={{ width: 'auto', minHeight: '2.65rem', padding: '0 1.5rem', marginTop: 0 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </section>
                )}

                {/* Stats */}
                <section className="admin-stats" aria-label="Admin summary">
                    {[
                        {
                            label: 'Total Admins',
                            value: admins.length,
                            variant: 'maroon', Icon: FiUsers,
                        },
                        {
                            label: 'Super Admins',
                            value: admins.filter(a => a.role === 'SUPER_ADMIN').length,
                            variant: 'gold', Icon: FiStar,
                        },
                        {
                            label: 'Active Admins',
                            value: admins.filter(a => a.active).length,
                            variant: 'green', Icon: FiCheckCircle,
                        },
                    ].map((c) => (
                        <article key={c.label} className={`stat-card ${c.variant}`}>
                            <div>
                                <span className="stat-label">{c.label}</span>
                                <span className="stat-value">{c.value}</span>
                            </div>
                            <span className="stat-icon"><c.Icon /></span>
                        </article>
                    ))}
                </section>

                {/* Admins Table */}
                <section className="data-panel">
                    <div className="data-panel-header">
                        <span className="data-panel-title">
                            <FiUsers />
                            All Admins
                            <span className="count-pill">{admins.length} total</span>
                        </span>
                    </div>

                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    {[
                                        'ID', 'Full Name',
                                        'Username', 'Email',
                                        'Phone', 'Role',
                                        'Status', 'Last Login',
                                        'Actions'
                                    ].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="loading-row">Loading...</td>
                                    </tr>
                                ) : admins.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="empty-row">No admins found.</td>
                                    </tr>
                                ) : admins.map((a) => (
                                    <tr key={a.id}>
                                        <td><strong>{a.id}</strong></td>
                                        <td style={{ fontWeight: 850 }}>{a.fullName}</td>
                                        <td className="mono">{a.username}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{a.email || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{a.phoneNumber || '—'}</td>
                                        <td>
                                            <span className={`role-badge ${a.role === 'SUPER_ADMIN' ? 'super' : 'admin'}`}>
                                                {a.role === 'SUPER_ADMIN' ? <FiStar /> : <FiUser />}
                                                {a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-pill-soft ${a.active ? 'success' : 'danger'}`}>
                                                {a.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                            {a.lastLogin
                                                ? new Date(a.lastLogin).toLocaleString('en-PH', {
                                                    month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })
                                                : 'Never'}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(a.id, a.active)}
                                                    className="add-balance-btn"
                                                    style={{
                                                        background: a.active ? '#d97706' : 'var(--brand-green)',
                                                    }}
                                                >
                                                    {a.active ? <FiLock /> : <FiUnlock />}
                                                    {a.active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(a.id)}
                                                    className="icon-btn danger"
                                                    style={{ minHeight: '2rem', padding: '0 0.7rem' }}
                                                    aria-label="Delete admin"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ManageAdminsPage;
