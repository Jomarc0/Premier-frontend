import { useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiBarChart2,
    FiCalendar,
    FiCreditCard,
    FiDollarSign,
    FiDownload,
    FiMoon,
    FiRefreshCw,
    FiSun,
    FiTruck,
    FiUsers,
} from 'react-icons/fi';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';

const COLORS = ['#6f2f3c', '#e8bd47', '#2f6b3d', '#3b6fb3', '#b24a52', '#8b5cf6'];

const RANGE_OPTIONS = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Yearly', value: 'yearly' },
    { label: 'Custom', value: 'custom' },
];

const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

const number = (value) => Number(value || 0).toLocaleString('en-PH');
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

const metricValue = (value, type) => {
    if (value === null || value === undefined) return 'Not stored';
    if (type === 'money') return money(value);
    if (type === 'percent') return percent(value);
    return number(value);
};

const flattenForExport = (payload) => {
    const rows = [];
    const visit = (path, value) => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => visit(`${path}[${index}]`, item));
            return;
        }
        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, next]) => visit(path ? `${path}.${key}` : key, next));
            return;
        }
        rows.push({ metric: path, value: value ?? '' });
    };
    visit('', payload);
    return rows;
};

const ReportsPage = () => {
    const [analytics, setAnalytics] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [filters, setFilters] = useState({
        range: 'monthly',
        from: '',
        to: '',
        route: '',
        bus: '',
    });

    const routes = useMemo(() => (
        [...new Set(vehicles.map(v => v.route).filter(Boolean))]
    ), [vehicles]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const params = {
                range: filters.range,
                ...(filters.from ? { from: filters.from } : {}),
                ...(filters.to ? { to: filters.to } : {}),
                ...(filters.route ? { route: filters.route } : {}),
                ...(filters.bus ? { bus: filters.bus } : {}),
            };
            const [analyticsRes, vehiclesRes] = await Promise.all([
                adminAPI.get('/analytics', { params }),
                adminAPI.get('/vehicles'),
            ]);
            setAnalytics(analyticsRes.data.data);
            setVehicles(vehiclesRes.data.data || []);
        } catch (err) {
            console.error('Failed to load analytics', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const download = (filename, content, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportCsv = () => {
        const rows = flattenForExport(analytics || {});
        const body = rows.map(row => `"${row.metric.replaceAll('"', '""')}","${String(row.value).replaceAll('"', '""')}"`).join('\n');
        download('admin-analytics.csv', `Metric,Value\n${body}`, 'text/csv');
    };

    const exportExcel = () => {
        const rows = flattenForExport(analytics || {});
        const body = rows.map(row => `<tr><td>${row.metric}</td><td>${row.value}</td></tr>`).join('');
        download('admin-analytics.xls', `<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${body}</tbody></table>`, 'application/vnd.ms-excel');
    };

    const exportPdf = () => {
        const rows = flattenForExport(analytics || {}).slice(0, 250);
        const popup = window.open('', '_blank');
        if (!popup) return;
        popup.document.write(`
            <html>
                <head>
                    <title>Admin Analytics</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                        h1 { color: #6f2f3c; }
                    </style>
                </head>
                <body>
                    <h1>Premier Transit Admin Analytics</h1>
                    <table>
                        <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                        <tbody>${rows.map(row => `<tr><td>${row.metric}</td><td>${row.value}</td></tr>`).join('')}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
        popup.print();
    };

    const executive = analytics?.executive || {};
    const passenger = analytics?.passengerAnalytics || {};
    const rfid = analytics?.rfidAnalytics || {};
    const revenue = analytics?.revenueAnalytics || {};
    const topUp = analytics?.topUpAnalytics || {};
    const bus = analytics?.busAnalytics || {};
    const gps = analytics?.gpsAnalytics || {};
    const queue = analytics?.queueTerminalAnalytics || {};
    const route = analytics?.routeAnalytics || {};
    const driver = analytics?.driverConductorAnalytics || {};
    const operational = analytics?.operationalAnalytics || {};
    const predictive = analytics?.predictiveAnalytics || {};

    const shellClass = darkMode
        ? 'bg-[#111827] text-slate-100'
        : '';
    const panelClass = darkMode
        ? 'bg-[#1f2937] text-slate-100 border border-slate-700'
        : 'bg-white text-text-main';

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={`${ui.workspace} ${shellClass}`}>
                <header className={ui.headerBar}>
                    <div>
                        <span className={ui.eyebrow}>Analytics</span>
                        <h1 className={ui.headerTitle}>Admin Analytics Dashboard</h1>
                        <p className="mt-1 mb-0 text-[0.8rem] text-text-muted">
                            RFID fare, passenger, bus, GPS, route, revenue, queue, and operational analytics from live system tables.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => setDarkMode(v => !v)} className={ui.adminAction}>
                            {darkMode ? <FiSun /> : <FiMoon />}
                            {darkMode ? 'Light' : 'Dark'}
                        </button>
                        <button type="button" onClick={exportCsv} className={ui.adminAction}>
                            <FiDownload /> CSV
                        </button>
                        <button type="button" onClick={exportExcel} className={ui.adminAction}>
                            <FiDownload /> Excel
                        </button>
                        <button type="button" onClick={exportPdf} className={ui.adminAction}>
                            <FiDownload /> PDF
                        </button>
                        <button type="button" onClick={fetchAnalytics} className={ui.adminActionRefresh}>
                            <FiRefreshCw />
                            Refresh
                        </button>
                    </div>
                </header>

                <section className={`${panelClass} rounded-lg p-4 shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-5`}>
                    <div className="grid grid-cols-6 gap-3 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-1">
                        <FilterSelect label="Range" value={filters.range} onChange={v => updateFilter('range', v)} options={RANGE_OPTIONS} />
                        <FilterInput label="From" type="date" value={filters.from} onChange={v => updateFilter('from', v)} />
                        <FilterInput label="To" type="date" value={filters.to} onChange={v => updateFilter('to', v)} />
                        <FilterSelect label="Route" value={filters.route} onChange={v => updateFilter('route', v)}
                            options={[{ label: 'All Routes', value: '' }, ...routes.map(r => ({ label: r, value: r }))]} />
                        <FilterSelect label="Bus" value={filters.bus} onChange={v => updateFilter('bus', v)}
                            options={[{ label: 'All Buses', value: '' }, ...vehicles.map(v => ({ label: v.plateNumber, value: v.plateNumber }))]} />
                        <button type="button" onClick={fetchAnalytics} className="rounded-md bg-maroon text-white font-black text-sm min-h-[2.65rem] self-end">
                            Apply Filters
                        </button>
                    </div>
                </section>

                {loading ? (
                    <div className={`${panelClass} rounded-lg p-8 text-center font-bold`}>Loading analytics...</div>
                ) : (
                    <>
                        <MetricGrid title="Executive Dashboard" metrics={[
                            ['Total Registered Passengers', executive.totalRegisteredPassengers, 'number', FiUsers],
                            ['Active Passengers Today', executive.activePassengersToday, 'number', FiUsers],
                            ['Total Revenue Today', executive.totalRevenueToday, 'money', FiDollarSign],
                            ['Revenue This Week', executive.revenueThisWeek, 'money', FiDollarSign],
                            ['Revenue This Month', executive.revenueThisMonth, 'money', FiDollarSign],
                            ['Active Buses', executive.activeBuses, 'number', FiTruck],
                            ['Buses On Route', executive.busesOnRoute, 'number', FiTruck],
                            ['Buses At Terminal', executive.busesAtTerminal, 'number', FiTruck],
                            ['Total Trips Today', executive.totalTripsToday, 'number', FiActivity],
                            ['Average Waiting Time', executive.averageWaitingTimeMinutes, 'number', FiCalendar],
                            ['Average Arrival Time', executive.averageArrivalTimeMinutes, 'number', FiCalendar],
                        ]} darkMode={darkMode} />

                        <section className="grid grid-cols-2 gap-5 mb-5 max-[1100px]:grid-cols-1">
                            <ChartPanel title="Passenger Growth Trend" panelClass={panelClass}>
                                <LineGraph data={passenger.passengerGrowthTrend || []} lines={[['count', '#6f2f3c', 'Passengers']]} />
                            </ChartPanel>
                            <ChartPanel title="Revenue Trend" panelClass={panelClass}>
                                <LineGraph data={revenue.revenueTrend || []} lines={[['revenue', '#2f6b3d', 'Revenue']]} moneyAxis />
                            </ChartPanel>
                            <ChartPanel title="Peak Travel Hours" panelClass={panelClass}>
                                <BarGraph data={passenger.peakTravelHours || []} bars={[['count', '#e8bd47', 'Trips']]} />
                            </ChartPanel>
                            <ChartPanel title="Route Usage Distribution" panelClass={panelClass}>
                                <PieGraph data={passenger.routeUsageDistribution || []} dataKey="passengers" />
                            </ChartPanel>
                        </section>

                        <AnalyticsSection title="Passenger Analytics" panelClass={panelClass}
                            summary={passenger.summary}
                            charts={[
                                ['Passenger Activity Trend', passenger.passengerActivityTrend, 'count'],
                                ['Route Usage Distribution', passenger.routeUsageDistribution, 'passengers'],
                            ]}
                            tableTitle="Most Active Passengers"
                            tableRows={passenger.mostActivePassengers}
                        />

                        <AnalyticsSection title="RFID Analytics" panelClass={panelClass}
                            summary={rfid.summary}
                            charts={[
                                ['RFID Usage Trend', rfid.rfidUsageTrend, 'count'],
                                ['RFID Activity Distribution', rfid.rfidActivityDistribution, 'count'],
                            ]}
                        />

                        <AnalyticsSection title="Revenue Analytics" panelClass={panelClass}
                            summary={revenue.summary}
                            charts={[
                                ['Revenue Per Route', revenue.revenuePerRoute, 'revenue'],
                                ['Revenue Per Bus', revenue.revenuePerBus, 'revenue'],
                                ['Monthly Revenue Comparison', revenue.monthlyRevenueComparison, 'revenue'],
                            ]}
                        />

                        <AnalyticsSection title="Top-Up Analytics" panelClass={panelClass}
                            summary={topUp.summary}
                            charts={[
                                ['Top-Up Trend', topUp.topUpTrend, 'revenue'],
                                ['Monthly Top-Up Volume', topUp.monthlyTopUpVolume, 'count'],
                            ]}
                        />

                        <AnalyticsSection title="Bus Analytics" panelClass={panelClass}
                            summary={bus.summary}
                            charts={[
                                ['Bus Utilization', bus.tripsPerBus, 'trips'],
                                ['Passenger Distribution Per Bus', bus.passengerDistributionPerBus, 'passengers'],
                                ['Revenue Per Bus', bus.revenuePerBus, 'revenue'],
                            ]}
                        />

                        <AnalyticsSection title="GPS Analytics" panelClass={panelClass}
                            summary={gps.summary}
                            charts={[
                                ['Distance Traveled Trend', gps.distanceTraveledTrend, 'distanceKm'],
                                ['Distance Per Route', gps.distancePerRoute, 'distanceKm'],
                                ['Distance Per Bus', gps.distancePerBus, 'distanceKm'],
                            ]}
                        />

                        <AnalyticsSection title="Queue and Terminal Analytics" panelClass={panelClass}
                            summary={queue.summary}
                            charts={[
                                ['Queue Trend', queue.queueTrend, 'count'],
                                ['Waiting Time Trend', queue.waitingTimeTrend, 'minutes'],
                                ['Arrival Performance Trend', queue.arrivalPerformanceTrend, 'count'],
                            ]}
                        />

                        <AnalyticsSection title="Route Analytics" panelClass={panelClass}
                            summary={route.summary}
                            charts={[
                                ['Route Popularity', route.routePopularity, 'passengers'],
                                ['Passenger Distribution By Route', route.passengerDistributionByRoute, 'passengers'],
                                ['Revenue By Route', route.revenueByRoute, 'revenue'],
                            ]}
                        />

                        <AnalyticsSection title="Driver and Conductor Analytics" panelClass={panelClass}
                            summary={driver.summary}
                            charts={[
                                ['Driver Performance', driver.driverPerformance, 'trips'],
                                ['Passengers Served By Driver', driver.passengersServedByDriver, 'passengers'],
                                ['Revenue By Driver', driver.revenueByDriver, 'revenue'],
                            ]}
                        />

                        <AnalyticsSection title="Operational Analytics" panelClass={panelClass}
                            summary={operational.summary}
                            charts={[
                                ['Occupancy Per Bus', operational.occupancyPerBus, 'occupancyRate'],
                                ['Occupancy Per Route', operational.occupancyPerRoute, 'occupancyRate'],
                                ['Fleet Utilization Trend', operational.fleetUtilizationTrend, 'occupancyRate'],
                            ]}
                        />

                        <section className={`${panelClass} rounded-lg p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-5`}>
                            <h2 className="m-0 mb-4 text-maroon text-lg font-black flex items-center gap-2">
                                <FiBarChart2 /> Predictive Analytics
                            </h2>
                            <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 mb-4">
                                <SmallMetric label="Expected Passengers Tomorrow" value={predictive.expectedPassengersTomorrow} />
                                <SmallMetric label="Expected Revenue Tomorrow" value={money(predictive.expectedRevenueTomorrow)} />
                                <SmallMetric label="Expected Peak Travel Hours" value={(predictive.expectedPeakTravelHours || []).map(h => h.name).join(', ') || 'Not enough data'} />
                                <SmallMetric label="Routes Requiring Additional Buses" value={(predictive.routesRequiringAdditionalBuses || []).join(', ') || 'None'} />
                            </div>
                            <p className="text-xs text-text-muted mb-4">
                                Method: {predictive.method || 'Moving average from historical fare activity'}
                            </p>
                            <LineGraph data={predictive.revenueForecast || []} lines={[['revenue', '#6f2f3c', 'Forecast Revenue']]} moneyAxis />
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};

const FilterInput = ({ label, type, value, onChange }) => (
    <label className="grid gap-1 text-xs font-black text-text-muted uppercase">
        {label}
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-border-soft px-3 py-2 text-sm normal-case font-semibold text-text-main"
        />
    </label>
);

const FilterSelect = ({ label, value, onChange, options }) => (
    <label className="grid gap-1 text-xs font-black text-text-muted uppercase">
        {label}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-md border border-border-soft px-3 py-2 text-sm normal-case font-semibold text-text-main"
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
            ))}
        </select>
    </label>
);

const MetricGrid = ({ title, metrics, darkMode }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">{title}</h2>
        <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
            {metrics.map(([label, value, type, Icon]) => (
                <article
                    key={label}
                    className={`rounded-lg p-4 shadow-[0_10px_26px_rgba(44,36,41,0.08)] ${darkMode ? 'bg-[#1f2937] border border-slate-700' : 'bg-white'}`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-text-muted font-black uppercase">{label}</div>
                        <Icon className="text-maroon" />
                    </div>
                    <div className="text-xl font-black text-maroon mt-2">{metricValue(value, type)}</div>
                </article>
            ))}
        </div>
    </section>
);

const SmallMetric = ({ label, value }) => (
    <div className="rounded-md bg-page-bg p-3 border border-border-soft">
        <div className="text-xs text-text-muted font-black uppercase">{label}</div>
        <div className="text-base font-black text-maroon mt-1">{value ?? 'Not stored'}</div>
    </div>
);

const ChartPanel = ({ title, children, panelClass }) => (
    <section className={`${panelClass} rounded-lg p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]`}>
        <h3 className="m-0 mb-4 text-maroon text-base font-black">{title}</h3>
        {children}
    </section>
);

const AnalyticsSection = ({ title, summary = {}, charts = [], tableTitle, tableRows, panelClass }) => (
    <section className={`${panelClass} rounded-lg p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-5`}>
        <h2 className="m-0 mb-4 text-maroon text-lg font-black">{title}</h2>
        <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1 mb-5">
            {Object.entries(summary || {}).map(([key, value]) => (
                <SmallMetric key={key} label={key.replace(/([A-Z])/g, ' $1')} value={typeof value === 'object' && value !== null ? value.name || value.value : metricValue(value)} />
            ))}
        </div>
        <div className="grid grid-cols-3 gap-4 max-[1200px]:grid-cols-1">
            {charts.map(([chartTitle, data, dataKey]) => (
                <ChartPanel key={chartTitle} title={chartTitle} panelClass="bg-page-bg">
                    <BarGraph data={data || []} bars={[[dataKey, '#6f2f3c', chartTitle]]} />
                </ChartPanel>
            ))}
        </div>
        {tableRows?.length > 0 && (
            <div className="mt-5">
                <h3 className="m-0 mb-2 text-maroon text-base font-black">{tableTitle}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <tbody>
                            {tableRows.map((row, index) => (
                                <tr key={index} className="border-b border-border-soft">
                                    {Object.entries(row).map(([key, value]) => (
                                        <td key={key} className="py-2 pr-4">
                                            <span className="font-black text-text-muted uppercase text-[0.68rem]">{key}: </span>
                                            {String(value)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </section>
);

const LineGraph = ({ data, lines, moneyAxis }) => (
    <div className="h-72 w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyAxis ? v => `PHP ${v}` : undefined} />
                    <Tooltip formatter={(value) => moneyAxis ? money(value) : number(value)} />
                    <Legend />
                    {lines.map(([key, color, name]) => (
                        <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} name={name} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        ) : (
            <EmptyChart />
        )}
    </div>
);

const BarGraph = ({ data, bars }) => (
    <div className="h-64 w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    {bars.map(([key, color, name]) => (
                        <Bar key={key} dataKey={key} fill={color} name={name} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <EmptyChart />
        )}
    </div>
);

const PieGraph = ({ data, dataKey }) => (
    <div className="h-72 w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height={288} minWidth={0}>
                <PieChart>
                    <Pie data={data} dataKey={dataKey} nameKey="name" outerRadius={90} label>
                        {data.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        ) : (
            <EmptyChart />
        )}
    </div>
);

const EmptyChart = () => (
    <div className="h-full grid place-items-center rounded-md border border-dashed border-border-soft text-text-muted text-sm font-bold">
        No stored data for this chart yet
    </div>
);

export default ReportsPage;
