/** Shared primitives for administrator report file downloads. */
export function downloadReportBlob(filename, content, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    if (!blob.size) throw new Error('The report export is empty.');

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
}

/** Build an A4 landscape PDF from report pages represented as plain text lines. */
export function createLandscapeReportPdf(pages, footerText = '') {
    const safePages = (pages.length ? pages : [['No report data available.']]).map((lines) => [...lines]);
    const pageCount = safePages.length;
    const contentStreams = safePages.map((lines, pageIndex) => {
        const operations = lines.map((line, index) => {
            const bold = index < 2 || index === 8 || (String(line).length > 3 && String(line) === String(line).toUpperCase());
            const font = bold ? 'F2' : 'F1';
            const size = index === 0 ? 13 : index === 1 ? 11 : bold ? 9.5 : 9;
            const y = 545 - index * 12;
            return `BT /${font} ${size} Tf 28 ${y} Td (${pdfText(line)}) Tj ET`;
        });
        operations.push(`BT /F1 7 Tf 28 18 Td (${pdfText(footerText)}) Tj ET`);
        operations.push(`BT /F1 7 Tf 760 18 Td (Page ${pageIndex + 1} of ${pageCount}) Tj ET`);
        return operations.join('\n');
    });

    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${contentStreams.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    contentStreams.forEach((content, index) => {
        const pageId = 5 + index * 2;
        const streamId = pageId + 1;
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
        objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
    });

    let output = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(new TextEncoder().encode(output).length);
        output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = new TextEncoder().encode(output).length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return output;
}

/** Build a paginated landscape PDF whose report sections are real ruled tables. */
export function createTableReportPdf(reportHeader, sections, footerText = '', valueFormatter = (key, value) => String(value ?? '')) {
    const pageWidth = 842, pageHeight = 595, margin = 32, bottom = 38, right = pageWidth - margin;
    const pages = [[]];
    let pageIndex = 0, y = pageHeight - 30;
    const newPage = () => { pages.push([]); pageIndex += 1; y = pageHeight - 30; };
    const add = (op) => pages[pageIndex].push(op);
    const color = (r, g, b) => `${r / 255} ${g / 255} ${b / 255}`;
    const text = (value, x, baseline, size, bold, fill) => {
        const source = String(value ?? '');
        const safe = pdfText(source);
        const width = safe.length * size * (bold ? 0.54 : 0.51);
        add(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color(...fill)} rg 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${safe}) Tj ET`);
        if (source.includes('₱')) {
            const pesoWidth = size * 0.67;
            add(`${color(...fill)} RG 0.65 w ${x.toFixed(2)} ${(baseline + size * 0.22).toFixed(2)} m ${(x + pesoWidth).toFixed(2)} ${(baseline + size * 0.22).toFixed(2)} l ${x.toFixed(2)} ${(baseline + size * 0.48).toFixed(2)} m ${(x + pesoWidth).toFixed(2)} ${(baseline + size * 0.48).toFixed(2)} l S`);
        }
        return width;
    };
    const drawCompanyHeader = () => {
        add(`${color(111, 47, 60)} rg ${margin} ${y - 3} ${right - margin} 3 re f`);
        y -= 24;
        text('PREMIER TRANSPORT CORPORATION', margin, y, 13, true, [111, 47, 60]); y -= 17;
        text('ADMINISTRATOR ANALYTICS REPORT', margin, y, 11, true, [40, 43, 58]); y -= 17;
        text(`Reporting Period: ${reportHeader.period || 'Not available'}`, margin, y, 9, true, [54, 61, 74]);
        text(`Generated At: ${reportHeader.generatedAt || 'Not available'}`, 430, y, 9, false, [54, 61, 74]); y -= 14;
        text(`Selected Bus: ${reportHeader.bus || 'All Buses'}`, margin, y, 9, false, [54, 61, 74]); y -= 16;
        add(`${color(218, 221, 226)} RG 0.6 w ${margin} ${y} m ${right} ${y} l S`);
        y -= 14;
    };
    drawCompanyHeader();

    const rowValue = (section, row, index) => {
        const metricKey = section.keys?.[0] === 'Metric' && index === 1 ? row[0] : section.keys?.[index];
        return valueFormatter(metricKey, row[index]);
    };
    const colWidths = (section) => {
        const weights = section.headers.map((header, index) => {
            const max = (section.rows || []).reduce((length, row) => Math.max(length, String(rowValue(section, row, index) ?? '').length), 0);
            return Math.max(7, Math.min(34, Math.max(String(header).length, max * 0.34)));
        });
        const total = right - margin, sum = weights.reduce((a, b) => a + b, 0);
        return weights.map((weight) => total * weight / sum);
    };
    const wrapCell = (value, width, size, bold = false) => {
        const limit = Math.max(5, Math.floor((width - 12) / (size * (bold ? 0.55 : 0.52))));
        const words = String(value ?? '').replace(/[\r\n]+/g, ' ').split(/\s+/).filter(Boolean);
        const lines = []; let line = '';
        words.forEach((word) => {
            if (word.length > limit) {
                if (line) { lines.push(line); line = ''; }
                for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit));
            } else if (!line) line = word;
            else if (`${line} ${word}`.length <= limit) line += ` ${word}`;
            else { lines.push(line); line = word; }
        });
        if (line) lines.push(line);
        return lines.length ? lines : [''];
    };
    const drawTableHead = (section, widths) => {
        const size = section.headers.length > 7 ? 7 : 8;
        const headerLines = section.headers.map((header, i) => wrapCell(header.toUpperCase(), widths[i], size, true));
        const height = Math.max(22, Math.max(...headerLines.map((lines) => lines.length)) * 9 + 10);
        add(`${color(111, 47, 60)} rg ${margin} ${y - height} ${right - margin} ${height} re f`);
        let x = margin;
        headerLines.forEach((lines, i) => {
            lines.forEach((line, n) => text(line, x + 6, y - 13 - n * 9, size, true, [255, 255, 255]));
            x += widths[i];
        });
        y -= height;
        return height;
    };
    const drawRow = (section, row, widths, rowIndex, totalRow = false) => {
        const size = section.headers.length > 7 ? 7 : 8;
        const values = section.headers.map((_, i) => rowValue(section, row, i));
        const cellLines = values.map((value, i) => wrapCell(value, widths[i], size, totalRow));
        const height = Math.max(20, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 9);
        if (totalRow) add(`${color(238, 239, 241)} rg ${margin} ${y - height} ${right - margin} ${height} re f`);
        else if (rowIndex % 2 === 1) add(`${color(246, 247, 248)} rg ${margin} ${y - height} ${right - margin} ${height} re f`);
        add(`${color(211, 215, 221)} RG 0.45 w ${margin} ${y - height} ${right - margin} ${height} re S`);
        let x = margin;
        cellLines.forEach((lines, i) => {
            const rawValue = row[i];
            const rightAlign = typeof rawValue === 'number' || (typeof values[i] === 'string' && /^(PHP |₱)/.test(values[i]));
            lines.forEach((line, n) => {
                const width = line.includes('₱')
                    ? (line.length - 1) * size * (totalRow ? 0.54 : 0.51) + size * 0.67
                    : line.length * size * (totalRow ? 0.54 : 0.51);
                const tx = rightAlign ? x + widths[i] - 6 - width : x + 6;
                text(line, Math.max(x + 4, tx), y - 13 - n * 9, size, totalRow, totalRow ? [40, 43, 58] : [54, 61, 74]);
            });
            x += widths[i];
        });
        y -= height;
    };

    (sections || []).forEach((section) => {
        if (!section.headers?.length) return;
        const widths = colWidths(section);
        const size = section.headers.length > 7 ? 7 : 8;
        const headerHeight = Math.max(22, Math.max(...section.headers.map((header, i) => wrapCell(header.toUpperCase(), widths[i], size, true).length)) * 9 + 10);
        if (y < bottom + headerHeight + 34) newPage();
        text(section.name.toUpperCase(), margin, y, 10, true, [111, 47, 60]); y -= 8;
        add(`${color(111, 47, 60)} rg ${margin} ${y - 2} 38 2 re f`); y -= 9;
        drawTableHead(section, widths);
        (section.rows || []).forEach((row, rowIndex) => {
            const isTotal = String(row?.[0] ?? '').trim().toUpperCase() === 'TOTAL';
            const rowHeight = Math.max(20, Math.max(...section.headers.map((_, i) => wrapCell(rowValue(section, row, i), widths[i], size, isTotal).length)) * 9 + 9);
            if (y - rowHeight < bottom) {
                newPage();
                text(`${section.name.toUpperCase()} (CONTINUED)`, margin, y, 9, true, [111, 47, 60]); y -= 14;
                drawTableHead(section, widths);
            }
            drawRow(section, row, widths, rowIndex, isTotal);
        });
        y -= 13;
    });
    const pageCount = pages.length;
    const contentStreams = pages.map((ops, index) => {
        ops.push(`${color(211, 215, 221)} RG 0.5 w ${margin} 29 m ${right} 29 l S`);
        ops.push(`BT /F1 7 Tf ${color(90, 97, 108)} rg 1 0 0 1 ${margin} 17 Tm (${pdfText(footerText)}) Tj ET`);
        ops.push(`BT /F1 7 Tf ${color(90, 97, 108)} rg 1 0 0 1 758 17 Tm (Page ${index + 1} of ${pageCount}) Tj ET`);
        return ops.join('\n');
    });
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${contentStreams.map((_, index) => `${5 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    contentStreams.forEach((content, index) => {
        const pageId = 5 + index * 2, streamId = pageId + 1;
        objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
        objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
    });
    let output = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(new TextEncoder().encode(output).length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = new TextEncoder().encode(output).length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return output;
}

export function wrapReportText(value, limit = 170) {
    const text = String(value ?? '').replace(/[^\x20-\x7E]/g, '?');
    const lines = [];
    for (let start = 0; start < text.length; start += limit) lines.push(text.slice(start, start + limit));
    return lines.length ? lines : [''];
}

function pdfText(value) {
    return String(value ?? '').replaceAll('₱', 'P').replaceAll('→', ' to ').replace(/[–—]/g, '-').replace(/[^\x20-\x7E]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
