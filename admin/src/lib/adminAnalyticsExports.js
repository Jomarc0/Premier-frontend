import { csvEscape } from './csv.js';
import { downloadXlsxSheets } from './fareReportExports.js';
import { createTableReportPdf, downloadReportBlob } from './reportExportCore.js';

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
    const entries = Object.entries(flat).filter(([key, value]) => (value !== '' && value != null)
        || /registeredBusinessAddress|taxpayerIdentificationNumber|registrationDetails|preparedBy/i.test(key));
    if (!entries.length) return null;
    return { name, keys: ['Metric', 'Value'], headers: ['Metric', 'Value'], rows: entries.map(([key, value]) => [humanize(key), value === '' ? '____________________' : value]) };
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
        companyName: 'PREMIER TRANSPORT CORPORATION',
        reportTitle: 'ADMINISTRATOR ANALYTICS REPORT',
        reportPeriod: `${formatPhtDate(filters.startDate)} to ${formatPhtDate(filters.endDate)}`,
        bus: filters.busId || 'All Buses',
        direction: filters.direction || 'All Directions',
        paymentMethod: filters.paymentMethod || 'All',
        transactionStatus: filters.transactionStatus || 'All',
        generatedAt: formatPhtDateTime(analytics.generatedAt),
        registeredBusinessAddress: '',
        taxpayerIdentificationNumber: '',
        registrationDetails: '',
        preparedBy: '',
        reportClassification: 'Internal accounting support; not an official BIR form',
    };
    const sections = [metricSection('Report Summary', { ...headerMetrics, ...summary })];
    sections.push(tableSection('Revenue Trend', analytics.trends?.revenue));
    sections.push(tableSection('Passenger Trend', analytics.trends?.passengers));
    sections.push(metricSection('Passenger Trend Summary', analytics.trends?.passengerSummary));
    sections.push(mixedSection('Bus Performance', [
        ['Fare Results', analytics.busPerformance?.buses],
        ['Passenger Counts', analytics.busPerformance?.passengersByBus],
        ['Fare Revenue', analytics.busPerformance?.revenueByBus],
    ]));
    sections.push(tableSection('Available Buses', (analytics.busPerformance?.availableBuses || []).map((bus) => ({ bus }))));
    sections.push(tableSection('Daily Bus Performance', analytics.dailyBusPerformance));
    sections.push(tableSection('Direction Performance', analytics.directionAnalytics?.directions));
    sections.push(metricSection('Direction Data Quality', { unknownDirectionTransactions: analytics.directionAnalytics?.unknownDirectionTransactions }));
    sections.push(tableSection('Hourly Passenger Volume', analytics.passengerAnalytics?.hourlyVolume));
    sections.push(metricSection('Passenger Analytics', { ...analytics.passengerAnalytics, hourlyVolume: undefined }));
    sections.push(mixedSection('Payment Analytics', [
        ['Payment Methods', analytics.paymentAnalytics?.methods],
        ['Daily Counts', analytics.paymentAnalytics?.dailyTrend],
    ]));
    sections.push(mixedSection('Transaction Analytics', [
        ['Status', analytics.transactionAnalytics?.statuses],
        ['Failure Reasons', analytics.transactionAnalytics?.failureReasons],
        ['Failed Attempts', analytics.transactionAnalytics?.failedTransactions],
    ]));
    sections.push(metricSection('Transaction Payment Success Rate', { paymentSuccessRate: analytics.transactionAnalytics?.paymentSuccessRate }));
    sections.push(mixedSection('Fleet Analytics', [
        ['Bus Utilization', analytics.fleetAnalytics?.utilization],
        ['Top Performing Buses', analytics.fleetAnalytics?.topPerformingBuses],
        ['Buses Requiring Attention', analytics.fleetAnalytics?.busesRequiringAttention],
    ]));
    sections.push(metricSection('Fleet Ranking Availability', {
        rankingMetricsAvailable: analytics.fleetAnalytics?.rankingMetricsAvailable,
        rankingMetricsUnavailable: analytics.fleetAnalytics?.rankingMetricsUnavailable,
    }));
    sections.push(mixedSection('Terminal Analytics', [
        ['Terminal Health', analytics.terminalAnalytics?.terminals],
        ['Current Queues', analytics.terminalAnalytics?.queues],
    ]));
    sections.push(metricSection('Terminal Operations Summary', {
        online: analytics.terminalAnalytics?.online,
        offline: analytics.terminalAnalytics?.offline,
        missingGpsUpdates: analytics.terminalAnalytics?.missingGpsUpdates,
        availability: analytics.terminalAnalytics?.availability,
        queueHistoryAvailable: analytics.terminalAnalytics?.queueHistoryAvailable,
        queueHistoryMessage: analytics.terminalAnalytics?.queueHistoryMessage,
    }));
    sections.push(mixedSection('Recent Activity', [
        ['Fare Transactions', analytics.recent?.fareTransactions],
        ['Support Tickets', analytics.recent?.supportTickets],
        ['System Alerts', analytics.recent?.systemAlerts],
    ]));
    sections.push(metricSection('Data Quality', analytics.dataQuality));
    sections.push(metricSection('Period Comparison', analytics.comparison));
    sections.push(metricSection('Analytics Options', analytics.options));
    sections.push(metricSection('Forecast Availability', analytics.forecast));
    sections.push(metricSection('Analytics Definitions', analytics.definitions));
    return sections.filter(Boolean);
}

function directionLabel(value) {
    if (value === 'SM_TO_GRAND') return 'SM Terminal to Grand Terminal';
    if (value === 'GRAND_TO_SM') return 'Grand Terminal to SM Terminal';
    return value || 'Unknown';
}

export function downloadAdminAnalyticsCsv(sections, filename) {
    const rows = [];
    sections.forEach((section, index) => {
        if (index) rows.push([]);
        rows.push([section.name]);
        rows.push(section.headers);
        section.rows.forEach((row) => rows.push(row.map((value, index) => formatSectionValue(section, row, index))));
    });
    const contents = `\uFEFF${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}`;
    return downloadReportBlob(filename, contents, 'text/csv;charset=utf-8');
}

export function downloadAdminAnalyticsXlsx(sections, filename) {
    const usedNames = new Set();
    const sheets = sections.map((section, index) => {
        const currencyColumns = section.keys.map((key, index) => /revenue|amount|fare|balance|price/i.test(key) ? index + 1 : null).filter(Boolean);
        const name = uniqueSheetName(safeSheetName(section.name), usedNames);
        const tableName = `AnalyticsTable${index + 1}`;
        const currencyRows = section.name.includes('Metric') || section.name === 'Report Summary'
            ? section.rows.map((row, rowIndex) => /revenue|amount|fare|balance|price/i.test(String(row[0])) && typeof row[1] === 'number' ? rowIndex + 1 : null).filter(Boolean)
            : [];
        return {
            name,
            tableName,
            rows: [uniqueHeaders(section.headers), ...section.rows],
            autoFilter: section.rows.length > 0,
            table: section.rows.length > 0,
            orientation: section.name === 'Report Summary' ? 'portrait' : 'landscape',
            currencyRows,
            dateColumns: section.keys.map((key, i) => /^date(day)?$/i.test(key) ? i + 1 : null).filter(Boolean),
            dateTimeColumns: section.keys.map((key, i) => /^(dateTime|lastHeartbeat|createdAt|updatedAt)$/i.test(key) ? i + 1 : null).filter(Boolean),
            ...(currencyColumns.length ? { currencyColumns } : {}),
        };
    });
    return downloadXlsxSheets(sheets, filename);
}

export function downloadAdminAnalyticsPdf(analytics, sections, filename) {
    return downloadReportBlob(filename, createAdminAnalyticsPdf(analytics, sections), 'application/pdf');
}

export function createAdminAnalyticsPdf(analytics, sections) {
    const filters = analytics.filters || {};
    const header = {
        period: `${formatPhtDate(filters.startDate)} to ${formatPhtDate(filters.endDate)}`,
        generatedAt: `${formatPhtDateTime(analytics.generatedAt)} (Asia/Manila)`,
        bus: selectedBusLabel(filters, analytics.options),
    };
    const footer = `Internal accounting support; not an official BIR form | Asia/Manila`;
    const pdfSections = buildPdfSections(analytics, sections);
    return createTableReportPdf(header, pdfSections, footer, formatPdfValue);
}

function buildPdfSections(analytics, existingSections) {
    const filters = analytics.filters || {};
    const summary = analytics.summary || {};
    const filterSummary = metricSection('Report Summary', {
        reportingPeriod: `${formatPhtDate(filters.startDate)} to ${formatPhtDate(filters.endDate)}`,
        bus: selectedBusLabel(filters, analytics.options),
        direction: filters.direction || 'All Directions',
        paymentMethod: filters.paymentMethod || 'All',
        transactionStatus: filters.transactionStatus || 'All',
        ...summary,
    });
    if (filterSummary) filterSummary.rows = filterSummary.rows.map(([label, value]) => [
        label.replaceAll('.', ' - ').replace('Best Performing Bus - Bus', 'Best Performing Bus').replace('Peak Direction - Label', 'Peak Direction'),
        value,
    ]);
    const revenue = analytics.trends?.revenue || [];
    const passengers = analytics.trends?.passengers || [];
    const revenueTable = tableSection('Revenue Trend', revenue.length ? [...revenue, {
        date: 'TOTAL', name: '', revenue: sumRows(revenue, 'revenue'),
    }] : []);
    const passengerTable = tableSection('Passenger Trend', passengers.length ? [...passengers, {
        date: 'TOTAL', name: '', passengers: sumRows(passengers, 'passengers'),
        uniquePassengers: summary.uniquePassengers ?? '',
    }] : []);
    const buses = analytics.busPerformance?.buses || [];
    const busRows = buses.map((row, index) => ({
        number: index + 1,
        busPlateNumber: row.bus || row.name || 'Unassigned',
        revenue: row.revenue,
        passengers: row.passengers,
        uniquePassengers: row.uniquePassengers,
        transactions: row.passengers,
    }));
    if (busRows.length) busRows.push({
        number: 'TOTAL', busPlateNumber: '', revenue: sumRows(busRows, 'revenue'),
        passengers: sumRows(busRows, 'passengers'), uniquePassengers: summary.uniquePassengers ?? '',
        transactions: sumRows(busRows, 'transactions'),
    });
    const busTable = tableSection('Bus Performance', busRows);
    const directions = analytics.directionAnalytics?.directions || [];
    const directionRows = directions.map((row, index) => ({
        number: index + 1,
        direction: row.label || row.name || directionLabel(row.direction),
        passengers: row.passengers,
        revenue: row.revenue,
        transactions: row.transactions ?? row.passengers,
    }));
    if (directionRows.length) directionRows.push({
        number: 'TOTAL', direction: '', passengers: sumRows(directionRows, 'passengers'),
        revenue: sumRows(directionRows, 'revenue'), transactions: sumRows(directionRows, 'transactions'),
    });
    const directionTable = tableSection('Direction Performance', directionRows);
    const methods = analytics.paymentAnalytics?.methods || [];
    const paymentRows = methods.map((row) => ({
        paymentMethod: row.name || row.method,
        transactionCount: row.transactionCount ?? row.count,
        successfulTransactions: row.successfulTransactions ?? row.count,
        totalCollection: row.revenue,
    }));
    if (paymentRows.length) paymentRows.push({
        paymentMethod: 'TOTAL', transactionCount: sumRows(paymentRows, 'transactionCount'),
        successfulTransactions: sumRows(paymentRows, 'successfulTransactions'),
        totalCollection: sumRows(paymentRows, 'totalCollection'),
    });
    const paymentTable = tableSection('Payment Method Summary', paymentRows);
    const statuses = analytics.transactionAnalytics?.statuses || [];
    const statusRows = statuses.map((row) => ({
        status: row.name || row.status,
        count: row.count,
        amount: row.amount ?? 0,
    }));
    if (statusRows.length) statusRows.push({ status: 'TOTAL', count: sumRows(statusRows, 'count'), amount: sumRows(statusRows, 'amount') });
    const statusTable = tableSection('Transaction Status', statusRows);

    const omitted = new Set(['Report Summary', 'Revenue Trend', 'Passenger Trend', 'Bus Performance', 'Direction Performance', 'Payment Analytics', 'Transaction Analytics']);
    const extras = existingSections.filter((section) => !omitted.has(section.name));
    const metricExtras = extras.filter((section) => section.keys?.[0] === 'Metric');
    const additionalMetrics = metricExtras.flatMap((section) => section.rows.map(([metric, value]) => [`${section.name} - ${metric}`.replaceAll('.', ' - '), value]));
    const extraTables = extras.filter((section) => section.keys?.[0] !== 'Metric');
    const additional = [
        tableSection('Daily Payment Counts', analytics.paymentAnalytics?.dailyTrend),
        tableSection('Payment Failure Reasons', analytics.transactionAnalytics?.failureReasons),
        tableSection('Failed Payment Attempts', analytics.transactionAnalytics?.failedTransactions),
    ].filter(Boolean);
    const metricsTable = additionalMetrics.length ? {
        name: 'Additional Analytics Metrics', keys: ['Metric', 'Value'], headers: ['Metric', 'Value'], rows: additionalMetrics,
    } : null;
    return [filterSummary, revenueTable, passengerTable, busTable, directionTable, paymentTable, statusTable, ...additional, metricsTable, ...extraTables].filter(Boolean);
}

function sumRows(rows, key) {
    return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

function selectedBusLabel(filters, options) {
    if (!filters.busId) return 'All Buses';
    const selected = (options?.buses || []).find((bus) => String(bus.id) === String(filters.busId));
    return selected?.label || selected?.plateNumber || String(filters.busId);
}

function formatValue(key, value) {
    if (value == null) return '';
    if (typeof value === 'number' && /revenue|amount|fare|balance|price/i.test(String(key || ''))) {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
    }
    if (typeof value === 'string' && /^(date|day)$/i.test(String(key || '')) && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatPhtDate(value);
    if (typeof value === 'string' && /^(dateTime|lastHeartbeat|createdAt|updatedAt)$/i.test(String(key || '')) && !Number.isNaN(new Date(value).getTime())) return formatPhtDateTime(value);
    return String(value);
}
function formatPhtDate(value) {
    if (!value) return '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
function formatPhtDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(date)} PHT`;
}
function safeSheetName(value) { return value.replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Analytics'; }
function uniqueSheetName(name, used) {
    let result = name.slice(0, 31), suffix = 2;
    while (used.has(result.toLowerCase())) {
        const tail = ` ${suffix++}`;
        result = `${name.slice(0, 31 - tail.length)}${tail}`;
    }
    used.add(result.toLowerCase());
    return result;
}
function uniqueHeaders(headers) {
    const used = new Set();
    return headers.map((header, index) => {
        const base = String(header || `Column ${index + 1}`);
        let value = base, suffix = 2;
        while (used.has(value.toLowerCase())) value = `${base} ${suffix++}`;
        used.add(value.toLowerCase());
        return value;
    });
}
function formatPdfValue(key, value) {
    const normalizedKey = String(key || '').split(/[. ]/).findLast((part) => /^(date|day|dateTime|lastHeartbeat|createdAt|updatedAt|direction|paymentMethod|status)$/i.test(part)) || key;
    if (/^direction$/i.test(normalizedKey) && typeof value === 'string' && value) value = directionLabel(value);
    if (/^paymentMethod$/i.test(normalizedKey) && value === 'ASSISTED_CASH') value = 'Assisted Cash';
    if (/^status$/i.test(normalizedKey) && typeof value === 'string') value = humanize(value);
    if (/^(date|day)$/i.test(normalizedKey) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatPhtDate(value);
    if (/^(dateTime|lastHeartbeat|createdAt|updatedAt)$/i.test(normalizedKey) && value && !Number.isNaN(new Date(value).getTime())) return formatPhtDateTime(value);
    if (typeof value === 'number' && /collection/i.test(String(key || ''))) {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
    }
    if (typeof value === 'number' && !/revenue|amount|fare|balance|price/i.test(String(key || ''))) {
        return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 }).format(value);
    }
    return formatValue(key, value);
}
function formatSectionValue(section, row, index) {
    const key = section.keys[0] === 'Metric' && index === 1 ? row[0] : section.keys[index];
    return formatValue(key, row[index]);
}
