import { useEffect, useState } from 'react';
import {
    FiRefreshCw,
    FiSearch,
    FiCheck,
    FiX,
    FiFileText,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';

const statusColor = {
    SUCCESS: '#2f6b3d', PENDING: '#d97706', FAILED: '#b24a52',
};

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All Status');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    useEffect(() => { fetchData(); }, [page]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [txRes, statsRes] = await Promise.all([
                adminAPI.get(`/transactions?page=${page}&size=25`),
                adminAPI.get('/dashboard/stats'),
            ]);
            const txData = txRes.data.data;
            setTransactions(txData.content || []);
            setTotalPages(txData.totalPages || 0);
            setTotalElements(txData.totalElements || 0);
            setStats(statsRes.data.data || {});
        } catch (err) {
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            await adminAPI.post(`/transactions/${id}/approve`);
            toast.success('Transaction approved!');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const handleReject = async (id) => {
        try {
            await adminAPI.post(`/transactions/${id}/reject`);
            toast.success('Transaction rejected.');
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        }
    };

    const filtered = transactions.filter(tx => {
        const matchSearch = search === '' ||
            String(tx.id).includes(search) ||
            (tx.passenger?.rfidCardId || '').toLowerCase()
                .includes(search.toLowerCase());
        const matchStatus = filterStatus === 'All Status' ||
            tx.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Transaction Management</span>
                        <h1>Transactions Dashboard</h1>
                    </div>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="admin-action refresh"
                    >
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                {/* Stats Cards */}
                <section className="admin-stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    {[
                        { label: 'All Transactions', value: stats.totalTransactions || 0,                                         variant: 'maroon' },
                        { label: 'Pending',          value: stats.pendingTransactions || 0,                                       variant: 'gold'   },
                        { label: 'Completed',        value: stats.completedTransactions || 0,                                     variant: 'green'  },
                        { label: 'Revenue (All)',    value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`,                 variant: 'maroon' },
                    ].map((card, i) => (
                        <article key={i} className={`stat-card ${card.variant}`}>
                            <div>
                                <span className="stat-label">{card.label}</span>
                                <span className="stat-value">{card.value}</span>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Filter */}
                <section className="filter-card">
                    <h2>Filter Transactions</h2>
                    <div className="filter-row">
                        <div className="field">
                            <span className="field-sub-label">Status</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option>All Status</option>
                                <option value="SUCCESS">Completed</option>
                                <option value="PENDING">Pending</option>
                                <option value="FAILED">Failed</option>
                            </select>
                        </div>
                        <div className="field">
                            <span className="field-sub-label">Type</span>
                            <select>
                                <option>All Types</option>
                                <option>Topup</option>
                                <option>Fare Deduction</option>
                            </select>
                        </div>
                        <div className="field">
                            <span className="field-sub-label">User ID</span>
                            <input
                                type="text"
                                placeholder="Enter User ID"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={fetchData}
                            className="filter-search-btn"
                        >
                            <FiSearch />
                            Search
                        </button>
                    </div>
                </section>

                {/* Table */}
                <section className="data-panel">
                    <div className="data-panel-header">
                        <span className="data-panel-title">
                            <FiFileText />
                            Transactions
                            <span className="count-pill">{totalElements} records</span>
                        </span>
                        <label className="search-control">
                            Search:
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search transactions..."
                            />
                        </label>
                    </div>

                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    {['#', 'Txn ID', 'Amount', 'Type',
                                        'Status', 'User Balance',
                                        'Reference', 'Action'].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="loading-row">Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="empty-row">No transactions found.</td>
                                    </tr>
                                ) : (
                                    filtered.map((tx, idx) => (
                                        <tr key={tx.id}>
                                            <td style={{ color: 'var(--text-muted)' }}>
                                                {totalElements - (page * 25) - idx}
                                            </td>
                                            <td><strong>{tx.id}</strong></td>
                                            <td className="balance-positive">₱{tx.amount}</td>
                                            <td>
                                                {tx.type === 'TOPUP'
                                                    ? 'Topup' : 'Fare Deduction'}
                                            </td>
                                            <td>
                                                <span
                                                    className="status-dot"
                                                    style={{ color: statusColor[tx.status] || 'var(--text-muted)' }}
                                                >
                                                    {tx.status === 'SUCCESS'
                                                        ? 'Completed' : tx.status}
                                                </span>
                                            </td>
                                            <td><strong>₱{tx.balanceAfter || '—'}</strong></td>
                                            <td className="mono" style={{
                                                maxWidth: '9rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: 'var(--text-muted)',
                                            }}>
                                                {tx.referenceNumber || '—'}
                                            </td>
                                            <td>
                                                {tx.status === 'PENDING' ? (
                                                    <div className="tx-action-row">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(tx.id)}
                                                            className="tx-approve"
                                                        >
                                                            <FiCheck />
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(tx.id)}
                                                            className="tx-reject"
                                                        >
                                                            <FiX />
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className={`tx-status-text ${
                                                        tx.status === 'SUCCESS' ? 'success' : 'failed'
                                                    }`}>
                                                        {tx.status === 'SUCCESS' ? 'Completed' : 'Failed'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
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
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) },
                                (_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setPage(i)}
                                    className={page === i ? 'active' : ''}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={page >= totalPages - 1}
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

export default TransactionsPage;
