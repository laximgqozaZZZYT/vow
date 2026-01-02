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

