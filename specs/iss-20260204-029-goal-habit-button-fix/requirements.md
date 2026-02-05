# Goal/Habit型候補ボタン表示不具合修正 - 要件仕様書

## Overview
- **Issue ID**: ISS-20260204-029
- **Status**: In Progress
- **Priority**: Critical
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Problem Statement

### 現在の動作
- カテゴリ選択（show_category_selection）後、Goal設定やHabit追加のリクエストに対して、すべてのケースで`category`型または`text`型のボタンのみが表示される
- Goal型やHabit型のsuggestionTypeが正しくフロントエンドに伝達されていない

### 期待される動作
- Goal設定要求時: `goal`型ボタンを表示（紫色バッジ）
- Habit追加要求時: `habit`型ボタンを表示（青色バッジ）
- カテゴリ深堀時: `category`型ボタンを表示

---

## Requirements

### Functional Requirements

- [FR-001] suggest_goalsツール呼び出し時、suggestionType='goal'がフロントエンドまで正しく伝達されること
- [FR-002] suggest_habitsツール呼び出し時、suggestionType='habit'がフロントエンドまで正しく伝達されること
- [FR-003] show_category_selectionツール呼び出し時、quickRepliesが正しく表示されること
- [FR-004] テキストフォールバックパース時もsuggestionTypeが保持されること
- [FR-005] SuggestionCardコンポーネントがsuggestionTypeに基づいて正しいバッジ色を表示すること

### Non-Functional Requirements

- [NFR-001] 修正後、TypeScriptコンパイルエラーがないこと
- [NFR-002] 既存の機能（reply, stickyn, text, category型）が正常に動作すること

---

## Affected Components

| Component | File | Description |
|-----------|------|-------------|
| Backend Coach Tools | `/backend/src/agents/shared-tools/coach-tools.ts` | suggestionType設定 |
| Frontend MOC Section | `/frontend/app/dashboard/components/Section.MOC.tsx` | パースロジック |
| Vow Coach Agent | `/backend/src/agents/mastra/vow-coach-agent.ts` | ツール呼び出し |

---

## Acceptance Criteria

- [AC-001] 「健康の目標を提案して」と入力した際、紫色の「Goal」バッジが表示される
- [AC-002] 「学習の習慣を提案して」と入力した際、青色の「Habit」バッジが表示される
- [AC-003] カテゴリ選択後のフローで正しいボタンタイプが維持される
- [AC-004] TypeScriptコンパイルが成功する
