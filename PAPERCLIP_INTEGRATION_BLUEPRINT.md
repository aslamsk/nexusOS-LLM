# Paperclip Integration Blueprint For Nexus OS

## Goal

Use Paperclip as the orchestration control plane for multi-agent work, while keeping Nexus OS as the execution platform for domain-specific business operations.

This approach avoids rewriting Nexus OS and instead turns its strongest capabilities into callable services that Paperclip agents can use.

## Recommended Architecture

### Source of truth

- Paperclip owns:
  - companies
  - agents
  - org roles
  - goals
  - issues and work tracking
  - approvals
  - routines and heartbeat scheduling
  - budgets and cost governance
  - audit trails
- Nexus OS owns:
  - specialized execution flows
  - marketing analysis
  - quote and invoice generation
  - finance summaries
  - browser and external tool operations
  - email and WhatsApp dispatch
  - custom deliverable generation

### Operating rule

Paperclip decides, tracks, and supervises.

Nexus OS executes, returns artifacts, and reports structured results.

## Why This Is The Right Fit

Nexus OS already contains strong business capabilities:

- [index.js](d:/nexusOS-LLM-stable/nexusOS-LLM/index.js) has the current orchestrator, tool registry, mission flow, approvals, and execution logic.
- [server.js](d:/nexusOS-LLM-stable/nexusOS-LLM/server.js) already exposes operational APIs for quotes, invoices, finance, and scanning.
- [core/agencyQuotePlanner.js](d:/nexusOS-LLM-stable/nexusOS-LLM/core/agencyQuotePlanner.js) and [core/commercialDocs.js](d:/nexusOS-LLM-stable/nexusOS-LLM/core/commercialDocs.js) are directly reusable for sales workflows.
- [tools/marketingUtils.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/marketingUtils.js), [tools/financialDashboard.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/financialDashboard.js), and [tools/proactiveScanner.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/proactiveScanner.js) are good candidates for Paperclip-triggered services.

Paperclip is stronger at:

- durable multi-agent coordination
- persistent issue tracking
- roles and delegation
- approval routing
- recurring work via heartbeats
- governance and cost visibility

## Integration Strategy

### Do not replace Nexus OS

Do not migrate all orchestration logic into Paperclip at once.

Instead:

1. Keep Nexus OS running as its own backend.
2. Expose focused Nexus execution endpoints.
3. Call those endpoints from Paperclip plugins or Paperclip-managed agents.
4. Move only task governance into Paperclip first.

### What to reduce over time

Over time, the top-level "single sovereign orchestrator" pattern in [index.js](d:/nexusOS-LLM-stable/nexusOS-LLM/index.js) should become less responsible for deciding:

- what the company should do next
- which worker should own a task
- when approval is required
- how work is tracked across sessions

Those responsibilities should move to Paperclip.

## Phase Plan

### Phase 0: Capability inventory

Identify the first Nexus OS capabilities to expose as stable task APIs:

- marketing audit
- quote generation
- invoice creation
- finance summary
- niche scan
- email dispatch
- WhatsApp dispatch

### Phase 1: Sidecar integration

Run Paperclip separately from Nexus OS.

Keep Nexus OS mostly unchanged, but add a small integration API surface with stable request and response contracts.

### Phase 2: Pilot workflow

Implement one end-to-end workflow:

- issue created in Paperclip
- assigned to a Paperclip agent
- agent calls Nexus OS endpoint
- Nexus OS returns structured output and artifacts
- result is attached to the issue
- approval is routed in Paperclip if needed

### Phase 3: Recurring work and approvals

Move scheduled routines and approval-heavy workflows into Paperclip:

- recurring client marketing checks
- quote review flow
- invoice send flow
- outbound campaign approval

### Phase 4: Reduce duplicate orchestration

Trim overlapping orchestration logic in Nexus OS and keep only:

- execution services
- artifact generation
- external integrations
- domain-specific helper logic

## Nexus API Surface To Add

The main refactor is to expose stateless execution endpoints instead of relying on long conversational state.

These endpoints should be added under a separate namespace, for example:

- `POST /api/nexus/marketing/audit`
- `POST /api/nexus/quote/generate`
- `POST /api/nexus/invoice/from-quote`
- `POST /api/nexus/finance/summary`
- `POST /api/nexus/research/scan`
- `POST /api/nexus/comms/email`
- `POST /api/nexus/comms/whatsapp`

### Design rules for these endpoints

- Request bodies must be structured JSON.
- Responses must be structured JSON.
- No dependency on prior chat state.
- No hidden reliance on in-memory mission context.
- Return artifact metadata when files are created.
- Include a machine-readable `status`.
- Include a human-readable `summary`.

## Proposed Endpoint Contracts

### 1. Marketing audit

`POST /api/nexus/marketing/audit`

Request:

```json
{
  "clientId": "client_123",
  "target": "https://example.com",
  "channels": ["seo", "meta_ads", "landing_page"],
  "competitors": ["competitor-a.com", "competitor-b.com"],
  "notes": "Focus on conversion and positioning"
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Audit completed for example.com",
  "report": {
    "headline": "High-potential conversion optimization opportunity",
    "strengths": [],
    "weaknesses": [],
    "recommendations": []
  },
  "artifacts": [
    {
      "type": "markdown",
      "path": "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/marketing/client_123/audit.md"
    }
  ]
}
```

Suggested implementation source:

- [tools/marketingUtils.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/marketingUtils.js)

### 2. Quote generation

`POST /api/nexus/quote/generate`

Request:

```json
{
  "clientId": "client_123",
  "clientName": "Acme",
  "serviceType": "monthly_marketing",
  "scope": "SEO + Meta Ads + Reporting",
  "budget": 2500,
  "currency": "USD",
  "notes": "Recurring retainer"
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Quote generated for Acme",
  "quote": {
    "id": "quote_abc",
    "total": 2500,
    "currency": "USD",
    "title": "Monthly marketing retainer"
  },
  "artifacts": [
    {
      "type": "pdf",
      "path": "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/agency-quote-123.pdf"
    },
    {
      "type": "csv",
      "path": "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/agency-quote-123.csv"
    },
    {
      "type": "markdown",
      "path": "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/agency-quote-123.md"
    }
  ]
}
```

Suggested implementation sources:

- [core/agencyQuotePlanner.js](d:/nexusOS-LLM-stable/nexusOS-LLM/core/agencyQuotePlanner.js)
- [core/commercialDocs.js](d:/nexusOS-LLM-stable/nexusOS-LLM/core/commercialDocs.js)
- existing quote endpoints in [server.js](d:/nexusOS-LLM-stable/nexusOS-LLM/server.js)

### 3. Invoice creation

`POST /api/nexus/invoice/from-quote`

Request:

```json
{
  "quoteId": "quote_abc",
  "sendNow": false
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Invoice created from quote",
  "invoice": {
    "id": "invoice_xyz",
    "paymentUrl": "https://..."
  },
  "artifacts": [
    {
      "type": "pdf",
      "path": "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/invoice-inv-123.pdf"
    }
  ]
}
```

Suggested implementation source:

- invoice routes already present in [server.js](d:/nexusOS-LLM-stable/nexusOS-LLM/server.js)

### 4. Finance summary

`POST /api/nexus/finance/summary`

Request:

```json
{
  "clientId": "client_123",
  "period": "month"
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Finance summary generated",
  "metrics": {
    "revenue": 10000,
    "spend": 4200,
    "profit": 5800,
    "currency": "USD"
  }
}
```

Suggested implementation source:

- [tools/financialDashboard.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/financialDashboard.js)

### 5. Niche scan

`POST /api/nexus/research/scan`

Request:

```json
{
  "niche": "wedding photographers in Dubai"
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Niche scan completed",
  "opportunities": [],
  "recommendations": []
}
```

Suggested implementation source:

- [tools/proactiveScanner.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/proactiveScanner.js)

### 6. Email dispatch

`POST /api/nexus/comms/email`

Request:

```json
{
  "to": ["client@example.com"],
  "subject": "Your quote",
  "body": "Please find the quote attached.",
  "attachments": [
    "D:/nexusOS-LLM-stable/nexusOS-LLM/outputs/agency-quote-123.pdf"
  ]
}
```

Response:

```json
{
  "status": "ok",
  "summary": "Email sent successfully"
}
```

Suggested implementation source:

- [tools/email.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/email.js)

### 7. WhatsApp dispatch

`POST /api/nexus/comms/whatsapp`

Request:

```json
{
  "phone": "+1234567890",
  "text": "Sharing your quote",
  "mediaUrl": "https://example.com/quote.pdf"
}
```

Response:

```json
{
  "status": "ok",
  "summary": "WhatsApp message sent successfully"
}
```

Suggested implementation source:

- [tools/whatsapp.js](d:/nexusOS-LLM-stable/nexusOS-LLM/tools/whatsapp.js)

## Paperclip Plugin Shape

Create one plugin focused on Nexus integration, for example:

- `paperclip-plugin-nexus`

The plugin should expose a small tool surface:

- `nexus_marketing_audit`
- `nexus_generate_quote`
- `nexus_create_invoice`
- `nexus_finance_summary`
- `nexus_scan_niche`
- `nexus_send_email`
- `nexus_send_whatsapp`

### Plugin responsibilities

- validate incoming arguments
- call Nexus OS HTTP endpoints
- normalize Nexus responses into stable tool outputs
- return artifact paths and summaries
- avoid embedding Nexus-specific business logic inside Paperclip

### Plugin configuration

The plugin should read:

- `NEXUS_BASE_URL`
- `NEXUS_API_KEY` or equivalent shared secret
- optional timeout settings

## Suggested Paperclip Agent Roles

Start with five focused agents:

- Marketing Lead
  - uses `nexus_marketing_audit`
  - uses `nexus_scan_niche`
- Sales Ops
  - uses `nexus_generate_quote`
  - uses `nexus_create_invoice`
- Finance Analyst
  - uses `nexus_finance_summary`
- Client Success
  - uses `nexus_send_email`
  - uses `nexus_send_whatsapp`
- Operator
  - routes approvals
  - checks issue state
  - escalates exceptions

## First Pilot Workflow

Start with the marketing audit workflow.

### Workflow shape

1. A Paperclip issue is created:
   - title: `Run marketing audit for client Acme`
2. The issue is assigned to the Marketing Lead agent.
3. The agent calls `nexus_marketing_audit`.
4. Nexus OS generates the analysis and artifacts.
5. The Paperclip issue receives:
   - summary
   - artifact links or file references
   - recommended next step
6. If outbound sharing is requested, Paperclip routes approval before dispatch.

### Why this should be first

- low operational risk
- high business value
- already close to existing Nexus capabilities
- easy to validate manually
- does not require full migration of finance or customer state

## Approval Model

Paperclip should own approvals for outbound actions and money-impacting actions.

Examples:

- sending emails
- sending WhatsApp messages
- issuing quotes externally
- sending invoices externally
- publishing campaigns

Nexus OS may keep local validation and safety checks, but final operator approval should be routed in Paperclip.

## Data Ownership Guidance

### Keep in Paperclip

- work items
- ownership
- approval state
- issue history
- routine execution history
- organizational structure

### Keep in Nexus OS

- client business metadata already tied to Firebase
- generated operational artifacts
- external tool credentials already in active use
- business-domain calculations and formatting logic

## Implementation Checklist

### Nexus OS

- add `/api/nexus/*` integration routes
- make each route stateless
- normalize result envelopes
- add shared authentication for Paperclip calls
- return artifact metadata in every workflow response
- log request IDs for traceability

### Paperclip

- create Nexus integration plugin
- configure Nexus base URL and secret
- define tool manifests
- create first agents
- create one pilot issue template
- route outbound sends through approval rules

## Practical Notes

- Keep the first version simple and synchronous where possible.
- Prefer returning local artifact paths plus a summary.
- If local file paths are not usable across environments, add a signed-download or asset proxy layer later.
- Avoid exposing the full Nexus chat orchestrator to Paperclip. Expose stable business services instead.

## Next Build Steps

1. Add the Nexus integration routes to [server.js](d:/nexusOS-LLM-stable/nexusOS-LLM/server.js).
2. Wrap existing business functions into stateless request handlers.
3. Create a Nexus plugin inside the Paperclip repo.
4. Test one issue flow: marketing audit.
5. Add quote generation as the second flow.

## Recommended Immediate Build Order

Build these in order:

1. `POST /api/nexus/marketing/audit`
2. `POST /api/nexus/quote/generate`
3. `POST /api/nexus/comms/email`
4. Paperclip Nexus plugin
5. marketing-audit pilot workflow

Once these are stable, move to invoice and finance automation.
