# Implementation Plan: SEO対策とメタデータの実装

## Overview

このプランは、VOWアプリケーションのSEO対策とメタデータ強化を段階的に実装します。既存の`seo.metadata.ts`を拡張し、各ページに最適化されたメタデータ、OGP設定、構造化データ、セマンティックHTMLを実装します。

## Tasks

- [x] 1. メタデータ設定モジュールの拡張
  - `lib/seo.metadata.ts`を更新し、日本語キーワードとページ別メタデータ生成機能を追加
  - APP_CONFIGに日本語コンテンツとキーワードを追加
  - createPageMetadata関数を拡張してkeywordsとogImageオプションをサポート
  - createBreadcrumbSchema関数を新規追加
  - _Requirements: 1.1, 1.2, 1.5, 5.4, 5.5_

- [x] 1.1 メタデータ生成関数のユニットテストを作成
  - createPageMetadataが正しいMetadataオブジェクトを返すことをテスト
  - 各localeで適切なキーワードが含まれることをテスト
  - noIndexオプションが正しく反映されることをテスト
  - _Requirements: 1.1, 5.4_

- [x] 1.2 メタデータ一意性のプロパティテストを作成
  - **Property 1: 全ページにユニークなメタデータが存在する**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 2. 構造化データの強化
  - createWebApplicationSchema関数を拡張してaggregateRatingとfeatureListを追加
  - JSON-LD埋め込みロジックをRootLayoutに実装
  - エラーハンドリングを追加（JSON.stringify失敗時のフォールバック）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.1 構造化データ生成のユニットテストを作成
  - createWebApplicationSchemaが有効なJSON-LDを生成することをテスト
  - 必須フィールドが全て含まれることをテスト
  - schema.org仕様に準拠していることをテスト
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2.2 構造化データ妥当性のプロパティテストを作成
  - **Property 3: 構造化データの妥当性**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 3. ルートレイアウトのセマンティックHTML化
  - `app/layout.tsx`を更新してセマンティックHTMLタグを使用
  - header、main、footerタグを適切に配置
  - スキップリンクを追加してアクセシビリティを向上
  - パフォーマンス最適化（preconnect、dns-prefetch）を維持
  - _Requirements: 4.2, 4.3, 4.4, 4.7, 6.1, 6.2_

- [x] 3.1 セマンティックHTML階層のプロパティテストを作成
  - **Property 4: セマンティックHTML階層の正確性**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**

- [x] 4. トップページのメタデータ最適化
  - `app/page.tsx`のgenerateMetadata関数を更新
  - 日本語のターゲットキーワードを含むtitleとdescriptionを設定
  - セマンティックHTMLタグ（section、h1、h2等）を適切に使用
  - _Requirements: 1.2, 1.5, 4.1, 5.4, 5.5_

- [x] 4.1 OGPメタデータ完全性のプロパティテストを作成
  - **Property 2: OGPメタデータの完全性**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

- [x] 5. ダッシュボードページのメタデータ設定
  - `app/dashboard/page.tsx`にgenerateMetadata関数を追加
  - noIndex: trueを設定（ログイン後のページ）
  - ダッシュボード機能を説明するdescriptionを作成
  - _Requirements: 1.3, 2.6_

- [x] 6. ログインページのメタデータ設定
  - `app/login/page.tsx`のメタデータを更新
  - 認証機能を説明するdescriptionを作成
  - 適切なOGP設定を追加
  - _Requirements: 1.4, 2.6_

- [x] 7. Checkpoint - メタデータとセマンティックHTMLの確認
  - 全てのテストが通ることを確認
  - ブラウザで各ページを開き、HTMLソースを確認
  - メタデータが正しく設定されているか目視確認
  - ユーザーに質問があれば確認

- [x] 8. robots.txtの実装
  - `app/robots.txt`または`app/robots.ts`を作成
  - 公開ページへのクロールを許可
  - API、ダッシュボード、テストページへのクロールを禁止
  - sitemap.xmlの場所を指定
  - _Requirements: 7.1, 7.2, 7.3, 7.7_

- [ ] 9. sitemap.xmlの動的生成
  - `app/sitemap.ts`を作成または更新
  - 全ての公開ページのURLを含める
  - 各URLの最終更新日とchangeFrequencyを設定
  - 多言語対応（alternates.languages）を追加
  - _Requirements: 7.4, 7.5, 7.6_

- [ ]* 9.1 robots.txtとsitemap.xmlの整合性テストを作成
  - **Property 6: robots.txtとsitemap.xmlの整合性**
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

- [ ] 10. OGP画像の最適化
  - `app/opengraph-image.tsx`を確認し、必要に応じて更新
  - 1200x630pxのサイズを維持
  - 日本語テキストを含むバージョンを検討
  - _Requirements: 2.4, 6.3_

- [ ] 11. Checkpoint - 静的ファイルとOGP画像の確認
  - robots.txtとsitemap.xmlが正しく生成されることを確認
  - OGP画像が適切に表示されることを確認
  - 全てのテストが通ることを確認
  - ユーザーに質問があれば確認

- [ ]* 12. キーワード包含性のプロパティテストを作成
  - **Property 7: キーワードの包含性**
  - **Validates: Requirements 1.5, 5.5**

- [ ]* 13. E2Eメタデータ検証テストを作成
  - Playwrightを使用して各ページをブラウザで開く
  - HTMLヘッダーからメタデータを抽出
  - 期待値と一致することを検証
  - _Requirements: 8.1, 8.2, 8.6_

- [ ]* 14. 外部ツール検証の統合テストを作成
  - Twitter Card Validatorでの検証をシミュレート
  - Facebook Sharing Debuggerでの検証をシミュレート
  - Google Rich Results Testでの検証をシミュレート
  - _Requirements: 8.3, 8.4, 8.5_

- [ ] 15. 最終チェックポイント - 全体検証
  - 全てのテストが通ることを確認
  - 各ページのメタデータが正しく設定されていることを確認
  - SEOツール（Lighthouse、PageSpeed Insights）でスコアを確認
  - ユーザーに最終確認を依頼

## Notes

- タスクに`*`が付いているものはオプションで、MVPでは省略可能です
- 各タスクは具体的な要件を参照しており、トレーサビリティを確保しています
- チェックポイントタスクで段階的に検証を行い、問題を早期に発見します
- プロパティテストは最小100回の反復実行を行い、普遍的な正確性を検証します
- ユニットテストは具体的な例とエッジケースを検証します
