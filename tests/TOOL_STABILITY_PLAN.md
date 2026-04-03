# Tool Stability Plan

## Phase 1: Inventory
1. Freeze the tool list in `TOOLS_MASTER_MATRIX.md`.
2. Mark each tool as critical, high, medium, or low priority.
3. Record required keys and whether each key belongs to Boss scope or Client scope.

## Phase 2: Critical Smoke Tests
Cover these first:
- browserAction
- askUserForInput
- searchWeb
- buildAgencyQuotePlan
- createAgencyQuoteArtifacts
- sendEmail
- sendWhatsApp
- analyzeMarketingPage
- metaAds
- Google Ads family

Each critical tool needs:
- happy path
- missing key path
- invalid input path
- boss vs client scope path

## Phase 3: Missing-Key Resume Verification
For every keyed tool verify:
- missing key is detected
- Nexus asks in chat
- replying with key saves to Boss config when no client is selected
- replying with key saves to Client config when client context is active
- mission resumes without restarting

## Phase 4: End-to-End Flows
Critical flows:
1. Add client -> add keys -> marketing audit
2. Add client -> generate quote -> create invoice
3. Missing key -> provide in chat -> resume same mission
4. Draft email -> approval -> send
5. Marketing flow -> deliverable -> finance handoff

## Phase 5: Release Gate
Stable means:
- all critical smoke tests pass
- missing-key resume tests pass
- Mission Control flow passes manually
- frontend build passes
- no uncaught fatal tool crash in logs
