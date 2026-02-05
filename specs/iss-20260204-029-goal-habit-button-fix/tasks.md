# Goal/Habit型候補ボタン表示不具合修正 - タスク一覧

## Overview
- **Issue ID**: ISS-20260204-029
- **Status**: In Progress
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Author**: vow-spec-architect

---

## Tasks

### Task 1: 問題の詳細調査
- [x] バックエンドのsuggestionType設定を確認
- [x] フロントエンドのparseSuggestions処理を確認
- [x] 根本原因を特定

### Task 2: parseSuggestionsFromText関数の修正
- [ ] suggestionTypeのフォールバックロジックを改善
- [ ] type='goal'の場合にsuggestionType='goal'を設定

### Task 3: TypeScriptコンパイル確認
- [ ] `npm run build`でコンパイルエラーがないことを確認

### Task 4: Supabase Issue更新
- [ ] Issue cc5699ca-476b-49df-a32b-5522054893f4 をresolvedに更新

---

## Progress Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-02-04 | Task 1 | Done | 根本原因を特定 |
| 2026-02-04 | Task 2 | In Progress | 修正実装中 |
