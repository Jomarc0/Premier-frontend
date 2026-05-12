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
import * as ui from '../components/adminUI';

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
            (tx.passenger?.rfidCardId || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'All Status' || tx.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const filterField = 'min-h-[2.55rem] px-[0.85rem] border-[1.5px] border-border-soft rounded-lg text-[0.86rem] outline-none bg-white text-text-main focus:border-gold focus:shadow-[0_0_0_3px_rgba(232,189,71,0.18)]';

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Transaction Management</span>
                        <h1 className={ui.headerTitle}>Transactions Dashboard</h1>
                    </div>
                    <button type="button" onClick={fetchData} className={ui.adminActionRefresh}>
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                {/* Stats Cards */}
                <section className="grid grid-cols-4 gap-4 mb-5 max-[1060px]:grid-cols-2 max-[560px]:grid-cols-1">
                    {[
                        { label: 'All Transactions', value: stats.totalTransactions || 0,                          variant: 'maroon' },
                        { label: 'Pending',          value: stats.pendingTransactions || 0,                        variant: 'gold'   },
                        { label: 'Completed',        value: stats.completedTransactions || 0,                      variant: 'green'  },
                        { label: 'Revenue (All)',    value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`,  variant: 'maroon' },
                    ].map((card, i) => (
                        <article key={i} className={ui.statCardVariant[card.variant]}>
                            <div>
                                <span className={ui.statLabel}>{card.label}</span>
                                <span className={ui.statValue}>{card.value}</span>
                            </div>
                        </article>
                    ))}
                </section>

                {/* Filter */}
                <section className="bg-white rounded-lg px-5 py-[1.1rem] mb-[1.1rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                    <h2 className="m-0 mb-[0.8rem] text-[0.95rem] font-black text-maroon">Filter Transactions</h2>
                    <div className="flex gap-[0.8rem] flex-wrap items-end">
                        <div className="flex flex-col min-w-36">
                            <span className="text-[0.74rem] text-text-muted font-extrabold mb-[0.3rem]">Status</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className={filterField}
                            >
                                <option>All Status</option>
                                <option value="SUCCESS">Completed</option>
                                <option value="PENDING">Pending</option>
                                <option value="FAILED">Failed</option>
                            </select>
                        </div>
                        <div className="flex flex-col min-w-36">
                            <span className="text-[0.74rem] text-text-muted font-extrabold mb-[0.3rem]">Type</span>
                            <select className={filterField}>
                                <option>All Types</option>
                                <option>Topup</option>
                                <option>Fare Deduction</option>
                            </select>
                        </div>
                        <div className="flex flex-col min-w-36">
                            <span className="text-[0.74rem] text-text-muted font-extrabold mb-[0.3rem]">User ID</span>
                            <input
                                type="text"
                                placeholder="Enter User ID"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={filterField}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={fetchData}
                            className="inline-flex items-center gap-[0.4rem] min-h-[2.55rem] px-[1.1rem] rounded-lg bg-gold text-maroon font-black text-[0.85rem] cursor-pointer transition-colors hover:bg-[#f3cc6a]"
                        >
                            <FiSearch />
                            Search
                        </button>
                    </div>
                </section>

                {/* Table */}
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiFileText />
                            Transactions
                            <span className={ui.countPill}>{totalElements} records</span>
                        </span>
                        <label className={ui.searchControl}>
                            Search:
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search transactions..."
                                className={ui.searchControlInput}
                            />
                        </label>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    {['#', 'Txn ID', 'Amount', 'Type', 'Status', 'User Balance', 'Reference', 'Action'].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className={ui.loadingRow}>Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className={ui.emptyRow}>No transactions found.</td>
                                    </tr>
                                ) : (
                                    filtered.map((tx, idx) => (
                                        <tr key={tx.id} className={ui.tableRow}>
                                            <td className={`${ui.tableTd} text-text-muted`}>
                                                {totalElements - (page * 25) - idx}
                                            </td>
                                            <td className={ui.tableTd}><strong>{tx.id}</strong></td>
                                            <td className={`${ui.tableTd} ${ui.balancePositive}`}>₱{tx.amount}</td>
                                            <td className={ui.tableTd}>
                                                {tx.type === 'TOPUP' ? 'Topup' : 'Fare Deduction'}
                                            </td>
                                            <td className={ui.tableTd}>
                                                <span
                                                    className="inline-flex items-center gap-[0.4rem] font-extrabold status-dot-before"
                                                    style={{ color: statusColor[tx.status] || 'var(--text-muted)' }}
                                                >
                                                    {tx.status === 'SUCCESS' ? 'Completed' : tx.status}
                                                </span>
                                            </td>
                                            <td className={ui.tableTd}><strong>₱{tx.balanceAfter || '—'}</strong></td>
                                            <td className={`${ui.tableTd} ${ui.mono} max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-text-muted`}>
                                                {tx.referenceNumber || '—'}
                                            </td>
                                            <td className={ui.tableTd}>
                                                {tx.status === 'PENDING' ? (
                                                    <div className="inline-flex gap-[0.35rem]">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(tx.id)}
                                                            className="inline-flex items-center gap-[0.3rem] min-h-[1.95rem] px-[0.7rem] rounded-md bg-green-brand text-white text-[0.74rem] font-black cursor-pointer hover:bg-[#245a30]"
                                                        >
                                                            <FiCheck />
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(tx.id)}
                                                            className="inline-flex items-center gap-[0.3rem] min-h-[1.95rem] px-[0.7rem] rounded-md bg-danger-muted text-white text-[0.74rem] font-black cursor-pointer hover:bg-danger-muted-dark"
                                                        >
                                                            <FiX />
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={[
                                                            'font-black text-[0.85rem]',
                                                            tx.status === 'SUCCESS' ? 'text-green-brand' : 'text-danger-muted',
                                                        ].join(' ')}
                                                    >
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
                    <div className={ui.paginationBar}>
                        <span>
                            Showing {Math.min(page * 25 + 1, totalElements)} to{' '}
                            {Math.min((page + 1) * 25, totalElements)} of {totalElements} entries
                        </span>
                        <div className={ui.paginationButtons}>
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                                className={ui.pageBtn}
                            >
                                Previous
                            </button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setPage(i)}
                                    className={page === i ? ui.pageBtnActive : ui.pageBtn}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => p + 1)}
                                className={ui.pageBtn}
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
