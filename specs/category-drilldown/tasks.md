# Category Drilldown (Fukabori) Feature - Implementation Tasks

## Overview
- **Feature Name**: Category Drilldown Implementation
- **Status**: In Progress
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Task Summary

| Task ID | Task Name | Status | Assignee |
|---------|-----------|--------|----------|
| CD-001 | Create drilldown types | Done | vow-spec-architect |
| CD-002 | Create category data | Done | vow-spec-architect |
| CD-003 | Implement DrilldownController | Done | vow-spec-architect |
| CD-004 | Create drilldownAnalysisTool | Done | vow-spec-architect |
| CD-005 | Extend Manager Agent | Done | vow-spec-architect |
| CD-006 | Frontend selectionType extension | Done | vow-spec-architect |
| CD-007 | Build verification | Pending | - |
| CD-008 | Testing | Pending | - |

---

## Detailed Tasks

### CD-001: Create Drilldown Types
**Status**: Done
**Priority**: High
**Prerequisites**: None

**Description**:
掘り下げ機能に必要な型定義を作成する。

**Files to Create**:
- `backend/src/agents/mastra/drilldown/types.ts`

**Acceptance Criteria**:
- [x] DrilldownStep enum定義
- [x] DrilldownState interface定義
- [x] QuickReplyOption interface定義

---

### CD-002: Create Category Data
**Status**: Done
**Priority**: High
**Prerequisites**: CD-001

**Description**:
ジャンル、目的、回答の型のカテゴリデータを定義する。

**Files to Create**:
- `backend/src/agents/mastra/drilldown/categories.ts`

**Acceptance Criteria**:
- [x] GENRE_CATEGORIES配列（8カテゴリ）
- [x] 各ジャンルのpurposes配列
- [x] RESPONSE_TYPE_OPTIONS配列

---

### CD-003: Implement DrilldownController
**Status**: Done
**Priority**: High
**Prerequisites**: CD-001, CD-002

**Description**:
掘り下げロジックを制御するDrilldownControllerクラスを実装する。

**Files to Create**:
- `backend/src/agents/mastra/drilldown/controller.ts`

**Implementation Details**:
```typescript
class DrilldownController {
  needsDrilldown(query: string, history: ConversationMessage[]): boolean
  getCurrentStep(history: ConversationMessage[]): DrilldownStep
  getDrilldownState(history: ConversationMessage[]): DrilldownState
  generateQuickReplies(step: DrilldownStep, state: DrilldownState, locale: 'ja' | 'en'): QuickReply[]
  generateDelegationPrompt(state: DrilldownState, locale: 'ja' | 'en'): string
  getTargetAgent(state: DrilldownState): 'habit-coach' | 'goal-planner' | 'manager'
}
```

**Acceptance Criteria**:
- [x] 曖昧なクエリを正しく検出
- [x] 会話履歴から状態を復元
- [x] 適切なQuickRepliesを生成
- [x] 委譲プロンプトを生成

---

### CD-004: Create drilldownAnalysisTool
**Status**: Done
**Priority**: High
**Prerequisites**: CD-003

**Description**:
Mastra Tool形式のdrilldownAnalysisToolを作成する。

**Files to Create**:
- `backend/src/agents/mastra/drilldown/tools.ts`
- `backend/src/agents/mastra/drilldown/index.ts`

**Acceptance Criteria**:
- [x] createTool形式で実装
- [x] 入力スキーマ定義
- [x] 出力スキーマ定義
- [x] DrilldownControllerとの連携

---

### CD-005: Extend Manager Agent
**Status**: Done
**Priority**: High
**Prerequisites**: CD-004

**Description**:
Manager Agentにdrilldown機能を統合する。

**Files to Modify**:
- `backend/src/agents/mastra/agents/manager-agent.ts`

**Changes**:
1. drilldownAnalysisToolをimport
2. toolsにdrilldownAnalysisToolを追加
3. instructionsに掘り下げモードの説明を追加

**Acceptance Criteria**:
- [x] drilldownAnalysisTool統合
- [x] 掘り下げ用instructions追加

---

### CD-006: Frontend selectionType Extension
**Status**: Done
**Priority**: Medium
**Prerequisites**: CD-005

**Description**:
フロントエンドのselectionTypeに掘り下げ用の値を追加する。

**Files to Modify**:
- `frontend/app/dashboard/components/Section.MOC.tsx`

**Changes**:
1. GroupChatMessage.selectionTypeに新しい値を追加
2. handleQuickReplyClickで掘り下げ選択を処理

**Acceptance Criteria**:
- [x] 'drilldown_genre' selectionType追加
- [x] 'drilldown_purpose' selectionType追加
- [x] 'drilldown_response_type' selectionType追加
- [x] handleQuickReplyClickで掘り下げ対応

---

### CD-007: Build Verification
**Status**: Partial (Backend OK, Frontend build issue unrelated to this feature)
**Priority**: High
**Prerequisites**: CD-001 ~ CD-006

**Description**:
ビルドが正常に通ることを確認する。

**Commands**:
```bash
cd /home/ubuntu/Downloads/vow/backend && npm run build
cd /home/ubuntu/Downloads/vow/frontend && npm run build
```

**Acceptance Criteria**:
- [x] Backend build成功
- [ ] Frontend build成功 (Next.js manifest issue - unrelated to this feature)
- [x] TypeScriptエラーなし

---

### CD-008: Testing
**Status**: Pending
**Priority**: Medium
**Prerequisites**: CD-007

**Description**:
機能テストを実施する。

**Test Cases**:
1. 曖昧な質問で掘り下げモードが開始される
2. ジャンル選択後、目的の候補が表示される
3. 目的選択後、回答の型の候補が表示される
4. 全て選択後、適切なエージェントに委譲される
5. 「その他」選択時にカスタム入力が可能

**Acceptance Criteria**:
- [ ] 全テストケースPass

---

## Implementation Notes

### Drilldown Detection Keywords
以下のキーワードパターンで曖昧な質問を検出:

```typescript
const VAGUE_PATTERNS = [
  /何か.*始め/,
  /新しい.*始め/,
  /自分.*変え/,
  /良い.*生活/,
  /もっと.*なりたい/,
  /改善.*したい/,
  /何か.*やりたい/,
  /何.*すれば/,
  /どう.*すれば/,
  // English patterns
  /want to start something/i,
  /want to change/i,
  /want to improve/i,
  /what should I/i,
];
```

### State Persistence
掘り下げ状態は会話履歴から復元する。各選択は以下の形式でメッセージに含まれる:

```json
{
  "type": "drilldown_selection",
  "selectionType": "drilldown_genre",
  "value": "health",
  "label": "健康・運動"
}
```

---

## Agent Coordination Notes

- このタスクはBackendとFrontendの両方に変更を加える
- CD-001〜CD-005はBackendの変更
- CD-006はFrontendの変更
- 並列で実施可能なタスク: CD-001 & CD-002
- CD-007のビルド確認は全実装完了後に実施

---

## Completion Checklist

- [x] All types defined (CD-001)
- [x] All categories defined (CD-002)
- [x] DrilldownController implemented (CD-003)
- [x] drilldownAnalysisTool created (CD-004)
- [x] Manager Agent extended (CD-005)
- [x] Frontend extended (CD-006)
- [x] Backend build successful (CD-007)
- [ ] Tests passing (CD-008)
- [x] Spec documents updated
- [x] COORDINATION.md updated
