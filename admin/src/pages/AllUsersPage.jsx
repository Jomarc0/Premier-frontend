import { useEffect, useState } from 'react';
import {
    FiUsers,
    FiRefreshCw,
    FiPlus,
    FiCheck,
    FiX,
    FiCreditCard,
    FiDollarSign,
    FiActivity,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';

const AllUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddBalance, setShowAddBalance] = useState(null);
    const [addAmount, setAddAmount] = useState('');
    const [page, setPage] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    useEffect(() => { fetchData(); }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, statsRes] = await Promise.all([
                adminAPI.get(`/users?page=${page}&size=25`),
                adminAPI.get('/dashboard/stats'),
            ]);
            const data = usersRes.data.data;
            setUsers(data.content || []);
            setTotalElements(data.totalElements || 0);
            setStats(statsRes.data.data || {});
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleAddBalance = async (userId) => {
        if (!addAmount || parseFloat(addAmount) <= 0) {
            toast.warning('Enter a valid amount');
            return;
        }
        try {
            await adminAPI.post(`/users/${userId}/add-balance`, {
                amount: parseFloat(addAmount),
                note: 'Admin top-up',
            });
            toast.success('Balance added!');
            setShowAddBalance(null);
            setAddAmount('');
            fetchData();
        } catch (err) {
            toast.error('Failed to add balance');
        }
    };

    const filtered = users.filter(u =>
        search === '' ||
        (u.cardNumber || '').toLowerCase()
            .includes(search.toLowerCase()) ||
        String(u.id).includes(search)
    );

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">User Management</span>
                        <h1>All Users</h1>
                    </div>
                    <button onClick={fetchData} className="admin-action refresh">
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                {/* Stats */}
                <section className="admin-stats" aria-label="User summary">
                    {[
                        {
                            label: 'Total Users',
                            value: stats.totalUsers || 0,
                            variant: 'maroon',
                            Icon: FiUsers,
                        },
                        {
                            label: 'Total Transactions',
                            value: stats.totalTransactions || 0,
                            variant: 'gold',
                            Icon: FiActivity,
                        },
                        {
                            label: 'Total Balance',
                            value: `₱${parseFloat(stats.totalBalance || 0).toFixed(2)}`,
                            variant: 'green',
                            Icon: FiDollarSign,
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

                {/* Table */}
                <section className="data-panel">
                    <div className="data-panel-header">
                        <span className="data-panel-title">
                            <FiUsers />
                            All Registered Users
                            <span className="count-pill">{totalElements} users</span>
                        </span>
                        <label className="search-control">
                            Search:
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Card number or ID..."
                            />
                        </label>
                    </div>

                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    {['ID', 'Card Number', 'Balance', 'Status', 'Created', 'Actions'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="loading-row">Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="empty-row">No users found.</td>
                                    </tr>
                                ) : filtered.map((u) => (
                                    <tr key={u.id}>
                                        <td><strong>{u.id}</strong></td>
                                        <td className="mono">
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <FiCreditCard style={{ color: 'var(--brand-maroon-soft)' }} />
                                                {u.cardNumber || '—'}
                                            </span>
                                        </td>
                                        <td className="balance-positive">
                                            ₱{parseFloat(u.balance || 0).toFixed(2)}
                                        </td>
                                        <td>
                                            <span className={`status-pill-soft ${u.status === 'ACTIVE' || !u.status ? 'success' : 'danger'}`}>
                                                {u.status || 'ACTIVE'}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {u.createdAt
                                                ? new Date(u.createdAt).toLocaleDateString('en-PH')
                                                : '—'}
                                        </td>
                                        <td>
                                            {showAddBalance === u.id ? (
                                                <div className="inline-balance-form">
                                                    <input
                                                        type="number"
                                                        placeholder="Amount"
                                                        value={addAmount}
                                                        onChange={(e) => setAddAmount(e.target.value)}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="icon-btn success"
                                                        onClick={() => handleAddBalance(u.id)}
                                                        aria-label="Confirm add balance"
                                                    >
                                                        <FiCheck />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-btn danger"
                                                        onClick={() => {
                                                            setShowAddBalance(null);
                                                            setAddAmount('');
                                                        }}
                                                        aria-label="Cancel"
                                                    >
                                                        <FiX />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="add-balance-btn"
                                                    onClick={() => setShowAddBalance(u.id)}
                                                >
                                                    <FiPlus />
                                                    Add Balance
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination-bar">
                        <span>
                            Showing {Math.min(page * 25 + 1, totalElements)} to{' '}
                            {Math.min((page + 1) * 25, totalElements)} of {totalElements} entries
                        </span>
                        <div className="pagination-buttons">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </button>
                            <button className="active">{page + 1}</button>
                            <button
                                disabled={(page + 1) * 25 >= totalElements}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default AllUsersPage;
