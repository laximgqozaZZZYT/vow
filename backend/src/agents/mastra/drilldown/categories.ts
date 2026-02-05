/**
 * Drilldown Categories
 *
 * Category data for the drilldown (Fukabori) feature.
 * Defines genres, purposes, and response types.
 *
 * @module agents/mastra/drilldown/categories
 */

/**
 * Genre category with associated purposes
 */
export interface GenreCategory {
  id: string;
  labelJa: string;
  labelEn: string;
  icon: string;
  purposes: PurposeOption[];
}

/**
 * Purpose option within a genre
 */
export interface PurposeOption {
  id: string;
  labelJa: string;
  labelEn: string;
}

/**
 * Response type option
 */
export interface ResponseTypeOption {
  id: string;
  labelJa: string;
  labelEn: string;
  targetAgent: 'habit-coach' | 'goal-planner' | 'manager';
}

/**
 * All genre categories with their purposes
 */
export const GENRE_CATEGORIES: GenreCategory[] = [
  {
    id: 'health',
    labelJa: '健康・運動',
    labelEn: 'Health & Fitness',
    icon: '💪',
    purposes: [
      { id: 'lose_weight', labelJa: '体重を減らしたい', labelEn: 'Want to lose weight' },
      { id: 'build_muscle', labelJa: '筋力をつけたい', labelEn: 'Want to build muscle' },
      { id: 'improve_health', labelJa: '体調を整えたい', labelEn: 'Want to improve health' },
      { id: 'reduce_stress', labelJa: 'ストレス解消', labelEn: 'Reduce stress' },
      { id: 'improve_sleep', labelJa: '睡眠を改善したい', labelEn: 'Want to improve sleep' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'career',
    labelJa: 'キャリア・仕事',
    labelEn: 'Career & Work',
    icon: '💼',
    purposes: [
      { id: 'get_promoted', labelJa: '昇進・昇格したい', labelEn: 'Want to get promoted' },
      { id: 'change_job', labelJa: '転職したい', labelEn: 'Want to change jobs' },
      { id: 'improve_skills', labelJa: 'スキルアップしたい', labelEn: 'Want to improve skills' },
      { id: 'productivity', labelJa: '生産性を上げたい', labelEn: 'Want to increase productivity' },
      { id: 'work_life_balance', labelJa: 'ワークライフバランス', labelEn: 'Work-life balance' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'learning',
    labelJa: '学習・スキル',
    labelEn: 'Learning & Skills',
    icon: '📚',
    purposes: [
      { id: 'new_language', labelJa: '新しい言語を学びたい', labelEn: 'Want to learn a new language' },
      { id: 'certification', labelJa: '資格を取りたい', labelEn: 'Want to get certified' },
      { id: 'programming', labelJa: 'プログラミングを学びたい', labelEn: 'Want to learn programming' },
      { id: 'reading', labelJa: '読書習慣をつけたい', labelEn: 'Want to build reading habit' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'hobby',
    labelJa: '趣味・創作',
    labelEn: 'Hobbies & Creation',
    icon: '🎨',
    purposes: [
      { id: 'start_hobby', labelJa: '新しい趣味を始めたい', labelEn: 'Want to start a new hobby' },
      { id: 'improve_hobby', labelJa: '趣味のスキルを上げたい', labelEn: 'Want to improve hobby skills' },
      { id: 'create_something', labelJa: '何か作りたい', labelEn: 'Want to create something' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'relationships',
    labelJa: '人間関係',
    labelEn: 'Relationships',
    icon: '🤝',
    purposes: [
      { id: 'family', labelJa: '家族との時間を増やしたい', labelEn: 'Want more family time' },
      { id: 'friends', labelJa: '友人関係を広げたい', labelEn: 'Want to expand friendships' },
      { id: 'communication', labelJa: 'コミュニケーション力を上げたい', labelEn: 'Want to improve communication' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'finance',
    labelJa: 'お金・資産',
    labelEn: 'Finance & Assets',
    icon: '💰',
    purposes: [
      { id: 'save_money', labelJa: '貯金を増やしたい', labelEn: 'Want to save more money' },
      { id: 'invest', labelJa: '投資を始めたい', labelEn: 'Want to start investing' },
      { id: 'reduce_expenses', labelJa: '支出を減らしたい', labelEn: 'Want to reduce expenses' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'lifestyle',
    labelJa: 'ライフスタイル',
    labelEn: 'Lifestyle',
    icon: '🏠',
    purposes: [
      { id: 'morning_routine', labelJa: '朝活を始めたい', labelEn: 'Want to start morning routine' },
      { id: 'organization', labelJa: '整理整頓したい', labelEn: 'Want to get organized' },
      { id: 'time_management', labelJa: '時間管理を改善したい', labelEn: 'Want to improve time management' },
      { id: 'other', labelJa: 'その他', labelEn: 'Other' },
    ],
  },
  {
    id: 'other',
    labelJa: 'その他',
    labelEn: 'Other',
    icon: '❓',
    purposes: [
      { id: 'other', labelJa: '自由に入力', labelEn: 'Enter freely' },
    ],
  },
];

/**
 * Response type options
 */
export const RESPONSE_TYPE_OPTIONS: ResponseTypeOption[] = [
  {
    id: 'habit_suggestion',
    labelJa: '具体的な習慣を提案',
    labelEn: 'Suggest specific habits',
    targetAgent: 'habit-coach',
  },
  {
    id: 'goal_setting',
    labelJa: '目標設定をサポート',
    labelEn: 'Support goal setting',
    targetAgent: 'goal-planner',
  },
  {
    id: 'information',
    labelJa: 'まず情報を知りたい',
    labelEn: 'Want information first',
    targetAgent: 'manager',
  },
  {
    id: 'advice',
    labelJa: 'アドバイスがほしい',
    labelEn: 'Want advice',
    targetAgent: 'manager',
  },
];

/**
 * Get a genre category by ID
 */
export function getGenreById(genreId: string): GenreCategory | undefined {
  return GENRE_CATEGORIES.find(g => g.id === genreId);
}

/**
 * Get purposes for a specific genre
 */
export function getPurposesForGenre(genreId: string): PurposeOption[] {
  const genre = getGenreById(genreId);
  return genre?.purposes ?? [];
}

/**
 * Get a response type by ID
 */
export function getResponseTypeById(responseTypeId: string): ResponseTypeOption | undefined {
  return RESPONSE_TYPE_OPTIONS.find(r => r.id === responseTypeId);
}
