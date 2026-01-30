# Agent-A 指示書: habit-goal-level-system プロパティテスト

## ミッション

habit-goal-level-system (82%) を100%完了させる。残りタスクはプロパティテストの実装。

## 作業開始手順

```bash
# 1. 最新を取得
git pull origin develop

# 2. ブランチ作成
git checkout -b feat/habit-goal-level-system-property-tests

# 3. BOARD.mdを更新（状態を「作業中」に）
# .claude/coordination/BOARD.md を編集してpush

# 4. 作業開始
```

## 対象ファイル

- `backend/src/services/thliAssessmentService.ts`
- `backend/src/services/babyStepGeneratorService.ts`
- `backend/src/services/usageQuotaService.ts`
- `backend/src/services/levelManagerService.ts`
- `backend/src/__tests__/services/*.property.test.ts` (新規作成)

## 残りタスク一覧

### Phase 1: コア計算系プロパティテスト（優先）

| タスク | 内容 | Property |
|--------|------|----------|
| 4.3.1 | ICI計算の正確性 | Property 4 |
| 4.4.1 | Missingness Firewall トリガー | Property 5 |
| 4.5.1 | 離散スコアセット検証 | Property 6 |
| 4.6.1 | VOI質問ランキング | Property 7 |

### Phase 2: データ整合性プロパティテスト

| タスク | 内容 | Property |
|--------|------|----------|
| 1.1 | スキーマ制約 | Property 1 |
| 4.8.1 | 評価データ完全性 | Property 2 |
| 4.8.2 | レベル変更履歴不変性 | Property 3 |

### Phase 3: その他プロパティテスト

詳細は `.kiro/specs/habit-goal-level-system/tasks.md` 参照。

## テスト作成ガイドライン

```typescript
// fast-check を使用したプロパティテストの例
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('THLI Assessment - Property Tests', () => {
  it('Property 4: ICI calculation should always be between 0 and 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ type: fc.constantFrom('U0', 'U1', 'U2', 'U3', 'U4') }), { minLength: 14, maxLength: 14 }),
        (facts) => {
          const ici = calculateICI(facts);
          return ici >= 0 && ici <= 1;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## テスト実行コマンド

```bash
cd backend
npm run test -- --grep "Property"
npm run test:watch  # 開発中
```

## 完了条件

1. 全プロパティテストが実装されている
2. `npm run test` が全てパスする
3. タスク 14, 19 の Checkpoint を完了

## 報告タイミング

1. Phase 1 完了時
2. Phase 2 完了時
3. 全完了時

## 報告形式

`.claude/coordination/REPORTS.md` に追記：

```markdown
## [YYYY-MM-DD HH:MM] Agent-A: habit-goal-level-system Phase X 完了

**状態**: 完了 / 進行中

### 実施内容
- Property X, Y, Z を実装

### 成果物
- backend/src/__tests__/services/thliAssessment.property.test.ts

### 次のアクション
- Phase Y に着手

---
```

## コミット形式

```bash
git commit -m "test(thli): add property tests for ICI calculation (Property 4)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

*作成: 2025-01-30 by Commander*
