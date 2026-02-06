# {Feature Name} 仕様書

## 概要

**ステータス**: draft | ready | in-progress | review | done
**作成日**: YYYY-MM-DD
**作成者**: {agent-name}

### 背景
{なぜこの機能が必要か}

### 目的
{何を達成したいか}

---

## 要件 (Requirements)

### 機能要件

1. **REQ-001**: {要件の説明}
   - 受け入れ条件: {完了の定義}

2. **REQ-002**: {要件の説明}
   - 受け入れ条件: {完了の定義}

### 非機能要件

- パフォーマンス: {目標値}
- セキュリティ: {考慮事項}
- アクセシビリティ: {対応レベル}

---

## 設計 (Design)

### アーキテクチャ

```
{コンポーネント図やデータフロー図}
```

### データモデル

```typescript
interface Example {
  id: string;
  // ...
}
```

### API設計

```typescript
// エンドポイント定義
POST /api/example
Request: { ... }
Response: { ... }
```

---

## タスク分解 (Tasks)

### Task 1: {タスク名}
- **担当**: frontend-implementer
- **モデル**: opus
- **ファイル**:
  - `frontend/app/dashboard/components/XXX.tsx`
- **依存**: なし
- **見積もり**: {時間}
- **ステータス**: pending

**詳細**:
{実装の詳細説明}

**受け入れ条件**:
- [ ] 条件1
- [ ] 条件2

---

### Task 2: {タスク名}
- **担当**: backend-implementer
- **モデル**: opus
- **ファイル**:
  - `backend/src/services/XXXService.ts`
- **依存**: Task 1
- **見積もり**: {時間}
- **ステータス**: pending

**詳細**:
{実装の詳細説明}

**受け入れ条件**:
- [ ] 条件1
- [ ] 条件2

---

### Task 3: {タスク名}
- **担当**: mcp-implementer
- **モデル**: opus
- **ファイル**:
  - `~/.mcp-multi-agent/mcp-task-distributor/src/XXX.ts`
- **依存**: なし
- **見積もり**: {時間}
- **ステータス**: pending

---

## テスト計画

### 単体テスト
- [ ] {テスト項目}

### 統合テスト
- [ ] {テスト項目}

### E2Eテスト
- [ ] {テスト項目}

---

## 完了の定義 (Definition of Done)

- [ ] すべてのタスクが完了
- [ ] テストがパス
- [ ] コードレビュー完了
- [ ] ドキュメント更新
