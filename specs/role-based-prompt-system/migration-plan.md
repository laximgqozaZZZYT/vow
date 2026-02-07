# Role-Based Prompt System: Migration Plan & Risk Analysis

**Version**: 2.0
**Date**: 2026-02-07
**Author**: Plan Agent (Opus)
**Status**: Draft (Revised per cross-review findings)

---

## 1. Prompt Diff Analysis

### 1.1 Current Architecture

The system currently has **three distinct prompt configurations**, not two:

| Route | File | Prompt Size | Used By |
|-------|------|-------------|---------|
| MCP (frontend) | `frontend/.../ai-coach-prompt.ts` | ~6,000 chars (JA) | `Section.MOC.tsx` via `useMcpChat` |
| OpenAI API (backend) | `backend/.../vow-coach-agent.ts` `generateSystemPrompt()` | ~20,000 chars (JA) + dynamic userContext | `VowCoachAgent.processMessage()`, CLI `/api/agents/cli/chat` |
| Mastra Agent (frontend) | Inline in `Section.Coach.tsx` / `Section.AIHub.tsx` | ~37 chars (JA) / ~72 chars (EN) | `useMastraAgent` hook |

### 1.2 Structural Differences

#### Common Elements (Both prompts share)
- AICandidateResponse JSON format definition
- Goal/Habit candidate schemas with `type`, `label`, `confidence`, `detail`
- `candidateTypes` flag system (`showGoals`, `showHabits`, `showStickies`, `showReplies`)
- `context` object with `aboutType`, `aboutOperation`, `categories`
- `gatheredRequirements` with `explicit`, `inferred`, `completeness`
- Reply candidate schema with `action` values
- Goal-Habit linking rules (`parentGoalId` / `id`)
- Registration prohibition ("suggest only, never say registered")

#### Frontend-only Elements (MCP prompt)
- **Tool usage prohibition**: Explicit "NEVER use any tools" repeated warnings across 3 separate sections (`ai-coach-prompt.ts` lines 19-29, 31, 174-183). The backend prompt has NO tool prohibition since tools are managed server-side.
- **"Set a goal" disambiguation**: Explanation that "set a goal" means VOW app registration, not code editing (`ai-coach-prompt.ts` lines 27-29)
- **Simplified Sticky'n schema**: The frontend Sticky'n schema has only `name` and `description` fields, while the backend schema includes additional fields (`completed`, `displayOrder`, `parentStickyId`, `depth`, `isReusable`). [I-004]
- English version (`AI_COACH_SYSTEM_PROMPT_EN`) is a complete, structurally parallel translation

#### Backend-only Elements (OpenAI API prompt)
- **Role framing**: "Manager AI" / "Personal Manager" vs simple "AI Coach"
- **Hearing flow rules**: Step-by-step category -> sub-category -> candidate presentation
- **Category auto-detection**: 8 keyword-to-category mappings (health, learning, productivity, wellness, finance, career, relationships, hobbies)
- **Fixed UserReply requirement**: 4 mandatory adjustment buttons when showing entity candidates
- **Emotional response handling**: Empathy-first rules, specific phrases for negative/positive emotions
- **Fatigue/stress handling**: Required relaxation advice (breathing, sleep, meditation)
- **Casual conversation**: Greetings, weather, personal updates, jokes handling
- **Vague question handling**: Detailed table of ambiguous inputs -> reply choice patterns
- **Debug mode**: "Candidate display test" command
- **Detailed JSON examples**: 7+ complete JSON response examples for different scenarios
- **Communication style rules**: Listen-first, personalize, gradual approach, failure-tolerant
- **Dynamic personalization** (appended at runtime):
  - Active habit count, average completion rate, user level
  - Preferred frequency, existing habit names, existing goal names
  - Anchor habits (80%+ completion) for habit stacking suggestions
  - Level distribution (beginner/intermediate/advanced/expert counts)
  - Highest/lowest level habits
  - Personalization guidance based on user metrics
- **English version**: Structurally different from JA version. **Pre-existing issue [I-005]**: The EN version uses TypeScript interface notation (lines 943-969) while the JA version uses JSON examples (lines 237-325). This structural mismatch within the backend prompt itself is a risk factor for migration and should be harmonized independently.

#### Section.Coach / Section.AIHub (Mastra route)
- **Trivially simple prompt**: Just 1 sentence, no JSON format instruction, no candidate schemas
- This means Mastra API route responses come back as plain text, not AICandidateResponse JSON
- Both files use the exact same inline prompt string

### 1.3 Recommendation: Which Prompt to Use as Canonical Base

**Recommendation: Use the frontend MCP prompt (`ai-coach-prompt.ts`) as the canonical coach prompt.**

Rationale:

1. **User preference**: The user explicitly prefers the MCP prompt (`ai-coach-prompt.ts`, ~6,000 chars) and it is working well for MCP chat. This prompt MUST be preserved exactly as-is and always accessible.

2. **Better suited for Claude (MCP route's LLM)**: The simpler JSON instructions in the frontend prompt are better suited for Claude, which does not have a strict JSON mode like OpenAI's `response_format: { type: "json_object" }`. The backend prompt's heavy JSON examples were tuned for OpenAI. On Claude via MCP, the frontend prompt's simpler JSON instructions actually produce more reliable JSON output.

3. **Clean, focused prompt**: The frontend prompt is a clean, focused prompt that defines the AI Coach role clearly in ~6,000 characters. It achieves core functionality (JSON response format, candidate schemas, basic conversation flow) efficiently.

4. **Backend features as enhancement layers**: The backend's additional features (hearing flow, emotional handling, category detection, UserContext injection) can be added as separate enhancement layers on top of the canonical prompt, rather than the other way around.

5. **Backend placement is acceptable**: The canonical prompt content will be stored in the backend (`backend/src/prompts/roles/coach.ts`) as the single source of truth. The frontend's `ai-coach-prompt.ts` remains as a fallback cache.

The backend's `generateSystemPrompt()` will be **restructured** to use the canonical prompt as its base, with additional layers appended for backend-specific features. This is an inversion of the v1.0 approach, which proposed using the backend's 20,000-char prompt as the base.

> **Note**: The backend prompt is a near-superset of the frontend prompt in terms of feature coverage, but it lacks two MCP-specific elements: (a) Tool prohibition (3 sections), and (b) "set a goal" disambiguation (lines 27-29). [I-007] It is NOT a strict superset.

---

## 2. Migration Steps

### Phase 0: Preserve Canonical Prompt (No Risk)

**Step 0.1: Copy Canonical Prompt to Backend**
- Copy the exact content of `ai-coach-prompt.ts` (both JA and EN variants) to `backend/src/prompts/roles/coach.ts`
- This becomes the **single source of truth** for the AI Coach base prompt
- Export: `getCanonicalCoachPrompt(locale: 'ja' | 'en'): string`
- The content MUST be character-for-character identical to `ai-coach-prompt.ts`

**Step 0.2: Preserve Frontend as Fallback**
- `ai-coach-prompt.ts` remains in the frontend as a **fallback cache**
- No modifications to this file -- it continues to work exactly as before
- If the backend API is unreachable, the frontend uses this local copy

**Impact**: None -- no behavior changes to any route
**Rollback**: Delete the new backend file

### Phase 1: Add Prompt API (Low Risk)

**Step 1.1: Create Prompt API Endpoint**
- Add `GET /api/prompts/:role?locale=ja` endpoint to the backend router
- Auth: Required (Bearer token), aligned with architecture.md section 5.2
- Response format:
  ```json
  {
    "systemPrompt": "string",
    "role": "coach",
    "locale": "ja",
    "version": "string",
    "hash": "string"
  }
  ```
- For `role=coach`, returns the canonical prompt from `backend/src/prompts/roles/coach.ts`
- Does NOT include UserContext (that is injected server-side for OpenAI API calls)

**Step 1.2: Frontend Can Optionally Fetch**
- Frontend `role-prompts.ts` coach role's `getSystemPrompt` can optionally fetch from the backend API instead of the local `ai-coach-prompt.ts`
- Use SWR pattern: serve cached prompt immediately, revalidate in background
- Fallback chain: API response -> localStorage cache -> local `ai-coach-prompt.ts`

**Impact**: New API endpoint available; frontend behavior unchanged unless opted in
**Rollback**: Remove the API endpoint; frontend continues using local file

### Phase 2: Backend Uses Canonical Prompt (Medium Risk)

**Step 2.1: Refactor `VowCoachAgent.generateResponse()` to Use Canonical Prompt as Base**
- The backend's `generateSystemPrompt()` is restructured into layers:
  1. **Base**: Canonical coach prompt (from `backend/src/prompts/roles/coach.ts`)
  2. **Enhancement layer**: Hearing flow rules, category detection, emotional handling, communication style rules, debug mode, detailed JSON examples
  3. **Tool layer**: Tool instructions (route-dependent, only for routes with tool access)
  4. **User Context layer**: Dynamic personalization (UserContext injection)
- `VowCoachAgent.getSystemPrompt()` composes: Base + Enhancement + Tool + UserContext
- This makes the OpenAI API route use the **same base prompt** as the MCP route

**Step 2.2: Validate Response Quality**
- Run cross-route consistency tests (see Section 4.4)
- Monitor JSON compliance: Claude (MCP) vs OpenAI (API) may respond differently to the same prompt
- The canonical prompt's simpler JSON instructions should work well for both LLMs

**Impact**: OpenAI API route now shares the same base prompt as MCP route; enhanced features are layered on top
**Rollback**: Revert `generateSystemPrompt()` to its monolithic form

### Phase 3: Frontend Unification + MOC Agent Tab Fix (Medium Risk)

**Step 3.1: Unify Frontend Prompt Sources**
- `Section.Coach.tsx` and `Section.AIHub.tsx` use `getRoleSystemPrompt('coach', locale)` instead of inline 1-sentence prompts
- `role-prompts.ts` coach role fetches from backend API (with local `ai-coach-prompt.ts` as fallback)

**Step 3.2: Investigate and Fix MOC Agent Tab**
- The MOC section's Agent tab (`Section.MOC.tsx` lines 1445-1507) uses the `AgentListView` component
- This tab may not display correctly when the MCP server is not connected
- Investigation scope:
  - Verify `AgentListView` renders correctly in all MCP connection states
  - Test with MCP server connected and disconnected
  - Fix rendering issues if found
- Include in Manual QA Checklist

**Impact**: All frontend chat entry points use the unified prompt source; MOC Agent tab fixed if broken
**Rollback**: Revert `Section.Coach.tsx`, `Section.AIHub.tsx`, and `role-prompts.ts` changes

---

## 3. Risk Analysis

### 3.1 Prompt Unification Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **MCP responses become too long** (if backend enhancement layers are sent to MCP) | Medium | Medium | The canonical prompt (~6,000 chars) is sent to MCP, NOT the full 20,000-char backend prompt. Enhancement layers are backend-only. |
| **MCP server rejects large system prompt** | High | Low | The canonical prompt is only ~6,000 chars, same as current MCP prompt. No size increase for MCP route. |
| **Response quality regression** (prompts tuned for different LLMs) | **High** | **High** | The MCP route uses Claude (via CLI), while backend uses OpenAI. **Critical detail [I-008]**: OpenAI has `response_format: { type: "json_object" }` (JSON mode) which guarantees valid JSON output. Claude does not have an equivalent strict JSON mode. The backend prompt's heavy JSON examples were tuned for OpenAI's JSON mode. When that same prompt is used with Claude via MCP, Claude may produce markdown-wrapped JSON (e.g., triple-backtick json blocks) or occasionally produce non-JSON responses. The canonical prompt's simpler JSON instructions actually work better for Claude on the MCP route. This is a primary reason to use the frontend prompt as the canonical base. |
| **Behavioral change in OpenAI API responses** | Medium | Medium | The OpenAI API route currently uses a 20,000-char prompt. After refactoring, it uses the canonical 6,000-char base + enhancement layers. The enhancement layers must faithfully reproduce the current backend-only features. Thorough A/B testing is required. |
| **Tool prohibition conflict** | Medium | Low | The frontend prompt has strong "NEVER use tools" warnings because MCP agents have tool access; the backend prompt does not include these warnings since tools are managed server-side. The canonical prompt includes tool prohibition by default. For the OpenAI API route (where tools ARE available), the Tool layer overrides this with appropriate tool instructions. |

### 3.2 Backend-Specific Feature Loss Risks

| Feature | Current Behavior | Risk if Lost | Mitigation |
|---------|-----------------|--------------|------------|
| **UserContext injection** | Backend dynamically appends user stats, habits, goals, levels, anchor habits | Without it, prompt cannot personalize responses | User Context layer is always appended by the backend for OpenAI API route. MCP frontend route cannot access UserContext (requires auth + DB) -- this is an existing limitation, not a regression. |
| **Session management** | Backend uses DynamoDB-backed `SessionStore` for conversation history | MCP route manages sessions differently (client-side sessionId + MCP server memory) | Dual session tracking may cause state inconsistency; unify session model in a future phase. |
| **Quota tracking** | Backend tracks `quotaUsed` per session, enforces limits | ~~MCP route bypasses quota~~ **[I-012] UNVERIFIED**: The claim that MCP route returns hardcoded `quotaRemaining: 100` was NOT found in `useMcpChat.ts`. This needs investigation before acting on it. Current status: unknown whether MCP route has quota enforcement. |
| **Drilldown controller** | Backend has `DrilldownController` for clarifying vague queries | MCP route relies on prompt instructions only | Accept this difference or port drilldown logic to shared prompt |
| **Manager Mode** | Backend supports `[Manager Mode]` prefix for orchestration-focused responses | Not available in MCP route | Add manager mode support to MCP route or document as backend-only feature |

### 3.3 Security Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Prompt injection via frontend** | High | Medium | Currently the frontend sends `systemPrompt` in the POST body to MCP server (`useMcpChat.ts` line 298). A malicious user could modify this in browser DevTools. **Recommendation**: Move system prompt injection to backend/MCP server side, never trust client-sent prompts. **Note**: The backend-mediated MCP path (`useMastraAgent` -> Backend -> `callMcpChat()`) is NOT vulnerable -- the backend generates its own prompt at `agents.ts` line 1543 and ignores client-sent prompts. |
| **UserContext leakage** | Medium | Low | If prompts are served via unauthenticated endpoint, user-specific data (habit names, completion rates) could leak. **Mitigation**: Prompt API requires auth (Bearer token). Serve only base prompts (no UserContext) from the API. UserContext is injected server-side only. |
| **Prompt exfiltration** | Low | Medium | Users can see the system prompt in network requests (frontend sends it as `systemPrompt` field). This reveals the full prompt engineering. **Mitigation**: Accept this or move prompt injection server-side. |
| **Role escalation** | Medium | Low | If frontend can specify arbitrary roles, users might access prompts for roles they shouldn't (e.g., developer, architect). **Mitigation**: Validate role against user permissions on the backend. |

### 3.4 Architecture Decision: Where Should Prompts Live?

**Option A: Frontend-managed (Current MCP approach)**
- Pros: Simple, no backend dependency for MCP route
- Cons: Prompt in client bundle (visible), no userContext, prompt injection risk
- Security: Low (client can tamper with prompt)

**Option B: Backend-managed with API provision -- RECOMMENDED**
- Pros: Secure, userContext available, single source of truth, API endpoint for frontend retrieval
- Cons: Network dependency for prompt retrieval, latency on first load
- Security: High (server controls prompt content)
- Corresponds to architecture.md Option C (`GET /api/prompts/:role`)

**Option C: Hybrid (Backend serves prompt, frontend caches)**
- Pros: Performance + security balance
- Cons: Cache invalidation complexity, stale prompts possible
- Security: Medium (cached prompt could be tampered in memory)

**Recommendation**: Option B for all routes, with the canonical prompt (`ai-coach-prompt.ts` content) stored in the backend. The frontend retains `ai-coach-prompt.ts` as a fallback cache for when the backend API is unreachable. The API endpoint is `GET /api/prompts/:role?locale=ja`, consistent with architecture.md section 5.2.

### 3.5 Additional Risks (from cross-review)

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Backend EN/JA structural inconsistency** [I-005, I-009] | Medium | High | The backend EN version uses TypeScript interface notation for schemas while JA uses JSON examples. Both locale variants must be tested equally during migration. Flag as pre-existing issue to harmonize. |
| **`aboutOperation` enum language mismatch** [I-015] | Medium | High | Frontend EN prompt uses English enum values (`"review"`, `"new_proposal"`, etc.) but backend EN prompt uses Japanese enum values (`"見直し"`, `"新規提案"`, etc.) for the `aboutOperation` field. When prompts are unified, the backend's response parser may expect Japanese values and break on English values. Must harmonize before or during Phase 2. |
| **Cache invalidation race condition** [I-010] | Low | Medium | If a prompt is updated while cached copies exist across multiple frontend clients, different users may see different prompt behaviors. Mitigate with version-based cache invalidation (hash comparison). |
| **Dual MCP path ambiguity** [I-011] | Medium | Medium | There are two MCP paths: (1) Frontend direct via `useMcpChat`, (2) Backend mediated via `useMastraAgent` -> Backend -> `callMcpChat()`. Each migration phase must explicitly identify which path is being targeted. |

---

## 4. Test Plan

### 4.1 Unit Tests

| Test | Description | Files |
|------|-------------|-------|
| Canonical prompt integrity | Verify `getCanonicalCoachPrompt()` returns content identical to `ai-coach-prompt.ts` for both JA and EN | `backend/src/prompts/__tests__/coach.test.ts` |
| Prompt composition | Verify `generateSystemPrompt()` correctly composes Base + Enhancement + Tool + UserContext layers | `backend/src/agents/mastra/__tests__/vow-coach-agent.test.ts` |
| UserContext injection | Verify userContext appends correctly for various user states (new user, active user, high achiever) | Same |
| Role prompt resolution | Verify `getRoleSystemPrompt()` returns correct prompt for each role | `frontend/app/dashboard/constants/__tests__/role-prompts.test.ts` |
| Prompt API endpoint | Verify `GET /api/prompts/:role?locale=ja` returns correct prompt with auth | `backend/src/routers/__tests__/agents.test.ts` |

### 4.2 Integration Tests (MCP Route)

| Scenario | Expected Behavior | Verification |
|----------|-------------------|-------------|
| Basic greeting | JSON response with `message` + `replies` | Parse response as AICandidateResponse |
| Goal creation request | Category selection -> candidate presentation | Verify `candidateTypes.showGoals` transitions |
| Habit suggestion | Return Habit candidates with all required fields | Validate `habits[]` schema |
| Emotional input ("tired") | Empathy response in `message` | Check `message` contains empathy phrase |
| Ambiguous query | Reply buttons for clarification | Verify `replies[]` has `action: "custom"` |
| Candidate adjustment | "Make it easier" returns adjusted candidates | Compare difficulty levels |

### 4.3 Integration Tests (OpenAI API Route)

| Scenario | Expected Behavior | Verification |
|----------|-------------------|-------------|
| Same scenarios as MCP route | Identical JSON structure | Structural comparison |
| UserContext personalization | Prompt includes user stats | Log system prompt, verify userContext section |
| Session continuity | Multi-turn conversation maintains context | Send 3+ messages, verify context awareness |
| Quota enforcement | Free user blocked after limit | Verify 429 response after quota exhaustion |
| Manager Mode | `[Manager Mode]` prefix triggers orchestration prompt | Verify response structure differs |
| Hearing flow (enhanced) | Step-by-step category -> sub-category -> candidate | Verify full hearing flow works with layered prompt |

### 4.4 Cross-Route Consistency Tests

| Test | Description |
|------|-------------|
| Response format parity | Send identical messages to MCP and OpenAI routes, verify both return valid AICandidateResponse |
| Category detection parity | Send "I want to start exercising" to both routes, verify both detect "health" category |
| Emotional response parity | Send "I'm tired" to both routes, verify both show empathy |
| EN locale parity [I-013] | Send identical EN messages to both routes, verify both return valid AICandidateResponse in English |

### 4.5 Regression Tests

| Test | Description | Risk Addressed |
|------|-------------|----------------|
| MCP response time | Measure latency before/after -- must not increase by more than 500ms compared to current baseline with the 6K prompt [I-014] | Performance regression |
| Token usage | Compare token consumption before/after | Cost increase |
| Error handling | Verify error messages display correctly | Prompt format change breaking error handling |
| Tool prohibition | Verify MCP agent does not invoke tools | Tool prohibition must be preserved in canonical prompt |
| JSON compliance | Verify Claude (MCP) produces valid JSON without markdown wrapping | LLM-specific JSON mode differences |

### 4.6 Manual QA Checklist

- [ ] MCP chat: Basic greeting and JSON response
- [ ] MCP chat: Goal creation flow (category -> candidates)
- [ ] MCP chat: Emotional responses (tired, happy, frustrated)
- [ ] MCP chat: Casual conversation (greetings, weather)
- [ ] MCP chat: Goal-Habit linking (present goals first, then linked habits)
- [ ] MCP chat: EN locale produces valid responses
- [ ] OpenAI chat: Same scenarios as above, with enhanced features (hearing flow, category detection)
- [ ] CLI chat: Same scenarios as above
- [ ] Section.Coach: Verify improved responses with unified prompt
- [ ] Section.AIHub: Verify improved responses with unified prompt
- [ ] **MOC Agent tab**: Verify `AgentListView` component renders correctly with MCP server connected and disconnected
- [ ] Mobile browser: Verify prompt loading does not cause timeouts
- [ ] Free user: Verify rate limiting still works
- [ ] Admin user: Verify bypass works

---

## Appendix A: File Inventory

| File | Role | Action Required |
|------|------|-----------------|
| `frontend/app/dashboard/constants/ai-coach-prompt.ts` | MCP prompt source (canonical content) | **Preserve as frontend fallback cache**; canonical content copied to backend |
| `frontend/app/dashboard/constants/role-prompts.ts` | Role-based prompt registry (frontend) | Update coach role to fetch from backend API (with local fallback) |
| `backend/src/agents/mastra/vow-coach-agent.ts` (lines 225-1303) | Backend prompt source | Refactor to use canonical prompt as base + enhancement layers |
| `backend/src/prompts/roles/coach.ts` | **NEW**: Canonical coach prompt | Create with exact content from `ai-coach-prompt.ts` |
| `frontend/app/dashboard/hooks/useMcpChat.ts` | Sends systemPrompt to MCP server | Review: consider removing client-sent prompt in favor of backend-provided |
| `frontend/app/dashboard/hooks/useMastraAgent.ts` | Sends systemMessage to backend API | Review: ensure backend uses its own prompt |
| `backend/src/routers/agents.ts` | API handlers | Add `GET /api/prompts/:role?locale=ja` endpoint; ensure all routes use unified prompt |
| `frontend/app/dashboard/components/Section.Coach.tsx` (line 304) | Inline minimal prompt | Replace with `getRoleSystemPrompt('coach', locale)` |
| `frontend/app/dashboard/components/Section.AIHub.tsx` (line 555) | Inline minimal prompt | Replace with `getRoleSystemPrompt('coach', locale)` |
| `frontend/app/dashboard/components/Section.MOC.tsx` (line 283) | Uses `getRoleSystemPrompt` | No change needed (already correct pattern) |
| `frontend/app/dashboard/components/Section.MOC.tsx` (lines 1445-1507) | MOC Agent tab | **Investigate and fix** `AgentListView` rendering when MCP server is not connected |
| `frontend/app/dashboard/components/Agent.ListView.tsx` | Agent list display component | **Investigate and fix** if not working correctly; verify MCP connection state handling |

## Appendix B: Prompt Size Comparison

| Component | Frontend (MCP) | Backend (OpenAI) | Delta |
|-----------|---------------|-----------------|-------|
| Role definition | 2 lines | 5 lines | Backend richer |
| JSON format spec | ~100 lines | ~200 lines | Backend 2x more detailed |
| Candidate schemas | 4 types, basic (Sticky'n: name+description only) | 4 types + detailed fields + linking examples (Sticky'n: +completed, displayOrder, parentStickyId, depth, isReusable) | Backend much richer [I-004] |
| Conversation rules | 4 rules | ~15 rules + examples | Backend 4x more |
| Category mapping | None | 8 categories + keyword lists | Backend only |
| Emotional handling | None | Detailed empathy rules + examples | Backend only |
| Casual chat | None | 4 scenarios + principles | Backend only |
| UserContext | None | Dynamic (~30 lines at runtime) | Backend only |
| Tool prohibition | 3 sections, heavy emphasis | Not present (tools managed server-side) | Frontend only |
| "Set a goal" disambiguation | Present (lines 27-29) | Not present | Frontend only |
| Debug mode | None | "Candidate display test" command | Backend only |
| EN/JA structural consistency | Parallel structure (EN is direct translation of JA) | **Inconsistent** [I-005]: EN uses TypeScript interface notation, JA uses JSON examples | Frontend more consistent |
| **Total (JA)** | ~320 lines | ~1,080 lines + dynamic | 3.4x difference |

## Appendix C: Cross-Reference to Review Findings

This v2.0 addresses the following issues from `review-migration-plan.md`:

| Review ID | Status | Resolution |
|-----------|--------|------------|
| I-001 | Fixed | Mastra route prompt size corrected to "~37 chars (JA) / ~72 chars (EN)" |
| I-003 | Fixed | Tool prohibition moved from "Common Elements" to "Frontend-only Elements" |
| I-004 | Fixed | Frontend Sticky'n schema simplicity documented in Section 1.2 and Appendix B |
| I-005 | Fixed | Backend EN/JA structural inconsistency flagged in Section 1.2 and Risk 3.5 |
| I-007 | Fixed | "Strict superset" claim replaced with "near-superset" in Section 1.3 |
| I-008 | Fixed | LLM risk upgraded to High/High with JSON mode detail in Risk 3.1 row 3 |
| I-012 | Fixed | Quota claim marked as UNVERIFIED in Risk 3.2 row 3 |
| I-013 | Fixed | EN locale test scenario added to Section 4.4 |
| I-014 | Addressed | Concrete latency threshold (500ms) added to Section 4.5 |
| C-001 | Fixed | Option B in Section 3.4 now notes correspondence to architecture.md Option C |
| C-002 | Fixed | API endpoint standardized to `GET /api/prompts/:role?locale=ja` |
| S-003 | Addressed | Canonical prompt selection uses the frontend prompt, acknowledging its conciseness advantage |
