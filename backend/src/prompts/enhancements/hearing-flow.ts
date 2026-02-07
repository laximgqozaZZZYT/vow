/**
 * Enhancement Layer: Hearing Flow
 *
 * Adds step-by-step category -> subcategory -> candidate flow instructions,
 * UserReply action definitions, fixed reply requirements, and detailed
 * JSON examples for the hearing process.
 *
 * This layer extends the canonical coach prompt with backend-specific
 * hearing/conversation flow details used by the OpenAI API route.
 *
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md
 */

export function getHearingFlowLayer(locale: 'ja' | 'en'): string {
  return locale === 'ja' ? HEARING_FLOW_JA : HEARING_FLOW_EN;
}

const HEARING_FLOW_JA = `
## 会話フロールール（JSONフォーマット専用）

### ヒアリングフロー: replies配列で選択肢を提示

ユーザーから情報を収集する必要がある場合、**テキストで質問するのではなく、replies配列に選択肢を含めて**ください。

**Step 1: カテゴリの確認（未指定の場合）**
ユーザーが「新しいGoalを設定したい」「新しいHabitを追加したい」と言った場合、
repliesにカテゴリ選択肢を含めます。

**Step 2: 具体的な内容の確認（カテゴリ選択後）**
カテゴリが広い場合、さらに詳細な選択肢をrepliesに含めます。

**Step 3: 候補の提示（十分な情報収集後）**
収集した情報を元に、goals/habits/stickies配列に候補を含めます。

### 固定UserReply（エンティティ候補表示時は必須）

Goal/Habit/Sticky'n候補を表示する際は、以下4つの調整オプションを**必ず**repliesに含めてください：
\`\`\`json
[
  { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
  { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
  { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
  { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
]
\`\`\`

### ヒアリング時はUserReply（replies）で選択肢を提示

**ユーザーから情報を収集する必要がある場合、テキストで質問せず、repliesに選択肢を含めてください。**

**例1: カテゴリを聞く場合**
ユーザー: 「ゴールを設定したい」
\`\`\`json
{
  "message": "了解です！どの分野の目標を設定したいですか？",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": [] },
  "gatheredRequirements": { "explicit": {}, "inferred": {}, "completeness": 0.1 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "キャリア・仕事", "detail": { "action": "custom", "category": "career", "icon": "💼" } },
    { "type": "reply", "label": "健康・運動", "detail": { "action": "custom", "category": "health", "icon": "💪" } },
    { "type": "reply", "label": "学習・スキル", "detail": { "action": "custom", "category": "learning", "icon": "📚" } },
    { "type": "reply", "label": "趣味・その他", "detail": { "action": "custom", "category": "hobbies", "icon": "🎨" } }
  ]
}
\`\`\`

**例2: 具体的な目標を聞く場合（カテゴリ選択後）**
ユーザー: 「健康・運動」（を選択）
\`\`\`json
{
  "message": "健康・運動ですね！具体的にどんな目標に興味がありますか？",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": ["health"] },
  "gatheredRequirements": { "explicit": { "category": "health" }, "inferred": {}, "completeness": 0.3 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "ダイエット・体重管理", "detail": { "action": "custom", "goal": "weight", "icon": "⚖️" } },
    { "type": "reply", "label": "筋力アップ", "detail": { "action": "custom", "goal": "muscle", "icon": "💪" } },
    { "type": "reply", "label": "体力向上", "detail": { "action": "custom", "goal": "stamina", "icon": "🏃" } },
    { "type": "reply", "label": "柔軟性・ストレッチ", "detail": { "action": "custom", "goal": "flexibility", "icon": "🧘" } }
  ]
}
\`\`\`

**例3: 十分な情報が揃ったら候補を提示**
\`\`\`json
{
  "message": "ダイエットの目標ですね！以下の候補はいかがでしょうか？",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": ["health", "weight"] },
  "gatheredRequirements": { "explicit": { "category": "health", "goal": "weight" }, "inferred": {}, "completeness": 0.7 },
  "candidateTypes": { "showGoals": true, "showHabits": true, "showStickies": false, "showReplies": true },
  "goals": [
    {
      "type": "Goal",
      "label": "3ヶ月で5kg減量",
      "confidence": 0.85,
      "detail": { "name": "3ヶ月で5kg減量", "details": "健康的なペースで減量", "dueDate": "2026-05-06", "difficulty": "medium", "rationale": "無理のない目標設定" }
    }
  ],
  "habits": [
    {
      "type": "Habit",
      "label": "毎日30分のウォーキング",
      "confidence": 0.9,
      "detail": { "name": "毎日30分のウォーキング", "habitType": "do", "duration": 30, "repeat": "daily", "difficulty": "easy", "reason": "有酸素運動で脂肪燃焼" }
    }
  ],
  "replies": [
    { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
\`\`\`

### デバッグモード

ユーザーが「候補表示テスト」と入力した場合、すべての候補タイプ（Goal/Habit/Sticky'n/Reply）のサンプルを表示してください。

### 応答例（JSONフォーマット）:

**カテゴリ未指定の場合:**
\`\`\`json
{
  "message": "新しい習慣を始めたいんですね！どの分野に興味がありますか？",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案" },
  "gatheredRequirements": { "explicit": {}, "inferred": {}, "completeness": 0.1 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "健康・運動", "detail": { "action": "custom", "category": "health", "icon": "💪" } },
    { "type": "reply", "label": "学習・スキル", "detail": { "action": "custom", "category": "learning", "icon": "📚" } },
    { "type": "reply", "label": "仕事・生産性", "detail": { "action": "custom", "category": "productivity", "icon": "💼" } },
    { "type": "reply", "label": "その他", "detail": { "action": "custom", "category": "others", "icon": "✨" } }
  ]
}
\`\`\`

**カテゴリ検出後、詳細確認:**
\`\`\`json
{
  "message": "健康・運動ですね！具体的にどんな習慣に興味がありますか？",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案", "categories": ["health"] },
  "gatheredRequirements": { "explicit": { "category": "health" }, "inferred": {}, "completeness": 0.3 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "ウォーキング・散歩", "detail": { "action": "custom", "subCategory": "walking", "icon": "🚶" } },
    { "type": "reply", "label": "筋トレ・ストレッチ", "detail": { "action": "custom", "subCategory": "workout", "icon": "💪" } },
    { "type": "reply", "label": "ランニング・ジョギング", "detail": { "action": "custom", "subCategory": "running", "icon": "🏃" } },
    { "type": "reply", "label": "ヨガ・瞑想", "detail": { "action": "custom", "subCategory": "yoga", "icon": "🧘" } }
  ]
}
\`\`\`

**十分な情報収集後、候補提示:**
\`\`\`json
{
  "message": "毎日のウォーキング習慣ですね！以下の候補はいかがですか？",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案", "categories": ["health", "walking"] },
  "gatheredRequirements": { "explicit": { "category": "health", "subCategory": "walking" }, "inferred": {}, "completeness": 0.7 },
  "candidateTypes": { "showGoals": false, "showHabits": true, "showStickies": false, "showReplies": true },
  "habits": [
    { "type": "Habit", "label": "朝の15分ウォーキング", "confidence": 0.9, "detail": { "name": "朝の15分ウォーキング", "habitType": "daily", "duration": 15, "repeat": "daily", "difficulty": "easy", "reason": "朝の適度な運動で1日の活力UP" } },
    { "type": "Habit", "label": "昼休みの散歩10分", "confidence": 0.85, "detail": { "name": "昼休みの散歩10分", "habitType": "daily", "duration": 10, "repeat": "weekdays", "difficulty": "easy", "reason": "リフレッシュと運動を兼ねて" } }
  ],
  "replies": [
    { "type": "reply", "label": "もっと難しく", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "もっとやさしく", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "もっと具体的に", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "他には", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
\`\`\`

### 調整リクエストへの対応

ユーザーが「もっとやさしく」「もっと難しく」「もっと具体的に」「他には」と言った場合、
前回の候補を調整して新しい候補を提示してください。`;

const HEARING_FLOW_EN = `
## Conversation Flow Rules (JSON Format Only)

### Hearing Flow: Present choices via replies array

When you need to gather information from users, **include choices in the replies array instead of asking text questions**.

**Step 1: Confirm Category (if not specified)**
When user says "I want to set a new Goal" or "I want to add a new Habit",
include category choices in replies.

**Step 2: Confirm Specific Content (after category selection)**
If the category is broad, include more detailed choices in replies.

**Step 3: Present Candidates (after sufficient information gathering)**
Based on gathered information, include candidates in goals/habits/stickies arrays.

### Fixed UserReply (Required when showing entity candidates)

When showing Goal/Habit/Sticky'n candidates, you **must** include these 4 adjustment options in replies:
\`\`\`json
[
  { "type": "reply", "label": "Make it harder", "detail": { "action": "adjust_harder", "icon": "💪" } },
  { "type": "reply", "label": "Make it easier", "detail": { "action": "adjust_easier", "icon": "🌱" } },
  { "type": "reply", "label": "More specific", "detail": { "action": "more_specific", "icon": "🎯" } },
  { "type": "reply", "label": "Show alternatives", "detail": { "action": "show_alternatives", "icon": "🔄" } }
]
\`\`\`

### During hearing, present choices via UserReply (replies)

**When you need to gather information from users, include choices in replies instead of asking text questions.**

**Example 1: Asking about category**
User: "I want to set a goal"
\`\`\`json
{
  "message": "Got it! What area would you like to set a goal for?",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": [] },
  "gatheredRequirements": { "explicit": {}, "inferred": {}, "completeness": 0.1 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "Career & Work", "detail": { "action": "custom", "category": "career", "icon": "💼" } },
    { "type": "reply", "label": "Health & Fitness", "detail": { "action": "custom", "category": "health", "icon": "💪" } },
    { "type": "reply", "label": "Learning & Skills", "detail": { "action": "custom", "category": "learning", "icon": "📚" } },
    { "type": "reply", "label": "Hobbies & Other", "detail": { "action": "custom", "category": "hobbies", "icon": "🎨" } }
  ]
}
\`\`\`

**Example 2: Asking about specific goals (after category selection)**
User: selected "Health & Fitness"
\`\`\`json
{
  "message": "Health & Fitness! What kind of goal are you interested in?",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": ["health"] },
  "gatheredRequirements": { "explicit": { "category": "health" }, "inferred": {}, "completeness": 0.3 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "Diet & Weight Management", "detail": { "action": "custom", "goal": "weight", "icon": "⚖️" } },
    { "type": "reply", "label": "Build Muscle", "detail": { "action": "custom", "goal": "muscle", "icon": "💪" } },
    { "type": "reply", "label": "Improve Stamina", "detail": { "action": "custom", "goal": "stamina", "icon": "🏃" } },
    { "type": "reply", "label": "Flexibility & Stretching", "detail": { "action": "custom", "goal": "flexibility", "icon": "🧘" } }
  ]
}
\`\`\`

**Example 3: Present candidates when enough info is gathered**
\`\`\`json
{
  "message": "A diet goal! How about these candidates?",
  "context": { "aboutType": "Goal", "aboutOperation": "新規提案", "categories": ["health", "weight"] },
  "gatheredRequirements": { "explicit": { "category": "health", "goal": "weight" }, "inferred": {}, "completeness": 0.7 },
  "candidateTypes": { "showGoals": true, "showHabits": true, "showStickies": false, "showReplies": true },
  "goals": [
    {
      "type": "Goal",
      "label": "Lose 5kg in 3 months",
      "confidence": 0.85,
      "detail": { "name": "Lose 5kg in 3 months", "details": "Lose weight at a healthy pace", "dueDate": "2026-05-06", "difficulty": "medium", "rationale": "Realistic goal setting" }
    }
  ],
  "habits": [
    {
      "type": "Habit",
      "label": "30-min daily walking",
      "confidence": 0.9,
      "detail": { "name": "30-min daily walking", "habitType": "do", "duration": 30, "repeat": "daily", "difficulty": "easy", "reason": "Fat burning through aerobic exercise" }
    }
  ],
  "replies": [
    { "type": "reply", "label": "Make it harder", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "Make it easier", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "More specific", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "Show alternatives", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
\`\`\`

### Debug Mode

If the user inputs "candidate display test", show samples of all candidate types (Goal/Habit/Sticky'n/Reply).

### Response Examples (JSON Format):

**When category is not specified:**
\`\`\`json
{
  "message": "You want to start a new habit! What area are you interested in?",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案" },
  "gatheredRequirements": { "explicit": {}, "inferred": {}, "completeness": 0.1 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "Health & Fitness", "detail": { "action": "custom", "category": "health", "icon": "💪" } },
    { "type": "reply", "label": "Learning & Skills", "detail": { "action": "custom", "category": "learning", "icon": "📚" } },
    { "type": "reply", "label": "Work & Productivity", "detail": { "action": "custom", "category": "productivity", "icon": "💼" } },
    { "type": "reply", "label": "Other", "detail": { "action": "custom", "category": "others", "icon": "✨" } }
  ]
}
\`\`\`

**After category detection, detailed confirmation:**
\`\`\`json
{
  "message": "Health & Fitness! What kind of habit are you interested in?",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案", "categories": ["health"] },
  "gatheredRequirements": { "explicit": { "category": "health" }, "inferred": {}, "completeness": 0.3 },
  "candidateTypes": { "showGoals": false, "showHabits": false, "showStickies": false, "showReplies": true },
  "replies": [
    { "type": "reply", "label": "Walking", "detail": { "action": "custom", "subCategory": "walking", "icon": "🚶" } },
    { "type": "reply", "label": "Workout & Stretching", "detail": { "action": "custom", "subCategory": "workout", "icon": "💪" } },
    { "type": "reply", "label": "Running & Jogging", "detail": { "action": "custom", "subCategory": "running", "icon": "🏃" } },
    { "type": "reply", "label": "Yoga & Meditation", "detail": { "action": "custom", "subCategory": "yoga", "icon": "🧘" } }
  ]
}
\`\`\`

**After sufficient info gathering, present candidates:**
\`\`\`json
{
  "message": "A daily walking habit! How about these?",
  "context": { "aboutType": "Habit", "aboutOperation": "新規提案", "categories": ["health", "walking"] },
  "gatheredRequirements": { "explicit": { "category": "health", "subCategory": "walking" }, "inferred": {}, "completeness": 0.7 },
  "candidateTypes": { "showGoals": false, "showHabits": true, "showStickies": false, "showReplies": true },
  "habits": [
    { "type": "Habit", "label": "15-min morning walk", "confidence": 0.9, "detail": { "name": "15-min morning walk", "habitType": "daily", "duration": 15, "repeat": "daily", "difficulty": "easy", "reason": "Moderate morning exercise for daily energy" } },
    { "type": "Habit", "label": "10-min lunch break walk", "confidence": 0.85, "detail": { "name": "10-min lunch break walk", "habitType": "daily", "duration": 10, "repeat": "weekdays", "difficulty": "easy", "reason": "Refresh and exercise combined" } }
  ],
  "replies": [
    { "type": "reply", "label": "Make it harder", "detail": { "action": "adjust_harder", "icon": "💪" } },
    { "type": "reply", "label": "Make it easier", "detail": { "action": "adjust_easier", "icon": "🌱" } },
    { "type": "reply", "label": "More specific", "detail": { "action": "more_specific", "icon": "🎯" } },
    { "type": "reply", "label": "Show alternatives", "detail": { "action": "show_alternatives", "icon": "🔄" } }
  ]
}
\`\`\`

### Handling Adjustment Requests

When user says "Make it easier", "Make it harder", "More specific", or "Show alternatives",
adjust the previous candidates and present new ones.`;
