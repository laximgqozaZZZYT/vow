## /dashboard - MOC（画面設計）

目的
- ユーザーがカテゴリー（フォルダ）と習慣（ファイル）を一覧で確認・追加できるダッシュボード。

レイアウト（左右分割）
- 左ペイン（幅 320px 程度）: カテゴリー一覧（フォルダ風）と、選択したカテゴリー内の習慣一覧（ファイル風）。
  - 左ペイン上部: カテゴリー一覧（折りたたみ可）
  - 左ペイン中段: 選択中カテゴリーの習慣リスト
  - 左ペイン下部: アクションボタン [+ New Category] [+ New Habbit]
- 右ペイン（残り領域）: 統計情報（概況カード、グラフ、最近の履歴など）

主要コンポーネント
- CategoryList
  - props: categories: Category[]
  - UI: フォルダアイコン + カテゴリ名 + 選択状態
- HabitsList
  - props: habits: Habit[]
  - UI: ファイルアイコン + 習慣名 + スイッチ（達成/未達）
- StatsPanel
  - props: summary: SummaryData
  - UI: 今日の達成数、連続日数、週/月の達成グラフ（MOCでは静的サンプル）
- NewCategoryModal
  - フォーム: 名前（必須）、色（任意）
- NewHabitModal
  - フォーム: 名前（必須）、カテゴリー選択、頻度（毎日/週/カスタム）

データ形（MOC）
- Category: { id: string, name: string, color?: string }
- Habit: { id: string, categoryId: string, name: string, active: boolean }
- SummaryData: { todayCount: number, streak: number, weekly: number[] }

画面遷移/操作
- 左ペインでカテゴリをクリック → そのカテゴリが選択され、習慣リストを表示
- [+ New Category] → NewCategoryModal を開く → 保存で一覧に追加（MOCではローカル state）
- [+ New Habbit] → NewHabitModal を開く → 保存で選択カテゴリに追加（選択カテゴリがない場合はカテゴリ選択を促す）

ワイヤーフレーム（テキスト）
- 左ペイン
  - [Folder] 仕事
  - [Folder] パーソナル
  - ---
  - Habits (for selected category)
  - [file] 早起き
  - [file] 運動
  - ---
  - [+ New Category] [+ New Habbit]
- 右ペイン
  - Card: 今日の達成 3/5
  - Card: 連続日数 12日
  - グラフ（週次サンプル）

備考
- MOC は最小限のクライアントサイドロジックで動くことを優先。実装時は Context または軽量な state 管理（useState）で十分。
