import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiDownload, FiFileText, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminAPI from '../api/adminAxios';
import AdminSidebar from '../components/AdminSidebar';
import * as ui from '../components/adminUI';
import { downloadFareCsv, downloadFarePdf, downloadFareXlsx } from '../lib/fareReportExports';

const PAGE_SIZE = 25;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const currentMonth = () => today().slice(0, 7);
const currentYear = () => today().slice(0, 4);
const fmtDate = (value) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value)) : '—';
const fmtTime = (value) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value)) : '—';
const php = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));

function weekRange(date) {
    const utc = new Date(`${date}T00:00:00Z`);
    const day = utc.getUTCDay();
    utc.setUTCDate(utc.getUTCDate() - ((day + 6) % 7));
    const start = utc.toISOString().slice(0, 10);
    utc.setUTCDate(utc.getUTCDate() + 6);
    return [start, utc.toISOString().slice(0, 10)];
}

function resolveRange(filters) {
    if (filters.type === 'DAILY') return [filters.date, filters.date];
    if (filters.type === 'WEEKLY') return weekRange(filters.weekDate);
    if (filters.type === 'MONTHLY') {
        const [year, month] = filters.month.split('-').map(Number);
        return [`${filters.month}-01`, `${filters.month}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`];
    }
    if (filters.type === 'YEARLY') return [`${filters.year}-01-01`, `${filters.year}-12-31`];
    return [filters.startDate, filters.endDate];
}

export default function FareTransactionReportsPage() {
    const [vehicles, setVehicles] = useState([]);
    const [filters, setFilters] = useState({ type: 'DAILY', date: today(), weekDate: today(), month: currentMonth(), year: currentYear(), startDate: today(), endDate: today(), vehicleId: '', status: '', paymentMethod: '' });
    const [report, setReport] = useState(null);
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        adminAPI.get('/fare-reports/vehicles').then(({ data }) => setVehicles(data.data || []))
            .catch(() => toast.error('Could not load the bus list.'));
    }, []);

    const range = useMemo(() => resolveRange(filters), [filters]);
    const loadPage = useCallback(async (targetPage, activeRange = range, activeBus = filters.vehicleId, activeStatus = filters.status, activePayment = filters.paymentMethod) => {
        setLoading(true); setError('');
        try {
            const params = { startDate: activeRange[0], endDate: activeRange[1], page: targetPage, size: PAGE_SIZE };
            if (activeBus !== '') params.vehicleId = activeBus;
            if (activeStatus) params.status = activeStatus;
            if (activePayment) params.paymentMethod = activePayment;
            const { data } = await adminAPI.get('/fare-reports', { params });
            if (!data?.success || !data.data) throw new Error('Report response was incomplete.');
            const selectedBus = vehicles.find((bus) => String(bus.id) === String(activeBus));
            setReport({ ...data.data, startDate: activeRange[0], endDate: activeRange[1], busLabel: activeBus === '' ? 'All Buses' : selectedBus?.plateNumber || 'Selected Bus', vehicleId: activeBus === '' ? null : Number(activeBus), statusFilter: activeStatus, paymentMethodFilter: activePayment });
            setRows(data.data.transactions || []); setPage(targetPage);
        } catch (requestError) {
            const message = requestError.response?.data?.message || requestError.message || 'Unable to generate this report.';
            setError(message); toast.error(message);
        } finally { setLoading(false); }
    }, [range, filters.vehicleId, filters.status, filters.paymentMethod, vehicles]);

    const generate = (event) => {
        event.preventDefault();
        if (!range[0] || !range[1] || range[1] < range[0]) { toast.error('Choose a valid reporting period.'); return; }
        setReport(null); setRows([]); setPage(0);
        loadPage(0, range, filters.vehicleId, filters.status, filters.paymentMethod);
    };

    const allTransactions = async () => {
        if (!report) return [];
        try {
            const all = [];
            const exportPages = Math.ceil(Number(report.summary.totalCount || 0) / 200);
            for (let nextPage = 0; nextPage < exportPages; nextPage += 1) {
                const params = { startDate: report.startDate, endDate: report.endDate, page: nextPage, size: 200 };
                if (report.vehicleId != null) params.vehicleId = report.vehicleId;
                if (report.statusFilter) params.status = report.statusFilter;
                if (report.paymentMethodFilter) params.paymentMethod = report.paymentMethodFilter;
                const { data } = await adminAPI.get('/fare-reports', { params });
                const dataRows = data?.data?.transactions;
                if (!data?.success || !Array.isArray(dataRows)) throw new Error('The server returned an incomplete report page.');
                all.push(...dataRows);
            }
            if (all.length !== Number(report.summary.totalCount)) throw new Error(`Export stopped: fetched ${all.length} of ${report.summary.totalCount} matching transactions.`);
            const successful = all.filter((row) => !row.reversed && ['SUCCESS', 'COMPLETED'].includes(row.status));
            const successfulTotal = successful.reduce((sum, row) => sum + Number(row.fare_amount || 0), 0);
            if (successful.length !== Number(report.summary.successfulCount) || Math.abs(successfulTotal - Number(report.summary.successfulRevenue || 0)) > 0.005) throw new Error('Export stopped: transaction rows do not reconcile with the report summary. Refresh the report and try again.');
            return all;
        } catch (requestError) {
            toast.error(requestError.response?.data?.message || requestError.message || 'Could not load all report records.');
            return null;
        }
    };

    const exportFile = async (format) => {
        if (!report || exporting) return;
        setExporting(true);
        try {
            const all = await allTransactions();
            if (!all) return;
            const period = report.startDate === report.endDate ? report.startDate : `${report.startDate}_to_${report.endDate}`;
            const filename = `PTC_Fare_Transaction_Report_${period}`;
            const generatedAt = `${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date())} PHT`;
            const exportReport = { ...report, generatedAt };
            const downloaded = format === 'CSV'
                ? downloadFareCsv(all, `${filename}.csv`)
                : format === 'XLSX'
                    ? downloadFareXlsx(all, exportReport, `${filename}.xlsx`)
                    : downloadFarePdf(all, exportReport, `${filename}.pdf`);
            if (!downloaded) throw new Error('The report file could not be prepared for download.');
            toast.success(`Downloaded ${all.length.toLocaleString()} fare transactions.`);
        } catch (requestError) {
            toast.error(requestError.response?.data?.message || requestError.message || 'Could not generate the fare transaction report.');
        } finally {
            setExporting(false);
        }
    };

    const summary = report?.summary || {};

    return <div className={ui.layout}>
        <AdminSidebar />
        <main className={ui.workspace}>
            <header className={ui.headerBar}>
                <div><span className={ui.eyebrow}>Administrator Portal</span><h1 className={ui.headerTitle}>Report</h1><p className="m-0 mt-1 text-sm text-text-muted">Search and download individual passenger and assisted cash fare records.</p></div>
                <button type="button" className={ui.adminAction} onClick={() => report && loadPage(page)} disabled={loading || exporting}><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh</button>
            </header>

            <form onSubmit={generate} className={ui.filterPanel}>
                <h2 className={ui.filterPanelTitle}>Report filters</h2>
                <div className="grid grid-cols-4 gap-4 max-[850px]:grid-cols-2 max-[560px]:grid-cols-1">
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Bus</span><select className={ui.filterField} value={filters.vehicleId} onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}><option value="">All Buses</option>{vehicles.map((bus) => <option key={bus.id} value={bus.id}>{bus.plateNumber}</option>)}</select></label>
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Transaction status</span><select className={ui.filterField} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{['SUCCESS','COMPLETED','FAILED','EXPIRED','PENDING','PROCESSING','CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Payment method</span><select className={ui.filterField} value={filters.paymentMethod} onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}><option value="">All methods</option>{['RFID','NFC','QR','ADMIN','PAYMONGO','ASSISTED_CASH'].map((s) => <option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></label>
                    <label className={ui.filterGroup}><span className={ui.filterLabel}>Report type</span><select className={ui.filterField} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom date range</option></select></label>
                    {filters.type === 'DAILY' && <label className={ui.filterGroup}><span className={ui.filterLabel}>Date</span><input required type="date" className={ui.filterField} value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} /></label>}
                    {filters.type === 'WEEKLY' && <label className={ui.filterGroup}><span className={ui.filterLabel}>Select a date in the week</span><input required type="date" className={ui.filterField} value={filters.weekDate} onChange={(e) => setFilters({ ...filters, weekDate: e.target.value })} /></label>}
                    {filters.type === 'MONTHLY' && <label className={ui.filterGroup}><span className={ui.filterLabel}>Month</span><input required type="month" className={ui.filterField} value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} /></label>}
                    {filters.type === 'YEARLY' && <label className={ui.filterGroup}><span className={ui.filterLabel}>Year</span><input required type="number" min="2000" max="2100" className={ui.filterField} value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} /></label>}
                    {filters.type === 'CUSTOM' && <>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>Start date</span><input required type="date" className={ui.filterField} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label>
                        <label className={ui.filterGroup}><span className={ui.filterLabel}>End date</span><input required type="date" className={ui.filterField} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label>
                    </>}
                    <div className="flex items-end"><button type="submit" disabled={loading} className={ui.adminActionPrimary}><FiFileText /> Generate Report</button></div>
                </div>
            </form>

            {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
            {report && <>
                <section className="mb-4 grid grid-cols-3 gap-3 max-[700px]:grid-cols-2 max-[480px]:grid-cols-1">
                    {[["Matching transactions", summary.totalCount], ['Successful fares', summary.successfulCount], ['Successful fare revenue', php(summary.successfulRevenue)]].map(([label, value]) => <article key={label} className="rounded-lg border border-border-soft bg-white p-4"><span className="block text-xs font-black uppercase text-text-muted">{label}</span><strong className="mt-2 block text-xl font-black text-maroon">{value ?? 0}</strong></article>)}
                </section>
                <section className={`${ui.dataPanel} mb-5`}>
                    <div className={ui.dataPanelHeader}><div><span className={ui.dataPanelTitle}><FiFileText /> Matching fare records</span><p className="m-0 mt-1 text-xs text-text-muted">{fmtDate(`${report.startDate}T12:00:00+08:00`)} – {fmtDate(`${report.endDate}T12:00:00+08:00`)} · {report.busLabel} · {Number(summary.totalCount || 0).toLocaleString()} total</p></div>
                        <div className="flex flex-wrap gap-2">{[['PDF', 'PDF'], ['XLSX', 'Excel'], ['CSV', 'CSV']].map(([format, label]) => <button key={format} type="button" onClick={() => exportFile(format)} disabled={exporting || loading} className={ui.adminAction}><FiDownload /> {exporting ? 'Preparing…' : label}</button>)}</div>
                    </div>
                    <div className="overflow-x-auto"><table className={`${ui.adminTable} min-w-[1200px]`}>
                        <thead><tr>{['Transaction ID', 'Source', 'Passenger ID', 'Card', 'Bus Plate', 'Date', 'Time', 'Payment', 'Fare', 'Status', 'Reference'].map((label) => <th className={ui.tableTh} key={label}>{label}</th>)}</tr></thead>
                        <tbody>{loading ? <tr><td colSpan={11} className={ui.loadingRow}>Loading matching transactions…</td></tr> : rows.length ? rows.map((row) => <tr key={`${row.record_source}-${row.transaction_id}`} className={ui.tableRow}>
                            <td className={`${ui.tableTd} font-mono text-xs`}>{row.transaction_id}</td><td className={ui.tableTd}>{row.record_source || '—'}</td><td className={ui.tableTd}>{row.passenger_id || '—'}</td><td className={ui.tableTd}>{row.passenger_identifier || '—'}</td><td className={ui.tableTd}>{row.plate_number || '—'}</td><td className={ui.tableTd}>{fmtDate(row.occurred_at)}</td><td className={ui.tableTd}>{fmtTime(row.occurred_at)}</td><td className={ui.tableTd}>{row.payment_method || '—'}</td><td className={ui.tableTd}>{php(row.fare_amount)}</td><td className={ui.tableTd}>{row.reversed ? 'REVERSED' : row.status}</td><td className={`${ui.tableTd} font-mono text-xs`}>{row.reference_number || '—'}</td>
                        </tr>) : <tr><td colSpan={11} className={ui.emptyRow}>No matching fare transactions for this report period.</td></tr>}</tbody>
                    </table></div>
                    <div className={ui.paginationBar}><span>Page {page + 1} of {Math.max(1, report.totalPages)} · {rows.length} shown</span><div className={ui.paginationButtons}><button type="button" disabled={page === 0 || loading} onClick={() => loadPage(page - 1)} className={ui.pageBtn}>Previous</button><button type="button" disabled={page + 1 >= report.totalPages || loading} onClick={() => loadPage(page + 1)} className={ui.pageBtn}>Next</button></div></div>
                </section>
                {report.busBreakdown && <section className={`${ui.dataPanel} mb-5`}><div className={ui.dataPanelHeader}><span className={ui.dataPanelTitle}>Bus breakdown</span></div><div className="overflow-x-auto"><table className={ui.adminTable}><thead><tr>{['Bus Plate', 'Transactions', 'Successful Revenue'].map((x) => <th key={x} className={ui.tableTh}>{x}</th>)}</tr></thead><tbody>{report.busBreakdown.map((bus, i) => <tr key={bus.bus_id || `unknown-${i}`} className={ui.tableRow}><td className={ui.tableTd}>{bus.plate_number || '—'}</td><td className={ui.tableTd}>{bus.transaction_count}</td><td className={ui.tableTd}>{php(bus.successful_revenue)}</td></tr>)}</tbody></table></div></section>}
            </>}
        </main>
    </div>;
}
