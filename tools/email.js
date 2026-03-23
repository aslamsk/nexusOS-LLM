const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const ConfigService = require('../core/config');

/**
 * Nexus OS: Email Tool
 * Supports sending (SMTP) and reading (IMAP) emails.
 */
class EmailTool {
    /**
     * Send an email.
     */
    async sendEmail(to, subject, body) {
        console.log(`[Email] Sending to ${to}: "${subject}"`);
        const user = await ConfigService.get('GMAIL_USER');
        const pass = await ConfigService.get('GMAIL_APP_PASSWORD');

        if (!user || !pass) return "Error: Gmail credentials (GMAIL_USER, GMAIL_APP_PASSWORD) missing in settings.";

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        try {
            const info = await transporter.sendMail({
                from: `"Nexus OS Agency" <${user}>`,
                to,
                subject,
                text: body,
                html: body.replace(/\n/g, '<br>')
            });
            return `SUCCESS: Email sent to ${to}. MessageID: ${info.messageId}`;
        } catch (e) {
            return `Error sending email: ${e.message}`;
        }
    }

    /**
     * Read the latest N emails from inbox.
     */
    async readInbox(limit = 5) {
        console.log(`[Email] Reading inbox (limit: ${limit})`);
        const user = await ConfigService.get('GMAIL_USER');
        const pass = await ConfigService.get('GMAIL_APP_PASSWORD');

        if (!user || !pass) return "Error: Gmail credentials missing.";

        const config = {
            imap: {
                user,
                password: pass,
                host: 'imap.gmail.com',
                port: 993,
                tls: true,
                authTimeout: 3000
            }
        };

        try {
            const connection = await imaps.connect(config);
            await connection.openBox('INBOX');
            const searchCriteria = ['ALL'];
            const fetchOptions = { bodies: ['HEADER', 'TEXT'], struct: true };
            
            const messages = await connection.search(searchCriteria, fetchOptions);
            connection.end();

            const latest = messages.slice(-limit).reverse();
            return latest.map(m => {
                const header = m.parts.find(p => p.which === 'HEADER').body;
                return {
                    from: header.from?.[0],
                    subject: header.subject?.[0],
                    date: header.date?.[0],
                    bodyPreview: m.parts.find(p => p.which === 'TEXT').body.substring(0, 500)
                };
            });
        } catch (e) {
            return `Error reading inbox: ${e.message}`;
        }
    }
}

module.exports = new EmailTool();
