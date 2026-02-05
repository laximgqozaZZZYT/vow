/**
 * Tool Configuration
 *
 * Centralized configuration for AI coach tool categories and options.
 * This allows easy modification of available categories without changing tool schemas.
 *
 * @module agents/shared-tools/tool-config
 */

// =============================================================================
// Habit Categories
// =============================================================================

/**
 * Available habit categories
 * These are the topics users can focus on for habit suggestions
 */
export const HABIT_CATEGORIES = [
  // Health & Physical
  'health',
  'fitness',
  'nutrition',
  'sleep',
  'exercise',

  // Mental & Emotional
  'wellness',
  'mindfulness',
  'mental_health',
  'stress_management',

  // Productivity & Work
  'productivity',
  'time_management',
  'focus',
  'organization',
  'work',

  // Learning & Growth
  'learning',
  'reading',
  'skills',
  'creativity',
  'education',

  // Social & Relationships
  'relationships',
  'social',
  'communication',
  'family',

  // Finance & Career
  'finance',
  'career',
  'savings',

  // Lifestyle
  'lifestyle',
  'hobbies',
  'self_care',
  'morning_routine',
  'evening_routine',

  // Other
  'other',
] as const;

export type HabitCategory = (typeof HABIT_CATEGORIES)[number];

// =============================================================================
// Goal Categories
// =============================================================================

/**
 * Available goal categories
 * These are the topics users can focus on for goal suggestions
 */
export const GOAL_CATEGORIES = [
  // Health & Physical
  'health',
  'fitness',
  'nutrition',
  'weight',
  'exercise',

  // Mental & Emotional
  'wellness',
  'mindfulness',
  'mental_health',

  // Productivity & Work
  'productivity',
  'time_management',
  'work',
  'projects',

  // Learning & Growth
  'learning',
  'education',
  'skills',
  'certifications',
  'reading',

  // Social & Relationships
  'relationships',
  'social',
  'family',
  'networking',

  // Finance & Career
  'finance',
  'career',
  'savings',
  'investment',
  'business',

  // Lifestyle
  'lifestyle',
  'hobbies',
  'travel',
  'home',

  // Other
  'other',
] as const;

export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

// =============================================================================
// Sticky'n (Memo/Note) Categories
// =============================================================================

/**
 * Available Sticky'n categories
 * These are the topics users can focus on for memo/note suggestions
 */
export const STICKYN_CATEGORIES = [
  // Ideas & Inspiration
  'idea',
  'inspiration',
  'reminder',

  // Tasks & Planning
  'task',
  'todo',
  'planning',
  'priority',

  // Learning & Growth
  'learning',
  'insight',
  'reflection',

  // Daily Life
  'gratitude',
  'mood',
  'journal',

  // Work & Projects
  'work',
  'meeting',
  'project',

  // Personal
  'personal',
  'goal_note',
  'habit_note',

  // Other
  'other',
] as const;

export type StickyNCategory = (typeof STICKYN_CATEGORIES)[number];

/**
 * Japanese labels for Sticky'n categories
 */
export const STICKYN_CATEGORY_LABELS_JA: Record<StickyNCategory, string> = {
  idea: 'アイデア',
  inspiration: 'インスピレーション',
  reminder: 'リマインダー',
  task: 'タスク',
  todo: 'やること',
  planning: '計画',
  priority: '優先事項',
  learning: '学び',
  insight: '気づき',
  reflection: '振り返り',
  gratitude: '感謝',
  mood: '気分',
  journal: '日記',
  work: '仕事',
  meeting: '会議',
  project: 'プロジェクト',
  personal: '個人的なメモ',
  goal_note: '目標メモ',
  habit_note: '習慣メモ',
  other: 'その他',
};

// =============================================================================
// Analysis Periods
// =============================================================================

/**
 * Available analysis periods for habit analysis
 */
export const ANALYSIS_PERIODS = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;

export type AnalysisPeriod = (typeof ANALYSIS_PERIODS)[number];

// =============================================================================
// Difficulty Levels
// =============================================================================

/**
 * Difficulty levels for habits and goals
 */
export const DIFFICULTY_LEVELS = [
  'beginner',
  'easy',
  'intermediate',
  'advanced',
  'expert',
] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// =============================================================================
// Frequency Options
// =============================================================================

/**
 * Available frequency options for habits
 */
export const FREQUENCY_OPTIONS = [
  'daily',
  'weekly',
  'weekdays',
  'weekends',
  '2x/week',
  '3x/week',
  '4x/week',
  '5x/week',
  'monthly',
  'custom',
] as const;

export type FrequencyOption = (typeof FREQUENCY_OPTIONS)[number];

// =============================================================================
// Japanese Labels (for UI display)
// =============================================================================

/**
 * Japanese labels for habit categories
 */
export const HABIT_CATEGORY_LABELS_JA: Record<HabitCategory, string> = {
  health: '健康',
  fitness: 'フィットネス',
  nutrition: '栄養',
  sleep: '睡眠',
  exercise: '運動',
  wellness: 'ウェルネス',
  mindfulness: 'マインドフルネス',
  mental_health: 'メンタルヘルス',
  stress_management: 'ストレス管理',
  productivity: '生産性',
  time_management: '時間管理',
  focus: '集中力',
  organization: '整理整頓',
  work: '仕事',
  learning: '学習',
  reading: '読書',
  skills: 'スキル',
  creativity: '創造性',
  education: '教育',
  relationships: '人間関係',
  social: '社交',
  communication: 'コミュニケーション',
  family: '家族',
  finance: '家計・財務',
  career: 'キャリア',
  savings: '貯蓄',
  lifestyle: 'ライフスタイル',
  hobbies: '趣味',
  self_care: 'セルフケア',
  morning_routine: '朝の習慣',
  evening_routine: '夜の習慣',
  other: 'その他',
};

/**
 * Japanese labels for goal categories
 */
export const GOAL_CATEGORY_LABELS_JA: Record<GoalCategory, string> = {
  health: '健康',
  fitness: 'フィットネス',
  nutrition: '栄養',
  weight: '体重管理',
  exercise: '運動',
  wellness: 'ウェルネス',
  mindfulness: 'マインドフルネス',
  mental_health: 'メンタルヘルス',
  productivity: '生産性',
  time_management: '時間管理',
  work: '仕事',
  projects: 'プロジェクト',
  learning: '学習',
  education: '教育',
  skills: 'スキル習得',
  certifications: '資格取得',
  reading: '読書',
  relationships: '人間関係',
  social: '社交',
  family: '家族',
  networking: 'ネットワーキング',
  finance: '家計・財務',
  career: 'キャリア',
  savings: '貯蓄',
  investment: '投資',
  business: 'ビジネス',
  lifestyle: 'ライフスタイル',
  hobbies: '趣味',
  travel: '旅行',
  home: '住まい',
  other: 'その他',
};
