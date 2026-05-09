import { useEffect, useState } from 'react';
import {
    FiRefreshCw,
    FiBarChart2,
    FiTruck,
    FiUsers,
    FiTrendingUp,
    FiDollarSign,
    FiCheckCircle,
    FiClock,
    FiCreditCard,
    FiPieChart,
    FiList,
} from 'react-icons/fi';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie,
    Cell, Legend
} from 'recharts';
import * as ui from '../components/adminUI';

const ReportsPage = () => {
    const [stats, setStats] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month'); // day, month, year

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, txRes] = await Promise.all([
                adminAPI.get('/dashboard/stats'),
                adminAPI.get('/transactions?page=0&size=100'),
            ]);
            setStats(statsRes.data.data || {});
            setTransactions(
                txRes.data.data?.content || []);
        } catch (err) {
            console.error('Failed to load reports', err);
        } finally {
            setLoading(false);
        }
    };

    const groupByPeriod = (txList, p) => {
        const groups = {};
        txList.forEach(tx => {
            if (!tx.createdAt) return;
            const date = new Date(tx.createdAt);
            let key;
            if (p === 'day') {
                key = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
            } else if (p === 'month') {
                key = date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
            } else {
                key = date.getFullYear().toString();
            }
            if (!groups[key]) {
                groups[key] = { name: key, earnings: 0, count: 0 };
            }
            if (tx.status === 'SUCCESS' && tx.type === 'TOPUP') {
                groups[key].earnings += parseFloat(tx.amount || 0);
                groups[key].count += 1;
            }
        });
        return Object.values(groups).slice(-12);
    };

    const earningsData = groupByPeriod(transactions, period);

    const vehicleData = [
        { name: 'Bus-001', passengers: 120, earnings: 2400 },
        { name: 'Bus-002', passengers: 98,  earnings: 1960 },
        { name: 'Bus-003', passengers: 145, earnings: 2900 },
        { name: 'Bus-004', passengers: 76,  earnings: 1520 },
        { name: 'Bus-005', passengers: 110, earnings: 2200 },
    ];

    const driverData = [
        { name: 'Driver A', trips: 45, earnings: 3200 },
        { name: 'Driver B', trips: 38, earnings: 2800 },
        { name: 'Driver C', trips: 52, earnings: 3900 },
        { name: 'Driver D', trips: 29, earnings: 2100 },
        { name: 'Driver E', trips: 41, earnings: 3100 },
    ];

    const C_MAROON = '#6f2f3c';
    const C_GOLD   = '#e8bd47';
    const C_GREEN  = '#2f6b3d';
    const C_BLUE   = '#3b6fb3';

    const overviewCards = [
        { label: 'Total Topup Earnings', value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`, variant: 'gold',   badge: 'Topups',     Icon: FiCreditCard },
        { label: 'Total Users',          value: stats.totalUsers || 0,                                variant: 'maroon', badge: 'Passengers', Icon: FiUsers      },
        { label: 'Total Transactions',   value: stats.totalTransactions || 0,                         variant: 'green',  badge: 'Total',      Icon: FiTrendingUp },
    ];

    const overviewBg = {
        maroon: 'bg-gradient-to-br from-maroon to-maroon-soft',
        gold:   'bg-gradient-to-br from-[#d99a26] to-gold',
        green:  'bg-gradient-to-br from-[#245a30] to-green-brand',
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>

                {/* Header */}
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Analytics</span>
                        <h1 className={ui.headerTitle}>Reports & Analytics</h1>
                    </div>
                    <button type="button" onClick={fetchData} className={ui.adminActionRefresh}>
                        <FiRefreshCw />
                        Refresh
                    </button>
                </header>

                {/* Overview Cards */}
                <section className="grid grid-cols-3 gap-4 mb-5 max-[860px]:grid-cols-1" aria-label="Reports overview">
                    {overviewCards.map((c, i) => (
                        <article
                            key={i}
                            className={`relative overflow-hidden rounded-lg p-[1.4rem] text-white shadow-[0_10px_26px_rgba(44,36,41,0.12)] ${overviewBg[c.variant]}`}
                        >
                            <span className="absolute top-3 right-[0.85rem] px-[0.6rem] py-[0.2rem] rounded-full bg-white/20 text-[0.7rem] font-black tracking-[0.04em]">
                                {c.badge}
                            </span>
                            <div className="w-[2.4rem] h-[2.4rem] rounded-lg bg-white/20 grid place-items-center text-[1.2rem] mb-[0.6rem]">
                                <c.Icon />
                            </div>
                            <div className="text-[1.6rem] font-black leading-tight">{c.value}</div>
                            <div className="text-[0.82rem] opacity-90 mt-[0.2rem]">{c.label}</div>
                        </article>
                    ))}
                </section>

                {/* Company Earnings Line Chart */}
                <section className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-[1.1rem]">
                    <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                        <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                            <FiTrendingUp />
                            Company Earnings Over Time
                        </h3>
                        <div className="inline-flex gap-[0.35rem]">
                            {['day', 'month', 'year'].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className={[
                                        'px-[0.9rem] py-[0.4rem] rounded-md border-[1.5px] text-[0.78rem] font-extrabold cursor-pointer capitalize transition-all',
                                        period === p
                                            ? 'bg-maroon text-white border-maroon'
                                            : 'bg-white text-text-muted border-border-soft',
                                    ].join(' ')}
                                >
                                    {p === 'day' ? 'Daily' : p === 'month' ? 'Monthly' : 'Yearly'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading ? (
                        <div className="h-64 grid place-items-center text-text-muted italic">Loading chart...</div>
                    ) : earningsData.length === 0 ? (
                        <div className="h-64 grid place-items-center text-text-muted italic">No earnings data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={earningsData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip formatter={(v) => [`₱${parseFloat(v).toFixed(2)}`, 'Earnings']} />
                                <Legend />
                                <Line type="monotone" dataKey="earnings" stroke={C_MAROON} strokeWidth={2.5} dot={{ fill: C_MAROON, r: 4 }} activeDot={{ r: 6 }} name="Earnings (₱)" />
                                <Line type="monotone" dataKey="count" stroke={C_GOLD} strokeWidth={2} dot={{ fill: C_GOLD, r: 3 }} name="Transactions" />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </section>

                {/* Per Vehicle & Per Driver Charts */}
                <section className="grid grid-cols-2 gap-[1.1rem] mb-[1.1rem] max-[860px]:grid-cols-1">
                    {/* Per Vehicle */}
                    <div className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                        <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                            <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                                <FiTruck /> Earnings Per Vehicle
                            </h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={vehicleData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip formatter={(v, n) => [n === 'earnings' ? `₱${v}` : v, n === 'earnings' ? 'Earnings' : 'Passengers']} />
                                <Legend />
                                <Bar dataKey="earnings" fill={C_MAROON} name="Earnings (₱)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="passengers" fill={C_GOLD} name="Passengers" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Per Driver */}
                    <div className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                        <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                            <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                                <FiUsers /> Earnings Per Driver
                            </h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={driverData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip formatter={(v, n) => [n === 'earnings' ? `₱${v}` : v, n === 'earnings' ? 'Earnings' : 'Trips']} />
                                <Legend />
                                <Bar dataKey="earnings" fill={C_GREEN} name="Earnings (₱)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="trips" fill={C_BLUE} name="Trips" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Passengers Per Vehicle Per Period */}
                <section className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-[1.1rem]">
                    <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                        <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                            <FiUsers /> Passengers Per Vehicle Per Period
                        </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={[
                            { name: 'Jan', 'Bus-001': 120, 'Bus-002': 98,  'Bus-003': 145 },
                            { name: 'Feb', 'Bus-001': 132, 'Bus-002': 105, 'Bus-003': 138 },
                            { name: 'Mar', 'Bus-001': 118, 'Bus-002': 112, 'Bus-003': 160 },
                            { name: 'Apr', 'Bus-001': 145, 'Bus-002': 89,  'Bus-003': 142 },
                            { name: 'May', 'Bus-001': 130, 'Bus-002': 120, 'Bus-003': 155 },
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Bus-001" stroke={C_MAROON} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="Bus-002" stroke={C_GOLD}   strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="Bus-003" stroke={C_GREEN}  strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </section>

                {/* Revenue Breakdown Pie + Summary */}
                <section className="grid grid-cols-2 gap-[1.1rem] mb-[1.1rem] max-[860px]:grid-cols-1">
                    <div className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                        <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                            <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                                <FiPieChart /> Revenue Breakdown
                            </h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Topup Revenue', value: parseFloat(stats.totalRevenue || 0) },
                                        { name: 'Completed',     value: stats.completedTransactions || 0 },
                                        { name: 'Pending',       value: stats.pendingTransactions || 0 },
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={80}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                    <Cell fill={C_MAROON} />
                                    <Cell fill={C_GREEN} />
                                    <Cell fill={C_GOLD} />
                                </Pie>
                                <Tooltip formatter={(v) => `₱${parseFloat(v).toFixed(2)}`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Summary Stats */}
                    <div className="bg-white rounded-lg p-[1.4rem] shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                        <div className="flex justify-between items-center mb-[1.1rem] gap-4 flex-wrap">
                            <h3 className="m-0 text-maroon text-base font-black inline-flex items-center gap-[0.45rem]">
                                <FiList /> Summary Statistics
                            </h3>
                        </div>
                        <ul className="p-0 m-0 list-none">
                            {[
                                { label: 'Total Revenue',            value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`, cls: 'text-green-brand', Icon: FiDollarSign  },
                                { label: 'Total Users',              value: stats.totalUsers || 0,                                cls: 'text-maroon',      Icon: FiUsers       },
                                { label: 'Total Transactions',       value: stats.totalTransactions || 0,                         cls: 'text-[#b78a0e]',   Icon: FiBarChart2   },
                                { label: 'Completed Transactions',   value: stats.completedTransactions || 0,                     cls: 'text-green-brand', Icon: FiCheckCircle },
                                { label: 'Pending Transactions',     value: stats.pendingTransactions || 0,                       cls: 'text-[#d97706]',   Icon: FiClock       },
                                { label: 'Total Balance (All Users)',value: `₱${parseFloat(stats.totalBalance || 0).toFixed(2)}`, cls: 'text-maroon',      Icon: FiCreditCard  },
                            ].map((s, i) => (
                                <li key={i} className="flex justify-between items-center py-[0.65rem] border-b border-border-soft last:border-b-0 text-[0.86rem]">
                                    <span className="inline-flex items-center gap-2 text-text-main">
                                        <s.Icon />
                                        {s.label}
                                    </span>
                                    <span className={`font-black ${s.cls}`}>{s.value}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default ReportsPage;
