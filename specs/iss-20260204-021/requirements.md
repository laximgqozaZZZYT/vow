# ISS-20260204-021: 既存Habitの情報を参照していない

## Overview
- **Purpose**: AIコーチが「既存の習慣のレベル設定」リクエストに対して、既存習慣データを取得せずに質問してしまうバグを修正する
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect
- **Issue ID**: ISS-20260204-021
- **Priority**: Critical
- **Category**: Bug

## Problem Statement

### 現象
ユーザーが「既存の習慣のレベル設定をして下さい」とリクエストした際、AIコーチは:
- 既存の習慣データを取得するツール（show_habit_selection）を呼び出さない
- 代わりに「どの習慣のレベルを設定しますか？」とテキストで質問する

### 期待される動作
1. AIコーチは`show_habit_selection`ツールを呼び出す
2. ユーザーの既存習慣がボタン形式で表示される
3. ユーザーがボタンをクリックして習慣を選択
4. 選択された習慣のレベル設定が実行される

### 根本原因
システムプロンプト（`vow-coach-agent.ts`内の`generateSystemPrompt`関数）に「レベル設定」リクエストに対する指示が不足している。

現在のプロンプトには以下のパターンはあるが:
- 「習慣の進捗を確認したい」 -> show_habit_selection
- 「目標の進捗を見たい」 -> show_goal_selection

以下のパターンが欠如している:
- 「習慣のレベル設定」 -> show_habit_selection
- 「習慣のレベルを変更」 -> show_habit_selection
- 「既存の習慣の設定」 -> show_habit_selection

## Requirements

### Functional Requirements

- **FR-001**: AIコーチは「習慣のレベル設定」「レベル変更」「レベルを設定」というキーワードを含むリクエストに対して、show_habit_selectionツールを呼び出すこと
- **FR-002**: show_habit_selectionの結果には、各習慣の現在のレベル情報を含めること
- **FR-003**: 日本語と英語の両方のプロンプトに対応すること
- **FR-004**: 既存習慣がない場合は、適切なメッセージを表示すること

### Non-Functional Requirements

- **NFR-001**: 既存のツール呼び出しパターンと一貫性のある実装であること
- **NFR-002**: 他の既存機能に影響を与えないこと
- **NFR-003**: ビルドエラーが発生しないこと

## Acceptance Criteria

- **AC-001**: ユーザーが「既存の習慣のレベル設定をして下さい」と入力したとき、show_habit_selectionツールが呼び出される
- **AC-002**: ユーザーが「習慣のレベルを変更したい」と入力したとき、show_habit_selectionツールが呼び出される
- **AC-003**: 習慣選択ボタンには習慣名と現在のレベルが表示される
- **AC-004**: フロントエンドのビルドが成功する
- **AC-005**: バックエンドのビルドが成功する

## Related Files

- `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` - システムプロンプト定義
- `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts` - ツール定義
- `/home/ubuntu/Downloads/vow/frontend/app/dashboard/hooks/useMcpChat.ts` - フロントエンドMCPチャット

## Agent Coordination Notes

- この修正はバックエンドのシステムプロンプト変更のみで完了可能
- フロントエンドの変更は不要
- テスト時はMCPサーバーを再起動する必要がある
