---
inclusion: always
---

# Design System Rules for Figma Integration

このプロジェクトは Next.js + React + Tailwind CSS を使用した習慣管理ダッシュボードアプリです。
Figma からコードを生成する際は、以下のルールに従ってください。

## 1. デザイントークン

### カラーシステム
CSS 変数で定義されたセマンティックカラーを使用：

```css
/* 背景・前景 */
--color-background    /* メイン背景 */
--color-foreground    /* メインテキスト */
--color-card          /* カード背景 */
--color-muted         /* 控えめな背景 */

/* インタラクティブ */
--color-primary       /* プライマリアクション */
--color-destructive   /* 削除・危険なアクション */
--color-success       /* 成功状態 */
--color-warning       /* 警告状態 */

/* ボーダー・入力 */
--color-border        /* ボーダー */
--color-input         /* 入力フィールド */
```

Tailwind クラス例：
- `bg-background`, `bg-card`, `bg-muted`, `bg-primary`
- `text-foreground`, `text-muted-foreground`, `text-primary`
- `border-border`, `border-input`

### スペーシング
8px ベースのスケール：
- `--spacing-1`: 4px
- `--spacing-2`: 8px
- `--spacing-4`: 16px
- `--spacing-6`: 24px
- `--spacing-8`: 32px

### 角丸
```css
--radius-sm: 6px
--radius-md: 8px
--radius-lg: 12px
--radius-xl: 16px
```

### シャドウ
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)
```

## 2. タイポグラフィ

フォント: Geist Sans（Next.js 組み込み）

```css
.text-display  /* 36px, bold, -0.02em */
.text-h1       /* 30px, semibold */
.text-h2       /* 24px, semibold */
.text-h3       /* 20px, semibold */
.text-body     /* 16px, normal */
.text-small    /* 14px, normal */
.text-caption  /* 12px, normal */
```

## 3. コンポーネント構造

### ファイル配置
```
frontend/
├── app/
│   └── dashboard/
│       └── components/
│           ├── Layout.*.tsx      # レイアウト系
│           ├── Modal.*.tsx       # モーダル系
│           ├── Section.*.tsx     # セクション系
│           ├── Widget.*.tsx      # ウィジェット系
│           └── Form.*.tsx        # フォーム系
├── components/                   # 共通コンポーネント
├── hooks/                        # カスタムフック
└── lib/                          # ユーティリティ
```

### 命名規則
- コンポーネント: `PascalCase`（例: `Modal.Habit.tsx`）
- フック: `use` プレフィックス（例: `useAuth.ts`）
- ユーティリティ: `camelCase`

## 4. Figma → コード変換ルール

### やるべきこと
1. Tailwind のハードコード値をデザイントークンに置換
   - `bg-[#ffffff]` → `bg-background`
   - `text-[#171717]` → `text-foreground`
   - `rounded-[8px]` → `rounded-md`

2. 既存コンポーネントを再利用
   - ボタン、入力、モーダルは既存パターンを参照

3. ダークモード対応
   - `class` 戦略を使用
   - CSS 変数が自動でダークモードに対応

4. レスポンシブ対応
   - モバイル: `max-w-768px`
   - タッチターゲット: 最小 44px

### やってはいけないこと
- ハードコードされた色値の使用
- 既存コンポーネントの重複作成
- `!important` の乱用

## 5. アクセシビリティ

- フォーカス表示: `focus-visible` を使用
- タッチターゲット: 最小 44x44px
- `prefers-reduced-motion` を尊重
- セマンティック HTML を使用

## 6. 使用ライブラリ

- UI: React 19, Next.js 16
- スタイリング: Tailwind CSS 4
- グラフ: React Flow（マインドマップ）
- カレンダー: FullCalendar
- アイコン: インラインSVG

## 7. コード例

### ボタン
```tsx
<button className="
  px-4 py-2 
  bg-primary text-primary-foreground 
  rounded-md shadow-sm
  hover:opacity-90 
  focus-visible:outline-2 focus-visible:outline-primary
  transition-opacity
">
  保存
</button>
```

### カード
```tsx
<div className="
  p-4 
  bg-card 
  border border-border 
  rounded-lg shadow-md
">
  {children}
</div>
```

### モーダル
```tsx
<div className="
  fixed inset-0 z-50 
  flex items-center justify-center 
  bg-black/50
">
  <div className="
    w-full max-w-md p-6 
    bg-card rounded-xl shadow-lg
  ">
    {children}
  </div>
</div>
```
