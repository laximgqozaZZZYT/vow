# ISS-a956eb83: 疲労ストレス応答の改善

## Overview
- **Purpose**: 「疲れました」などの疲労/ストレス表現に対し、AIが具体的なリラックス法（呼吸法、睡眠、瞑想、休息など）を含むアドバイスを返すよう改善する
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Issue Context

### 問題の背景
QA巡回エージェントのテストで、「疲れました」という入力に対するAI応答が期待されるキーワードを含んでいなかった。

### 現状の問題
| 項目 | 値 |
|------|-----|
| Priority | High |
| Category | Bug |
| テスト結果 | 不合格 (0/100点) |
| ペルソナ | Stressed User (tired scenario) |
| 入力 | 「疲れました」 |
| AI応答 | 「お疲れ様です。大変でしたね。何かアドバイスできることがあるかもしれませんので、ぜひお話しください。」 |
| 期待キーワード | リラックス, 呼吸, 睡眠, 瞑想, 休息, 深呼吸 |
| 取得キーワード | なし |

### 問題の根本原因分析

1. **System Promptの不足**: `vow-coach-agent.ts`のsystem promptには「疲れ」「ストレス」への対応として`generate_advice(adviceType: "recovery")`を使用するよう指示があるが、具体的なアドバイス内容（リラックス法など）の指定がない。

2. **generate_advice toolのprompt不足**: `coach-tools.ts`の`generateAdviceExecute`関数において、`adviceType: "recovery"`の場合の具体的なアドバイス内容（呼吸法、睡眠、瞑想など）を含めるよう明示的な指示がない。

3. **Fallback adviceの汎用性**: OpenAI APIが使えない場合のfallback adviceにも疲労/ストレス専用の対応がない。

## Requirements

### Functional Requirements

- [FR-001] 「疲れました」「疲れた」「しんどい」「つかれた」などの疲労表現に対し、AIは以下のキーワードを最低1つ以上含む応答を返すこと
  - リラックス
  - 呼吸 / 深呼吸
  - 睡眠 / 休息
  - 瞑想

- [FR-002] `generate_advice`ツールが`adviceType: "recovery"`かつ疲労関連のuserMoodで呼び出された場合、具体的なリラックス法を含むアドバイスを生成すること

- [FR-003] System promptにおいて、「疲れ」「ストレス」表現に対する具体的なアドバイス指針を追加すること

- [FR-004] Fallback adviceにも疲労/ストレス専用のバリエーションを追加すること

### Non-Functional Requirements

- [NFR-001] 既存のテストを壊さないこと
- [NFR-002] 応答時間に大きな影響を与えないこと
- [NFR-003] 他のadviceType（motivation, strategy, celebration, general）の動作に影響を与えないこと

## Acceptance Criteria

- [AC-001] 「疲れました」入力に対し、応答に「リラックス」「呼吸」「睡眠」「瞑想」「休息」「深呼吸」のうち少なくとも1つが含まれる
- [AC-002] QA巡回テスト（Stressed User - tired scenario）がパスする
- [AC-003] 既存の単体テスト・統合テストがすべてパスする

## Agent Coordination Notes

このSpecは単独のエージェントで完結可能。以下のファイルを修正する予定：
1. `/home/ubuntu/Downloads/vow/backend/src/agents/mastra/vow-coach-agent.ts` - System prompt修正
2. `/home/ubuntu/Downloads/vow/backend/src/agents/shared-tools/coach-tools.ts` - generate_advice修正
