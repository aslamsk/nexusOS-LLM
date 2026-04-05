# Nexus Refactor Map

## Goal

Make Nexus behave more like top-tier agent systems:

- understand the task correctly
- choose the right tool or skill
- continue autonomously without unnecessary chatter
- verify progress after each tool
- finish the process end-to-end

This document maps the current Nexus architecture to a cleaner target architecture inspired by stronger agent systems such as Claude Code, while staying grounded in the current repo.

## Current Reality

Nexus has improved a lot already:

- routing is stronger
- capability truth is stricter
- browser handling is much stronger
- narrated fake tool use is guarded better
- governance, continuity, memory, self-healing, and dispatch logic are now partially extracted

But the main remaining problem is that too much orchestration still lives in [`index.js`](./index.js). That makes behavior harder to reason about, harder to test, and easier to regress.

## Claude-Code Style Mapping

### Claude-style concept -> Nexus current equivalent

- `QueryEngine.ts`
  - current Nexus equivalent: [`index.js`](./index.js)
  - target Nexus shape: `core/queryEngine.js` or `core/missionEngine.js`

- `Tool.ts`
  - current Nexus equivalents:
    - [`core/toolRegistry.js`](./core/toolRegistry.js)
    - [`core/toolDispatchPolicy.js`](./core/toolDispatchPolicy.js)
    - [`core/toolArgumentHydrator.js`](./core/toolArgumentHydrator.js)
    - [`core/toolExecutionRuntime.js`](./core/toolExecutionRuntime.js)
  - target Nexus shape: one clearer unified tool contract/runtime layer

- `tools.ts`
  - current Nexus equivalents:
    - [`core/toolRegistry.js`](./core/toolRegistry.js)
    - [`tools/`](./tools)
  - target Nexus shape: stronger single source of truth for supported tools, required args, output evidence, and approval rules

- `state/`, `history.ts`
  - current Nexus equivalents:
    - [`core/missionMemory.js`](./core/missionMemory.js)
    - [`core/missionContinuity.js`](./core/missionContinuity.js)
    - [`core/missionStatus.js`](./core/missionStatus.js)
  - target Nexus shape: dedicated mission state runtime

- `bridge/`, `cli/`
  - current Nexus equivalents:
    - [`server.js`](./server.js)
    - [`core/bridge.js`](./core/bridge.js)
    - frontend mission status parsing
  - target Nexus shape: clearer transport and UI bridge layer

## What Is Already Extracted

These modules are already real progress and should remain the foundation:

- [`core/domainPolicy.js`](./core/domainPolicy.js)
- [`core/capabilityResponses.js`](./core/capabilityResponses.js)
- [`core/taskContract.js`](./core/taskContract.js)
- [`core/browserMissionPolicy.js`](./core/browserMissionPolicy.js)
- [`core/missionStatus.js`](./core/missionStatus.js)
- [`core/missionGuards.js`](./core/missionGuards.js)
- [`core/missionContinuity.js`](./core/missionContinuity.js)
- [`core/missionMemory.js`](./core/missionMemory.js)
- [`core/toolDispatchPolicy.js`](./core/toolDispatchPolicy.js)
- [`core/toolArgumentHydrator.js`](./core/toolArgumentHydrator.js)
- [`core/toolExecutionRuntime.js`](./core/toolExecutionRuntime.js)
- [`core/externalActionPolicy.js`](./core/externalActionPolicy.js)
- [`core/governanceRuntime.js`](./core/governanceRuntime.js)
- [`core/selfHealingRuntime.js`](./core/selfHealingRuntime.js)
- [`core/toolRegistry.js`](./core/toolRegistry.js)

## What Still Lives in `index.js`

These are the highest-value remaining responsibility clusters inside [`index.js`](./index.js):

### 1. Main mission lifecycle

- constructor wiring
- `execute(...)`
- `_runLoop(...)`
- `_runChatLoop(...)`
- stop/reset/session management glue

This is effectively the current `QueryEngine`.

### 2. Approval and governance bridge

- `_handleApprovalResponse(...)`
- pending approval coordination
- approval result reinjection into loop

Some pieces are extracted already, but the flow is still assembled inside `index.js`.

### 3. Tool dispatch orchestration glue

- `_dispatchTool(...)`
- tool relevance enforcement
- governance check + approval pause
- result registration
- status emission

The runtime helpers exist, but orchestration still happens in one place.

### 4. Self-healing execution glue

- `_applySelfHealing(...)`
- browser re-scan healing
- wait-and-retry healing
- repair approval flow

Supporting helpers are extracted, but the mission loop still owns the sequencing.

### 5. LLM loop control and correction injection

- deterministic correction injection
- narrated tool salvage wiring
- browser continuation forcing
- clarification suppression for autonomous execution

This logic is better than before, but still too coupled to the main loop.

## Target Architecture

### 1. `core/queryEngine.js`

Own:

- mission start
- turn loop
- mode selection
- chat loop vs execute loop
- loop exit conditions

Should call into other runtimes, not implement their details.

### 2. `core/missionStateRuntime.js`

Own:

- current mission state
- pending approval
- pending repair
- current artifact
- mission stack
- status snapshot
- run bookkeeping

This should reduce hidden state spread across the orchestrator instance.

### 3. `core/toolRuntime.js`

Own:

- normalize
- hydrate
- relevance check
- governance preflight
- execution
- success evidence registration

This should become the single execution entry point for all tools.

### 4. `core/browserRuntime.js`

Own:

- browser mission continuation policy
- browser action recovery
- blocker classification
- browser-specific self-healing
- post-open/post-click scan strategy

This is the fastest path to top-tier feeling for real user tasks.

### 5. `core/governanceEngine.js`

Own:

- approval request creation
- approval state storage
- approval response resolution
- external action audit trail

### 6. `core/selfHealingEngine.js`

Own:

- healing classification
- recovery plan selection
- repair prompt preparation
- approval-gated repair execution

### 7. `core/bridgeRuntime.js`

Own:

- UI event formatting
- mission diagnostics payloads
- status channel emission
- frontend-friendly reasoning summaries

## Tool Maturity Model

To reach more top-tier behavior, every tool family should converge on the same execution pattern:

1. request classified into domain
2. allowed tools locked
3. missing arguments hydrated
4. execution started
5. output evidence verified
6. continuation decided automatically
7. approval requested only if truly necessary

### Current strongest families

- browser
- code
- commercial quotes
- image generation

### Current weaker families

- external publish flows
- login-gated browser flows
- long multi-step marketing handoffs
- email/whatsapp final delivery verification

## Migration Order

This is the safest next sequence.

### Phase 1: Finish engine extraction

- extract `queryEngine`
- extract `missionStateRuntime`
- extract `governanceEngine`
- extract `browserRuntime`

### Phase 2: Unify tool runtime

- merge dispatch policy + hydrator + execution + evidence handling behind one stable runtime surface
- move `_dispatchTool(...)` orchestration out of `index.js`

### Phase 3: Strengthen proof of completion

- browser completion proof
- media generation proof
- publish/send proof
- quote artifact proof

### Phase 4: E2E hardening

- repeated live browser form runs
- login-gate runs
- image generation runs
- quote-to-email runs
- Meta organic publish runs

## Proof Standard

Nexus should be considered closer to top-tier only when the following are true:

- repeated live runs finish the intended goal, not just call a tool
- failures classify into actionable reasons
- the agent keeps going unless human-only input is truly required
- tool families show similar maturity patterns, not isolated pockets of reliability

## Immediate Next Engineering Tasks

These are the next concrete implementation tasks.

1. Extract `queryEngine`
   - move `execute`, `_runLoop`, `_runChatLoop` orchestration into a dedicated module

2. Extract `missionStateRuntime`
   - centralize mutable mission state and reduce instance sprawl in `index.js`

3. Extract `browserRuntime`
   - move browser continuation, correction, blocker extraction, and post-action scan logic into one place

4. Unify tool execution
   - wrap normalize + hydrate + governance + dispatch + evidence into a single runtime API

5. Expand E2E assertions
   - upgrade live batch from “did something happen” into “goal actually completed”

## Bottom Line

Nexus is already much cleaner than before, but the final gap is no longer “add more prompts.”

The final gap is:

- cleaner engine boundaries
- stronger runtime state control
- unified tool execution
- repeated live end-to-end proof

That is the path from “clever custom agent” to “reliably agentic system.”
