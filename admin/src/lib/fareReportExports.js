import { csvEscape } from './csv.js';

const columns = [
    ['transaction_id', 'Transaction ID'], ['passenger_id', 'Passenger ID'],
    ['passenger_identifier', 'Passenger Card'], ['passenger_name', 'Passenger Name'],
    ['plate_number', 'Bus Plate'], ['occurred_at', 'Transaction Date'], ['transaction_time', 'Transaction Time'],
    ['payment_method', 'Payment Method'], ['fare_amount', 'Fare Amount (PHP)'],
    ['status', 'Status'], ['reversed', 'Reversed'], ['direction', 'Direction'],
    ['reference_number', 'Reference'],
];

const phtDate = (value) => value ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(value)) : '';
const phtTime = (value) => value ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true,
}).format(new Date(value)) : '';
const peso = (value) => Number(value || 0).toFixed(2);
const val = (row, key) => {
    if (key === 'occurred_at') return phtDate(row[key]);
    if (key === 'transaction_time') return phtTime(row.occurred_at);
    if (key === 'fare_amount') return peso(row[key]);
    if (key === 'reversed') return row[key] ? 'Yes' : 'No';
    return row[key] ?? '';
};

export function downloadFareCsv(rows, filename) {
    const lines = [columns.map(([, label]) => csvEscape(label)).join(',')];
    rows.forEach((row) => lines.push(columns.map(([key]) => csvEscape(val(row, key))).join(',')));
    saveBlob(filename, `\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8');
}

export function downloadFareXlsx(rows, report, filename) {
    const s = report.summary || {};
    const summaryRows = [
        ['Fare Transaction Report', ''], ['Reporting period', `${report.startDate} to ${report.endDate}`],
        ['Bus selection', report.busLabel], ['Total transactions', Number(s.totalCount || 0)],
        ['Successful transactions', Number(s.successfulCount || 0)], ['Failed transactions', Number(s.failedCount || 0)],
        ['Pending / processing', Number(s.pendingCount || 0)], ['Cancelled transactions', Number(s.cancelledCount || 0)],
        ['Reversed transactions', Number(s.reversedCount || 0)], ['Successful fare revenue (PHP)', Number(s.successfulRevenue || 0)],
        ['Generated (PHT)', report.generatedAt],
    ];
    const transactionRows = [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => {
        if (key === 'occurred_at' || key === 'transaction_time') return row.occurred_at || '';
        return val(row, key);
    }))];
    const busRows = [['Bus Plate', 'Transaction Count', 'Successful Revenue (PHP)'], ...(report.busBreakdown || []).map((bus) => [bus.plate_number ?? '', Number(bus.transaction_count || 0), Number(bus.successful_revenue || 0)])];
    const sheets = [
        { name: 'Report Summary', rows: summaryRows, currencyRows: [9] },
        { name: 'All Fare Transactions', rows: transactionRows, autoFilter: true, dateColumn: 6, timeColumn: 7, currencyColumn: 9 },
    ];
    if (report.vehicleId == null) sheets.push({ name: 'Bus Breakdown', rows: busRows, autoFilter: true, currencyColumn: 3 });
    downloadWorkbook(sheets, filename);
}

function downloadWorkbook(sheets, filename) {
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const entries = [
        ['[Content_Types].xml', contentTypes],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
        ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
        ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;PHP &quot;#,##0.00"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Aptos"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="21" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ];
    sheets.forEach((sheet, index) => entries.push([`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)]));
    saveBlob(filename, zipStore(entries), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function downloadXlsxSheets(sheets, filename) {
    downloadWorkbook(sheets, filename);
}

function sheetXml(sheet) {
    const rows = sheet.rows.map((row, ri) => `<row r="${ri + 1}">${row.map((cell, ci) => {
        const ref = `${excelColumn(ci + 1)}${ri + 1}`;
        if (sheet.currencyRows?.includes(ri) && ci === 1) return `<c r="${ref}" s="3"><v>${Number(cell || 0)}</v></c>`;
        if (sheet.currencyColumns?.includes(ci + 1) && ri > 0) return `<c r="${ref}" s="3"><v>${Number(cell || 0)}</v></c>`;
        if (sheet.currencyColumn === ci + 1 && ri > 0) return `<c r="${ref}" s="3"><v>${Number(cell || 0)}</v></c>`;
        if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}"><v>${cell}</v></c>`;
        if (sheet.dateColumn === ci + 1 && ri > 0 && cell) {
            const date = new Date(cell);
            const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
            const [month, day, year] = ['month', 'day', 'year'].map((key) => Number(dateParts.find((part) => part.type === key).value));
            const excelDate = Date.UTC(year, month - 1, day) / 86400000 + 25569;
            return `<c r="${ref}" s="1"><v>${excelDate}</v></c>`;
        }
        if (sheet.timeColumn === ci + 1 && ri > 0 && cell) {
            const date = new Date(cell);
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
            const part = (key) => Number(parts.find((item) => item.type === key).value);
            const time = (part('hour') * 3600 + part('minute') * 60 + part('second')) / 86400;
            return `<c r="${ref}" s="2"><v>${time}</v></c>`;
        }
        const text = String(cell ?? '');
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const lastCol = excelColumn(Math.max(1, ...sheet.rows.map((row) => row.length)));
    const lastRow = Math.max(1, sheet.rows.length);
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${sheet.autoFilter ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rows}</sheetData>${sheet.autoFilter ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : ''}</worksheet>`;
}

function excelColumn(value) {
    let result = '';
    for (let n = value; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
    return result;
}
function xml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }

function zipStore(entries) {
    const encoder = new TextEncoder();
    const local = [], central = [];
    let offset = 0;
    for (const [name, content] of entries) {
        const nameBytes = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
        const head = new Uint8Array(30 + nameBytes.length); const view = new DataView(head.buffer);
        view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true); view.setUint16(8, 0, true);
        view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, nameBytes.length, true); head.set(nameBytes, 30);
        local.push(head, data);
        const dir = new Uint8Array(46 + nameBytes.length); const dv = new DataView(dir.buffer);
        dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true); dv.setUint16(8, 0x0800, true); dv.setUint16(10, 0, true);
        dv.setUint32(16, crc, true); dv.setUint32(20, data.length, true); dv.setUint32(24, data.length, true); dv.setUint16(28, nameBytes.length, true); dv.setUint32(42, offset, true); dir.set(nameBytes, 46);
        central.push(dir); offset += head.length + data.length;
    }
    const centralSize = central.reduce((n, row) => n + row.length, 0);
    const end = new Uint8Array(22); const ev = new DataView(end.buffer); ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
}
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
}

export function downloadFarePdf(rows, report, filename) {
    const records = rows.map((r) => {
        const passenger = [r.passenger_id, r.passenger_identifier, r.passenger_name].filter(Boolean).join(' / ');
        const first = [r.transaction_id, passenger, r.plate_number, phtDate(r.occurred_at), phtTime(r.occurred_at)].map((v) => String(v ?? '')).join(' | ');
        const second = [r.payment_method, `PHP ${peso(r.fare_amount)}`, r.reversed ? 'REVERSED' : r.status, r.direction, r.reference_number].map((v) => String(v ?? '')).join(' | ');
        return [...wrapPdfLine(first), ...wrapPdfLine(second)];
    });
    const chunks = [[]]; let detailLines = 0;
    records.forEach((record) => {
        if (detailLines + record.length > 25) { chunks.push([]); detailLines = 0; }
        chunks[chunks.length - 1].push(...record); detailLines += record.length;
    });
    const pages = chunks.map((chunk, pageIndex) => {
        const lines = [
            'PREMIER TRANSPORT CORPORATION - FARE TRANSACTION REPORT',
            `Period: ${report.startDate} to ${report.endDate}    Bus: ${report.busLabel}`,
            `Generated: ${report.generatedAt}    Total records: ${report.summary.totalCount}`,
            `Successful count: ${report.summary.successfulCount}    Successful revenue: PHP ${peso(report.summary.successfulRevenue)}`,
            '', 'INDIVIDUAL FARE TRANSACTIONS', 'Transaction ID | Passenger ID / Card / Name | Bus | Date | Time', 'Payment method | Fare | Status | Direction | Reference', ...chunk,
            '', `Page ${pageIndex + 1} of ${chunks.length}`,
        ];
        return pdfPageContent(lines);
    });
    saveBlob(filename, makePdf(pages), 'application/pdf');
}

function wrapPdfLine(value) {
    const text = String(value ?? ''); const lines = [];
    for (let start = 0; start < text.length; start += 190) lines.push(text.slice(start, start + 190));
    return lines.length ? lines : [''];
}

function pdfPageContent(lines) {
    const safe = (text) => String(text).replace(/[^\x20-\x7E]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    return `BT /F1 7.2 Tf 28 565 Td 9 TL ${lines.map((line, i) => `${i ? 'T* ' : ''}(${safe(line)}) Tj`).join(' ')} ET`;
}
function makePdf(pages) {
    const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    pages.forEach((content, index) => {
        const pageId = 5 + index * 2, streamId = pageId + 1;
        objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
        objs.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
    });
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objs.forEach((obj, i) => { offsets.push(new TextEncoder().encode(pdf).length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
    const xref = new TextEncoder().encode(pdf).length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return pdf;
}

function saveBlob(filename, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
