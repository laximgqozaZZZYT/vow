# ISS-20260204-019: Implementation Tasks

## Task Overview

| Task | Status | Assignee | Prerequisite |
|------|--------|----------|--------------|
| Task 1: Fix goal-planner-agent.ts | Complete | vow-spec-architect | None |
| Task 2: Fix agents.ts /chat endpoint | Complete | vow-spec-architect | None |
| Task 3: Fix agents.ts /multi-chat endpoint | Complete | vow-spec-architect | None |
| Task 4: Fix agents.ts /coach/legacy endpoint | Complete | vow-spec-architect | None |
| Task 5: Fix manager-agent.ts | Complete | vow-spec-architect | None |
| Task 6: Integration Test | Pending | - | Tasks 1-5 |

## Completed Tasks

### Task 1: Fix goal-planner-agent.ts

**File**: `/backend/src/agents/mastra/agents/goal-planner-agent.ts`

**Changes**:
- Added `existingGoalNames` to `suggestGoalsTool` inputSchema
- Implemented filtering logic to exclude suggestions matching existing goals
- Added more suggestion templates to ensure variety when existing goals are filtered
- Added `existingGoalsConsidered` to output for transparency

### Task 2: Fix agents.ts /chat endpoint

**File**: `/backend/src/routers/agents.ts` (around line 276)

**Changes**:
- Added import for `PersonalizationEngine`
- Get `userContext` via `personalizationEngine.analyzeUserContext(userId)`
- Pass `userContext` to `CoachExecutionContext`

### Task 3: Fix agents.ts /multi-chat endpoint

**File**: `/backend/src/routers/agents.ts` (around line 440)

**Changes**:
- Get `userContext` via `personalizationEngine.analyzeUserContext(userId)`
- Pass `existingGoalNames` and `existingHabitNames` to `getMultiAgentResponse` (both SSE and JSON)

### Task 4: Fix agents.ts /coach/legacy endpoint

**File**: `/backend/src/routers/agents.ts` (around line 1370)

**Changes**:
- Get `userContext` via `personalizationEngine.analyzeUserContext(userId)`
- Pass `userContext` to `CoachExecutionContext`

### Task 5: Fix manager-agent.ts

**File**: `/backend/src/agents/mastra/agents/manager-agent.ts`

**Changes**:
- Added `existingGoalNames` and `existingHabitNames` options to `getMultiAgentResponse`
- Include existing goals/habits info in agent query context
- Add instruction to avoid duplicate suggestions

---

## Task 6: Integration Test (Pending)

### Description
Run integration tests to verify the fix.

### Test Scenarios
1. User with existing goals requests new goal suggestions
2. Verify that suggested goals do not match existing goal names
3. Verify that AI prompt includes existing goal names
4. Verify that both `/chat` and `/multi-chat` endpoints work correctly

### Test Commands
```bash
# Build the backend
cd /home/ubuntu/Downloads/vow/backend && npm run build

# Run related tests if available
cd /home/ubuntu/Downloads/vow/backend && npm test -- --grep "goal" --passWithNoTests
```

### Expected Results
- [ ] No build errors in modified files
- [ ] Goal suggestions exclude existing goals
- [ ] userContext.existingGoalNames is populated from DB
- [ ] AICoachService correctly references existing goals

## Files Modified

1. `/home/ubuntu/Downloads/vow/backend/src/routers/agents.ts`
   - Import PersonalizationEngine
   - Add userContext to /chat endpoint
   - Add userContext to /multi-chat endpoint (SSE and JSON)
   - Add userContext to /coach/legacy endpoint

2. `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/goal-planner-agent.ts`
   - Add existingGoalNames input parameter
   - Filter suggestions based on existing goals
   - Add more suggestion templates

3. `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/agents/manager-agent.ts`
   - Add existingGoalNames and existingHabitNames options
   - Include existing goals/habits in agent context

## Architecture Overview

```
User Request
     |
     v
+--------------------+
| agents.ts Router   |
+--------------------+
     |
     | 1. Get userContext via PersonalizationEngine
     |    (includes existingGoalNames from DB)
     v
+--------------------+
| VowCoachAgent or   |
| getMultiAgentResponse|
+--------------------+
     |
     | 2. Pass userContext/existingGoalNames
     v
+--------------------+
| coach-tools.ts     |  <- Uses userContext.existingGoalNames in AI prompt
| (suggestGoalsExecute)|
+--------------------+
     |
     | OR
     v
+--------------------+
| goal-planner-agent |  <- Filters suggestions based on existingGoalNames input
| (suggestGoalsTool) |
+--------------------+
```
