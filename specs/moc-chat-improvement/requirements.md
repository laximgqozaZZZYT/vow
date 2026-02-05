# MOC Section Chat Improvement - Requirements Specification

## Overview
- **Feature Name**: MOC Section Chat Improvement (MOCセクションチャット機能改善)
- **Status**: Draft
- **Version**: 1.0.0
- **Created**: 2026-02-05
- **Last Updated**: 2026-02-05
- **Author**: vow-spec-architect
- **Location**: `/home/ubuntu/Downloads/vow/specs/moc-chat-improvement/`

---

## Background

### Current State Analysis

**Primary File:**
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx` (5,123 lines)

**Existing Types:**
```typescript
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'category' | 'text' | 'reply';

export type RefineActionType =
  | 'more_specific'
  | 'easier'
  | 'harder'
  | 'different'
  | 'more_suggestions'
  | 'different_habit';
```

**Known Issues:**
1. Suggestion button display inconsistencies
2. Modal transition incomplete (clicking suggestion doesn't always open correct modal)
3. Multiple suggestion selection not working correctly
4. Question flow lacks structured conversation memory

**Related Completed Specifications:**
- `suggestion-button-enhancement` - Checkbox selection, bulk actions
- `category-drilldown` - Drilldown (Fukabori) question flow
- `iss-20260204-031-button-type-fix` - Goal/Habit button type fix

---

## Functional Requirements

### FR-001: Candidate Button Types (4 Types)

Four distinct button types with clear visual differentiation:

| Type | Name (JA) | Name (EN) | Icon | Badge Color | Click Action |
|------|-----------|-----------|------|-------------|--------------|
| habit | Habit型 | Habit Type | 📝 | Blue | Open HabitModal |
| goal | Goal型 | Goal Type | 🎯 | Purple | Open GoalModal |
| stickyn | Sticky'n型 (MEMO) | Sticky'n Type | 📌 | Yellow | Open StickyModal |
| reply | 回答型 | Reply Type | 💬 | Teal | Send as user message |

**Acceptance Criteria:**
- [AC-001-1] Each button type displays with distinct icon and badge color
- [AC-001-2] Badge text shows type name (localized for ja/en)
- [AC-001-3] Button type is determined by `suggestionType` field in suggestion data

### FR-002: Action Buttons on Suggestion Cards

For Habit/Goal/Sticky'n type buttons, display action buttons:

**Required Buttons:**
1. **[採用]** - Primary action, opens corresponding edit modal
2. **[却下]** - Dismiss the suggestion
3. **[詳細]** - Opens corresponding edit modal (same as 採用)

**Layout:**
```
+------------------------------------------+
| [Icon] Suggestion Name         [Type]    |
| Description text...                      |
| Frequency: daily | Time: 5min            |
+------------------------------------------+
| [採用] [却下]                   [詳細] > |
+------------------------------------------+
```

**Acceptance Criteria:**
- [AC-002-1] Habit candidates show [採用][却下] buttons and [詳細] indicator
- [AC-002-2] Goal candidates show [採用][却下] buttons and [詳細] indicator
- [AC-002-3] Sticky'n candidates show [採用][却下] buttons and [詳細] indicator
- [AC-002-4] Clicking [採用] or [詳細] opens the appropriate modal
- [AC-002-5] Clicking [却下] marks suggestion as dismissed and hides it
- [AC-002-6] Reply type buttons only have click action (no action buttons)

### FR-003: Reply Type Button Behavior

When user clicks a Reply type button:
1. The button label text is sent as user's message
2. AI processes and responds to the message
3. Conversation continues from there

**Acceptance Criteria:**
- [AC-003-1] Clicking Reply button adds message to chat as user message
- [AC-003-2] Message is sent to active AI agent
- [AC-003-3] No modal is opened for Reply type

### FR-004: Question Flow with Memory

Implement structured conversation flow with memory:

**Flow Steps:**
```
Step 1: ユーザーが欲しい情報の種類を確認
  ↓ 候補ボタンで選択
Step 2: 興味のあるカテゴリを確認
  ↓ 候補ボタンで選択
Step 3: サブカテゴリを確認
  ↓ 候補ボタンで選択
Step 4: 適切な提案を生成
```

**Step 1 Options (情報種類):**

| ID | Label (JA) | Label (EN) | Next Action |
|----|-----------|------------|-------------|
| review_habits | 既存Habitの見直し | Review existing Habits | Show user's habits |
| habits_for_goal | 既存Goalに関する新しいHabitの提案 | New Habits for existing Goal | Show user's goals |
| new_goal | 新しいGoalの提案 | Suggest new Goals | Go to category selection |
| new_habit | 新しいHabitの提案 | Suggest new Habits | Go to category selection |
| check_registered | 既存の登録情報の確認 | Check registered information | Show summary |
| other_advice | その他アドバイス | Other advice | Free form |

**Memory Requirements:**
- Store conversation context across messages
- Remember user's selections from each step
- Use selections to generate contextually relevant suggestions

**Acceptance Criteria:**
- [AC-004-1] First message triggers Step 1 question with button options
- [AC-004-2] User's Step 1 selection is remembered for subsequent steps
- [AC-004-3] Step 2 shows category options as buttons
- [AC-004-4] Step 3 shows relevant sub-categories based on Step 2 selection
- [AC-004-5] Final suggestions incorporate all previous selections
- [AC-004-6] Conversation memory persists within the session

### FR-005: Detail Level Adjustment Buttons

Display refinement buttons below suggestion cards:

**Required Buttons:**

| ID | Label (JA) | Label (EN) | Action |
|----|-----------|------------|--------|
| more_specific | もっと具体的に | More Specific | Regenerate with more detail |
| more_general | もっと一般的に | More General | Regenerate with broader scope |
| easier | もっとかんたんに | Easier | Lower difficulty |
| harder | もっとむずかしく | Harder | Higher difficulty |
| different | 別のジャンル | Different Category | Change category |

**Layout:**
```
+------------------------------------------+
| [Suggestion Card 1]                      |
| [Suggestion Card 2]                      |
| [Suggestion Card 3]                      |
+------------------------------------------+
| [もっと具体的に] [もっと一般的に]          |
| [もっとかんたんに] [もっとむずかしく]      |
+------------------------------------------+
```

**Acceptance Criteria:**
- [AC-005-1] [もっと具体的に] button appears below suggestions
- [AC-005-2] [もっと一般的に] button appears below suggestions
- [AC-005-3] Clicking adjustment buttons sends refinement request to AI
- [AC-005-4] AI regenerates suggestions with appropriate detail level
- [AC-005-5] New suggestions replace previous ones

---

## Non-Functional Requirements

### NFR-001: Performance
- Button rendering: < 100ms
- Modal open transition: < 200ms
- AI response start: < 2s (streaming begins)
- Conversation memory retrieval: < 50ms

### NFR-002: Accessibility
- All buttons have `aria-label` attributes
- Keyboard navigation support (Tab, Enter, Space)
- Focus states clearly visible
- Screen reader compatible

### NFR-003: Responsive Design
- Touch targets minimum 44x44px
- Buttons wrap on narrow screens
- Modal adapts to screen size

### NFR-004: Internationalization
- All labels support ja/en locales
- Japanese is default locale
- No hardcoded strings

---

## Dependencies

### Internal Dependencies
| File | Purpose |
|------|---------|
| `Section.MOC.tsx` | Main component (5,123 lines) |
| `Modal.Habit.tsx` | Habit creation/edit modal |
| `Modal.Goal.tsx` | Goal creation/edit modal |
| `Modal.Sticky.tsx` | Sticky note creation/edit modal |
| `useMastraAgent.ts` | Mastra AI agent hook |
| `useMcpChat.ts` | MCP chat hook |

### External Dependencies
- React 19
- TypeScript
- Tailwind CSS 4

---

## Out of Scope

- Drag-and-drop reordering of suggestions
- Cross-session conversation memory (requires backend)
- Voice input support

---

## Agent Coordination Notes

### Parallelizable Tasks
1. UI component updates (buttons, cards)
2. Conversation flow logic
3. Modal integration updates
4. Unit tests

### Sequential Dependencies
1. Type definitions must be updated first
2. Conversation memory must exist before flow logic
3. Button types must be defined before card updates

### File Locks
- `Section.MOC.tsx` - single agent only when modifying
