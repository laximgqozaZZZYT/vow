# ISS-20260204-030: Implementation Tasks

## Overview
- **Purpose**: Task breakdown for fixing the multiple habit candidate display issue
- **Status**: Implementation Complete (Pending Manual Verification)
- **Version**: 1.0.1
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task List

### Phase 1: System Prompt Enhancement (Backend)

#### Task 1.1: Add show_choice_buttons Loop Prohibition
- **Status**: [ ] TODO
- **Assignable to**: implementer
- **Priority**: P0 (Critical)
- **Estimated Time**: 30 minutes
- **File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
- **Location**: After line 518 in `generateSystemPrompt()` function

**Description**:
Add explicit prohibition against using `show_choice_buttons` in a loop pattern after category selection.

**Implementation**:
1. Locate `generateSystemPrompt()` function (line 225)
2. Find the section about category selection rules (around line 497-519)
3. Add new section after line 519 with the prohibition rules

**Code to Add** (Japanese version):
```markdown
### 禁止パターン: show_choice_buttons ループ（最重要・絶対禁止）

**⛔ 以下のパターンは絶対に禁止:**

カテゴリ選択後に `show_choice_buttons` を使って段階的な質問をすることは禁止です。

**❌ 禁止されるフロー（やってはいけない）:**
1. カテゴリ選択 → show_choice_buttons(「プログラミング」「読書」「資格勉強」を表示)
2. サブカテゴリ選択 → show_choice_buttons(「30分」「1時間」を表示)
3. 時間選択 → show_choice_buttons(「朝」「夜」を表示)

**✅ 正しいフロー（必須）:**
1. カテゴリ選択 → **suggest_habits**(category: "...", count: 3)
   - AIが最適な習慣候補を3つ以上提案
   - 各候補には名前、説明、頻度、所要時間がすべて含まれる
   - followUpActionsで「もっと具体的に」「もっとやさしく」などの調整ボタンを表示

**理由:**
- ユーザーは完成された習慣候補を比較検討したい
- 段階的な質問は時間がかかりUXを低下させる
- AIがコンテキストを考慮して最適な候補を提案するのが本来の役割

**判定基準:**
- 会話が「習慣を追加したい」「新しい習慣」で始まっている場合
- カテゴリ（健康、学習など）が選択された直後
→ **必ず suggest_habits を呼び出す。show_choice_buttons は禁止。**
```

**Acceptance Criteria**:
- [ ] System prompt includes explicit prohibition of `show_choice_buttons` loop
- [ ] Prompt explains the correct flow (category -> suggest_habits)
- [ ] Examples clearly show what is forbidden and what is required

---

#### Task 1.2: Add English Version of Prohibition
- **Status**: [ ] TODO
- **Assignable to**: implementer
- **Priority**: P0 (Critical)
- **Estimated Time**: 20 minutes
- **File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`
- **Prerequisite**: Task 1.1

**Description**:
Add the same prohibition rules in English for the English locale version of the system prompt.

**Code to Add** (English version):
```markdown
### Prohibited Pattern: show_choice_buttons Loop (CRITICAL - ABSOLUTELY FORBIDDEN)

**FORBIDDEN - The following pattern is absolutely prohibited:**

Using `show_choice_buttons` for step-by-step questions after category selection is FORBIDDEN.

**WRONG Flow (DO NOT DO THIS):**
1. Category selected -> show_choice_buttons("Programming", "Reading", "Certification")
2. Sub-category selected -> show_choice_buttons("30 min", "1 hour")
3. Duration selected -> show_choice_buttons("Morning", "Evening")

**CORRECT Flow (REQUIRED):**
1. Category selected -> **suggest_habits**(category: "...", count: 3)
   - AI proposes 3+ optimal habit candidates
   - Each includes name, description, frequency, estimated time
   - followUpActions provide "More specific", "Easier", "Harder" adjustment buttons

**Reason:**
- Users want to compare complete habit proposals
- Step-by-step questions waste time and hurt UX
- AI should propose optimal candidates considering user context

**Rule:**
- When conversation starts with "add habit" or "new habit"
- Immediately after category (health, learning, etc.) is selected
-> **MUST call suggest_habits. show_choice_buttons is FORBIDDEN.**
```

**Acceptance Criteria**:
- [ ] English version of system prompt includes the same prohibition
- [ ] Consistent with Japanese version

---

### Phase 2: Verification and Testing

#### Task 2.1: Manual Verification - Habit Addition Flow
- **Status**: [ ] TODO
- **Assignable to**: tester
- **Priority**: P0 (Critical)
- **Estimated Time**: 30 minutes
- **Prerequisite**: Tasks 1.1, 1.2

**Description**:
Manually test the habit addition flow to verify the fix works correctly.

**Test Steps**:
1. Start a new chat session
2. Send message: "新しい習慣を追加したい"
3. Verify: Category selection buttons appear (show_category_selection)
4. Click: "学習・スキル" button
5. **Verify Critical**: Multiple habit suggestions appear (NOT sub-category buttons)
   - Should see 3+ habit cards with names like "Daily Reading", "Programming Practice", etc.
   - Each card should have blue styling (habit type)
   - Follow-up buttons should appear: "もっと具体的に", "もっとやさしく", etc.
6. Click a habit suggestion
7. Verify: HabitModal opens with pre-filled name and description

**Expected Results**:
- [ ] After category selection, `suggest_habits` tool is called (check console/network)
- [ ] Multiple habit suggestions are displayed (3+)
- [ ] Each suggestion has `suggestionType: 'habit'`
- [ ] Suggestions have blue styling
- [ ] Follow-up action buttons are displayed
- [ ] Clicking suggestion opens HabitModal

---

#### Task 2.2: Non-Regression Test - Drilldown Flow
- **Status**: [ ] TODO
- **Assignable to**: tester
- **Priority**: P1 (High)
- **Estimated Time**: 20 minutes
- **Prerequisite**: Tasks 1.1, 1.2

**Description**:
Verify that drilldown flow for ambiguous queries still works correctly.

**Test Steps**:
1. Start a new chat session
2. Send ambiguous message: "何かおすすめある？" or "おすすめを教えて"
3. Verify: Drilldown flow starts (genre selection)
4. Select a genre
5. Verify: Purpose selection appears
6. Continue through drilldown flow

**Expected Results**:
- [ ] Ambiguous queries still trigger drilldown flow
- [ ] Drilldown flow works as expected
- [ ] Only ambiguous queries use drilldown (not habit/goal specific requests)

---

#### Task 2.3: Build and Deploy Verification
- **Status**: [ ] TODO
- **Assignable to**: implementer
- **Priority**: P1 (High)
- **Estimated Time**: 15 minutes
- **Prerequisite**: Tasks 2.1, 2.2

**Description**:
Build the backend and verify no compilation errors.

**Steps**:
```bash
cd /home/ubuntu/Downloads/vow/backend
npm run build
```

**Expected Results**:
- [ ] Build completes without errors
- [ ] No TypeScript compilation warnings related to changes

---

### Phase 3: Documentation Update

#### Task 3.1: Update COORDINATION.md
- **Status**: [ ] TODO
- **Assignable to**: vow-spec-architect
- **Priority**: P2 (Medium)
- **Estimated Time**: 10 minutes
- **Prerequisite**: Tasks 2.1, 2.2, 2.3

**Description**:
Update the coordination file to reflect the completed fix.

**File**: `/home/ubuntu/Downloads/vow/specs/COORDINATION.md`

**Update Required**:
- Mark ISS-20260204-030 as complete
- Add summary of changes made

---

## Progress Tracking

| Task ID | Status | Assignee | Started | Completed |
|---------|--------|----------|---------|-----------|
| 1.1 | DONE | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| 1.2 | DONE | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| 2.1 | PENDING VERIFICATION | tester | - | - |
| 2.2 | PENDING VERIFICATION | tester | - | - |
| 2.3 | DONE | vow-spec-architect | 2026-02-04 | 2026-02-04 |
| 3.1 | DONE | vow-spec-architect | 2026-02-04 | 2026-02-04 |

## Notes for Other Agents

### Important Context
- This issue is related to ISS-20260204-031 (Goal/Habit button type fix) but has a different root cause
- The problem is in the AI's decision-making after category selection, not in button rendering
- The fix is entirely in the system prompt - no code changes to tools or frontend

### Testing Commands
```bash
# Build backend
cd /home/ubuntu/Downloads/vow/backend && npm run build

# Start development server (if needed)
cd /home/ubuntu/Downloads/vow/backend && npm run dev
```

### Key Files to Review
- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` (lines 220-520)
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts` (suggest_habits implementation)
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (parseSuggestions function)
