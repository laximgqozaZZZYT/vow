# MOC Section Chat Feature - Requirements Specification v2.0

**Document Type**: KIRO Specification
**Status**: Active
**Version**: 2.0
**Created**: 2026-02-05
**Last Updated**: 2026-02-05
**Location**: `/home/ubuntu/Downloads/vow/specs/moc-chat-v2/`

---

## 1. Overview

### 1.1 Feature Name
MOC Section Chat - Candidate Button Display & Conversation Flow (MOCセクションチャット機能 - 候補ボタン表示と段階的会話フロー)

### 1.2 Purpose
Enhance the VOW AI Coach chat interface to reliably display candidate buttons for Habit/Goal/Sticky'n suggestions with structured, step-by-step conversation flow for clearer user guidance.

### 1.3 Scope
- Candidate button display (4 types: Habit, Goal, Sticky'n, Reply)
- Segment-by-segment conversation flow (info type → category → subcategory)
- Action button functionality ([採用], [却下], [詳細])
- Follow-up action buttons ([もっと具体的に], [もっと一般的に], etc.)
- Error recovery and edge case handling

### 1.4 Out of Scope
- Voice input/output
- Real-time collaboration features
- Agent-to-agent communication
- Advanced analytics/reporting

---

## 2. Functional Requirements

### 2.1 FR-001: Candidate Button Display (4 Types)

#### 2.1.1 Visual Display

All candidate buttons must display with distinct visual characteristics:

| Type | Japanese | English | Icon | Badge Color | Click Behavior |
|------|----------|---------|------|-------------|----------------|
| habit | Habit型 | Habit Type | 📝 | Blue (#3b82f6) | Open HabitModal |
| goal | Goal型 | Goal Type | 🎯 | Purple (#8b5cf6) | Open GoalModal |
| stickyn | Sticky'n型 | Sticky'n Type | 📌 | Yellow (#f59e0b) | Open StickyModal |
| reply | 回答型 | Reply Type | 💬 | Teal (#14b8a6) | Send as message |

#### 2.1.2 Acceptance Criteria (AC-001)

- **AC-001-1**: Each candidate button displays with correct icon, badge color, and type label
- **AC-001-2**: Badge text shows localized type name (ja/en) based on user locale
- **AC-001-3**: Button type determined from `suggestion.suggestionType` field in response data
- **AC-001-4**: Multiple suggestions displayed in single message
- **AC-001-5**: No text truncation; full candidate name visible
- **AC-001-6**: Buttons clickable on mobile (min 44x44px touch target)

#### 2.1.3 Data Structure

```typescript
interface Suggestion {
  type: 'habit' | 'goal';
  suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';  // Determines UI
  data: {
    name: string;                    // Display name
    description?: string;             // Optional detail
    category?: string;                // For categorization
    difficulty?: string;              // For difficulty level
    [key: string]: unknown;           // Other fields
  };
  actions: Array<{
    id: string;
    label: string;
    variant: 'primary' | 'secondary' | 'ghost';
  }>;
}
```

---

### 2.2 FR-002: Information Type Confirmation Step

#### 2.2.1 Purpose
Guide users through initial categorization before generating suggestions.

#### 2.2.2 Information Types

When user initiates a request, present selection of information types:

| Type ID | Japanese | English | Suggested Tool |
|---------|----------|---------|-----------------|
| review_habits | 既存Habitの見直し | Review existing Habits | show_habit_selection |
| habits_for_goal | 既存Goalの新Habit提案 | Suggest Habits for Goals | show_goal_selection |
| new_goal | 新しいGoalの提案 | Suggest new Goals | show_category_selection |
| new_habit | 新しいHabitの提案 | Suggest new Habits | show_category_selection |
| check_registered | 登録情報の確認 | Check registered data | analyze_habits |
| other_advice | その他アドバイス | Other advice | generate_advice |

#### 2.2.3 User Flow

```
User: "何かアドバイスして"
   ↓
AI: 「以下のどちらをお手伝いしましょうか？」
   [Button] 既存Habitの見直し
   [Button] 既存Goalの新Habit提案
   [Button] 新しいGoalの提案
   [Button] 新しいHabitの提案
   [Button] 登録情報の確認
   [Button] その他アドバイス
   ↓
User: Clicks one button
```

#### 2.2.4 Acceptance Criteria (AC-002)

- **AC-002-1**: Info type buttons displayed when request is ambiguous
- **AC-002-2**: Each info type button distinct and clickable
- **AC-002-3**: Clicking button sends appropriate AI message with selected type
- **AC-002-4**: AI remembers selection in same conversation
- **AC-002-5**: Default (most likely) type auto-selected if request is clear

---

### 2.3 FR-003: Category Selection Step

#### 2.3.1 Purpose
Allow user to specify category before generating suggestions.

#### 2.3.2 Category List

```
健康 (Health)
キャリア (Career)
学習 (Learning)
趣味 (Hobby)
人間関係 (Relationships)
財務 (Finance)
ライフスタイル (Lifestyle)
その他 (Other)
```

#### 2.3.3 Selection Type Awareness

The `selectionType` field determines which tool is called next:

- `habit_category`: Next step calls `suggest_habits(category)` NOT `suggest_goals()`
- `goal_category`: Next step calls `suggest_goals(category)` NOT `suggest_habits()`
- `difficulty`: Next step may call `refine_suggestions()` with difficulty parameter

#### 2.3.4 Acceptance Criteria (AC-003)

- **AC-003-1**: Category buttons displayed via `show_category_selection` tool
- **AC-003-2**: `selectionType` correctly set based on original request
- **AC-003-3**: UI route to correct suggestion tool after category selection
- **AC-003-4**: Category selection state persists for follow-up actions
- **AC-003-5**: User can go back to select different category

---

### 2.4 FR-004: Subcategory Selection (Optional)

#### 2.4.1 Purpose
Narrow down suggestions for complex categories.

#### 2.4.2 Scope

Not all categories require subcategory selection. Examples:

- Health → Fitness, Nutrition, Sleep, Stress management
- Career → Skill development, Job search, Work-life balance
- Learning → Technology, Language, Personal development

#### 2.4.3 Acceptance Criteria (AC-004)

- **AC-004-1**: Subcategory offered when applicable
- **AC-004-2**: Optional; user can skip to direct suggestions
- **AC-004-3**: Subcategory refines suggestions appropriately

---

### 2.5 FR-005: Action Button Functionality

#### 2.5.1 Habit/Goal/Sticky'n Candidate Buttons

For each candidate, display action buttons:

```
+─────────────────────────────────────────────────────────+
│ [📝] Habit Name                            [Habit型]    │
│ Description: Take a 15-minute walk daily               │
│ Frequency: daily | Duration: 15 min                    │
├─────────────────────────────────────────────────────────+
│ [✅ 採用]  [❌ 却下]                    [詳細] >       │
+─────────────────────────────────────────────────────────+
```

#### 2.5.2 Button Actions

| Button | Japanese | Action |
|--------|----------|--------|
| Primary | [✅ 採用] | Open corresponding modal (HabitModal/GoalModal/StickyModal) with pre-filled data |
| Secondary | [❌ 却下] | Mark as dismissed, hide from view |
| Tertiary | [詳細] | Same as [採用] - open edit modal |

#### 2.5.3 Acceptance Criteria (AC-005)

- **AC-005-1**: [採用] button opens correct modal
- **AC-005-2**: Modal pre-filled with suggestion data
- **AC-005-3**: [却下] button hides suggestion without creating record
- **AC-005-4**: [詳細] button opens edit modal for customization
- **AC-005-5**: Modal close/cancel doesn't lose original suggestion data
- **AC-005-6**: Successful creation shows confirmation message

---

### 2.6 FR-006: Reply Type Button Behavior

#### 2.6.1 Purpose
Allow direct user response through button click.

#### 2.6.2 Behavior

When user clicks reply-type button:

```
User clicks [始めたい]
   ↓
System sends button text as user message: "始めたい"
   ↓
AI processes message and responds
   ↓
Conversation continues normally
```

#### 2.6.3 Acceptance Criteria (AC-006)

- **AC-006-1**: Button text sent as user message when clicked
- **AC-006-2**: Message appears in chat as user input
- **AC-006-3**: AI responds to message immediately
- **AC-006-4**: No duplicate message sent
- **AC-006-5**: Works on both desktop and mobile

---

### 2.7 FR-007: Follow-Up Action Buttons

#### 2.7.1 Purpose
Allow refinement of suggestions after initial generation.

#### 2.7.2 Available Actions

| Action ID | Japanese | English | When Used |
|-----------|----------|---------|-----------|
| more_specific | もっと具体的に | More specific | For vague suggestions |
| more_general | もっと一般的に | More general | For overly specific suggestions |
| easier | もっとやさしく | Easier | For difficult habits |
| harder | もっとむずかしく | Harder | For too easy habits |
| different | 別のジャンル | Different category | For irrelevant suggestions |

#### 2.7.3 Acceptance Criteria (AC-007)

- **AC-007-1**: Follow-up buttons displayed below suggestions
- **AC-007-2**: Clicking button calls `refine_suggestions` with appropriate parameters
- **AC-007-3**: Context from original suggestion preserved (category, difficulty)
- **AC-007-4**: Exclusion list prevents repeating same suggestions
- **AC-007-5**: New suggestions displayed without clearing previous ones

---

### 2.8 FR-008: Conversation State Management

#### 2.8.1 Flow State

Track current position in conversation flow:

```typescript
type FlowStep =
  | 'idle'              // No conversation
  | 'info_type'         // Awaiting info type selection
  | 'category'          // Awaiting category selection
  | 'subcategory'       // Awaiting subcategory selection (optional)
  | 'generating';       // Generating suggestions
```

#### 2.8.2 State Transitions

```
idle
  ↓
[User input ambiguous?]
  ├─YES→ info_type → [User selects] → category
  └─NO → category → [User selects] → subcategory? → generating

generating
  ↓
[Suggestions shown]
  ├─[User clicks suggestion] → generating
  ├─[User clicks follow-up] → generating
  └─[User types new message] → info_type or idle
```

#### 2.8.3 Acceptance Criteria (AC-008)

- **AC-008-1**: Current flow step visible in component state
- **AC-008-2**: Appropriate buttons shown based on current step
- **AC-008-3**: Flow step reset on new top-level user request
- **AC-008-4**: Flow step remembered within same conversation
- **AC-008-5**: AI tool calls validated against expected flow step

---

### 2.9 FR-009: Error Handling & Recovery

#### 2.9.1 Handled Error Cases

| Error | Recovery |
|-------|----------|
| Tool call fails | Show error message, offer retry button |
| Suggestion data incomplete | Display partial data + explanation |
| Modal opens with empty fields | Show default values |
| Network timeout | Queue message, retry when reconnected |
| AI doesn't recognize selection type | Show category menu again |

#### 2.9.2 Acceptance Criteria (AC-009)

- **AC-009-1**: Tool call failures logged with full context
- **AC-009-2**: User-friendly error messages displayed
- **AC-009-3**: Retry mechanism available for transient failures
- **AC-009-4**: Graceful degradation when tool partially fails
- **AC-009-5**: No silent failures; all issues logged and visible

---

### 2.10 FR-010: Suggestion Persistence & History

#### 2.10.1 In-Conversation Memory

Within single conversation session:

- Store all shown suggestions
- Track user actions (accept, dismiss, snooze)
- Reference in subsequent messages

#### 2.10.2 Snoozed Suggestions

When user clicks "後で" (snooze):

```typescript
{
  id: string;
  messageId: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  snoozedAt: Date;
}
```

#### 2.10.3 Acceptance Criteria (AC-010)

- **AC-010-1**: All suggestions stored in session
- **AC-010-2**: Snoozed suggestions shown in separate tab
- **AC-010-3**: Accepted suggestions marked and tracked
- **AC-010-4**: Dismissed suggestions not repeated
- **AC-010-5**: History cleared on new session

---

## 3. Non-Functional Requirements

### NFR-001: Performance

- **NFR-001-1**: Suggestion parsing completes in <100ms
- **NFR-001-2**: Modal opens within <200ms of button click
- **NFR-001-3**: Chat scroll smooth (60fps)
- **NFR-001-4**: Renders 10+ suggestions without lag

### NFR-002: Reliability

- **NFR-002-1**: Buttons display 99% of time when present in response
- **NFR-002-2**: Correct modal opens 95%+ of time
- **NFR-002-3**: Selection type routing 90%+ accuracy

### NFR-003: Accessibility

- **NFR-003-1**: ARIA labels for all buttons
- **NFR-003-2**: Keyboard navigation (Tab, Enter, Escape)
- **NFR-003-3**: Screen reader compatible
- **NFR-003-4**: Color not only means of distinction

### NFR-004: Localization

- **NFR-004-1**: All UI text localized (ja/en)
- **NFR-004-2**: Tool output translated to user locale
- **NFR-004-3**: Date/time formatted per locale
- **NFR-004-4**: RTL language support (future)

### NFR-005: Browser Support

- **NFR-005-1**: Chrome/Edge 90+
- **NFR-005-2**: Safari 14+
- **NFR-005-3**: Firefox 88+
- **NFR-005-4**: Mobile browsers (iOS Safari 12+, Android Chrome 90+)

---

## 4. Constraints & Dependencies

### 4.1 Technical Constraints

- Component size: Refactor if exceeds 5000 lines
- API latency: Must work with 500ms+ response times
- Browser storage: Limit session memory to <5MB

### 4.2 Dependencies

| Component | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.3+ | Type safety |
| Mastra | Latest | AI orchestration |
| Zod | Latest | Schema validation |

### 4.3 Integration Points

- Backend: Mastra vow-coach-agent
- Modals: HabitModal, GoalModal, StickyModal
- API: Chat, habit/goal/sticky creation endpoints

---

## 5. Acceptance Criteria Summary

| ID | Requirement | Criteria | Owner |
|----|----|----------|-------|
| AC-001 | Button display | All 4 types visible with correct colors/icons | Frontend |
| AC-002 | Info type selection | Buttons shown when ambiguous | Frontend |
| AC-003 | Category selection | Correct tool called after selection | Frontend+Backend |
| AC-004 | Subcategory (opt) | Narrows suggestions appropriately | Frontend+Backend |
| AC-005 | Action buttons | [採用]/[却下]/[詳細] work correctly | Frontend |
| AC-006 | Reply buttons | Text sent as user message | Frontend |
| AC-007 | Follow-up buttons | Refine suggestions appropriately | Frontend+Backend |
| AC-008 | State management | Flow state tracked and validated | Frontend |
| AC-009 | Error handling | Graceful recovery with user feedback | Frontend |
| AC-010 | Persistence | Suggestions stored in session | Frontend |

---

## 6. Related Specifications

| Spec | Status | Relationship |
|------|--------|---|
| ISS-20260204-031 | Completed | Goal/Habit button type fix (predecessor) |
| ISS-20260204-030 | Completed | Habit multiple display fix (predecessor) |
| ISS-1b9a14fe | Completed | Goal button display fix (predecessor) |
| E2E-CHAT-001 | Specification Complete | E2E test for this feature |
| Category-Drilldown | Completed | Drilldown (Fukabori) question flow |

---

## 7. Success Metrics

- Button display accuracy: ≥98%
- Correct tool routing: ≥95%
- User satisfaction: ≥4.0/5.0
- Feature usage: ≥80% of chat interactions
- Error rate: <2%

---

## Appendix: Glossary

- **Suggestion**: AI-generated recommendation (habit, goal, or sticky note)
- **Candidate Button**: Button displaying a suggestion with actionable state
- **Flow Step**: Current position in multi-step conversation
- **Selection Type**: Category of selection (habit_category, goal_category, difficulty)
- **Follow-up Action**: Refinement of suggestions (more_specific, easier, harder, different)
- **Snooze**: Defer suggestion to later review without dismissing

---

## Sign-off

- **Specification Lead**: vow-spec-architect
- **Created**: 2026-02-05
- **Status**: Active
- **Version**: 2.0

