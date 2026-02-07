# Review: architecture.md Cross-Check

**Reviewer**: Plan Agent (Opus)
**Review Date**: 2026-02-07
**Target Document**: `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md` v1.0.0
**Cross-reference**: `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/migration-plan.md` v1.0

---

## 1. Current State Analysis Accuracy (Section 1)

### 1.1 File Paths and Sizes

**OK**: `frontend/app/dashboard/constants/ai-coach-prompt.ts` -- file exists at the documented path. Actual size is 10,204 bytes (~10KB), consistent with "~10KB" stated in the table.

**OK**: `frontend/app/dashboard/constants/role-prompts.ts` -- file exists. Actual size is 14,502 bytes (~15KB), consistent with "~15KB".

**OK**: `backend/src/agents/mastra/vow-coach-agent.ts` -- file exists. Actual size is 121,877 bytes (~122KB), consistent with "~120KB".

**OK**: `generateSystemPrompt()` starts at line 225 of `vow-coach-agent.ts`, confirmed.

**OK**: `getManagerSystemPrompt()` exists as a private method at line 2670 of `vow-coach-agent.ts`, confirmed.

### 1.2 Code Path Diagram (Section 1.2)

**ISSUE [CRITICAL]**: The architecture document states `POST /api/agents/coach/chat` at line 48. The actual endpoint is `POST /api/agents/chat` (backend/src/routers/agents.ts:331). The `agentsRouter` registers the path as `/chat`, and the router is mounted under `/api/agents`, yielding `/api/agents/chat`. This error appears multiple times:
- Line 48 of architecture.md
- Line 95 of architecture.md (Section 1.3, Route B)
- Line 487-488 of architecture.md (Section 5.3, recommended data flow)

**ISSUE [MEDIUM]**: In Section 1.2 (line 34), the architecture describes the flow as:
```
const aiCoachSystemPrompt = getRoleSystemPrompt('coach', locale);
     ^ role-prompts.ts -> ai-coach-prompt.ts -> getAICoachSystemPrompt()
```
The actual code at Section.MOC.tsx line 282-288 uses `useMemo(() => { const prompt = getRoleSystemPrompt('coach', locale); ... return prompt; }, [locale])`. While semantically equivalent, the architecture does not mention the `useMemo` wrapper. This is a minor accuracy issue.

**OK**: Line 41 states `/* systemMessageは渡されない */` for `useMastraAgent`. This is confirmed correct. At Section.MOC.tsx line 217-221, `useMastraAgent` is called with `{ authToken, enableStreaming: false, userId }` -- no `systemMessage` is passed. Furthermore, `useMastraAgent` (useMastraAgent.ts line 530-535) sends `{ message, sessionId, locale, streaming }` in its POST body without any systemPrompt.

**OK**: Line 57 states `systemPrompt` is included in the MCP request body. Confirmed at useMcpChat.ts line 297-301 where `requestBody = { message, sessionId, systemPrompt: systemMessage, userId }`.

### 1.3 Route Details

**ISSUE [CRITICAL]**: The architecture describes "Route C: Backend MCP fallback" (Section 1.3, lines 118-137), implying that the `/api/agents/chat` (called from `useMastraAgent`) has an MCP fallback path. This is INCORRECT. Looking at `agents.ts` lines 330-498, the `/chat` handler directly calls `VowCoachAgent.processMessage()` with NO MCP logic. The MCP fallback path exists ONLY in the `/api/agents/cli/chat` handler (agents.ts lines 1502-1616). The architecture conflates the CLI endpoint with the main chat endpoint.

**ISSUE [MEDIUM]**: In Route B (lines 89-110), the architecture describes "OpenAI API直接経路" as `VowCoachAgent.generateResponse()` -> `this.getSystemPrompt(locale)`. The actual call chain is:
1. `agents.ts` handler calls `coachAgent.processMessage(body.message, executionContext)` (line 461)
2. `processMessage()` calls `this.generateResponse(message, session, context)` (vow-coach-agent.ts line 2274)
3. `generateResponse()` calls `this.getSystemPrompt(context.locale, userContext)` (vow-coach-agent.ts line 2335)

The architecture is correct about the end result but skips the `processMessage` intermediate step.

### 1.4 Core Problem Statement

**OK**: The four core problems (prompt duplication, content mismatch, management dispersion, conflation of means/roles) are accurately stated. The frontend coach prompt (~6,000 chars) is indeed simpler than the backend prompt (~20,000 chars with hearing flow, emotional handling, category detection, etc.).

**ISSUE [MINOR]**: Section 1.4 says "manager role prompt exists in both frontend (role-prompts.ts) and backend (getManagerSystemPrompt())". This is accurate but understates the difference. The frontend manager prompt (role-prompts.ts lines 91-128) is a simple ~40-line instruction about task coordination. The backend manager prompt (vow-coach-agent.ts line 2670+) is also relatively short but serves a completely different purpose (orchestration mode within the coach agent). They are not really duplicates -- they serve different roles.

### 1.5 generateSystemPrompt Size

**ISSUE [MINOR]**: The architecture document at Section 8 (line 602) states "generateSystemPrompt() は約600行のプロンプト文字列を含む大規模関数である". The actual function spans from line 225 to line 1303, which is approximately 1,078 lines. This is significantly larger than the stated "about 600 lines."

## 2. Missing Paths and Files

**ISSUE [MEDIUM]**: The architecture does NOT mention `Section.Coach.tsx` and `Section.AIHub.tsx`, which are additional consumers of `useMastraAgent` with inline system prompts. These components use trivially simple 1-sentence system prompts:
- `Section.Coach.tsx` line 304-306: `'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'`
- `Section.AIHub.tsx` line 555-557: Same prompt.

The `migration-plan.md` correctly identifies these files (Appendix A, lines 276-277), but the architecture.md completely omits them. This is a significant gap because these represent a THIRD distinct prompt pattern (inline minimal prompt) not covered by the architecture's analysis.

**ISSUE [MINOR]**: The architecture does not mention the `/api/agents/cli/chat` endpoint (agents.ts line 1481) which is the ONLY backend endpoint that has MCP fallback logic. This is the endpoint where `generateCoachSystemPrompt(locale)` is used server-side for MCP calls (line 1543). This endpoint is relevant because it demonstrates a pattern where the backend generates the system prompt and sends it to MCP -- which is exactly what the recommended architecture (Option C) proposes for the frontend path.

**SUGGESTION**: The architecture should mention the CLI chat endpoint as an existing proof-of-concept for the recommended approach, since it already implements "backend as prompt source for MCP."

## 3. Design Options Fairness (Section 3)

**OK**: The four options (A/B/C/D) are clearly described with distinct trade-offs.

**ISSUE [MEDIUM - BIAS]**: Option A and Option D are evaluated with almost identical demerits (security, prompt injection, frontend holding backend info). However, there is a meaningful distinction:
- Option A sends the EXISTING frontend prompt (~6,000 chars) to the backend
- Option D requires PORTING the backend prompt (~20,000 chars) to the frontend first, then sending it

This difference in implementation complexity is understated. Option D's "implementation cost = good (o)" rating in the comparison matrix (Section 4) is questionable -- it should arguably be rated the same or worse than Option B due to the prompt porting effort.

**ISSUE [MINOR - BIAS]**: Option C's "MCP route latency" is rated "x" (problematic), but the architecture later provides detailed mitigation strategies (SWR, localStorage cache, hash-based validation) in Section 5.5. The rating should arguably be "o" after mitigation, or the other options should also show post-mitigation ratings.

**SUGGESTION**: The comparison matrix should add a row for "prompt consistency guarantee" -- Option B and C provide stronger consistency than A and D because they avoid sending prompts over the network where they could be tampered or cached stale.

## 4. Recommended Option C Validity (Section 5)

**OK**: The recommendation of Option C (backend as prompt source + API) is well-reasoned and defensible. The five reasons given (security + SoT, personalization, tool consistency, reasonable implementation cost, architectural fit) are logical.

**ISSUE [MEDIUM]**: The recommendation overlooks a significant counter-argument for Option A (or a simplified hybrid). The current system ALREADY works with `useMcpChat` sending `systemPrompt` from frontend to MCP. Option C introduces a new API dependency for a path that currently works independently. If the backend API goes down, MCP chat would fail too (acknowledged in the demerits, mitigated by cache, but still a regression in availability).

**SUGGESTION**: Consider a hybrid approach that the architecture does not explore: keep the frontend prompt for MCP (as a cached fallback) but add a synchronization mechanism where the backend publishes the canonical prompt and the frontend periodically syncs. This would combine Option A's resilience with Option C's consistency, without requiring a blocking API call for MCP chat initialization.

**ISSUE [MINOR]**: Section 5.2 proposes a `GET /api/prompts/:role` endpoint, but the recommended prompt does NOT include tool instructions or UserContext for the MCP path. This means MCP route users get a less personalized experience than OpenAI route users. The architecture acknowledges this implicitly ("ツール指示は利用手段ごとに異なるため、API応答には含めない") but does not discuss whether UserContext should be included in the API response. The migration-plan.md (Section 2, Phase 1, Step 1.1) explicitly notes "The frontend cannot access userContext (requires auth + DB queries), so the MCP route will use the base prompt only." This represents a deliberate feature gap between routes.

## 5. Migration Strategy Feasibility (Section 6)

**OK**: The 4-phase approach (backend prompt restructuring -> API addition -> frontend switch -> cleanup) is logical and incremental.

**ISSUE [MEDIUM]**: Phase 1 says "影響範囲: バックエンドのみ、外部API変更なし" but restructuring a 1,078-line function into layered modules is non-trivial. The architecture underestimates the complexity of separating the interleaved Japanese and English prompt text, dynamic UserContext injection, and locale-dependent formatting into clean layers.

**ISSUE [MINOR]**: Phase 3 says "ai-coach-prompt.ts をフォールバック専用として残す or 削除". This should be a firm decision, not left ambiguous. Given the acceptance criteria AC-005 ("backend API down でも cached prompt で MCP chat が利用可能"), keeping a minimal fallback prompt in the frontend is necessary. This should be explicitly stated.

**SUGGESTION**: Add a Phase 0.5 between Phase 1 and 2: write comprehensive tests for `generateSystemPrompt()` output BEFORE restructuring. This ensures the restructuring does not alter prompt content. The architecture mentions "テストの整備" only in Phase 4, which is too late.

## 6. Conflicts with migration-plan.md

**CONFLICT [CRITICAL]**: Endpoint naming inconsistency.
- architecture.md: Uses `POST /api/agents/coach/chat` throughout
- migration-plan.md: Uses `POST /api/agents/cli/chat` (line 109, correctly) and references the same backend handler
- Actual code: Main chat is `POST /api/agents/chat`; CLI chat is `POST /api/agents/cli/chat`
- Neither document uses the correct endpoint name for the main chat path.

**CONFLICT [MEDIUM]**: Phase numbering and scope mismatch.
- architecture.md defines 4 phases: Phase 1 (backend restructure) -> Phase 2 (API) -> Phase 3 (frontend switch) -> Phase 4 (cleanup)
- migration-plan.md defines 4 phases: Phase 0 (prep) -> Phase 1 (MCP route unification) -> Phase 2 (DB/config source) -> Phase 3 (registry)
- These are not aligned. migration-plan.md includes a "Phase 2: Move Prompt to Database/Config" step that the architecture.md does NOT mention at all. Conversely, architecture.md's Phase 3 (frontend useRolePrompt hook) has no direct equivalent in migration-plan.md.

**CONFLICT [MEDIUM]**: Prompt endpoint path.
- architecture.md: `GET /api/prompts/:role` (line 296, 428, 445)
- migration-plan.md: `GET /api/agents/system-prompt?role=coach&locale=ja` (line 89)
- These are different API designs. One uses path parameters, the other uses query parameters.

**CONFLICT [MINOR]**: Option naming mismatch.
- architecture.md Section 3: Options A/B/C/D (four options, C recommended)
- migration-plan.md Section 3.4: Options A/B/C (three options, B recommended which is "backend-managed")
- architecture.md's Option C maps to migration-plan.md's Option B, but migration-plan.md's Option C ("Hybrid") is a distinct concept not present in architecture.md.

**CONFLICT [MINOR]**: vow-coach-agent.ts line range.
- migration-plan.md Appendix A: "lines 225-1303"
- architecture.md Section 8: "約600行のプロンプト文字列"
- Actual: line 225-1303 = 1,078 lines
- migration-plan.md has the correct line range; architecture.md's "600 lines" estimate is wrong.

**CONFLICT [MINOR]**: migration-plan.md Section 1.1 identifies THREE prompt configurations (MCP frontend, OpenAI backend, Mastra inline), while architecture.md Section 1.1 only identifies TWO (MCP frontend, OpenAI backend). The Mastra inline prompt in Section.Coach.tsx/Section.AIHub.tsx is missing from architecture.md.

## Summary

| Category | Count |
|----------|-------|
| OK (accurate) | 8 |
| ISSUE (CRITICAL) | 2 |
| ISSUE (MEDIUM) | 6 |
| ISSUE (MINOR) | 5 |
| SUGGESTION | 3 |
| CONFLICT (CRITICAL) | 1 |
| CONFLICT (MEDIUM) | 3 |
| CONFLICT (MINOR) | 3 |

The most critical issues are:
1. **Wrong API endpoint name** (`/api/agents/coach/chat` should be `/api/agents/chat`) -- this error propagates through multiple diagrams
2. **Phantom MCP fallback in main chat handler** -- the architecture incorrectly describes an MCP fallback path in the main `/api/agents/chat` endpoint; this path only exists in `/api/agents/cli/chat`
3. **Phase structure mismatch** between architecture.md and migration-plan.md -- they describe different migration paths and phase scopes

### Critical Files for Implementation
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` - Core prompt source (generateSystemPrompt at line 225-1303, 1,078 lines to restructure)
- `/home/ubuntu/Downloads/vow/backend/src/routers/agents.ts` - API handlers; actual endpoint is `/chat` not `/coach/chat`; MCP fallback only in `/cli/chat`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` - Primary consumer of both useMcpChat and useMastraAgent hooks
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/constants/role-prompts.ts` - Frontend role registry; coachRole delegates to ai-coach-prompt.ts
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` - Sends systemPrompt in POST body (line 300); key integration point for Option C
