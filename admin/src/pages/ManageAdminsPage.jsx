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
import * as ui from '../components/adminUI';

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
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Administration</span>
                        <h1 className={ui.headerTitle}>Manage Admins</h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowCreate(!showCreate)}
                        className={ui.adminActionGold}
                    >
                        <FiPlus />
                        Create Admin
                    </button>
                </header>

                {/* Create Form */}
                {showCreate && (
                    <section className="bg-white rounded-lg p-6 mb-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] border-t-4 border-gold">
                        <h2 className="m-0 mb-[1.1rem] text-maroon text-[1.05rem] font-black">Create New Admin</h2>
                        <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
                            <div>
                                <label className={ui.fieldLabel}>Full Name *</label>
                                <div className={ui.fieldInput}>
                                    <FiUser />
                                    <input
                                        type="text"
                                        placeholder="Enter full name"
                                        value={form.fullName}
                                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={ui.fieldLabel}>Username *</label>
                                <div className={ui.fieldInput}>
                                    <FiUser />
                                    <input
                                        type="text"
                                        placeholder="Enter username"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={ui.fieldLabel}>Email *</label>
                                <div className={ui.fieldInput}>
                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={ui.fieldLabel}>Phone Number</label>
                                <div className={ui.fieldInput}>
                                    <input
                                        type="text"
                                        placeholder="e.g. 09171234567"
                                        value={form.phoneNumber}
                                        onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={ui.fieldLabel}>Password *</label>
                                <div className={ui.fieldInput}>
                                    <FiLock />
                                    <input
                                        type="password"
                                        placeholder="Enter password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={ui.fieldLabel}>Role *</label>
                                <div className={ui.fieldInput}>
                                    <FiShield />
                                    <select
                                        value={form.role}
                                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                                        className="w-full border-0 outline-0 bg-transparent text-text-main text-[0.95rem]"
                                    >
                                        <option value="ADMIN">Admin</option>
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[0.6rem] mt-[1.1rem] max-[560px]:flex-col">
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="inline-flex items-center justify-center gap-[0.55rem] min-h-[2.65rem] px-6 rounded-lg bg-maroon text-white font-black text-[0.95rem] cursor-pointer transition-all hover:bg-maroon-dark hover:-translate-y-px hover:shadow-[0_10px_20px_rgba(111,47,60,0.22)]"
                            >
                                <FiCheck />
                                Create Admin
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="inline-flex items-center justify-center gap-[0.45rem] min-h-[2.65rem] px-6 rounded-lg bg-white text-maroon border-[1.5px] border-border-soft font-extrabold text-[0.88rem] cursor-pointer transition-colors hover:bg-page-bg hover:border-maroon-soft"
                            >
                                Cancel
                            </button>
                        </div>
                    </section>
                )}

                {/* Stats */}
                <section className={ui.statsGrid} aria-label="Admin summary">
                    {[
                        { label: 'Total Admins',  value: admins.length,                                          variant: 'maroon', Icon: FiUsers       },
                        { label: 'Super Admins',  value: admins.filter(a => a.role === 'SUPER_ADMIN').length,    variant: 'gold',   Icon: FiStar        },
                        { label: 'Active Admins', value: admins.filter(a => a.active).length,                    variant: 'green',  Icon: FiCheckCircle },
                    ].map((c) => (
                        <article key={c.label} className={ui.statCardVariant[c.variant]}>
                            <div>
                                <span className={ui.statLabel}>{c.label}</span>
                                <span className={ui.statValue}>{c.value}</span>
                            </div>
                            <span className={ui.statIconVariant[c.variant]}><c.Icon /></span>
                        </article>
                    ))}
                </section>

                {/* Admins Table */}
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiUsers />
                            All Admins
                            <span className={ui.countPill}>{admins.length} total</span>
                        </span>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    {[
                                        'ID', 'Full Name', 'Username', 'Email',
                                        'Phone', 'Role', 'Status', 'Last Login', 'Actions'
                                    ].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className={ui.loadingRow}>Loading...</td>
                                    </tr>
                                ) : admins.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className={ui.emptyRow}>No admins found.</td>
                                    </tr>
                                ) : admins.map((a) => (
                                    <tr key={a.id} className={ui.tableRow}>
                                        <td className={ui.tableTd}><strong>{a.id}</strong></td>
                                        <td className={`${ui.tableTd} font-black`}>{a.fullName}</td>
                                        <td className={`${ui.tableTd} ${ui.mono}`}>{a.username}</td>
                                        <td className={`${ui.tableTd} text-text-muted`}>{a.email || '—'}</td>
                                        <td className={`${ui.tableTd} text-text-muted`}>{a.phoneNumber || '—'}</td>
                                        <td className={ui.tableTd}>
                                            <span
                                                className={[
                                                    'inline-flex items-center gap-1 px-[0.7rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.02em]',
                                                    a.role === 'SUPER_ADMIN' ? 'bg-gold text-maroon' : 'bg-maroon/10 text-maroon',
                                                ].join(' ')}
                                            >
                                                {a.role === 'SUPER_ADMIN' ? <FiStar /> : <FiUser />}
                                                {a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                                            </span>
                                        </td>
                                        <td className={ui.tableTd}>
                                            <span className={a.active ? ui.statusPillSoftSuccess : ui.statusPillSoftDanger}>
                                                {a.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className={`${ui.tableTd} text-text-muted text-[0.78rem] whitespace-nowrap`}>
                                            {a.lastLogin
                                                ? new Date(a.lastLogin).toLocaleString('en-PH', {
                                                    month: 'short', day: 'numeric',
                                                    hour: '2-digit', minute: '2-digit',
                                                })
                                                : 'Never'}
                                        </td>
                                        <td className={ui.tableTd}>
                                            <div className="flex gap-[0.35rem]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(a.id, a.active)}
                                                    className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md text-white text-[0.78rem] font-black cursor-pointer"
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
                                                    className="inline-grid place-items-center min-h-8 px-[0.7rem] rounded-md bg-danger-muted text-white text-[0.85rem] font-black cursor-pointer"
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
