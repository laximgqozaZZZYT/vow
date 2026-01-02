# Issues / Follow-ups

## Calendar: [today] scrollToTime() が効かず 0:00 起点になる

### 期待する挙動
- Dashboard の Calendar で `today` を選択/押下した直後、現在時刻（nowIndicator の赤線）付近が中央に来るように自動スクロールして表示したい。

### 現象
- `today` 押下後（および初回表示）に、表示開始が 0:00 になってしまい、自動スクロールが反映されないことがある。

### 現在の実装（暫定）
- `frontend/app/dashboard/page.tsx` (`FullCalendarWrapper`)
  - `scrollToNowCenter()` を用意して `cal.scrollToTime(...)` を呼ぶ
  - `FullCalendar` の `viewDidMount` / `datesSet` から `scrollToNowCenter()` を `setTimeout` 越しに呼ぶ
  - `today` ボタン押下時にも `setTimeout` 越しに呼ぶ
  - `nowIndicator={true}` を有効化

### 追加調査ポイント
- `scrollToTime` に渡す引数の型: 秒指定ではなく `"HH:mm:ss"` 文字列の方が確実か（FullCalendar のバージョン差異の可能性）
- `datesSet` 実行時点での `view.type` が `timeGridDay` になっているか
- `height` / `contentHeight` / CSS により scroll container が作られていない可能性
- `requestAnimationFrame` を複数回（2-3回）噛ませると安定するか

### 再現手順（例）
1. Dashboard を開く
2. Calendar の `today` を押す
3. 0:00 起点のままになっていないか確認


## Diary: Mermaid図が別カードにかぶることがある

### 現象
- Card内でレンダリングされる Mermaid の図が、何らかの操作（カード開閉、編集、再レンダリング等）のタイミングで、別のカードにある Mermaid の図と重なって表示されることがある。

### 期待する挙動
- Mermaid 図は常に「そのカードの中」だけに表示され、別カードの領域に重なったりはみ出したりしない。

### メモ（調査ポイント）
- Mermaid の SVG が `position: absolute` / `z-index` / overflow の影響を受けていないか
- レンダリング時に同一 ID / 同一 `data-processed` が衝突していないか（複数カードで同じ Mermaid 定義を再利用するケース）
- React の key / 再マウントで Mermaid 初期化が二重実行されていないか


## Calendar: 一部のHabitが表示されないことがある

### 現象
- 取得できているはずの Habit の一部が、カレンダー上に表示されないことがある。

### 期待する挙動
- 対象期間に該当する Habit（単発/繰り返し/終日/時間指定）はすべてイベントとして表示される。

### メモ（調査ポイント）
- フィルタ条件（`active` / `allDay` / `time` / `timings` / `outdates` / `repeat` / `dueDate`）で想定外に除外されていないか
- 日付境界（タイムゾーン、00:00跨ぎ、endTime未設定）で落ちていないか
- FullCalendar に渡す events 配列の生成で key/id が衝突して上書きされていないか


## Calendar: 繰り返しHabit移動で同名・Timingも一緒に動く

### 現象
- カレンダーで繰り返し（repeat）のある Habit をドラッグ移動した際、動かしたもの以外の「同名・Timing」の Habit まで一緒に移動してしまうことがある。

### 期待する挙動
- ドラッグした「その1件」だけが移動される。
- 繰り返しの扱いをする場合でも、更新対象はイベントID（Habitのid + occurrence を識別する情報）で一意に特定されるべき。

### メモ（調査ポイント）
- 更新APIが `name` + `time/timings` をキーにして一括更新していないか
- FullCalendar の event.id を Habit.id だけで表現している場合、occurrence が区別できず一括更新になりがち
- 例外日（outdates）/ 個別移動（例: movedDates）などのモデルが必要か検討

