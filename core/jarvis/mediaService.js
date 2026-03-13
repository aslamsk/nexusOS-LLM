const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Document, Paragraph, TextRun, Packer } = require('docx');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Nexus Media Service
 * 
 * Local-first media generation (PDF, Excel, Docx, Text).
 */
class MediaService {
    constructor(outputDir) {
        this.outputDir = outputDir;
        if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    }

    async saveBuffer(buffer, originalName, mimeType) {
        const ext = originalName.split('.').pop();
        const fileName = `${uuidv4()}.${ext}`;
        const filePath = path.join(this.outputDir, fileName);
        
        fs.writeFileSync(filePath, buffer);
        
        return {
            url: `/outputs/${fileName}`,
            filePath: filePath,
            fileName: originalName,
            mimeType,
            sizeBytes: buffer.length
        };
    }

    async generatePdf(content, title = 'Document') {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const buffers = [];
            doc.on('data', b => buffers.push(b));
            doc.on('end', async () => {
                const result = await this.saveBuffer(Buffer.concat(buffers), `${title.replace(/\s+/g, '_')}.pdf`, 'application/pdf');
                resolve(result);
            });
            doc.fontSize(20).text(title, { align: 'center' });
            doc.moveDown().fontSize(12).text(content);
            doc.end();
        });
    }

    async generateExcel(data, title = 'Spreadsheet') {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sheet1');
        if (Array.isArray(data) && data.length > 0) {
            sheet.columns = Object.keys(data[0]).map(k => ({ header: k, key: k }));
            data.forEach(r => sheet.addRow(r));
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return await this.saveBuffer(buffer, `${title.replace(/\s+/g, '_')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    async generateDocx(content, title = 'Document') {
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })] }),
                    ...content.split('\n').map(l => new Paragraph({ children: [new TextRun(l)] }))
                ]
            }]
        });
        const buffer = await Packer.toBuffer(doc);
        return await this.saveBuffer(buffer, `${title.replace(/\s+/g, '_')}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
}

module.exports = MediaService;
