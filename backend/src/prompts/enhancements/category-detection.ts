/**
 * Enhancement Layer: Category Detection
 *
 * Adds the 8 category keyword mappings and auto-detection rules
 * that allow the AI to skip category selection when keywords are
 * detected in user messages.
 *
 * This layer extends the canonical coach prompt with backend-specific
 * category detection logic used by the OpenAI API route.
 *
 * @see /home/ubuntu/Downloads/vow/specs/role-based-prompt-system/architecture.md
 */

export function getCategoryDetectionLayer(locale: 'ja' | 'en'): string {
  return locale === 'ja' ? CATEGORY_DETECTION_JA : CATEGORY_DETECTION_EN;
}

const CATEGORY_DETECTION_JA = `
## カテゴリ自動検出ルール

ユーザーのメッセージに以下のキーワードが含まれる場合、カテゴリ選択をスキップし、直接候補またはサブカテゴリ選択を表示：

**health関連**: 運動、健康、睡眠、食事、ダイエット、体重、フィットネス、筋トレ、ウォーキング、ランニング、ヨガ、ストレッチ
**learning関連**: 勉強、学習、読書、語学、資格、スキル、本、試験、英語
**productivity関連**: 朝、仕事、タスク、効率、時間管理、ルーティン、生産性、整理、計画
**wellness関連**: 瞑想、マインドフルネス、メンタル、ストレス、リラックス
**finance関連**: 貯金、節約、投資、お金、家計、財務
**career関連**: キャリア、転職、昇進、スキルアップ、職場
**relationships関連**: 人間関係、コミュニケーション、友達、家族
**hobbies関連**: 趣味、創作、クリエイティブ、音楽、絵、写真

**例**:
- 「運動習慣を始めたい」→ healthカテゴリ検出 → 運動の種類選択肢をrepliesに含める
- 「勉強の目標を立てたい」→ learningカテゴリ検出 → 学習分野選択肢をrepliesに含める

## カテゴリとcategoryパラメータの対応

- 健康・運動・フィットネス → "health"
- 学習・勉強・読書 → "learning"
- 仕事・キャリア・生産性 → "productivity"
- キャリア目標 → "career"
- メンタル・マインドフルネス → "wellness"
- 人間関係 → "relationships"
- 趣味・クリエイティブ → "hobbies"
- お金・財務 → "finance"
- 自己成長・ライフスタイル → "lifestyle"`;

const CATEGORY_DETECTION_EN = `
## Category Auto-Detection Rules

When user's message contains the following keywords, skip category selection and directly show candidates or subcategory choices:

**health**: exercise, health, sleep, diet, weight, fitness, workout, walking, running, yoga, stretching
**learning**: study, learning, reading, language, certification, skill, books, exam, English
**productivity**: morning, work, task, efficiency, time management, routine, productivity, organization, planning
**wellness**: meditation, mindfulness, mental, stress, relax
**finance**: savings, budget, investment, money, finances
**career**: career, job change, promotion, skill up, workplace
**relationships**: relationships, communication, friends, family
**hobbies**: hobbies, creative, music, art, photography

### Category Mapping
- health/fitness/exercise → "health"
- learning/study/reading → "learning"
- work/productivity → "productivity"
- career goals → "career"
- mental/mindfulness/meditation/wellness → "wellness"
- relationships/communication/social → "relationships"
- hobbies/creative → "hobbies"
- money/finance/savings → "finance"
- personal growth/lifestyle → "lifestyle"`;
