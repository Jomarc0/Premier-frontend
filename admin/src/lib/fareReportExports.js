import { csvEscape } from './csv.js';
import { createTableReportPdf, downloadReportBlob } from './reportExportCore.js';

const columns = [
    ['transaction_id', 'Transaction ID'], ['record_source', 'Record Source'], ['passenger_id', 'Passenger ID'],
    ['passenger_identifier', 'Passenger Card'], ['passenger_name', 'Passenger Name'],
    ['plate_number', 'Bus Plate'], ['occurred_at', 'Transaction Date'], ['transaction_time', 'Transaction Time'],
    ['payment_method', 'Payment Method'], ['fare_amount', 'Fare Amount (PHP)'],
    ['status', 'Status'], ['reversed', 'Reversed'],
    ['reference_number', 'Reference'],
];

const parsePhtDate = (value) => {
    if (!value) return null;
    const raw = String(value);
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
    const date = new Date(!hasZone && /^\d{4}-\d\d-\d\dT/.test(raw) ? `${raw}+08:00` : raw);
    return Number.isNaN(date.getTime()) ? null : date;
};
const phtDate = (value) => parsePhtDate(value) ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: '2-digit',
}).format(parsePhtDate(value)) : '';
const phtTime = (value) => parsePhtDate(value) ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true,
}).format(parsePhtDate(value)) : '';
const phtPeriodDate = (value) => phtDate(value ? `${value}T12:00:00+08:00` : '');
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
    return downloadReportBlob(filename, `\uFEFF${lines.join('\r\n')}`, 'text/csv;charset=utf-8');
}

export function downloadFareXlsx(rows, report, filename) {
    const s = report.summary || {};
    const breakdown = report.paymentBreakdown || [];
    const summaryRows = [
        ['Section', 'Metric', 'Value'],
        ['Company', 'Name', 'PREMIER TRANSPORT CORPORATION'],
        ['Report', 'Title', 'Fare Transaction and Collection Report'],
        ['Report', 'Classification', 'Internal accounting support; not an official BIR form'],
        ['Report', 'Period (PHT)', `${phtPeriodDate(report.startDate)} to ${phtPeriodDate(report.endDate)}`],
        ['Report', 'Bus', report.busLabel || 'All buses'],
        ...(report.reportReference ? [['Report', 'Reference', String(report.reportReference)]] : []),
        ['Report', 'Generated (PHT)', report.generatedAt || ''],
        ['Transactions', 'All transaction attempts', Number(s.totalCount || 0)],
        ['Transactions', 'Successful', Number(s.successfulCount || 0)],
        ['Transactions', 'Failed', Number(s.failedCount || 0)],
        ['Transactions', 'Pending / processing', Number(s.pendingCount || 0)],
        ['Transactions', 'Cancelled', Number(s.cancelledCount || 0)],
        ['Transactions', 'Reversed', Number(s.reversedCount || 0)],
        ['Collections', 'Successful fare collections (PHP)', Number(s.successfulRevenue || 0)],
    ];
    const breakdownCount = breakdown.reduce((sum, item) => sum + Number(item.transaction_count || 0), 0);
    const breakdownAmount = breakdown.reduce((sum, item) => sum + Number(item.successful_amount || 0), 0);
    const breakdownRows = [['Payment Method', 'Transaction Count', 'Successful Collection (PHP)'],
        ...breakdown.map((item) => [displayMethod(item.payment_method), Number(item.transaction_count || 0), Number(item.successful_amount || 0)]),
        ['TOTAL', breakdownCount, breakdownAmount]];
    const transactionRows = [[
        'NO.', 'TRANSACTION ID', 'RECORD SOURCE', 'PASSENGER ID / CARD / NAME', 'BUS', 'DATE (PHT)', 'TIME (PHT)',
        'PAYMENT METHOD', 'FARE (PHP)', 'STATUS', 'REFERENCE NUMBER',
    ], ...rows.map((row, index) => [
        index + 1, String(row.transaction_id ?? ''), displayMethod(row.record_source),
        [row.passenger_id, row.passenger_identifier, row.passenger_name].filter(Boolean).map(String).join(' / ') || '—',
        String(row.plate_number ?? ''), row.occurred_at || '', row.occurred_at || '', displayMethod(row.payment_method),
        Number(row.fare_amount || 0), row.reversed ? 'REVERSED' : displayStatus(row.status), String(row.reference_number ?? ''),
    ])];
    const sheets = [
        { name: 'REPORT SUMMARY', rows: summaryRows, autoFilter: true, table: true, currencyCells: [summaryRows.length - 1], orientation: 'portrait' },
        { name: 'PAYMENT METHOD SUMMARY', rows: breakdownRows, autoFilter: true, table: true, currencyColumn: 3, totalRows: [breakdownRows.length - 1] },
        { name: 'INDIVIDUAL TRANSACTIONS', rows: transactionRows, autoFilter: true, table: true, dateColumn: 6, timeColumn: 7, currencyColumn: 9, columnWidths: [8, 30, 18, 38, 16, 16, 16, 22, 16, 18, 56] },
    ];
    return downloadWorkbook(sheets, filename);
}

function downloadWorkbook(sheets, filename) {
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${sheets.map((s, i) => s.table ? `<Override PartName="/xl/tables/table${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>` : '').join('')}</Types>`;
    const entries = [
        ['[Content_Types].xml', contentTypes],
        ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
        ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${sheets.map((sheet, i) => { const lastCol = excelColumn(sheet.rows.reduce((max, row) => Math.max(max, row.length), 1)); const lastRow = Math.max(1, sheet.rows.length); return `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xml(sheet.name)}'!$1:$1</definedName><definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(sheet.name)}'!$A$1:$${lastCol}$${lastRow}</definedName>`; }).join('')}</definedNames></workbook>`],
        ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
        ['xl/styles.xml', stylesXml()],
    ];
    sheets.forEach((sheet, index) => {
        entries.push([`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet)]);
        if (sheet.table) {
            const colCount = sheet.rows[0].length;
            const lastCol = excelColumn(colCount), lastRow = Math.max(1, sheet.rows.length);
            const tableCols = sheet.rows[0].map((name, i) => `<tableColumn id="${i + 1}" name="${xml(String(name || ('Column ' + (i + 1))))}"/>`).join('');
            entries.push([`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${index + 1}.xml"/></Relationships>`]);
            const tableName = String(sheet.tableName || `ReportTable${index + 1}`).replace(/[^A-Za-z0-9_]/g, '_');
            entries.push([`xl/tables/table${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${index + 1}" name="${tableName}" displayName="${tableName}" ref="A1:${lastCol}${lastRow}" totalsRowShown="0"><autoFilter ref="A1:${lastCol}${lastRow}"/><tableColumns count="${colCount}">${tableCols}</tableColumns><tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`]);
        }
    });
    return downloadReportBlob(filename, zipStore(entries), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function downloadXlsxSheets(sheets, filename) {
    return downloadWorkbook(sheets, filename);
}

function sheetXml(sheet) {
    const rows = sheet.rows.map((row, ri) => `<row r="${ri + 1}">${row.map((cell, ci) => {
        const ref = `${excelColumn(ci + 1)}${ri + 1}`;
        if (ri === 0) return `<c r="${ref}" s="4" t="inlineStr"><is><t xml:space="preserve">${xml(cell ?? '')}</t></is></c>`;
        const isTotal = sheet.totalRows?.includes(ri) || false;
        if (sheet.currencyRows?.includes(ri) && ci === 1) return `<c r="${ref}" s="5"><v>${Number(cell || 0)}</v></c>`;
        if (sheet.currencyCells?.includes(ri) && ci === 2) return `<c r="${ref}" s="3"><v>${Number(cell || 0)}</v></c>`;
        const numericCurrency = cell !== '' && cell != null && Number.isFinite(Number(cell)) ? Number(cell) : null;
        if ((sheet.currencyColumns?.includes(ci + 1) || sheet.currencyColumn === ci + 1) && ri > 0 && numericCurrency != null) return `<c r="${ref}" s="${isTotal ? 5 : 3}"><v>${numericCurrency}</v></c>`;
        if (typeof cell === 'number' && Number.isFinite(cell)) return `<c r="${ref}"${isTotal ? ' s="6"' : ''}><v>${cell}</v></c>`;
        if (sheet.dateTimeColumns?.includes(ci + 1) && ri > 0 && cell && parsePhtDate(cell)) {
            const date = parsePhtDate(cell);
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
            const part = (key) => Number(parts.find((item) => item.type === key).value);
            const serial = Date.UTC(part('year'), part('month') - 1, part('day')) / 86400000 + 25569
                + (part('hour') * 3600 + part('minute') * 60 + part('second')) / 86400;
            return `<c r="${ref}" s="7"><v>${serial}</v></c>`;
        }
        if ((sheet.dateColumn === ci + 1 || sheet.dateColumns?.includes(ci + 1)) && ri > 0 && cell && parsePhtDate(cell)) {
            const date = parsePhtDate(cell);
            const dateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
            const [month, day, year] = ['month', 'day', 'year'].map((key) => Number(dateParts.find((part) => part.type === key).value));
            const excelDate = Date.UTC(year, month - 1, day) / 86400000 + 25569;
            return `<c r="${ref}" s="1"><v>${excelDate}</v></c>`;
        }
        if (sheet.timeColumn === ci + 1 && ri > 0 && cell && parsePhtDate(cell)) {
            const date = parsePhtDate(cell);
            const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
            const part = (key) => Number(parts.find((item) => item.type === key).value);
            const time = (part('hour') * 3600 + part('minute') * 60 + part('second')) / 86400;
            return `<c r="${ref}" s="2"><v>${time}</v></c>`;
        }
        const text = String(cell ?? '');
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const lastCol = excelColumn(sheet.rows.reduce((max, row) => Math.max(max, row.length), 1));
    const lastRow = Math.max(1, sheet.rows.length);
    const widths = sheet.rows[0].map((_, ci) => {
        if (sheet.columnWidths?.[ci]) return sheet.columnWidths[ci];
        const max = sheet.rows.reduce((length, row) => Math.max(length, String(row[ci] ?? '').length), 10);
        return Math.min(60, max + 2);
    });
    const cols = `<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>`;
    const statusIndex = sheet.table ? sheet.rows[0].findIndex((value) => /status/i.test(String(value))) : -1;
    const statusColumn = statusIndex >= 0 ? excelColumn(statusIndex + 1) : '';
    const conditional = statusColumn && lastRow > 1 ? `<conditionalFormatting sqref="${statusColumn}2:${statusColumn}${lastRow}">${[
        ['FAILED', 0], ['PENDING', 1], ['CANCELLED', 2], ['REVERSED', 3], ['SUCCESS', 4],
    ].map(([status, dxfId], index) => `<cfRule type="containsText" dxfId="${dxfId}" priority="${index + 1}" operator="containsText" text="${status}"><formula>NOT(ISERROR(SEARCH(&quot;${status}&quot;,${statusColumn}2)))</formula></cfRule>`).join('')}</conditionalFormatting>` : '';
    return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0">${sheet.autoFilter ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${sheet.autoFilter && !sheet.table ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : ''}${conditional}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${sheet.orientation || 'landscape'}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LPremier Transport Corporation&amp;CInternal report&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter>${sheet.table ? '<tableParts count="1"><tablePart r:id="rId1"/></tableParts>' : ''}</worksheet>`;
}

function stylesXml() {
    const colors = [['FF9C0006', 'FFFFC7CE'], ['FF9C6500', 'FFFFEB9C'], ['FF9C6500', 'FFFFEB9C'], ['FF9C0006', 'FFFFC7CE'], ['FF006100', 'FFC6EFCE']];
    const dxfs = colors.map(([font, fill]) => `<dxf><font><color rgb="${font}"/></font><fill><patternFill patternType="solid"><fgColor rgb="${fill}"/></patternFill></fill></dxf>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="4"><numFmt numFmtId="164" formatCode="&quot;₱&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="hh:mm AM/PM"/><numFmt numFmtId="166" formatCode="dd mmm yyyy"/><numFmt numFmtId="167" formatCode="dd mmm yyyy hh:mm AM/PM"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6B1724"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><dxfs count="${colors.length}">${dxfs}</dxfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
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
    const summary = report.summary || {};
    const breakdown = report.paymentBreakdown || [];
    const allMethodCount = breakdown.reduce((sum, item) => sum + Number(item.transaction_count || 0), 0);
    const allMethodCollection = breakdown.reduce((sum, item) => sum + Number(item.successful_amount || 0), 0);
    const details = rows.map((row, index) => [
        index + 1, String(row.transaction_id ?? ''), displayMethod(row.record_source),
        [row.passenger_id, row.passenger_identifier, row.passenger_name].filter(Boolean).map(String).join(' / ') || '—',
        String(row.plate_number ?? ''), phtDate(row.occurred_at), phtTime(row.occurred_at), displayMethod(row.payment_method),
        `₱${peso(row.fare_amount)}`, row.reversed ? 'REVERSED' : displayStatus(row.status), String(row.reference_number ?? ''),
    ]);
    const sections = [
        { name: 'Report Information', headers: ['Metric', 'Value'], keys: ['Metric', 'Value'], rows: [
            ['Company', 'PREMIER TRANSPORT CORPORATION'],
            ['Report', 'Fare Transaction and Collection Report'],
            ['Report classification', 'Internal accounting support; not an official BIR form'],
            ['Reporting period (PHT)', `${phtPeriodDate(report.startDate)} to ${phtPeriodDate(report.endDate)}`],
            ['Bus selection', report.busLabel || 'All buses'],
            ...(report.reportReference ? [['Report reference', String(report.reportReference)]] : []),
            ['Generated (PHT)', report.generatedAt || ''],
        ] },
        { name: 'Collection Summary', headers: ['Metric', 'Value'], keys: ['Metric', 'Value'], rows: [
            ['All transaction attempts', Number(summary.totalCount || 0)],
            ['Successful transactions', Number(summary.successfulCount || 0)],
            ['Failed transactions', Number(summary.failedCount || 0)],
            ['Pending / processing transactions', Number(summary.pendingCount || 0)],
            ['Cancelled transactions', Number(summary.cancelledCount || 0)],
            ['Reversed transactions', Number(summary.reversedCount || 0)],
            ['Successful fare collections', `₱${peso(summary.successfulRevenue)}`],
        ] },
        { name: 'Payment Method Summary', headers: ['Payment Method', 'Transaction Count', 'Successful Collection (PHP)'], keys: ['Payment Method', 'Transaction Count', 'Successful Collection (PHP)'], pageBreakBefore: true, rows: [
            ...breakdown.map((item) => [displayMethod(item.payment_method), Number(item.transaction_count || 0), `₱${peso(item.successful_amount)}`]),
            ['TOTAL', allMethodCount, `₱${peso(allMethodCollection)}`],
        ] },
        { name: 'Individual Fare Transactions', headers: ['No.', 'Transaction ID', 'Record Source', 'Passenger ID / Card / Name', 'Bus', 'Date (PHT)', 'Time (PHT)', 'Payment Method', 'Fare (PHP)', 'Status', 'Reference Number'], keys: ['No.', 'Transaction ID', 'Record Source', 'Passenger', 'Bus', 'Date', 'Time', 'Payment Method', 'Fare', 'Status', 'Reference'], rows: details, pageBreakBefore: true, centerColumns: [0, 5, 6, 9], widthWeights: [5, 15, 9, 20, 7, 8, 7, 9, 7, 9, 24] },
        { name: 'Final Controls and Certification', headers: ['Control', 'Details'], keys: ['Control', 'Details'], pageBreakBefore: true, rows: [
            ['Total successful fare collections', `₱${peso(summary.successfulRevenue)}`],
            ['Prepared by', '____________________________________________'],
            ['Checked by', '____________________________________________'],
            ['Approved by', '____________________________________________'],
            ['Date', '____________________________________________'],
        ] },
    ];
    const period = `Period: ${phtPeriodDate(report.startDate)} to ${phtPeriodDate(report.endDate)} | Asia/Manila`;
    const pdf = createTableReportPdf({ title: 'FARE TRANSACTION AND COLLECTION REPORT' }, sections,
        `${period} | Internal accounting support; not an official BIR form`, (key, value) => String(value ?? ''), { compactHeader: true });
    return downloadReportBlob(filename, pdf, 'application/pdf');
}

function displayMethod(value) {
    return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function displayStatus(value) {
    return String(value ?? '').replaceAll('_', ' ').toUpperCase();
}
