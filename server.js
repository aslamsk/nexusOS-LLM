const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const NexusOrchestrator = require('./index');
const multer = require('multer');
const fs = require('fs');

const { db } = require('./core/firebase');
const ConfigService = require('./core/config');
const PricingService = require('./core/pricing');
const MarketingService = require('./core/marketing');
const MarketingPrompts = require('./core/marketingPrompts');
const MarketingTemplates = require('./core/marketingTemplates');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const APP_BOOTED_AT = new Date().toISOString();

function buildDiagnostic(requiredKeys, has) {
    const missingKeys = requiredKeys.filter((key) => !has(key));
    return {
        ready: missingKeys.length === 0,
        missingKeys,
        configuredKeys: requiredKeys.filter((key) => has(key))
    };
}

function formatCurrencyValue(value, currency = 'USD') {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 2
    }).format(amount);
}

function sanitizePdfText(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[^\x20-\x7E]/g, ' ');
}

function buildInvoiceDocumentModel(invoice, client) {
    const pricing = invoice.pricing || {};
    const items = Array.isArray(pricing.items) ? pricing.items : [];
    const currency = pricing.currency || 'USD';
    return {
        invoiceNumber: `INV-${String(invoice.id || '').slice(0, 8).toUpperCase()}`,
        clientName: client?.name || client?.company || 'Client',
        clientCompany: client?.company || '',
        clientEmail: client?.email || '',
        createdAt: invoice.createdAt?.toDate ? invoice.createdAt.toDate() : new Date(invoice.createdAt || Date.now()),
        paidAt: invoice.paidAt?.toDate ? invoice.paidAt.toDate() : (invoice.paidAt ? new Date(invoice.paidAt) : null),
        status: invoice.status || 'unpaid',
        notes: invoice.notes || '',
        paymentUrl: invoice.paymentUrl || '',
        currency,
        subtotal: Number(pricing.subtotal || 0),
        taxAmount: Number(pricing.taxAmount || 0),
        total: Number(pricing.total || 0),
        items: items.map((item) => ({
            description: item.description || item.serviceCode || 'Service',
            quantity: Number(item.quantity || 1),
            unitCost: Number(item.unitCost || item.baseCost || 0),
            lineTotal: Number(item.lineTotal || item.total || 0)
        }))
    };
}

function buildInvoiceCsv(model) {
    const rows = [
        ['Invoice Number', model.invoiceNumber],
        ['Client', model.clientName],
        ['Company', model.clientCompany],
        ['Email', model.clientEmail],
        ['Status', model.status],
        ['Created At', model.createdAt.toISOString()],
        ['Paid At', model.paidAt ? model.paidAt.toISOString() : ''],
        ['Currency', model.currency],
        [],
        ['Description', 'Quantity', 'Unit Cost', 'Line Total'],
        ...model.items.map((item) => [item.description, item.quantity, item.unitCost, item.lineTotal]),
        [],
        ['Subtotal', model.subtotal],
        ['Tax', model.taxAmount],
        ['Total', model.total],
        ['Payment URL', model.paymentUrl]
    ];

    return rows.map((row) => row.map((cell) => {
        const value = String(cell ?? '');
        return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')).join('\n');
}

function buildInvoicePdfBuffer(model) {
    const lines = [
        'Nexus OS Invoice',
        model.invoiceNumber,
        `Client: ${model.clientName}`,
        model.clientCompany ? `Company: ${model.clientCompany}` : '',
        model.clientEmail ? `Email: ${model.clientEmail}` : '',
        `Status: ${model.status}`,
        `Created: ${model.createdAt.toLocaleString()}`,
        model.paidAt ? `Paid: ${model.paidAt.toLocaleString()}` : '',
        '',
        'Items',
        ...model.items.map((item) => `${item.description} | Qty ${item.quantity} | ${formatCurrencyValue(item.lineTotal, model.currency)}`),
        '',
        `Subtotal: ${formatCurrencyValue(model.subtotal, model.currency)}`,
        `Tax: ${formatCurrencyValue(model.taxAmount, model.currency)}`,
        `Total: ${formatCurrencyValue(model.total, model.currency)}`,
        model.paymentUrl ? `Payment: ${model.paymentUrl}` : ''
    ].filter(Boolean);

    const content = ['BT', '/F1 12 Tf', '50 790 Td'];
    lines.forEach((line, index) => {
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

async function getInvoiceWithClient(invoiceId) {
    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) return null;
    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };
    let client = null;
    if (invoice.clientId) {
        const clientDoc = await db.collection('clients').doc(invoice.clientId).get();
        client = clientDoc.exists ? { id: clientDoc.id, ...clientDoc.data() } : null;
    }
    return { invoice, client, model: buildInvoiceDocumentModel(invoice, client) };
}

// Parse JSON bodies for API routes
app.use(express.json());

// ─── Configuration Management API ─────────────────────────────────────
const CONFIG_KEY_LABELS = {
    GEMINI_API_KEY: 'Gemini API Key 1 (Primary)',
    GEMINI_API_KEY_2: 'Gemini API Key 2 (Backup)',
    GEMINI_API_KEY_3: 'Gemini API Key 3 (Backup)',
    BRAVE_SEARCH_API_KEY: 'Brave Search API Key (for Web Search)',
    GMAIL_USER: 'Gmail Address (for Email Tool)',
    GMAIL_APP_PASSWORD: 'Gmail App Password (for Email Tool)',
    WHATSAPP_PHONE_ID: 'WhatsApp Phone ID (from Meta Developer Portal)',
    META_ACCESS_TOKEN: 'Meta Access Token',
    META_AD_ACCOUNT_ID: 'Meta Ad Account ID',
    META_PAGE_ID: 'Meta Page ID',
    REPLICATE_API_TOKEN: 'Replicate API Token',
    OPENROUTER_API_TOKEN: 'OpenRouter API Token',
    LINKEDIN_ACCESS_TOKEN: 'LinkedIn Access Token',
    GOOGLE_ADS_CLIENT_ID: 'Google Ads Client ID',
    GOOGLE_ADS_CLIENT_SECRET: 'Google Ads Client Secret',
    GOOGLE_ADS_REFRESH_TOKEN: 'Google Ads Refresh Token',
    GOOGLE_ADS_DEVELOPER_TOKEN: 'Google Ads Developer Token',
    QUOTA_MODE: 'Performance Mode (FREE, NORMAL, HIGH)',
};

function maskValue(val) {
    if (!val || val.length < 8) return '••••••••';
    return val.substring(0, 4) + '••••••••' + val.substring(val.length - 4);
}

app.get('/api/config', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const doc = await db.collection('configs').doc('default').get();
        const data = doc.exists ? doc.data() : {};

        // Build response: all known keys, masked values, and flags
        const configs = Object.entries(CONFIG_KEY_LABELS).map(([key, label]) => ({
            key,
            label,
            value: data[key] ? maskValue(data[key]) : '',
            isSet: !!data[key],
        }));

        res.json({ configs });
    } catch (err) {
        console.error('[API] Config fetch error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { updates } = req.body; // { KEY: 'value', ... }
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Invalid payload. Expected { updates: { KEY: value } }' });
        }

        // Filter out empty strings and masked placeholder values generated by the UI
        const cleanUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && value.trim() !== '' && !value.includes('••••')) {
                cleanUpdates[key] = value.trim();
            }
        }

        if (Object.keys(cleanUpdates).length === 0) {
            return res.status(400).json({ error: 'No values to update' });
        }

        await db.collection('configs').doc('default').set(cleanUpdates, { merge: true });
        ConfigService.refresh(); // Bust the cache immediately
        console.log(`[API] Config updated: ${Object.keys(cleanUpdates).join(', ')}`);
        res.json({ success: true, updatedKeys: Object.keys(cleanUpdates) });
    } catch (err) {
        console.error('[API] Config update error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config/:key/raw', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { key } = req.params;
        const doc = await db.collection('configs').doc('default').get();
        const data = doc.exists ? doc.data() : {};
        if (data[key]) {
            res.json({ value: data[key] });
        } else {
            res.status(404).json({ error: 'Key not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/system-status', async (req, res) => {
    try {
        let firestoreData = {};
        if (db) {
            const doc = await db.collection('configs').doc('default').get();
            firestoreData = doc.exists ? doc.data() : {};
        }

        const has = (key) => !!(firestoreData[key] || process.env[key]);

        const integrations = [
            {
                id: 'gemini_keys',
                name: 'Gemini (Auto-Key Rotation)',
                icon: '🔄',
                description: 'Key rotation active. Switches to backup keys on 429 errors.',
                status: has('GEMINI_API_KEY') ? 'active' : 'missing',
                keys: [
                    { key: 'GEMINI_API_KEY', label: 'Gemini Key 1', isSet: has('GEMINI_API_KEY') },
                    { key: 'GEMINI_API_KEY_2', label: 'Gemini Key 2', isSet: has('GEMINI_API_KEY_2') },
                    { key: 'GEMINI_API_KEY_3', label: 'Gemini Key 3', isSet: has('GEMINI_API_KEY_3') }
                ],
                howToGet: 'Get keys from https://aistudio.google.com/app/apikey',
                addVia: 'Settings → Gemini API Keys'
            },
            {
                id: 'search',
                name: 'Web Search (Brave)',
                icon: '🌐',
                description: 'Live web search for up-to-date information.',
                status: has('BRAVE_SEARCH_API_KEY') ? 'active' : 'missing',
                keys: [{ key: 'BRAVE_SEARCH_API_KEY', label: 'Brave Search Key', isSet: has('BRAVE_SEARCH_API_KEY') }],
                howToGet: 'Get a key from https://api.search.brave.com/',
                addVia: 'Settings → Brave Search API Key'
            },
            {
                id: 'email',
                name: 'Email (Gmail)',
                icon: '📧',
                description: 'Send and read client emails via Gmail SMTP/IMAP.',
                status: (has('GMAIL_USER') && has('GMAIL_APP_PASSWORD')) ? 'active' : 'missing',
                keys: [
                    { key: 'GMAIL_USER', label: 'Gmail Address', isSet: has('GMAIL_USER') },
                    { key: 'GMAIL_APP_PASSWORD', label: 'App Password', isSet: has('GMAIL_APP_PASSWORD') }
                ],
                howToGet: 'Google Account Settings → Security → 2FA → App Passwords',
                addVia: 'Settings → Gmail Credentials'
            },
            {
                id: 'whatsapp',
                name: 'WhatsApp Business',
                icon: '💬',
                description: 'Direct messaging via Meta WhatsApp Cloud API.',
                status: (has('WHATSAPP_PHONE_ID') && has('META_ACCESS_TOKEN')) ? 'active' : 'missing',
                keys: [
                    { key: 'WHATSAPP_PHONE_ID', label: 'Phone ID', isSet: has('WHATSAPP_PHONE_ID') },
                    { key: 'META_ACCESS_TOKEN', label: 'Access Token', isSet: has('META_ACCESS_TOKEN') }
                ],
                howToGet: 'Meta Developer Portal → WhatsApp Setup',
                addVia: 'Settings → Meta / WhatsApp Phone ID'
            },
            {
                id: 'memory',
                name: 'Long-Term Memory',
                icon: '🧠',
                description: 'Persistent fact storage across missions via Firestore.',
                status: db ? 'active' : 'missing',
                keys: [],
                howToGet: 'Auto-configured via Firestore.',
                addVia: 'No action needed'
            },
            {
                id: 'squad',
                name: 'Multi-Agent Squads',
                icon: '👥',
                description: 'Delegation to Researcher, Writer, Coder, Designer specialists.',
                status: 'active',
                keys: [],
                howToGet: 'Built-in capability.',
                addVia: 'No action needed'
            },
            {
                id: 'code_intel',
                name: 'Code Intelligence',
                icon: '🔍',
                description: 'Deep codebase mapping, grep search, and function finding.',
                status: 'active',
                keys: [],
                howToGet: 'Native local capability.',
                addVia: 'No action needed'
            },
            {
                id: 'meta_ads',
                name: 'Meta Ads Manager',
                icon: '📊',
                description: 'Full campaign lifecycle management.',
                status: has('META_AD_ACCOUNT_ID') ? 'active' : 'missing',
                keys: [{ key: 'META_AD_ACCOUNT_ID', label: 'Ad Account ID', isSet: has('META_AD_ACCOUNT_ID') }],
                howToGet: 'Business Manager → Ad Account Settings',
                addVia: 'Settings'
            }
        ];

        const diagnosticsById = {
            gemini_keys: buildDiagnostic(['GEMINI_API_KEY'], has),
            search: buildDiagnostic(['BRAVE_SEARCH_API_KEY'], has),
            email: buildDiagnostic(['GMAIL_USER', 'GMAIL_APP_PASSWORD'], has),
            whatsapp: buildDiagnostic(['META_ACCESS_TOKEN', 'WHATSAPP_PHONE_ID'], has),
            memory: { ready: !!db, missingKeys: db ? [] : ['firebase-service-account.json'], configuredKeys: db ? ['firestore'] : [] },
            squad: { ready: true, missingKeys: [], configuredKeys: ['built_in'] },
            code_intel: { ready: true, missingKeys: [], configuredKeys: ['local_runtime'] },
            meta_ads: buildDiagnostic(['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'], has),
            google_ads: buildDiagnostic(['GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN'], has),
            linkedin: buildDiagnostic(['LINKEDIN_ACCESS_TOKEN'], has)
        };

        if (!integrations.find((item) => item.id === 'google_ads')) {
            integrations.push({
                id: 'google_ads',
                name: 'Google Ads',
                icon: 'GA',
                description: 'Campaign listing and creation for Google Ads accounts.',
                status: diagnosticsById.google_ads.ready ? 'active' : 'missing',
                keys: [
                    { key: 'GOOGLE_ADS_CLIENT_ID', label: 'Client ID', isSet: has('GOOGLE_ADS_CLIENT_ID') },
                    { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'Client Secret', isSet: has('GOOGLE_ADS_CLIENT_SECRET') },
                    { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'Refresh Token', isSet: has('GOOGLE_ADS_REFRESH_TOKEN') },
                    { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Developer Token', isSet: has('GOOGLE_ADS_DEVELOPER_TOKEN') }
                ],
                howToGet: 'Google Ads API Center and Google Cloud Console',
                addVia: 'Settings'
            });
        }

        if (!integrations.find((item) => item.id === 'linkedin')) {
            integrations.push({
                id: 'linkedin',
                name: 'LinkedIn Publishing',
                icon: 'LI',
                description: 'Organic posting to LinkedIn organization feeds.',
                status: diagnosticsById.linkedin.ready ? 'active' : 'missing',
                keys: [
                    { key: 'LINKEDIN_ACCESS_TOKEN', label: 'Access Token', isSet: has('LINKEDIN_ACCESS_TOKEN') }
                ],
                howToGet: 'LinkedIn Developer Portal',
                addVia: 'Settings'
            });
        }

        const enrichedIntegrations = integrations.map((integration) => ({
            ...integration,
            diagnostics: diagnosticsById[integration.id] || { ready: integration.status === 'active', missingKeys: [], configuredKeys: [] }
        }));

        res.json({ integrations: enrichedIntegrations });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', async (req, res) => {
    res.json({
        status: 'ok',
        bootedAt: APP_BOOTED_AT,
        now: new Date().toISOString(),
        firestore: !!db
    });
});

// ─── CRM & Agency Portal API ───────────────────────────────────────────
app.get('/api/clients', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const snapshot = await db.collection('clients').orderBy('createdAt', 'desc').get();
        const clients = [];
        snapshot.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
        res.json({ clients });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { name, company, email, phone, notes, initialKeys } = req.body;
        
        // 1. Create the client entity
        const docRef = await db.collection('clients').add({
            name, company, email: email || '', phone: phone || '', notes: notes || '',
            createdAt: new Date(),
            status: 'active'
        });

        // 2. Provision ALL isolated keys provided during registration
        if (initialKeys && typeof initialKeys === 'object') {
            const cleanKeys = {};
            for (const [k, v] of Object.entries(initialKeys)) {
                if (v && v.trim() !== '') cleanKeys[k] = v.trim();
            }
            if (Object.keys(cleanKeys).length > 0) {
                await db.collection('client_configs').doc(docRef.id).set(cleanKeys);
                console.log(`[API] Client ${docRef.id} provisioned with ${Object.keys(cleanKeys).length} keys.`);
            }
        }

        res.json({ success: true, id: docRef.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const snapshot = await db.collection('projects').orderBy('deadline', 'asc').get();
        const projects = [];
        snapshot.forEach(doc => projects.push({ id: doc.id, ...doc.data() }));
        res.json({ projects });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { clientId, title, description, deadline, budget } = req.body;
        const docRef = await db.collection('projects').add({
            clientId, title, description, deadline: new Date(deadline), budget,
            status: 'in-progress',
            createdAt: new Date()
        });
        res.json({ success: true, id: docRef.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/pricing/catalog', (req, res) => {
    res.json({ catalog: PricingService.getCatalog() });
});

app.get('/api/marketing/workflows', (req, res) => {
    res.json({ workflows: MarketingService.getWorkflows(), promptPacks: MarketingPrompts.getAllPromptPacks() });
});

app.post('/api/marketing/brief', async (req, res) => {
    try {
        const { workflowId, target, clientId, notes, budget, channels } = req.body;
        const workflow = MarketingService.getWorkflow(workflowId);
        if (!workflow) return res.status(400).json({ error: 'Unknown marketing workflow' });

        let client = null;
        if (clientId && db) {
            const clientDoc = await db.collection('clients').doc(clientId).get();
            client = clientDoc.exists ? { id: clientDoc.id, ...clientDoc.data() } : null;
        }

        const brief = MarketingService.buildMissionBrief({
            workflowId,
            target,
            clientName: client?.name || '',
            notes,
            budget,
            channels
        });

        let savedId = null;
        if (db) {
            const docRef = await db.collection('marketing_briefs').add({
                workflowId,
                clientId: clientId || null,
                target: target || '',
                notes: notes || '',
                budget: budget || '',
                channels: Array.isArray(channels) ? channels : [],
                brief,
                createdAt: new Date()
            });
            savedId = docRef.id;
        }

        res.json({
            success: true,
            id: savedId,
            workflow,
            promptPack: MarketingPrompts.getPromptPack(workflowId),
            brief
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/marketing/outputs', async (req, res) => {
    try {
        if (!db) return res.json({ outputs: [] });
        let query = db.collection('marketing_outputs').orderBy('createdAt', 'desc');
        if (req.query.clientId) query = query.where('clientId', '==', req.query.clientId);
        const snapshot = await query.get();
        const outputs = [];
        snapshot.forEach((doc) => outputs.push({ id: doc.id, ...doc.data() }));
        res.json({ outputs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/marketing/briefs', async (req, res) => {
    try {
        if (!db) return res.json({ briefs: [] });
        let query = db.collection('marketing_briefs').orderBy('createdAt', 'desc');
        if (req.query.clientId) query = query.where('clientId', '==', req.query.clientId);
        const snapshot = await query.get();
        const briefs = [];
        snapshot.forEach((doc) => briefs.push({ id: doc.id, ...doc.data() }));
        res.json({ briefs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/marketing/deliverable', async (req, res) => {
    try {
        const { workflowId, clientId, type, target, notes, brief } = req.body;
        const workflow = MarketingService.getWorkflow(workflowId);
        if (!workflow) return res.status(400).json({ error: 'Unknown marketing workflow' });
        const promptPack = MarketingPrompts.getPromptPack(['audit', 'copy', 'ads', 'report'].includes(workflowId) ? workflowId : 'report');

        let client = null;
        if (clientId && db) {
            const clientDoc = await db.collection('clients').doc(clientId).get();
            client = clientDoc.exists ? { id: clientDoc.id, ...clientDoc.data() } : null;
        }

        const content = type === 'proposal'
            ? MarketingTemplates.buildProposalMarkdown({
                clientName: client?.name || '',
                workflowLabel: workflow.label,
                target,
                notes
            })
            : MarketingTemplates.buildReportMarkdown({
                clientName: client?.name || '',
                workflowLabel: workflow.label,
                target,
                notes,
                promptPack,
                brief
            });

        const written = MarketingTemplates.writeMarketingFile({
            outputsRoot: path.join(__dirname, 'outputs'),
            clientId: clientId || 'system',
            type,
            baseName: `${type}-${workflow.label}-${client?.name || 'client'}`,
            content
        });
        const pdfWritten = MarketingTemplates.writeMarketingPdf({
            outputsRoot: path.join(__dirname, 'outputs'),
            clientId: clientId || 'system',
            baseName: `${type}-${workflow.label}-${client?.name || 'client'}`,
            pdfBuffer: MarketingTemplates.buildMarketingPdfBuffer({
                clientName: client?.name || '',
                workflowLabel: workflow.label,
                target,
                notes,
                brief,
                type
            })
        });

        const relativeUrl = `/outputs/marketing/${clientId || 'system'}/${written.filename}`;
        const relativePdfUrl = `/outputs/marketing/${clientId || 'system'}/${pdfWritten.filename}`;
        let savedId = null;
        if (db) {
            const ref = await db.collection('marketing_outputs').add({
                clientId: clientId || null,
                workflowId,
                type,
                target: target || '',
                notes: notes || '',
                fileName: written.filename,
                pdfFileName: pdfWritten.filename,
                url: relativeUrl,
                pdfUrl: relativePdfUrl,
                createdAt: new Date()
            });
            savedId = ref.id;
        }

        res.json({ success: true, id: savedId, url: relativeUrl, pdfUrl: relativePdfUrl, fileName: written.filename, pdfFileName: pdfWritten.filename });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/marketing/deliverable/:id/export', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const deliverableDoc = await db.collection('marketing_outputs').doc(req.params.id).get();
        if (!deliverableDoc.exists) return res.status(404).json({ error: 'Deliverable not found' });
        const deliverable = { id: deliverableDoc.id, ...deliverableDoc.data() };
        const format = String(req.query.format || 'md').toLowerCase();
        const fileName = format === 'pdf' ? (deliverable.pdfFileName || deliverable.fileName?.replace(/\.md$/i, '.pdf')) : deliverable.fileName;
        const absolutePath = path.join(__dirname, 'outputs', 'marketing', deliverable.clientId || 'system', fileName);
        if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Export file not found' });
        res.download(absolutePath, fileName);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/marketing/deliverable/:id/send', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const deliverableDoc = await db.collection('marketing_outputs').doc(req.params.id).get();
        if (!deliverableDoc.exists) return res.status(404).json({ error: 'Deliverable not found' });

        const deliverable = { id: deliverableDoc.id, ...deliverableDoc.data() };
        if (!deliverable.clientId) return res.status(400).json({ error: 'Deliverable is not linked to a client' });

        const clientDoc = await db.collection('clients').doc(deliverable.clientId).get();
        if (!clientDoc.exists) return res.status(404).json({ error: 'Client not found for deliverable' });
        const client = { id: clientDoc.id, ...clientDoc.data() };
        if (!client.email) return res.status(400).json({ error: 'Client email is missing' });

        const gmailUser = await ConfigService.get('GMAIL_USER');
        const gmailPassword = await ConfigService.get('GMAIL_APP_PASSWORD');
        if (!gmailUser || !gmailPassword) return res.status(400).json({ error: 'Gmail credentials are not configured' });

        const attachmentPath = path.join(__dirname, 'outputs', 'marketing', deliverable.clientId, deliverable.fileName);
        const pdfAttachmentPath = path.join(__dirname, 'outputs', 'marketing', deliverable.clientId, deliverable.pdfFileName || deliverable.fileName.replace(/\.md$/i, '.pdf'));
        if (!fs.existsSync(attachmentPath)) return res.status(404).json({ error: 'Deliverable file is missing on disk' });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPassword }
        });

        const formalType = deliverable.type === 'proposal' ? 'proposal' : 'report';
        const subject = `Nexus OS ${formalType === 'proposal' ? 'Proposal' : 'Marketing Report'} for ${client.company || client.name}`;
        const html = `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.6">
                <p>Dear ${client.name || 'Client'},</p>
                <p>Please find attached your ${formalType} prepared by Nexus OS for the <strong>${deliverable.workflowId}</strong> workflow.</p>
                <p>The attached file is formatted for direct client review and can also be carried into your quote, invoice, or implementation planning process.</p>
                <p>If you would like, we can now convert the recommendations into live campaign execution, creative production, or development tasks.</p>
                <p>Regards,<br>Nexus OS Agency Team</p>
            </div>
        `;

        await transporter.sendMail({
            from: gmailUser,
            to: client.email,
            subject,
            html,
            attachments: [
                { filename: deliverable.fileName, path: attachmentPath },
                ...(fs.existsSync(pdfAttachmentPath) ? [{ filename: path.basename(pdfAttachmentPath), path: pdfAttachmentPath }] : [])
            ]
        });

        res.json({ success: true, sentTo: client.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/quotes', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        let query = db.collection('quotes').orderBy('createdAt', 'desc');
        if (req.query.clientId) query = query.where('clientId', '==', req.query.clientId);
        const snapshot = await query.get();
        const quotes = [];
        snapshot.forEach(doc => quotes.push({ id: doc.id, ...doc.data() }));
        res.json({ quotes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/quotes', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { clientId, items, profitMarginPct, taxPct, currency, notes } = req.body;
        const pricing = PricingService.buildQuote({ items, profitMarginPct, taxPct, currency });
        const docRef = await db.collection('quotes').add({
            clientId,
            notes: notes || '',
            status: 'draft',
            pricing,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        res.json({ success: true, id: docRef.id, pricing });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        let query = db.collection('invoices').orderBy('createdAt', 'desc');
        if (req.query.clientId) query = query.where('clientId', '==', req.query.clientId);
        const snapshot = await query.get();
        const invoices = [];
        snapshot.forEach(doc => invoices.push({ id: doc.id, ...doc.data() }));
        res.json({ invoices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices/from-quote/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const quoteDoc = await db.collection('quotes').doc(req.params.id).get();
        if (!quoteDoc.exists) return res.status(404).json({ error: 'Quote not found' });
        const quote = quoteDoc.data();
        const invoiceRef = await db.collection('invoices').add({
            clientId: quote.clientId,
            quoteId: req.params.id,
            pricing: quote.pricing,
            status: 'unpaid',
            paymentUrl: `/pay/${req.params.id}`,
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await db.collection('quotes').doc(req.params.id).set({ status: 'invoiced', updatedAt: new Date() }, { merge: true });
        res.json({ success: true, id: invoiceRef.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices/:id/pay', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        await db.collection('invoices').doc(req.params.id).set({
            status: 'paid',
            paidAt: new Date(),
            updatedAt: new Date()
        }, { merge: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/invoices/:id/export', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const bundle = await getInvoiceWithClient(req.params.id);
        if (!bundle) return res.status(404).json({ error: 'Invoice not found' });

        const format = String(req.query.format || 'pdf').toLowerCase();
        const filenameBase = `invoice-${bundle.model.invoiceNumber.toLowerCase()}`;

        if (format === 'csv' || format === 'excel') {
            const csv = buildInvoiceCsv(bundle.model);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
            return res.send(csv);
        }

        const pdf = buildInvoicePdfBuffer(bundle.model);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
        return res.send(pdf);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/invoices/:id/send', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const bundle = await getInvoiceWithClient(req.params.id);
        if (!bundle) return res.status(404).json({ error: 'Invoice not found' });
        if (!bundle.client?.email) return res.status(400).json({ error: 'Client email is not set' });

        const gmailUser = await ConfigService.get('GMAIL_USER');
        const gmailPassword = await ConfigService.get('GMAIL_APP_PASSWORD');
        if (!gmailUser || !gmailPassword) {
            return res.status(400).json({ error: 'Gmail credentials are not configured' });
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPassword }
        });

        const model = bundle.model;
        const pdf = buildInvoicePdfBuffer(model);
        const csv = buildInvoiceCsv(model);
        const includeMarketing = req.body?.includeMarketing !== false;
        const extraAttachments = [];
        if (includeMarketing && bundle.invoice.clientId) {
            const marketingSnapshot = await db.collection('marketing_outputs')
                .where('clientId', '==', bundle.invoice.clientId)
                .orderBy('createdAt', 'desc')
                .limit(2)
                .get();
            marketingSnapshot.forEach((doc) => {
                const data = doc.data();
                if (data?.fileName) {
                    const absolutePath = path.join(__dirname, 'outputs', 'marketing', bundle.invoice.clientId, data.fileName);
                    if (fs.existsSync(absolutePath)) {
                        extraAttachments.push({
                            filename: data.fileName,
                            path: absolutePath
                        });
                    }
                }
            });
        }
        const subject = `Invoice ${model.invoiceNumber} from Nexus OS`;
        const html = `
            <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
                <p>Dear ${model.clientName},</p>
                <p>Please find attached your invoice <strong>${model.invoiceNumber}</strong> from Nexus OS.</p>
                <p>Total due: <strong>${formatCurrencyValue(model.total, model.currency)}</strong></p>
                ${model.paymentUrl ? `<p>You can review payment details here: <a href="${model.paymentUrl}">${model.paymentUrl}</a></p>` : ''}
                <p>The attached documents include a professional PDF invoice and a spreadsheet-ready CSV report for your records.</p>
                ${extraAttachments.length ? '<p>We have also attached the latest marketing proposal/report files prepared for your engagement.</p>' : ''}
                <p>Regards,<br/>Nexus OS Finance Desk</p>
            </div>
        `;

        await transporter.sendMail({
            from: gmailUser,
            to: bundle.client.email,
            subject,
            html,
            attachments: [
                { filename: `invoice-${model.invoiceNumber.toLowerCase()}.pdf`, content: pdf, contentType: 'application/pdf' },
                { filename: `invoice-${model.invoiceNumber.toLowerCase()}.csv`, content: csv, contentType: 'text/csv; charset=utf-8' },
                ...extraAttachments
            ]
        });

        await db.collection('invoices').doc(req.params.id).set({
            lastSentAt: new Date(),
            lastSentTo: bundle.client.email,
            updatedAt: new Date()
        }, { merge: true });

        res.json({ success: true, sentTo: bundle.client.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/clients/:id/budget', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const budgetDoc = await db.collection('client_budgets').doc(req.params.id).get();
        const invoiceSnapshot = await db.collection('invoices').where('clientId', '==', req.params.id).get();
        let spent = 0;
        invoiceSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'paid') {
                spent += Number(data.pricing?.total || 0);
            }
        });
        const budget = budgetDoc.exists ? budgetDoc.data() : { allocated: 0, approvedOverage: 0 };
        const remaining = Number((Number(budget.allocated || 0) + Number(budget.approvedOverage || 0) - spent).toFixed(2));
        res.json({
            budget: {
                allocated: Number(budget.allocated || 0),
                approvedOverage: Number(budget.approvedOverage || 0),
                spent: Number(spent.toFixed(2)),
                remaining,
                requiresBossApproval: remaining < 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients/:id/budget', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { allocated, approvedOverage } = req.body;
        await db.collection('client_budgets').doc(req.params.id).set({
            allocated: Number(allocated || 0),
            approvedOverage: Number(approvedOverage || 0),
            updatedAt: new Date()
        }, { merge: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Per-Client API Keys Management ────────────────────────────────────
const CLIENT_KEY_LABELS = {
    GEMINI_API_KEY: 'Gemini API Key 1 (Primary)',
    GEMINI_API_KEY_2: 'Gemini API Key 2 (Backup)',
    GEMINI_API_KEY_3: 'Gemini API Key 3 (Backup)',
    BRAVE_SEARCH_API_KEY: 'Brave Search API Key',
    META_ACCESS_TOKEN: 'Meta Access Token',
    META_AD_ACCOUNT_ID: 'Meta Ad Account ID',
    META_PAGE_ID: 'Meta Page ID',
    WHATSAPP_PHONE_ID: 'WhatsApp Phone ID',
    GOOGLE_ADS_CLIENT_ID: 'Google Ads Client ID',
    GOOGLE_ADS_CLIENT_SECRET: 'Google Ads Client Secret',
    GOOGLE_ADS_REFRESH_TOKEN: 'Google Ads Refresh Token',
    GOOGLE_ADS_DEVELOPER_TOKEN: 'Google Ads Developer Token',
    LINKEDIN_ACCESS_TOKEN: 'LinkedIn Access Token',
    GMAIL_USER: 'Gmail Address',
    GMAIL_APP_PASSWORD: 'Gmail App Password',
    CUSTOM_API_KEY_1: 'Custom API Key 1',
    CUSTOM_API_KEY_2: 'Custom API Key 2',
};

app.get('/api/client-key-labels', (req, res) => {
    res.json({ labels: CLIENT_KEY_LABELS });
});

app.get('/api/clients/:id/keys', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { id } = req.params;
        const doc = await db.collection('client_configs').doc(id).get();
        const data = doc.exists ? doc.data() : {};

        const keys = Object.entries(CLIENT_KEY_LABELS).map(([key, label]) => ({
            key,
            label,
            value: data[key] ? maskValue(data[key]) : '',
            isSet: !!data[key],
        }));

        res.json({ keys });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients/:id/keys', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { id } = req.params;
        const { updates } = req.body;
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const cleanUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value && value.trim() !== '' && !value.includes('••••')) {
                cleanUpdates[key] = value.trim();
            }
        }

        if (Object.keys(cleanUpdates).length === 0) {
            return res.status(400).json({ error: 'No values to update' });
        }

        await db.collection('client_configs').doc(id).set(cleanUpdates, { merge: true });
        console.log(`[API] Client ${id} keys updated: ${Object.keys(cleanUpdates).join(', ')}`);
        res.json({ success: true, updatedKeys: Object.keys(cleanUpdates) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/clients/:id/keys/:key/raw', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { id, key } = req.params;
        const doc = await db.collection('client_configs').doc(id).get();
        const data = doc.exists ? doc.data() : {};
        if (data[key]) {
            res.json({ value: data[key] });
        } else {
            res.status(404).json({ error: 'Key not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { id } = req.params;
        const { name, email, phone, company, notes } = req.body;
        await db.collection('clients').doc(id).update({
            name, email, phone, company, notes,
            updatedAt: new Date()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ error: 'Firebase not initialized' });
        const { id } = req.params;
        await db.collection('clients').doc(id).delete();
        // Also delete client-specific config
        await db.collection('client_configs').doc(id).delete();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Keep original name but add timestamp to avoid collisions
        const timestamp = Date.now();
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// Expose the uploads directory (optional, but good for verification if needed)
app.use('/uploads', express.static(uploadDir));

// File upload endpoint
app.post('/upload', (req, res, next) => {
    console.log(`[Upload] Received POST request to /upload`);
    next();
}, upload.single('file'), (req, res) => {
    if (!req.file) {
        console.log(`[Upload] No file in request`);
        return res.status(400).send({ error: 'No file uploaded' });
    }
    const filePath = path.join(uploadDir, req.file.filename);
    console.log(`[Upload] File saved to: ${filePath}`);
    res.send({ 
        message: 'File uploaded successfully', 
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: filePath 
    });
});

// Expose the outputs directory so users can download generated files
app.use('/outputs', (req, res, next) => {
    console.log(`[Static] Output requested: ${req.url}`);
    // Force download if requested via query param or if it's a non-previewable file
    if (req.query.download) {
        res.setHeader('Content-Disposition', 'attachment');
    }
    next();
}, express.static(path.join(__dirname, 'outputs'), {
    maxAge: '1d'
}));

const sessionsBaseDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsBaseDir)) fs.mkdirSync(sessionsBaseDir, { recursive: true });

app.get('/api/sessions', (req, res) => {
    const files = fs.readdirSync(sessionsBaseDir);
    const sessions = files.map(f => {
        const content = JSON.parse(fs.readFileSync(path.join(sessionsBaseDir, f), 'utf8'));
        return {
            id: content.sessionId,
            lastUpdated: content.lastUpdated,
            preview: content.chatHistory?.[1]?.text?.substring(0, 80) || 'New Mission',
            runSummary: content.runSummary || null
        };
    }).sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    res.json({ sessions });
});

app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

io.on('connection', (socket) => {
    console.log('User connected to Web UI');
    let orchestrator = null;
    let sessionDir = null;
    let sessionId = null;
    let latestHistory = [];
    let latestLogs = [];
    let jobQueue = [];
    let currentJobId = null;
    const MAX_JOB_ATTEMPTS = 3;
    const BASE_RETRY_DELAY_MS = 15000;

    const emitMissionState = () => {
        if (!orchestrator) return;
        const base = orchestrator.getMissionControlData();
        const queueTotals = {
            queued: jobQueue.filter(job => job.status === 'queued').length,
            paused: jobQueue.filter(job => job.status === 'paused').length,
            completed: jobQueue.filter(job => job.status === 'completed').length,
            retrying: jobQueue.filter(job => job.status === 'retry_wait').length,
            deadLetters: jobQueue.filter(job => job.status === 'dead_letter').length
        };
        socket.emit('mission_state', {
            ...base,
            queue: {
                activeJobId: currentJobId,
                jobs: jobQueue.slice(0, 20),
                totals: queueTotals
            },
            usage: {
                sessionEstimatedCostUsd: Number(jobQueue.reduce((sum, job) => sum + Number(job.estimatedCostUsd || 0), 0).toFixed(6)),
                completedJobs: queueTotals.completed
            }
        });
    };

    const updateJobFromMission = () => {
        if (!currentJobId || !orchestrator) return;
        const job = jobQueue.find(item => item.id === currentJobId);
        if (!job) return;
        const mission = orchestrator.getMissionControlData();
        const activeRun = mission.activeRun;
        const lastCompletedRun = mission.recentRuns?.[0];

        if (orchestrator.pendingApproval || orchestrator.isWaitingForInput) {
            job.status = 'paused';
        } else if (activeRun && !activeRun.finishedAt) {
            job.status = 'running';
        } else if (lastCompletedRun?.finishedAt) {
            job.status = lastCompletedRun.status === 'stopped' ? 'cancelled' : lastCompletedRun.status;
            job.finishedAt = lastCompletedRun.finishedAt;
            job.steps = lastCompletedRun.steps;
            job.toolCalls = lastCompletedRun.toolCalls;
            job.llmCalls = lastCompletedRun.llmCalls;
            job.estimatedCostUsd = lastCompletedRun.estimatedCostUsd;
            currentJobId = null;
        }
    };

    const saveSession = () => {
        if (!sessionId || !orchestrator) return;
        updateJobFromMission();
        const sessionMetaFile = path.join(sessionsBaseDir, `${sessionId}.json`);
        const state = {
            sessionId,
            sessionDir,
            orchestratorState: orchestrator.getPersistentState(),
            chatHistory: latestHistory,
            logs: latestLogs,
            runSummary: orchestrator.getMissionControlData(),
            jobQueue,
            currentJobId,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(sessionMetaFile, JSON.stringify(state, null, 2));
    };

    const processNextJob = async () => {
        if (!orchestrator || orchestrator.isRunning || currentJobId) return;
        const now = Date.now();
        const retryReadyJob = jobQueue.find(job => job.status === 'retry_wait' && (!job.nextRunAt || new Date(job.nextRunAt).getTime() <= now));
        if (retryReadyJob) {
            retryReadyJob.status = 'queued';
        }
        const nextJob = jobQueue.find(job => job.status === 'queued');
        if (!nextJob) {
            emitMissionState();
            return;
        }

        currentJobId = nextJob.id;
        nextJob.status = 'running';
        nextJob.startedAt = nextJob.startedAt || new Date().toISOString();
        emitMissionState();

        try {
            if (nextJob.clientId) {
                const doc = await db.collection('client_configs').doc(nextJob.clientId).get();
                const clientConfigs = doc.exists ? doc.data() : {};
                orchestrator.setClientContext(nextJob.clientId, clientConfigs);
            } else {
                orchestrator.setClientContext(null, {});
            }

            await orchestrator.execute(nextJob.prompt);
        } catch (error) {
            nextJob.attempts = (nextJob.attempts || 0) + 1;
            nextJob.error = error.message;
            if (nextJob.attempts < MAX_JOB_ATTEMPTS) {
                const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, nextJob.attempts - 1);
                nextJob.status = 'retry_wait';
                nextJob.nextRunAt = new Date(Date.now() + delayMs).toISOString();
                socket.emit('nexus_log', {
                    type: 'thought',
                    message: `Mission failed for the Boss and will retry automatically in ${Math.round(delayMs / 1000)}s. Attempt ${nextJob.attempts + 1}/${MAX_JOB_ATTEMPTS}.`
                });
            } else {
                nextJob.status = 'dead_letter';
                nextJob.finishedAt = new Date().toISOString();
                socket.emit('nexus_log', { type: 'error', message: `Mission moved to dead-letter queue after ${MAX_JOB_ATTEMPTS} attempts: ${error.message}` });
            }
            currentJobId = null;
        } finally {
            updateJobFromMission();
            emitMissionState();
            updateOutputsList();
            saveSession();
            if (!currentJobId) {
                const nextRetry = jobQueue
                    .filter(job => job.status === 'retry_wait' && job.nextRunAt)
                    .map(job => Math.max(0, new Date(job.nextRunAt).getTime() - Date.now()))
                    .sort((a, b) => a - b)[0];
                setTimeout(processNextJob, typeof nextRetry === 'number' ? Math.min(nextRetry, 1000) : 0);
            }
        }
    };

    socket.on('join_session', (data) => {
        sessionId = data.sessionId || `session_${Date.now()}`;
        const sessionMetaFile = path.join(sessionsBaseDir, `${sessionId}.json`);
        let savedState = null;

        if (fs.existsSync(sessionMetaFile)) {
            console.log(`[Session] Resuming persistent session: ${sessionId}`);
            savedState = JSON.parse(fs.readFileSync(sessionMetaFile, 'utf8'));
            sessionDir = savedState.sessionDir;
            jobQueue = savedState.jobQueue || [];
            currentJobId = savedState.currentJobId || null;
        }

        if (!sessionDir) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            sessionDir = path.join(__dirname, 'outputs', `session_${timestamp}`);
        }

        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        orchestrator = new NexusOrchestrator((logEvent) => {
            socket.emit('nexus_log', logEvent);
            latestLogs.push({ ...logEvent, at: new Date().toISOString() });
            latestLogs = latestLogs.slice(-200);
            updateJobFromMission();
            emitMissionState();
            // Auto-save on every log event to ensure persistence
            saveSession();
        }, sessionDir);

        if (savedState) {
            orchestrator.restorePersistentState(savedState.orchestratorState);
            latestHistory = savedState.chatHistory || [];
            latestLogs = savedState.logs || [];
            socket.emit('session_recovered', { 
                sessionId, 
                history: latestHistory,
                logs: latestLogs
            });
            const activeJob = jobQueue.find(job => job.id === currentJobId);
            if (activeJob && activeJob.status === 'running') {
                activeJob.status = 'queued';
                currentJobId = null;
            }
            emitMissionState();
        } else {
            socket.emit('session_created', { sessionId });
        }
        
        updateOutputsList();
        processNextJob();
    });

    socket.on('stop_task', () => {
        if (orchestrator) {
            orchestrator.stop();
            if (currentJobId) {
                const activeJob = jobQueue.find(job => job.id === currentJobId);
                if (activeJob) {
                    activeJob.status = 'cancelled';
                    activeJob.finishedAt = new Date().toISOString();
                }
                currentJobId = null;
            }
            emitMissionState();
            saveSession();
            processNextJob();
        }
    });

    socket.on('start_new_session', () => {
        if (orchestrator) orchestrator.stop();
        
        sessionId = `session_${Date.now()}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        sessionDir = path.join(__dirname, 'outputs', `session_${timestamp}`);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        orchestrator = new NexusOrchestrator((logEvent) => {
            socket.emit('nexus_log', logEvent);
            latestLogs.push({ ...logEvent, at: new Date().toISOString() });
            latestLogs = latestLogs.slice(-200);
            socket.emit('mission_state', orchestrator.getMissionControlData());
            saveSession();
        }, sessionDir);

        latestHistory = [];
        latestLogs = [];
        jobQueue = [];
        currentJobId = null;
        socket.emit('session_created', { sessionId });
        emitMissionState();
        updateOutputsList();
    });

    socket.on('start_task', async (data) => {
        const { prompt, clientId } = data;
        if (!orchestrator) {
            socket.emit('nexus_log', { type: 'error', message: 'Nexus Orchestrator not initialized. Please refresh or start a new mission.' });
            return;
        }
        const job = {
            id: `job_${Date.now()}`,
            prompt,
            clientId: clientId || null,
            status: 'queued',
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            estimatedCostUsd: 0,
            attempts: 0,
            nextRunAt: null
        };
        jobQueue.unshift(job);
        socket.emit('nexus_log', { type: 'thought', message: `Mission queued for the Boss. Position: ${jobQueue.filter(item => item.status === 'queued').length}` });
        emitMissionState();
        saveSession();
        processNextJob();
    });

    socket.on('user_input', async (data) => {
        const { prompt, clientId } = data;
        if (!orchestrator) {
            socket.emit('nexus_log', { type: 'error', message: 'Nexus Orchestrator not initialized.' });
            return;
        }
        try {
            if (clientId) {
                const doc = await db.collection('client_configs').doc(clientId).get();
                const clientConfigs = doc.exists ? doc.data() : {};
                orchestrator.setClientContext(clientId, clientConfigs);
            }
            await orchestrator.resume(prompt);
            updateJobFromMission();
            updateOutputsList();
            emitMissionState();
            saveSession();
            processNextJob();
        } catch (error) {
            socket.emit('nexus_log', { type: 'error', message: `Orchestrator Error: ${error.message}` });
        }
    });

    socket.on('sync_history', (data) => {
        // Client sends full history for deep persistence
        if (!sessionId) return;
        latestHistory = data.history || latestHistory;
        latestLogs = data.logs || latestLogs;
        saveSession();
    });

    socket.on('requeue_job', (data) => {
        const { jobId } = data || {};
        const job = jobQueue.find(item => item.id === jobId);
        if (!job) return;
        if (!['dead_letter', 'cancelled', 'failed'].includes(job.status)) return;

        job.status = 'queued';
        job.error = null;
        job.finishedAt = null;
        job.nextRunAt = null;
        job.attempts = 0;
        socket.emit('nexus_log', { type: 'thought', message: `Boss re-queued mission ${jobId} for another attempt.` });
        emitMissionState();
        saveSession();
        processNextJob();
    });

    socket.on('retry_now', (data) => {
        const { jobId } = data || {};
        const job = jobQueue.find(item => item.id === jobId);
        if (!job) return;
        if (job.status !== 'retry_wait') return;

        job.status = 'queued';
        job.nextRunAt = null;
        socket.emit('nexus_log', { type: 'thought', message: `Boss forced immediate retry for mission ${jobId}.` });
        emitMissionState();
        saveSession();
        processNextJob();
    });

    const updateOutputsList = () => {
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            const folderName = path.basename(sessionDir);
            socket.emit('outputs_list', {
                files: files.map(f => ({ name: f, url: `/outputs/${folderName}/${f}` }))
            });
        }
    };

    socket.on('get_outputs', updateOutputsList);

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Nexus OS Web Interface running on http://localhost:${PORT}`);
});
