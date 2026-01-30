# Requirements Document

## Introduction

本ドキュメントは、VOW習慣管理アプリにおける有料サブスクリプション機能とAI機能の要件を定義します。ユーザーはStripe決済を通じて有料プランに加入し、自然言語によるHabit/Goal登録・編集、Slack/ChatGPT等との対話操作が可能になります。トークン使用量の管理により、定額プラン内で一定量のAI機能を利用できます。

## Glossary

- **Notice_Service**: アプリ内通知の管理・表示を行うサービス
- **Notification_Service**: 複数チャネル（アプリ内、Slack、Web Push）への通知配信を管理するサービス
- **Workload_Coaching_Service**: 習慣の継続状況を分析し、Workload調整やベビーステップを提案するコーチングサービス
- **AI_Habit_Suggester**: Goalに対して効果的なHabitを生成AIで提案するサービス（Premium機能）
- **Subscription_Service**: Stripeとの連携を管理し、ユーザーのサブスクリプション状態を管理するサービス
- **Stripe_Webhook_Handler**: Stripeからのイベント（支払い成功、キャンセル等）を処理するハンドラー
- **Plan_Selector**: ユーザーがプランを選択・変更するためのUIコンポーネント
- **AI_Service**: OpenAI/Amazon Bedrockを利用して自然言語処理を行うサービス
- **Token_Manager**: ユーザーのAIトークン使用量を追跡・管理するコンポーネント
- **NL_Habit_Parser**: 自然言語入力からHabit/Goalデータを抽出するパーサー
- **Connector_Service**: Slack/ChatGPT等の外部サービスとの対話を管理するサービス
- **Usage_Tracker**: API呼び出しとトークン消費を記録するトラッカー
- **Free_Plan**: 無料プラン（AI機能なし、基本機能のみ）
- **Premium_Plan**: 有料プラン（月額、AI機能付き、トークン制限あり）
- **Token_Quota**: 月間で利用可能なAIトークン数の上限

## Requirements

### 機能のFree/Premium区分

| 機能 | Free | Premium | AI使用 |
|------|------|---------|--------|
| プラン選択・管理 | ✓ | ✓ | - |
| Workloadコーチング（ルールベース） | ✓ | ✓ | ✗ |
| 自然言語によるHabit/Goal登録 | - | ✓ | ✓ |
| 自然言語によるHabit/Goal編集 | - | ✓ | ✓ |
| Goal向けHabit提案（AI） | - | ✓ | ✓ |
| Slack自然言語コマンド | - | ✓ | ✓ |
| ChatGPTコネクタ | - | ✓ | ✓ |
| Notice Section | ✓ | ✓ | - |
| Web Push通知 | ✓ | ✓ | - |
| トークン使用量ダッシュボード | - | ✓ | - |

### Requirement 1: プラン選択画面

**User Story:** ユーザーとして、Settings > Profileからプラン選択画面に遷移し、現在のプランを確認・変更したい。これにより、自分に合ったプランを選択できる。

#### Acceptance Criteria

1. WHEN ユーザーがSettings > Profileページで「プランを管理」ボタンをクリックした場合 THEN THE Plan_Selector SHALL プラン選択画面を表示する
2. WHEN プラン選択画面を表示する場合 THEN THE Plan_Selector SHALL 利用可能なプラン（Free、Premium）の詳細と価格を表示する
3. WHEN ユーザーが現在のプランを確認する場合 THEN THE Plan_Selector SHALL 現在のプラン名、次回請求日、トークン残量を表示する
4. WHEN ユーザーがPremiumプランを選択した場合 THEN THE Plan_Selector SHALL Stripe Checkoutセッションを開始する
5. WHEN ユーザーがプランをダウングレードする場合 THEN THE Plan_Selector SHALL 現在の請求期間終了後にダウングレードされる旨を表示する
6. IF ユーザーが既にPremiumプランの場合 THEN THE Plan_Selector SHALL 「現在のプラン」バッジを表示し、請求履歴へのリンクを提供する

### Requirement 2: Stripe決済連携（予算管理対応）

**User Story:** ユーザーとして、安全にクレジットカードで有料プランの決済を行いたい。これにより、Premium機能にアクセスできる。

#### Acceptance Criteria

1. WHEN ユーザーがPremiumプランを選択した場合 THEN THE Subscription_Service SHALL Stripe Checkout Sessionを作成しリダイレクトする
2. WHEN Stripe Checkoutが成功した場合 THEN THE Stripe_Webhook_Handler SHALL checkout.session.completedイベントを受信し、ユーザーのプランをPremiumに更新する
3. WHEN サブスクリプションが更新された場合 THEN THE Stripe_Webhook_Handler SHALL invoice.paidイベントを処理し、トークンクォータをリセットする
4. WHEN サブスクリプションがキャンセルされた場合 THEN THE Stripe_Webhook_Handler SHALL customer.subscription.deletedイベントを処理し、プランをFreeに変更する
5. WHEN 支払いが失敗した場合 THEN THE Stripe_Webhook_Handler SHALL invoice.payment_failedイベントを処理し、ユーザーに通知する
6. THE Subscription_Service SHALL Stripeの顧客ID、サブスクリプションID、プラン情報をデータベースに保存する
7. WHEN Webhookを受信した場合 THEN THE Stripe_Webhook_Handler SHALL Stripe署名を検証してリクエストの正当性を確認する
8. THE Subscription_Service SHALL 従量課金（usage-based billing）を使用せず、固定月額プランのみを提供する（予算超過防止）
9. THE Subscription_Service SHALL プランのアップグレード/ダウングレードを請求期間の境界でのみ適用する
10. WHEN ユーザーがプランをアップグレードする場合 THEN THE Subscription_Service SHALL 日割り計算で差額を請求する

### Requirement 3: 自然言語によるHabit/Goal登録（Premium機能）

**User Story:** Premiumユーザーとして、自然言語で「毎朝7時に30分ジョギングする」のように入力してHabitを登録したい。これにより、直感的に習慣を追加できる。

**注記:** この機能はGPT-4o miniを使用するため、Premiumユーザー限定です。トークン消費が発生します。

#### Acceptance Criteria

1. WHEN Premiumユーザーが自然言語入力フィールドにテキストを入力した場合 THEN THE NL_Habit_Parser SHALL テキストを解析してHabit/Goalの構造化データを抽出する
2. WHEN 自然言語を解析する場合 THEN THE NL_Habit_Parser SHALL 習慣名、頻度、トリガー時刻、関連ゴールを抽出する
3. WHEN 解析結果を表示する場合 THEN THE NL_Habit_Parser SHALL 抽出されたデータのプレビューを表示し、ユーザーに確認を求める
4. WHEN ユーザーが確認した場合 THEN THE NL_Habit_Parser SHALL Habit/Goalをデータベースに保存する
5. IF 解析に失敗した場合 THEN THE NL_Habit_Parser SHALL エラーメッセージと手動入力へのフォールバックを提供する
6. WHEN 自然言語処理を実行する場合 THEN THE Token_Manager SHALL 消費トークン数を記録する
7. IF ユーザーのトークンクォータが不足している場合 THEN THE AI_Service SHALL エラーメッセージを返し、追加購入またはクォータリセットを案内する

### Requirement 4: 自然言語によるHabit/Goal編集（Premium機能）

**User Story:** Premiumユーザーとして、「ジョギングの時間を朝6時に変更して」のように自然言語で既存のHabitを編集したい。これにより、簡単に習慣を調整できる。

**注記:** この機能はGPT-4o miniを使用するため、Premiumユーザー限定です。トークン消費が発生します。

#### Acceptance Criteria

1. WHEN Premiumユーザーが編集コマンドを自然言語で入力した場合 THEN THE NL_Habit_Parser SHALL 対象のHabit/Goalと変更内容を特定する
2. WHEN 編集対象を特定する場合 THEN THE NL_Habit_Parser SHALL 既存のHabit/Goal名との類似度マッチングを行う
3. WHEN 複数の候補がある場合 THEN THE NL_Habit_Parser SHALL 候補リストを表示しユーザーに選択を求める
4. WHEN 変更内容を適用する場合 THEN THE NL_Habit_Parser SHALL 変更前後の差分をプレビュー表示する
5. WHEN ユーザーが変更を確認した場合 THEN THE NL_Habit_Parser SHALL データベースを更新する
6. IF 対象のHabit/Goalが見つからない場合 THEN THE NL_Habit_Parser SHALL 類似の候補を提案するか、新規作成を提案する

### Requirement 5: トークン使用量管理（予算超過防止）

**User Story:** ユーザーとして、月間のAIトークン使用量を確認し、予算を超過しないよう管理したい。これにより、想定外のコストを防ぎながらAI機能を利用できる。

#### Acceptance Criteria

1. THE Token_Manager SHALL 各Premiumユーザーに月間トークンクォータを割り当てる（プランに応じて設定）
2. THE Subscription_Service SHALL 以下のプラン構成を提供する:
   - Premium Basic: 月額980円、500,000トークン/月（約500回のAI操作）
   - Premium Pro: 月額1,980円、2,000,000トークン/月（約2,000回のAI操作）
   - AIモデル: OpenAI GPT-4o mini（Input: $0.15/1M tokens, Output: $0.60/1M tokens）
3. WHEN AI機能を使用する前に THEN THE Token_Manager SHALL 残りトークン数を確認し、不足している場合は処理を拒否する
4. WHEN AI機能を使用する場合 THEN THE Token_Manager SHALL 消費トークン数をリアルタイムで記録する
5. WHEN ユーザーがダッシュボードを表示する場合 THEN THE Token_Manager SHALL 現在の使用量、残量、推定残り操作回数をプログレスバーで表示する
6. WHEN トークン使用量が70%に達した場合 THEN THE Token_Manager SHALL ユーザーにアプリ内通知を送信する
7. WHEN トークン使用量が90%に達した場合 THEN THE Token_Manager SHALL ユーザーにメール/Slack通知を送信する
8. WHEN トークン使用量が100%に達した場合 THEN THE Token_Manager SHALL AI機能を一時停止し、クォータリセット日とプランアップグレードオプションを表示する
9. THE Token_Manager SHALL トークンの追加購入（トップアップ）機能を提供しない（予算超過防止のため、月間クォータのみ）
10. WHEN 新しい請求期間が開始された場合 THEN THE Token_Manager SHALL トークンクォータをリセットする（未使用分は繰り越さない）
11. THE Token_Manager SHALL 使用履歴（日付、機能、消費トークン数、推定コスト）をユーザーが確認できるようにする
12. THE Token_Manager SHALL 月間のAIプロバイダーコストが予算上限（プラン収益の50%）を超えないよう、クォータを設定する

### Requirement 6: Slackコネクタ - 自然言語対話（Premium機能）

**User Story:** Premiumユーザーとして、Slackから自然言語で習慣を登録・編集・確認したい。これにより、Slackを離れずに習慣管理ができる。

**注記:** 自然言語処理機能はGPT-4o miniを使用するため、Premiumユーザー限定です。既存のSlashコマンド（/habit-done等）はFreeユーザーも引き続き利用可能です。

#### Acceptance Criteria

1. WHEN PremiumユーザーがSlackで「新しい習慣: 毎日水を2L飲む」と入力した場合 THEN THE Connector_Service SHALL NL_Habit_Parserを呼び出して習慣を登録する
2. WHEN PremiumユーザーがSlackで「今日の習慣を教えて」と入力した場合 THEN THE Connector_Service SHALL 当日の習慣リストと進捗を返す
3. WHEN PremiumユーザーがSlackで編集コマンドを入力した場合 THEN THE Connector_Service SHALL 対象の習慣を特定し編集を実行する
4. WHEN 自然言語コマンドを処理する場合 THEN THE Connector_Service SHALL 既存のSlack連携（/habit-done等）と共存する
5. IF ユーザーがFreeプランの場合 THEN THE Connector_Service SHALL 自然言語機能は利用不可である旨を返し、アップグレードを案内する
6. WHEN Slackから自然言語処理を実行する場合 THEN THE Token_Manager SHALL トークン消費を記録する

### Requirement 7: ChatGPTコネクタ - GPT Actions（Premium機能）

**User Story:** Premiumユーザーとして、ChatGPTから習慣管理アプリを操作したい。これにより、ChatGPTとの会話の中で習慣を管理できる。

**注記:** この機能はPremiumユーザー限定です。

#### Acceptance Criteria

1. THE Connector_Service SHALL OpenAI GPT Actions仕様に準拠したAPIエンドポイントを提供する
2. WHEN ChatGPTからAPIが呼び出された場合 THEN THE Connector_Service SHALL OAuth 2.0でユーザー認証を行う
3. WHEN 認証済みユーザーが習慣登録を要求した場合 THEN THE Connector_Service SHALL NL_Habit_Parserを使用して習慣を登録する
4. WHEN 認証済みユーザーが習慣一覧を要求した場合 THEN THE Connector_Service SHALL ユーザーの習慣リストを返す
5. WHEN 認証済みユーザーが習慣完了を報告した場合 THEN THE Connector_Service SHALL 指定された習慣を完了としてマークする
6. THE Connector_Service SHALL GPT Actions用のOpenAPI仕様書を提供する
7. IF ユーザーがFreeプランの場合 THEN THE Connector_Service SHALL 403エラーとアップグレード案内を返す

### Requirement 8: データベーススキーマ拡張

**User Story:** 開発者として、サブスクリプションとトークン管理のためのデータベーススキーマを拡張したい。これにより、有料機能のデータを永続化できる。

#### Acceptance Criteria

1. THE Database_Migration SHALL subscriptionsテーブルを作成する（id, user_id, stripe_customer_id, stripe_subscription_id, plan_type, status, current_period_start, current_period_end, created_at, updated_at）
2. THE Database_Migration SHALL token_usageテーブルを作成する（id, user_id, feature, tokens_used, created_at）
3. THE Database_Migration SHALL token_quotasテーブルを作成する（id, user_id, monthly_quota, used_quota, reset_at, created_at, updated_at）
4. THE Database_Migration SHALL usersテーブルにplan_type（ENUM: 'free', 'premium'）カラムを追加する
5. THE Database_Migration SHALL 適切なインデックス（user_id, stripe_customer_id, created_at）を作成する
6. THE Database_Migration SHALL Row Level Securityポリシーを既存テーブルと一貫性を持って適用する
7. THE Database_Migration SHALL stripe_customer_idにUNIQUE制約を設定する

### Requirement 9: AI サービス統合

**User Story:** 開発者として、OpenAI/Amazon Bedrockと統合し、自然言語処理機能を提供したい。これにより、ユーザーに高品質なAI機能を提供できる。

#### Acceptance Criteria

1. THE AI_Service SHALL OpenAI GPT-4o miniを使用して自然言語を処理する（Input: $0.15/1M tokens, Output: $0.60/1M tokens）
2. WHEN 自然言語入力を処理する場合 THEN THE AI_Service SHALL 構造化されたJSON形式でHabit/Goalデータを返す
3. THE AI_Service SHALL プロンプトテンプレートを使用して一貫した出力形式を保証する
4. WHEN APIエラーが発生した場合 THEN THE AI_Service SHALL 指数バックオフでリトライする
5. IF 3回連続でAPIエラーが発生した場合 THEN THE AI_Service SHALL サーキットブレーカーを開いてフォールバックメッセージを返す
6. THE AI_Service SHALL APIキーを環境変数から読み込み、ログに出力しない
7. WHEN 処理が完了した場合 THEN THE AI_Service SHALL 使用トークン数をToken_Managerに報告する

### Requirement 10: ゲーミフィケーション - Workloadコーチング（Free機能）

**User Story:** ユーザーとして、習慣の継続が難しい場合に、より達成しやすい目標への調整提案を受けたい。これにより、挫折せずに習慣形成を続けられる。

**注記:** この機能はルールベースのロジックで動作し、AIを使用しないためFreeユーザーも利用可能です。

#### Acceptance Criteria

**10.1 連続未達成時のWorkload調整提案**

1. WHEN ユーザーが3日連続でHabitの目標を達成できなかった場合 THEN THE Workload_Coaching_Service SHALL 以下のルールでWorkload調整を提案する:
   - 提案値 = 現在の`target_count` × 0.5（切り上げ、最小値1）
   - 例: target_count=10 → 提案値=5、target_count=3 → 提案値=2
2. WHEN Workload調整を提案する場合 THEN THE Workload_Coaching_Service SHALL 以下の情報を表示する:
   - 連続未達成日数
   - 過去7日間の達成率
   - 現在のtarget_count → 提案target_count
   - 「小さく始めて、徐々に増やしましょう」というメッセージ

**10.2 無活動時のベビーステップ提案**

3. WHEN ユーザーがHabitを作成後7日以上経過し、一度もActivityを記録していない場合 THEN THE Workload_Coaching_Service SHALL 以下のルールでベビーステップを提案する:
   - **数量ベースのHabit**（workload_unit が設定されている場合）:
     - 提案値 = 現在の`target_count` × 0.2（切り上げ、最小値1）
     - 例: 「腕立て伏せ30回」→「腕立て伏せ6回」
   - **回数ベースのHabit**（workload_unit が未設定の場合）:
     - 提案値 = 1（最小単位）
     - 例: 「読書3回」→「読書1回」
   - **時間ベースのHabit**（workload_unit が「分」「時間」の場合）:
     - 提案値 = max(1, 現在の`target_count` × 0.1)（切り上げ）
     - 例: 「瞑想30分」→「瞑想3分」
4. WHEN ベビーステップを提案する場合 THEN THE Workload_Coaching_Service SHALL 以下の情報を表示する:
   - 「まずは小さな一歩から始めましょう」というメッセージ
   - 現在のtarget_count → 提案target_count
   - 「達成できたら徐々に増やせます」という励ましメッセージ

**10.3 提案の承認・拒否**

5. WHEN ユーザーが提案を承認した場合 THEN THE Workload_Coaching_Service SHALL:
   - Habitの`target_count`を提案値に更新する
   - 変更履歴を記録する（元の値、変更後の値、変更理由）
6. WHEN ユーザーが提案を拒否した場合 THEN THE Workload_Coaching_Service SHALL:
   - 7日間は同じHabitに対する提案を表示しない
   - 拒否回数をカウントする
7. IF ユーザーが同じHabitの提案を3回連続で拒否した場合 THEN THE Workload_Coaching_Service SHALL 30日間は提案を停止する

**10.4 UI/UX**

8. THE Workload_Coaching_Service SHALL ダッシュボードに「コーチング提案」通知バッジを表示する（提案がある場合のみ）
9. WHEN 提案カードを表示する場合 THEN THE Workload_Coaching_Service SHALL 以下のアクションボタンを提供する:
   - 「この目標で始める」（承認）
   - 「今のままで続ける」（拒否）
   - 「後で決める」（スヌーズ、24時間後に再表示）

**10.5 段階的回復**

10. WHEN ユーザーがWorkload調整後のtarget_countで3日連続達成した場合 THEN THE Workload_Coaching_Service SHALL 元のtarget_countの75%への上方調整を提案する
11. WHEN ユーザーが上方調整後のtarget_countで5日連続達成した場合 THEN THE Workload_Coaching_Service SHALL 元のtarget_countへの復帰を提案する

### Requirement 11: ゲーミフィケーション - Goal向けHabit提案（Premium機能）

**User Story:** Premiumユーザーとして、Goalに対して効果的なHabitの提案を受けたい。これにより、目標達成に向けた具体的なアクションを見つけやすくなる。

**注記:** この機能はGPT-4o miniを使用するため、Premium Proユーザー限定です。トークン消費が発生します。

#### Acceptance Criteria

1. WHEN PremiumユーザーがGoal詳細画面で「Habit提案」ボタンをクリックした場合 THEN THE AI_Habit_Suggester SHALL Goalの内容を分析し、関連するHabitを3つ提案する
2. WHEN Habitを提案する場合 THEN THE AI_Habit_Suggester SHALL 各提案に習慣名、推奨頻度、推奨Workload、提案理由を含める
3. WHEN ユーザーが提案されたHabitを選択した場合 THEN THE AI_Habit_Suggester SHALL 選択されたHabitをGoalに紐づけて作成する
4. WHEN Habit提案を生成する場合 THEN THE Token_Manager SHALL トークン消費を記録する
5. IF ユーザーがFreeプランの場合 THEN THE AI_Habit_Suggester SHALL 機能がPremium限定である旨を表示し、アップグレードを案内する
6. THE AI_Habit_Suggester SHALL 既存のHabitと重複しない提案を生成する
7. WHEN 提案を生成する場合 THEN THE AI_Habit_Suggester SHALL ユーザーの過去の習慣達成パターンを考慮する

### Requirement 12: 通知システム（Notice Section & Settings）（Free機能）

**User Story:** ユーザーとして、アプリ内通知、Slack通知、デスクトップ/モバイル通知を自分の好みに合わせて設定したい。これにより、重要な情報を見逃さずに受け取れる。

**注記:** 通知システム自体はFreeユーザーも利用可能です。ただし、AI機能関連の通知（自然言語処理結果等）はPremiumユーザーのみが受け取れます。

#### Acceptance Criteria

**12.1 Notice Section（ダッシュボード内）**

1. THE Dashboard SHALL 新しい「Notice」セクションを表示する（Habits/Goals/Calendarと同列）
2. WHEN Notice Sectionを表示する場合 THEN THE Notice_Service SHALL 以下の通知タイプを表示する:
   - Workloadコーチング提案（workload_adjustment, baby_step）
   - 段階的回復提案（partial_recovery, full_recovery）
   - トークン使用量警告（70%, 90%, 100%）
   - サブスクリプション関連（更新、支払い失敗等）
   - AI Habit提案（Premium機能）
3. WHEN 未読通知がある場合 THEN THE Notice_Service SHALL Notice Sectionヘッダーにバッジ（未読数）を表示する
4. WHEN ユーザーが通知をクリックした場合 THEN THE Notice_Service SHALL 該当する詳細画面またはアクションモーダルを表示する
5. THE Notice_Service SHALL 通知を「すべて既読にする」機能を提供する
6. THE Notice_Service SHALL 通知を日付順（新しい順）で表示する

**12.2 Slack通知**

7. WHEN Slack連携が有効な場合 THEN THE Notification_Service SHALL 以下の通知をSlackに送信可能とする:
   - Workloadコーチング提案
   - トークン使用量警告（90%, 100%のみ）
   - 週次進捗レポート
8. WHEN Slack通知を送信する場合 THEN THE Notification_Service SHALL インタラクティブボタン（承認/拒否）を含める
9. THE Notification_Service SHALL Slack通知の送信時刻を設定可能とする（デフォルト: 朝9時）

**12.3 Web Push通知（デスクトップ/モバイル）**

10. THE Notification_Service SHALL Web Push APIを使用したブラウザ通知をサポートする
11. WHEN ユーザーがWeb Push通知を有効にした場合 THEN THE Notification_Service SHALL Service Workerを登録しPush Subscriptionを保存する
12. THE Notification_Service SHALL 以下のイベントでWeb Push通知を送信可能とする:
    - Workloadコーチング提案
    - 毎日のリマインダー（設定時刻）
    - 週次進捗レポート
13. WHEN Web Push通知を送信する場合 THEN THE Notification_Service SHALL 通知をクリックした際にアプリの該当画面を開く

**12.4 Settings > Notifications**

14. THE Settings_Page SHALL 「Notifications」セクションを提供する
15. THE Notifications_Settings SHALL 以下の設定項目を提供する:
    - **アプリ内通知**:
      - Workloadコーチング提案: ON/OFF（デフォルト: ON）
      - トークン使用量警告: ON/OFF（デフォルト: ON）
      - 週次レポート: ON/OFF（デフォルト: ON）
    - **Slack通知**（Slack連携時のみ表示）:
      - Workloadコーチング提案: ON/OFF（デフォルト: OFF）
      - トークン使用量警告: ON/OFF（デフォルト: ON）
      - 週次レポート: ON/OFF（デフォルト: ON）
      - 通知時刻: 時刻選択（デフォルト: 09:00）
    - **Web Push通知**:
      - 有効/無効トグル
      - 毎日のリマインダー: ON/OFF + 時刻設定
      - Workloadコーチング提案: ON/OFF（デフォルト: OFF）
16. WHEN ユーザーが設定を変更した場合 THEN THE Settings_Service SHALL 即座にデータベースに保存する
17. THE Notifications_Settings SHALL 「すべての通知をOFF」ボタンを提供する

### Requirement 13: 管理者アクセス（Admin Access）

**User Story:** 本成果物の作成者（管理者）として、すべてのPremium機能を無料で利用したい。これにより、機能のテストと運用監視ができる。

#### Acceptance Criteria

**13.1 管理者ロールの定義**

1. THE Admin_Service SHALL 管理者ユーザーを識別するための`admin_users`テーブルを作成する
2. THE Admin_Service SHALL 管理者ユーザーに対してすべてのPremium機能へのアクセスを許可する
3. THE Admin_Service SHALL 管理者ユーザーのトークン使用量を記録するが、クォータ制限を適用しない

**13.2 セキュリティ要件**

4. THE Admin_Service SHALL 管理者ユーザーの追加・削除をデータベース直接操作またはCLIツールでのみ許可する（UIからの自己昇格を禁止）
5. THE Admin_Service SHALL 管理者アクセスのすべての操作をaudit_logsテーブルに記録する
6. THE Admin_Service SHALL 管理者ユーザーのメールアドレスを環境変数`ADMIN_EMAILS`で設定可能とする（カンマ区切り）
7. IF 管理者ユーザーが通常のStripe決済を行った場合 THEN THE Subscription_Service SHALL 決済を受け付けず、管理者アクセスを維持する
8. THE Admin_Service SHALL 管理者ユーザーのセッションに対して追加のセキュリティチェック（IPアドレス検証等）を実施可能とする（オプション）

**13.3 監査とモニタリング**

9. THE Admin_Service SHALL 管理者ユーザーのAI機能使用量を別途集計し、運用コストの把握を可能とする
10. THE Admin_Service SHALL 管理者アクセスの有効期限を設定可能とする（デフォルト: 無期限）

### Requirement 14: セキュリティとプライバシー

**User Story:** ユーザーとして、決済情報とAI処理データが安全に保護されることを期待する。これにより、安心してサービスを利用できる。

#### Acceptance Criteria

1. THE Subscription_Service SHALL クレジットカード情報を直接保存せず、Stripeに委任する
2. WHEN Stripe Webhookを受信した場合 THEN THE Stripe_Webhook_Handler SHALL Stripe署名を検証する
3. THE AI_Service SHALL ユーザーの入力データをAIプロバイダーに送信する前に個人識別情報を除去する
4. THE Token_Manager SHALL トークン使用履歴を90日間保持し、その後自動削除する
5. WHEN 外部APIを呼び出す場合 THEN THE Connector_Service SHALL TLS 1.2以上を使用する
6. THE Database_Migration SHALL 機密データ（stripe_customer_id等）を暗号化して保存する
7. IF 不正なアクセスパターンが検出された場合 THEN THE Subscription_Service SHALL アカウントを一時停止し管理者に通知する
