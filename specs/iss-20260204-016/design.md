# Habit Candidate Display Bug Fix - Design

## Overview

AIコーチが返すボタン形式のJSONが正しくパースされ、UIにボタンとして表示されるようにする。

## Current Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AI Response (MCP or Mastra)                                             │
│                                                                          │
│ Text: "趣味・クリエイティブな習慣ですね！                                │
│        創造性を育む習慣を提案します。                                    │
│                                                                          │
│        ```json                                                          │
│        {"buttons": [{"label": "✏️ 毎日5分...", "value": "daily_sketch"}]}│
│        ```                                                              │
│ "                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ useMcpChat / useMastraAgent                                             │
│                                                                          │
│ MastraMessage {                                                          │
│   id: "ai-msg-xxx",                                                     │
│   role: "assistant",                                                    │
│   content: "趣味・クリエイティブな習慣ですね！...",                     │
│   status: "complete",                                                   │
│   toolCalls: undefined  // MCP mode doesn't return toolCalls            │
│ }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Section.MOC.tsx useEffect                                               │
│                                                                          │
│ 1. shouldParseFully = msg.status === 'complete'                         │
│ 2. parseButtonsFromContent(msg.content)                                 │
│    - Try code block pattern: /```(?:json)?\s*\n?([\s\S]*?)\n?```/i     │
│    - Try inline pattern: {"buttons"...}                                 │
│    - Return { quickReplies, cleanedContent }                            │
│ 3. Set quickReplies on GroupChatMessage                                 │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ UI Rendering                                                             │
│                                                                          │
│ {quickReplies?.map(reply => <QuickReplyButton ... />)}                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Problem Analysis

### Issue 1: Code Block Regex Pattern

現在の正規表現:
```javascript
/```(?:json)?\s*\n?([\s\S]*?)\n?```/i
```

この正規表現は lazy quantifier (`*?`) を使用しているため、最短マッチになる。
AIの応答が以下のような形式の場合に問題が発生する可能性:

```
テキスト...

```json
{"buttons": [...]}
```

追加テキスト...
```

### Issue 2: Japanese/Emoji Content

日本語や絵文字を含むJSONをパースする際、特殊文字のエスケープが問題を起こす可能性がある。

**テスト用データ**:
```json
{"buttons": [{"label": "✏️ 毎日5分、スケッチや落書きをする", "value": "daily_sketch"}]}
```

### Issue 3: Streaming State Detection

`msg.status` が `complete` になるタイミングと、`content` が完全に受信されるタイミングにずれがある可能性。

## Proposed Solution

### Fix 1: Improve Code Block Regex

```javascript
// 現在
/```(?:json)?\s*\n?([\s\S]*?)\n?```/i

// 改善案: greedy quantifierを使用し、最後のコードブロックを優先的にマッチ
// Also handle case where closing ``` might be followed by newline or EOF
/```(?:json)?\s*\n([\s\S]+?)\n```(?:\s*$)?/gi
```

### Fix 2: Add Fallback Parsing for Inline JSON

現在の実装では `{"buttons"` で始まるJSONを検索しているが、
AIが余分な空白や改行を含む場合に対応:

```javascript
// 改善: 柔軟なパターンマッチング
const inlinePatterns = [
  '{"buttons"',
  '{ "buttons"',
  '{\n"buttons"',
  '{\n  "buttons"',
];
```

### Fix 3: Debug Logging Enhancement

問題の特定を容易にするため、詳細なデバッグログを追加:

```javascript
console.log('[parseButtonsFromContent] Input:', {
  contentLength: content.length,
  hasCodeBlock: content.includes('```'),
  hasButtonsKeyword: content.includes('buttons'),
  contentPreview: content.substring(0, 500),
});
```

## Implementation

### Phase 1: Enhanced Parsing (Primary Fix)

`parseButtonsFromContent` 関数を改善:

1. コードブロックのマッチングを改善
2. 複数のJSONパターンに対応
3. パース失敗時の詳細ログ

### Phase 2: State Management Fix (If Needed)

`msg.status === 'complete'` の検出が正しく動作しない場合:

1. `useMcpChat` の complete イベント処理を確認
2. `useMastraAgent` の done イベント処理を確認

## Testing Strategy

### Unit Test Cases

1. コードブロック形式のJSONパース
2. インライン形式のJSONパース
3. 日本語・絵文字を含むJSONパース
4. 不正なJSONのエラーハンドリング

### Integration Test Cases

1. MCP モードでカテゴリ選択→習慣候補表示
2. Mastra モードでカテゴリ選択→習慣候補表示
3. ストリーミング中のボタン非表示確認
4. ストリーミング完了後のボタン即時表示確認

## Rollback Plan

変更が問題を起こした場合:
1. `parseButtonsFromContent` を以前の実装に戻す
2. 新しいデバッグログは維持（問題特定のため）
