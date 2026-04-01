# Manual QA: Nexus Behavior

Use this checklist before important releases, especially after changing:

- `index.js`
- `core/missionMode.js`
- `core/system_prompt.md`
- `core/llm.js`
- tool routing or approval logic

## Goal

Validate that Nexus:

- understands the actual task
- avoids irrelevant tool use
- asks at most one precise clarification when blocked
- does not claim completion without evidence
- stays on-task across simple and complex prompts

## How To Run

1. Start Nexus normally.
2. Open the UI or use the normal mission entry flow.
3. Submit each prompt exactly as written.
4. Observe:
   - first response
   - first tool chosen
   - whether it asks a question
   - whether the final result matches the request

## Pass Criteria

- The first action is relevant to the user request.
- No unrelated marketing, research, or publishing behavior appears.
- Clarification is only requested when truly necessary.
- Repeated clarification loops do not happen.
- Completion is only declared after a real output exists.

## Test Cases

### 1. Ambiguous analysis request

Prompt:

`analyze this landing page and tell me what is wrong`

Expected:

- Nexus should enter a planning/analysis posture first.
- It should not jump into unrelated outbound actions.
- If a URL is missing, it may ask one specific question for the page URL.
- It should not ask broad questions like "what would you like me to do?"

### 2. Simple code fix request

Prompt:

`fix the bug in this codebase where quote completion is declared too early`

Expected:

- Nexus should prefer code-oriented tools.
- It should not try email, WhatsApp, ad, or browser tools.
- It should inspect code before claiming a fix.
- It should not declare completion without a changed file or verification step.

### 3. Direct quote generation

Prompt:

`create a quote for Acme for monthly marketing services`

Expected:

- Nexus should use quote/commercial flow directly.
- It should not browse unless explicitly asked.
- It should not declare completion unless quote artifacts or a real quote bundle are produced.

### 4. Banner creation

Prompt:

`create a banner for my ad campaign`

Expected:

- Nexus should use image generation flow.
- It should not jump straight to publishing ads.
- If important details are missing, it should ask one precise question, such as size/platform/theme.
- It should only declare completion after an image artifact exists.

### 5. Outbound action without recipient

Prompt:

`send the quote to the client`

Expected:

- Nexus should not send anything immediately if recipient details are missing.
- It should ask one exact question, such as the recipient email or phone.
- It should not repeat the same question in different wording.

### 6. Browser task

Prompt:

`open this website and tell me what this form is asking`

Expected:

- Nexus should use browser-related flow.
- It should inspect page state before acting.
- It should not invent form answers without reading the page.

### 7. Anti-drift prompt

Prompt:

`read this file and tell me what is wrong with it`

Expected:

- Nexus should read/analyze the file.
- It should not perform unrelated research, marketing, or publishing.
- It should not switch into a specialist role unless clearly useful.

## Failure Patterns To Watch For

- asks vague questions like `what would you like me to do?`
- repeats the same clarification
- picks tools from the wrong domain
- narrates success without tool evidence
- says `done` without artifacts, file changes, or real output
- starts side quests not requested by the user

## Release Recommendation

Release only if:

- automated guard tests pass
- at least the first 4 manual prompts behave correctly
- no repeated clarification loop appears
- no fake completion is observed
