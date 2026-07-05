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
import * as ui from '../components/adminUI';


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

                <section className={ui.dataPanel}>
                    <div className={ui.dataPanelHeader}>
                        <span className={ui.dataPanelTitle}>
                            <FiUsers />
                            All Registered Users
                            <span className={ui.countPill}>{totalElements} users</span>
                        </span>
                        <label className={ui.searchControl}>
                            Search:
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Card number or ID..."
                                className={ui.searchControlInput}
                            />
                        </label>
                    </div>

                    <div className={ui.tableWrap}>
                        <table className={ui.adminTable}>
                            <thead>
                                <tr>
                                    {['ID', 'Card Number', 'Balance', 'Status', 'Created', 'Actions'].map(h => (
                                        <th key={h} className={ui.tableTh}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className={ui.loadingRow}>Loading...</td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className={ui.emptyRow}>No users found.</td>
                                    </tr>
                                ) : filtered.map((u) => {

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
                                            <td className={ui.tableTd}>
                                                {showAddBalance === u.id ? (
                                                    <div className="inline-flex gap-[0.35rem] items-center">
                                                        <input
                                                            type="number"
                                                            placeholder="Amount"
                                                            value={addAmount}
                                                            onChange={(e) => setAddAmount(e.target.value)}
                                                            className="w-24 min-h-8 px-2 border border-border-soft rounded-md outline-none text-[0.8rem] focus:border-gold"
                                                        />
                                                        <button
                                                            type="button"
                                                            className="inline-grid place-items-center min-w-8 min-h-8 px-[0.55rem] rounded-md text-[0.85rem] font-black cursor-pointer bg-green-brand text-white"
                                                            onClick={() => handleAddBalance(u.id)}
                                                            aria-label="Confirm add balance"
                                                        >
                                                            <FiCheck />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="inline-grid place-items-center min-w-8 min-h-8 px-[0.55rem] rounded-md text-[0.85rem] font-black cursor-pointer bg-danger-muted text-white"
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
                                                    <div className="inline-flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-[0.35rem] min-h-8 px-3 rounded-md bg-green-brand text-white text-[0.78rem] font-black cursor-pointer hover:bg-[#245a30]"
                                                            onClick={() => setShowAddBalance(u.id)}
                                                        >
                                                            <FiPlus />
                                                            Add Balance
                                                        </button>
                                                    </div>
                                                )}
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
