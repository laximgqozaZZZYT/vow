# Drilldown (Fukabori) Feature Fix - Tasks

## Overview
- **Purpose**: Task breakdown for implementing the drilldown fix
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Task List

### Task 1: Add Drilldown Tool Imports to vow-coach-agent.ts
- **Status**: [ ] Not Started -> [x] Completed
- **Assignable to**: any agent
- **Prerequisites**: None
- **Estimated effort**: 5 minutes

**Description**: Import the drilldown tools from the drilldown module.

**File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

**Changes**:
```typescript
// Add to imports section (around line 35-40)
import {
  drilldownAnalysisTool,
  genreQuickRepliesTool,
  purposeQuickRepliesTool,
  responseTypeQuickRepliesTool,
  type DrilldownAnalysisResult,
} from './drilldown/index.js';
```

---

### Task 2: Add Drilldown Tools to coachTools Array
- **Status**: [ ] Not Started -> [x] Completed
- **Assignable to**: any agent
- **Prerequisites**: Task 1
- **Estimated effort**: 15 minutes

**Description**: Add the four drilldown tools to the `coachTools` array, adapting them to the CoachTool format.

**File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

**Changes**: Add these tool definitions to the `coachTools` array (after `show_choice_buttons` at around line 1573):

```typescript
  {
    name: 'drilldown_analysis',
    description: 'Analyze if a user query needs category drilldown (Fukabori) clarification. Use this when the user\'s question is vague like "I want to start something new" or "I want to improve myself".',
    descriptionJa: 'ユーザーのクエリが曖昧で掘り下げ（フカボリ）が必要か分析します。「何か新しいことを始めたい」「自分を変えたい」などの曖昧な質問に使用します。',
    inputSchema: z.object({
      query: z.string().describe('User query to analyze'),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional().describe('Previous conversation messages'),
      locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
    }),
    execute: async (input: unknown, context: CoachExecutionContext) => {
      const parsed = z.object({
        query: z.string(),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).optional(),
        locale: z.enum(['ja', 'en']).default('ja'),
      }).parse(input);
      return drilldownAnalysisTool.execute(parsed);
    },
  },
  {
    name: 'genre_quick_replies',
    description: 'Generate quick reply buttons for genre/category selection. Use when asking the user what area they want to focus on.',
    descriptionJa: 'ジャンル/カテゴリ選択のクイックリプライボタンを生成します。ユーザーにどの分野に興味があるか聞く時に使用します。',
    inputSchema: z.object({
      locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
    }),
    execute: async (input: unknown, _context: CoachExecutionContext) => {
      const parsed = z.object({
        locale: z.enum(['ja', 'en']).default('ja'),
      }).parse(input);
      return genreQuickRepliesTool.execute(parsed);
    },
  },
  {
    name: 'purpose_quick_replies',
    description: 'Generate quick reply buttons for purpose selection within a genre. Use after user has selected a genre.',
    descriptionJa: 'ジャンル内の目的選択のクイックリプライボタンを生成します。ユーザーがジャンルを選択した後に使用します。',
    inputSchema: z.object({
      genre: z.string().describe('Selected genre ID'),
      genreLabel: z.string().optional().describe('Selected genre label'),
      locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
    }),
    execute: async (input: unknown, _context: CoachExecutionContext) => {
      const parsed = z.object({
        genre: z.string(),
        genreLabel: z.string().optional(),
        locale: z.enum(['ja', 'en']).default('ja'),
      }).parse(input);
      return purposeQuickRepliesTool.execute(parsed);
    },
  },
  {
    name: 'response_type_quick_replies',
    description: 'Generate quick reply buttons for response type selection. Use after user has selected their purpose.',
    descriptionJa: '回答タイプ選択のクイックリプライボタンを生成します。ユーザーが目的を選択した後に使用します。',
    inputSchema: z.object({
      genre: z.string().describe('Selected genre ID'),
      genreLabel: z.string().optional().describe('Selected genre label'),
      purpose: z.string().describe('Selected purpose ID'),
      purposeLabel: z.string().optional().describe('Selected purpose label'),
      locale: z.enum(['ja', 'en']).default('ja').describe('Response language'),
    }),
    execute: async (input: unknown, _context: CoachExecutionContext) => {
      const parsed = z.object({
        genre: z.string(),
        genreLabel: z.string().optional(),
        purpose: z.string(),
        purposeLabel: z.string().optional(),
        locale: z.enum(['ja', 'en']).default('ja'),
      }).parse(input);
      return responseTypeQuickRepliesTool.execute(parsed);
    },
  },
```

---

### Task 3: Update System Prompt with Drilldown Instructions
- **Status**: [ ] Not Started -> [x] Completed
- **Assignable to**: any agent
- **Prerequisites**: None
- **Estimated effort**: 10 minutes

**Description**: Add drilldown usage instructions to the system prompt.

**File**: `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts`

**Location**: Inside `generateSystemPrompt()` function, add to the prompt string.

**Content to Add**:
```
## 掘り下げモード（フカボリ）- 重要
ユーザーの質問が曖昧な場合は、**必ず drilldown_analysis ツールを使用**して掘り下げフローを開始してください。

### 曖昧な質問のパターン（掘り下げ必須）
- 「何か新しいことを始めたい」「新しい習慣を始めたい」（具体性なし）
- 「もっと良い生活を送りたい」
- 「自分を変えたい」
- 「おすすめを教えて」「何がいい？」
- 「相談したい」「アドバイスがほしい」（具体性なし）

### 掘り下げフロー
1. **drilldown_analysis** で曖昧さを判定
2. needsDrilldown=true の場合:
   - currentStep='genre_selection' → **genre_quick_replies** でジャンル選択ボタンを表示
3. ユーザーがジャンルを選択したら → **purpose_quick_replies** で目的選択ボタンを表示
4. ユーザーが目的を選択したら → **response_type_quick_replies** で回答タイプボタンを表示
5. すべて選択されたら、適切な提案ツール（suggest_habits / suggest_goals）を呼び出す

### 重要: 掘り下げ中は必ずquickRepliesを返す
掘り下げステップでは、テキストのみの応答は禁止。必ずツールを呼び出してボタンを表示してください。
```

---

### Task 4: Verify Frontend Compatibility
- **Status**: [x] Completed (verification only - no changes needed)
- **Assignable to**: any agent
- **Prerequisites**: Tasks 1-3
- **Estimated effort**: 10 minutes

**Description**: Verify that the frontend correctly handles drilldown tool outputs.

**Verification Points**:
1. `parseQuickReplies` in `Section.MOC.tsx` includes drilldown tool names - **VERIFIED**
2. `selectionType` extraction handles drilldown types - **VERIFIED**
3. `handleQuickReplyClick` handles drilldown selections - **VERIFIED**

**Result**: Frontend already fully supports drilldown tools. No changes needed.

---

### Task 5: Manual Testing
- **Status**: [ ] Not Started
- **Assignable to**: any agent
- **Prerequisites**: Tasks 1-4
- **Estimated effort**: 20 minutes

**Description**: Manually test the drilldown flow end-to-end.

**Test Cases**:
1. Send "何か新しいことを始めたい" - expect genre buttons
2. Click "💪 健康・運動" - expect purpose buttons
3. Click "体重を減らしたい" - expect response type buttons
4. Click "具体的な習慣を提案" - expect habit suggestions

---

### Task 6: Close Issue in Supabase
- **Status**: [ ] Not Started
- **Assignable to**: any agent
- **Prerequisites**: Task 5 (successful testing)
- **Estimated effort**: 2 minutes

**Description**: Update the issue status to resolved in Supabase.

**API Call**:
```bash
curl -X PATCH "https://jamiyzsyclvlvstmeeir.supabase.co/rest/v1/issues?id=eq.95f94e67-8d2d-4cb4-aa56-61a1c58814a0" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbWl5enN5Y2x2bHZzdG1lZWlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMxODkyOSwiZXhwIjoyMDgyODk0OTI5fQ.WeHnNjJeJEKw_w3kGd0GrwPrMXepZ8uQonokyR1z8pI" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbWl5enN5Y2x2bHZzdG1lZWlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMxODkyOSwiZXhwIjoyMDgyODk0OTI5fQ.WeHnNjJeJEKw_w3kGd0GrwPrMXepZ8uQonokyR1z8pI" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "resolved", "resolved_at": "2026-02-04T00:00:00Z"}'
```

## Summary

| Task | Status | Effort | Prerequisites |
|------|--------|--------|---------------|
| 1. Add Drilldown Imports | Completed | 5 min | None |
| 2. Add Drilldown Tools | Completed | 15 min | Task 1 |
| 3. Update System Prompt | Completed | 10 min | None |
| 4. Verify Frontend | Completed | 10 min | Tasks 1-3 |
| 5. Manual Testing | Not Started | 20 min | Tasks 1-4 |
| 6. Close Issue | Not Started | 2 min | Task 5 |

**Total Estimated Effort**: ~62 minutes
