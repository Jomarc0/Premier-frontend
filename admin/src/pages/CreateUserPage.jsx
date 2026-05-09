import { useState } from 'react';
import {
    FiRefreshCw,
    FiUserPlus,
    FiCheckCircle,
    FiCreditCard,
    FiWifi,
    FiDollarSign,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';

const generateCardNumber = () =>
    Math.floor(1000000000 + Math.random() * 9000000000).toString();

const CreateUserPage = () => {
    const [cardNumber, setCardNumber] = useState(generateCardNumber());
    const [form, setForm] = useState({
        rfidUid: '',
        initialBalance: '0.00',
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!form.rfidUid) {
            toast.warning('RFID Card UID is required');
            return;
        }
        setLoading(true);
        try {
            const res = await adminAPI.post('/users/create', {
                cardNumber: cardNumber,
                rfidUid: form.rfidUid,
                initialBalance: parseFloat(form.initialBalance) || 0,
            });
            toast.success('User account created!');
            setRecentUsers(prev => [res.data.data, ...prev]);
            setCardNumber(generateCardNumber()); //
            setForm({ rfidUid: '', initialBalance: '0.00' });
        } catch (err) {
            toast.error(
                err.response?.data?.message || 'Failed to create user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <div className={ui.centerColumn}>
                    <header className={ui.headerBar}>
                        <div>
                            <span className={ui.eyebrow}>User Management</span>
                            <h1 className={ui.headerTitle}>Create New User</h1>
                        </div>
                    </header>

                    <div className={ui.formCard}>
                        {/* Auto-Generated Card Number */}
                        <div className="bg-maroon rounded-lg p-[1.4rem] text-center mb-6 border-2 border-gold">
                            <div className="text-white/75 text-[0.78rem] font-extrabold uppercase tracking-wider mb-[0.4rem]">
                                Generated Card Number
                            </div>
                            <div className={`text-white font-black text-[1.7rem] tracking-[0.12em] mb-[0.85rem] ${ui.mono}`}>
                                {cardNumber}
                            </div>
                            <button
                                type="button"
                                onClick={() => setCardNumber(generateCardNumber())}
                                className="inline-flex items-center gap-[0.4rem] bg-gold text-maroon rounded-md px-[1.1rem] py-2 font-black text-[0.82rem] cursor-pointer transition-colors hover:bg-[#f3cc6a]"
                            >
                                <FiRefreshCw />
                                Generate New
                            </button>
                        </div>

                        {/* RFID UID */}
                        <div className="mb-[1.05rem]">
                            <label className={ui.fieldLabel} htmlFor="rfid-uid">
                                RFID Card UID *
                            </label>
                            <div className="flex gap-[0.6rem] max-[560px]:flex-col">
                                <div className={`${ui.fieldInput} flex-1 mb-0`}>
                                    <FiCreditCard />
                                    <input
                                        id="rfid-uid"
                                        type="text"
                                        placeholder="e.g. A1B2C3D4"
                                        value={form.rfidUid}
                                        onChange={(e) => setForm({
                                            ...form, rfidUid: e.target.value
                                        })}
                                        className={ui.fieldInputEl}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-[0.4rem] px-4 rounded-lg bg-maroon text-white font-black text-[0.82rem] whitespace-nowrap cursor-pointer hover:bg-maroon-dark max-[560px]:w-full max-[560px]:min-h-[2.85rem] max-[560px]:justify-center"
                                >
                                    <FiWifi />
                                    Scan RFID
                                </button>
                            </div>
                            <div className="mt-[0.35rem] text-[0.74rem] text-text-muted">
                                The unique UID from the RFID chip
                            </div>
                        </div>

                        {/* Initial Balance */}
                        <div className="mb-[1.05rem]">
                            <label className={ui.fieldLabel} htmlFor="initial-balance">
                                Initial Balance (₱)
                            </label>
                            <div className={ui.fieldInput}>
                                <FiDollarSign />
                                <input
                                    id="initial-balance"
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    value={form.initialBalance}
                                    onChange={(e) => setForm({
                                        ...form,
                                        initialBalance: e.target.value
                                    })}
                                    className={ui.fieldInputEl}
                                />
                            </div>
                            <div className="mt-[0.35rem] text-[0.74rem] text-text-muted">
                                Optional: Set an initial balance
                            </div>
                        </div>

                        {/* Create Button */}
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={loading}
                            className={ui.primaryButton}
                        >
                            <FiUserPlus />
                            {loading ? 'Creating...' : 'Create User Account'}
                        </button>

                        {/* Reset Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setForm({
                                    rfidUid: '',
                                    initialBalance: '0.00',
                                });
                                setCardNumber(generateCardNumber());
                            }}
                            className={ui.secondaryButton}
                        >
                            <FiRefreshCw />
                            Reset Form
                        </button>

                        {/* Recently Created */}
                        {recentUsers.length > 0 && (
                            <div className="mt-6">
                                <div className="font-black text-[0.92rem] mb-3 text-maroon">Recently Created Users</div>
                                {recentUsers.map((u, i) => (
                                    <div key={i} className="bg-[#f0fbf3] border border-[#c8e6c9] border-l-4 border-l-green-brand rounded-lg px-[0.9rem] py-3 mb-2 text-[0.82rem]">
                                        <div className="font-black text-green-brand mb-[0.4rem] inline-flex items-center gap-[0.35rem]">
                                            <FiCheckCircle />
                                            Created Successfully
                                        </div>
                                        <div className="text-text-main mt-[0.15rem]">
                                            Card No: <strong>{u.cardNumber || '—'}</strong>
                                        </div>
                                        <div className="text-text-main mt-[0.15rem]">
                                            RFID: <strong>{u.rfidUid || '—'}</strong>
                                        </div>
                                        <div className="text-text-main mt-[0.15rem]">
                                            Balance:{' '}
                                            <strong className={ui.balancePositive}>
                                                ₱{parseFloat(u.balance || 0).toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CreateUserPage;
