const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeName(value) {
    return String(value || 'document').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function formatDate(value = new Date()) {
    return new Date(value).toISOString().slice(0, 10);
}

function sanitizePdfText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, ' ');
}

function buildReportMarkdown({ clientName, workflowLabel, target, notes, promptPack, brief }) {
    return `# ${workflowLabel} Report

Client: ${clientName || 'Client'}
Date: ${formatDate()}
Target: ${target || 'Not specified'}

## Executive Summary

This report was generated through the Nexus OS marketing workflow system. It is intended to be a professional client-facing deliverable that can be refined further inside Mission Control.

## Workflow Context

- Workflow: ${workflowLabel}
- Prompt Pack: ${promptPack?.system || 'General marketing'}
- Focus Areas: ${(promptPack?.focus || []).join(', ') || 'General recommendations'}

## Operating Brief

${brief}

## Notes

${notes || 'No additional notes supplied.'}

## Recommended Next Steps

1. Validate the findings in Mission Control against the current client objective.
2. Convert the most important recommendations into ads, copy, email, landing page, or report tasks.
3. Package the result into proposal, invoice, or client delivery flow as needed.
`;
}

function buildProposalMarkdown({ clientName, workflowLabel, target, notes }) {
    return `# Proposal: ${workflowLabel}

Prepared for: ${clientName || 'Client'}
Date: ${formatDate()}
Target: ${target || 'Not specified'}

## Scope

This proposal outlines the ${workflowLabel.toLowerCase()} engagement to support the client's marketing growth goals.

## Deliverables

1. Strategy discovery and working brief
2. Analysis and recommendations
3. Execution-ready output package
4. Review and refinement loop inside Nexus OS

## Business Context

${notes || 'Detailed client notes will be added from Mission Control.'}

## Commercial Framing

- Workflow selected: ${workflowLabel}
- Recommended delivery: report + implementation plan
- Suggested next commercial step: align quote, invoice, and production timeline
`;
}

function writeMarketingFile({ outputsRoot, clientId, type, baseName, content }) {
    const folder = path.join(outputsRoot, 'marketing', clientId || 'system');
    ensureDir(folder);
    const filename = `${sanitizeName(baseName)}-${formatDate()}.md`;
    const absolutePath = path.join(folder, filename);
    fs.writeFileSync(absolutePath, content, 'utf8');
    return { absolutePath, filename, folder };
}

function buildPdfBuffer({ title, lines }) {
    const content = ['BT', '/F1 12 Tf', '50 790 Td'];
    lines.filter(Boolean).forEach((line, index) => {
        const prefix = index === 0 ? '' : '0 -18 Td ';
        content.push(`${prefix}(${sanitizePdfText(line)}) Tj`);
    });
    content.push('ET');
    const stream = content.join('\n');
    const streamLength = Buffer.byteLength(stream, 'utf8');

    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
        `5 0 obj << /Length ${streamLength} >> stream\n${stream}\nendstream endobj`
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

function buildMarketingPdfBuffer({ clientName, workflowLabel, target, notes, brief, type }) {
    const heading = type === 'proposal' ? `Proposal: ${workflowLabel}` : `${workflowLabel} Report`;
    const lines = [
        heading,
        `Client: ${clientName || 'Client'}`,
        `Date: ${formatDate()}`,
        `Target: ${target || 'Not specified'}`,
        '',
        type === 'proposal' ? 'Business Context' : 'Operating Brief',
        ...(String(type === 'proposal' ? (notes || 'No notes supplied.') : (brief || 'No brief supplied.'))
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 18)),
        '',
        'Notes',
        ...(String(notes || 'No additional notes supplied.')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 8))
    ];
    return buildPdfBuffer({ title: heading, lines });
}

function writeMarketingPdf({ outputsRoot, clientId, baseName, pdfBuffer }) {
    const folder = path.join(outputsRoot, 'marketing', clientId || 'system');
    ensureDir(folder);
    const filename = `${sanitizeName(baseName)}-${formatDate()}.pdf`;
    const absolutePath = path.join(folder, filename);
    fs.writeFileSync(absolutePath, pdfBuffer);
    return { absolutePath, filename, folder };
}

module.exports = {
    buildReportMarkdown,
    buildProposalMarkdown,
    buildMarketingPdfBuffer,
    writeMarketingFile,
    writeMarketingPdf
};
