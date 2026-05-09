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
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">
                <div className="center-column">
                    <header className="admin-header admin-plain-header">
                        <div>
                            <span className="eyebrow">User Management</span>
                            <h1>Create New User</h1>
                        </div>
                    </header>

                    <div className="form-card">
                        {/* Auto-Generated Card Number */}
                        <div className="generated-id-card">
                            <div className="label">Generated Card Number</div>
                            <div className="value">{cardNumber}</div>
                            <button
                                type="button"
                                onClick={() => setCardNumber(generateCardNumber())}
                            >
                                <FiRefreshCw />
                                Generate New
                            </button>
                        </div>

                        {/* RFID UID */}
                        <div className="field-block">
                            <label className="field-label" htmlFor="rfid-uid">
                                RFID Card UID *
                            </label>
                            <div className="field-with-action">
                                <div className="field-input">
                                    <FiCreditCard />
                                    <input
                                        id="rfid-uid"
                                        type="text"
                                        placeholder="e.g. A1B2C3D4"
                                        value={form.rfidUid}
                                        onChange={(e) => setForm({
                                            ...form, rfidUid: e.target.value
                                        })}
                                    />
                                </div>
                                <button type="button" className="field-action-btn">
                                    <FiWifi />
                                    Scan RFID
                                </button>
                            </div>
                            <div className="field-help">
                                The unique UID from the RFID chip
                            </div>
                        </div>

                        {/* Initial Balance */}
                        <div className="field-block">
                            <label className="field-label" htmlFor="initial-balance">
                                Initial Balance (₱)
                            </label>
                            <div className="field-input">
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
                                />
                            </div>
                            <div className="field-help">
                                Optional: Set an initial balance
                            </div>
                        </div>

                        {/* Create Button */}
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={loading}
                            className="primary-button"
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
                            className="secondary-button"
                        >
                            <FiRefreshCw />
                            Reset Form
                        </button>

                        {/* Recently Created */}
                        {recentUsers.length > 0 && (
                            <div className="recent-list">
                                <div className="heading">Recently Created Users</div>
                                {recentUsers.map((u, i) => (
                                    <div key={i} className="recent-item">
                                        <div className="ok">
                                            <FiCheckCircle />
                                            Created Successfully
                                        </div>
                                        <div className="row">
                                            Card No: <strong>{u.cardNumber || '—'}</strong>
                                        </div>
                                        <div className="row">
                                            RFID: <strong>{u.rfidUid || '—'}</strong>
                                        </div>
                                        <div className="row">
                                            Balance:{' '}
                                            <strong className="balance-positive">
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
