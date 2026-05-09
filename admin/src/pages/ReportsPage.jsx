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

    // ✅ Group transactions by period
    const groupByPeriod = (txList, p) => {
        const groups = {};
        txList.forEach(tx => {
            if (!tx.createdAt) return;
            const date = new Date(tx.createdAt);
            let key;
            if (p === 'day') {
                key = date.toLocaleDateString('en-PH', {
                    month: 'short', day: 'numeric'
                });
            } else if (p === 'month') {
                key = date.toLocaleDateString('en-PH', {
                    month: 'short', year: 'numeric'
                });
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

    // ✅ Mock vehicle/driver data — replace with real API when available
    const vehicleData = [
        { name: 'Bus-001', passengers: 120, earnings: 2400 },
        { name: 'Bus-002', passengers: 98, earnings: 1960 },
        { name: 'Bus-003', passengers: 145, earnings: 2900 },
        { name: 'Bus-004', passengers: 76, earnings: 1520 },
        { name: 'Bus-005', passengers: 110, earnings: 2200 },
    ];

    const driverData = [
        { name: 'Driver A', trips: 45, earnings: 3200 },
        { name: 'Driver B', trips: 38, earnings: 2800 },
        { name: 'Driver C', trips: 52, earnings: 3900 },
        { name: 'Driver D', trips: 29, earnings: 2100 },
        { name: 'Driver E', trips: 41, earnings: 3100 },
    ];

    // Brand chart palette
    const C_MAROON = '#6f2f3c';
    const C_GOLD   = '#e8bd47';
    const C_GREEN  = '#2f6b3d';
    const C_BLUE   = '#3b6fb3';

    const overviewCards = [
        {
            label: 'Total Topup Earnings',
            value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`,
            variant: 'gold', badge: 'Topups', Icon: FiCreditCard,
        },
        {
            label: 'Total Users',
            value: stats.totalUsers || 0,
            variant: 'maroon', badge: 'Passengers', Icon: FiUsers,
        },
        {
            label: 'Total Transactions',
            value: stats.totalTransactions || 0,
            variant: 'green', badge: 'Total', Icon: FiTrendingUp,
        },
    ];

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-workspace">

                {/* Header */}
                <header className="admin-header admin-plain-header">
                    <div>
                        <span className="eyebrow">Analytics</span>
                        <h1>Reports & Analytics</h1>
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

                {/* Overview Cards */}
                <section className="overview-grid" aria-label="Reports overview">
                    {overviewCards.map((c, i) => (
                        <article key={i} className={`overview-card ${c.variant}`}>
                            <span className="badge">{c.badge}</span>
                            <div className="icon-wrap"><c.Icon /></div>
                            <div className="value">{c.value}</div>
                            <div className="label">{c.label}</div>
                        </article>
                    ))}
                </section>

                {/* Company Earnings Line Chart */}
                <section className="chart-card">
                    <div className="chart-card-header">
                        <h3>
                            <FiTrendingUp />
                            Company Earnings Over Time
                        </h3>
                        {/* Period Toggle */}
                        <div className="period-toggle">
                            {['day', 'month', 'year'].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className={period === p ? 'active' : ''}
                                >
                                    {p === 'day' ? 'Daily'
                                        : p === 'month' ? 'Monthly'
                                        : 'Yearly'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {loading ? (
                        <div className="chart-empty">Loading chart...</div>
                    ) : earningsData.length === 0 ? (
                        <div className="chart-empty">No earnings data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={earningsData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip
                                    formatter={(v) => [`₱${parseFloat(v).toFixed(2)}`, 'Earnings']}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="earnings"
                                    stroke={C_MAROON}
                                    strokeWidth={2.5}
                                    dot={{ fill: C_MAROON, r: 4 }}
                                    activeDot={{ r: 6 }}
                                    name="Earnings (₱)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke={C_GOLD}
                                    strokeWidth={2}
                                    dot={{ fill: C_GOLD, r: 3 }}
                                    name="Transactions"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </section>

                {/* Per Vehicle & Per Driver Charts */}
                <section className="charts-grid-2">
                    {/* Per Vehicle */}
                    <div className="chart-card" style={{ marginBottom: 0 }}>
                        <div className="chart-card-header">
                            <h3><FiTruck /> Earnings Per Vehicle</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={vehicleData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip
                                    formatter={(v, n) => [
                                        n === 'earnings' ? `₱${v}` : v,
                                        n === 'earnings' ? 'Earnings' : 'Passengers'
                                    ]}
                                />
                                <Legend />
                                <Bar
                                    dataKey="earnings"
                                    fill={C_MAROON}
                                    name="Earnings (₱)"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="passengers"
                                    fill={C_GOLD}
                                    name="Passengers"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Per Driver */}
                    <div className="chart-card" style={{ marginBottom: 0 }}>
                        <div className="chart-card-header">
                            <h3><FiUsers /> Earnings Per Driver</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={driverData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                                <Tooltip
                                    formatter={(v, n) => [
                                        n === 'earnings' ? `₱${v}` : v,
                                        n === 'earnings' ? 'Earnings' : 'Trips'
                                    ]}
                                />
                                <Legend />
                                <Bar
                                    dataKey="earnings"
                                    fill={C_GREEN}
                                    name="Earnings (₱)"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="trips"
                                    fill={C_BLUE}
                                    name="Trips"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Passengers Per Vehicle Per Period */}
                <section className="chart-card">
                    <div className="chart-card-header">
                        <h3><FiUsers /> Passengers Per Vehicle Per Period</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={[
                            { name: 'Jan', 'Bus-001': 120, 'Bus-002': 98, 'Bus-003': 145 },
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
                <section className="charts-grid-2">
                    <div className="chart-card" style={{ marginBottom: 0 }}>
                        <div className="chart-card-header">
                            <h3><FiPieChart /> Revenue Breakdown</h3>
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
                                    label={({ name, percent }) =>
                                        `${name}: ${(percent * 100).toFixed(0)}%`}
                                >
                                    <Cell fill={C_MAROON} />
                                    <Cell fill={C_GREEN} />
                                    <Cell fill={C_GOLD} />
                                </Pie>
                                <Tooltip
                                    formatter={(v) => `₱${parseFloat(v).toFixed(2)}`}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Summary Stats */}
                    <div className="chart-card" style={{ marginBottom: 0 }}>
                        <div className="chart-card-header">
                            <h3><FiList /> Summary Statistics</h3>
                        </div>
                        <ul className="summary-list">
                            {[
                                {
                                    label: 'Total Revenue',
                                    value: `₱${parseFloat(stats.totalRevenue || 0).toFixed(2)}`,
                                    cls: 'green', Icon: FiDollarSign,
                                },
                                {
                                    label: 'Total Users',
                                    value: stats.totalUsers || 0,
                                    cls: '', Icon: FiUsers,
                                },
                                {
                                    label: 'Total Transactions',
                                    value: stats.totalTransactions || 0,
                                    cls: 'gold', Icon: FiBarChart2,
                                },
                                {
                                    label: 'Completed Transactions',
                                    value: stats.completedTransactions || 0,
                                    cls: 'green', Icon: FiCheckCircle,
                                },
                                {
                                    label: 'Pending Transactions',
                                    value: stats.pendingTransactions || 0,
                                    cls: 'warn', Icon: FiClock,
                                },
                                {
                                    label: 'Total Balance (All Users)',
                                    value: `₱${parseFloat(stats.totalBalance || 0).toFixed(2)}`,
                                    cls: '', Icon: FiCreditCard,
                                },
                            ].map((s, i) => (
                                <li key={i}>
                                    <span className="label-cell">
                                        <s.Icon />
                                        {s.label}
                                    </span>
                                    <span className={`value-cell ${s.cls}`}>{s.value}</span>
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
