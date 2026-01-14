# Habit名表示の改善 - スクロールアニメーションとスマホ対応

## 実装した改善点

### 1. 長いHabit名のスクロールアニメーション

#### デスクトップ（マウス操作）
- ホバー時に自動的に右にスクロール
- 8秒かけてゆっくりスクロール（無限ループ）
- テキストが短い場合はアニメーションなし

#### スマホ（タッチ操作）
- タップ（active状態）時に1回スクロール
- タップハイライトを無効化して自然な操作感

### 2. スマホ対応の改善

#### レイアウト調整
- **左ペイン（サイドバー）**:
  - 閉じるボタンのタッチターゲットを44x44pxに拡大
  - スクロール性能の最適化（`overscroll-contain`）
  - ヘルプテキストの行間を調整

- **Nextセクション**:
  - パディングをスマホで縮小（p-3）、デスクトップで標準（p-4）
  - 見出しサイズをレスポンシブに調整

#### ボタンとインタラクション
- **完了ボタン（✓）**:
  - 最小サイズ32x32pxを確保（タッチしやすい）
  - `active:bg-green-800`でタップフィードバック追加
  - flexboxで中央配置

- **数値入力フィールド**:
  - スマホで幅を10に縮小、デスクトップで12
  - パディングを調整してタップしやすく

- **ユニット表示**:
  - スマホでは非表示（`hidden sm:inline`）
  - スペースを節約

#### Habit名の表示
- `gap-2`を追加して要素間のスペースを確保
- `py-2.5`（スマホ）、`py-2`（デスクトップ）で適切な高さ
- `shrink-0`で重要な要素（アイコン、ボタン）が縮まないように

### 3. CSS実装

**ファイル**: `frontend/app/dashboard/components/HabitNameScroll.css`

```css
/* ホバー/タップでスクロール */
@media (hover: hover) and (pointer: fine) {
  .habit-name-scroll:hover .habit-name-text {
    animation: scroll-text-left 8s linear infinite;
  }
}

@media (hover: none) and (pointer: coarse) {
  .habit-name-scroll:active .habit-name-text {
    animation: scroll-text-left 8s linear 1;
  }
}
```

### 4. 影響を受けるコンポーネント

1. **Widget.GoalTree.tsx** - 左ペインのHabit表示
2. **Section.Next.tsx** - Nextセクション
3. **Layout.Sidebar.tsx** - サイドバー全体

## 使用方法

Habit名が長い場合：
- **デスクトップ**: Habit名にマウスをホバーすると自動スクロール
- **スマホ**: Habit名をタップすると1回スクロール

## 技術的な詳細

### メディアクエリの使い方
- `(hover: hover) and (pointer: fine)` - マウス操作可能なデバイス
- `(hover: none) and (pointer: coarse)` - タッチ操作のみのデバイス

### アクセシビリティ
- 最小タッチターゲット: 32x32px（推奨44x44px）
- 十分なコントラスト比
- テキストの可読性を維持

### パフォーマンス
- CSS transformを使用（GPUアクセラレーション）
- `overscroll-contain`でスクロール性能向上
- アニメーションは必要な場合のみ実行

## 今後の改善案

1. テキストの長さを動的に検出してアニメーション速度を調整
2. ユーザー設定でアニメーションのオン/オフを切り替え
3. より滑らかなスクロール効果（イージング関数の調整）
4. ダークモードでのコントラスト最適化
