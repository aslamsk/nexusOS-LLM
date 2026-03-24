# Tools Audit

This document tracks the current strength, risk profile, failure modes, and next upgrade step for each major tool/capability in Nexus OS.

Scoring guide:

- `9-10`: Strong and production-ready
- `7-8`: Strong but still needs hardening
- `5-6`: Useful but not yet dependable at scale
- `<5`: Experimental or incomplete

## Core Runtime

| Tool / Capability | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| Orchestrator loop | 8.0 | Good central control flow and tool execution model | Complexity growth in a single loop | Task drift or weak recovery after repeated failures | Split planning, execution, and recovery concerns more cleanly |
| Durable queue | 7.5 | Session-backed queue with retries and dead-letter handling | Queue is still session-local, not global | Jobs pile up in one session or depend on socket lifecycle | Move to a global queue/worker model |
| Governance / approvals | 7.5 | Stronger protection around risky actions | Rule coverage is not yet exhaustive | A risky action bypasses ideal preview structure | Add typed approval policies per tool |
| Self-healing layer | 6.5 | Classifies failures and can suggest/trigger repair mode | Recovery playbooks are still shallow | Failure is detected but only lightly recovered | Add richer playbooks and persistent recovery memory |
| Session persistence | 8.0 | Good state recovery and run summary persistence | State can become bulky over time | Sessions restore but include stale or noisy state | Add retention, compression, and cleanup policies |
| Usage / cost tracking | 6.0 | Useful visibility into estimated usage | Cost is estimated, not provider-reported | Numbers drift from real provider cost | Integrate real usage accounting from providers |

## Local Intelligence Tools

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `readFile` | 8.0 | Stable and simple | Very low | Wrong path or unreadable file | Add path safety / validation helpers |
| `listDir` | 8.0 | Stable and fast | Very low | Wrong path | Add formatting / filtering options |
| `writeFile` | 8.0 | Strong with governance gate | Can mutate important source files | Incorrect content overwrite | Add diff preview and rollback snapshots |
| `replaceFileContent` | 7.5 | Safer than blind overwrite | Fragile when target text drifts | Target section mismatch | Add fuzzy matching and patch previews |
| `multiReplaceFileContent` | 7.5 | Efficient multi-edit mechanism | Same drift fragility as above | One chunk mismatch aborts whole set | Add partial application and conflict reporting |
| `codeMap` | 8.0 | Good repo awareness | Limited semantic understanding | Large trees still noisy | Add semantic code summaries |
| `codeSearch` | 8.0 | Very useful for debugging and navigation | String/grep limitations | Misses intent-level matches | Add AST/semantic search |
| `codeFindFn` | 8.0 | Good targeted function lookup | Regex-style lookup can miss variants | Misses oddly-declared functions | Add parser-backed function indexing |
| `runCommand` | 7.0 | High leverage and flexible | Broad blast radius | Bad command, environment drift, destructive ops | Add stricter command policies and sandbox profiles |

## Browser and Web

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `browserAction` | 7.0 | Valuable automation and already has some recovery | Browser UI drift and timing issues | Selector not found, login walls, race conditions | Add DOM snapshots, retry playbooks, and browser-state health checks |
| `searchWeb` | 6.5 | Good live info capability | Depends on provider quality and credentials | Weak results or missing Brave config | Add result validation and fallback search providers |

## Media Tools

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `generate_image` | 6.5 | Useful creative generation | Provider variability | Low-quality output or generation failure | Add quality review / regeneration loop |
| `improveImage` | 6.5 | Useful enhancement path | Prompt/provider inconsistency | Weak or unexpected edits | Add structured edit presets |
| `generateVideo` | 6.0 | Strong ambition with multiple fallbacks | Slow, expensive, provider-sensitive pipeline | Provider failure, long latency, unusable output | Add provider health checks and output QA |
| `removeBg` | 7.0 | Focused and relatively dependable | Edge-case media issues | Poor extraction on tricky images | Add confidence scoring and fallback processor |

## Communications

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `sendEmail` | 6.5 | Useful real-world agency action | Delivery uncertainty and credential fragility | SMTP/auth failure or weak formatting | Add send preview, delivery status, and template system |
| `readEmail` | 6.0 | Useful for inbox-aware workflows | Parsing is basic | Missed threads or inconsistent inbox state | Add message threading and structured inbox summaries |
| `sendWhatsApp` | 6.5 | Good outbound utility | API policy and delivery constraints | Missing config or failed delivery | Add delivery tracking and template support |
| `sendWhatsAppMedia` | 6.5 | Extends outreach capability | Same as above plus media issues | Media URL/path problems | Add upload validation and delivery confirmation |

## Advertising / Growth Tools

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `metaAds` | 6.5 | Important and now approval-gated | Paid/public actions are high-risk | Missing IDs, payload mismatch, provider rejection | Add typed campaign/post previews and live validation |
| `googleAdsListCampaigns` | 6.0 | Useful visibility into account state | Credential and schema complexity | API auth or query failure | Add readiness diagnostics and account health checks |
| `googleAdsCreateCampaign` | 6.0 | Strategic value is high | Paid action risk and setup complexity | Invalid campaign payload | Add schema validation and approval preview |
| `linkedinPublishPost` | 5.5 | Good idea for social ops | Provider limitations and brittle auth | Publishing failure or permission mismatch | Add stronger auth diagnostics and payload preview |

## External / Platform Extensions

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `openRouterChat` | 6.0 | Good flexibility option | Less governed than primary LLM path | Model/provider inconsistency | Add unified policy and response normalization |
| `n8nSearch` | 5.5 | Promising workflow discovery | Secondary integration path | Weak results or connector mismatch | Add curated workflow indexing |
| `getN8nWorkflow` | 5.5 | Potential orchestration extension | Execution trust and compatibility risk | Workflow path mismatch or execution failure | Add validation and execution sandboxing |

## Memory and Delegation

| Tool | Score | Current Strength | Main Risk | Common Failure Mode | Next Upgrade |
|---|---:|---|---|---|---|
| `saveMemory` | 5.5 | Useful persistence starting point | Low structure and weak retrieval semantics | Saves facts that are not reusable operationally | Move to structured memory types |
| `searchMemory` | 5.5 | Works for basic recall | String matching is shallow | Misses relevant context | Add embeddings / semantic retrieval |
| `delegateToAgent` | 5.5 | Good architectural direction | Still lightweight, not deep multi-agent execution | Delegation returns shallow output | Add stronger sub-agent coordination and task ownership |

## Top Priorities

1. Add provider-verified readiness diagnostics for all external tools.
2. Add typed previews and validation for all outbound or paid actions.
3. Expand self-healing playbooks and save successful recoveries as reusable patterns.
4. Move from estimated usage to provider-reported usage where possible.
5. Add deeper tests for browser, ads, email, queue, and recovery flows.

## Current Overall View

- Local/internal tools: strong
- Browser and automation tools: promising but still brittle
- External business tools: useful, but need more validation and observability
- Recovery/governance: improving quickly, not yet elite
- Platform average today: roughly `6.8-7.2/10`
