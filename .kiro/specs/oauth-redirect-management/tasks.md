# Implementation Plan: OAuth Redirect Management

## Overview

OAuth 2.0認可コードフローとダッシュボード内リダイレクト先管理機能を実装する。既存のNext.jsアプリケーションとSupabaseインフラを活用し、段階的に機能を構築する。

**技術仕様**: Node.js v22.18.0の最新機能を使用し、OAuth識別子にはbase64url エンコーディングを採用してURL安全性を確保する。

## Tasks

- [x] 1. データベーススキーマとマイグレーション作成（セキュリティ強化版 + base64url対応）
  - OAuth関連テーブル（client_applications, redirect_uris, authorization_codes, access_tokens, auth_logs, rate_limits）を作成
  - Base64url エンコード済み識別子対応（client_id, authorization_code, access_token）
  - Client Secret ハッシュ化対応（bcrypt + salt）
  - 認可コード使用済みフラグ追加
  - レート制限テーブル追加
  - RLS（Row Level Security）ポリシーを設定
  - インデックスと制約を追加
  - _Requirements: 3.1, 3.2, 8.1, 8.2, 1.6_
  - _Security: Base64url URL安全性、Client Secret平文保存防止、認可コード再利用防止_

- [ ]* 1.1 Write property test for database schema security
  - **Property 3: Client Application Uniqueness and Security**
  - **Property 12: Client Secret Security**
  - **Validates: Requirements 3.1, 3.5**

- [ ] 2. Base64url エンコーディング機能実装
  - [x] 2.1 Base64url Manager クラスを実装
    - Node.js v22.18.0のBuffer APIを活用したエンコーディング/デコーディング
    - RFC 4648 Section 5準拠のURL安全エンコーディング
    - ランダムトークン生成機能（認可コード、アクセストークン、クライアントID）
    - _Requirements: 1.6, 3.6_
    - _Security: URL安全性確保、暗号学的に安全な乱数生成_

  - [x] 2.2 OAuth識別子生成機能を実装
    - Base64url エンコード済みクライアントID生成
    - Base64url エンコード済み認可コード生成
    - Base64url エンコード済みアクセストークン生成
    - _Requirements: 1.2, 1.3, 3.1_
    - _Security: 十分なエントロピー確保（128-256bit）_

- [ ]* 2.3 Write property tests for base64url encoding
  - **Property 13: Base64url URL Safety**
  - **Validates: Requirements 1.6, 3.6**

- [ ] 3. OAuth Authorization Server API実装（セキュリティ強化版 + base64url対応）
  - [x] 3.1 認可エンドポイント (/api/oauth/authorize) を実装
    - OAuth 2.0パラメータ検証（base64url エンコード済みclient_id対応）
    - クライアント認証とリダイレクトURI厳密検証
    - パブリッククライアントでのPKCE必須チェック
    - レート制限実装（10回/分）
    - Base64url エンコード済み認可コード生成
    - 認可ページへのリダイレクト処理
    - _Requirements: 1.1, 1.2, 1.6, 4.1, 4.2_
    - _Security: PKCE必須化、レート制限、URI厳密検証、URL安全エンコーディング_

  - [x] 3.2 トークンエンドポイント (/api/oauth/token) を実装
    - Base64url エンコード済み認可コードの検証と交換
    - 認可コード使用済みチェック強化
    - PKCE検証（S256のみ）
    - Client Secret ハッシュ検証
    - Base64url エンコード済みアクセストークン・リフレッシュトークン生成
    - レート制限実装（5回/分）
    - _Requirements: 1.3, 1.6, 4.5, 8.1, 8.2_
    - _Security: 認可コード再利用防止、PKCE強制、ハッシュ検証、URL安全エンコーディング_

  - [x] 3.3 トークン検証ミドルウェアを実装
    - Base64url エンコード済みAPIトークンの検証
    - スコープ制限の実装
    - レート制限の実装（1000回/時間）
    - トークン使用時刻記録
    - _Requirements: 1.4, 1.6, 5.1, 5.2, 5.3, 5.4, 5.5_
    - _Security: ハッシュ化トークン検証、レート制限、URL安全デコーディング_

- [ ]* 3.4 Write property tests for OAuth server security
  - **Property 1: OAuth Authorization Flow Integrity**
  - **Property 11: Authorization Code Security**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

- [ ]* 3.5 Write property tests for token lifecycle security
  - **Property 4: Token Lifecycle and Security Management**
  - **Validates: Requirements 8.1, 8.2, 3.4, 8.4, 8.5**

- [ ] 4. OAuth認可ページUI実装
  - [x] 4.1 認可同意ページを作成 (/oauth/authorize)
    - Base64url エンコード済みクライアントアプリケーション情報表示
    - スコープ許可UI
    - 承認・拒否ボタン処理
    - _Requirements: 1.2, 7.1_

  - [ ] 4.2 認可処理ロジックを実装
    - ユーザー同意の処理
    - Base64url エンコード済み認可コード生成と保存
    - リダイレクトURI検証
    - _Requirements: 1.2, 4.1, 4.4_

- [ ]* 4.3 Write unit tests for authorization UI
  - Test user consent flow and error handling
  - _Requirements: 1.2, 7.1_

- [x] 5. ダッシュボードユーザー設定UI実装
  - [ ] 5.1 サイドバーにユーザー設定アイコンを追加
    - 左下に歯車アイコンを配置
    - 設定ページへのナビゲーション
    - _Requirements: 7.1_

  - [ ] 5.2 ユーザー設定ページを作成 (/dashboard/settings)
    - OAuth設定タブを含む設定ページ
    - レスポンシブデザイン対応
    - _Requirements: 7.1, 7.2_

  - [ ] 5.3 OAuth設定管理UIを実装
    - Base64url エンコード済みクライアントアプリケーション一覧表示
    - アプリケーション作成・編集・削除フォーム
    - 認証統計表示
    - _Requirements: 7.2, 3.2, 3.3_

- [ ]* 5.4 Write property tests for UI components
  - **Property 7: Resource Limits Enforcement**
  - **Validates: Requirements 2.6, 5.5**

- [ ] 6. クライアントアプリケーション管理機能
  - [x] 6.1 アプリケーション管理APIを実装
    - CRUD操作（作成、読み取り、更新、削除）
    - Base64url エンコード済みクライアントID・シークレット生成
    - 一意性制約の実装
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [ ] 6.2 リダイレクトURI管理を実装
    - URI追加・編集・削除機能
    - URI形式バリデーション
    - HTTPS強制（本番環境）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ]* 6.3 Write property tests for URI validation
  - **Property 2: URI Validation and Security**
  - **Validates: Requirements 2.2, 2.5, 4.1, 4.4**

- [ ] 7. CORS管理機能実装
  - [ ] 7.1 動的CORS設定を実装
    - リダイレクトURI登録時の自動ドメイン追加
    - URI削除時のドメイン削除
    - オリジン検証ロジック
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 7.2 API CORSヘッダー処理を実装
    - 動的CORS ヘッダー生成
    - プリフライトリクエスト対応
    - 環境別設定（HTTP/HTTPS）
    - _Requirements: 6.4, 6.5_

- [ ]* 7.3 Write property tests for CORS management
  - **Property 6: CORS Domain Management**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [ ] 8. セキュリティ機能実装
  - [ ] 8.1 PKCE (Proof Key for Code Exchange) サポート
    - コードチャレンジ・ベリファイア検証
    - S256ハッシュメソッド実装
    - _Requirements: 4.5_

  - [ ] 8.2 監査ログ機能を実装
    - OAuth操作の全ログ記録
    - IP アドレス・ユーザーエージェント記録
    - セキュリティ監視用データ収集
    - _Requirements: 4.6_

- [ ]* 8.3 Write property tests for security features
  - **Property 8: PKCE Security Enhancement**
  - **Validates: Requirements 4.5**

- [ ]* 8.4 Write property tests for audit logging
  - **Property 10: Audit Logging Completeness**
  - **Validates: Requirements 4.6**

- [ ] 9. API アクセス制御実装
  - [ ] 9.1 既存API エンドポイントにOAuth認証を追加
    - embed API の OAuth 対応
    - Base64url エンコード済みトークンベース認証の実装
    - スコープ制限の適用
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 9.2 レート制限機能を実装
    - クライアントアプリケーション別制限
    - Redis またはメモリベース実装
    - 制限超過時のエラーレスポンス
    - _Requirements: 5.5_

- [ ]* 9.3 Write property tests for API access control
  - **Property 5: API Access Control**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 10. トークン管理とクリーンアップ
  - [ ] 10.1 トークンライフサイクル管理を実装
    - Base64url エンコード済みアクセストークン期限設定（1時間）
    - Base64url エンコード済みリフレッシュトークン期限設定（30日）
    - トークン更新処理
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 10.2 認可取り消し機能を実装
    - ユーザーによる認可取り消し
    - アプリケーション削除時のトークン無効化
    - 即座の無効化処理
    - _Requirements: 3.4, 8.4_

  - [ ] 10.3 期限切れトークン自動クリーンアップ
    - バックグラウンドクリーンアップジョブ
    - 期限切れデータの定期削除
    - _Requirements: 8.5_

- [ ]* 10.4 Write property tests for revocation cascade
  - **Property 9: Authorization Revocation Cascade**
  - **Validates: Requirements 3.4, 8.4**

- [ ] 11. 統合とドキュメント
  - [ ] 11.1 外部サイト統合ガイドを作成
    - Base64url エンコード済みOAuth フロー実装例
    - API 使用方法
    - エラーハンドリング
    - _Requirements: 7.5_

  - [ ] 11.2 設定ページにヘルプ・ガイダンスを追加
    - 統合手順の表示
    - サンプルコード提供
    - トラブルシューティング
    - _Requirements: 7.5_

- [ ]* 11.3 Write integration tests
  - End-to-end OAuth flow testing with base64url encoding
  - External site simulation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

- [ ] 12. Checkpoint - 全機能テストとユーザー確認
  - すべてのテストが通ることを確認し、質問があれば用户に尋ねる

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Integration tests ensure end-to-end functionality
- Implementation uses TypeScript with existing Next.js and Supabase infrastructure

## 🔴 セキュリティ必須修正タスク（実装開始前に完了必須）

- [ ] S1. Client Secret セキュリティ実装
  - bcryptライブラリ導入
  - Client Secret ハッシュ化関数実装
  - 定数時間比較による検証実装
  - _Critical Security Fix: データベース侵害時の全クライアント漏洩防止_

- [ ] S2. 認可コード再利用防止実装
  - 使用済みフラグチェック機能
  - 認可コード即座無効化処理
  - 再利用試行時のエラーレスポンス
  - _Critical Security Fix: 認可コード傍受・再利用攻撃防止_

- [ ] S3. PKCE 必須化実装
  - パブリッククライアント判定ロジック
  - PKCE必須チェック機能
  - S256メソッド検証実装
  - _Critical Security Fix: 認可コード傍受攻撃防止_

- [ ] S4. レート制限システム実装
  - Redis/メモリベースレート制限
  - エンドポイント別制限設定
  - 制限超過時のエラーレスポンス
  - _Critical Security Fix: ブルートフォース・DDoS攻撃防止_

## セキュリティ実装順序

### Phase 0: 緊急セキュリティ修正（実装開始前）
1. S1: Client Secret セキュリティ
2. S2: 認可コード再利用防止
3. S3: PKCE 必須化
4. S4: レート制限システム

**⚠️ 警告: Phase 0完了まで本番環境への OAuth 機能デプロイは禁止**

### Phase 1: コア機能実装（セキュリティ修正後）
- タスク1-11の通常実装

### Phase 2: セキュリティ強化（MVP後）
- JWT トークン実装
- 監査ログ改ざん防止
- セキュリティヘッダー追加

## セキュリティ検証チェックリスト

実装完了前に以下を確認：

- [ ] Client Secret が平文で保存されていない
- [ ] 認可コードの再利用が防止されている
- [ ] パブリッククライアントでPKCEが必須になっている
- [ ] レート制限が適切に動作している
- [ ] トークンが適切にハッシュ化されている
- [ ] 監査ログが改ざん防止されている
- [ ] セキュリティテストが全て通過している

**注意**: 上記チェックリストの全項目が完了するまで、OAuth機能の本番リリースは行わないでください。