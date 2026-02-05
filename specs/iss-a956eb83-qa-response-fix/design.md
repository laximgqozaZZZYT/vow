# ISS-a956eb83: 技術設計書

## Overview

疲労/ストレス表現に対し、具体的なリラックス法を含むアドバイスを返すための技術設計。

## Architecture

### 現行フロー

```
User Input: "疲れました"
    ↓
vow-coach-agent (System Prompt)
    ↓ adviceType: "recovery" と判定
generateAdviceExecute()
    ↓
OpenAI API Call (system prompt + user prompt)
    ↓
Response: 一般的なアドバイス（具体的なリラックス法なし）
```

### 改善後フロー

```
User Input: "疲れました"
    ↓
vow-coach-agent (System Prompt) ← 【修正1】疲労専用ガイダンス追加
    ↓ adviceType: "recovery", focusArea: "fatigue_stress" と判定
generateAdviceExecute() ← 【修正2】recovery+fatigue時の専用プロンプト
    ↓
OpenAI API Call (疲労専用system prompt + user prompt)
    ↓
Response: 具体的なリラックス法を含むアドバイス
    ↓ 【修正3】Fallbackにも疲労専用対応追加
User に表示
```

## Detailed Design

### 修正1: vow-coach-agent.ts - System Prompt強化

`generateSystemPrompt()`内の感情表現対応セクションを強化。

**変更箇所**: 行598付近

```typescript
// Before
| 「今日は疲れた」「しんどい」 | **「お疲れ様です」「大変でしたね」と共感してから** generate_advice(adviceType: "recovery", userMood: "struggling") | **generate_advice** |

// After
| 「今日は疲れた」「しんどい」「疲れました」 | **「お疲れ様です」「大変でしたね」と共感してから** generate_advice(adviceType: "recovery", userMood: "struggling", focusArea: "fatigue_stress") を呼び出し、**必ず**リラックス法・呼吸法・睡眠・瞑想・休息のいずれかを含むアドバイスを生成 | **generate_advice** |
```

さらに、専用セクションを追加:

```typescript
### 疲労・ストレス表現への専用対応（最重要）

「疲れました」「疲れた」「しんどい」「つかれた」「ストレス」などの表現には、**必ず**以下のいずれかを含む具体的なアドバイスを提供：

- **リラックス法**: 「リラックスする時間を設けましょう」「肩の力を抜いて」
- **呼吸法**: 「深呼吸を3回」「4-7-8呼吸法」「ゆっくり呼吸」
- **睡眠・休息**: 「十分な睡眠を」「休息を取る」「早めに休む」
- **瞑想**: 「5分間の瞑想」「マインドフルネス」

**❌ 禁止**: 「アドバイスできることがあるかもしれません」のような曖昧な返答
**✅ 必須**: 上記キーワードを含む具体的なリラックス・休息アドバイス
```

### 修正2: coach-tools.ts - generateAdviceExecute()

**変更箇所**: generateAdviceExecute関数内のsystemPrompt/userPrompt生成部分

```typescript
// adviceTypeDescriptions を拡張
const adviceTypeDescriptions = {
  general: isJa ? '全般的なコーチングアドバイス' : 'general coaching advice',
  motivation: isJa ? 'モチベーションを高めるアドバイス' : 'motivation-boosting advice',
  strategy: isJa ? '効果的な戦略とアプローチ' : 'effective strategies and approaches',
  recovery: isJa ? '疲労やストレスからの回復方法' : 'recovery from fatigue and stress',  // ← 修正
  celebration: isJa ? '成功を祝い次に進むアドバイス' : 'celebrating success and moving forward',
};

// recovery専用のプロンプト追加ロジック
const recoverySpecificGuidance = input.adviceType === 'recovery'
  ? (isJa
    ? `
【重要】疲労・ストレス回復アドバイスには、以下のキーワードを必ず1つ以上含めてください：
- リラックス（リラックスする時間、リラックス法など）
- 呼吸（深呼吸、呼吸法、ゆっくり呼吸など）
- 睡眠（十分な睡眠、早めに休む、休息など）
- 瞑想（5分間の瞑想、マインドフルネスなど）
- 休息（体を休める、休憩を取るなど）

具体的な実践方法を含めてください。例：
- 「4-7-8呼吸法を試してみてください（4秒吸う、7秒止める、8秒で吐く）」
- 「5分間の瞑想アプリを使ってリラックスしましょう」
- 「今日は早めに休息を取り、十分な睡眠を確保しましょう」
`
    : `
【IMPORTANT】Recovery advice for fatigue/stress MUST include at least one of these keywords:
- Relaxation (relax, relaxation techniques)
- Breathing (deep breathing, breathing exercises)
- Sleep (adequate sleep, rest early)
- Meditation (5-minute meditation, mindfulness)
- Rest (take a break, rest your body)

Include specific practical methods. Examples:
- "Try the 4-7-8 breathing technique (inhale 4s, hold 7s, exhale 8s)"
- "Use a 5-minute meditation app to relax"
- "Rest early today and get adequate sleep"
`)
  : '';
```

### 修正3: Fallback Adviceの疲労専用バージョン追加

```typescript
// recovery専用のfallback
const recoveryFallbackAdvice: AdviceResult = {
  advice: isJa
    ? 'お疲れ様です。体と心を休めることが大切です。まずは深呼吸を3回してみましょう。4秒吸って、7秒止めて、8秒かけて吐く「4-7-8呼吸法」がリラックスに効果的です。'
    : 'You\'ve worked hard. It\'s important to rest your body and mind. Let\'s start with 3 deep breaths. The "4-7-8 breathing technique" (inhale 4s, hold 7s, exhale 8s) is effective for relaxation.',
  keyInsight: isJa
    ? '休息は怠けではなく、次へ進むための大切な投資です。'
    : 'Rest is not laziness, but an important investment for moving forward.',
  motivation: isJa
    ? '今日はゆっくり休んで、明日また元気に始めましょう！'
    : 'Take it easy today and start fresh tomorrow!',
  actionSteps: isJa
    ? ['深呼吸を3回する', '5分間の瞑想またはリラックス', '十分な睡眠を取る']
    : ['Take 3 deep breaths', '5-minute meditation or relaxation', 'Get adequate sleep'],
  wisdomQuote: isJa
    ? '休息もまた仕事の一部である - オウィディウス'
    : 'Rest is also a part of work - Ovid',
  adviceType: 'recovery',
  followUpActions: [...],
};
```

## Dependencies

- OpenAI API (既存)
- `coach-tools.ts` の `generateAdviceExecute` 関数
- `vow-coach-agent.ts` の `generateSystemPrompt` 関数

## Testing Strategy

1. **Unit Test追加**: `generateAdviceExecute`が`adviceType: "recovery"`で呼ばれた際、応答に期待キーワードが含まれることを確認
2. **Integration Test**: 「疲れました」入力 → 期待キーワードを含む応答
3. **QA巡回テスト再実行**: Stressed User - tired scenarioのパス確認

## Rollback Plan

変更はlocalized（2ファイルのみ）であり、git revertで容易にロールバック可能。
