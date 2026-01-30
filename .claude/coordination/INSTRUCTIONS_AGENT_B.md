# Agent-B 指示書: user-level-system フロントエンド実装

## ミッション

user-level-system (52%) の進捗を75%以上に引き上げる。フロントエンドUI実装に集中。

## 作業開始手順

```bash
# 1. 最新を取得
git pull origin develop

# 2. ブランチ作成
git checkout -b feat/user-level-system-frontend

# 3. BOARD.mdを更新（状態を「作業中」に）
# .claude/coordination/BOARD.md を編集してpush

# 4. 作業開始
```

## 対象ファイル

- `frontend/app/dashboard/components/Widget.*.tsx`
- `frontend/app/dashboard/components/Section.*.tsx`
- `frontend/app/dashboard/components/Modal.*.tsx`
- `frontend/app/dashboard/components/Chart.*.tsx`

## 残りタスク一覧

### Phase 1: 共通コンポーネント（優先）

| タスク | 内容 | 優先度 |
|--------|------|--------|
| 12.2 | Widget.SkillGauge | High |
| 13.2 | Section.UserLevel | High |

### Phase 2: モーダルコンポーネント

| タスク | 内容 | 優先度 |
|--------|------|--------|
| 14.1 | Modal.ExpertiseList | Medium |
| 14.2 | Modal.DomainDetails | Medium |
| 14.3 | Modal.LevelHistory | Medium |

### Phase 3: チャート・追加機能

| タスク | 内容 | 優先度 |
|--------|------|--------|
| 15.1 | Chart.ExpertiseRadar | Medium |
| 17.1 | 習慣作成ドメイン選択 | Low |
| 17.2 | 習慣編集ドメイン選択 | Low |

## コンポーネント設計ガイドライン

### デザインシステム参照

`.kiro/steering/design-system.md` に従う：

- カラー: 既存のTailwind CSS変数を使用
- スペーシング: 4px単位 (p-1, p-2, p-4...)
- レスポンシブ: モバイルファースト

### Widget.SkillGauge 仕様

```tsx
interface SkillGaugeProps {
  label: string;
  value: number;      // 0-100
  maxValue?: number;  // default: 100
  color?: string;     // Tailwind color class
  size?: 'sm' | 'md' | 'lg';
}

// 使用例
<Widget.SkillGauge
  label="習慣継続力"
  value={75}
  color="text-green-500"
/>
```

### Section.UserLevel 仕様

```tsx
// 表示内容
// - 総合レベルカード（大きく表示）
// - 習慣継続力ゲージ
// - レジリエンススコアゲージ
// - Top 5 専門性ドメインリスト
```

## 既存コンポーネント参照

類似実装の参考：

- `frontend/app/dashboard/components/Widget.HabitProgress.tsx`
- `frontend/app/dashboard/components/Section.Statistics.tsx`
- `frontend/app/dashboard/components/Modal.HabitDetails.tsx`

## テスト実行コマンド

```bash
cd frontend
npm run test
npm run lint
```

## 完了条件

1. Phase 1 のコンポーネントが実装されている
2. 既存のデザインシステムに準拠している
3. `npm run lint` がパスする

## 報告タイミング

1. Widget.SkillGauge 完了時
2. Section.UserLevel 完了時
3. Phase 2 完了時

## 報告形式

`.claude/coordination/REPORTS.md` に追記：

```markdown
## [YYYY-MM-DD HH:MM] Agent-B: user-level-system Phase X 完了

**状態**: 完了 / 進行中

### 実施内容
- Widget.SkillGauge を実装
- Section.UserLevel を実装

### 成果物
- frontend/app/dashboard/components/Widget.SkillGauge.tsx
- frontend/app/dashboard/components/Section.UserLevel.tsx

### スクリーンショット
（可能であれば）

### 次のアクション
- Phase Y に着手

---
```

## コミット形式

```bash
git commit -m "feat(user-level): add SkillGauge widget component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## 注意事項

- Agent-A と編集ファイルが重複しないよう注意
- backend/ は編集しない
- 共通ファイル編集が必要な場合は司令塔に報告

---

*作成: 2025-01-30 by Commander*
