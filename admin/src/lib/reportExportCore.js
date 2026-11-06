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

export function wrapReportText(value, limit = 170) {
    const text = String(value ?? '').replace(/[^\x20-\x7E]/g, '?');
    const lines = [];
    for (let start = 0; start < text.length; start += limit) lines.push(text.slice(start, start + limit));
    return lines.length ? lines : [''];
}

function pdfText(value) {
    return String(value ?? '').replace(/[^\x20-\x7E]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}
