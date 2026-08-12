import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertTriangle,
    FiBarChart2,
    FiClock,
    FiCreditCard,
    FiDownload,
    FiInfo,
    FiRefreshCw,
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
import { captureEvent } from '../lib/posthog';
import { useRealtime } from '../context/RealtimeContext';
import { phtDateKey } from '../lib/time';

const COLORS = ['#6f2f3c', '#e8bd47', '#2f6b3d', '#b24a52', '#58606f', '#9a7b21'];
const TIMEZONE = 'Asia/Manila';

const RANGE_OPTIONS = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: 'last7' },
    { label: 'Last 30 Days', value: 'last30' },
    { label: 'This Month', value: 'thismonth' },
    { label: 'Custom', value: 'custom' },
];

const DEFAULT_FILTERS = {
    range: 'last7',
    startDate: '',
    endDate: '',
    busId: '',
    routeId: '',
    paymentMethod: '',
};

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

const number = (value) => Number(value || 0).toLocaleString('en-PH');
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;

const metricFormatters = {
    money,
    number,
    percent,
};

const kpiConfig = [
    ['fareRevenue', 'Total Fare Revenue', 'money', FiCreditCard, 'Successful RFID, QR, and NFC fare payments only.'],
    ['successfulTransactions', 'Successful Transactions', 'number', FiActivity, 'Successful fare transactions in the selected period.'],
    ['activePassengers', 'Active Passengers', 'number', FiUsers, 'Unique passengers with at least one successful fare transaction.'],
    ['activeBuses', 'Active Buses', 'number', FiTruck, 'Buses active by trip, status, or recent GPS/device activity.'],
    ['paymentSuccessRate', 'Payment Success Rate', 'percent', FiBarChart2, 'Successful fare attempts divided by all fare attempts.'],
    ['pendingTopUps', 'Pending Top-Ups', 'number', FiClock, 'Top-up requests still pending or processing.'],
    ['openTickets', 'Open Support Tickets', 'number', FiAlertTriangle, 'Support tickets not yet resolved or rejected.'],
    ['offlineDevices', 'Offline Devices', 'number', FiAlertTriangle, 'Active devices without a valid recent heartbeat.'],
];

const readFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        range: params.get('range') || DEFAULT_FILTERS.range,
        startDate: params.get('startDate') || '',
        endDate: params.get('endDate') || '',
        busId: params.get('busId') || '',
        routeId: params.get('routeId') || '',
        paymentMethod: params.get('paymentMethod') || '',
    };
};

const ReportsPage = () => {
    const { subscribe } = useRealtime();
    const [analytics, setAnalytics] = useState(null);
    const [filters, setFilters] = useState(readFiltersFromUrl);
    const [appliedFilters, setAppliedFilters] = useState(readFiltersFromUrl);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState('');
    const [error, setError] = useState('');
    const [filterError, setFilterError] = useState('');

    const buildParams = useCallback((source) => {
        const params = {
            range: source.range,
            timezone: TIMEZONE,
            ...(source.range === 'custom' && source.startDate ? { startDate: source.startDate } : {}),
            ...(source.range === 'custom' && source.endDate ? { endDate: source.endDate } : {}),
            ...(source.busId ? { busId: source.busId } : {}),
            ...(source.routeId ? { routeId: source.routeId } : {}),
            ...(source.paymentMethod ? { paymentMethod: source.paymentMethod } : {}),
        };
        return params;
    }, []);

    const syncUrl = useCallback((source) => {
        const params = new URLSearchParams(buildParams(source));
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }, [buildParams]);

    const fetchAnalytics = useCallback(async (source, mode = 'load') => {
        if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const response = await adminAPI.get('/analytics/dashboard', {
                params: buildParams(source),
            });
            setAnalytics(response.data.data);
            setAppliedFilters(source);
            syncUrl(source);
        } catch (err) {
            console.error('Failed to load analytics dashboard', err);
            setError('Analytics data is currently unavailable.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [buildParams, syncUrl]);

    useEffect(() => {
        Promise.resolve().then(() => fetchAnalytics(readFiltersFromUrl(), 'load'));
    }, [fetchAnalytics]);

    useEffect(() => subscribe((event) => {
        if (['TRANSACTION', 'TOPUP', 'SUPPORT_TICKET', 'PASSENGER', 'VEHICLE'].includes(event.entity)) {
            fetchAnalytics(appliedFilters, 'refresh');
        }
    }), [appliedFilters, fetchAnalytics, subscribe]);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setFilterError('');
    };

    const applyFilters = () => {
        if (filters.range === 'custom') {
            if (!filters.startDate || !filters.endDate) {
                setFilterError('Choose both start and end dates.');
                return;
            }
            if (filters.startDate > filters.endDate) {
                setFilterError('Start date cannot be after end date.');
                return;
            }
            const today = phtDateKey();
            if (filters.startDate > today || filters.endDate > today) {
                setFilterError('Future date ranges are not supported.');
                return;
            }
        }
        fetchAnalytics(filters, 'load');
    };

    const summary = analytics?.summary || {};
    const charts = analytics?.charts || {};
    const recent = analytics?.recent || {};
    const options = analytics?.options || {};

    const exportRows = useMemo(() => buildExportRows(analytics), [analytics]);

    const exportFile = async (type) => {
        if (!analytics) return;
        setExporting(type);
        try {
            const stamp = phtDateKey();
            if (type === 'csv') {
                const body = exportRows.map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
                download(`admin-analytics-${stamp}.csv`, body, 'text/csv');
            } else if (type === 'excel') {
                const body = exportRows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
                download(`admin-analytics-${stamp}.xls`, `<table>${body}</table>`, 'application/vnd.ms-excel');
            } else {
                printPdfReport(analytics, exportRows);
            }
            captureEvent('admin_analytics_exported', {
                export_type: type,
                range: appliedFilters.range,
                has_custom_dates: Boolean(appliedFilters.startDate || appliedFilters.endDate),
                has_bus_filter: Boolean(appliedFilters.busId),
                has_route_filter: Boolean(appliedFilters.routeId),
                has_payment_filter: Boolean(appliedFilters.paymentMethod),
            });
        } catch (err) {
            console.error('Analytics export failed', err);
        } finally {
            setExporting('');
        }
    };

    return (
        <div className={ui.layout}>
            <AdminSidebar />
            <main className={ui.workspace}>
                <AnalyticsHeader
                    loading={loading || refreshing}
                    exporting={exporting}
                    onExport={exportFile}
                    onRefresh={() => fetchAnalytics(appliedFilters, 'refresh')}
                />

                <AnalyticsFilters
                    filters={filters}
                    options={options}
                    loading={loading || refreshing}
                    error={filterError}
                    onChange={updateFilter}
                    onApply={applyFilters}
                />

                {error ? (
                    <RetryPanel message={error} onRetry={() => fetchAnalytics(appliedFilters, 'refresh')} />
                ) : (
                    <>
                        <AnalyticsSummaryGrid loading={loading} summary={summary} />
                        <AnalyticsChartGrid loading={loading} charts={charts} />
                        {analytics?.forecast && !analytics.forecast.available && (
                            <ForecastAvailabilityCard forecast={analytics.forecast} />
                        )}
                        <RecentActivity loading={loading} recent={recent} />
                    </>
                )}
            </main>
        </div>
    );
};

const AnalyticsHeader = ({ loading, exporting, onExport, onRefresh }) => (
    <header className={`${ui.headerBar} items-start`}>
        <div>
            <span className={ui.eyebrow}>Analytics</span>
            <h1 className={ui.headerTitle}>Admin Analytics Dashboard</h1>
            <p className="mt-1 mb-0 text-[0.82rem] leading-5 text-text-muted max-w-3xl">
                Monitor fare revenue, passenger activity, payment performance, fleet operations, terminal queues, tickets, and system alerts.
            </p>
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
            <ActionButton disabled={loading || exporting} onClick={() => onExport('csv')} label="CSV" icon={FiDownload} busy={exporting === 'csv'} />
            <ActionButton disabled={loading || exporting} onClick={() => onExport('excel')} label="Excel" icon={FiDownload} busy={exporting === 'excel'} />
            <ActionButton disabled={loading || exporting} onClick={() => onExport('pdf')} label="PDF" icon={FiDownload} busy={exporting === 'pdf'} />
            <ActionButton primary disabled={loading || exporting} onClick={onRefresh} label="Refresh" icon={FiRefreshCw} busy={loading} />
        </div>
    </header>
);

const ActionButton = ({ primary, disabled, onClick, label, icon, busy }) => {
    const ButtonIcon = icon;
    return (
        <button type="button" disabled={disabled} onClick={onClick} className={`${primary ? ui.adminActionRefresh : ui.adminAction} disabled:opacity-60 disabled:cursor-not-allowed`}>
            <ButtonIcon className={busy ? 'animate-spin' : ''} /> {busy ? 'Working' : label}
        </button>
    );
};

const AnalyticsFilters = ({ filters, options, loading, error, onChange, onApply }) => (
    <section className="rounded-lg bg-white p-4 shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-5">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end max-[1200px]:grid-cols-3 max-[760px]:grid-cols-1">
            <FilterSelect label="Date Range" value={filters.range} onChange={v => onChange('range', v)} options={RANGE_OPTIONS} />
            {filters.range === 'custom' && (
                <>
                    <FilterInput label="From" value={filters.startDate} onChange={v => onChange('startDate', v)} />
                    <FilterInput label="To" value={filters.endDate} onChange={v => onChange('endDate', v)} />
                </>
            )}
            <FilterSelect label="Bus" value={filters.busId} onChange={v => onChange('busId', v)}
                options={[{ label: 'All', value: '' }, ...(options.buses || [])]} />
            <FilterSelect label="Route" value={filters.routeId} onChange={v => onChange('routeId', v)}
                options={[{ label: 'All', value: '' }, ...(options.routes || [])]} />
            <FilterSelect label="Payment Method" value={filters.paymentMethod} onChange={v => onChange('paymentMethod', v)}
                options={[{ label: 'All', value: '' }, ...(options.paymentMethods || ['RFID', 'QR', 'NFC']).map(method => ({ label: method, value: method }))]} />
            <button type="button" disabled={loading} onClick={onApply} className={`${ui.adminActionPrimary} min-w-32 justify-center disabled:opacity-60`}>
                Apply Filters
            </button>
        </div>
        {error && <p className="mt-3 mb-0 text-sm font-bold text-danger-muted">{error}</p>}
    </section>
);

const FilterInput = ({ label, value, onChange }) => (
    <label className="grid gap-1 text-xs font-black text-text-muted">
        {label}
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[2.65rem] rounded-md border border-border-soft px-3 text-sm font-semibold text-text-main outline-none focus:border-gold"
        />
    </label>
);

const FilterSelect = ({ label, value, onChange, options }) => (
    <label className="grid gap-1 text-xs font-black text-text-muted">
        {label}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[2.65rem] rounded-md border border-border-soft px-3 text-sm font-semibold text-text-main outline-none focus:border-gold"
        >
            {options.map(option => (
                <option key={option.value || option.id || option.label} value={option.value ?? option.id}>{option.label}</option>
            ))}
        </select>
    </label>
);

const AnalyticsSummaryGrid = ({ loading, summary }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">Executive Summary</h2>
        <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
            {kpiConfig.map(([key, label, type, Icon, help]) => (
                <KpiCard key={key} loading={loading} label={label} value={summary[key]} type={type} icon={Icon} help={help} />
            ))}
        </div>
    </section>
);

const KpiCard = ({ loading, label, value, type, icon, help }) => {
    const CardIcon = icon;
    return (
        <article className="min-h-[7rem] rounded-lg bg-white p-4 shadow-[0_10px_26px_rgba(44,36,41,0.08)] border-l-4 border-maroon">
            {loading ? (
                <SkeletonBlock />
            ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-[0.78rem] font-black text-text-muted">{label}</div>
                        <span title={help} className="inline-flex items-center gap-1 text-maroon">
                            <CardIcon />
                        </span>
                    </div>
                    <div className="mt-2 text-[1.55rem] font-black text-maroon">{metricFormatters[type](value)}</div>
                    <p className="m-0 mt-1 text-[0.72rem] leading-4 text-text-muted">{help}</p>
                </>
            )}
        </article>
    );
};

const AnalyticsChartGrid = ({ loading, charts }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">Revenue and Operations</h2>
        <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(18rem,1fr)] gap-5 max-[1100px]:grid-cols-1 mb-5">
            <AnalyticsChartCard title="Revenue Trend" loading={loading} wide>
                <LineGraph data={charts.revenueTrend || []} lines={[['revenue', '#6f2f3c', 'Revenue']]} moneyAxis />
            </AnalyticsChartCard>
            <AnalyticsChartCard title="Transactions by Payment Method" loading={loading}>
                <DonutGraph data={charts.transactionsByPaymentMethod || []} dataKey="count" />
            </AnalyticsChartCard>
        </div>
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1 mb-5">
            <AnalyticsChartCard title="Passenger Activity Trend" loading={loading}>
                <LineGraph data={charts.passengerActivityTrend || []} lines={[['passengers', '#2f6b3d', 'Passengers']]} />
            </AnalyticsChartCard>
            <AnalyticsChartCard title="Peak Travel Hours" loading={loading}>
                <BarGraph data={charts.peakTravelHours || []} bars={[['count', '#e8bd47', 'Transactions']]} />
            </AnalyticsChartCard>
        </div>
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
            <AnalyticsChartCard title="Trips and Passengers by Bus" loading={loading}>
                <BarGraph data={charts.tripsAndPassengersByBus || []} bars={[['completedTrips', '#6f2f3c', 'Completed Trips'], ['passengersServed', '#2f6b3d', 'Passengers Served']]} />
            </AnalyticsChartCard>
            <AnalyticsChartCard title="Queue Length by Terminal" loading={loading}>
                <BarGraph data={charts.queueLengthByTerminal || []} bars={[['queueCount', '#b24a52', 'Queue Count']]} />
            </AnalyticsChartCard>
        </div>
    </section>
);

const AnalyticsChartCard = ({ title, loading, children }) => (
    <section data-chart-card className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] min-w-0">
        <h3 className="m-0 mb-4 text-maroon text-base font-black">{title}</h3>
        {loading ? <ChartSkeleton /> : children}
    </section>
);

const RecentActivity = ({ loading, recent }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">Recent Activity</h2>
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)_minmax(18rem,1fr)] gap-5 max-[1300px]:grid-cols-1">
            <RecentFareTransactionsTable loading={loading} rows={recent.fareTransactions || []} />
            <RecentSupportTicketsTable loading={loading} rows={recent.supportTickets || []} />
            <SystemAlertsList loading={loading} rows={recent.systemAlerts || []} />
        </div>
    </section>
);

const RecentFareTransactionsTable = ({ loading, rows }) => (
    <ActivityPanel title="Recent Fare Transactions" actionHref="/admin/transactions" loading={loading} empty={rows.length === 0} emptyTitle="No fare transactions" emptyText="No successful fare payments match the selected filters.">
        <div className="divide-y divide-border-soft">
            {rows.map((row, index) => (
                <article key={`${row.time}-${index}`} className="py-3 first:pt-0 last:pb-0 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="font-black text-sm text-maroon truncate">{row.maskedCardNumber || 'Card unavailable'}</div>
                            <div className="mt-1 text-xs text-text-muted">{row.time || 'Time unavailable'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="font-black text-sm text-text-main">{money(row.amount)}</div>
                            <StatusPill status={row.status} />
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-maroon/8 px-2 py-1 font-black text-maroon">{row.paymentMethod || 'Unknown method'}</span>
                        <span className="text-text-muted">Bus: <strong className="text-text-main">{row.bus || 'Not assigned'}</strong></span>
                    </div>
                </article>
            ))}
        </div>
    </ActivityPanel>
);

const RecentSupportTicketsTable = ({ loading, rows }) => (
    <ActivityPanel title="Recent Support Tickets" actionHref="/admin/support-tickets" loading={loading} empty={rows.length === 0} emptyTitle="No support tickets" emptyText="No support tickets are currently available.">
        <div className="divide-y divide-border-soft">
            {rows.map((row, index) => (
                <article key={`${row.ticketNumber}-${index}`} className="py-3 first:pt-0 last:pb-0 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="font-black text-sm text-maroon truncate">{row.ticketNumber || 'Ticket unavailable'}</div>
                            <div className="mt-1 text-xs text-text-muted">{row.dateSubmitted || 'Date unavailable'}</div>
                        </div>
                        <StatusPill status={row.status} />
                    </div>
                    <div className="mt-2 text-xs text-text-main">{row.category || 'Uncategorized'}</div>
                </article>
            ))}
        </div>
    </ActivityPanel>
);

const SystemAlertsList = ({ loading, rows }) => (
    <ActivityPanel title="System Alerts" loading={loading} empty={rows.length === 0} emptyTitle="No current alerts" emptyText="There are no reliable device, GPS, or queue alerts to show.">
        <div className="grid gap-3">
            {rows.map((alert, index) => (
                <div key={`${alert.title}-${index}`} className="rounded-md border border-border-soft p-3 bg-page-bg">
                    <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-maroon">{alert.title}</strong>
                        <StatusPill status={alert.severity} />
                    </div>
                    <p className="m-0 mt-1 text-sm text-text-main">{alert.message}</p>
                    <p className="m-0 mt-1 text-xs text-text-muted">{alert.time}</p>
                </div>
            ))}
        </div>
    </ActivityPanel>
);

const ActivityPanel = ({ title, actionHref, loading, empty, emptyTitle, emptyText, children }) => (
    <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="m-0 text-maroon text-base font-black">{title}</h3>
            {actionHref && <a href={actionHref} className="text-xs font-black text-maroon hover:text-gold">View All</a>}
        </div>
        {loading ? <TableSkeleton /> : empty ? (
            <AnalyticsEmptyState title={emptyTitle} text={emptyText} />
        ) : children}
    </section>
);

const DataTable = ({ rows, columns }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
            <thead>
                <tr>
                    {columns.map(([, label]) => (
                        <th key={label} className="py-2 pr-3 text-left text-[0.7rem] font-black text-text-muted">{label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, index) => (
                    <tr key={index} className="border-t border-border-soft">
                        {columns.map(([key,, formatter]) => (
                            <td key={key} className="py-2 pr-3 align-top text-text-main">
                                {formatter ? formatter(row[key]) : row[key] || 'Not available'}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const StatusPill = ({ status }) => {
    const tone = status === 'Critical' ? 'bg-[#fce4ec] text-danger-muted' : status === 'Warning' ? 'bg-[#fff4d5] text-[#9a6a00]' : 'bg-[#eef2f7] text-text-muted';
    return <span className={`rounded-full px-2 py-1 text-[0.65rem] font-black ${tone}`}>{status}</span>;
};

const ForecastAvailabilityCard = ({ forecast }) => (
    <section className="rounded-lg bg-white p-4 shadow-[0_10px_26px_rgba(44,36,41,0.08)] mb-5 border-l-4 border-gold">
        <div className="flex items-start gap-3">
            <FiInfo className="mt-1 text-maroon" />
            <div>
                <h2 className="m-0 text-base font-black text-maroon">Forecast Insights</h2>
                <p className="m-0 mt-1 text-sm text-text-muted">{forecast.message}</p>
            </div>
        </div>
    </section>
);

const RetryPanel = ({ message, onRetry }) => (
    <section className="rounded-lg bg-white p-8 text-center shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
        <FiAlertTriangle className="mx-auto mb-3 text-2xl text-danger-muted" />
        <h2 className="m-0 text-lg font-black text-maroon">{message}</h2>
        <p className="mt-1 text-sm text-text-muted">Please check your connection and try again.</p>
        <button type="button" onClick={onRetry} className={`${ui.adminActionPrimary} w-auto mt-3`}>
            Retry
        </button>
    </section>
);

const LineGraph = ({ data, lines, moneyAxis }) => (
    <div className="h-[20rem] w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={moneyAxis ? v => `₱${v}` : undefined} />
                    <Tooltip formatter={(value) => moneyAxis ? money(value) : number(value)} />
                    <Legend />
                    {lines.map(([key, color, name]) => (
                        <Line key={key} type="linear" dataKey={key} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} name={name} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        ) : (
            <AnalyticsEmptyState title="No data for the selected period" text="Change filters or wait for new records." />
        )}
    </div>
);

const BarGraph = ({ data, bars }) => (
    <div className="h-[19rem] w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value, name) => [number(value), name]} />
                    <Legend />
                    {bars.map(([key, color, name]) => (
                        <Bar key={key} dataKey={key} fill={color} name={name} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <AnalyticsEmptyState title="No data for the selected period" text="This metric is supported, but no matching records were found." />
        )}
    </div>
);

const DonutGraph = ({ data, dataKey }) => (
    <div className="h-[20rem] w-full min-w-0">
        {data?.length ? (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={data} dataKey={dataKey} nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                        {data.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value, name, item) => [`${number(value)} transactions, ${money(item.payload.revenue)}`, name]} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        ) : (
            <AnalyticsEmptyState title="No data for the selected period" text="No successful fare transactions match this filter." />
        )}
    </div>
);

const AnalyticsEmptyState = ({ title, text }) => (
    <div className="h-full min-h-[12rem] grid place-items-center rounded-md border border-dashed border-border-soft bg-page-bg p-4 text-center">
        <div>
            <FiInfo className="mx-auto mb-2 text-maroon" />
            <div className="font-black text-text-main">{title}</div>
            <p className="m-0 mt-1 text-sm text-text-muted">{text}</p>
        </div>
    </div>
);

const SkeletonBlock = () => (
    <div className="animate-pulse">
        <div className="h-4 w-32 rounded bg-[#eceff3]" />
        <div className="mt-4 h-8 w-24 rounded bg-[#eceff3]" />
        <div className="mt-3 h-3 w-full rounded bg-[#eceff3]" />
    </div>
);

const ChartSkeleton = () => <div className="h-[19rem] rounded-md bg-[#eceff3] animate-pulse" />;
const TableSkeleton = () => <div className="h-52 rounded-md bg-[#eceff3] animate-pulse" />;

const buildExportRows = (analytics) => {
    if (!analytics) return [];
    const rows = [['Section', 'Metric', 'Value']];
    kpiConfig.forEach(([key, label, type]) => rows.push(['KPI', label, metricFormatters[type](analytics.summary?.[key])]));
    Object.entries(analytics.charts || {}).forEach(([chartName, data]) => {
        (data || []).forEach(item => rows.push(['Chart', chartName, JSON.stringify(item)]));
    });
    (analytics.recent?.fareTransactions || []).forEach(item => rows.push(['Recent Fare Transactions', item.time, `${item.maskedCardNumber} ${item.paymentMethod} ${money(item.amount)} ${item.status}`]));
    (analytics.recent?.supportTickets || []).forEach(item => rows.push(['Recent Support Tickets', item.ticketNumber, `${item.category} ${item.status} ${item.dateSubmitted}`]));
    (analytics.recent?.systemAlerts || []).forEach(item => rows.push(['System Alerts', item.title, `${item.severity} ${item.message}`]));
    rows.push(['Generated', 'Date and time', analytics.generatedAt || new Date().toISOString()]);
    return rows;
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

const printPdfReport = (analytics, rows) => {
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(`
        <html>
            <head>
                <title>Admin Analytics Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #2c2429; }
                    h1 { color: #6f2f3c; margin: 0 0 8px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; page-break-inside: auto; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; vertical-align: top; }
                    th { background: #6f2f3c; color: white; }
                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <h1>Admin Analytics Dashboard</h1>
                <p>Generated: ${escapeHtml(analytics.generatedAt || '')}</p>
                <table>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>
            </body>
        </html>
    `);
    popup.document.close();
    popup.print();
};

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export default ReportsPage;
