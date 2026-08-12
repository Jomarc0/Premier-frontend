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
import { useRealtime } from '../context/RealtimeContext';
import { formatTime, phtDateKey } from '../lib/time';

const statusColor = {
    SUCCESS: '#2f6b3d', PENDING: '#d97706', FAILED: '#b24a52',
};

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All Status');
    const [filterType, setFilterType] = useState('ALL');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [staffCashTransactions, setStaffCashTransactions] = useState([]);
    const [activeTab, setActiveTab] = useState('transactions');
    const [staffCashDate, setStaffCashDate] = useState(phtDateKey());
    const [staffCashSearch, setStaffCashSearch] = useState('');
    const [staffCashCategory, setStaffCashCategory] = useState('ALL');
    const { subscribe } = useRealtime();

    useEffect(() => { fetchData(); }, [page, staffCashDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [txRes, statsRes, staffCashRes] = await Promise.all([
                adminAPI.get(`/transactions?page=${page}&size=25`),
                adminAPI.get('/dashboard/stats'),
                adminAPI.get(`/staff-cash/transactions?date=${staffCashDate}`),
            ]);
            const txData = txRes.data.data;
            setTransactions(txData.content || []);
            setTotalPages(txData.totalPages || 0);
            setTotalElements(txData.totalElements || 0);
            setStats(statsRes.data.data || {});
            setStaffCashTransactions(staffCashRes.data.data || []);
        } catch (err) {
            toast.error('Failed to load transactions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => subscribe((event) => {
        if (event.entity === 'TRANSACTION' || event.entity === 'TOPUP') fetchData();
    }), [subscribe, page]);

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
        const matchType = filterType === 'ALL' || tx.type === filterType;
        return matchSearch && matchStatus && matchType;
    });

    const filteredStaffCashTransactions = staffCashTransactions.filter((transaction) => {
        const query = staffCashSearch.trim().toLowerCase();
        const matchesSearch = !query || [transaction.staffName, transaction.plateNumber, transaction.deviceId, transaction.referenceNumber]
            .some(value => String(value || '').toLowerCase().includes(query));
        return matchesSearch && (staffCashCategory === 'ALL' || transaction.fareCategory === staffCashCategory);
    });

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

                <nav className="mb-5 flex items-end gap-1 border-b border-border-soft bg-white px-4 pt-2 shadow-[0_8px_22px_rgba(44,36,41,0.06)]" aria-label="Transaction views">
                    <button
                        type="button"
                        onClick={() => setActiveTab('transactions')}
                        className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-black transition-colors ${activeTab === 'transactions' ? 'border-maroon text-maroon' : 'border-transparent text-text-muted hover:text-maroon'}`}
                    >
                        <FiFileText /> Transactions
                        <span className={activeTab === 'transactions' ? ui.countPill : 'rounded-full bg-page-bg px-2 py-1 text-[0.68rem] font-black text-text-muted'}>{totalElements}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('staff-cash')}
                        className={`inline-flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-black transition-colors ${activeTab === 'staff-cash' ? 'border-maroon text-maroon' : 'border-transparent text-text-muted hover:text-maroon'}`}
                    >
                        <FiFileText /> Staff Cash Transactions
                        <span className={activeTab === 'staff-cash' ? ui.countPill : 'rounded-full bg-gold px-2 py-1 text-[0.68rem] font-black text-maroon'}>{staffCashTransactions.length}</span>
                    </button>
                </nav>

                {activeTab === 'transactions' && <>
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
                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Transactions</h2>
                    <div className={ui.filterBar}>
                        <label className={ui.filterGroup}>
                            <span className={ui.filterLabel}>Status</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className={ui.filterField}
                            >
                                <option>All Status</option>
                                <option value="SUCCESS">Completed</option>
                                <option value="PENDING">Pending</option>
                                <option value="FAILED">Failed</option>
                            </select>
                        </label>
                        <label className={ui.filterGroup}>
                            <span className={ui.filterLabel}>Type</span>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={ui.filterField}>
                                <option value="ALL">All Types</option>
                                <option value="TOPUP">Topup</option>
                                <option value="FARE_DEDUCTION">Fare Deduction</option>
                            </select>
                        </label>
                        <label className={ui.filterGroup}>
                            <span className={ui.filterLabel}>User ID or reference</span>
                            <input
                                type="text"
                                placeholder="Enter User ID"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={ui.filterField}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={fetchData}
                            className="inline-flex items-center gap-[0.4rem] min-h-[2.55rem] px-[1.1rem] rounded-lg bg-gold text-maroon font-black text-[0.85rem] cursor-pointer transition-colors hover:bg-[#f3cc6a]"
                        >
                            <FiSearch />
                            Search
                        </button>
                        <button type="button" onClick={() => { setSearch(''); setFilterStatus('All Status'); setFilterType('ALL'); }} className={ui.filterReset}>Reset</button>
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

                </>}

                {activeTab === 'staff-cash' && <>
                    <section className={ui.filterPanel}>
                        <h2 className={ui.filterPanelTitle}>Filter Staff Cash Transactions</h2>
                        <div className={ui.filterBar}>
                            <label className={ui.filterGroup}><span className={ui.filterLabel}>Collection date</span><input type="date" value={staffCashDate} onChange={(event) => setStaffCashDate(event.target.value)} className={ui.filterField} /></label>
                            <label className={`${ui.filterGroup} flex-[1_1_18rem]`}><span className={ui.filterLabel}>Search</span><input type="search" value={staffCashSearch} onChange={(event) => setStaffCashSearch(event.target.value)} placeholder="Staff, vehicle, device, or reference..." className={`${ui.filterSearch} w-full`} /></label>
                            <label className={ui.filterGroup}><span className={ui.filterLabel}>Category</span><select value={staffCashCategory} onChange={(event) => setStaffCashCategory(event.target.value)} className={ui.filterField}><option value="ALL">All Categories</option><option value="REGULAR_CASH">Regular Cash</option><option value="DISCOUNTED_CASH">Discounted Cash</option></select></label>
                            <button type="button" onClick={() => { setStaffCashDate(phtDateKey()); setStaffCashSearch(''); setStaffCashCategory('ALL'); }} className={ui.filterReset}>Reset</button>
                        </div>
                    </section>
                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}><FiFileText /> Staff Cash Transactions <span className={ui.countPill}>{filteredStaffCashTransactions.length} shown</span></span>
                    </div>
                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead><tr>{['Time','Staff','Vehicle','Device','Shift','Terminal','Category','Amount','Reference'].map(h => <th key={h} className={ui.tableTh}>{h}</th>)}</tr></thead>
                            <tbody>{loading ? <tr><td colSpan="9" className={ui.loadingRow}>Loading...</td></tr> : filteredStaffCashTransactions.length ? filteredStaffCashTransactions.map(tx => <tr key={tx.id} className={ui.tableRow}>
                                <td className={ui.tableTd}>{formatTime(tx.createdAt)}</td><td className={`${ui.tableTd} font-black`}>{tx.staffName}</td><td className={ui.tableTd}>{tx.plateNumber}</td><td className={ui.tableTd}>{tx.deviceId}</td><td className={ui.tableTd}>{tx.driverShiftId}</td><td className={ui.tableTd}>{tx.terminal || '—'}</td><td className={ui.tableTd}>{tx.fareCategory === 'REGULAR_CASH' ? 'Regular Cash' : 'Discounted Cash'}</td><td className={`${ui.tableTd} ${ui.balancePositive}`}>₱{Number(tx.finalFare).toFixed(2)}</td><td className={`${ui.tableTd} ${ui.mono}`}>{tx.referenceNumber}</td>
                            </tr>) : <tr><td colSpan="9" className={ui.emptyRow}>No staff cash transactions match the selected filters.</td></tr>}</tbody>
                        </table>
                    </div>
                </section></>}
            </main>
        </div>
    );
};

export default TransactionsPage;
