import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiActivity,
    FiAlertTriangle,
    FiBarChart2,
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
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last7' },
    { label: 'Last 30 Days', value: 'last30' },
    { label: 'This Month', value: 'thismonth' },
    { label: 'Previous Month', value: 'previousmonth' },
    { label: 'Custom', value: 'custom' },
];

const DEFAULT_FILTERS = {
    range: 'last7',
    startDate: '',
    endDate: '',
    busId: '',
    direction: '',
    paymentMethod: '',
    transactionStatus: '',
};

const ANALYTICS_VIEWS = [
    { id: 'overview', label: 'Overview', description: 'Revenue, passengers, and bus performance at a glance.', icon: FiBarChart2 },
    { id: 'operations', label: 'Bus & Trips', description: 'Daily bus results, trips, and peak travel periods.', icon: FiTruck },
    { id: 'payments', label: 'Payments', description: 'Payment methods, transaction status, and failures.', icon: FiCreditCard },
    { id: 'fleet', label: 'Fleet & Terminals', description: 'Utilization, attention items, terminal health, and queues.', icon: FiActivity },
    { id: 'activity', label: 'Recent Activity', description: 'Latest fares, support tickets, and system alerts.', icon: FiAlertTriangle },
];

const readViewFromUrl = () => {
    const requested = new URLSearchParams(window.location.search).get('view');
    return ANALYTICS_VIEWS.some(view => view.id === requested) ? requested : 'overview';
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
    text: (value) => value || 'Not available',
};

const kpiConfig = [
    ['totalRevenue', 'Total Fare Revenue', 'money', FiCreditCard, 'Successful fare revenue for the selected period.'],
    ['totalPassengers', 'Total Passengers', 'number', FiUsers, 'Successful passenger fare transactions; see Unique Passengers for distinct accounts.'],
    ['totalTrips', 'Total Trips', 'number', FiTruck, 'Completed terminal-to-terminal trips.'],
    ['averageFarePerPassenger', 'Average Fare per Passenger', 'money', FiBarChart2, 'Successful revenue divided by successful fare transactions.'],
    ['revenueToday', 'Revenue Today', 'money', FiCreditCard, 'Today’s successful revenue using the active bus, direction, payment, and status filters.'],
    ['passengersToday', 'Passengers Today', 'number', FiUsers, 'Today’s successful fare transactions using the active filters.'],
    ['bestPerformingBus', 'Best Performing Bus', 'bus', FiTruck, 'Bus with the highest successful fare revenue.'],
    ['peakDirection', 'Peak Direction', 'direction', FiActivity, 'Direction with the most successful passenger fare transactions.'],
];

const readFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        range: params.get('range') || DEFAULT_FILTERS.range,
        startDate: params.get('startDate') || '',
        endDate: params.get('endDate') || '',
        busId: params.get('busId') || '',
        direction: params.get('direction') || '',
        paymentMethod: params.get('paymentMethod') || '',
        transactionStatus: params.get('transactionStatus') || '',
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
    const [activeView, setActiveView] = useState(readViewFromUrl);

    const buildParams = useCallback((source) => {
        const params = {
            range: source.range,
            timezone: TIMEZONE,
            ...(source.range === 'custom' && source.startDate ? { startDate: source.startDate } : {}),
            ...(source.range === 'custom' && source.endDate ? { endDate: source.endDate } : {}),
            ...(source.busId ? { busId: source.busId } : {}),
            ...(source.direction ? { direction: source.direction } : {}),
            ...(source.paymentMethod ? { paymentMethod: source.paymentMethod } : {}),
            ...(source.transactionStatus ? { transactionStatus: source.transactionStatus } : {}),
        };
        return params;
    }, []);

    const syncUrl = useCallback((source) => {
        const params = new URLSearchParams(buildParams(source));
        const currentView = new URLSearchParams(window.location.search).get('view');
        if (ANALYTICS_VIEWS.some(view => view.id === currentView) && currentView !== 'overview') {
            params.set('view', currentView);
        }
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

    const resetFilters = () => {
        const reset = { ...DEFAULT_FILTERS };
        setFilters(reset);
        setFilterError('');
        fetchAnalytics(reset, 'load');
    };

    const selectBus = (busId) => {
        const next = { ...filters, busId };
        setFilters(next);
        fetchAnalytics(next, 'load');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const selectView = (view) => {
        setActiveView(view);
        const params = new URLSearchParams(window.location.search);
        if (view === 'overview') params.delete('view');
        else params.set('view', view);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
                has_direction_filter: Boolean(appliedFilters.direction),
                has_payment_filter: Boolean(appliedFilters.paymentMethod),
                has_status_filter: Boolean(appliedFilters.transactionStatus),
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
                    generatedAt={analytics?.generatedAt}
                />

                <AnalyticsViewNav
                    activeView={activeView}
                    onChange={selectView}
                    alerts={recent.systemAlerts?.length || 0}
                    attention={analytics?.fleetAnalytics?.busesRequiringAttention?.length || 0}
                />

                <AnalyticsFilters
                    filters={filters}
                    options={options}
                    loading={loading || refreshing}
                    error={filterError}
                    onChange={updateFilter}
                    onApply={applyFilters}
                    onReset={resetFilters}
                />

                {error ? (
                    <RetryPanel message={error} onRetry={() => fetchAnalytics(appliedFilters, 'refresh')} />
                ) : (
                    <>
                        {activeView === 'overview' && (
                            <>
                                <AnalyticsSummaryGrid loading={loading} summary={summary} comparison={analytics?.comparison} />
                                <AnalyticsChartGrid loading={loading} analytics={analytics} charts={charts} />
                            </>
                        )}
                        {activeView === 'operations' && (
                            <OperationsAnalytics loading={loading} analytics={analytics} onSelectBus={selectBus} />
                        )}
                        {activeView === 'payments' && (
                            <>
                                <PaymentSection data={analytics?.paymentAnalytics} loading={loading} />
                                <TransactionSection data={analytics?.transactionAnalytics} loading={loading} />
                            </>
                        )}
                        {activeView === 'fleet' && (
                            <>
                                <FleetSection data={analytics?.fleetAnalytics} loading={loading} onSelectBus={selectBus} />
                                <TerminalSection data={analytics?.terminalAnalytics} loading={loading} />
                                {analytics?.forecast && !analytics.forecast.available && (
                                    <ForecastAvailabilityCard forecast={analytics.forecast} />
                                )}
                            </>
                        )}
                        {activeView === 'activity' && <RecentActivity loading={loading} recent={recent} />}
                    </>
                )}
            </main>
        </div>
    );
};

const AnalyticsHeader = ({ loading, exporting, onExport, onRefresh, generatedAt }) => (
    <header className={`${ui.headerBar} items-start`}>
        <div>
            <span className={ui.eyebrow}>Analytics</span>
            <h1 className={ui.headerTitle}>Admin Analytics Dashboard</h1>
            {generatedAt && <p className="mt-1 mb-0 text-xs font-semibold text-text-muted">Last updated: {new Date(generatedAt).toLocaleString('en-PH', { timeZone: TIMEZONE })}</p>}
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

const AnalyticsFilters = ({ filters, options, loading, error, onChange, onApply, onReset }) => (
    <section className="mb-5 rounded-lg bg-white p-3 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
        <div className={`grid items-end gap-2 ${filters.range === 'custom'
            ? 'grid-cols-[repeat(7,minmax(7rem,1fr))_auto]'
            : 'grid-cols-[repeat(5,minmax(8rem,1fr))_auto]'} max-[1150px]:grid-cols-3 max-[760px]:grid-cols-1`}>
            <FilterSelect label="Date Range" value={filters.range} onChange={v => onChange('range', v)} options={RANGE_OPTIONS} />
            {filters.range === 'custom' && (
                <>
                    <FilterInput label="From" value={filters.startDate} onChange={v => onChange('startDate', v)} />
                    <FilterInput label="To" value={filters.endDate} onChange={v => onChange('endDate', v)} />
                </>
            )}
            <FilterSelect label="Bus" value={filters.busId} onChange={v => onChange('busId', v)}
                options={[{ label: 'All Buses', value: '' }, ...(options.buses || [])]} />
            <FilterSelect label="Direction" value={filters.direction} onChange={v => onChange('direction', v)}
                options={[{ label: 'All Directions', value: '' }, ...(options.directions || [])]} />
            <FilterSelect label="Payment Method" value={filters.paymentMethod} onChange={v => onChange('paymentMethod', v)}
                options={[{ label: 'All', value: '' }, ...(options.paymentMethods || [])]} />
            <FilterSelect label="Transaction Status" value={filters.transactionStatus} onChange={v => onChange('transactionStatus', v)}
                options={[{ label: 'All', value: '' }, ...(options.transactionStatuses || []).map(status => ({ label: status[0] + status.slice(1).toLowerCase(), value: status }))]} />
            <div className="flex gap-2 whitespace-nowrap">
                <button type="button" disabled={loading} onClick={onApply} className={`${ui.adminActionPrimary} min-w-[6.75rem] justify-center disabled:opacity-60`}>Apply Filters</button>
                <button type="button" disabled={loading} onClick={onReset} className={`${ui.adminAction} min-w-[4.75rem] justify-center disabled:opacity-60`}>Reset</button>
            </div>
        </div>
        {error && <p className="mt-3 mb-0 text-sm font-bold text-danger-muted">{error}</p>}
    </section>
);

const FilterInput = ({ label, value, onChange }) => (
    <label className="grid gap-1 text-[0.7rem] font-black text-text-muted">
        {label}
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[2.45rem] min-w-0 rounded-md border border-border-soft px-2.5 text-[0.8rem] font-semibold text-text-main outline-none focus:border-gold"
        />
    </label>
);

const FilterSelect = ({ label, value, onChange, options }) => (
    <label className="grid gap-1 text-[0.7rem] font-black text-text-muted">
        {label}
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[2.45rem] min-w-0 rounded-md border border-border-soft px-2.5 text-[0.8rem] font-semibold text-text-main outline-none focus:border-gold"
        >
            {options.map(option => (
                <option key={option.value || option.id || option.label} value={option.value ?? option.id}>{option.label}</option>
            ))}
        </select>
    </label>
);

const AnalyticsViewNav = ({ activeView, onChange, alerts, attention }) => {
    const selected = ANALYTICS_VIEWS.find(view => view.id === activeView) || ANALYTICS_VIEWS[0];
    return (
        <section className="sticky top-3 z-20 mb-5 rounded-lg border border-border-soft bg-white/95 p-2 shadow-[0_10px_26px_rgba(44,36,41,0.08)] backdrop-blur">
            <div role="tablist" aria-label="Analytics categories" className="flex gap-2 overflow-x-auto pb-1">
                {ANALYTICS_VIEWS.map(view => {
                    const ViewIcon = view.icon;
                    const count = view.id === 'activity' ? alerts : view.id === 'fleet' ? attention : 0;
                    const active = view.id === activeView;
                    return (
                        <button
                            key={view.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onChange(view.id)}
                            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-black transition-colors ${active
                                ? 'bg-maroon text-white shadow-sm'
                                : 'bg-page-bg text-maroon hover:bg-maroon/10'}`}
                        >
                            <ViewIcon />
                            {view.label}
                            {count > 0 && (
                                <span className={`rounded-full px-2 py-0.5 text-[0.65rem] ${active ? 'bg-white/20 text-white' : 'bg-gold/25 text-maroon'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <p className="mb-0 mt-1 px-2 text-xs font-semibold text-text-muted">{selected.description}</p>
        </section>
    );
};

const AnalyticsSummaryGrid = ({ loading, summary, comparison }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-lg font-black text-maroon">Executive Summary</h2>
        <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
            {kpiConfig.map(([key, label, type, Icon, help], index) => (
                <KpiCard key={key} loading={loading} label={label} value={summary[key]} type={type} icon={Icon} help={help}
                    comparison={index < 3 ? comparison?.[index === 0 ? 'revenue' : index === 1 ? 'passengers' : 'trips'] : null}
                    comparisonLabel={comparison?.label} />
            ))}
        </div>
    </section>
);

const KpiCard = ({ loading, label, value, type, icon, help, comparison, comparisonLabel }) => {
    const CardIcon = icon;
    return (
        <article className="min-h-[5.25rem] rounded-lg border-l-4 border-maroon bg-white p-3.5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
            {loading ? (
                <SkeletonBlock />
            ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="text-[0.8rem] font-black text-text-muted">{label}</div>
                        <span title={help} className="inline-flex items-center gap-1 text-base text-maroon">
                            <CardIcon />
                        </span>
                    </div>
                    <div className="mt-2 text-[1.4rem] font-black leading-tight text-maroon">{formatKpiValue(type, value)}</div>
                    {comparison?.available && comparison.percentage != null && (
                        <div className={`mt-1 text-xs font-black ${Number(comparison.percentage) >= 0 ? 'text-[#2f6b3d]' : 'text-danger-muted'}`}>
                            {Number(comparison.percentage) >= 0 ? '↑' : '↓'} {Math.abs(Number(comparison.percentage)).toFixed(1)}% vs {comparisonLabel}
                        </div>
                    )}
                </>
            )}
        </article>
    );
};

const formatKpiValue = (type, value) => {
    if (value == null) return 'Not available';
    if (type === 'bus') return value.bus || 'Not available';
    if (type === 'direction') return value.label || 'Not available';
    return metricFormatters[type](value);
};

const AnalyticsChartGrid = ({ loading, analytics, charts }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">Revenue & Passenger Trends</h2>
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1 mb-5">
            <AnalyticsChartCard title="Revenue Trend" loading={loading}>
                <LineGraph data={charts.revenueTrend || []} lines={[['revenue', '#6f2f3c', 'Revenue']]} moneyAxis />
            </AnalyticsChartCard>
            <AnalyticsChartCard title="Passenger Activity Trend" loading={loading}>
                <LineGraph data={charts.passengerActivityTrend || []} lines={[['passengers', '#2f6b3d', 'Passengers']]} />
            </AnalyticsChartCard>
        </div>
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
            <AnalyticsChartCard title="Passengers by Bus" loading={loading}>
                <BarGraph data={analytics?.busPerformance?.passengersByBus || []} bars={[['passengers', '#2f6b3d', 'Passengers']]} />
            </AnalyticsChartCard>
            <AnalyticsChartCard title="Revenue by Bus" loading={loading}>
                <BarGraph data={analytics?.busPerformance?.revenueByBus || []} bars={[['revenue', '#6f2f3c', 'Revenue']]} moneyAxis />
            </AnalyticsChartCard>
        </div>
    </section>
);

const OperationsAnalytics = ({ loading, analytics, onSelectBus }) => (
    <>
        <DailyBusPerformance loading={loading} rows={analytics?.dailyBusPerformance || []} onSelectBus={onSelectBus} />
        <TripAvailability data={analytics?.tripPerformance} loading={loading} />
        <PassengerPeakSection data={analytics?.passengerAnalytics} loading={loading} />
    </>
);

const DashboardSection = ({ title, children }) => (
    <section className="mb-5 min-w-0">
        <h2 className="m-0 mb-3 text-lg font-black text-maroon">{title}</h2>
        {children}
    </section>
);

const AnalyticsChartCard = ({ title, loading, children }) => (
    <section data-chart-card className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)] min-w-0">
        <h3 className="m-0 mb-4 text-maroon text-base font-black">{title}</h3>
        {loading ? <ChartSkeleton /> : children}
    </section>
);

const DailyBusPerformance = ({ loading, rows, onSelectBus }) => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('date');
    const [page, setPage] = useState(0);
    const size = 10;
    const filtered = useMemo(() => [...rows]
        .filter(row => !search || row.bus?.toLowerCase().includes(search.toLowerCase()) || String(row.date).includes(search))
        .sort((a, b) => sort === 'revenue' ? Number(b.revenue) - Number(a.revenue)
            : sort === 'passengers' ? b.totalPassengers - a.totalPassengers
                : String(b.date).localeCompare(String(a.date))), [rows, search, sort]);
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    const visible = filtered.slice(page * size, page * size + size);
    return (
        <DashboardSection title="Daily Bus Performance">
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <div className="mb-4 flex flex-wrap gap-2">
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search date or bus"
                        className="min-h-[2.5rem] flex-1 min-w-52 rounded-md border border-border-soft px-3 text-sm outline-none focus:border-gold" />
                    <select value={sort} onChange={e => setSort(e.target.value)}
                        className="min-h-[2.5rem] rounded-md border border-border-soft px-3 text-sm font-semibold">
                        <option value="date">Newest date</option><option value="passengers">Highest passengers</option><option value="revenue">Highest revenue</option>
                    </select>
                </div>
                {loading ? <TableSkeleton /> : visible.length ? (
                    <>
                        <DataTable rows={visible} columns={[
                            ['date', 'Date'], ['bus', 'Bus', value => <button className="font-black text-maroon hover:text-gold" onClick={() => onSelectBus(value)}>{value}</button>],
                            ['smToGrandPassengers', 'SM → Grand', number], ['grandToSmPassengers', 'Grand → SM', number],
                            ['totalPassengers', 'Total Pax', number], ['trips', 'Trips', unavailable],
                            ['revenue', 'Revenue', money], ['passengersPerTrip', 'Pax / Trip', unavailable], ['revenuePerTrip', 'Revenue / Trip', unavailable],
                        ]} />
                        <div className="mt-4 flex items-center justify-between text-xs font-bold text-text-muted">
                            <span>Page {page + 1} of {pages} · {filtered.length} rows</span>
                            <div className="flex gap-2">
                                <button className={ui.adminAction} disabled={page === 0} onClick={() => setPage(v => v - 1)}>Previous</button>
                                <button className={ui.adminAction} disabled={page + 1 >= pages} onClick={() => setPage(v => v + 1)}>Next</button>
                            </div>
                        </div>
                    </>
                ) : <AnalyticsEmptyState title="No data for the selected period" text="No successful fare transactions match the selected filters." />}
            </section>
        </DashboardSection>
    );
};

const TripAvailability = ({ data, loading }) => (
    <DashboardSection title="Trip Performance">
        <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
            {loading ? <SkeletonBlock /> : !data?.available ? (
                <div className="flex items-start gap-3 rounded-md border border-gold/40 bg-[#fffaf0] p-4">
                    <FiInfo className="mt-1 shrink-0 text-maroon" />
                    <div><strong className="text-maroon">Trip data is not yet available</strong><p className="m-0 mt-1 text-sm text-text-muted">{data?.message}</p></div>
                </div>
            ) : <DataTable rows={data.byBus || []} columns={[]} />}
        </section>
    </DashboardSection>
);

const PassengerPeakSection = ({ data = {}, loading }) => (
    <DashboardSection title="Passenger Analytics">
        <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)] gap-5 max-[1100px]:grid-cols-1">
            <AnalyticsChartCard title="Peak Travel Hours" loading={loading}>
                <BarGraph data={data.hourlyVolume || []} bars={[['passengers', '#e8bd47', 'Passengers']]} />
            </AnalyticsChartCard>
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <h3 className="m-0 mb-4 text-maroon font-black">Peak Indicators</h3>
                {loading ? <SkeletonBlock /> : <div className="grid gap-3">
                    <MetricLine label="Peak hour" value={data.peakHour?.label} detail={data.peakHour ? `${number(data.peakHour.passengers)} passengers` : ''} />
                    <MetricLine label="Peak day" value={data.peakDay?.day} detail={data.peakDay ? `${number(data.peakDay.passengers)} passengers` : ''} />
                    <MetricLine label="Peak direction" value={data.peakDirection?.label} detail={data.peakDirection ? `${number(data.peakDirection.passengers)} passengers` : ''} />
                </div>}
            </section>
        </div>
    </DashboardSection>
);

const PaymentSection = ({ data = {}, loading }) => (
    <DashboardSection title="Payment Analytics">
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1 mb-5">
            <AnalyticsChartCard title="Payment Method Share" loading={loading}><DonutGraph data={data.methods || []} dataKey="count" /></AnalyticsChartCard>
            <AnalyticsChartCard title="Revenue by Payment Method" loading={loading}><BarGraph data={data.methods || []} bars={[['revenue', '#6f2f3c', 'Revenue']]} moneyAxis /></AnalyticsChartCard>
        </div>
        <AnalyticsChartCard title="Daily Payment Trend" loading={loading}>
            <LineGraph data={data.dailyTrend || []} lines={[['rfid', '#6f2f3c', 'RFID'], ['nfc', '#e8bd47', 'NFC'], ['qr', '#2f6b3d', 'QR'], ['assistedCash', '#58606f', 'Assisted Cash']]} />
        </AnalyticsChartCard>
    </DashboardSection>
);

const TransactionSection = ({ data = {}, loading }) => (
    <DashboardSection title="Transaction Analytics">
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
            <AnalyticsChartCard title="Transaction Status" loading={loading}><DonutGraph data={data.statuses || []} dataKey="count" /></AnalyticsChartCard>
            <AnalyticsChartCard title="Failed Transaction Reasons" loading={loading}><BarGraph data={data.failureReasons || []} bars={[['count', '#b24a52', 'Failures']]} /></AnalyticsChartCard>
        </div>
        <section className="mt-5 rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
            <h3 className="m-0 mb-4 text-maroon font-black">Recent Failed Transactions</h3>
            {loading ? <TableSkeleton /> : data.failedTransactions?.length
                ? <DataTable rows={data.failedTransactions.slice(0, 20)} columns={[
                    ['transactionId', 'Transaction ID'], ['dateTime', 'Date / Time', dateTime], ['bus', 'Bus', unavailable],
                    ['directionLabel', 'Direction', unavailable], ['paymentMethod', 'Payment'], ['failureReason', 'Reason'], ['terminal', 'Terminal', unavailable],
                ]} />
                : <AnalyticsEmptyState title="No failed transactions" text="No failed fare attempts match the selected filters." />}
        </section>
    </DashboardSection>
);

const FleetSection = ({ data = {}, loading, onSelectBus }) => (
    <DashboardSection title="Fleet Analytics">
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <h3 className="m-0 mb-4 text-maroon font-black">Top Performing Buses</h3>
                {loading ? <TableSkeleton /> : data.topPerformingBuses?.length
                    ? <DataTable rows={data.topPerformingBuses} columns={[
                        ['bus', 'Bus', value => <button className="font-black text-maroon" onClick={() => onSelectBus(value)}>{value}</button>],
                        ['passengers', 'Passengers', number], ['revenue', 'Revenue', money], ['trips', 'Trips', unavailable],
                    ]} />
                    : <AnalyticsEmptyState title="No bus performance data" text="No bus-linked successful fares match the selected filters." />}
            </section>
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <h3 className="m-0 mb-4 text-maroon font-black">Buses Requiring Attention</h3>
                {loading ? <TableSkeleton /> : data.busesRequiringAttention?.length
                    ? <DataTable rows={data.busesRequiringAttention} columns={[['bus', 'Bus'], ['reason', 'Reason']]} />
                    : <AnalyticsEmptyState title="No buses require attention" text="No supported fleet alerts match the selected filters." />}
            </section>
        </div>
        <section className="mt-5 rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
            <h3 className="m-0 mb-4 text-maroon font-black">Bus Utilization</h3>
            {loading ? <TableSkeleton /> : <DataTable rows={data.utilization || []} columns={[
                ['bus', 'Bus'], ['capacity', 'Capacity', unavailable], ['averagePassengers', 'Average Passengers', unavailable],
                ['utilizationPercentage', 'Utilization', value => value == null ? 'Not available' : percent(value)], ['reason', 'Data note'],
            ]} />}
        </section>
    </DashboardSection>
);

const TerminalSection = ({ data = {}, loading }) => (
    <DashboardSection title="Terminal Analytics">
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1 mb-5">
            <MiniMetric label="Online" value={data.online} loading={loading} />
            <MiniMetric label="Offline" value={data.offline} loading={loading} />
            <MiniMetric label="Missing GPS" value={data.missingGpsUpdates} loading={loading} />
            <MiniMetric label="Availability" value={data.availability == null ? 'Not available' : percent(data.availability)} loading={loading} />
        </div>
        <div className="grid grid-cols-2 gap-5 max-[1100px]:grid-cols-1">
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <h3 className="m-0 mb-4 text-maroon font-black">Terminal Health</h3>
                {loading ? <TableSkeleton /> : data.terminals?.length
                    ? <DataTable rows={data.terminals} columns={[
                        ['name', 'Terminal'], ['bus', 'Bus', unavailable], ['status', 'Status'], ['lastHeartbeat', 'Last Heartbeat', dateTime],
                        ['transactionsProcessed', 'Processed', number], ['failedTransactions', 'Failed', number],
                    ]} /> : <AnalyticsEmptyState title="No terminal records" text="No terminals match the selected bus filter." />}
            </section>
            <section className="rounded-lg bg-white p-5 shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
                <h3 className="m-0 mb-4 text-maroon font-black">Queue by Terminal</h3>
                {loading ? <TableSkeleton /> : data.queues?.length
                    ? <DataTable rows={data.queues} columns={[
                        ['terminal', 'Terminal'], ['bus', 'Bus'], ['currentQueue', 'Queue', number], ['etaMinutes', 'ETA (min)', unavailable], ['status', 'Status'],
                    ]} /> : <AnalyticsEmptyState title="No current queue data" text="No queue entries match the selected filters." />}
                {!loading && data.queueHistoryMessage && <p className="mb-0 mt-3 text-xs text-text-muted">{data.queueHistoryMessage}</p>}
            </section>
        </div>
    </DashboardSection>
);

const MiniMetric = ({ label, value, loading }) => (
    <article className="rounded-lg bg-white p-4 border-l-4 border-maroon shadow-[0_10px_26px_rgba(44,36,41,0.08)]">
        {loading ? <SkeletonBlock /> : <><div className="text-xs font-black text-text-muted">{label}</div><div className="mt-2 text-xl font-black text-maroon">{value ?? 0}</div></>}
    </article>
);

const MetricLine = ({ label, value, detail }) => (
    <div className="rounded-md border border-border-soft bg-page-bg p-3">
        <div className="text-xs font-black text-text-muted">{label}</div>
        <div className="mt-1 font-black text-maroon">{value || 'No data for the selected period'}</div>
        {detail && <div className="mt-1 text-xs text-text-muted">{detail}</div>}
    </div>
);

const unavailable = value => value == null || value === '' ? 'Not available' : value;
const dateTime = value => value ? new Date(value).toLocaleString('en-PH', { timeZone: TIMEZONE }) : 'Not available';

const RecentActivity = ({ loading, recent }) => (
    <section className="mb-5">
        <h2 className="m-0 mb-3 text-maroon text-lg font-black">Recent Activity</h2>
        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)_minmax(18rem,1fr)] items-start gap-5 max-[1300px]:grid-cols-1">
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
                                {formatter ? formatter(row[key], row) : (row[key] ?? 'Not available')}
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

const hasChartValues = (data, keys) => Boolean(data?.some(row =>
    keys.some(key => Number.isFinite(Number(row?.[key])) && Number(row[key]) !== 0)));

const LineGraph = ({ data, lines, moneyAxis }) => (
    <div className="h-[16rem] w-full min-w-0">
        {hasChartValues(data, lines.map(([key]) => key)) ? (
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
            <AnalyticsEmptyState fill title="No data for the selected period" text="Change filters or wait for new records." />
        )}
    </div>
);

const BarGraph = ({ data, bars, moneyAxis }) => (
    <div className="h-[16rem] w-full min-w-0">
        {hasChartValues(data, bars.map(([key]) => key)) ? (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={moneyAxis ? value => `₱${number(value)}` : undefined} />
                    <Tooltip formatter={(value, name) => [moneyAxis ? money(value) : number(value), name]} />
                    <Legend />
                    {bars.map(([key, color, name]) => (
                        <Bar key={key} dataKey={key} fill={color} name={name} radius={[4, 4, 0, 0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <AnalyticsEmptyState fill title="No data for the selected period" text="This metric is supported, but no matching records were found." />
        )}
    </div>
);

const DonutGraph = ({ data, dataKey }) => (
    <div className="h-[16rem] w-full min-w-0">
        {hasChartValues(data, [dataKey]) ? (
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
            <AnalyticsEmptyState fill title="No data for the selected period" text="No successful fare transactions match this filter." />
        )}
    </div>
);

const AnalyticsEmptyState = ({ title, text, fill = false }) => (
    <div className={`${fill ? 'h-full' : ''} min-h-[9rem] grid place-items-center rounded-md border border-dashed border-border-soft bg-page-bg p-4 text-center`}>
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
    const filters = analytics.filters || {};
    rows.push(['Report', 'Date range', `${filters.startDate || ''} to ${filters.endDate || ''}`]);
    rows.push(['Applied filter', 'Bus', filters.busId || 'All Buses']);
    rows.push(['Applied filter', 'Direction', filters.direction || 'All Directions']);
    rows.push(['Applied filter', 'Payment method', filters.paymentMethod || 'All']);
    rows.push(['Applied filter', 'Transaction status', filters.transactionStatus || 'All']);
    kpiConfig.forEach(([key, label, type]) => rows.push(['Executive Summary', label, formatKpiValue(type, analytics.summary?.[key])]));
    const exportSections = {
        'Revenue Trend': analytics.trends?.revenue,
        'Passenger Trend': analytics.trends?.passengers,
        'Bus Performance': analytics.busPerformance?.buses,
        'Daily Bus Performance': analytics.dailyBusPerformance,
        'Direction Performance': analytics.directionAnalytics?.directions,
        'Payment Analytics': analytics.paymentAnalytics?.methods,
        'Transaction Status': analytics.transactionAnalytics?.statuses,
        'Failure Reasons': analytics.transactionAnalytics?.failureReasons,
        'Failed Transactions': analytics.transactionAnalytics?.failedTransactions,
        'Fleet Ranking': analytics.fleetAnalytics?.topPerformingBuses,
        'Buses Requiring Attention': analytics.fleetAnalytics?.busesRequiringAttention,
        'Terminal Health': analytics.terminalAnalytics?.terminals,
        'Terminal Queue': analytics.terminalAnalytics?.queues,
    };
    Object.entries(exportSections).forEach(([section, data]) => (data || []).forEach(item => rows.push([section, item.name || item.bus || item.date || item.reason || item.terminalId || '', JSON.stringify(item)])));
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
