# ISS-20260204-031: Implementation Tasks

## Task List

### Task 1: Enhance System Prompt for Quick Action Context

**Status**: Pending
**Assignee**: Any agent
**Estimated Time**: 30 minutes
**Prerequisites**: None

**Description**:
Add new section to system prompt in `/backend/src/agents/mastra/vow-coach-agent.ts` to:
1. Detect quick action intent (Goal vs Habit)
2. Enforce direct path after category selection
3. Limit drilldown mode scope

**Implementation**:

Add the following after line ~280 (after the tool call rules table):

```markdown
## Quick Action Context Detection (CRITICAL - DO NOT SKIP)

ユーザーがクイックアクションボタンからメッセージを送信した場合、意図を正確に認識してください：

| クイックアクションのコマンド | 意図 | カテゴリ選択後に呼ぶツール |
|---------------------------|------|--------------------------|
| 「ゴールを設定したい」「I want to set a goal」 | GOAL意図 | **suggest_goals** |
| 「新しい習慣を追加したい」「I want to add a new habit」 | HABIT意図 | **suggest_habits** |

### 🚨 最重要ルール: GOAL/HABIT意図が明確な場合

**会話がGoalまたはHabitの意図で始まった場合**:
1. 最初のメッセージ → show_category_selection（goal_categoryまたはhabit_category）
2. **カテゴリ選択後 → 即座にsuggest_goalsまたはsuggest_habitsを呼ぶ**
3. **❌ 絶対禁止**: drilldownツール（drilldown_analysis, genre_quick_replies, purpose_quick_replies, response_type_quick_replies）を使用すること

### Drilldownモードを使用するケース（これらのみ）

以下の**曖昧で意図が不明な**クエリにのみdrilldownツールを使用：
- 「何かおすすめ？」「おすすめを教えて」（意図不明）
- 「自分を変えたい」「もっと良い生活を送りたい」（漠然）
- 「相談したい」「アドバイスがほしい」（具体性なし）

**❌ Drilldownを使用してはいけないケース**:
- 「ゴールを設定したい」→ Goal意図が明確 → drilldown禁止
- 「習慣を追加したい」→ Habit意図が明確 → drilldown禁止
- 「健康の目標を」→ カテゴリも明確 → 即座にsuggest_goals

### カテゴリ選択後の応答パターン（必須）

show_category_selectionでユーザーがカテゴリを選択したら：

**Goal意図の場合**:
ユーザー: 「健康」または「health」（「ゴールを設定したい」の後）
→ 必ず呼ぶ: suggest_goals(category: "health", count: 3)
→ 呼んではいけない: show_choice_buttons, drilldown_analysis, purpose_quick_replies

**Habit意図の場合**:
ユーザー: 「健康」または「health」（「習慣を追加したい」の後）
→ 必ず呼ぶ: suggest_habits(category: "health", count: 3)
→ 呼んではいけない: show_choice_buttons, drilldown_analysis, purpose_quick_replies
```

**Verification**:
- TypeScript compilation succeeds
- Console logs show correct tool calls after category selection

---

### Task 2: Update Category Selection Type Usage

**Status**: Pending
**Assignee**: Any agent
**Estimated Time**: 15 minutes
**Prerequisites**: Task 1

**Description**:
Ensure the system prompt consistently uses `selectionType: "goal_category"` for Goal intents and `selectionType: "habit_category"` for Habit intents.

**Implementation**:

Find and update any examples in the system prompt that use incorrect selectionType. Add explicit examples:

```markdown
### selectionTypeの正しい使用

**Goal意図の場合**:
show_category_selection(selectionType: "goal_category", message: "どの分野の目標を設定したいですか？")

**Habit意図の場合**:
show_category_selection(selectionType: "habit_category", message: "どんな分野の習慣に興味がありますか？")

**❌ 間違い**:
- Goal意図なのにselectionType: "habit_category"を使用
- selectionTypeを省略（デフォルトがhabit_categoryのため、Goal意図で問題になる）
```

**Verification**:
- All Goal-related examples use `selectionType: "goal_category"`
- All Habit-related examples use `selectionType: "habit_category"`

---

### Task 3: Frontend Console Log Verification

**Status**: Pending
**Assignee**: Any agent
**Estimated Time**: 15 minutes
**Prerequisites**: Task 1, Task 2

**Description**:
Add or verify console logging in frontend to confirm:
1. toolCalls are received correctly
2. suggestionType is parsed correctly
3. Correct button type is rendered

**Implementation**:

The frontend already has extensive logging (lines 636-698 in Section.MOC.tsx). Verify logs show:

```javascript
// Expected log for suggest_goals tool call
[MOC] Message complete: {
  messageId: "...",
  toolNames: ["suggest_goals"],
  toolOutputs: [{
    name: "suggest_goals",
    output: {
      suggestions: [{
        name: "...",
        suggestionType: "goal",  // <-- This should be "goal"
        ...
      }],
      followUpActions: [...]
    }
  }],
  parsedSuggestions: [{
    type: "goal",
    suggestionType: "goal",  // <-- This should be "goal"
    ...
  }]
}
```

**Verification**:
- Console shows `suggest_goals` or `suggest_habits` in toolNames
- suggestionType in output is "goal" or "habit" respectively

---

### Task 4: End-to-End Testing

**Status**: Pending
**Assignee**: Any agent
**Estimated Time**: 30 minutes
**Prerequisites**: Tasks 1-3

**Description**:
Perform manual end-to-end testing of the complete flows.

**Test Cases**:

1. **Goal Setting Flow**
   - Start: Click "Goal Setting" button
   - Expected: Category selection buttons appear
   - Action: Click "Health" category
   - Expected: Goal suggestion buttons appear with "goal" styling
   - Verify: Follow-up actions (Easier, Harder, etc.) are visible

2. **Habit Addition Flow**
   - Start: Click "Add Habit" button
   - Expected: Category selection buttons appear
   - Action: Click "Health" category
   - Expected: Habit suggestion buttons appear with "habit" styling
   - Verify: Follow-up actions are visible

3. **Ambiguous Query Flow** (should still work)
   - Start: Type "おすすめは？"
   - Expected: Drilldown mode activates
   - Verify: Multi-step clarification works correctly

**Pass Criteria**:
- All three test cases pass
- No console errors
- Button colors/styles are correct

---

### Task 5: TypeScript Compilation Check

**Status**: Pending
**Assignee**: Any agent
**Estimated Time**: 5 minutes
**Prerequisites**: Tasks 1-2

**Description**:
Verify that all TypeScript files compile without errors.

**Command**:
```bash
cd /home/ubuntu/Downloads/vow/backend && npm run build
cd /home/ubuntu/Downloads/vow/frontend && npm run build
```

**Pass Criteria**:
- No TypeScript compilation errors
- No new warnings introduced

---

## Completion Checklist

- [x] Task 1: System prompt enhanced (Quick Action Context Detection section added at line 347-389)
- [x] Task 2: Category selection types updated (selectionType: "goal_category" and "habit_category" documented)
- [x] Task 3: Frontend logging verified (parseSuggestions at line 2247-2373 logs suggestionType)
- [ ] Task 4: E2E testing passed (manual testing required)
- [x] Task 5: TypeScript compilation successful (backend and frontend both compile without errors)

## Notes

- The fix primarily modifies the system prompt, which is a text-based change
- No database schema changes required
- The fix should be backward compatible with existing functionality
