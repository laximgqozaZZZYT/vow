# Requirements Document

## Introduction

このドキュメントは、VOWアプリケーションのSEO対策とメタデータの強化に関する要件を定義します。検索エンジンでの上位表示とSNSでの魅力的な共有表示を実現するため、メタデータ、OGP設定、構造化データ、セマンティックHTMLの最適化を行います。

## Glossary

- **SEO (Search Engine Optimization)**: 検索エンジン最適化。検索結果での表示順位を向上させる施策
- **OGP (Open Graph Protocol)**: SNSでURLを共有した際の表示内容を制御するメタデータプロトコル
- **JSON-LD**: 構造化データを記述するJSON形式。検索エンジンがコンテンツを理解するために使用
- **Metadata_API**: Next.jsが提供するメタデータ管理のためのAPI
- **SoftwareApplication_Schema**: schema.orgで定義されたソフトウェアアプリケーションを表す構造化データ型
- **Semantic_HTML**: 意味を持つHTMLタグ（header, main, footer等）を使用し、文書構造を明確にする手法
- **Target_Keywords**: SEO対策で狙うキーワード群

## Requirements

### Requirement 1: ページ別メタデータの最適化

**User Story:** 開発者として、各ページに適切なメタデータを設定したい。これにより、検索エンジンが各ページの内容を正確に理解し、適切な検索結果に表示できるようにする。

#### Acceptance Criteria

1. WHEN Metadata_APIを使用する THEN THE System SHALL 全ページにユニークなtitleとdescriptionを設定する
2. WHEN トップページのメタデータを設定する THEN THE System SHALL Target_Keywordsを含むdescriptionを生成する
3. WHEN ダッシュボードページのメタデータを設定する THEN THE System SHALL ログイン後の機能を説明するdescriptionを生成する
4. WHEN ログインページのメタデータを設定する THEN THE System SHALL 認証機能を説明するdescriptionを生成する
5. THE System SHALL Target_Keywordsとして「シンプル TODOアプリ」「タスク管理 無料 ブラウザ」「AI駆動 タスク管理」「習慣管理」「目標設定」を含める

### Requirement 2: OGP設定の強化

**User Story:** ユーザーとして、VOWのURLをSNSで共有した際に魅力的な表示がされることを期待する。これにより、アプリの認知度が向上し、新規ユーザーの獲得につながる。

#### Acceptance Criteria

1. WHEN URLがTwitter(X)で共有される THEN THE System SHALL 適切なOGP画像、タイトル、説明文を表示する
2. WHEN URLがSlackで共有される THEN THE System SHALL 適切なOGP画像、タイトル、説明文を表示する
3. WHEN URLがFacebookで共有される THEN THE System SHALL 適切なOGP画像、タイトル、説明文を表示する
4. THE System SHALL OGP画像として1200x630pxの画像を提供する
5. THE System SHALL Twitter Cardとして"summary_large_image"を使用する
6. WHEN 各ページが共有される THEN THE System SHALL ページ固有のOGPメタデータを生成する

### Requirement 3: 構造化データの実装

**User Story:** 開発者として、Googleに「これはタスク管理アプリである」と正しく伝えたい。これにより、検索結果でリッチスニペットとして表示され、クリック率が向上する。

#### Acceptance Criteria

1. THE System SHALL SoftwareApplication_Schemaを使用してJSON-LDを実装する
2. WHEN 構造化データを生成する THEN THE System SHALL アプリ名、説明、URL、カテゴリを含める
3. WHEN 構造化データを生成する THEN THE System SHALL applicationCategoryとして"ProductivityApplication"を設定する
4. WHEN 構造化データを生成する THEN THE System SHALL 価格情報（無料）を含める
5. THE System SHALL 構造化データをページのheadセクションに配置する
6. WHEN 構造化データを検証する THEN THE System SHALL Googleの構造化データテストツールでエラーがないことを確認する

### Requirement 4: セマンティックHTMLの適用

**User Story:** 開発者として、適切なHTMLタグを使用してページ構造を明確にしたい。これにより、検索エンジンとスクリーンリーダーがコンテンツを正確に理解できる。

#### Acceptance Criteria

1. THE System SHALL トップページで適切な見出し階層（h1, h2, h3）を使用する
2. THE System SHALL ページの主要コンテンツを&lt;main&gt;タグで囲む
3. THE System SHALL ヘッダー部分を&lt;header&gt;タグで実装する
4. THE System SHALL フッター部分を&lt;footer&gt;タグで実装する
5. THE System SHALL コンテンツのセクションを&lt;section&gt;タグで区切る
6. WHEN 汎用コンテナが必要な場合 THEN THE System SHALL 意味のあるタグが存在しない場合のみ&lt;div&gt;を使用する
7. THE System SHALL ナビゲーション要素を&lt;nav&gt;タグで実装する

### Requirement 5: 多言語対応のメタデータ

**User Story:** 開発者として、日本語と英語の両方で適切なメタデータを提供したい。これにより、各言語圏のユーザーに最適化された検索結果を提供できる。

#### Acceptance Criteria

1. THE System SHALL 日本語ページに対してlang="ja"を設定する
2. THE System SHALL 英語ページに対してlang="en"を設定する
3. WHEN 多言語ページが存在する THEN THE System SHALL hreflang属性で言語の代替ページを指定する
4. THE System SHALL 各言語に対して適切に翻訳されたメタデータを提供する
5. WHEN 日本語メタデータを生成する THEN THE System SHALL 日本語のTarget_Keywordsを含める

### Requirement 6: パフォーマンス最適化

**User Story:** 開発者として、SEO設定がページパフォーマンスに悪影響を与えないようにしたい。これにより、検索エンジンの評価が向上し、ユーザー体験も改善される。

#### Acceptance Criteria

1. THE System SHALL 外部リソースに対してpreconnectを使用する
2. THE System SHALL 外部リソースに対してdns-prefetchを使用する
3. WHEN OGP画像を提供する THEN THE System SHALL 最適化された画像サイズを使用する
4. THE System SHALL 不要なメタデータの重複を避ける
5. WHEN 構造化データを配置する THEN THE System SHALL ページの初期レンダリングをブロックしない方法で実装する

### Requirement 7: robots.txtとsitemap.xmlの設定

**User Story:** 開発者として、検索エンジンのクローラーに適切な指示を与えたい。これにより、インデックスすべきページが正しくクロールされ、不要なページは除外される。

#### Acceptance Criteria

1. THE System SHALL robots.txtファイルを提供する
2. WHEN robots.txtを生成する THEN THE System SHALL 公開ページへのクロールを許可する
3. WHEN robots.txtを生成する THEN THE System SHALL 管理画面やAPIエンドポイントへのクロールを禁止する
4. THE System SHALL sitemap.xmlファイルを動的に生成する
5. WHEN sitemap.xmlを生成する THEN THE System SHALL 全ての公開ページのURLを含める
6. WHEN sitemap.xmlを生成する THEN THE System SHALL 各URLの最終更新日を含める
7. THE System SHALL robots.txtでsitemap.xmlの場所を指定する

### Requirement 8: メタデータの検証とテスト

**User Story:** 開発者として、実装したSEO設定が正しく機能することを確認したい。これにより、本番環境でのSEO効果を保証できる。

#### Acceptance Criteria

1. WHEN メタデータを検証する THEN THE System SHALL 全ページでtitleタグが存在することを確認する
2. WHEN メタデータを検証する THEN THE System SHALL 全ページでdescriptionメタタグが存在することを確認する
3. WHEN OGPを検証する THEN THE System SHALL Twitter Card Validatorでエラーがないことを確認する
4. WHEN OGPを検証する THEN THE System SHALL Facebook Sharing Debuggerでエラーがないことを確認する
5. WHEN 構造化データを検証する THEN THE System SHALL Google Rich Results Testでエラーがないことを確認する
6. THE System SHALL 各ページのメタデータが重複していないことを確認する
