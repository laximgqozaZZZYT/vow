# MOC Section Chat Feature - Design Specification v2.0

**Document Type**: KIRO Specification - Design
**Status**: Active
**Version**: 2.0
**Created**: 2026-02-05

---

## 1. Architecture Overview

### 1.1 Component Hierarchy

```
<MOCSection>
  │
  ├─ <Header>
  │   ├─ Status indicator
  │   └─ Settings button
  │
  ├─ <TabBar>
  │   ├─ Chat (active)
  │   ├─ Tasks
  │   ├─ Agents
  │   └─ History
  │
  ├─ <ChatContainer>
  │   ├─ <ChatMessageList>
  │   │   ├─ <UserMessage>
  │   │   ├─ <AIMessage>
  │   │   │   ├─ <SuggestionCard> (for each suggestion)
  │   │   │   │   ├─ Suggestion details
  │   │   │   │   ├─ <ActionButtons>
  │   │   │   │   └─ Metadata
  │   │   │   ├─ <QuickReplyButtons>
  │   │   │   └─ <FollowUpButtons>
  │   │   └─ <LoadingIndicator>
  │   │
  │   └─ <InputArea>
  │       ├─ <Textarea>
  │       ├─ <SendButton>
  │       └─ <IssueReportButton>
  │
  ├─ <HabitModal>
  ├─ <GoalModal>
  ├─ <StickyModal>
  ├─ <IssueModal>
  └─ <HelpModal>
```

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ User Input                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ User types message in textarea                              │ │
│ │ "新しい習慣を追加したい"                                  │ │
│ └───────────────────┬─────────────────────────────────────────┘ │
└─────────────────────┼──────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: activeAgent.sendMessage()                              │
│ Calls useMastraAgent or useMcpChat hook                         │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend: Mastra vow-coach-agent                                  │
│ Processes message with system prompt                            │
│ Determines if needs clarification (info_type vs direct action)  │
│ Calls appropriate tool: show_category_selection                 │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend: Tool Execution                                          │
│ show_category_selection() outputs:                              │
│ {                                                                │
│   selectionType: "habit_category",                             │
│   message: "どのジャンルの習慣に興味がありますか？",      │
│   quickReplies: [                                              │
│     { id: "health", label: "健康", value: "健康" }           │
│     { id: "learning", label: "学習", value: "学習" }         │
│   ]                                                             │
│ }                                                                │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Receive AI Response with toolCalls                     │
│ {                                                                │
│   id: "ai-123",                                                 │
│   content: "どのジャンルの習慣に興味がありますか？",      │
│   toolCalls: [{                                                 │
│     toolName: "show_category_selection",                        │
│     output: { /* tool output above */ }                        │
│   }]                                                             │
│ }                                                                │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Parsing (useEffect hook)                               │
│ - parseSuggestions(msg) → undefined (no suggestions)           │
│ - parseQuickReplies(msg) → {                                   │
│     quickReplies: [{ id, label, value, icon }],                │
│     selectionType: "habit_category"                            │
│   }                                                              │
│ - parseFollowUpActions(msg) → undefined (not applicable)       │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Update Message State                                   │
│ setMessages(prev => [...prev, {                                │
│   id: "ai-123",                                                 │
│   content: "...",                                               │
│   quickReplies: [...],                                          │
│   selectionType: "habit_category"                              │
│ }])                                                              │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend: Render QuickReplyButtons                               │
│ messages.map(msg => msg.quickReplies?.map(reply =>             │
│   <QuickReplyButton onclick={handleQuickReplyClick} />         │
│ ))                                                               │
└───────────────────┬──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI Display                                                       │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ AI: どのジャンルの習慣に興味がありますか？                │  │
│ │ [💪 健康]  [📚 学習]  [💼 キャリア]  [🎨 趣味]           │  │
│ └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
                  ... (repeats for next step)
```

---

## 2. Component Specifications

### 2.1 SuggestionCard Component

**Purpose**: Display individual suggestion with action buttons

**Props**:
```typescript
interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
  locale: 'ja' | 'en';
  isLoading?: boolean;
  onAction: (actionId: string, suggestion: Suggestion) => void;
}
```

**Visual Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│ [📝] Suggestion Name                          [Habit型] Badge │
│ ├─ Description text (2 lines max)                            │
│ ├─ Category: Health | Frequency: Daily | Time: 15min        │
│ ├─ Difficulty: Beginner | Expected Duration: 2 weeks        │
│ └─ Rationale: Why this suggestion...                         │
├──────────────────────────────────────────────────────────────┤
│ [✅ 採用]  [❌ 却下]  [📋 詳細]                            │
└──────────────────────────────────────────────────────────────┘
```

**Badge Styling**:
```css
.suggestion-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-habit { background-color: #dbeafe; color: #1e40af; }    /* Blue */
.badge-goal { background-color: #ede9fe; color: #6d28d9; }     /* Purple */
.badge-stickyn { background-color: #fef3c7; color: #92400e; }  /* Yellow */
.badge-reply { background-color: #ccfbf1; color: #0d7377; }    /* Teal */
```

**Behavior**:
- Display suggestion details clearly
- Action buttons always visible
- Hover state highlights card
- Mobile: Full width, touch-friendly

### 2.2 ActionButtons Component

**Purpose**: Display action buttons for suggestion

**Buttons**:

| Button | Label | Icon | Variant | Action |
|--------|-------|------|---------|--------|
| accept | [✅ 採用] | ✅ | primary | handleSuggestionAction("accept") |
| snooze | [⏭️ 後で] | ⏭️ | secondary | handleSuggestionAction("snooze") |
| dismiss | [❌ 不要] | ❌ | ghost | handleSuggestionAction("dismiss") |

**States**:
- Default: Clickable
- Hover: Background color change
- Active: Shadow effect
- Disabled: Greyed out (loading)
- Success: Green check animation

### 2.3 QuickReplyButtons Component

**Purpose**: Display category/quick reply selection buttons

**Props**:
```typescript
interface QuickReplyButtonsProps {
  quickReplies: QuickReply[];
  selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  locale: 'ja' | 'en';
  onSelect: (value: string, label: string) => void;
}
```

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ [💪 健康]  [📚 学習]  [💼 キャリア]              │
│ [🎨 趣味]  [👥 人間関係]  [💰 財務]              │
│ [🏡 ライフスタイル]  [📌 その他]                 │
└─────────────────────────────────────────────────────┘
```

**Button Styling**:
```css
.quick-reply-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background-color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-reply-button:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
}

.quick-reply-button:active {
  background-color: #e5e7eb;
}
```

### 2.4 FollowUpButtons Component

**Purpose**: Display suggestion refinement buttons

**Props**:
```typescript
interface FollowUpButtonsProps {
  actions: FollowUpAction[];
  locale: 'ja' | 'en';
  onAction: (action: RefineActionType, category?: string) => void;
}
```

**Layout**:
```
┌──────────────────────────────────────────────────────────┐
│ Refine suggestions:                                     │
│ [🔍 もっと具体的に]  [🌱 もっとやさしく]           │
│ [🔥 もっとむずかしく]  [🔄 別のジャンル]           │
└──────────────────────────────────────────────────────────┘
```

**Button Styling**:
```css
.followup-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #16a34a;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.followup-button:hover {
  background-color: #dcfce7;
  border-color: #86efac;
}
```

---

## 3. State Management Design

### 3.1 Component State Structure

```typescript
interface MOCSectionState {
  // Chat state
  messages: GroupChatMessage[];
  inputValue: string;
  activeTab: TabId;

  // Suggestion state
  suggestionStates: Record<string, SuggestionState>;
  snoozedSuggestions: SnoozedSuggestion[];

  // Flow state (NEW - required for v2)
  currentFlowStep: FlowStep;
  flowContext: {
    infoTypeSelected?: InfoTypeSelection;
    categorySelected?: string;
    selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  };

  // Modal states
  habitModalOpen: boolean;
  goalModalOpen: boolean;
  stickyModalOpen: boolean;

  // UI states
  isLoading: boolean;
  error?: string;
}
```

### 3.2 Flow State Transitions

```
┌─────────────────────────────────────────────────────┐
│ Flow State Machine                                  │
└─────────────────────────────────────────────────────┘

STATE: idle
└─ ON: User sends message
   → Check if ambiguous
   ├─ YES: GOTO info_type
   └─ NO: GOTO category

STATE: info_type
└─ ON: User selects info type
   → Store infoTypeSelected in flowContext
   → GOTO category

STATE: category
└─ ON: User selects category
   → Store categorySelected & selectionType in flowContext
   ├─ IF subcategories available: GOTO subcategory
   └─ ELSE: GOTO generating

STATE: subcategory
└─ ON: User selects subcategory (or skips)
   → GOTO generating

STATE: generating
└─ ON: Suggestions received
   → Display suggestions + followUpButtons
   ├─ ON: User clicks follow-up button
   │  └─ STAY at generating (new suggestions loaded)
   ├─ ON: User clicks suggestion action
   │  └─ IF modal opens: STAY at generating
   │     IF modal accepted: STAY at generating + show success
   └─ ON: User types new message
      → Reset flowContext
      → GOTO idle or info_type
```

### 3.3 Flow Context Persistence

**Duration**: Within single conversation

**Cleared**: On new top-level user request

**Accessible to**:
- Message parsing functions
- Follow-up action handlers
- Error recovery logic

---

## 4. Flow Diagram: Habit Creation

```
┌──────────────────────────────────┐
│ User: "新しい習慣を追加したい"   │
└──────────────┬───────────────────┘
               ▼
        Request ambiguous?
        ├─ YES (vague): Show info type menu
        │             (Review existing / New habit / New goal / etc.)
        └─ NO (clear): flowStep = category

        ┌─────────────────────────────────────────┐
        │ flowStep = category                     │
        │ Show category buttons                   │
        │ [💪 健康] [📚 学習] [💼 キャリア] ...  │
        └──────────────┬────────────────────────────┘
                       ▼
             ┌─────────────────────┐
             │ User: Clicks "健康"  │
             └──────────────┬──────┘
                            ▼
              flowContext.categorySelected = "health"
              flowContext.selectionType = "habit_category"
              Send: "健康の習慣を提案して"
              flowStep = generating

              ┌──────────────────────────────────────────────────┐
              │ AI calls: suggest_habits(category: "health")     │
              │ Returns 3 habit suggestions:                     │
              │  1. Walk 15 minutes daily                        │
              │  2. Drink 2L water daily                         │
              │  3. 10 minutes stretching                        │
              └──────────────┬─────────────────────────────────┘
                             ▼
                  ┌─────────────────────────────┐
                  │ User: Clicks [✅ 採用]     │
                  │ on "Walk 15 minutes"        │
                  └──────────────┬──────────────┘
                                 ▼
                    Open HabitModal with data:
                    {
                      name: "Walk 15 minutes daily",
                      type: "do",
                      category: "health"
                    }

                    ┌──────────────────────┐
                    │ User: Edits & Saves  │
                    │ (or cancels)         │
                    └──────────────┬───────┘
                                   ▼
                              API call:
                        createHabit(payload)

                        ┌────────────────┐
                        │ Success:       │
                        │ "✅ 習慣を作成" │
                        │ "次は何を？"    │
                        └────────────────┘
```

---

## 5. Error Handling Design

### 5.1 Error Scenarios & Recovery

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Tool call fails | Exception caught | Show error msg + retry button |
| Suggestion data incomplete | Missing required field | Display partial data with explanation |
| Modal opens empty | No prefilled data | Show field validation errors |
| AI returns wrong tool | Wrong tool name in response | Validate against expected step |
| User types during loading | Input enabled while streaming | Queue message, execute after current |
| Network timeout | No response for 30s | Show "Connection lost" + retry |
| Selection type ambiguous | selectionType not set | Show category menu again |

### 5.2 Error Message Templates

```typescript
const ERROR_MESSAGES = {
  ja: {
    tool_failed: 'ツール実行に失敗しました。[再試行] をクリックしてください。',
    incomplete_data: 'データが不完全です。[詳細] をクリックして補完してください。',
    modal_failed: 'モーダルを開けませんでした。後からもう一度試してください。',
    network_error: 'ネットワークエラーが発生しました。接続を確認してください。',
    ambiguous_selection: 'カテゴリが不明確です。もう一度選択してください。',
  },
  en: {
    tool_failed: 'Tool execution failed. Click [Retry] to try again.',
    incomplete_data: 'Data is incomplete. Click [Details] to fill in missing fields.',
    modal_failed: 'Failed to open editor. Please try again later.',
    network_error: 'Network error occurred. Please check your connection.',
    ambiguous_selection: 'Category unclear. Please select again.',
  }
};
```

---

## 6. Interaction Design

### 6.1 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move to next interactive element |
| Shift+Tab | Move to previous interactive element |
| Enter | Activate focused button |
| Escape | Close modal |
| Ctrl/Cmd+Enter | Send message (textarea) |

### 6.2 Touch/Mobile

- Minimum touch target: 44x44px
- Finger-friendly spacing: 8px+ between buttons
- No hover states on mobile (use active state)
- Swipe to dismiss suggestion (future)

### 6.3 Accessibility

- All buttons have `aria-label`
- Modal has `role="dialog"` and `aria-labelledby`
- Loading state announced via `aria-busy`
- Error messages use `role="alert"`
- Color + icon for type distinction

---

## 7. Styling System

### 7.1 Color Tokens

```
Primary: Blue (#3b82f6)
Secondary: Purple (#8b5cf6)
Success: Green (#16a34a)
Warning: Amber (#f59e0b)
Danger: Red (#dc2626)
Neutral: Gray (#6b7280)

Button Types:
- Habit: Blue
- Goal: Purple
- Sticky'n: Amber
- Reply: Teal
```

### 7.2 Typography

```
Chat Content: 14px/1.5 (body2)
Button Labels: 14px/1.4 (button)
Card Title: 16px/1.4 (body1 bold)
Card Meta: 12px/1.5 (caption)
Message Time: 12px/1.5 (caption)
```

### 7.3 Spacing

```
Compact: 4px
Dense: 8px
Normal: 12px
Comfortable: 16px
Loose: 24px
```

---

## 8. Performance Considerations

### 8.1 Rendering Optimization

- Memoize suggestion cards: `React.memo(SuggestionCard)`
- Virtualize long suggestion lists: Use `react-window` if >20 suggestions
- Debounce typing: 300ms before parsing
- Lazy load modal components

### 8.2 State Management Optimization

- Use `useCallback` for event handlers
- Use `useMemo` for parsing results
- Avoid recreating objects in render
- Limit useState re-renders with `useReducer` for complex state

### 8.3 Network Optimization

- Queue multiple quick selections (batch)
- Cache suggestion responses (5min TTL)
- Retry with exponential backoff (1s, 2s, 4s, 8s)
- Compress tool output when possible

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// Example test structure
describe('parseSuggestions', () => {
  it('should extract suggestion array from tool output', () => {
    const input = { toolCalls: [{
      toolName: 'suggest_habits',
      output: { suggestions: [{ name: 'Walk', ... }] }
    }]};
    const result = parseSuggestions(input);
    expect(result).toHaveLength(1);
    expect(result[0].data.name).toBe('Walk');
  });

  it('should handle missing output gracefully', () => {
    const result = parseSuggestions({ toolCalls: [] });
    expect(result).toBeUndefined();
  });
});
```

### 9.2 Component Tests

- Render suggestion card with all button types
- Verify action button callbacks
- Test error state display
- Test accessibility attributes

### 9.3 Integration Tests

- Full habit creation flow
- Category selection → suggestions → modal
- Follow-up refinement flow
- Snoozed suggestions recovery

### 9.4 E2E Tests

- Real AI responses (mocked)
- Multi-turn conversation
- Error scenarios
- Mobile responsiveness

---

## 10. Localization Design

### 10.1 i18n Structure

```
/frontend/locales/
  ├─ ja.json
  │   ├─ moc: {
  │   │   buttons: { accept: "✅ 採用", dismiss: "❌ 不要" },
  │   │   labels: { habit: "Habit型", goal: "Goal型" },
  │   │   messages: { ... }
  │   └─ }
  └─ en.json
      └─ moc: { ... }
```

### 10.2 Dynamic Translation

For tool outputs, add post-processing:

```typescript
function translateToolOutput(output: unknown, locale: 'ja' | 'en'): unknown {
  // Translate specific fields based on tool type
  // E.g., category names: "health" → "健康" (ja) or "Health" (en)
  // E.g., difficulty levels: "beginner" → "初級" (ja) or "Beginner" (en)
}
```

---

## Appendix A: Component Tree JSON

```json
{
  "MOCSection": {
    "Header": {},
    "TabBar": {},
    "ChatContainer": {
      "ChatMessageList": {
        "UserMessage": {},
        "AIMessage": {
          "SuggestionCard": {
            "ActionButtons": {},
            "Metadata": {}
          },
          "QuickReplyButtons": {},
          "FollowUpButtons": {}
        },
        "LoadingIndicator": {}
      },
      "InputArea": {
        "Textarea": {},
        "SendButton": {},
        "IssueReportButton": {}
      }
    },
    "HabitModal": {},
    "GoalModal": {},
    "StickyModal": {},
    "IssueModal": {},
    "HelpModal": {}
  }
}
```

---

## Appendix B: API Contract

### Chat Message Endpoint

**Request**:
```json
POST /api/chat/message
{
  "message": "新しい習慣を追加したい",
  "sessionId": "sess_abc123",
  "locale": "ja"
}
```

**Response**:
```json
{
  "id": "msg_xyz789",
  "content": "どのジャンルの習慣に興味がありますか？",
  "timestamp": "2026-02-05T10:30:00Z",
  "toolCalls": [{
    "toolName": "show_category_selection",
    "input": { "selectionType": "habit_category" },
    "output": {
      "selectionType": "habit_category",
      "message": "...",
      "quickReplies": [...]
    },
    "success": true,
    "durationMs": 150
  }]
}
```

---

