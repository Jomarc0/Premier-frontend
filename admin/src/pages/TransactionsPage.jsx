import { useCallback, useEffect, useState } from 'react';
import {
    FiAlertCircle,
    FiCalendar,
    FiCreditCard,
    FiRefreshCw,
    FiSearch,
    FiFileText,
    FiMinusCircle,
    FiPlusCircle,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';
import { useRealtime } from '../context/RealtimeState';
import { formatTime, phtDateKey } from '../lib/time';

const statusColor = {
    SUCCESS: '#2f6b3d', COMPLETED: '#2f6b3d', PENDING: '#a66b12', PROCESSING: '#a66b12',
    FAILED: '#a8434c', CANCELLED: '#6b7280', EXPIRED: '#a8434c',
};

const formatPeso = (value) => new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(Number(value || 0));

const transactionTypeLabel = (type) => ({
    TOPUP: 'Topup',
    RIDE_FARE: 'Fare Deduction',
    FARE_DEDUCTION: 'Fare Deduction',
    REFUND: 'Refund',
    ADMIN_ADJUSTMENT: 'Admin Adjustment',
}[type] || String(type || '—').replaceAll('_', ' '));

const transactionStatusLabel = (status) => ({
    SUCCESS: 'Completed', COMPLETED: 'Completed', PROCESSING: 'Processing',
    PENDING: 'Pending', FAILED: 'Failed', CANCELLED: 'Cancelled', EXPIRED: 'Expired',
}[status] || String(status || '—').replaceAll('_', ' '));

const isCreditTransaction = (type) => type === 'TOPUP' || type === 'REFUND';

const TransactionsPage = () => {
    const [transactions, setTransactions] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
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
    const [summaryTransactions, setSummaryTransactions] = useState([]);
    const { subscribe } = useRealtime();

    const fetchData = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
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
            let summaryRows = txData.content || [];
            if ((txData.totalElements || 0) > summaryRows.length) {
                try {
                    const summaryRes = await adminAPI.get(`/transactions?page=0&size=${txData.totalElements}`);
                    summaryRows = summaryRes.data.data?.content || summaryRows;
                } catch {
                    // The visible page remains usable if the optional aggregate request fails.
                }
            }
            setSummaryTransactions(summaryRows);
        } catch {
            toast.error('Failed to load transactions');
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [page, staffCashDate]);

    useEffect(() => {
        const initial = window.setTimeout(() => { fetchData(); }, 0);
        return () => window.clearTimeout(initial);
    }, [fetchData]);



    useEffect(() => subscribe((event) => {
        if (event.entity === 'TRANSACTION' || event.entity === 'TOPUP') fetchData();
    }), [subscribe, fetchData]);

    const filtered = transactions.filter(tx => {
        const query = search.trim().toLowerCase();
        const matchSearch = search === '' ||
            [tx.id, tx.referenceNumber, tx.userId, tx.passengerId, tx.passenger?.id, tx.passenger?.rfidCardId]
                .some(value => String(value || '').toLowerCase().includes(query));
        const matchStatus = filterStatus === 'All Status'
            || (filterStatus === 'SUCCESS' ? tx.status === 'SUCCESS' || tx.status === 'COMPLETED' : tx.status === filterStatus);
        const matchType = filterType === 'ALL'
            || (filterType === 'FARE_DEDUCTION' ? tx.type === 'FARE_DEDUCTION' || tx.type === 'RIDE_FARE' : tx.type === filterType);
        return matchSearch && matchStatus && matchType;
    });

    const summarySource = summaryTransactions.length ? summaryTransactions : transactions;
    const topUpCount = summarySource.filter(tx => tx.type === 'TOPUP').length;
    const fareDeductionCount = summarySource.filter(tx => tx.type === 'FARE_DEDUCTION' || tx.type === 'RIDE_FARE').length;
    const todayAmount = summarySource
        .filter(tx => tx.createdAt && phtDateKey(tx.createdAt) === phtDateKey()
            && (tx.status === 'SUCCESS' || tx.status === 'COMPLETED'))
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);

    const firstVisible = totalElements === 0 ? 0 : Math.min(page * 25 + 1, totalElements);
    const lastVisible = Math.min((page + 1) * 25, totalElements);
    const firstPageButton = Math.max(0, Math.min(page - 2, Math.max(totalPages - 5, 0)));
    const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => firstPageButton + index);

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

                <header className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-border-soft bg-white px-6 py-5 max-[560px]:flex-col max-[560px]:items-start max-[560px]:px-4 max-[560px]:py-4">
                    <div>
                        <h1 className="m-0 text-[clamp(1.5rem,2.5vw,1.75rem)] font-extrabold leading-tight text-[#202b3a]">Transactions</h1>
                        <p className="mt-1 text-sm text-text-muted">Manage and monitor all passenger account transactions.</p>
                    </div>
                    <button type="button" onClick={fetchData} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-maroon bg-white px-3.5 text-[0.82rem] font-extrabold text-maroon transition-colors hover:bg-maroon/5 disabled:cursor-wait disabled:opacity-60">
                        <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </header>

                <nav className="mb-5 flex max-w-full items-end gap-1 overflow-x-auto border-b border-border-soft bg-white px-4 pt-1.5" aria-label="Transaction views">
                    <button
                        type="button"
                        onClick={() => setActiveTab('transactions')}
                        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-extrabold transition-colors ${activeTab === 'transactions' ? 'border-maroon text-maroon' : 'border-transparent text-text-muted hover:text-maroon'}`}
                    >
                        <FiFileText /> Transactions
                        <span className={activeTab === 'transactions' ? ui.countPill : 'rounded-full bg-page-bg px-2 py-1 text-[0.68rem] font-black text-text-muted'}>{totalElements}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('staff-cash')}
                        className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-extrabold transition-colors ${activeTab === 'staff-cash' ? 'border-maroon text-maroon' : 'border-transparent text-text-muted hover:text-maroon'}`}
                    >
                        <FiFileText /> Staff Cash Transactions
                        <span className={activeTab === 'staff-cash' ? ui.countPill : 'rounded-full bg-gold px-2 py-1 text-[0.68rem] font-black text-maroon'}>{staffCashTransactions.length}</span>
                    </button>
                </nav>

                {activeTab === 'transactions' && <>
                <section className="mb-5 grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2 max-[560px]:gap-3">
                    {[
                        { label: 'Total Transactions', value: stats.totalTransactions ?? totalElements, Icon: FiCreditCard },
                        { label: 'Top Ups', value: topUpCount, Icon: FiPlusCircle },
                        { label: 'Fare Deductions', value: fareDeductionCount, Icon: FiMinusCircle },
                        { label: 'Today', value: formatPeso(todayAmount), Icon: FiCalendar },
                    ].map(({ label, value, Icon }) => (
                        <article key={label} className="flex min-h-[5.6rem] items-start justify-between gap-3 rounded-xl border border-border-soft bg-white px-4 py-3.5 shadow-[0_2px_8px_rgba(31,42,55,0.04)]">
                            <div className="min-w-0">
                                <span className="block text-[0.7rem] font-bold uppercase leading-tight tracking-[0.06em] text-text-muted">{label}</span>
                                <span className="mt-2 block text-[1.45rem] font-extrabold leading-none text-[#202b3a]">{value}</span>
                            </div>
                            {Icon ? <Icon className="mt-0.5 shrink-0 text-[1rem] text-maroon-soft" aria-hidden="true" /> : null}
                        </article>
                    ))}
                </section>

                <section className="mb-5 rounded-xl border border-border-soft bg-white px-5 py-4 shadow-[0_2px_8px_rgba(31,42,55,0.04)] max-[560px]:px-4">
                    <h2 className="m-0 mb-3 text-base font-bold text-[#202b3a]">Filter Transactions</h2>
                    <div className="grid grid-cols-[minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(13rem,1.5fr)_auto_auto] items-end gap-3 max-[1180px]:grid-cols-2 max-[560px]:grid-cols-1">
                        <label className="flex min-w-0 flex-col">
                            <span className={ui.filterLabel}>Status</span>
                            <select
                                value={filterStatus}
                                onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
                                className={ui.filterField}
                            >
                                <option>All Status</option>
                                <option value="SUCCESS">Completed</option>
                                <option value="PENDING">Pending</option>
                                <option value="PROCESSING">Processing</option>
                                <option value="FAILED">Failed</option>
                                <option value="CANCELLED">Cancelled</option>
                                <option value="EXPIRED">Expired</option>
                            </select>
                        </label>
                        <label className="flex min-w-0 flex-col">
                            <span className={ui.filterLabel}>Type</span>
                            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }} className={ui.filterField}>
                                <option value="ALL">All Types</option>
                                <option value="TOPUP">Topup</option>
                                <option value="FARE_DEDUCTION">Fare Deduction</option>
                            </select>
                        </label>
                        <label className="flex min-w-0 flex-col max-[1180px]:col-span-2 max-[560px]:col-span-1">
                            <span className={ui.filterLabel}>Search</span>
                            <input
                                type="search"
                                placeholder="User ID / Reference"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className={ui.filterField}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setPage(0)}
                            className="inline-flex min-h-[2.55rem] items-center justify-center gap-2 rounded-lg bg-maroon px-4 text-[0.84rem] font-extrabold text-white transition-colors hover:bg-maroon-dark"
                        >
                            <FiSearch />
                            Search
                        </button>
                        <button type="button" onClick={() => { setSearch(''); setFilterStatus('All Status'); setFilterType('ALL'); setPage(0); }} className="inline-flex min-h-[2.55rem] items-center justify-center rounded-lg border border-maroon bg-white px-4 text-[0.84rem] font-extrabold text-maroon transition-colors hover:bg-maroon/5">Reset</button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border-soft bg-white shadow-[0_2px_8px_rgba(31,42,55,0.04)]">
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiFileText />
                            Transactions
                            <span className={ui.countPill}>{totalElements} records</span>
                        </span>
                    </div>

                    {loadError ? (
                        <div className="grid min-h-52 place-items-center px-4 py-8 text-center" role="alert">
                            <div>
                                <FiAlertCircle className="mx-auto text-2xl text-danger-muted" aria-hidden="true" />
                                <p className="mt-3 text-sm font-bold text-[#303b49]">Transactions couldn&apos;t be loaded.</p>
                                <button type="button" onClick={fetchData} className="mt-3 min-h-10 rounded-lg bg-maroon px-4 text-sm font-bold text-white transition-colors hover:bg-maroon-dark">Try Again</button>
                            </div>
                        </div>
                    ) : <>
                    <div className="overflow-x-auto" role="region" aria-label="Passenger account transactions" tabIndex="0">
                        <table className="w-full min-w-[760px] border-collapse text-text-main">
                            <thead>
                                <tr>
                                    {['Txn ID', 'Amount', 'Type', 'Status', 'User Balance', 'Reference'].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className={ui.loadingRow}>
                                            <span className="inline-flex items-center gap-2"><FiRefreshCw className="animate-spin" /> Loading transactions…</span>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <strong className="block text-sm text-[#303b49]">No transactions found.</strong>
                                            <span className="mt-1 block text-sm text-text-muted">Try adjusting your filters or check back later.</span>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((tx) => (
                                        <tr key={tx.id} className={ui.tableRow}>
                                            <td className={ui.tableTd}><strong>{tx.id}</strong></td>
                                            <td className={`${ui.tableTd} font-extrabold ${isCreditTransaction(tx.type) ? 'text-green-brand' : 'text-maroon'}`}>
                                                {isCreditTransaction(tx.type) ? '+' : '−'}{formatPeso(Math.abs(Number(tx.amount || 0)))}
                                            </td>
                                            <td className={ui.tableTd}>
                                                <span className="inline-flex rounded-md bg-[#f4f5f7] px-2 py-1 text-xs font-semibold text-[#4b5563]">{transactionTypeLabel(tx.type)}</span>
                                            </td>
                                            <td className={ui.tableTd}>
                                                <span
                                                    className="inline-flex items-center text-[0.82rem] font-bold status-dot-before"
                                                    style={{ color: statusColor[tx.status] || 'var(--text-muted)' }}
                                                >
                                                    {transactionStatusLabel(tx.status)}
                                                </span>
                                            </td>
                                            <td className={`${ui.tableTd} font-bold text-[#303b49]`}>{tx.balanceAfter == null ? '—' : formatPeso(tx.balanceAfter)}</td>
                                            <td className={ui.tableTd}>
                                                <span title={tx.referenceNumber || undefined} className={`${ui.mono} block max-w-[15rem] overflow-hidden text-ellipsis whitespace-nowrap text-xs text-text-muted`}>
                                                    {tx.referenceNumber || '—'}
                                                </span>
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
                            Showing {firstVisible} to {lastVisible} of {totalElements} entries
                        </span>
                        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                                className={ui.pageBtn}
                            >
                                Previous
                            </button>
                            {visiblePages.map((pageNumber) => (
                                <button
                                    key={pageNumber}
                                    type="button"
                                    onClick={() => setPage(pageNumber)}
                                    className={page === pageNumber ? ui.pageBtnActive : ui.pageBtn}
                                    aria-current={page === pageNumber ? 'page' : undefined}
                                >
                                    {pageNumber + 1}
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
                    </>}
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
