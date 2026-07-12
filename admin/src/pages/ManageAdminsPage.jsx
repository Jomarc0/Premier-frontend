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
    FiCreditCard,
    FiEdit2,
    FiMoreVertical,
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
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [actionMenu, setActionMenu] = useState(null);
    const [managementTab, setManagementTab] = useState('accounts');
    const [editForm, setEditForm] = useState({ fullName: '', email: '', phoneNumber: '', role: 'ADMIN', active: true });
    const [cashCards, setCashCards] = useState([]);
    const [capturingCard, setCapturingCard] = useState(false);
    const [registeringCard, setRegisteringCard] = useState(false);
    const [cardForm, setCardForm] = useState({ staffId: '', purpose: 'REGULAR_CASH', rfidUid: '' });
    const [form, setForm] = useState({
        username: '', password: '',
        fullName: '', email: '',
        phoneNumber: '', role: 'ADMIN'
    });

    useEffect(() => { fetchAdmins(); fetchCashCards(); }, []);

    const fetchCashCards = async () => {
        try {
            const res = await adminAPI.get('/staff-cash-cards');
            setCashCards(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load staff cash cards');
        }
    };

    const readCashCardUid = async () => {
        setCapturingCard(true);
        try {
            const startRes = await adminAPI.post('/rfid/uid-capture/start');
            const requestId = startRes.data?.data?.requestId;
            if (!requestId) throw new Error('Could not start RFID capture');
            toast.info('Tap the no-balance staff cash card on any online vehicle reader');

            let capturedUid = '';
            for (let attempt = 0; attempt < 30; attempt += 1) {
                await new Promise(resolve => window.setTimeout(resolve, 2000));
                const statusRes = await adminAPI.get(`/rfid/uid-capture/${requestId}`);
                const capture = statusRes.data?.data || {};
                if (capture.status === 'CAPTURED' && capture.rfidUid) {
                    capturedUid = capture.rfidUid;
                    break;
                }
                if (capture.status === 'EXPIRED') throw new Error('RFID capture expired. Please try again.');
            }
            if (!capturedUid) throw new Error('No RFID card was detected');
            setCardForm(current => ({ ...current, rfidUid: capturedUid }));
            toast.success('RFID UID captured. Review it, then register the card.');
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to read RFID UID');
        } finally {
            setCapturingCard(false);
        }
    };

    const registerCashCard = async () => {
        if (!cardForm.staffId) {
            toast.warning('Select a staff member first');
            return;
        }
        const rfidUid = cardForm.rfidUid.trim().toUpperCase().replaceAll(':', '').replaceAll(' ', '');
        if (rfidUid.length < 4) {
            toast.warning('Read or enter a valid RFID UID first');
            return;
        }
        setRegisteringCard(true);
        try {
            await adminAPI.post('/staff-cash-cards', {
                staffId: Number(cardForm.staffId),
                purpose: cardForm.purpose,
                rfidUid,
            });
            toast.success(`${cardForm.purpose === 'REGULAR_CASH' ? 'Regular' : 'Discounted'} cash card registered`);
            setCardForm(current => ({ ...current, rfidUid: '' }));
            fetchCashCards();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to register staff cash card');
        } finally {
            setRegisteringCard(false);
        }
    };

    const updateCashCardStatus = async (card, status) => {
        try {
            await adminAPI.patch(`/staff-cash-cards/${card.id}/status`, { status });
            toast.success('Cash card status updated');
            fetchCashCards();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update cash card');
        }
    };

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
            toast.success(form.role === 'STAFF' ? 'Staff account created successfully!' : 'Admin created successfully!');
            setShowCreate(false);
            setForm({
                username: '', password: '',
                fullName: '', email: '',
                phoneNumber: '', role: 'ADMIN'
            });
            fetchAdmins();
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Failed to create account');
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

    const openEditModal = (account) => {
        setEditingAdmin(account);
        setEditForm({
            fullName: account.fullName || '',
            email: account.email || '',
            phoneNumber: account.phoneNumber || '',
            role: account.role || 'ADMIN',
            active: Boolean(account.active),
        });
    };

    const handleEdit = async () => {
        if (!editForm.fullName.trim() || !editForm.email.trim()) {
            toast.warning('Full name and email are required');
            return;
        }
        try {
            await adminAPI.put(`/admins/${editingAdmin.id}`, editForm);
            toast.success('Account updated successfully');
            setEditingAdmin(null);
            fetchAdmins();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update account');
        }
    };

    const handleResetTotp = async (adminAccount) => {
        if (adminAccount.role === 'STAFF') {
            toast.info('Staff accounts do not use Google Authenticator');
            return;
        }

        const confirmed = window.confirm(
            `Reset Google Authenticator for ${adminAccount.username}? This lets the admin log in with username and password and set up a new authenticator.`
        );
        if (!confirmed) return;

        try {
            await adminAPI.put(`/admins/${adminAccount.id}/reset-totp`);
            toast.success('Google Authenticator reset');
            fetchAdmins();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset Google Authenticator');
        }
    };

    const openActionMenu = (event, account) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 245;
        setActionMenu({
            account,
            top: Math.min(rect.bottom + 6, window.innerHeight - 190),
            left: Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12)),
        });
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
                        onClick={() => setShowCreate(true)}
                        className={ui.adminActionGold}
                    >
                        <FiPlus />
                        Create Account
                    </button>
                </header>

                {/* Create Form */}
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="create-account-title" onMouseDown={() => setShowCreate(false)}>
                    <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border-t-4 border-gold bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)]" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="mb-[1.1rem] flex items-center justify-between gap-3">
                            <h2 id="create-account-title" className="m-0 text-maroon text-[1.05rem] font-black">Create New Admin or Staff</h2>
                            <button type="button" onClick={() => setShowCreate(false)} className="grid min-h-10 min-w-10 place-items-center rounded-lg text-maroon hover:bg-maroon/10" aria-label="Close create account modal"><FiX /></button>
                        </div>
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
                                        <option value="STAFF">Staff</option>
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
                                Create Account
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
                    </div>
                )}

                {editingAdmin && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-account-title" onMouseDown={() => setEditingAdmin(null)}>
                        <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border-t-4 border-gold bg-white p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)]" onMouseDown={(event) => event.stopPropagation()}>
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h2 id="edit-account-title" className="m-0 text-[1.1rem] font-black text-maroon">Edit Account</h2>
                                    <p className="mt-1 text-sm text-text-muted">Username: {editingAdmin.username}</p>
                                </div>
                                <button type="button" onClick={() => setEditingAdmin(null)} className="grid min-h-10 min-w-10 place-items-center rounded-lg text-maroon hover:bg-maroon/10" aria-label="Close edit account modal"><FiX /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
                                <div>
                                    <label className={ui.fieldLabel}>Full Name *</label>
                                    <div className={ui.fieldInput}><FiUser /><input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className={ui.fieldInputEl} /></div>
                                </div>
                                <div>
                                    <label className={ui.fieldLabel}>Email *</label>
                                    <div className={ui.fieldInput}><input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={ui.fieldInputEl} /></div>
                                </div>
                                <div>
                                    <label className={ui.fieldLabel}>Phone Number</label>
                                    <div className={ui.fieldInput}><input value={editForm.phoneNumber} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} className={ui.fieldInputEl} /></div>
                                </div>
                                <div>
                                    <label className={ui.fieldLabel}>Role</label>
                                    <div className={ui.fieldInput}><FiShield /><select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full border-0 bg-transparent text-[0.95rem] text-text-main outline-0"><option value="STAFF">Staff</option><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super Admin</option></select></div>
                                </div>
                                <label className="col-span-2 flex min-h-12 items-center gap-3 rounded-lg border border-border-soft px-4 font-bold text-text-main max-[680px]:col-span-1">
                                    <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} className="h-4 w-4 accent-maroon" /> Active account
                                </label>
                            </div>
                            <div className="mt-5 flex gap-3 max-[560px]:flex-col">
                                <button type="button" onClick={handleEdit} className="inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-lg bg-maroon px-6 font-black text-white"><FiCheck /> Save Changes</button>
                                <button type="button" onClick={() => setEditingAdmin(null)} className="min-h-[2.65rem] rounded-lg border border-border-soft bg-white px-6 font-black text-maroon">Cancel</button>
                            </div>
                        </section>
                    </div>
                )}

                {/* Stats */}
                <section className={ui.statsGrid} aria-label="Admin summary">
                    {[
                        { label: 'Total Accounts',  value: admins.length,                                          variant: 'maroon', Icon: FiUsers       },
                        { label: 'Super Admins',  value: admins.filter(a => a.role === 'SUPER_ADMIN').length,    variant: 'gold',   Icon: FiStar        },
                        { label: 'Staff Accounts', value: admins.filter(a => a.role === 'STAFF').length,                    variant: 'green',  Icon: FiCheckCircle },
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

                <nav className="mb-5 flex items-center gap-1 border-b border-border-soft bg-white px-3" aria-label="Account management sections">
                    <button
                        type="button"
                        onClick={() => { setManagementTab('accounts'); setActionMenu(null); }}
                        className={`relative inline-flex min-h-14 items-center gap-2 px-4 text-sm font-black transition ${managementTab === 'accounts' ? 'text-maroon after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-maroon' : 'text-text-muted hover:text-maroon'}`}
                    >
                        <FiUsers /> Accounts
                    </button>
                    <button
                        type="button"
                        onClick={() => { setManagementTab('cash-cards'); setActionMenu(null); }}
                        className={`relative inline-flex min-h-14 items-center gap-2 px-4 text-sm font-black transition ${managementTab === 'cash-cards' ? 'text-maroon after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-maroon' : 'text-text-muted hover:text-maroon'}`}
                    >
                        <FiCreditCard /> Staff Cash RFID Cards
                        <span className="rounded-full bg-gold px-2 py-0.5 text-[0.68rem] text-maroon">{cashCards.length}</span>
                    </button>
                </nav>

                {/* Admins Table */}
                {managementTab === 'accounts' && (
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiUsers />
                            Admin and Staff Accounts
                            <span className={ui.countPill}>{admins.length} total</span>
                        </span>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={`${ui.adminTable} min-w-[980px]`}>
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
                                        <td className={`${ui.tableTd} whitespace-nowrap font-black`}>{a.fullName}</td>
                                        <td className={`${ui.tableTd} ${ui.mono} whitespace-nowrap`}>{a.username}</td>
                                        <td className={`${ui.tableTd} whitespace-nowrap text-text-muted`}>{a.email || 'N/A'}</td>
                                        <td className={`${ui.tableTd} whitespace-nowrap text-text-muted`}>{a.phoneNumber || 'N/A'}</td>
                                        <td className={ui.tableTd}>
                                            <span
                                                className={[
                                                    'inline-flex items-center gap-1 whitespace-nowrap px-[0.7rem] py-[0.22rem] rounded-full text-[0.7rem] font-black tracking-[0.02em]',
                                                    a.role === 'SUPER_ADMIN' ? 'bg-gold text-maroon' : a.role === 'STAFF' ? 'bg-blue-100 text-blue-800' : 'bg-maroon/10 text-maroon',
                                                ].join(' ')}
                                            >
                                                {a.role === 'SUPER_ADMIN' ? <FiStar /> : <FiUser />}
                                                {a.role === 'SUPER_ADMIN' ? 'Super Admin' : a.role === 'STAFF' ? 'Staff' : 'Admin'}
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
                                            <div className="flex flex-nowrap items-center gap-[0.35rem]">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(a)}
                                                    className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-maroon/30 bg-white px-3 text-[0.78rem] font-black text-maroon transition hover:bg-maroon hover:text-white"
                                                    aria-label={`Edit ${a.fullName}`}
                                                    title={`Edit ${a.fullName}`}
                                                >
                                                    <FiEdit2 /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => openActionMenu(event, a)}
                                                    className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border-soft bg-white text-text-main transition hover:border-maroon hover:text-maroon"
                                                    aria-label={`More actions for ${a.fullName}`}
                                                    title={`More actions for ${a.fullName}`}
                                                >
                                                    <FiMoreVertical />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}

                {managementTab === 'accounts' && actionMenu && (
                    <>
                        <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={() => setActionMenu(null)} aria-label="Close account actions" />
                        <div className="fixed z-50 w-[245px] overflow-hidden rounded-xl border border-border-soft bg-white py-2 shadow-[0_18px_48px_rgba(35,24,29,0.22)]" style={{ top: actionMenu.top, left: actionMenu.left }} role="menu">
                            <button type="button" role="menuitem" onClick={() => { handleToggleActive(actionMenu.account.id, actionMenu.account.active); setActionMenu(null); }} className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-bold text-text-main hover:bg-page-bg">
                                {actionMenu.account.active ? <FiLock className="text-amber-600" /> : <FiUnlock className="text-green-700" />}
                                {actionMenu.account.active ? 'Deactivate Account' : 'Activate Account'}
                            </button>
                            {actionMenu.account.role !== 'STAFF' && (
                                <button type="button" role="menuitem" onClick={() => { handleResetTotp(actionMenu.account); setActionMenu(null); }} className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-bold text-text-main hover:bg-page-bg">
                                    <FiShield className="text-maroon" /> Reset Google Authenticator
                                </button>
                            )}
                            <div className="my-1 border-t border-border-soft" />
                            <button type="button" role="menuitem" onClick={() => { handleDelete(actionMenu.account.id); setActionMenu(null); }} className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-black text-danger-muted hover:bg-red-50">
                                <FiTrash2 /> Delete Account
                            </button>
                        </div>
                    </>
                )}

                {managementTab === 'cash-cards' && (
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiCreditCard />
                            Staff Cash RFID Cards
                            <span className={ui.countPill}>{cashCards.length} registered</span>
                        </span>
                    </div>
                    <div className="border-b border-border-soft p-5">
                    <div className="grid grid-cols-2 gap-3 max-[860px]:grid-cols-1">
                        <div>
                            <label className={ui.fieldLabel}>Staff member</label>
                            <select value={cardForm.staffId} onChange={(e) => setCardForm({ ...cardForm, staffId: e.target.value })} className="min-h-11 w-full rounded-lg border border-border-soft bg-white px-3 font-bold text-text-main">
                                <option value="">Select staff</option>
                                {admins.filter(a => a.role === 'STAFF' && a.active).map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={ui.fieldLabel}>Card purpose</label>
                            <select value={cardForm.purpose} onChange={(e) => setCardForm({ ...cardForm, purpose: e.target.value })} className="min-h-11 w-full rounded-lg border border-border-soft bg-white px-3 font-bold text-text-main">
                                <option value="REGULAR_CASH">Regular Cash</option>
                                <option value="DISCOUNTED_CASH">Discounted Cash</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-[minmax(260px,1fr)_160px_180px] items-end gap-3 max-[860px]:grid-cols-1">
                        <div>
                            <label className={ui.fieldLabel}>Staff Cash RFID UID</label>
                            <div className={`${ui.fieldInput} mb-0`}>
                                <FiCreditCard />
                                <input
                                    type="text"
                                    value={cardForm.rfidUid}
                                    onChange={(e) => setCardForm({ ...cardForm, rfidUid: e.target.value.toUpperCase() })}
                                    placeholder="Click Read UID, then tap the staff RFID card"
                                    className={ui.fieldInputEl}
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                        <button type="button" disabled={capturingCard || registeringCard} onClick={readCashCardUid} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-maroon bg-white px-5 font-black text-maroon disabled:opacity-60">
                            <FiCreditCard /> {capturingCard ? 'Waiting for tap...' : 'Read UID'}
                        </button>
                        <button type="button" disabled={capturingCard || registeringCard} onClick={registerCashCard} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-maroon px-5 font-black text-white disabled:opacity-60">
                            <FiCheck /> {registeringCard ? 'Registering...' : 'Register Card'}
                        </button>
                    </div>
                    </div>
                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead><tr>{['Staff', 'Purpose', 'RFID UID', 'Status', 'Registered', 'Action'].map(h => <th key={h} className={ui.tableTh}>{h}</th>)}</tr></thead>
                            <tbody>
                                {cashCards.length ? cashCards.map(card => (
                                    <tr key={card.id} className={ui.tableRow}>
                                        <td className={`${ui.tableTd} font-black`}>{card.staffName}</td>
                                        <td className={ui.tableTd}>{card.purpose === 'REGULAR_CASH' ? 'Regular Cash' : 'Discounted Cash'}</td>
                                        <td className={`${ui.tableTd} ${ui.mono}`}>{card.maskedRfidUid}</td>
                                        <td className={ui.tableTd}><span className={card.status === 'ACTIVE' ? ui.statusPillSoftSuccess : ui.statusPillSoftDanger}>{card.status}</span></td>
                                        <td className={ui.tableTd}>{new Date(card.registeredAt).toLocaleString('en-PH')}</td>
                                        <td className={ui.tableTd}>
                                            <button type="button" onClick={() => updateCashCardStatus(card, card.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE')} className="min-h-8 rounded-md bg-maroon px-3 text-xs font-black text-white">
                                                {card.status === 'ACTIVE' ? 'Block' : 'Activate'}
                                            </button>
                                        </td>
                                    </tr>
                                )) : <tr><td colSpan={6} className={ui.emptyRow}>No staff cash cards registered.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}
            </main>
        </div>
    );
};

export default ManageAdminsPage;

