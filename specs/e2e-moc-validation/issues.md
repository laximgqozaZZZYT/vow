# E2E テスト実行時に発見された不具合

Date: 2026-02-05
Tester: Testing Agent (Haiku)

## 発見された不具合

### BUG-001: MOC セクションが表示されない
**Severity**: HIGH
**Component**: Dashboard Tab Navigation
**Status**: OPEN

**説明**:
ゲストユーザーが http://localhost:3000/dashboard にアクセスした時、MOC タブが表示されない。
表示されているタブ: Board, Calendar, Stats, Notes
非表示タブ: MOC, Agents

**根本原因**:
`/app/dashboard/constants/tabConfig.ts` の MOC タブ定義に `requiresPremium: true` が設定されている。
ゲストユーザーはプレミアム権限がないため、タブが表示されない。

**再現手順**:
1. ゲストセッション (.auth/user.json) で http://localhost:3000 にアクセス
2. ダッシュボードページを開く
3. タブナビゲーション確認

**期待される動作**:
- E2E テスト環境では MOC タブが表示されるべき
- または テストユーザーがプレミアムアクセス権を持つべき

**修正候補**:
- tabConfig.ts の MOC タブから `requiresPremium` を削除 (テスト環境)
- テスト用認証を管理者/プレミアムユーザーに変更

**ファイル**: `/home/ubuntu/Downloads/vow/frontend/app/dashboard/constants/tabConfig.ts:46`

---

### BUG-002: MOC セクションのチャット入力が見つからない
**Severity**: HIGH
**Component**: MOC Chat Interface
**Status**: OPEN

**説明**:
MOC セクションをロード後、チャット入力フォームが見つからない。
Playwright テストが以下のセレクタで要素を待機しているが、タイムアウト発生:
- `input[placeholder*="メッセージを入力"]`
- `input[placeholder*="message"]`

**根本原因**:
1. MOC タブが表示されないため、Section.MOC.tsx がレンダリングされない
2. または Section.MOC.tsx でチャット入力フォームが実装されていない

**再現手順**:
1. MOC セクションをロード
2. チャット入力フォームを検査
3. 以下のセレクタで検索: `input[placeholder*="メッセージを入力"]`

**期待される動作**:
- MOC セクション内にチャット入力フォームが表示される
- 入力フォームに適切なプレースホルダーテキスト
- ユーザーが入力可能な状態

**確認事項**:
- [ ] Section.MOC.tsx でチャット入力がレンダリングされているか
- [ ] CSS/隠し要素になっていないか
- [ ] 正確なセレクタを特定

**ファイル**:
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/components/Section.MOC.tsx`
- `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts:41-42`

---

### BUG-003: テスト認証ユーザーがプレミアムアクセス権を持たない
**Severity**: MEDIUM
**Component**: E2E Test Auth
**Status**: OPEN

**説明**:
E2E テスト用の認証ファイル (.auth/user.json) にはゲストデータのみ含まれている。
useAuth フック で `isPremium` が false のままで、MOC タブ表示できない。

**根本原因**:
- Supabase セッション情報がない
- localStorage の `app-admin-flags` が読み込まれない (useAuth が参照していない)
- ゲストユーザーの初期化処理

**修正候補**:
1. テスト用プレミアムユーザー認証を追加
2. 管理者セッション情報を auth ファイルに含める
3. MOC テスト用の特別なフラグを実装

**ファイル**:
- `/home/ubuntu/Downloads/vow/frontend/.auth/user.json`
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useAuth.ts`

---

### BUG-004: チャット機能の実装完了度が不明
**Severity**: MEDIUM
**Component**: MOC Chat System
**Status**: INVESTIGATING

**説明**:
MOC セクションのチャット機能が実装されているかどうか確認できない。
以下の機能の実装状態が不明:
- メッセージ送受信
- AI エージェント統合
- 提案カード表示
- QuickReply ボタン

**確認事項**:
- [ ] Section.MOC.tsx でメッセージ送信ハンドラがあるか
- [ ] AI エージェント API が統合されているか
- [ ] レスポンス表示ロジック
- [ ] 提案カード生成ロジック

**関連コード**:
- `Section.MOC.tsx:527` - sendMessage ハンドラ
- `Section.MOC.tsx:553` - activeAgent.sendMessage()
- Backend API: http://localhost:4000

---

### BUG-005: MOCSectionPage.goto() セレクタが不正
**Severity**: LOW
**Component**: E2E Page Object
**Status**: FIXED (Pending test)

**説明**:
MOCSectionPage.goto() メソッドが存在しないボタンをクリックしようとしていた:
- 元: `button:has-text("Agents")`
- 修正: `/dashboard?section=moc` URL 移動に変更

**修正内容**:
```typescript
// Before
const mocLink = this.page.locator('button:has-text("Agents"), [data-section-id="agents"]');

// After
await this.page.goto('/dashboard?section=moc');
```

**ファイル**: `/home/ubuntu/Downloads/vow/frontend/e2e/page-objects/MOCSectionPage.ts:59-69`

---

## 修正優先度マトリックス

| ID | バグ名 | 重要度 | 修正難度 | 優先度 | 状態 |
|----|---------|--------|----------|--------|------|
| 001 | MOC タブ非表示 | HIGH | EASY | P0 | OPEN |
| 002 | チャット入力なし | HIGH | MEDIUM | P0 | OPEN |
| 003 | 認証ユーザーなし | MEDIUM | MEDIUM | P1 | OPEN |
| 004 | 実装完了度不明 | MEDIUM | HIGH | P1 | OPEN |
| 005 | goto() セレクタ | LOW | EASY | P3 | FIXED |

## 修正ロードマップ

### フェーズ 1 (本日中)
- [ ] BUG-001: MOC タブの requiresPremium 削除
- [ ] BUG-005: goto() セレクタ修正 (完了)
- [ ] テスト再実行

### フェーズ 2 (明日)
- [ ] BUG-002: チャット入力フォーム実装確認
- [ ] BUG-003: テスト認証ユーザー設定
- [ ] BUG-004: チャット機能実装確認

### フェーズ 3 (その他)
- [ ] 提案カード表示確認
- [ ] QuickReply 機能確認
- [ ] モーダルダイアログ確認

## テスト実行履歴

| 日時 | テスト | 結果 | エラー |
|------|--------|------|--------|
| 2026-02-05 01:00 | suggestion-buttons.spec.ts | FAIL | MOC タブなし |
| 2026-02-05 01:10 | basic-chat.spec.ts | FAIL | チャット入力なし |
| 2026-02-05 01:20 | quick-reply.spec.ts | - | (未実行) |

## 参考リソース

- E2E テスト: `/home/ubuntu/Downloads/vow/frontend/e2e/tests/chat/`
- 仕様書: `/home/ubuntu/Downloads/vow/specs/e2e-moc-validation/requirements.md`
- テスト結果: `/home/ubuntu/Downloads/vow/specs/e2e-moc-validation/TEST_RESULTS.md`
