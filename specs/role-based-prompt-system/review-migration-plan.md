# Review: migration-plan.md

**Reviewer**: vow-spec-architect (Opus)
**Review Date**: 2026-02-07
**Target Document**: `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/migration-plan.md` v1.0
**Cross-reference**: `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md` v1.0.0

---

## 1. Prompt Diff Analysis Accuracy (Section 1 of migration-plan.md)

### 1.1 Current Architecture Table (Line 14-20)

**OK**: 3 route identification is correct.
- MCP route via `ai-coach-prompt.ts` (~6,000 chars JA): Confirmed at `/home/ubuntu/Downloads/vow/frontend/app/dashboard/constants/ai-coach-prompt.ts` line 16-185 (JA) and line 190-320 (EN).
- OpenAI API route via `generateSystemPrompt()` (~20,000 chars JA): Confirmed at `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` lines 225-888.
- Mastra Agent route with inline prompt: Confirmed below.

**ISSUE [I-001]**: The table says Mastra route prompt is "~60 chars" but the actual inline prompt in `Section.Coach.tsx` (line 304-306) is:
```typescript
systemMessage: locale === 'ja'
  ? 'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'
  : 'You are a habit coach for the VOW app. You help users build better habits.',
```
The JA version is 37 characters, the EN version is 72 characters. "~60 chars" is a rough approximation that could be more precise: "~37 chars (JA) / ~72 chars (EN)".

**ISSUE [I-002]**: The table references `Section.Coach.tsx` and `Section.AIHub.tsx` as the Mastra route prompt locations. The inline prompt is found at:
- `Section.Coach.tsx` line 304-306 (confirmed)
- `Section.AIHub.tsx` line 555-557 (confirmed)

Both have **identical** prompt strings. The migration plan does not note that these two files use the exact same inline prompt, which is a minor omission in the analysis.

### 1.2 Common Elements (Line 26-33)

**OK**: AICandidateResponse JSON format, candidateTypes flag system, context object, gatheredRequirements, reply candidate schema, Goal-Habit linking rules, and registration prohibition are all confirmed as present in both prompts.

**ISSUE [I-003]**: Line 33 says "Tool usage prohibition (for MCP route)" is a **Common Element**. This is incorrect. The tool usage prohibition appears **only** in the frontend prompt (`ai-coach-prompt.ts` lines 19-29, 179-182), not in the backend prompt (`generateSystemPrompt()`). The backend prompt has **no** explicit tool prohibition section. This should be classified under **Frontend-only Elements**, not Common Elements.

### 1.3 Frontend-only Elements (Lines 35-38)

**OK**: The following are correctly identified as frontend-only:
- "NEVER use any tools" repeated warnings: Confirmed at `ai-coach-prompt.ts` lines 19-26 (section 1), lines 31 (preamble to JSON section), lines 174-183 (prohibition list). This constitutes 3 separate emphatic sections.
- Explanation that "set a goal" means VOW app registration: Confirmed at `ai-coach-prompt.ts` lines 27-29 (JA), lines 200-202 (EN).
- English version is a complete translation: Confirmed at `ai-coach-prompt.ts` lines 190-320.

**ISSUE [I-004]**: The migration plan does not mention that the frontend prompt's **Sticky'n schema is simpler** than the backend's. The frontend Sticky'n schema (`ai-coach-prompt.ts` lines 114-124) has only `name` and `description`, while the backend schema (lines 371-393) includes additional fields: `completed`, `displayOrder`, `parentStickyId`, `depth`, `isReusable`. This is a meaningful structural difference that should be documented.

### 1.4 Backend-only Elements (Lines 40-59)

**OK**: The following are correctly identified and confirmed in the source code:
- Role framing as "Manager AI" / "Personal Manager": Confirmed at `vow-coach-agent.ts` line 226 ("マネージャーAI") and line 645 ("パーソナルマネージャー").
- Hearing flow rules (step-by-step): Confirmed at lines 527-539.
- Category auto-detection (8 keyword-to-category mappings): Confirmed at lines 541-557. Count verified: health, learning, productivity, wellness, finance, career, relationships, hobbies = 8 categories.
- Fixed UserReply requirement: Confirmed at lines 432-441.
- Emotional response handling: Confirmed at lines 819-856.
- Fatigue/stress handling: Confirmed at lines 836-857.
- Casual conversation handling: Confirmed at lines 859-867.
- Debug mode ("候補表示テスト"): Confirmed at lines 514-517.
- Detailed JSON examples: Confirmed at lines 449-512 (example 1-3), 558-610, 684-719, 736-749, 756-784, 846-856. Count is 7+, confirmed.
- Communication style rules: Confirmed at lines 798-811.
- Dynamic personalization (userContext): Confirmed at lines 1213-1299 with all listed data points.

**ISSUE [I-005]**: Line 59 says "English version: Structurally different from JA version (simplified schema definitions, different ordering)." This is correct. However, the migration plan does not detail the extent of the difference. The backend EN version (`vow-coach-agent.ts` lines 890-1208) uses a different schema format (TypeScript interface notation at lines 943-969 vs JSON at lines 237-325 in the JA version). It also has a separate `Habit/Goal/Sticky'n Schema Definition` section (lines 893-933) that has no counterpart in the JA version. This structural mismatch between JA and EN versions is a pre-existing issue within the backend prompt itself, and the migration plan should flag it as a risk factor for the unification effort.

**ISSUE [I-006]**: The migration plan lists "Vague question handling: Detailed table of ambiguous inputs -> reply choice patterns" as backend-only. While it is true that the backend has a much more detailed table (lines 666-674), the frontend prompt also has basic vague question handling: "初回質問: ユーザーが曖昧な質問をした場合、具体的な情報を聞き出す" (`ai-coach-prompt.ts` line 140). This is not mentioned as a partial overlap.

### 1.5 Section.Coach / Section.AIHub Analysis (Lines 61-63)

**OK**: The analysis that these use trivially simple prompts is confirmed. The inline prompts (Section.Coach.tsx line 304-306, Section.AIHub.tsx line 555-557) are approximately 1 sentence each, containing no JSON format instruction and no candidate schemas.

**OK**: The observation that Mastra API route responses come back as plain text (not AICandidateResponse JSON) is a logical inference from the prompt, since the backend is responsible for prompt injection through `useMastraAgent`.

**SUGGESTION [S-001]**: The migration plan should clarify the interaction: when `useMastraAgent` is used from Section.Coach/Section.AIHub, the backend (`agents.ts` router) injects its own system prompt (the full ~20,000 char version via `generateCoachSystemPrompt(locale)` at line 1543). The inline `systemMessage` in the frontend is sent to the backend, but the backend's `agents.ts` router overrides it with its own prompt when routing via MCP fallback or OpenAI API. The migration plan's statement that "Mastra API route responses come back as plain text" may be misleading -- it depends on which backend route is actually triggered. If the OpenAI API route is used (via `VowCoachAgent.generateResponse()`), the full system prompt is applied and AICandidateResponse JSON is returned.

---

## 2. Base Prompt Recommendation Validity (Section 1.3)

### 2.1 "Strict Superset" Claim

**ISSUE [I-007]**: Line 70 states "It is a strict superset of the frontend prompt -- every concept in the frontend prompt exists in the backend prompt, but not vice versa." This is **not entirely accurate**. The following frontend concepts are **not present** in the backend prompt:

1. **Tool prohibition** (3 sections in frontend, zero in backend): `ai-coach-prompt.ts` lines 19-29, 31, 174-183. The backend prompt has no "NEVER use tools" instruction because tools are managed server-side. This is a critical functional element for the MCP route.

2. **"Set a goal" disambiguation** (frontend lines 27-29): The explanation that "set a goal" means VOW app registration, not code editing, is absent from the backend prompt.

Therefore, the backend prompt is **not** a strict superset. It is a near-superset that lacks MCP-specific safety instructions.

### 2.2 Overall Recommendation Assessment

**OK**: Despite I-007, the recommendation to use the backend prompt as the base is still sound because:
1. The backend prompt contains far richer UX-quality features.
2. The missing frontend-only elements (tool prohibition, disambiguation) can be added as an additional layer.
3. The dynamic userContext is essential and only exists in the backend.

**SUGGESTION [S-002]**: The recommendation should be amended to explicitly note: "The backend prompt will be used as the base, with the following frontend-specific instructions merged in: (a) Tool usage prohibition for MCP routes, (b) Goal/Habit registration disambiguation for MCP routes." This is partially addressed in Risk 3.1 (Tool prohibition conflict) but should also be stated in the recommendation section.

### 2.3 Frontend Prompt Advantages

**SUGGESTION [S-003]**: The migration plan should acknowledge the following advantage of the frontend prompt that the backend prompt lacks:

- **Conciseness and focus**: The frontend prompt (~6,000 chars) achieves core functionality (JSON response format, candidate schemas, basic conversation flow) in 1/3 the size of the backend prompt. For the MCP route where token cost matters (every system prompt token is billed), a leaner prompt could be beneficial. The migration plan should consider whether a "compact mode" of the unified prompt should be available for cost-sensitive routes.

---

## 3. Risk Analysis Completeness (Section 3)

### 3.1 Existing Risk Assessments

**OK**: The following risks are correctly identified and well-analyzed:
- MCP responses becoming too long (3.1, row 1)
- MCP server rejecting large prompts (3.1, row 2)
- Behavioral change in MCP responses (3.1, row 4)
- Tool prohibition conflict (3.1, row 5)
- UserContext injection loss (3.2, row 1)
- Session management differences (3.2, row 2)
- Drilldown controller limitation (3.2, row 4)
- Manager Mode availability (3.2, row 5)
- Prompt injection via frontend (3.3, row 1)
- UserContext leakage (3.3, row 2)
- Prompt exfiltration (3.3, row 3)
- Role escalation (3.3, row 4)

### 3.2 Missing Risks

**ISSUE [I-008]**: **LLM difference risk is underspecified**. Risk 3.1 row 3 mentions "prompts are tuned for different LLMs" but only notes "MCP route uses Claude (via CLI), while backend uses OpenAI." This needs much more detail:

1. **JSON compliance difference**: OpenAI has `response_format: { type: "json_object" }` (JSON mode) which guarantees valid JSON output. Claude does not have an equivalent strict JSON mode. The backend prompt's heavy emphasis on JSON formatting (with many examples) was tuned for OpenAI. When the same prompt is used with Claude via MCP, Claude may produce markdown-wrapped JSON (e.g., ````json ... ````) or occasionally produce non-JSON responses. This is a **High severity / High likelihood** risk, not Medium as currently rated.

2. **Token limit differences**: OpenAI's gpt-4o has 128K context window. Claude's context window varies by model. The ~20,000 char system prompt plus conversation history may behave differently across models.

3. **Tool calling semantics**: The backend uses OpenAI function calling (`ChatCompletionTool` interface, confirmed at `vow-coach-agent.ts` line 25). The MCP route has fundamentally different tool semantics. Unifying the prompt without accounting for this could cause confusion.

**ISSUE [I-009]**: **Missing risk: Backend EN prompt structural inconsistency**. As noted in I-005, the backend JA and EN prompts have significantly different structures. The EN version uses TypeScript interface notation for schemas while JA uses JSON examples. Unifying the prompt means both locale variants need to be tested equally. The migration plan does not call out this existing inconsistency as a migration risk.

**ISSUE [I-010]**: **Missing risk: Cache invalidation race condition**. The migration plan (Phase 2, Step 2.1) proposes storing prompts in a configuration table with runtime updates. If a prompt is updated while cached copies exist across multiple frontend clients, there could be a window where different users see different prompt behaviors. This is especially problematic for the SWR pattern proposed in architecture.md section 5.5.

**ISSUE [I-011]**: **Missing risk: `useMcpChat` dual-path ambiguity**. Currently, there are TWO MCP paths:
1. Frontend direct: `Section.MOC.tsx` -> `useMcpChat` -> MCP Server (frontend sends systemPrompt)
2. Backend mediated: `Section.MOC.tsx` -> `useMastraAgent` -> Backend -> `callMcpChat()` (backend generates systemPrompt at `agents.ts` line 1543)

The migration plan should explicitly identify which path is being targeted in each phase. Phase 1 (Step 1.1) appears to target path 1 only, but this is not clearly stated.

### 3.3 Quota Risk Assessment

**ISSUE [I-012]**: Risk 3.2 row 3 states "MCP route bypasses quota (returns hardcoded `quotaRemaining: 100`)." I searched `useMcpChat.ts` for `quotaRemaining` and `quota` and found **no matches**. The migration plan should provide the exact file and line number where this hardcoded value exists, or correct this claim if it is inaccurate.

---

## 4. Test Plan Sufficiency (Section 4)

### 4.1 Unit Tests

**OK**: The four unit test categories are appropriate and cover the core functionality.

### 4.2-4.3 Integration Tests

**OK**: The MCP route and OpenAI API route integration test scenarios are comprehensive and cover the main use cases.

### 4.4 Cross-Route Consistency Tests

**OK**: Testing response format parity, category detection parity, hearing flow parity, and emotional response parity across routes is well-designed.

### 4.5 Missing Test Scenarios

**ISSUE [I-013]**: **Missing test: EN locale parity**. All integration test scenarios appear to be implicitly JA-focused. Given the structural differences between JA and EN backend prompts (I-005), explicit EN locale test scenarios should be included.

**ISSUE [I-014]**: **Missing test: Prompt size impact on MCP response time**. Section 4.5 mentions "MCP response time" as a regression test, but does not specify a concrete threshold or baseline. For example: "Response latency must not increase by more than X seconds compared to current baseline with the 6K prompt."

**ISSUE [I-015]**: **Missing test: Concurrent cache scenarios**. Given the SWR caching strategy proposed in architecture.md section 5.5, tests should cover:
- What happens when the prompt API is down on first load (no cache exists)?
- What happens when localStorage is full?
- What happens when cached prompt version mismatches the backend?

**SUGGESTION [S-004]**: Add a test scenario for the **backend EN prompt path**: Send identical messages in EN locale to both MCP and OpenAI routes, verify both return valid AICandidateResponse. This is important because the EN backend prompt has a significantly different structure from the JA version.

**SUGGESTION [S-005]**: Add a **security-focused test**: Verify that when the frontend sends a tampered systemPrompt via `useMcpChat`, the backend (for the mediated MCP path) ignores the client-sent prompt and uses its own. Currently, the backend `agents.ts` (line 1543) generates its own prompt for MCP, so this should already work, but it should be verified.

---

## 5. Security Analysis Validity (Section 3.3)

### 5.1 Prompt injection via frontend (Row 1)

**OK**: This risk is **real and confirmed**. At `useMcpChat.ts` line 300, the frontend sends `systemPrompt: systemMessage` in the POST body. A user with browser DevTools can modify this value before the request is sent. However:

**SUGGESTION [S-006]**: The severity assessment should distinguish between the two MCP paths:
- **Frontend direct MCP path** (`useMcpChat` -> MCP Server): The systemPrompt is sent directly to the MCP server. There is no backend validation. This is the **high risk** path. Risk rating: Correct (High severity, Medium likelihood).
- **Backend mediated MCP path** (`useMastraAgent` -> Backend -> `callMcpChat`): The backend generates its own systemPrompt at `agents.ts` line 1543 and ignores any client-sent prompt. This path is **not vulnerable** to this attack. The migration plan does not distinguish between these paths.

### 5.2 UserContext leakage (Row 2)

**OK**: This risk is valid. If `GET /api/agents/system-prompt` (proposed in Phase 0, Step 0.2) is unauthenticated, user-specific data could leak. The mitigation (serve only base prompts from public endpoint) is sound.

### 5.3 Prompt exfiltration (Row 3)

**OK**: This risk is valid and inherent to the current architecture. The frontend prompt is visible in the client bundle and in network requests.

### 5.4 Role escalation (Row 4)

**SUGGESTION [S-007]**: The risk severity should be reassessed. Currently, `role-prompts.ts` defines roles including `developer`, `reviewer`, `tester`, `analyst`, `architect` (lines 465-472). However, examining the `getRoleSystemPrompt` function (line 485-488), there is no permission check -- it simply returns the prompt for any role. For the current implementation, this is theoretical since roles like `developer` have limited system-level capabilities. But after migration (when prompts are fetched from backend API), the backend should enforce role-based access control.

---

## 6. architecture.md Consistency Check

### 6.1 Consistent Points

**OK**: Both documents agree on:
- The problem statement: prompts are scattered across 3 locations (architecture.md 1.1, migration-plan.md 1.1)
- Backend prompt as base recommendation (architecture.md 5.4, migration-plan.md 1.3)
- Backend as the source of truth (architecture.md 5.1 recommends Option C, migration-plan.md 3.4 recommends Option B)
- Phase-based migration approach

### 6.2 Conflicts

**CONFLICT [C-001]**: **Recommended architecture option mismatch**.
- `architecture.md` section 5.1 recommends **Option C: Backend as source of truth + API provision** (`GET /api/prompts/:role`).
- `migration-plan.md` section 3.4 recommends **Option B: Backend-managed** and describes it as "Backend-managed (Current OpenAI approach)".

These are actually the same concept (backend as source of truth), but the labeling is inconsistent. In `architecture.md`, the options are labeled A/B/C/D (section 3.1-3.4), while in `migration-plan.md` section 3.4, the options are labeled A/B/C with different definitions:
- architecture.md Option A = Frontend sends prompt to backend
- architecture.md Option B = Shared package (monorepo)
- architecture.md Option C = Backend source + API
- architecture.md Option D = Frontend source + unified

- migration-plan.md Option A = Frontend-managed (current MCP approach)
- migration-plan.md Option B = Backend-managed (current OpenAI approach) -- RECOMMENDED
- migration-plan.md Option C = Hybrid (backend serves, frontend caches)

`migration-plan.md`'s Option B corresponds to `architecture.md`'s Option C, but the labels and descriptions differ. This could confuse agents working across both documents.

**CONFLICT [C-002]**: **API endpoint path mismatch**.
- `architecture.md` section 5.2 proposes: `GET /api/prompts/:role?locale=ja` with response `{ systemPrompt, role, locale, version, hash }`.
- `migration-plan.md` Phase 0 Step 0.2 proposes: `GET /api/agents/system-prompt?role=coach&locale=ja`.

The path structure and parameter style are different:
- architecture.md: `/api/prompts/:role` (path parameter for role)
- migration-plan.md: `/api/agents/system-prompt?role=coach` (query parameter for role)

These need to be reconciled into a single API design.

**CONFLICT [C-003]**: **Prompt layering model mismatch**.
- `architecture.md` section 2.3 defines a 4-layer prompt composition model:
  1. Base Prompt (role definition)
  2. Response Format Instructions
  3. Tool Instructions (route-dependent)
  4. User Context (dynamic)

- `migration-plan.md` does not define an explicit layering model. Instead, it describes the backend prompt as a monolithic base with userContext appended at runtime (lines 83-87). The concept of separating "Response Format Instructions" and "Tool Instructions" as distinct layers is not present in the migration plan's Phase 0 design.

This is a significant architectural inconsistency. The migration plan's Phase 0 Step 0.1 says "Extract `generateSystemPrompt()` from `vow-coach-agent.ts` into this module", but does not specify that the extraction should decompose the prompt into the 4 layers defined in architecture.md.

**CONFLICT [C-004]**: **Authentication requirement for prompt API**.
- `architecture.md` section 5.2 explicitly states: `Auth: Required (Bearer token)`.
- `migration-plan.md` Phase 0 Step 0.2 states: "Returns the base prompt (without userContext, which requires auth)".

The migration plan implies the endpoint might be unauthenticated (since it notes userContext requires auth separately), while architecture.md explicitly requires authentication. This discrepancy should be resolved -- unauthenticated access would conflict with the security risk analysis in both documents.

**CONFLICT [C-005]**: **Migration phase naming and scope**.
- `architecture.md` section 6 defines 4 phases:
  1. Backend prompt restructuring (backend only)
  2. Prompt API addition (backend only)
  3. Frontend switchover (frontend only)
  4. Cleanup

- `migration-plan.md` section 2 defines 4 phases:
  - Phase 0: Preparation (create shared module, create endpoint, harmonize frontend)
  - Phase 1: Unify MCP Route Prompt
  - Phase 2: Backend Prompt Source of Truth (DB/config)
  - Phase 3: Role-Based Prompt Registry

The scopes overlap but the decomposition is different. architecture.md's phases are simpler and focused on the immediate goal. migration-plan.md's phases are more ambitious, including DB storage (Phase 2) and a full PromptRegistry service (Phase 3) that are not mentioned in architecture.md.

---

## Summary

### Statistics

| Category | Count |
|----------|-------|
| OK (Correct) | 18 |
| ISSUE (Requires correction) | 15 |
| SUGGESTION (Improvement) | 7 |
| CONFLICT (architecture.md mismatch) | 5 |

### Critical Issues (Must Fix)

| ID | Summary | Location |
|----|---------|----------|
| I-003 | Tool prohibition misclassified as "Common Element" (it is Frontend-only) | migration-plan.md line 33 |
| I-007 | "Strict superset" claim is incorrect (frontend has tool prohibition and disambiguation absent from backend) | migration-plan.md line 70 |
| I-008 | LLM difference risk underspecified (OpenAI JSON mode vs Claude, High severity not Medium) | migration-plan.md line 155 |
| C-001 | Option labeling inconsistency between architecture.md and migration-plan.md | migration-plan.md section 3.4 vs architecture.md section 3-5 |
| C-002 | API endpoint path design inconsistency between documents | migration-plan.md Phase 0 vs architecture.md section 5.2 |
| C-003 | Prompt layering model not reflected in migration plan's extraction design | migration-plan.md Phase 0 Step 0.1 vs architecture.md section 2.3 |

### Medium Issues

| ID | Summary | Location |
|----|---------|----------|
| I-001 | Prompt size "~60 chars" is imprecise | migration-plan.md line 20 |
| I-004 | Frontend Sticky'n schema simplicity not documented | migration-plan.md section 1.2 |
| I-005 | Backend EN/JA structural inconsistency not flagged as risk | migration-plan.md line 59 |
| I-006 | Partial frontend vague question handling not acknowledged | migration-plan.md line 50 |
| I-009 | Missing risk: EN prompt structural inconsistency | migration-plan.md section 3 |
| I-010 | Missing risk: Cache invalidation race condition | migration-plan.md section 3 |
| I-011 | Missing risk: Dual MCP path ambiguity | migration-plan.md section 3 |
| I-012 | Quota bypass claim ("quotaRemaining: 100") unverified in useMcpChat.ts | migration-plan.md line 165 |
| I-013 | Missing test: EN locale parity | migration-plan.md section 4 |
| I-014 | Missing test: Concrete latency threshold for prompt size regression | migration-plan.md section 4.5 |
| I-015 | Missing test: Cache failure scenarios | migration-plan.md section 4 |
| C-004 | Authentication requirement discrepancy for prompt API | migration-plan.md Phase 0 vs architecture.md section 5.2 |
| C-005 | Migration phase scope and naming differences | migration-plan.md section 2 vs architecture.md section 6 |

### Key Suggestions

| ID | Summary |
|----|---------|
| S-001 | Clarify backend prompt injection behavior when useMastraAgent is used from Section.Coach/Section.AIHub |
| S-002 | Amend base prompt recommendation to list frontend-specific instructions that must be merged |
| S-003 | Acknowledge frontend prompt's conciseness advantage; consider "compact mode" for cost-sensitive routes |
| S-004 | Add EN locale integration test scenarios |
| S-005 | Add security test: verify backend ignores client-sent systemPrompt on mediated MCP path |
| S-006 | Distinguish security risk severity between direct and mediated MCP paths |
| S-007 | Reassess role escalation severity after migration to backend API |
