import { csvEscape } from './csv.js';
import { downloadXlsxSheets } from './fareReportExports.js';

const humanize = (key) => String(key).replace(/([a-z\d])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

function flattenRecord(record, prefix = '', output = {}) {
    Object.entries(record || {}).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        if (isRecord(value)) flattenRecord(value, path, output);
        else if (Array.isArray(value)) {
            if (value.some(isRecord)) value.forEach((item, index) => isRecord(item)
                ? flattenRecord(item, `${path} ${index + 1}`, output)
                : output[`${path} ${index + 1}`] = item ?? '');
            else output[path] = value.filter((item) => item != null).join('; ');
        } else output[path] = value ?? '';
    });
    return output;
}

function tableSection(name, records) {
    if (!Array.isArray(records) || records.length === 0) return null;
    const flat = records.map((record) => flattenRecord(record));
    const keys = [...new Set(flat.flatMap((record) => Object.keys(record)))];
    if (!keys.length) return null;
    return { name, keys, headers: keys.map(humanize), rows: flat.map((record) => keys.map((key) => record[key] ?? '')) };
}

function metricSection(name, metrics) {
    const flat = flattenRecord(metrics);
    const entries = Object.entries(flat).filter(([, value]) => value !== '' && value != null);
    if (!entries.length) return null;
    return { name, keys: ['Metric', 'Value'], headers: ['Metric', 'Value'], rows: entries.map(([key, value]) => [humanize(key), formatValue(key, value)]) };
}

function mixedSection(name, groups) {
    const records = groups.flatMap(([category, rows]) => (rows || []).map((row) => ({ category, ...row })));
    return tableSection(name, records);
}

export function buildAdminAnalyticsSections(analytics) {
    if (!analytics) return [];
    const filters = analytics.filters || {};
    const summary = analytics.summary || {};
    const headerMetrics = {
        reportPeriod: `${filters.startDate || ''} to ${filters.endDate || ''}`,
        bus: filters.busId || 'All Buses',
        direction: filters.direction || 'All Directions',
        paymentMethod: filters.paymentMethod || 'All',
        transactionStatus: filters.transactionStatus || 'All',
        generatedAt: analytics.generatedAt || '',
    };
    const sections = [metricSection('Report Summary', { ...headerMetrics, ...summary })];
    sections.push(tableSection('Revenue Trend', analytics.trends?.revenue));
    sections.push(tableSection('Passenger Trend', analytics.trends?.passengers));
    sections.push(mixedSection('Bus Performance', [
        ['Fare Results', analytics.busPerformance?.buses],
        ['Passenger Counts', analytics.busPerformance?.passengersByBus],
        ['Fare Revenue', analytics.busPerformance?.revenueByBus],
    ]));
    sections.push(tableSection('Daily Bus Performance', analytics.dailyBusPerformance));
    sections.push(tableSection('Direction Performance', analytics.directionAnalytics?.directions));
    sections.push(metricSection('Passenger Analytics', analytics.passengerAnalytics));
    sections.push(mixedSection('Payment Analytics', [
        ['Payment Methods', analytics.paymentAnalytics?.methods],
        ['Daily Counts', analytics.paymentAnalytics?.dailyTrend],
    ]));
    sections.push(mixedSection('Transaction Analytics', [
        ['Status', analytics.transactionAnalytics?.statuses],
        ['Failure Reasons', analytics.transactionAnalytics?.failureReasons],
        ['Failed Attempts', analytics.transactionAnalytics?.failedTransactions],
    ]));
    sections.push(mixedSection('Fleet Analytics', [
        ['Bus Utilization', analytics.fleetAnalytics?.utilization],
        ['Top Performing Buses', analytics.fleetAnalytics?.topPerformingBuses],
        ['Buses Requiring Attention', analytics.fleetAnalytics?.busesRequiringAttention],
    ]));
    sections.push(mixedSection('Terminal Analytics', [
        ['Terminal Health', analytics.terminalAnalytics?.terminals],
        ['Current Queues', analytics.terminalAnalytics?.queues],
    ]));
    sections.push(mixedSection('Recent Activity', [
        ['Fare Transactions', analytics.recent?.fareTransactions],
        ['Support Tickets', analytics.recent?.supportTickets],
        ['System Alerts', analytics.recent?.systemAlerts],
    ]));
    sections.push(metricSection('Data Quality', analytics.dataQuality));
    return sections.filter(Boolean);
}

export function downloadAdminAnalyticsCsv(sections, filename) {
    const rows = [];
    sections.forEach((section, index) => {
        if (index) rows.push([]);
        rows.push([section.name]);
        rows.push(section.headers);
        section.rows.forEach((row) => rows.push(row.map((value, index) => formatValue(section.keys[index], value))));
    });
    const contents = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
    saveBlob(filename, contents, 'text/csv;charset=utf-8');
}

export function downloadAdminAnalyticsXlsx(sections, filename) {
    const sheets = sections.map((section) => {
        const currencyColumns = section.keys.map((key, index) => /revenue|amount|fare|balance|price/i.test(key) ? index + 1 : null).filter(Boolean);
        return {
            name: safeSheetName(section.name),
            rows: [section.headers, ...section.rows],
            autoFilter: section.rows.length > 0,
            ...(currencyColumns.length ? { currencyColumns } : {}),
        };
    });
    downloadXlsxSheets(sheets, filename);
}

export function downloadAdminAnalyticsPdf(analytics, sections) {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error('Allow the PDF report window and try again.');
    const title = 'Premier Transport Corporation — Admin Analytics Report';
    const body = sections.map((section) => `
        <section>
            <h2>${escapeHtml(section.name)}</h2>
            <div class="table-wrap"><table>
                <thead><tr>${section.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                <tbody>${section.rows.map((row) => `<tr>${row.map((cell, index) => `<td>${escapeHtml(formatValue(section.keys[index], cell))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>
        </section>`).join('');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
        <style>
            @page { size: landscape; margin: 14mm; }
            body { color: #28242a; font: 10px Arial, sans-serif; }
            h1 { color: #6f2f3c; font-size: 20px; margin: 0 0 4px; }
            .meta { color: #555; margin: 0 0 18px; }
            h2 { color: #6f2f3c; font-size: 14px; margin: 18px 0 7px; break-after: avoid; }
            table { border-collapse: collapse; width: 100%; font-size: 8px; }
            th, td { border: 1px solid #d7d4d5; padding: 4px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
            th { background: #6f2f3c; color: #fff; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; }
            section { break-inside: auto; }
            @media screen { body { max-width: 1200px; margin: 24px auto; } }
        </style></head><body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">Period: ${escapeHtml(analytics.filters?.startDate || '')} to ${escapeHtml(analytics.filters?.endDate || '')} · Generated: ${escapeHtml(analytics.generatedAt || '')} · All dates use Asia/Manila</p>
        ${body}<script>window.addEventListener('load', () => window.print());</script></body></html>`);
    popup.document.close();
}

function formatValue(key, value) {
    if (value == null) return '';
    if (typeof value === 'number' && /revenue|amount|fare|balance|price/i.test(String(key || ''))) {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
    }
    return String(value);
}
function safeSheetName(value) { return value.replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Analytics'; }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function saveBlob(filename, content, type) {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
