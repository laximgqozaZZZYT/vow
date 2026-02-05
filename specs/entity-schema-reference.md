# Habit/Goal/Sticky'n スキーマリファレンス

## Habit

### データスキーマ

**フロントエンド型定義** (`frontend/app/dashboard/types/index.ts`):
```typescript
export interface Habit {
  id: string;
  goalId: string;
  name: string;
  active: boolean;
  type: "do" | "avoid";
  count: number;
  must: number;
  completed: boolean;
  lastCompletedAt?: string;
  duration?: number;
  reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[];
  dueDate?: string;
  time?: string;
  endTime?: string;
  repeat?: string;
  allDay?: boolean;
  notes?: string;
  tags?: Tag[];
  workloadUnit?: string;
  workloadTotal?: number;
  workloadTotalEnd?: number;
  workloadPerCount?: number;
  timings?: Timing[];
  outdates?: Timing[];
  level?: number | null;  // THLI-24: 0-199スケール
  levelTier?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
  levelAssessedAt?: string | null;
  levelAssessmentRaw?: {
    assessmentType: 'manual_slider' | 'ai_assessment';
    variables?: {
      frequency: number;
      duration: number;
      intensity: number;
      complexity: number;
      consistency: number;
    };
    level: number;
    assessedAt: string;
  } | null;
  domainCodes?: string[];  // ユーザーレベルシステムのドメインコード
  createdAt: string;
  updatedAt: string;
}
```

**バックエンド Zod スキーマ** (`backend/src/schemas/habit.ts`):
```typescript
export const habitSchema = z.object({
  id: z.string().uuid(),
  owner_type: z.string().default('user'),
  owner_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  goal_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
  frequency: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  target_count: z.number().int().positive().default(1),
  workload_unit: z.string().nullable().optional(),
  workload_per_count: z.number().positive().default(1),
  level: z.number().int().min(0).max(199).nullable().optional(),
  level_tier: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional(),
  level_assessment_data: z.record(z.unknown()).nullable().optional(),
  level_last_assessed_at: z.string().datetime().nullable().optional(),
  domain_codes: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
});
```

### 編集画面（Habit Modal）の項目

**タブ構成**: 4つのタブで習慣設定を管理

#### Tab 1: 基本 (BasicTab)
**入力フィールド**:
- **Name** (テキスト) - 必須、1-100文字
  - 型: `string`
  - デフォルト値: `""` (新規) または既存値
  - バリデーション: 空白チェック、最大文字数

- **Type** (ラジオボタン) - 必須、デフォルト: "do"
  - 型: `"do" | "avoid"`
  - オプション: "実行する" (do), "避ける" (avoid)

- **Timings** (複数セクション) - 1つ以上必須
  - 型: `Timing[]`
  - Timing構造:
    ```typescript
    interface Timing {
      type: 'Date' | 'Daily' | 'Weekly' | 'Monthly';
      date?: string;      // YYYY-MM-DD形式（Date型のみ）
      start?: string;     // HH:MM形式（15分単位）
      end?: string;       // HH:MM形式（15分単位）
      cron?: string;
    }
    ```
  - 各Timingには以下を設定可能:
    - Type: 特定の日、毎日、毎週、毎月
    - 開始時刻: 00:00～23:45（15分単位）
    - 終了時刻: 00:00～23:45（15分単位）
    - 日付（Dateタイプのみ）
  - バリデーション:
    - 開始時刻と終了時刻の形式チェック (HH:MM)
    - 終了時刻 > 開始時刻

- **Description** (テキストエリア) - 任意
  - 型: `string`
  - 最大値: 500文字
  - デフォルト値: `""` (新規) または既存値

- **Level表示** (読み取り専用、既存習慣のみ)
  - 型: `number | null` (0-199)
  - 表示フォーマット: `Lv. {level} ({levelTier})`

#### Tab 2: 除外日時 (ExclusionTab)
**入力フィールド**:
- **Outdates** (複数セクション) - 任意
  - 型: `Timing[]` (Timingと同じ構造)
  - 説明: 習慣を実行しない期間を指定
  - 追加方法: "除外期間を追加"ボタン
  - 削除方法: 各除外期間の削除ボタン

#### Tab 3: 負荷 (WorkloadTab)
**入力フィールド**:
- **Workload Unit** (テキスト) - 任意
  - 型: `string`
  - 例: "km", "回", "時間", "ページ"
  - デフォルト値: `""`

- **Load per Count** (数値入力) - 任意、デフォルト: 1
  - 型: `number`
  - 最小値: 1
  - 例: 1回の実行での負荷量
  - バリデーション: 正の整数

- **Load Total (Day)** (数値入力) - 任意
  - 型: `number`
  - デフォルト値: `""`
  - 説明: 1日の目標負荷量
  - バリデーション: 0以上の数値

- **Load Total (End)** (数値入力) - 任意
  - 型: `number`
  - デフォルト値: `""`
  - 説明: 最終的な目標負荷量（達成日数の計算に使用）
  - バリデーション: 0以上の数値

- **Level Assessment** (スライダー群、既存習慣のみ)
  - 型: 以下の5つの変数
    - frequency: 0-100 - 実施頻度（毎日を100%とする）
    - duration: 0-100 - 1回の実施時間
    - intensity: 0-100 - 強度・難度
    - complexity: 0-100 - 複雑さ
    - consistency: 0-100 - 継続性（定期的に実行できているか）
  - 出力: Level (0-199)

- **Auto Load per Set表示** (読み取り専用)
  - Timingsの開始/終了時刻から計算された自動負荷値
  - 表示フォーマット: 各Timing毎に計算結果を表示

#### Tab 4: 詳細 (DetailTab)
**入力フィールド**:
- **Goal** (ドロップダウン) - 任意
  - 型: `string (goalId)`
  - オプション: 利用可能なGoalのリスト
  - デフォルト値: 最初のGoalまたは初期値
  - ラベル: Goal名

- **Tags** (SmartSelector) - 任意、複数選択可
  - 型: `string[]` (tagIds)
  - 選択方法: タグをフィルタリングして検索・追加
  - 表示方法: スマートセレクターのチップ
  - 色付き表示対応

- **Related Habits** (折りたたみセクション) - 任意
  - セクション内フィールド:
    - **Habit Selector** (ドロップダウン)
      - 型: `string (habitId)`
      - オプション: 他の習慣（自身と既に関連付けられたものを除外）

    - **Relation Type** (ラジオボタン)
      - 型: `'main' | 'sub' | 'next'`
      - オプション:
        - "main": メインの習慣
        - "sub": サブ習慣（この習慣に従属）
        - "next": 次の習慣（この習慣の後に実行）

    - **Add Relation Button**
      - 選択された習慣と関連タイプで新しい関連を追加

    - **Relation List** (読み取り専用)
      - 既存の関連習慣をリスト表示
      - 削除ボタン付き

### 必須項目と任意項目

| フィールド | 必須 | タブ |
|-----------|------|-----|
| Name | ✓ | 基本 |
| Type | ✓ | 基本 |
| Timings | ✓ | 基本 |
| Description | ✗ | 基本 |
| Level表示 | - | 基本 |
| Outdates | ✗ | 除外日時 |
| Workload Unit | ✗ | 負荷 |
| Load per Count | ✗ | 負荷 |
| Load Total (Day) | ✗ | 負荷 |
| Load Total (End) | ✗ | 負荷 |
| Level Assessment | - | 負荷 |
| Goal | ✗ | 詳細 |
| Tags | ✗ | 詳細 |
| Related Habits | ✗ | 詳細 |

---

## Goal

### データスキーマ

**フロントエンド型定義** (`frontend/app/dashboard/types/index.ts`):
```typescript
export interface Goal {
  id: string;
  name: string;
  details?: string;
  dueDate?: string | Date | null;
  parentId?: string | null;
  isCompleted?: boolean;
  tags?: Tag[];
  domainCodes?: string[];  // ユーザーレベルシステムのドメインコード
  createdAt: string;
  updatedAt: string;
}
```

**バックエンド Zod スキーマ** (`backend/src/schemas/habit.ts`):
```typescript
export const goalSchema = z.object({
  id: z.string().uuid(),
  owner_type: z.string().default('user'),
  owner_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  level: z.number().int().min(0).max(199).nullable().optional(),
  level_tier: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional(),
  level_last_assessed_at: z.string().datetime().nullable().optional(),
  domain_codes: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
});
```

### 編集画面（Goal Modal）の項目

**モーダル構成**: スクロール可能なコンテンツエリア + 固定フッター

**入力フィールド**:
- **Name** (テキスト) - 必須、1-100文字
  - 型: `string`
  - デフォルト値: `""` (新規) または既存値
  - バリデーション: 空白チェック、最大文字数

- **Level表示** (読み取り専用、既存Goalのみ)
  - 型: `number | null` (0-199)
  - 説明: 関連する子Habitの最大レベル値を表示
  - 表示フォーマット: `Lv. {level} ({levelTier})`

- **Details** (テキストエリア) - 任意
  - 型: `string`
  - 最大値: 500文字
  - デフォルト値: `""` (新規) または既存値
  - プレースホルダー: "Optional details"

- **Due date** (カレンダーピッカー) - 任意、グリッド2カラム配置
  - 型: `Date | string | null` (YYYY-MM-DD形式)
  - デフォルト値: `undefined`
  - UI: Popoverで日付選択

- **Parent goal** (ドロップダウン) - 任意、グリッド2カラム配置
  - 型: `string | null` (parentGoalId)
  - オプション: 自身以外の全Goal、"(no parent)"
  - デフォルト値: `null`

- **Tags** (SmartSelector) - 任意、複数選択可
  - 型: `string[]` (tagIds)
  - 選択方法: タグをフィルタリングして検索・追加
  - 表示条件: tagsが存在する場合のみ表示

- **AI Habit提案** (折りたたみセクション、既存Goalのみ)
  - Premium Pro限定機能
  - 内部フィールド:
    - **提案生成ボタン**
      - クリックで AI が習慣提案を生成
      - 状態: 通常、読み込み中、提案表示

    - **提案リスト**（読み取り専用）
      - 各提案の表示:
        - 習慣名（太字）
        - 実施頻度: "毎日", "毎週", "毎月"
        - ターゲット数（複数の場合）
        - 理由（小字、灰色テキスト）
      - 追加ボタン: 習慣として追加

    - **エラー表示**
      - 402: "この機能はPremiumプランでのみ利用可能です"
      - 429: "今月のトークン上限に達しました"

### 必須項目と任意項目

| フィールド | 必須 | 説明 |
|-----------|------|------|
| Name | ✓ | Goal名 |
| Level表示 | - | 子Habitの最大値（読み取り専用） |
| Details | ✗ | Goal説明 |
| Due date | ✗ | 期限日 |
| Parent goal | ✗ | 親Goal（階層構造用） |
| Tags | ✗ | タグ |
| AI Habit提案 | - | Premium Pro限定 |

---

## Sticky'n

### データスキーマ

**フロントエンド型定義** (`frontend/app/dashboard/types/index.ts`):
```typescript
export interface Sticky {
  id: string;
  name: string;
  description?: string;
  completed: boolean;
  completedAt?: string;
  displayOrder: number;
  parentStickyId?: string | null;    // 親Sticky'nのID（ネスト対応）
  depth?: number;                     // ネストの深さ (0-2)
  agentTaskId?: string | null;        // エージェントタスクとの紐付け
  isReusable?: boolean;               // 繰り返し習慣の周期で自動リセット
  tags?: Tag[];
  goals?: Goal[];
  habits?: Habit[];
  children?: Sticky[];                // 子Sticky'n（フロントエンドで構築）
  createdAt: string;
  updatedAt: string;
}
```

**データベーススキーマ** (`supabase/migrations/20260116000000_add_stickies.sql`):
```sql
CREATE TABLE stickies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    display_order INTEGER DEFAULT 0,
    parent_sticky_id TEXT REFERENCES stickies(id) ON DELETE CASCADE,  -- 階層対応（20260120+）
    depth INTEGER DEFAULT 0,                                           -- ネスト深さ（20260120+）
    is_reusable BOOLEAN DEFAULT false                                  -- 使いまわし対応（20260212）
);

-- 関連テーブル
CREATE TABLE sticky_goals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, goal_id)
);

CREATE TABLE sticky_habits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, habit_id)
);

CREATE TABLE sticky_tags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sticky_id TEXT NOT NULL REFERENCES stickies(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    owner_type TEXT,
    owner_id TEXT,
    UNIQUE(sticky_id, tag_id)
);
```

### 編集画面（Sticky Modal）の項目

**モーダル構成**: ヘッダー（固定） + スクロール可能なコンテンツ + フッター（固定）

**入力フィールド**:
- **Name** (テキスト) - 必須、1-100文字
  - 型: `string`
  - デフォルト値: `""` (新規) または既存値
  - バリデーション: 空白チェック、最大文字数

- **Description** (テキストエリア) - 任意
  - 型: `string`
  - 最大値: 500文字
  - デフォルト値: `""` (新規) または既存値
  - 行数: 3行（最小）

- **Parent Sticky'n** (ドロップダウン) - 任意、折りたたみセクション
  - 型: `string | null` (parentStickyId)
  - オプション: 利用可能な親Sticky（MAX_NESTING_DEPTH以下の深さ）
  - デフォルト値: `initialParentId` または `null`
  - 制限: 最大ネスト深さ=3（MAX_NESTING_DEPTH）
  - 表示: 親を選択した場合、現在のネストレベルを表示
  - 深さインジケーター: ドット（●）で現在の階層を視覚化

- **Tags** (SmartSelector) - 任意、複数選択可
  - 型: `string[]` (tagIds)
  - 選択方法: タグをフィルタリングして検索・追加
  - デフォルト値: 既存タグの配列

- **Related Goals** (折りたたみセクション) - 任意
  - 型: `string[]` (goalIds)
  - 内部UI: SmartSelector
  - バッジ: 選択数を表示
  - 削除方法: 各タグのX ボタン

- **Related Habits** (折りたたみセクション) - 任意
  - 型: `string[]` (habitIds)
  - 内部UI: SmartSelector（カラー対応：do=青、avoid=赤）
  - バッジ: 選択数を表示
  - 削除方法: 各タグのX ボタン

- **Is Reusable** (トグル/チェックボックス) - 任意、デフォルト: false
  - 型: `boolean`
  - 説明: "使いまわし" - 関連する繰り返し習慣(Daily/Weekly/Monthly)の周期リセット時に自動リセット

### 必須項目と任意項目

| フィールド | 必須 | 説明 |
|-----------|------|------|
| Name | ✓ | Sticky'n名 |
| Description | ✗ | 説明 |
| Parent Sticky'n | ✗ | 親Sticky（ネスト用） |
| Tags | ✗ | タグ |
| Related Goals | ✗ | 関連Goal |
| Related Habits | ✗ | 関連Habit |
| Is Reusable | ✗ | 周期的リセット対応 |

---

## チャットエージェントへの推奨プロンプト

### 1. システムプロンプト（基本設定）

```markdown
# VOW AI コーチングエージェント

あなたは「VOW」という習慣・目標管理アプリケーションのAIコーチです。
ユーザーの習慣達成や目標達成をサポートする専門家として行動してください。

## 基本原則
1. **ユーザーの現在の習慣データを把握する** - Analyze Habits ツールで習慣分析
2. **実現可能なアドバイスを提供** - ユーザーの実績に基づいた段階的な提案
3. **モチベーション維持** - 達成を認め、失敗時も前向きにサポート
4. **個別化した指導** - ユーザーの興味や習慣パターンに合わせたカスタマイズ

## 会話スタイル
- フレンドリーで親しみやすいトーン
- 短めの文章で、ポイント明確に
- 絵文字活用（ただし過度でない）
- 日本語での回答
```

### 2. ツール実行フロー

**ツール定義**（`backend/src/agents/shared-tools/coach-tools.ts`）:

#### analyze_habits
```markdown
**用途**: 習慣分析
**入力パラメータ**:
- period: 'day' | 'week' | 'month' | 'quarter' | 'year' (デフォルト: 'month')
- habitIds: UUID[] (特定の習慣、省略時は全習慣)
- includeInsights: boolean (AI洞察を含めるか、デフォルト: true)

**出力**:
- 実行回数、完了率、平均ストリーク
- カテゴリー別の成績
- AI洞察・改善提案
```

#### suggest_goals
```markdown
**用途**: ユーザーの現状に基づいた目標提案
**入力パラメータ**:
- category: 'health' | 'fitness' | 'learning' | 'career' | 'finance' | 'relationships' | 'wellness' | 'mindfulness' | ... (省略時は全カテゴリ)
- count: 1-10 (デフォルト: 3)
- considerExisting: boolean (既存習慣・目標を考慮、デフォルト: true)

**出力**:
- 目標名
- 説明・理由
- 推奨優先度
- 関連する習慣提案
```

#### suggest_habits
```markdown
**用途**: カテゴリー別・段階別の習慣提案
**入力パラメータ**:
- category: 'health' | 'fitness' | 'productivity' | 'learning' | 'wellness' | 'mindfulness' | ...
- count: 1-10 (デフォルト: 3)
- considerExisting: boolean (既存習慣を考慮, デフォルト: true)

**出力**:
- 習慣名
- 説明（なぜこれが役立つか）
- 推奨開始難度 (beginner/intermediate/advanced)
- 見積実行時間
- 推奨周期 (daily/weekly/monthly)
```

#### check_progress
```markdown
**用途**: 習慣・目標の進捗確認
**入力パラメータ**:
- entityType: 'habit' | 'goal' (デフォルト: 'habit')
- entityId: UUID (省略時は全体進捗)
- period: 'day' | 'week' | 'month' | ...

**出力**:
- 現在の進捗率
- 目標達成までの残り
- 最近のトレンド
- 改善アドバイス
```

#### generate_baby_steps
```markdown
**用途**: 習慣の段階的改善計画を生成
**入力パラメータ**:
- habitId: UUID (習慣ID)
- currentLevel: 0-199 (現在のレベル)
- targetType: 'lv50' | 'lv10' | 'custom' (目標タイプ)
- customTargetLevel: 0-199 (custom選択時)

**出力**:
- BabyStepPlan:
  - step数
  - 各ステップでの変更（負荷、頻度、時間など）
  - 推定実施期間
  - 各ステップのマイルストーン
```

#### generate_advice
```markdown
**用途**: ユーザーの状況に応じたパーソナライズアドバイス
**入力パラメータ**:
- adviceType: 'general' | 'motivation' | 'strategy' | 'recovery' | 'celebration'
- focusArea: string (特定の習慣・目標名, 省略可)
- userMood: 'positive' | 'neutral' | 'struggling' | 'uncertain'
- creativityLevel: 1-3 (1=保守的, 2=バランス, 3=クリエイティブ)

**出力**:
- 具体的なアドバイス（3-5段落）
- 実行可能なアクション
```

#### show_choice_buttons
```markdown
**用途**: ユーザーに選択肢をボタン形式で提示
**入力パラメータ**:
- title: string (タイトル)
- choices: Array<{
    id: string,
    label: string,
    type: 'habit' | 'goal' | 'category' | 'text' | 'reply' | 'action',
    icon?: string (絵文字),
    description?: string
  }>
- layout: 'vertical' | 'horizontal' | 'grid'
- size: 'sm' | 'md' | 'lg'

**重要**: 選択肢をテキストで列挙する代わりに、このツールでボタンを表示
```

### 3. 会話フロー例

```markdown
## ユーザーが曖昧な質問をした場合

**例**: 「習慣を増やしたい」

1. show_choice_buttons で習慣カテゴリを選択肢として提示
2. ユーザーの選択を待つ
3. suggest_habits でカテゴリ内の習慣を提案
4. ユーザーが選択した習慣を generate_baby_steps でステップ化

## ユーザーが進捗報告をした場合

**例**: 「最近習慣をサボっちゃってる」

1. check_progress で期間別の進捗を確認
2. analyze_habits で失敗パターンを分析
3. generate_advice (type: 'recovery') で復帰アドバイス
4. suggest_habits (カテゴリ: 現在の習慣に関連) でリスタート習慣を提案
5. generate_baby_steps で小さいステップから始めるプランを作成
```

### 4. Levelシステムの連携

```markdown
## Level評価の活用

**レベルティア**:
- beginner (Lv.0-49): 初級
- intermediate (Lv.50-99): 中級
- advanced (Lv.100-149): 上級
- expert (Lv.150-199): 達人

**会話での使い分け**:
- beginner: 基本を徹底、実行を重視
- intermediate: バリエーション追加、工夫を促す
- advanced: 効率化、他者への指導
- expert: カスタマイズ、新しい挑戦

**Level Assessment Variables**（作成時のスライダー入力）:
- frequency: 実施頻度（毎日を100%）
- duration: 1回の実施時間
- intensity: 強度・難度
- complexity: 複雑さ
- consistency: 継続性（規則的か）
```

### 5. クォータ管理

```markdown
## 無料ユーザー vs Premium Pro

**Free Plan**:
- coach_interactions: 月10回まで
- suggest_habits, suggest_goals, generate_baby_steps のみ使用可
- クォータ使用時に402エラー

**Premium Pro**:
- 制限なし（月額課金）
- 全ツール使用可
- AI Habit提案（Goal内の折りたたみセクション）も無制限

**エージェント側での対応**:
1. ツール実行前に subscriptionService でプラン確認
2. Free ユーザーでクォータ超過時は helpful なメッセージを表示
3. Premium upgrade への案内（ただし強引でない）
```

### 6. プロンプトテンプレート

#### 習慣分析リクエスト時
```markdown
"先月1ヶ月間で、あなたの習慣パフォーマンスを分析してみます。

【分析結果】
- 実行習慣: {count}個
- 平均完了率: {rate}%
- 最長ストリーク: {days}日

【改善ポイント】
- ...

【今週のアクション】
1. ...
```

#### 目標提案時
```markdown
"あなたの習慣傾向から、次のような目標がおすすめです：

🎯 【目標1】{goal_name}
├─ 理由: {why}
├─ 推奨難度: {difficulty}
└─ 関連習慣: {related_habits}

[追加] [詳細] [別の提案]
```

#### 失敗・スランプ時
```markdown
"習慣がうまくいってないんですね。それは誰にでもあるものです。

【現在の状況】
- 完了率: {rate}%
- {problem}

【復帰プラン】
1. 小さく始める
   - ...
2. 環境を整える
   - ...
3. サポート体制
   - ...

一緒に頑張りましょう💪
```

---

## APIエンドポイント（参考）

### Habit 関連
- GET `/api/habits` - ユーザーの全Habit取得
- POST `/api/habits` - 新規Habit作成
- PUT `/api/habits/{id}` - Habit更新
- DELETE `/api/habits/{id}` - Habit削除

### Goal 関連
- GET `/api/goals` - ユーザーの全Goal取得
- POST `/api/goals` - 新規Goal作成
- PUT `/api/goals/{id}` - Goal更新
- DELETE `/api/goals/{id}` - Goal削除

### Sticky 関連
- GET `/api/stickies` - ユーザーの全Sticky'n取得
- POST `/api/stickies` - 新規Sticky'n作成
- PUT `/api/stickies/{id}` - Sticky'n更新
- DELETE `/api/stickies/{id}` - Sticky'n削除
- PATCH `/api/stickies/{id}/complete` - Sticky'n完了/未完了切り替え

### Coach Agent 関連
- POST `/api/ai/coach/chat` - コーチとのチャット
- POST `/api/ai/suggest-habits` - 習慣提案（Goal内UI用）

---

## 重要ファイル一覧

### フロントエンド
| ファイル | 説明 |
|---------|------|
| `/frontend/app/dashboard/types/index.ts` | Habit/Goal/Sticky型定義 |
| `/frontend/app/dashboard/components/Modal.Habit.tsx` | Habit編集モーダル |
| `/frontend/app/dashboard/components/Modal.Goal.tsx` | Goal編集モーダル |
| `/frontend/app/dashboard/components/Modal.Sticky.tsx` | Sticky'n編集モーダル |
| `/frontend/app/dashboard/components/tabs/*.tsx` | Habit 4タブコンポーネント |

### バックエンド
| ファイル | 説明 |
|---------|------|
| `/backend/src/schemas/habit.ts` | Habit/Goal/Activity Zod スキーマ |
| `/backend/src/repositories/habitRepository.ts` | Habit DB操作 |
| `/backend/src/repositories/goalRepository.ts` | Goal DB操作 |
| `/backend/src/repositories/stickyRepository.ts` | Sticky DB操作 |
| `/backend/src/agents/shared-tools/coach-tools.ts` | コーチツール定義 |
| `/backend/src/agents/mastra/vow-coach-agent.ts` | コーチエージェント実装 |

### データベース
| ファイル | 説明 |
|---------|------|
| `/supabase/migrations/20260116000000_add_stickies.sql` | Sticky'n テーブル定義 |
| `/supabase/migrations/20260128000000_add_level_system.sql` | レベルシステム テーブル |

