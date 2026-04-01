# Nexus OS UI Workflow Guide

This guide is the practical, human-friendly operating flow for Nexus OS.

It is written to remove confusion.

Think of Nexus OS in this order:

1. Set up Boss default company and Boss keys
2. Add client
3. Add client keys
4. Choose client context
5. Run work in Mission Control
6. Use Marketing or Finance screens only when needed
7. Use Tools and Setup Center only for fixing setup issues
8. Use Usage and Settings only for review and admin

## The Main Idea

There are two levels in Nexus OS:

- Boss / Internal Company level
  - this is your default Nexus system
  - global keys live here
  - fallback models and shared tools come from here
- Client level
  - each client can have isolated keys
  - client-specific work should run inside that client context

So first think:

- Boss setup first
- Client setup second
- Mission execution third

## The Correct First-Time Flow

### Step 1: Open `Setup Center`

Use this first if Nexus is new or not fully configured.

Purpose:

- understand what keys are missing
- see blockers before doing work
- start guided provider setup

What to do here:

1. Click `Refresh Doctor`
2. Read `Setup Doctor`
3. If a blocker is shown, use `Guide Me`
4. If provider onboarding is needed, use `Start Setup`

Important:

- `Setup Center` is for onboarding and fixing setup
- it is not your daily work screen

## Step 2: Open `Settings`

This is where Boss/global keys should be added first.

Purpose:

- configure default system-wide keys
- set fallback models
- configure quota mode

Add these first at Boss level:

- `GEMINI_API_KEY`
- `GEMINI_API_KEY_2`
- `BRAVE_SEARCH_API_KEY`
- `OPENROUTER_API_TOKEN`
- `OPENROUTER_MODEL`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `WHATSAPP_PHONE_ID`

Minimum recommended Boss setup:

1. Gemini key
2. Search key
3. Email key
4. At least one fallback provider

If you want only basic internal use first:

1. Gemini
2. Search
3. Gmail

Then click `Save Settings`

## Step 3: Open `Capabilities`

This screen is the tool readiness checker.

Purpose:

- see which tools are ready
- see which keys are missing
- test tool readiness

How to use:

1. Click `Refresh`
2. For any important tool, check status
3. If status is not ready:
   - click `Configure`
   - or go back to `Settings`
4. Use `Test` only when you want to verify that tool

Important:

- `Capabilities` is not where you do work
- it is only a readiness dashboard

## Step 4: Open `Clients`

After Boss/global setup is ready, now add clients.

Purpose:

- create client records
- isolate client keys
- switch chat context to a client

Correct flow:

1. Add client manually using `Add Client`
2. Fill:
   - name
   - company
   - email
   - phone
   - notes
3. Save client

After client is added:

1. Click `Keys`
2. Add client-specific keys if needed
3. Click `Use Context`

Now Nexus should operate for that client.

## Step 5: Client Keys Flow

After adding a client, next question is:

Does this client use Boss/global keys or separate client keys?

### Option A: Use Boss/global defaults

Use this if:

- same tools are shared across internal work
- you are testing
- client does not need isolated credentials yet

In this case:

- add client
- do not add many client keys
- just use `Use Context`

### Option B: Use client-specific keys

Use this if:

- each client has their own Meta account
- each client has their own Google Ads account
- each client has their own WhatsApp/email assets
- you want strict separation

Then for that client add only what is needed, for example:

- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `GOOGLE_ADS_*`
- `GMAIL_*`
- `X_*`

Recommended client onboarding order:

1. Add client
2. Add marketing keys
3. Add communication keys
4. Click `Use Context`
5. Run a small test mission

## Step 6: Open `Mission Control`

This is the main working screen.

If you remember only one screen for daily work, remember this one.

Purpose:

- talk to Nexus
- run tasks
- continue paused missions
- approve actions
- upload files
- run client-context work

## Correct Daily Working Flow

### Boss internal company work

If the task is for your own internal company:

1. Keep context as `System Default`
2. Type task in Mission Control
3. Let Nexus work
4. Approve only risky actions

### Client work

If the task is for a client:

1. Go to `Clients`
2. Click `Use Context` for that client
3. Go to `Mission Control`
4. Confirm selected context is that client
5. Run task

This is the clean working flow.

## Mission Control: What Actually Matters

Inside `Mission Control`, focus only on these:

### Important controls

- `Context`
  - choose `System Default` or a client
- prompt input
  - your actual mission request
- file upload
  - attach files/images/docs when needed
- approve / reject buttons
  - for risky actions
- stop / terminate
  - if Nexus is going in the wrong direction

### Important signals

- `Current engine`
- `Mission status`
- `Approval needed`
- `Waiting for input`
- latest output / artifact

### You can mostly ignore for now

These are useful later, but they create noise if you are still learning:

- `Boss Workspace`
- `Recent task memory`
- `Queued next step`
- `Latest target`
- command suggestion packs
- trace view
- deep engine details

These are not the first things you should look at.

## Right Side / Extra Detail Confusion

Your confusion is valid.

In the current Mission Control screen, there is too much mixed information:

- useful status
- advanced continuity memory
- retry jobs
- trace
- examples
- workspace hints

Practical rule:

For now, only care about:

1. selected context
2. your prompt
3. whether Nexus is working / paused / asking input
4. whether approval is needed
5. whether a real output came back

Everything else is secondary.

## After Client Is Added, What Next?

This is the exact post-client flow:

1. Add client
2. Add keys if needed
3. Click `Use Context`
4. Go to `Mission Control`
5. Give one focused task
6. Validate output
7. If marketing planning is needed, go to `Marketing`
8. If quote/invoice work is needed, go to `Finance`

## When To Use Each Screen

### `Mission Control`

Use for:

- normal task execution
- content creation
- coding tasks
- browser tasks
- setup continuation
- file-based work
- follow-ups

### `Clients`

Use for:

- adding client
- editing client context
- adding client keys
- switching active client

### `Finance`

Use for:

- quote creation
- recurring agency quote builder
- invoice creation
- budget review
- payment status

Correct flow:

1. select client
2. create quote
3. send quote
4. create invoice from quote
5. send invoice
6. mark paid

### `Marketing`

Use for:

- generating marketing brief
- workflow-based marketing planning
- audit bundle
- page analysis
- competitor scan
- social calendar
- report/proposal generation

Correct flow:

1. choose workflow
2. enter target
3. enter notes, channels, budget
4. generate brief
5. send brief to Mission Control if execution is needed
6. create deliverable or report

### `Setup Center`

Use for:

- onboarding providers
- solving setup blockers
- guided setup via Nexus

### `Capabilities`

Use for:

- checking whether tools are ready
- seeing missing keys
- testing provider readiness

### `Settings`

Use for:

- Boss/global keys
- quota mode
- model fallback configuration

### `Usage`

Use for:

- cost review
- provider/model usage
- client usage review

This is review only, not task execution.

## Recommended Clean User Journey

If you want a simple daily operating model, use this exact order:

### First-time setup

1. Setup Center
2. Settings
3. Capabilities
4. Clients
5. Mission Control

### New client onboarding

1. Clients
2. Add client
3. Client keys
4. Use Context
5. Mission Control
6. Marketing or Finance if needed

### Marketing job flow

1. Clients -> Use Context
2. Marketing -> Generate Brief
3. Send to Mission Control
4. Mission Control -> execute
5. Marketing -> download/send deliverable

### Quote / invoice flow

1. Clients -> Use Context
2. Finance -> Create Quote
3. Finance -> Send Quote
4. Finance -> Create Invoice
5. Finance -> Send Invoice
6. Finance -> Mark Paid

### Internal company flow

1. Settings for Boss keys
2. Mission Control with `System Default`
3. Finance/Marketing only when you want a structured workflow

## My Recommended “Default Boss Mode” Workflow

This is probably the simplest and strongest model for you:

### Phase 1: Internal Boss company

1. Configure Boss/global keys in `Settings`
2. Verify tool readiness in `Capabilities`
3. Use `Mission Control` with `System Default`
4. Test:
   - one content task
   - one quote task
   - one browser task

### Phase 2: Add clients

1. Add client in `Clients`
2. Add client-specific keys only if needed
3. Click `Use Context`
4. Run one small mission for that client

### Phase 3: Structured operations

1. Use `Marketing` for planning/report generation
2. Use `Finance` for quote/invoice lifecycle
3. Use `Mission Control` for actual execution and follow-up work

## What Is Wrong In Current UX

Current UX problem is not just features.

It is that all levels are visible at the same time:

- onboarding
- setup doctor
- live mission
- advanced memory
- client admin
- finance operations
- marketing workflow
- usage analytics

This creates mental overload.

## Simple Mental Model To Follow

Use this sentence:

`Setup first -> Client second -> Context third -> Mission fourth -> Finance/Marketing only when needed`

If you follow that, Nexus becomes much easier.

## Recommended UI Simplification For Future

If you later want UI cleanup, this should be the order:

1. Make `Mission Control` simpler by hiding advanced right-side details by default
2. Keep only:
   - prompt box
   - context selector
   - mission status
   - approvals
   - outputs
3. Move advanced items under a single `Advanced Details` accordion
4. Convert app usage into a guided onboarding flow:
   - Boss Setup
   - Add Client
   - Add Keys
   - Start First Mission

## Final Recommended Flow

If you ask me what exact flow you should follow from tomorrow, use this:

1. `Settings`
   Add Boss/global keys
2. `Capabilities`
   Confirm important tools are ready
3. `Clients`
   Add client
4. `Clients`
   Add client keys if required
5. `Clients`
   Click `Use Context`
6. `Mission Control`
   Run actual work
7. `Marketing`
   Only when you need structured brief/report/proposal flow
8. `Finance`
   Only when you need quote/invoice/payment flow
9. `Usage`
   Review cost later

That is the cleanest working model for the current Nexus UI.
