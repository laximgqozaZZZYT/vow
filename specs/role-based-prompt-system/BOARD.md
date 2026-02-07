# Role-Based Prompt System - Project Board

**Last Updated**: 2026-02-07
**Status**: Phase 2 In Progress

---

## 1. Project Overview

### Feature
Role-Based Prompt System for VOW (habit/goal tracker)

### Goal
Unify system prompts from "per-delivery-method" (MCP vs OpenAI) to "per-role" (coach, manager, etc.)

### Paradigm Shift
- **Canonical Base**: Frontend MCP prompt (`ai-coach-prompt.ts`, ~6,000 chars)
- **Enhancement Layers**: Backend's richer prompt (~20,000 chars) features become modular enhancements
- **Critical Requirement**: MUST preserve current MCP prompt content (user strongly prefers this prompt)

---

## 2. Investigation Findings

### Root Cause Discovered
"ゴールを設定したい" returns generic greeting on OpenAI path because:
- Backend uses different "マネージャーAI" prompt with 3-step hearing flow
- MCP path uses simpler "AIコーチ" prompt that directly responds with candidates

### Three Distinct Prompt Configurations Found

1. **Frontend MCP**: `ai-coach-prompt.ts` (~6,000 chars)
   - Role: AIコーチ
   - Behavior: Direct response with candidates

2. **Backend OpenAI**: `generateSystemPrompt()` (~20,000 chars)
   - Role: マネージャーAI
   - Behavior: 3-step hearing flow

3. **Inline**: `Section.Coach.tsx` / `Section.AIHub.tsx` (~37 chars)
   - Minimal prompt: "You are a helpful assistant"

### Four Code Paths Identified

1. MCP Direct (Section.MOC.tsx)
2. OpenAI API (Section.Coach.tsx inline Mastra)
3. CLI MCP fallback
4. Inline Mastra (Section.AIHub.tsx)

---

## 3. Spec Documents Created

| Document | Version | Status | Description |
|----------|---------|--------|-------------|
| `architecture.md` | v2.0 | Final | Architecture design with 4 options, Option C (backend storage + API) recommended |
| `migration-plan.md` | v2.0 | Final | 4-phase migration plan with risk analysis and test plan |
| `review-architecture.md` | v1.0 | Complete | Cross-review: 8 OK, 2 CRITICAL, 6 MEDIUM issues found in v1.0 |
| `review-migration-plan.md` | v1.0 | Complete | Cross-review: 18 OK, 15 ISSUE, 7 SUGGESTION |

---

## 4. Spec Revisions (v1.0 → v2.0)

### Critical Fixes Applied

1. **Wrong API endpoint name**
   - Fixed: `/api/agents/coach/chat` → `/api/prompts/:role`

2. **Phantom MCP fallback**
   - Removed non-existent MCP fallback in main chat handler

3. **Missing 4th prompt location**
   - Added: Section.Coach.tsx / Section.AIHub.tsx inline prompts

4. **Wrong line count**
   - Fixed: generateSystemPrompt 600 → 1,078 lines

### Paradigm Shift Applied

- Changed from "backend as base" to "frontend MCP prompt as canonical base"
- Backend features become enhancement layers

### Scope Additions

- Added MOC Agent tab investigation scope
- Added `aboutOperation` EN/JA mismatch risk note

### Standardization

- Aligned phase numbering between documents
- Standardized file naming (`coach.ts` not `coach-base.ts`)

---

## 5. Implementation Progress

### Phase 0: Preserve Canonical Prompt ✅ COMPLETE

**Goal**: Extract and preserve frontend MCP prompt as canonical source of truth

**Completed**:
- ✅ Created `backend/src/prompts/roles/coach.ts`
- ✅ Verified character-for-character identical content
  - JA: 3,457 chars
  - EN: 3,814 chars
- ✅ Frontend `ai-coach-prompt.ts` preserved as fallback cache

**Files**:
- `/home/ubuntu/Downloads/vow/backend/src/prompts/roles/coach.ts` (created)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/constants/ai-coach-prompt.ts` (preserved)

---

### Phase 1: Add Prompt API ✅ COMPLETE

**Goal**: Create backend API to serve canonical prompts

**Completed**:
- ✅ Created `backend/src/prompts/prompt-registry.ts`
  - PromptResponse type
  - getCanonicalPrompt() function
  - Hash computation (SHA-256)
  - Version tracking

- ✅ Created `backend/src/routers/prompts.ts`
  - GET `/api/prompts/:role?locale=ja`
  - Auth required (Bearer token)
  - ETag support
  - Cache-Control headers

- ✅ Registered in `backend/src/index.ts`
  - Route: `/api/prompts`
  - TypeScript compiles cleanly

**API Specification**:
```
GET /api/prompts/coach?locale=ja
Authorization: Bearer <token>
If-None-Match: <etag>

Response:
{
  "role": "coach",
  "locale": "ja",
  "content": "あなたはVOWユーザーの...",
  "version": "1.0.0",
  "hash": "abc123...",
  "metadata": { "source": "canonical" }
}
```

**Files**:
- `/home/ubuntu/Downloads/vow/backend/src/prompts/prompt-registry.ts` (created)
- `/home/ubuntu/Downloads/vow/backend/src/routers/prompts.ts` (created)
- `/home/ubuntu/Downloads/vow/backend/src/index.ts` (modified)

---

### Phase 2: Backend Refactoring 🔄 IN PROGRESS

**Goal**: Refactor `generateSystemPrompt()` into layered composition

**Current Status**: Implementation assigned to implementer agent (Opus)

**Target Structure**:
```typescript
function generateSystemPrompt(userId, locale) {
  const canonical = getCanonicalPrompt('coach', locale);
  const enhanced = applyEnhancements(canonical, [
    userContextLayer(userId),
    goalManagementLayer(),
    habitSystemLayer(),
    reflectionLayer(),
    // ... other enhancement layers
  ]);
  return enhanced;
}
```

**Enhancement Layers Being Extracted**:
- User context layer (user preferences, history)
- Goal management layer (3-step hearing flow)
- Habit system layer (VOW-specific mechanics)
- Reflection layer (retrospective features)
- Performance layer (efficiency guidelines)

**Files**:
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` (refactoring)
- `/home/ubuntu/Downloads/vow/backend/src/prompts/layers/` (to be created)

**Next Steps**:
1. Extract enhancement layers to separate files
2. Implement layer composition logic
3. Test backward compatibility
4. Update unit tests

---

### Phase 3a: Frontend Unification ✅ COMPLETE

**Goal**: Replace all frontend prompt sources with canonical prompt via `useRolePrompt` hook

**Completed**:
- ✅ Created `useRolePrompt` hook with SWR caching pattern
  - 3-tier fallback: API → localStorage cache → local `ai-coach-prompt.ts`
  - ETag-based conditional requests (If-None-Match)
  - 24-hour cache max age
- ✅ Integrated `useRolePrompt` into Section.MOC.tsx (replaced useMemo-based prompt)
- ✅ Replaced inline prompt in Section.Coach.tsx with `getRoleSystemPrompt('coach', locale)`
- ✅ Replaced inline prompt in Section.AIHub.tsx with `getRoleSystemPrompt('coach', locale)`
- ✅ Frontend TypeScript compiles cleanly (no errors in modified files)

**Files**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useRolePrompt.ts` (created)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (modified)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.Coach.tsx` (modified)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.AIHub.tsx` (modified)

---

### Phase 3b: MOC Agent Tab ✅ INVESTIGATION COMPLETE

**Goal**: Investigate MOC Agent tab behavior when MCP disconnected

**Findings**:
- Agent tab **DOES work** when MCP disconnected, but shows limited hardcoded view
- Built-in agents are hardcoded as TreeNodes in `Agent.ListView.tsx` (lines 322-417)
- `BUILTIN_AGENTS` object exists in `Modal.AgentDetail.tsx` but is **NOT used** in tree view
- `role-prompts.ts` has rich metadata (name, icon, description) also **NOT used** in tree
- Icon mismatch: Tree uses `🤖` for coach, but role-prompts.ts defines `🎯`
- Empty state message "MCPエージェント未接続" shows even when built-in agents ARE displayed

**Recommended Fix** (~30 lines in Agent.ListView.tsx):
1. Import BUILTIN_AGENTS from Modal.AgentDetail
2. Replace hardcoded TreeNodes with dynamic render from BUILTIN_AGENTS
3. Optionally use role-prompts.ts for i18n descriptions
4. Fix empty state condition

**Files**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Agent.ListView.tsx` (to modify)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Modal.AgentDetail.tsx` (data source)

---

## 6. Key Files Reference

### Backend Files

| File | Status | Line Count | Description |
|------|--------|-----------|-------------|
| `backend/src/prompts/roles/coach.ts` | ✅ Created | 172 | Canonical coach prompt (SoT) |
| `backend/src/prompts/prompt-registry.ts` | ✅ Created | 89 | Prompt registry with hash/version |
| `backend/src/routers/prompts.ts` | ✅ Created | 76 | GET /api/prompts/:role endpoint |
| `backend/src/index.ts` | ✅ Modified | - | Added prompts router registration |
| `backend/src/agents/mastra/vow-coach-agent.ts` | 🔄 Refactoring | 1,078 | generateSystemPrompt() being refactored |

### Frontend Files

| File | Status | Line Count | Description |
|------|--------|-----------|-------------|
| `frontend/app/dashboard/constants/ai-coach-prompt.ts` | ✅ Preserved | 172 | Frontend fallback cache |
| `frontend/app/dashboard/hooks/useRolePrompt.ts` | ✅ Created | 187 | SWR-pattern API prompt hook |
| `frontend/app/dashboard/components/Section.MOC.tsx` | ✅ Modified | - | useRolePrompt integration |
| `frontend/app/dashboard/components/Section.Coach.tsx` | ✅ Modified | - | Inline prompt → getRoleSystemPrompt |
| `frontend/app/dashboard/components/Section.AIHub.tsx` | ✅ Modified | - | Inline prompt → getRoleSystemPrompt |

---

## 7. Agents Working

| Agent | Model | Role | Current Task | Status |
|-------|-------|------|--------------|--------|
| Main | Opus | Coordinator | Overall orchestration, progress tracking | Active |
| Implementer | Opus | Backend Dev | Phase 2: generateSystemPrompt refactor | In Progress |
| Researcher | Sonnet | Investigation | Phase 3b: MOC Agent tab investigation | In Progress |
| Implementer | Sonnet | Documentation | BOARD.md creation | Active (this task) |

---

## 8. User Requirements (Critical)

### Must Preserve
- **Current MCP prompt content** (`ai-coach-prompt.ts`)
- User strongly prefers this prompt over backend version
- Character-for-character preservation verified ✅

### Acceptable
- Backend placement of canonical prompt
- API-based prompt delivery
- Enhancement layers as separate modules

### Desired
- MOC Agent tab fix (if possible)
- Unified prompt system across all code paths
- No regression in user experience

### Mandated Process
- **Spec-first development**
- No unauthorized code changes
- All changes reviewed against specs
- Cross-review process for critical changes

---

## 9. Risk Register

### High Risk (Mitigated)

1. **Prompt Content Loss**
   - Risk: Accidentally modifying canonical prompt
   - Mitigation: Character-for-character verification done ✅
   - Status: Mitigated

2. **Behavioral Regression**
   - Risk: OpenAI path behavior changes after refactor
   - Mitigation: Comprehensive test plan in migration-plan.md
   - Status: Test plan ready, execution pending

### Medium Risk (Monitoring)

1. **EN/JA Mismatch in aboutOperation**
   - Risk: English and Japanese sections may have different content
   - Mitigation: Added to review checklist
   - Status: Documented in specs

2. **MCP Fallback Complexity**
   - Risk: Multiple fallback paths create confusion
   - Mitigation: Clear priority order defined in architecture
   - Status: Documented, implementation pending

### Low Risk

1. **API Performance**
   - Risk: Extra API call on prompt fetch
   - Mitigation: ETag caching, frontend fallback
   - Status: Architecture includes caching

---

## 10. Next Actions

### Immediate (This Sprint)

1. **Phase 2 Implementation** (Implementer Agent - Opus)
   - Extract enhancement layers from generateSystemPrompt()
   - Implement layer composition logic
   - Create unit tests

2. **Phase 3b Investigation** (Researcher Agent - Sonnet)
   - Complete MOC Agent tab investigation
   - Document findings
   - Propose fix if feasible

### Short Term (Next Sprint)

1. **Phase 3a Frontend** (To assign)
   - Create useRolePrompt hook
   - Update all frontend components
   - Integration testing

2. **Testing & Validation** (Tester Agent - Haiku)
   - Execute test plan from migration-plan.md
   - Verify no behavioral regression
   - Performance benchmarking

### Long Term (Future)

1. **Additional Roles** (To plan)
   - Manager role prompt
   - Analyst role prompt
   - Role switching UI

2. **Enhancement Layers** (To plan)
   - User preference layer
   - Context-aware enhancements
   - A/B testing framework

---

## 11. Success Criteria

### Phase Completion

- ✅ Phase 0: Canonical prompt preserved with verification
- ✅ Phase 1: API functional, TypeScript compiles, auth works
- 🔄 Phase 2: All tests pass, no behavioral regression
- ⏳ Phase 3a: All frontend paths use unified prompt
- ⏳ Phase 3b: MOC Agent tab investigation complete

### Overall Project

- [ ] Single source of truth for all prompts
- [ ] No regression in user experience
- [ ] MCP prompt content preserved exactly
- [ ] All four code paths unified
- [ ] Documentation complete
- [ ] Specs match implementation

---

## 12. Lessons Learned

### Investigation Phase

1. **Multiple prompt sources are confusing**
   - Finding: 3 distinct prompts, 4 code paths
   - Lesson: Always audit all code paths early

2. **Review process catches critical issues**
   - Finding: v1.0 specs had 2 CRITICAL issues
   - Lesson: Cross-review is essential

### Implementation Phase

1. **Character-level verification prevents subtle bugs**
   - Finding: Exact match verification caught potential encoding issues
   - Lesson: Use hash comparison for content integrity

2. **Spec revisions are normal and valuable**
   - Finding: v2.0 specs significantly better than v1.0
   - Lesson: Iterate on specs before mass implementation

---

## 13. References

### Specification Documents
- `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md` (v2.0)
- `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/migration-plan.md` (v2.0)
- `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/review-architecture.md` (v1.0)
- `/home/ubuntu/Downloads/vow/specs/role-based-prompt-system/review-migration-plan.md` (v1.0)

### Implementation Files
- All files listed in Section 6 "Key Files Reference"

### Related Documentation
- VOW project README (if exists)
- MCP protocol documentation
- Mastra agent framework docs

---

**Document Maintenance**:
- Update this board after each phase completion
- Add new risks as discovered
- Track agent assignments and progress
- Record lessons learned continuously
