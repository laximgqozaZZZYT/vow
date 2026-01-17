# 統合 Goal & Habit Relation Map (Mind Map)

## 概要

Goal & Habit Relation MapとMind Mapを統合した新しいコンポーネントです。Goal & Habit Relation Mapの表示ベースを維持しつつ、Mind Mapの編集機能と操作性を統合しています。

## 主な機能

### 1. Goal & Habit Relation Mapの表示機能

- **Goal階層の可視化**: 親子関係のあるGoalをツリー構造で表示
- **Habit配置**: 各Goalに紐づくHabitを右側に配置
- **Main-Sub関係**: Main HabitとSub Habitをグループ化して表示
- **Next関係**: Habit間の「次に行う」関係を矢印で表示
- **進捗表示**: 各ノードに進捗バーとパーセンテージを表示

### 2. Mind Mapの編集機能

#### ノード編集
- **ダブルクリック編集**: ノードをダブルクリックしてテキストを編集
- **Enter**: 編集を確定
- **Escape**: 編集をキャンセル

#### 新しいノードを生やす
- **ハンドルからドラッグ**: ノードのハンドル（接続点）から空白領域にドラッグすると、新しいノードが自動的に作成され接続されます
- **自動編集モード**: 新しく作成されたノードは自動的に編集モードになります

#### 右クリックメニュー（PC）
- **テキスト編集**: ノードのテキストを編集
- **習慣として登録**: ノードを実際のHabitとして登録（データベースに保存）
- **目標として登録**: ノードを実際のGoalとして登録（データベースに保存）
- **削除**: ノードを削除

#### 新しい群を追加
- **+ボタン**: 画面左下の+ボタンで新しい独立したGoal群を追加
- 既存の群の下に新しいGoalノードが作成されます

### 3. グループ分割表示機能

つながっているGoal・Habit群ごとに分割して表示できます。

#### 使い方
1. ヘッダー部分に「全体表示」「群1」「群2」...のボタンが表示されます
2. 各ボタンをクリックすると、その群のみを表示します
3. 「全体表示」をクリックすると、すべての群を表示します

#### グループ検出ロジック
- Goal階層の親子関係
- Goal-Habit間の紐付け
- Habit間のNext関係
- Main-Sub関係

これらの関係で接続されているノードを1つの群として検出します。

## 使用方法

### Mind Mapセクションとして使用

dashboard/page.tsxで自動的にMind Mapセクションとして表示されます：

```tsx
import MindmapSection from './components/Section.Mindmap'

<MindmapSection
  goals={goals}
  habits={habits}
  onRegisterAsHabit={(data) => createHabit(data)}
  onRegisterAsGoal={(payload) => createGoal(payload)}
/>
```

### 埋め込みモード

```tsx
import { UnifiedRelationMap } from './components/Widget.UnifiedRelationMap'

<UnifiedRelationMap
  habits={habits}
  goals={goals}
  onClose={() => {}}
  embedded={true}
  onRegisterAsHabit={(data) => createHabit(data)}
  onRegisterAsGoal={(payload) => createGoal(payload)}
/>
```

### フルスクリーンモード

```tsx
import { UnifiedRelationMap } from './components/Widget.UnifiedRelationMap'

<UnifiedRelationMap
  habits={habits}
  goals={goals}
  onClose={() => setShowMap(false)}
  embedded={false}
  onRegisterAsHabit={(data) => createHabit(data)}
  onRegisterAsGoal={(payload) => createGoal(payload)}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| habits | Habit[] | Yes | 表示するHabitの配列 |
| goals | Goal[] | Yes | 表示するGoalの配列 |
| onClose | () => void | Yes | 閉じるボタンのコールバック |
| embedded | boolean | No | 埋め込みモードかどうか（デフォルト: false） |
| onRegisterAsHabit | (data: any) => void | No | Habitとして登録するコールバック |
| onRegisterAsGoal | (data: any) => void | No | Goalとして登録するコールバック |

## 操作方法

### PC
- **ダブルクリック**: ノードを編集
- **右クリック**: コンテキストメニューを表示
- **ドラッグ**: ノードを移動
- **ハンドルドラッグ（空白へ）**: 新しいノードを生やす
- **ハンドルドラッグ（ノードへ）**: ノード間を接続
- **マウスホイール**: ズーム
- **ドラッグ（背景）**: パン
- **+ボタン**: 新しい群（Goal）を追加

### モバイル
- **ダブルタップ**: ノードを編集
- **ピンチ**: ズーム
- **ドラッグ**: パン
- **ハンドルタップ**: 接続開始

## レイアウト

### Goal配置
- ルートGoalを左上から縦方向に配置
- 子Goalは親Goalの下に配置
- 各Goalツリーは大きな間隔で分離

### Habit配置
- Goalの右側に配置
- 各Habitは水平方向にずらして配置（結線の重なりを防ぐ）
- Main-SubグループはまとめてBox表示

### エッジスタイル
- **Goal階層**: 紫色の実線、矢印付き
- **Goal→Habit**: 紫色の破線
- **Next関係**: 緑色の実線、矢印付き、アニメーション

## 統合のメリット

1. **一貫性**: Goal & Habit Relation Mapの見た目を維持
2. **編集性**: Mind Mapの直感的な編集機能を利用可能
3. **柔軟性**: グループ分割表示で複雑な関係も見やすく
4. **拡張性**: 新規ノード追加や接続作成が簡単
5. **実用性**: ノードを直接Habit/Goalとして登録可能

## ワークフロー例

### 1. 新しいGoal群を作成
1. 左下の+ボタンをクリック
2. 新しいGoalノードが作成され、編集モードになる
3. Goal名を入力してEnter

### 2. Habitを追加
1. Goalノードのハンドル（右側の接続点）をドラッグ
2. 空白領域でドロップ
3. 新しいノードが作成され、自動的に接続される
4. Habit名を入力してEnter

### 3. Habitを実際に登録
1. ノードを右クリック
2. 「習慣として登録」を選択
3. Habitモーダルで詳細を入力
4. 保存すると、実際のHabitとしてデータベースに保存される

### 4. Next関係を設定
1. あるHabitのハンドルから別のHabitへドラッグ
2. 緑色の矢印で接続される
3. 「次に行う」関係が可視化される

## 今後の拡張案

- [ ] ノードの色分けカスタマイズ
- [ ] フィルタリング機能（完了済み/未完了）
- [ ] エクスポート機能（画像、JSON）
- [ ] ノードの自動配置アルゴリズム改善
- [ ] タッチジェスチャーの拡張（モバイル）
- [ ] ノードのアイコンカスタマイズ
- [ ] 複数選択と一括操作
