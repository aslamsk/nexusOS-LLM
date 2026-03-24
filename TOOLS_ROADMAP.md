# Tools Roadmap

This roadmap converts the current audit into an execution plan aimed at pushing Nexus OS toward `10/10` tool reliability.

## Scoring Model

- Impact: how much the tool matters to core product value
- Risk: how much damage or instability failures can cause
- Difficulty: implementation complexity to harden well
- Priority: recommended execution order

## Phase 1: Raise the Floor

Goal:

- Get the most-used and most-dangerous tools to a dependable `8-8.5/10`
- Reduce avoidable breakage, risky side effects, and silent failures

| Priority | Tool / Capability | Current | Target | Impact | Risk | Difficulty | Work |
|---|---|---:|---:|---:|---:|---:|---|
| P1 | `browserAction` | 7.0 | 8.5 | High | High | Medium | Add page-state snapshots, retry playbooks, selector fallback policies, and richer browser health diagnostics |
| P1 | `runCommand` | 7.0 | 8.5 | High | High | Medium | Add command policy tiers, safer execution profiles, structured command results, and better repair playbooks |
| P1 | `writeFile` / replace tools | 8.0 | 8.8 | High | High | Medium | Add diff previews, rollback snapshots, and stricter mutation policies for source files |
| P1 | Governance / approvals | 7.5 | 8.8 | High | High | Medium | Add typed approval payloads for every risky tool and stronger approval context summaries |
| P1 | Self-healing | 6.5 | 8.0 | High | Medium | Medium | Expand failure classification, recovery playbooks, and recovery memory persistence |
| P1 | Durable queue | 7.5 | 8.5 | High | High | Medium | Add manual requeue, dead-letter replay, and clearer retry reason tracking |

## Phase 2: External Side-Effect Hardening

Goal:

- Make outward-facing business tools safe, previewable, and trustworthy

| Priority | Tool / Capability | Current | Target | Impact | Risk | Difficulty | Work |
|---|---|---:|---:|---:|---:|---:|---|
| P2 | `metaAds` | 6.5 | 8.8 | High | High | High | Add schema validation, typed previews, dry-run mode, and provider response normalization |
| P2 | `googleAdsCreateCampaign` | 6.0 | 8.5 | High | High | High | Add validation, preview mode, budget checks, and clearer campaign creation workflow |
| P2 | `sendEmail` | 6.5 | 8.5 | High | Medium | Medium | Add templates, preview mode, delivery status tracking, and thread-aware send rules |
| P2 | `sendWhatsApp` / media | 6.5 | 8.3 | Medium | Medium | Medium | Add outbound preview, delivery tracking, media validation, and template awareness |
| P2 | `linkedinPublishPost` | 5.5 | 8.0 | Medium | Medium | Medium | Add stronger auth diagnostics, preview mode, and response normalization |

## Phase 3: Intelligence and Quality

Goal:

- Improve tool choice quality, memory usefulness, and output trustworthiness

| Priority | Tool / Capability | Current | Target | Impact | Risk | Difficulty | Work |
|---|---|---:|---:|---:|---:|---:|---|
| P3 | `searchWeb` | 6.5 | 8.2 | Medium | Low | Medium | Add query shaping, result filtering, and fallback search strategy |
| P3 | `openRouterChat` | 6.0 | 8.0 | Medium | Low | Medium | Add policy alignment, provider fallback, and normalized outputs |
| P3 | `generate_image` / `improveImage` | 6.5 | 8.0 | Medium | Low | Medium | Add style presets, quality checks, and retry/regeneration heuristics |
| P3 | `generateVideo` | 6.0 | 7.8 | Medium | Medium | High | Add health checks, output QA, and stronger pipeline monitoring |
| P3 | Memory tools | 5.5 | 8.0 | High | Medium | High | Add structured memory types, semantic retrieval, and recovery-memory linking |
| P3 | Delegation / squad | 5.5 | 8.0 | Medium | Medium | High | Add stronger task ownership, result contracts, and multi-agent coordination rules |

## Phase 4: Production Validation

Goal:

- Move from “strong architecture” to “proven reliability”

| Priority | Capability | Current | Target | Impact | Risk | Difficulty | Work |
|---|---|---:|---:|---:|---:|---:|---|
| P4 | Tool health checks | 6.0 | 9.0 | High | Medium | Medium | Add readiness tests for each provider and tool surface |
| P4 | Provider usage accounting | 6.0 | 9.0 | High | Medium | Medium | Replace estimated cost with provider-reported usage where available |
| P4 | Audit / observability | 7.0 | 9.0 | High | Medium | Medium | Add structured logs, traces, failure dashboards, and run analytics |
| P4 | Integration tests | 5.0 | 9.0 | High | High | High | Add end-to-end tests for browser, queue, approvals, and external tools |
| P4 | Recovery learning | 6.0 | 9.0 | High | Medium | High | Convert successful repairs into reusable policies and playbooks |

## Recommended Execution Order

1. Browser + command + file mutation hardening
2. Approval model and self-healing expansion
3. Queue replay / dead-letter controls
4. Email + WhatsApp + Meta Ads previews and validators
5. Google Ads and LinkedIn hardening
6. Memory and delegation upgrade
7. Provider usage accounting
8. End-to-end testing and observability

## Definition of 10/10

A tool should only be considered `10/10` when all of the following are true:

- live-tested in real workflows
- validated inputs
- normalized outputs
- safe retry/fallback behavior
- preview/approval if externally impactful
- recovery path for expected failures
- strong observability
- covered by tests where practical

## Immediate Next Batch

Best next implementation batch:

1. `browserAction` hardening
2. `runCommand` hardening
3. `writeFile` safeguards
4. dead-letter replay controls
5. typed approval previews for external tools
