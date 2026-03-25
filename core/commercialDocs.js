const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function sanitizePdfText(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, ' ');
}

function formatCurrencyValue(value, currency = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
    } catch (error) {
        return `${currency} ${Number(value || 0).toFixed(2)}`;
    }
}

function buildQuoteDocumentModel(plan, overrides = {}) {
    const pricing = plan.pricing || {};
    const items = Array.isArray(pricing.items) ? pricing.items : [];
    const createdAt = new Date();
    return {
        quoteNumber: `QTE-${Date.now().toString(36).slice(-8).toUpperCase()}`,
        clientName: overrides.clientName || 'Client',
        clientCompany: overrides.clientCompany || '',
        clientEmail: overrides.clientEmail || '',
        createdAt,
        validUntil: new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000)),
        status: 'draft',
        notes: overrides.notes || '',
        currency: pricing.currency || 'USD',
        subtotal: Number(pricing.subtotal || 0),
        taxAmount: Number(pricing.taxAmount || 0),
        total: Number(pricing.total || 0),
        baseCost: Number(pricing.baseCost || 0),
        profitEligibleBaseCost: Number(pricing.profitEligibleBaseCost || pricing.baseCost || 0),
        passthroughCost: Number(pricing.passthroughCost || 0),
        profitAmount: Number(pricing.profitAmount || 0),
        profitMarginPct: Number(pricing.profitMarginPct || 0),
        taxPct: Number(pricing.taxPct || 0),
        items: items.map((item) => ({
            description: item.description || item.serviceCode || 'Service',
            quantity: Number(item.quantity || 1),
            unitCost: Number(item.unitCost || 0),
            lineTotal: Number(item.lineCost || item.lineTotal || 0)
        }))
    };
}

function buildQuoteCsv(model) {
    const rows = [
        ['Quote Number', model.quoteNumber],
        ['Client', model.clientName],
        ['Company', model.clientCompany],
        ['Email', model.clientEmail],
        ['Status', model.status],
        ['Created At', model.createdAt.toISOString()],
        ['Valid Until', model.validUntil.toISOString()],
        ['Currency', model.currency],
        ['Base Cost', model.baseCost],
        ['Profit Eligible Base Cost', model.profitEligibleBaseCost],
        ['Passthrough Cost', model.passthroughCost],
        ['Profit Margin %', model.profitMarginPct],
        ['Profit Amount', model.profitAmount],
        ['Tax %', model.taxPct],
        [],
        ['Description', 'Quantity', 'Unit Cost', 'Line Total'],
        ...model.items.map((item) => [item.description, item.quantity, item.unitCost, item.lineTotal]),
        [],
        ['Subtotal', model.subtotal],
        ['Tax', model.taxAmount],
        ['Total', model.total],
        ['Notes', model.notes]
    ];
    return rows.map((row) => row.map((cell) => {
        const value = String(cell ?? '');
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')).join('\n');
}

function buildPdfBufferFromStream(stream, { titleFont = 'Helvetica-Bold', bodyFont = 'Helvetica' } = {}) {
    const streamLength = Buffer.byteLength(stream, 'utf8');
    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj',
        `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /${titleFont} >> endobj`,
        `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /${bodyFont} >> endobj`,
        `6 0 obj << /Length ${streamLength} >> stream\n${stream}\nendstream endobj`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += `${obj}\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
}

function getLogoAssetPath() {
    return path.join(__dirname, '..', 'frontend', 'public', 'pwa-192x192.png');
}

function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function loadPngForPdf(filePath) {
    const buffer = fs.readFileSync(filePath);
    const signature = buffer.subarray(0, 8);
    if (!signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error('Unsupported logo asset: not a PNG file');
    }

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idatParts = [];

    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset); offset += 4;
        const type = buffer.toString('ascii', offset, offset + 4); offset += 4;
        const data = buffer.subarray(offset, offset + length); offset += length;
        offset += 4; // crc

        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data.readUInt8(8);
            colorType = data.readUInt8(9);
            interlace = data.readUInt8(12);
        } else if (type === 'IDAT') {
            idatParts.push(data);
        } else if (type === 'IEND') {
            break;
        }
    }

    if (bitDepth !== 8) throw new Error('Unsupported PNG bit depth for PDF embedding');
    if (![2, 6].includes(colorType)) throw new Error('Unsupported PNG color type for PDF embedding');
    if (interlace !== 0) throw new Error('Interlaced PNG not supported for PDF embedding');

    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const inflated = zlib.inflateSync(Buffer.concat(idatParts));
    const raw = Buffer.alloc(height * stride);

    let srcOffset = 0;
    let dstOffset = 0;
    for (let row = 0; row < height; row += 1) {
        const filterType = inflated[srcOffset++];
        for (let col = 0; col < stride; col += 1) {
            const x = inflated[srcOffset++];
            const left = col >= bytesPerPixel ? raw[dstOffset - bytesPerPixel] : 0;
            const up = row > 0 ? raw[dstOffset - stride] : 0;
            const upLeft = row > 0 && col >= bytesPerPixel ? raw[dstOffset - stride - bytesPerPixel] : 0;
            let value = x;
            if (filterType === 1) value = (x + left) & 0xff;
            else if (filterType === 2) value = (x + up) & 0xff;
            else if (filterType === 3) value = (x + Math.floor((left + up) / 2)) & 0xff;
            else if (filterType === 4) value = (x + paethPredictor(left, up, upLeft)) & 0xff;
            raw[dstOffset++] = value;
        }
    }

    const rgb = Buffer.alloc(width * height * 3);
    const alpha = colorType === 6 ? Buffer.alloc(width * height) : null;
    let rgbOffset = 0;
    let alphaOffset = 0;
    for (let i = 0; i < raw.length; i += bytesPerPixel) {
        rgb[rgbOffset++] = raw[i];
        rgb[rgbOffset++] = raw[i + 1];
        rgb[rgbOffset++] = raw[i + 2];
        if (alpha) alpha[alphaOffset++] = raw[i + 3];
    }

    return {
        width,
        height,
        rgb: zlib.deflateSync(rgb),
        alpha: alpha ? zlib.deflateSync(alpha) : null
    };
}

function buildPdfWithEmbeddedLogo(stream, logo) {
    const objects = [];
    objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');

    const xObjectRef = logo.alpha ? '/Im1 6 0 R /Im1Mask 7 0 R' : '/Im1 6 0 R';
    objects.push(`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << ${xObjectRef} >> >> /Contents 8 0 R >> endobj`);
    objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj');
    objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
    objects.push(`6 0 obj << /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.rgb.length}${logo.alpha ? ' /SMask 7 0 R' : ''} >> stream\n`);
    objects.push(logo.rgb);
    objects.push('\nendstream endobj');
    if (logo.alpha) {
        objects.push(`7 0 obj << /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.alpha.length} >> stream\n`);
        objects.push(logo.alpha);
        objects.push('\nendstream endobj');
    }
    const contentObjectId = logo.alpha ? 8 : 7;
    objects.push(`${contentObjectId} 0 obj << /Length ${Buffer.byteLength(stream, 'utf8')} >> stream\n${stream}\nendstream endobj`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
        offsets.push(Buffer.byteLength(pdf, 'binary'));
        if (Buffer.isBuffer(obj)) pdf += obj.toString('binary');
        else pdf += `${obj}\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'binary');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i < offsets.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'binary');
}

function buildQuotePdfBuffer(model) {
    const left = 42;
    let y = 720;
    const lines = [];

    lines.push('0.13 0.10 0.22 rg');
    lines.push('0.13 0.10 0.22 RG');
    lines.push('0 760 595 82 re f');
    lines.push('q');
    lines.push('34 0 0 34 42 778 cm');
    lines.push('/Im1 Do');
    lines.push('Q');
    lines.push('BT');
    lines.push('/F1 20 Tf');
    lines.push(`${left + 48} 805 Td`);
    lines.push('(NEXUS OS) Tj');
    lines.push('/F2 10 Tf');
    lines.push('0 -16 Td');
    lines.push('(Agency quotation and commercial planning) Tj');
    lines.push('ET');

    lines.push('0.12 0.10 0.18 rg');
    lines.push('BT');
    lines.push('/F1 22 Tf');
    lines.push(`${left} ${y} Td`);
    lines.push('(Quotation / Estimate) Tj');
    lines.push('/F2 10 Tf');
    lines.push('0 -18 Td');
    lines.push(`(Quote No: ${sanitizePdfText(model.quoteNumber)}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Created: ${sanitizePdfText(model.createdAt.toLocaleString())}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Valid Until: ${sanitizePdfText(model.validUntil.toLocaleDateString())}) Tj`);
    lines.push('ET');

    lines.push('0.94 0.95 0.99 rg');
    lines.push(`${left} 618 230 72 re f`);
    lines.push(`${left + 245} 618 230 72 re f`);
    lines.push('0.24 0.21 0.36 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 12} 674 Td`);
    lines.push('(Quotation by) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -14 Td');
    lines.push('(Nexus OS Agency) Tj');
    lines.push('0 -12 Td');
    lines.push('(Operations Desk) Tj');
    lines.push('0 -12 Td');
    lines.push('(India) Tj');
    lines.push('ET');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 257} 674 Td`);
    lines.push('(Quotation to) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -14 Td');
    lines.push(`(${sanitizePdfText(model.clientName || 'Client')}) Tj`);
    if (model.clientCompany) {
        lines.push('0 -12 Td');
        lines.push(`(${sanitizePdfText(model.clientCompany)}) Tj`);
    }
    if (model.clientEmail) {
        lines.push('0 -12 Td');
        lines.push(`(${sanitizePdfText(model.clientEmail)}) Tj`);
    }
    lines.push('ET');

    lines.push('0.47 0.30 0.91 rg');
    lines.push(`${left} 590 510 14 re f`);
    lines.push('1 1 1 rg');
    lines.push('BT');
    lines.push('/F1 9 Tf');
    lines.push(`${left + 8} 594 Td`);
    lines.push('(Service Scope) Tj');
    lines.push(`${left + 240} 0 Td`);
    lines.push('(Qty) Tj');
    lines.push(`${left + 60} 0 Td`);
    lines.push('(Amount) Tj');
    lines.push('ET');

    lines.push('0.16 0.14 0.24 rg');
    const items = model.items.slice(0, 12);
    items.forEach((item) => {
        lines.push('BT');
        lines.push('/F2 9 Tf');
        lines.push(`${left + 8} ${y = y - 20} Td`);
        lines.push(`(${sanitizePdfText(item.description)}) Tj`);
        lines.push(`${left + 250 - (left + 8)} 0 Td`);
        lines.push(`(${sanitizePdfText(item.quantity)}) Tj`);
        lines.push(`${left + 330 - (left + 250)} 0 Td`);
        lines.push(`(${sanitizePdfText(formatCurrencyValue(item.lineTotal, model.currency))}) Tj`);
        lines.push('ET');
    });

    const summaryTop = y - 42;
    lines.push('0.96 0.98 1 rg');
    lines.push(`${left + 300} ${summaryTop - 54} 210 88 re f`);
    lines.push('0.14 0.12 0.22 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 312} ${summaryTop + 20} Td`);
    lines.push('(Commercial Summary) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -16 Td');
    lines.push(`(Base Cost: ${sanitizePdfText(formatCurrencyValue(model.baseCost, model.currency))}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Agency Profit: ${sanitizePdfText(formatCurrencyValue(model.profitAmount, model.currency))}) Tj`);
    if (model.passthroughCost) {
        lines.push('0 -14 Td');
        lines.push(`(Passthrough: ${sanitizePdfText(formatCurrencyValue(model.passthroughCost, model.currency))}) Tj`);
    }
    lines.push('0 -14 Td');
    lines.push(`(Total: ${sanitizePdfText(formatCurrencyValue(model.total, model.currency))}) Tj`);
    lines.push('ET');

    const notesY = summaryTop - 120;
    lines.push('0.18 0.16 0.28 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left} ${notesY} Td`);
    lines.push('(Terms and Notes) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -16 Td');
    lines.push('(1. Paid media budget is billed only if approved by the client.) Tj');
    lines.push('0 -12 Td');
    lines.push('(2. 50% advance is recommended before execution starts.) Tj');
    lines.push('0 -12 Td');
    lines.push('(3. Creative revisions and delivery terms can be added in the final client version.) Tj');
    if (model.notes) {
        lines.push('0 -16 Td');
        lines.push(`(Additional Notes: ${sanitizePdfText(model.notes).slice(0, 90)}) Tj`);
    }
    lines.push('ET');

    try {
        const logo = loadPngForPdf(getLogoAssetPath());
        return buildPdfWithEmbeddedLogo(lines.join('\n'), logo);
    } catch (error) {
        return buildPdfBufferFromStream(lines.join('\n'));
    }
}

function buildInvoicePdfBuffer(model) {
    const left = 42;
    let y = 720;
    const lines = [];

    lines.push('0.13 0.10 0.22 rg');
    lines.push('0.13 0.10 0.22 RG');
    lines.push('0 760 595 82 re f');
    lines.push('q');
    lines.push('34 0 0 34 42 778 cm');
    lines.push('/Im1 Do');
    lines.push('Q');
    lines.push('BT');
    lines.push('/F1 20 Tf');
    lines.push(`${left + 48} 805 Td`);
    lines.push('(NEXUS OS) Tj');
    lines.push('/F2 10 Tf');
    lines.push('0 -16 Td');
    lines.push('(Agency finance and billing) Tj');
    lines.push('ET');

    lines.push('0.12 0.10 0.18 rg');
    lines.push('BT');
    lines.push('/F1 22 Tf');
    lines.push(`${left} ${y} Td`);
    lines.push('(Invoice) Tj');
    lines.push('/F2 10 Tf');
    lines.push('0 -18 Td');
    lines.push(`(Invoice No: ${sanitizePdfText(model.invoiceNumber)}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Created: ${sanitizePdfText(model.createdAt.toLocaleString())}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(${sanitizePdfText(model.paidAt ? `Paid: ${model.paidAt.toLocaleString()}` : 'Payment terms: Due on receipt')}) Tj`);
    lines.push('ET');

    lines.push('0.94 0.95 0.99 rg');
    lines.push(`${left} 618 230 72 re f`);
    lines.push(`${left + 245} 618 230 72 re f`);
    lines.push('0.24 0.21 0.36 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 12} 674 Td`);
    lines.push('(Invoice from) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -14 Td');
    lines.push('(Nexus OS Agency) Tj');
    lines.push('0 -12 Td');
    lines.push('(Finance Desk) Tj');
    lines.push('0 -12 Td');
    lines.push('(India) Tj');
    lines.push('ET');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 257} 674 Td`);
    lines.push('(Invoice to) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -14 Td');
    lines.push(`(${sanitizePdfText(model.clientName || 'Client')}) Tj`);
    if (model.clientCompany) {
        lines.push('0 -12 Td');
        lines.push(`(${sanitizePdfText(model.clientCompany)}) Tj`);
    }
    if (model.clientEmail) {
        lines.push('0 -12 Td');
        lines.push(`(${sanitizePdfText(model.clientEmail)}) Tj`);
    }
    lines.push('ET');

    lines.push('0.47 0.30 0.91 rg');
    lines.push(`${left} 590 510 14 re f`);
    lines.push('1 1 1 rg');
    lines.push('BT');
    lines.push('/F1 9 Tf');
    lines.push(`${left + 8} 594 Td`);
    lines.push('(Service Scope) Tj');
    lines.push(`${left + 240} 0 Td`);
    lines.push('(Qty) Tj');
    lines.push(`${left + 60} 0 Td`);
    lines.push('(Amount) Tj');
    lines.push('ET');

    lines.push('0.16 0.14 0.24 rg');
    const items = model.items.slice(0, 12);
    items.forEach((item) => {
        lines.push('BT');
        lines.push('/F2 9 Tf');
        lines.push(`${left + 8} ${y = y - 20} Td`);
        lines.push(`(${sanitizePdfText(item.description)}) Tj`);
        lines.push(`${left + 250 - (left + 8)} 0 Td`);
        lines.push(`(${sanitizePdfText(item.quantity)}) Tj`);
        lines.push(`${left + 330 - (left + 250)} 0 Td`);
        lines.push(`(${sanitizePdfText(formatCurrencyValue(item.lineTotal, model.currency))}) Tj`);
        lines.push('ET');
    });

    const summaryTop = y - 42;
    lines.push('0.96 0.98 1 rg');
    lines.push(`${left + 300} ${summaryTop - 54} 210 88 re f`);
    lines.push('0.14 0.12 0.22 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left + 312} ${summaryTop + 20} Td`);
    lines.push('(Billing Summary) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -16 Td');
    lines.push(`(Subtotal: ${sanitizePdfText(formatCurrencyValue(model.subtotal, model.currency))}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Tax: ${sanitizePdfText(formatCurrencyValue(model.taxAmount, model.currency))}) Tj`);
    lines.push('0 -14 Td');
    lines.push(`(Total: ${sanitizePdfText(formatCurrencyValue(model.total, model.currency))}) Tj`);
    lines.push('ET');

    const notesY = summaryTop - 120;
    lines.push('0.18 0.16 0.28 rg');
    lines.push('BT');
    lines.push('/F1 10 Tf');
    lines.push(`${left} ${notesY} Td`);
    lines.push('(Payment Terms) Tj');
    lines.push('/F2 9 Tf');
    lines.push('0 -16 Td');
    lines.push('(1. Payment is due as per the agreed commercial terms.) Tj');
    lines.push('0 -12 Td');
    lines.push('(2. Work may begin or continue after payment confirmation where applicable.) Tj');
    if (model.paymentUrl) {
        lines.push('0 -16 Td');
        lines.push(`(Payment Link: ${sanitizePdfText(model.paymentUrl).slice(0, 90)}) Tj`);
    }
    lines.push('ET');

    try {
        const logo = loadPngForPdf(getLogoAssetPath());
        return buildPdfWithEmbeddedLogo(lines.join('\n'), logo);
    } catch (error) {
        return buildPdfBufferFromStream(lines.join('\n'));
    }
}

module.exports = {
    buildQuoteDocumentModel,
    buildQuoteCsv,
    buildQuotePdfBuffer,
    buildInvoicePdfBuffer
};
