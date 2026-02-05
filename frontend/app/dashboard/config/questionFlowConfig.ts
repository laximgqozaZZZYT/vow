/**
 * Question Flow Configuration for MOC Chat Improvement
 *
 * Configuration for the multi-step question flow in the MOC chat interface.
 * Defines information type options, category options, and sub-category options.
 *
 * @module questionFlowConfig
 */

/** Information type selection for conversation flow */
export type InfoTypeSelection =
  | 'review_habits'
  | 'habits_for_goal'
  | 'new_goal'
  | 'new_habit'
  | 'check_registered'
  | 'other_advice';

/** Flow step for conversation state machine */
export type FlowStep =
  | 'idle'
  | 'info_type'
  | 'category'
  | 'subcategory'
  | 'generating';

/** Next step types in the conversation flow */
export type NextStepType = 'show_habits' | 'show_goals' | 'category' | 'summary' | 'freeform';

/** Category selection options */
export type CategoryId =
  | 'health'
  | 'career'
  | 'learning'
  | 'hobby'
  | 'relationships'
  | 'finance'
  | 'lifestyle'
  | 'other';

/** Question flow configuration structure */
export interface QuestionFlowConfig {
  /** Step 1: Information type options */
  infoTypeOptions: Array<{
    id: InfoTypeSelection;
    label: { ja: string; en: string };
    icon: string;
    nextStep: NextStepType;
  }>;

  /** Step 2: Category options */
  categoryOptions: Array<{
    id: CategoryId;
    label: { ja: string; en: string };
    icon: string;
  }>;

  /** Step 3: Sub-category options by category */
  subCategoryOptions: Record<CategoryId, Array<{
    id: string;
    label: { ja: string; en: string };
  }>>;
}

/** MOC Chat Question Flow Configuration */
export const QUESTION_FLOW_CONFIG: QuestionFlowConfig = {
  // Step 1: Information type options (6 options)
  infoTypeOptions: [
    {
      id: 'review_habits',
      label: { ja: '既存Habitの見直し', en: 'Review existing Habits' },
      icon: '📋',
      nextStep: 'show_habits',
    },
    {
      id: 'habits_for_goal',
      label: { ja: '既存Goalの新Habit提案', en: 'Suggest Habits for existing Goal' },
      icon: '🎯',
      nextStep: 'show_goals',
    },
    {
      id: 'new_goal',
      label: { ja: '新しいGoalの提案', en: 'Suggest new Goal' },
      icon: '✨',
      nextStep: 'category',
    },
    {
      id: 'new_habit',
      label: { ja: '新しいHabitの提案', en: 'Suggest new Habit' },
      icon: '📝',
      nextStep: 'category',
    },
    {
      id: 'check_registered',
      label: { ja: '登録情報の確認', en: 'Check registered data' },
      icon: '📊',
      nextStep: 'summary',
    },
    {
      id: 'other_advice',
      label: { ja: 'その他アドバイス', en: 'Other advice' },
      icon: '💬',
      nextStep: 'freeform',
    },
  ],

  // Step 2: Category options (8 categories)
  categoryOptions: [
    {
      id: 'health',
      label: { ja: '健康', en: 'Health' },
      icon: '🏃',
    },
    {
      id: 'career',
      label: { ja: 'キャリア', en: 'Career' },
      icon: '💼',
    },
    {
      id: 'learning',
      label: { ja: '学習', en: 'Learning' },
      icon: '📚',
    },
    {
      id: 'hobby',
      label: { ja: '趣味', en: 'Hobby' },
      icon: '🎨',
    },
    {
      id: 'relationships',
      label: { ja: '人間関係', en: 'Relationships' },
      icon: '👥',
    },
    {
      id: 'finance',
      label: { ja: '経済', en: 'Finance' },
      icon: '💰',
    },
    {
      id: 'lifestyle',
      label: { ja: 'ライフスタイル', en: 'Lifestyle' },
      icon: '🏠',
    },
    {
      id: 'other',
      label: { ja: 'その他', en: 'Other' },
      icon: '🔖',
    },
  ],

  // Step 3: Sub-category options by category
  subCategoryOptions: {
    health: [
      { id: 'exercise', label: { ja: '運動', en: 'Exercise' } },
      { id: 'nutrition', label: { ja: '栄養', en: 'Nutrition' } },
      { id: 'sleep', label: { ja: '睡眠', en: 'Sleep' } },
      { id: 'mental', label: { ja: 'メンタル', en: 'Mental Health' } },
      { id: 'medical', label: { ja: '医療', en: 'Medical' } },
    ],
    career: [
      { id: 'skill', label: { ja: 'スキル開発', en: 'Skill Development' } },
      { id: 'networking', label: { ja: 'ネットワーキング', en: 'Networking' } },
      { id: 'productivity', label: { ja: '生産性', en: 'Productivity' } },
      { id: 'leadership', label: { ja: 'リーダーシップ', en: 'Leadership' } },
      { id: 'work_life', label: { ja: 'ワークライフ', en: 'Work-Life Balance' } },
    ],
    learning: [
      { id: 'language', label: { ja: '語学', en: 'Language' } },
      { id: 'technology', label: { ja: 'テクノロジー', en: 'Technology' } },
      { id: 'arts', label: { ja: '芸術', en: 'Arts' } },
      { id: 'academics', label: { ja: '学問', en: 'Academics' } },
      { id: 'self_dev', label: { ja: '自己啓発', en: 'Self Development' } },
    ],
    hobby: [
      { id: 'sports', label: { ja: 'スポーツ', en: 'Sports' } },
      { id: 'music', label: { ja: '音楽', en: 'Music' } },
      { id: 'crafts', label: { ja: '工芸', en: 'Crafts' } },
      { id: 'gaming', label: { ja: 'ゲーム', en: 'Gaming' } },
      { id: 'reading', label: { ja: '読書', en: 'Reading' } },
    ],
    relationships: [
      { id: 'family', label: { ja: '家族', en: 'Family' } },
      { id: 'friends', label: { ja: '友人', en: 'Friends' } },
      { id: 'romantic', label: { ja: '恋愛', en: 'Romantic' } },
      { id: 'professional', label: { ja: '職場', en: 'Professional' } },
      { id: 'community', label: { ja: 'コミュニティ', en: 'Community' } },
    ],
    finance: [
      { id: 'saving', label: { ja: '貯金', en: 'Saving' } },
      { id: 'investing', label: { ja: '投資', en: 'Investing' } },
      { id: 'budgeting', label: { ja: '予算管理', en: 'Budgeting' } },
      { id: 'debt', label: { ja: '債務管理', en: 'Debt Management' } },
      { id: 'income', label: { ja: '収入増加', en: 'Income Growth' } },
    ],
    lifestyle: [
      { id: 'home', label: { ja: '家庭', en: 'Home' } },
      { id: 'organization', label: { ja: '整理整頓', en: 'Organization' } },
      { id: 'time_mgmt', label: { ja: '時間管理', en: 'Time Management' } },
      { id: 'sustainability', label: { ja: '持続可能性', en: 'Sustainability' } },
      { id: 'travel', label: { ja: '旅行', en: 'Travel' } },
    ],
    other: [
      { id: 'spiritual', label: { ja: 'スピリチュアル', en: 'Spiritual' } },
      { id: 'volunteering', label: { ja: 'ボランティア', en: 'Volunteering' } },
      { id: 'creative', label: { ja: 'クリエイティブ', en: 'Creative' } },
      { id: 'personal', label: { ja: '個人的', en: 'Personal' } },
      { id: 'miscellaneous', label: { ja: 'その他', en: 'Miscellaneous' } },
    ],
  },
};
