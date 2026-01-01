# 要件定義書

このドキュメントは、やること・やらないことを管理・記録するWebサービス（以下、VOW）の機能要件と非機能要件をまとめたものです。

## 目的
ユーザーが日々の「やること（やりたいこと）」と「やらないこと（やめたいこと）」を記録、管理し、習慣として継続／中断を可視化することで行動改善を支援する。

## 利用者（ペルソナ）
- 個人ユーザー：日々のタスクや習慣を記録したい人
- 習慣改善を目指す人：記録を元に継続状況や期間を確認したい人

## 機能要件（現状の実装ベース）

このリポジトリの現実装は「Goals / Habits / Activities / Preferences(Layout)」を中心に構成されています。

1. 認証（暫定）
   - 本番の認証基盤は未導入。
   - バックエンドは `X-User-Id` ヘッダを受け取れれば `userId` スコープでデータを分離できる（暫定）。

2. Goal 管理
   - Goal の作成、一覧、更新、削除。
   - Goal は親子関係（`parentId`）によるツリー構造を持てる。
   - Goal は `isCompleted` を持ち、完了操作により配下の Goal/Habit をカスケード更新できる。

3. Habit 管理
   - Habit の作成、一覧、更新、削除。
   - Habit は Goal に属する（`goalId`）。
   - Habit は `active/completed/lastCompletedAt` を保持する。
   - Habit は `timings/outdates/reminders` を JSON として保持できる。
   - Goal 未選択で作成された場合は、自動作成される `Inbox` Goal に紐づく。

4. Activity 履歴
   - start/pause/complete/skip 等の履歴を Activity として保存し、リロード後も参照できる。
   - Activity は `timestamp` 降順で取得される。

5. UI 設定（Preference / Layout）
   - `Preference` に任意キーの JSON を保存できる。
   - `layout:pageSections` の保存/取得により、Dashboard のセクション並び順等を保持できる。

6. API
   - REST API を提供する。
   - 現状の主要エンドポイントは `backend/src/index.ts` を正とする。

## 非機能要件
- 可用性：サービスは24/7稼働を想定（初期は小規模でOK）。
- スケーラビリティ：将来的にデータ量増大を見越して、SQL（MySQL）を採用。
- セキュリティ：現状は暫定認証（`X-User-Id`）のため、本番移行時に Cognito 等で JWT 検証を実装する。
- 機密情報：DB接続文字列などは環境変数で管理し、AWS 移行時は Secrets Manager を使用する。
- ロギングと監視：エラー・主要イベントはログに残す（初期はコンソールログ、将来的に外部ログ集約）。
- バックアップ：DBの定期バックアップを運用で実施することを想定。

## AWS 移行に関する追加要件

- 可用性
   - DB は RDS を利用し、必要に応じて Multi-AZ を検討する。
- デプロイ
   - Backend はコンテナ化して ECS Fargate または同等のマネージド実行環境へ。
   - Frontend は Amplify Hosting（SSR 対応）または CloudFront/S3（静的）へ。
- マイグレーション
   - 本番は `prisma migrate deploy` を使用し、CI/CD で one-off 実行できる仕組みが必要。

## 技術スタック（現状）
- フロントエンド：Next.js（TypeScript, App Router）
- バックエンド：Express + TypeScript + Prisma
- データベース：MySQL
- 認証：暫定で `X-User-Id`、本番は Cognito 等を想定
- CI/CD：GitHub Actions（AWS移行に合わせて整備）

## 優先度（MVP）
1. 認証（JWT / Cognito）
2. カテゴリーと習慣の作成・一覧表示
3. 報告の作成・一覧
4. 習慣ごとの基本統計（累計回数、最終実行日時）

## 将来的な拡張案
- プッシュ通知（リマインダー）
- モバイルアプリ（React Native / Expo）
- より高度な分析（継続率、コホート分析）
- 共有機能（友人と習慣を共有）

