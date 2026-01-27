/**
 * Template Data for Goal/Habit/Sticky Templates
 *
 * This file contains template data that users can use as starting points
 * for creating their own goals, habits, and stickies.
 * 
 * Templates are organized by category:
 * - 健康・フィットネス (Health & Fitness)
 * - 学習・スキルアップ (Learning & Skills)
 * - 仕事・生産性 (Work & Productivity)
 * - マインドフルネス (Mindfulness)
 * - 趣味・クリエイティブ (Hobbies & Creative)
 *
 * Requirements: Sticky-Habit Subtask Integration testing
 */

import type { Goal, Habit, Sticky } from '@/app/dashboard/types';
import type { Timing } from '@/app/dashboard/types/shared';

// ============================================================================
// Template Categories
// ============================================================================

export type TemplateCategory = 
  | 'health'
  | 'learning'
  | 'work'
  | 'mindfulness'
  | 'creative';

export interface TemplateGoal extends Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  category: TemplateCategory;
  templateId: string;
}

export interface TemplateHabit extends Omit<Habit, 'id' | 'goalId' | 'createdAt' | 'updatedAt' | 'count' | 'completed'> {
  category: TemplateCategory;
  templateId: string;
  parentGoalTemplateId?: string;
}

export interface TemplateSticky extends Omit<Sticky, 'id' | 'createdAt' | 'updatedAt' | 'completed' | 'completedAt'> {
  category: TemplateCategory;
  templateId: string;
  relatedHabitTemplateIds?: string[];
}

// ============================================================================
// Category Metadata
// ============================================================================

export const categoryMetadata: Record<TemplateCategory, { name: string; icon: string; color: string }> = {
  health: { name: '健康・フィットネス', icon: '💪', color: '#22c55e' },
  learning: { name: '学習・スキルアップ', icon: '📚', color: '#3b82f6' },
  work: { name: '仕事・生産性', icon: '💼', color: '#f59e0b' },
  mindfulness: { name: 'マインドフルネス', icon: '🧘', color: '#8b5cf6' },
  creative: { name: '趣味・クリエイティブ', icon: '🎨', color: '#ec4899' },
};

// ============================================================================
// Template Goals
// ============================================================================

export const templateGoals: TemplateGoal[] = [
  // Health & Fitness
  {
    templateId: 'tpl-goal-health-1',
    category: 'health',
    name: '健康的な体づくり',
    details: '運動習慣を身につけ、体力と健康を維持・向上させる。週5日以上の運動を目標に、持続可能なフィットネスルーティンを確立する。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-health-2',
    category: 'health',
    name: '食生活の改善',
    details: 'バランスの取れた食事を心がけ、栄養管理を徹底する。野菜・タンパク質を意識的に摂取し、加工食品を減らす。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-health-3',
    category: 'health',
    name: '睡眠の質向上',
    details: '規則正しい睡眠リズムを確立し、7-8時間の質の高い睡眠を確保する。',
    parentId: null,
    isCompleted: false,
  },

  // Learning & Skills
  {
    templateId: 'tpl-goal-learning-1',
    category: 'learning',
    name: '英語力向上',
    details: 'ビジネスレベルの英語力を身につける。TOEIC 800点以上を目指し、日常的に英語に触れる習慣を作る。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-learning-2',
    category: 'learning',
    name: 'プログラミングスキル習得',
    details: '新しいプログラミング言語やフレームワークを学び、実践的なプロジェクトを完成させる。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-learning-3',
    category: 'learning',
    name: '読書習慣の確立',
    details: '月に2冊以上の本を読み、知識の幅を広げる。ビジネス書、自己啓発、専門書をバランスよく読む。',
    parentId: null,
    isCompleted: false,
  },

  // Work & Productivity
  {
    templateId: 'tpl-goal-work-1',
    category: 'work',
    name: '生産性向上',
    details: '効率的な時間管理と集中力の向上により、仕事の生産性を高める。ポモドーロテクニックやタイムブロッキングを活用。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-work-2',
    category: 'work',
    name: 'プロジェクト完遂',
    details: '重要なプロジェクトを計画通りに完了させる。マイルストーンを設定し、進捗を管理する。',
    parentId: null,
    isCompleted: false,
  },

  // Mindfulness
  {
    templateId: 'tpl-goal-mindfulness-1',
    category: 'mindfulness',
    name: 'メンタルヘルスの維持',
    details: '瞑想やマインドフルネスの実践を通じて、心の健康を保つ。ストレス管理と感情のコントロールを身につける。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-mindfulness-2',
    category: 'mindfulness',
    name: 'ワークライフバランス',
    details: '仕事とプライベートのバランスを取り、充実した生活を送る。休息と趣味の時間を確保する。',
    parentId: null,
    isCompleted: false,
  },

  // Creative
  {
    templateId: 'tpl-goal-creative-1',
    category: 'creative',
    name: 'クリエイティブスキル向上',
    details: '絵画、音楽、写真などのクリエイティブな活動を通じて、表現力を磨く。',
    parentId: null,
    isCompleted: false,
  },
  {
    templateId: 'tpl-goal-creative-2',
    category: 'creative',
    name: '趣味の充実',
    details: '新しい趣味を見つけ、継続的に楽しむ。コミュニティに参加し、同じ趣味を持つ人と交流する。',
    parentId: null,
    isCompleted: false,
  },
];

// ============================================================================
// Template Habits
// ============================================================================

export const templateHabits: TemplateHabit[] = [
  // Health & Fitness Habits
  {
    templateId: 'tpl-habit-health-1',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-1',
    name: '朝のストレッチ',
    active: true,
    type: 'do',
    must: 10,
    time: '06:30',
    endTime: '06:40',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 10,
    workloadPerCount: 10,
    timings: [{ type: 'Daily', start: '06:30', end: '06:40' } as Timing],
  },
  {
    templateId: 'tpl-habit-health-2',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-1',
    name: 'ジョギング',
    active: true,
    type: 'do',
    must: 30,
    time: '07:00',
    endTime: '07:30',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 30,
    workloadPerCount: 30,
    timings: [{ type: 'Daily', start: '07:00', end: '07:30' } as Timing],
  },
  {
    templateId: 'tpl-habit-health-3',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-1',
    name: '筋トレ',
    active: true,
    type: 'do',
    must: 20,
    time: '18:00',
    endTime: '18:20',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 20,
    workloadPerCount: 20,
    timings: [{ type: 'Daily', start: '18:00', end: '18:20' } as Timing],
  },
  {
    templateId: 'tpl-habit-health-4',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-2',
    name: '水を飲む',
    active: true,
    type: 'do',
    must: 8,
    time: '08:00',
    endTime: '20:00',
    repeat: 'Daily',
    workloadUnit: '杯',
    workloadTotal: 8,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '08:00', end: '20:00' } as Timing],
  },
  {
    templateId: 'tpl-habit-health-5',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-2',
    name: '野菜を食べる',
    active: true,
    type: 'do',
    must: 3,
    time: '12:00',
    endTime: '20:00',
    repeat: 'Daily',
    workloadUnit: '食',
    workloadTotal: 3,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '12:00', end: '20:00' } as Timing],
  },
  {
    templateId: 'tpl-habit-health-6',
    category: 'health',
    parentGoalTemplateId: 'tpl-goal-health-3',
    name: '22時までに就寝',
    active: true,
    type: 'do',
    must: 1,
    time: '21:30',
    endTime: '22:00',
    repeat: 'Daily',
    workloadUnit: '回',
    workloadTotal: 1,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '21:30', end: '22:00' } as Timing],
  },

  // Learning Habits
  {
    templateId: 'tpl-habit-learning-1',
    category: 'learning',
    parentGoalTemplateId: 'tpl-goal-learning-1',
    name: '英語リスニング',
    active: true,
    type: 'do',
    must: 15,
    time: '07:30',
    endTime: '07:45',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 15,
    workloadPerCount: 15,
    timings: [{ type: 'Daily', start: '07:30', end: '07:45' } as Timing],
  },
  {
    templateId: 'tpl-habit-learning-2',
    category: 'learning',
    parentGoalTemplateId: 'tpl-goal-learning-1',
    name: '英単語学習',
    active: true,
    type: 'do',
    must: 20,
    time: '12:00',
    endTime: '12:20',
    repeat: 'Daily',
    workloadUnit: '語',
    workloadTotal: 20,
    workloadPerCount: 20,
    timings: [{ type: 'Daily', start: '12:00', end: '12:20' } as Timing],
  },
  {
    templateId: 'tpl-habit-learning-3',
    category: 'learning',
    parentGoalTemplateId: 'tpl-goal-learning-2',
    name: 'コーディング練習',
    active: true,
    type: 'do',
    must: 30,
    time: '20:00',
    endTime: '20:30',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 30,
    workloadPerCount: 30,
    timings: [{ type: 'Daily', start: '20:00', end: '20:30' } as Timing],
  },
  {
    templateId: 'tpl-habit-learning-4',
    category: 'learning',
    parentGoalTemplateId: 'tpl-goal-learning-3',
    name: '読書',
    active: true,
    type: 'do',
    must: 30,
    time: '21:00',
    endTime: '21:30',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 30,
    workloadPerCount: 30,
    timings: [{ type: 'Daily', start: '21:00', end: '21:30' } as Timing],
  },

  // Work & Productivity Habits
  {
    templateId: 'tpl-habit-work-1',
    category: 'work',
    parentGoalTemplateId: 'tpl-goal-work-1',
    name: '朝のタスク整理',
    active: true,
    type: 'do',
    must: 10,
    time: '08:30',
    endTime: '08:40',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 10,
    workloadPerCount: 10,
    timings: [{ type: 'Daily', start: '08:30', end: '08:40' } as Timing],
  },
  {
    templateId: 'tpl-habit-work-2',
    category: 'work',
    parentGoalTemplateId: 'tpl-goal-work-1',
    name: 'ポモドーロセッション',
    active: true,
    type: 'do',
    must: 4,
    time: '09:00',
    endTime: '17:00',
    repeat: 'Daily',
    workloadUnit: 'セッション',
    workloadTotal: 4,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '09:00', end: '17:00' } as Timing],
  },
  {
    templateId: 'tpl-habit-work-3',
    category: 'work',
    parentGoalTemplateId: 'tpl-goal-work-1',
    name: '日報作成',
    active: true,
    type: 'do',
    must: 1,
    time: '17:30',
    endTime: '18:00',
    repeat: 'Daily',
    workloadUnit: '回',
    workloadTotal: 1,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '17:30', end: '18:00' } as Timing],
  },

  // Mindfulness Habits
  {
    templateId: 'tpl-habit-mindfulness-1',
    category: 'mindfulness',
    parentGoalTemplateId: 'tpl-goal-mindfulness-1',
    name: '朝の瞑想',
    active: true,
    type: 'do',
    must: 10,
    time: '06:00',
    endTime: '06:10',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 10,
    workloadPerCount: 10,
    timings: [{ type: 'Daily', start: '06:00', end: '06:10' } as Timing],
  },
  {
    templateId: 'tpl-habit-mindfulness-2',
    category: 'mindfulness',
    parentGoalTemplateId: 'tpl-goal-mindfulness-1',
    name: '感謝日記',
    active: true,
    type: 'do',
    must: 3,
    time: '21:30',
    endTime: '21:45',
    repeat: 'Daily',
    workloadUnit: '項目',
    workloadTotal: 3,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '21:30', end: '21:45' } as Timing],
  },
  {
    templateId: 'tpl-habit-mindfulness-3',
    category: 'mindfulness',
    parentGoalTemplateId: 'tpl-goal-mindfulness-2',
    name: 'デジタルデトックス',
    active: true,
    type: 'do',
    must: 60,
    time: '19:00',
    endTime: '20:00',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 60,
    workloadPerCount: 60,
    timings: [{ type: 'Daily', start: '19:00', end: '20:00' } as Timing],
  },

  // Creative Habits
  {
    templateId: 'tpl-habit-creative-1',
    category: 'creative',
    parentGoalTemplateId: 'tpl-goal-creative-1',
    name: 'スケッチ練習',
    active: true,
    type: 'do',
    must: 15,
    time: '19:00',
    endTime: '19:15',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 15,
    workloadPerCount: 15,
    timings: [{ type: 'Daily', start: '19:00', end: '19:15' } as Timing],
  },
  {
    templateId: 'tpl-habit-creative-2',
    category: 'creative',
    parentGoalTemplateId: 'tpl-goal-creative-1',
    name: '楽器練習',
    active: true,
    type: 'do',
    must: 20,
    time: '20:00',
    endTime: '20:20',
    repeat: 'Daily',
    workloadUnit: '分',
    workloadTotal: 20,
    workloadPerCount: 20,
    timings: [{ type: 'Daily', start: '20:00', end: '20:20' } as Timing],
  },
  {
    templateId: 'tpl-habit-creative-3',
    category: 'creative',
    parentGoalTemplateId: 'tpl-goal-creative-2',
    name: '写真撮影',
    active: true,
    type: 'do',
    must: 5,
    time: '10:00',
    endTime: '18:00',
    repeat: 'Daily',
    workloadUnit: '枚',
    workloadTotal: 5,
    workloadPerCount: 1,
    timings: [{ type: 'Daily', start: '10:00', end: '18:00' } as Timing],
  },
];

// ============================================================================
// Template Stickies (with Habit Relations for Subtask Testing)
// ============================================================================

export const templateStickies: TemplateSticky[] = [
  // Health-related Stickies (subtasks for health habits)
  {
    templateId: 'tpl-sticky-health-1',
    category: 'health',
    name: 'ランニングシューズを買う',
    description: '新しいランニングシューズを購入する。クッション性の高いものを選ぶ。',
    displayOrder: 0,
    relatedHabitTemplateIds: ['tpl-habit-health-2'],
  },
  {
    templateId: 'tpl-sticky-health-2',
    category: 'health',
    name: 'ジムの見学予約',
    description: '近所のジムを見学して、入会を検討する。',
    displayOrder: 1,
    relatedHabitTemplateIds: ['tpl-habit-health-3'],
  },
  {
    templateId: 'tpl-sticky-health-3',
    category: 'health',
    name: 'プロテインを注文',
    description: 'ホエイプロテインを注文する。チョコレート味。',
    displayOrder: 2,
    relatedHabitTemplateIds: ['tpl-habit-health-3'],
  },
  {
    templateId: 'tpl-sticky-health-4',
    category: 'health',
    name: 'ウォーターボトル購入',
    description: '1リットルのウォーターボトルを購入する。',
    displayOrder: 3,
    relatedHabitTemplateIds: ['tpl-habit-health-4'],
  },

  // Learning-related Stickies
  {
    templateId: 'tpl-sticky-learning-1',
    category: 'learning',
    name: '英語アプリをインストール',
    description: 'Duolingoまたは他の英語学習アプリをインストールする。',
    displayOrder: 0,
    relatedHabitTemplateIds: ['tpl-habit-learning-1', 'tpl-habit-learning-2'],
  },
  {
    templateId: 'tpl-sticky-learning-2',
    category: 'learning',
    name: 'オンライン英会話の無料体験',
    description: 'オンライン英会話サービスの無料体験レッスンを予約する。',
    displayOrder: 1,
    relatedHabitTemplateIds: ['tpl-habit-learning-1'],
  },
  {
    templateId: 'tpl-sticky-learning-3',
    category: 'learning',
    name: 'プログラミング教材を選ぶ',
    description: 'Udemy、Coursera、または書籍から学習教材を選ぶ。',
    displayOrder: 2,
    relatedHabitTemplateIds: ['tpl-habit-learning-3'],
  },
  {
    templateId: 'tpl-sticky-learning-4',
    category: 'learning',
    name: '今月読む本を選ぶ',
    description: '今月読む本を2冊選んで購入またはレンタルする。',
    displayOrder: 3,
    relatedHabitTemplateIds: ['tpl-habit-learning-4'],
  },

  // Work-related Stickies
  {
    templateId: 'tpl-sticky-work-1',
    category: 'work',
    name: 'タスク管理ツールの設定',
    description: 'Notion、Todoist、またはTrelloの設定を最適化する。',
    displayOrder: 0,
    relatedHabitTemplateIds: ['tpl-habit-work-1'],
  },
  {
    templateId: 'tpl-sticky-work-2',
    category: 'work',
    name: 'ポモドーロタイマーアプリ',
    description: 'ポモドーロテクニック用のタイマーアプリを選んでインストール。',
    displayOrder: 1,
    relatedHabitTemplateIds: ['tpl-habit-work-2'],
  },
  {
    templateId: 'tpl-sticky-work-3',
    category: 'work',
    name: '日報テンプレート作成',
    description: '効率的な日報作成のためのテンプレートを作成する。',
    displayOrder: 2,
    relatedHabitTemplateIds: ['tpl-habit-work-3'],
  },

  // Mindfulness-related Stickies
  {
    templateId: 'tpl-sticky-mindfulness-1',
    category: 'mindfulness',
    name: '瞑想アプリを試す',
    description: 'Headspace、Calm、またはMeditopiaを試してみる。',
    displayOrder: 0,
    relatedHabitTemplateIds: ['tpl-habit-mindfulness-1'],
  },
  {
    templateId: 'tpl-sticky-mindfulness-2',
    category: 'mindfulness',
    name: '瞑想用クッション購入',
    description: '快適な瞑想のためのクッションを購入する。',
    displayOrder: 1,
    relatedHabitTemplateIds: ['tpl-habit-mindfulness-1'],
  },
  {
    templateId: 'tpl-sticky-mindfulness-3',
    category: 'mindfulness',
    name: '感謝日記ノート購入',
    description: '感謝日記用の専用ノートを購入する。',
    displayOrder: 2,
    relatedHabitTemplateIds: ['tpl-habit-mindfulness-2'],
  },

  // Creative-related Stickies
  {
    templateId: 'tpl-sticky-creative-1',
    category: 'creative',
    name: 'スケッチブック購入',
    description: 'A4サイズのスケッチブックと鉛筆セットを購入。',
    displayOrder: 0,
    relatedHabitTemplateIds: ['tpl-habit-creative-1'],
  },
  {
    templateId: 'tpl-sticky-creative-2',
    category: 'creative',
    name: '楽器のチューニング',
    description: '楽器のチューニングとメンテナンスを行う。',
    displayOrder: 1,
    relatedHabitTemplateIds: ['tpl-habit-creative-2'],
  },
  {
    templateId: 'tpl-sticky-creative-3',
    category: 'creative',
    name: 'カメラの設定を学ぶ',
    description: 'カメラのマニュアルモードの使い方を学ぶ。',
    displayOrder: 2,
    relatedHabitTemplateIds: ['tpl-habit-creative-3'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory) {
  return {
    goals: templateGoals.filter(g => g.category === category),
    habits: templateHabits.filter(h => h.category === category),
    stickies: templateStickies.filter(s => s.category === category),
  };
}

/**
 * Get all categories with their templates
 */
export function getAllTemplateCategories() {
  return Object.keys(categoryMetadata).map(category => ({
    category: category as TemplateCategory,
    metadata: categoryMetadata[category as TemplateCategory],
    ...getTemplatesByCategory(category as TemplateCategory),
  }));
}

/**
 * Convert template goal to actual goal (for creation)
 */
export function templateGoalToCreatePayload(template: TemplateGoal): Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> {
  const { templateId, category, ...goalData } = template;
  return goalData;
}

/**
 * Convert template habit to actual habit (for creation)
 */
export function templateHabitToCreatePayload(
  template: TemplateHabit,
  goalId: string
): Omit<Habit, 'id' | 'createdAt' | 'updatedAt'> {
  const { templateId, category, parentGoalTemplateId, ...habitData } = template;
  return {
    ...habitData,
    goalId,
    count: 0,
    completed: false,
  };
}

/**
 * Convert template sticky to actual sticky (for creation)
 */
export function templateStickyToCreatePayload(
  template: TemplateSticky
): Omit<Sticky, 'id' | 'createdAt' | 'updatedAt'> {
  const { templateId, category, relatedHabitTemplateIds, ...stickyData } = template;
  return {
    ...stickyData,
    completed: false,
  };
}

// ============================================================================
// Export All Template Data
// ============================================================================

export const templateData = {
  goals: templateGoals,
  habits: templateHabits,
  stickies: templateStickies,
  categories: categoryMetadata,
};

export default templateData;
