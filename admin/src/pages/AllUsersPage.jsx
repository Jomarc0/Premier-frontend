import { useEffect, useState } from 'react';
import {
    FiUsers,
    FiRefreshCw,
    FiCreditCard,
    FiDollarSign,
    FiActivity,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import { toast } from 'react-toastify';
import * as ui from '../components/adminUI';
import { useRealtime } from '../context/RealtimeContext';


const AllUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const { subscribe } = useRealtime();

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

    useEffect(() => subscribe((event) => {
        if (event.entity === 'PASSENGER') fetchData();
    }), [subscribe, page]);



    const filtered = users.filter(u => {
        const query = search.trim().toLowerCase();
        const matchesSearch = !query || (u.cardNumber || '').toLowerCase().includes(query) || String(u.id).includes(query);
        return matchesSearch && (statusFilter === 'ALL' || String(u.status || 'ACTIVE').toUpperCase() === statusFilter);
    });

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>User Management</span>
                        <h1 className={ui.headerTitle}>All Users</h1>
                    </div>
                    <button onClick={fetchData} className={ui.adminActionRefresh}>
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                <section className={ui.statsGrid} aria-label="User summary">
                    {[
                        { label: 'Total Users', value: stats.totalUsers || 0, variant: 'maroon', Icon: FiUsers },
                        { label: 'Total Transactions', value: stats.totalTransactions || 0, variant: 'gold', Icon: FiActivity },
                        { label: 'Total Balance', value: `PHP ${parseFloat(stats.totalBalance || 0).toFixed(2)}`, variant: 'green', Icon: FiDollarSign },
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

                <section className={ui.filterPanel}>
                    <h2 className={ui.filterPanelTitle}>Filter Users</h2>
                    <div className={ui.filterBar}>
                        <label className={`${ui.filterGroup} flex-[1_1_18rem]`}><span className={ui.filterLabel}>Search</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Card number or ID..." className={`${ui.filterSearch} w-full`} /></label>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={ui.filterField}><option value="ALL">All Statuses</option><option value="ACTIVE">Active</option><option value="FROZEN">Frozen</option><option value="BLOCKED">Blocked</option><option value="INACTIVE">Inactive</option></select></label>
                        <button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); }} className={ui.filterReset}>Reset</button>
                    </div>
                </section>

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiUsers />
                            All Registered Users
                            <span className={ui.countPill}>{totalElements} users</span>
                        </span>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    {['ID', 'Card Number', 'Balance', 'Status', 'Created'].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className={ui.loadingRow}>Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={ui.emptyRow}>No users found.</td>
                                    </tr>
                                ) : filtered.map((u) => {
                                    const frozen = ['FROZEN', 'BLOCKED', 'INACTIVE'].includes(String(u.status || '').toUpperCase());

                                    return (
                                        <tr key={u.id} className={ui.tableRow}>
                                            <td className={ui.tableTd}><strong>{u.id}</strong></td>
                                            <td className={`${ui.tableTd} ${ui.mono}`}>
                                                <span className="inline-flex items-center gap-[0.4rem]">
                                                    <FiCreditCard className="text-maroon-soft" />
                                                    {u.cardNumber || '-'}
                                                </span>
                                            </td>
                                            <td className={`${ui.tableTd} ${ui.balancePositive}`}>
                                                PHP {parseFloat(u.balance || 0).toFixed(2)}
                                            </td>
                                            <td className={ui.tableTd}>
                                                <span className={!frozen ? ui.statusPillSoftSuccess : ui.statusPillSoftDanger}>
                                                    {u.status || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className={`${ui.tableTd} text-text-muted whitespace-nowrap`}>
                                                {u.createdAt
                                                    ? new Date(u.createdAt).toLocaleDateString('en-PH')
                                                    : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className={ui.paginationBar}>
                        <span>
                            Showing {Math.min(page * 25 + 1, totalElements)} to{' '}
                            {Math.min((page + 1) * 25, totalElements)} of {totalElements} entries
                        </span>
                        <div className={ui.paginationButtons}>
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                                className={ui.pageBtn}
                            >
                                Previous
                            </button>
                            <button className={ui.pageBtnActive}>{page + 1}</button>
                            <button
                                disabled={(page + 1) * 25 >= totalElements}
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

export default AllUsersPage;
