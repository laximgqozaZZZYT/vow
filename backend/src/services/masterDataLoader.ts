/**
 * Master Data Loader Service
 *
 * カテゴリ別の習慣・ゴール提案マスターデータを読み込み、
 * AIコーチサービスに提供するサービス。
 *
 * Requirements:
 * - 6.1: THE Master_Data SHALL be stored in Markdown files under `backend/specs/ai-coach/suggestions/` directory
 * - 6.3: WHEN the AI needs to suggest habits, THE system SHALL reference the Master_Data instead of generating suggestions
 * - 9.1: WHEN suggesting habits for a category, THE system SHALL load suggestions from Master_Data instead of generating them
 * - 9.2: THE system SHALL cache Master_Data in memory to avoid repeated file reads
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('masterDataLoader');

/**
 * 難易度レベル
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * 習慣提案のインターフェース
 */
export interface HabitSuggestion {
  /** 習慣名 */
  name: string;
  /** タイプ: do=実行する習慣, avoid=避ける習慣 */
  type: 'do' | 'avoid';
  /** 頻度 */
  frequency: 'daily' | 'weekly' | 'monthly';
  /** 推奨目標回数 */
  suggestedTargetCount: number;
  /** 単位（回、分、ページなど） */
  workloadUnit: string | null;
  /** 提案理由 */
  reason: string;
  /** 実行時刻（HH:MM形式） */
  triggerTime: string | null | undefined;
  /** 所要時間（分） */
  duration: number | null | undefined;
  /** サブカテゴリ */
  subcategory: string | undefined;
  /** 難易度レベル */
  difficultyLevel: DifficultyLevel;
  /** 習慣スタッキングのトリガー（既存習慣との連携ポイント） */
  habitStackingTriggers: string[];
}

/**
 * ゴール提案のインターフェース
 */
export interface GoalSuggestion {
  /** ゴール名 */
  name: string;
  /** 説明 */
  description: string;
  /** アイコン（絵文字） */
  icon: string;
  /** 提案理由 */
  reason: string;
  /** 関連する習慣名のリスト */
  suggestedHabits: string[];
}

/**
 * カテゴリデータのインターフェース
 */
export interface CategoryData {
  /** カテゴリID（英語） */
  category: string;
  /** カテゴリ名（日本語） */
  categoryJa: string;
  /** 習慣提案リスト */
  habits: HabitSuggestion[];
  /** ゴール提案リスト */
  goals: GoalSuggestion[];
  /** サブカテゴリリスト */
  subcategories: string[];
}

/**
 * カテゴリIDとファイル名のマッピング
 */
const CATEGORY_FILE_MAPPING: Record<string, { file: string; nameJa: string }> = {
  'health-fitness': { file: 'health-fitness.md', nameJa: '健康・運動' },
  'work-productivity': { file: 'work-productivity.md', nameJa: '仕事・生産性' },
  'learning-skills': { file: 'learning-skills.md', nameJa: '学習・スキル' },
  'hobbies-relaxation': { file: 'hobbies-relaxation.md', nameJa: '趣味・リラックス' },
  'relationships': { file: 'relationships.md', nameJa: '人間関係' },
  'finance': { file: 'finance.md', nameJa: '財務' },
  'mindfulness-spirituality': { file: 'mindfulness-spirituality.md', nameJa: 'マインドフルネス・精神性' },
  'self-care-beauty': { file: 'self-care-beauty.md', nameJa: 'セルフケア・美容' },
  'home-living': { file: 'home-living.md', nameJa: '家事・住環境' },
  'parenting-family': { file: 'parenting-family.md', nameJa: '子育て・家族' },
  'social-contribution': { file: 'social-contribution.md', nameJa: '社会貢献・ボランティア' },
  'digital-technology': { file: 'digital-technology.md', nameJa: 'デジタル・テクノロジー' },
  'career-growth': { file: 'career-growth.md', nameJa: 'キャリア・成長' },
};

/**
 * MasterDataLoaderクラス
 *
 * マスターデータファイルを読み込み、キャッシュして提供する
 */
export class MasterDataLoader {
  private cache: Map<string, CategoryData> = new Map();
  private suggestionsDir: string;
  private fileReadCount: number = 0;

  /**
   * MasterDataLoaderを初期化する
   *
   * @param suggestionsDir - マスターデータのディレクトリパス
   */
  constructor(suggestionsDir?: string) {
    this.suggestionsDir = suggestionsDir || this.getDefaultSuggestionsDir();
  }

  /**
   * デフォルトのマスターデータディレクトリパスを取得
   */
  private getDefaultSuggestionsDir(): string {
    // Lambda環境かどうかを判定
    if (process.env['AWS_LAMBDA_FUNCTION_NAME']) {
      return '/var/task/lambda-package/specs/ai-coach/suggestions';
    }
    // ローカル開発環境
    return path.resolve(process.cwd(), 'specs/ai-coach/suggestions');
  }

  /**
   * 指定されたカテゴリのデータを読み込む
   *
   * @param category - カテゴリID
   * @returns カテゴリデータ
   */
  async loadCategory(category: string): Promise<CategoryData | null> {
    // キャッシュをチェック
    const cached = this.cache.get(category);
    if (cached) {
      logger.debug('Returning cached category data', { category });
      return cached;
    }

    const mapping = CATEGORY_FILE_MAPPING[category];
    if (!mapping) {
      logger.warning('Unknown category requested', { category });
      return null;
    }

    const filePath = path.join(this.suggestionsDir, mapping.file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      this.fileReadCount++;
      
      const data = this.parseMarkdown(content, category, mapping.nameJa);
      
      // キャッシュに保存
      this.cache.set(category, data);
      
      logger.info('Category data loaded', {
        category,
        habitsCount: data.habits.length,
        goalsCount: data.goals.length,
        subcategoriesCount: data.subcategories.length,
      });

      return data;
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException)?.code;
      
      if (errorCode === 'ENOENT') {
        logger.warning('Category file not found', { category, filePath });
      } else {
        logger.error('Failed to load category file', error as Error, { category, filePath });
      }
      
      return null;
    }
  }

  /**
   * 全カテゴリのデータを読み込む
   *
   * @returns 全カテゴリデータの配列
   */
  async getAllCategories(): Promise<CategoryData[]> {
    const categories = Object.keys(CATEGORY_FILE_MAPPING);
    const results: CategoryData[] = [];

    for (const category of categories) {
      const data = await this.loadCategory(category);
      if (data) {
        results.push(data);
      }
    }

    return results;
  }

  /**
   * 指定されたカテゴリの習慣提案を取得
   *
   * @param category - カテゴリID
   * @returns 習慣提案の配列
   */
  async getHabitsByCategory(category: string): Promise<HabitSuggestion[]> {
    const data = await this.loadCategory(category);
    return data?.habits || [];
  }

  /**
   * 指定されたカテゴリのゴール提案を取得
   *
   * @param category - カテゴリID
   * @returns ゴール提案の配列
   */
  async getGoalsByCategory(category: string): Promise<GoalSuggestion[]> {
    const data = await this.loadCategory(category);
    return data?.goals || [];
  }

  /**
   * 利用可能なカテゴリ一覧を取得
   *
   * @returns カテゴリ情報の配列
   */
  getAvailableCategories(): Array<{ id: string; nameJa: string }> {
    return Object.entries(CATEGORY_FILE_MAPPING).map(([id, mapping]) => ({
      id,
      nameJa: mapping.nameJa,
    }));
  }

  /**
   * キーワードで習慣を検索
   *
   * @param keyword - 検索キーワード
   * @returns マッチした習慣提案の配列
   */
  async searchHabits(keyword: string): Promise<Array<HabitSuggestion & { category: string }>> {
    const allCategories = await this.getAllCategories();
    const results: Array<HabitSuggestion & { category: string }> = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const categoryData of allCategories) {
      for (const habit of categoryData.habits) {
        if (
          habit.name.toLowerCase().includes(lowerKeyword) ||
          habit.reason.toLowerCase().includes(lowerKeyword) ||
          (habit.subcategory && habit.subcategory.toLowerCase().includes(lowerKeyword))
        ) {
          results.push({ ...habit, category: categoryData.category });
        }
      }
    }

    return results;
  }

  /**
   * 難易度レベルで習慣をフィルタリング
   *
   * @param category - カテゴリID
   * @param level - 難易度レベル
   * @returns フィルタリングされた習慣提案の配列
   */
  async getHabitsByDifficulty(category: string, level: DifficultyLevel): Promise<HabitSuggestion[]> {
    const habits = await this.getHabitsByCategory(category);
    return habits.filter(habit => habit.difficultyLevel === level);
  }

  /**
   * 指定された難易度以下の習慣を取得
   *
   * @param category - カテゴリID
   * @param maxLevel - 最大難易度レベル
   * @returns フィルタリングされた習慣提案の配列
   */
  async getHabitsByMaxDifficulty(category: string, maxLevel: DifficultyLevel): Promise<HabitSuggestion[]> {
    const habits = await this.getHabitsByCategory(category);
    const levelOrder: Record<DifficultyLevel, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };
    const maxLevelValue = levelOrder[maxLevel];
    return habits.filter(habit => levelOrder[habit.difficultyLevel] <= maxLevelValue);
  }

  /**
   * 習慣スタッキングトリガーで習慣を検索
   *
   * @param trigger - 検索するトリガー（例: "朝食後", "起床後"）
   * @returns マッチした習慣提案の配列
   */
  async searchHabitsByTrigger(trigger: string): Promise<Array<HabitSuggestion & { category: string }>> {
    const allCategories = await this.getAllCategories();
    const results: Array<HabitSuggestion & { category: string }> = [];
    const lowerTrigger = trigger.toLowerCase();

    for (const categoryData of allCategories) {
      for (const habit of categoryData.habits) {
        const hasMatchingTrigger = habit.habitStackingTriggers.some(
          t => t.toLowerCase().includes(lowerTrigger)
        );
        if (hasMatchingTrigger) {
          results.push({ ...habit, category: categoryData.category });
        }
      }
    }

    return results;
  }

  /**
   * アンカー習慣に基づいて習慣スタッキング候補を取得
   *
   * @param anchorHabitName - アンカー習慣の名前
   * @returns スタッキング候補の習慣提案の配列
   */
  async getStackingCandidates(anchorHabitName: string): Promise<Array<HabitSuggestion & { category: string }>> {
    const allCategories = await this.getAllCategories();
    const results: Array<HabitSuggestion & { category: string }> = [];
    const lowerAnchorName = anchorHabitName.toLowerCase();

    for (const categoryData of allCategories) {
      for (const habit of categoryData.habits) {
        // アンカー習慣名がトリガーに含まれている習慣を検索
        const hasMatchingTrigger = habit.habitStackingTriggers.some(
          t => t.toLowerCase().includes(lowerAnchorName) || 
               lowerAnchorName.includes(t.toLowerCase())
        );
        if (hasMatchingTrigger) {
          results.push({ ...habit, category: categoryData.category });
        }
      }
    }

    return results;
  }

  /**
   * Markdownファイルをパースしてカテゴリデータを生成
   *
   * @param content - Markdownファイルの内容
   * @param category - カテゴリID
   * @param categoryJa - カテゴリ名（日本語）
   * @returns パースされたカテゴリデータ
   */
  private parseMarkdown(content: string, category: string, categoryJa: string): CategoryData {
    const habits: HabitSuggestion[] = [];
    const goals: GoalSuggestion[] = [];
    const subcategories: Set<string> = new Set();

    const lines = content.split('\n');
    let currentSection: 'habits' | 'goals' | null = null;
    let currentSubcategory: string | null = null;
    let currentItem: Partial<HabitSuggestion | GoalSuggestion> | null = null;
    let currentItemType: 'habit' | 'goal' | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line?.trim() || '';

      // セクション検出（## Habits, ## Goals）
      if (trimmedLine.startsWith('## Habits')) {
        currentSection = 'habits';
        currentSubcategory = null;
        continue;
      }
      if (trimmedLine.startsWith('## Goals')) {
        currentSection = 'goals';
        currentSubcategory = null;
        continue;
      }

      // サブカテゴリ検出（### サブカテゴリ名）
      if (trimmedLine.startsWith('### ') && !trimmedLine.startsWith('#### ')) {
        // 前のアイテムを保存
        this.saveCurrentItem(currentItem, currentItemType, habits, goals, currentSubcategory);
        currentItem = null;
        currentItemType = null;

        const subcategoryName = trimmedLine.substring(4).trim();
        if (currentSection === 'habits') {
          currentSubcategory = subcategoryName;
          subcategories.add(subcategoryName);
        } else if (currentSection === 'goals') {
          // ゴールの場合は新しいゴールアイテムとして扱う
          currentItem = { name: subcategoryName };
          currentItemType = 'goal';
        }
        continue;
      }

      // 習慣アイテム検出（#### 習慣名）
      if (trimmedLine.startsWith('#### ') && currentSection === 'habits') {
        // 前のアイテムを保存
        this.saveCurrentItem(currentItem, currentItemType, habits, goals, currentSubcategory);

        const habitName = trimmedLine.substring(5).trim();
        currentItem = { name: habitName };
        currentItemType = 'habit';
        continue;
      }

      // プロパティ検出（- key: value）
      if (trimmedLine.startsWith('- ') && currentItem) {
        const propMatch = trimmedLine.match(/^- (\w+):\s*(.*)$/);
        if (propMatch) {
          const [, key, value] = propMatch;
          if (key && value !== undefined) {
            this.setItemProperty(currentItem, currentItemType!, key, value.trim());
          }
        }
        // suggestedHabits の配列アイテム検出
        if (trimmedLine.startsWith('- suggestedHabits:')) {
          // 次の行から配列を読み取る
          const suggestedHabits: string[] = [];
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j]?.trim() || '';
            if (nextLine.startsWith('- ') && !nextLine.includes(':')) {
              suggestedHabits.push(nextLine.substring(2).trim());
              j++;
            } else if (nextLine.startsWith('  - ')) {
              suggestedHabits.push(nextLine.substring(4).trim());
              j++;
            } else {
              break;
            }
          }
          if (currentItemType === 'goal' && suggestedHabits.length > 0) {
            (currentItem as Partial<GoalSuggestion>).suggestedHabits = suggestedHabits;
          }
          i = j - 1; // ループカウンタを調整
        }
        continue;
      }
    }

    // 最後のアイテムを保存
    this.saveCurrentItem(currentItem, currentItemType, habits, goals, currentSubcategory);

    return {
      category,
      categoryJa,
      habits,
      goals,
      subcategories: Array.from(subcategories),
    };
  }

  /**
   * アイテムのプロパティを設定
   */
  private setItemProperty(
    item: Partial<HabitSuggestion | GoalSuggestion>,
    itemType: 'habit' | 'goal',
    key: string,
    value: string
  ): void {
    if (itemType === 'habit') {
      const habit = item as Partial<HabitSuggestion>;
      switch (key) {
        case 'type':
          habit.type = value as 'do' | 'avoid';
          break;
        case 'frequency':
          habit.frequency = value as 'daily' | 'weekly' | 'monthly';
          break;
        case 'suggestedTargetCount':
          habit.suggestedTargetCount = parseInt(value, 10) || 1;
          break;
        case 'workloadUnit':
          habit.workloadUnit = value === 'null' ? null : value;
          break;
        case 'reason':
          habit.reason = value;
          break;
        case 'triggerTime':
          habit.triggerTime = value === 'null' ? null : value;
          break;
        case 'duration':
          habit.duration = value === 'null' ? null : parseInt(value, 10);
          break;
        case 'difficultyLevel':
          habit.difficultyLevel = this.parseDifficultyLevel(value);
          break;
        case 'habitStackingTriggers':
          habit.habitStackingTriggers = this.parseHabitStackingTriggers(value);
          break;
      }
    } else if (itemType === 'goal') {
      const goal = item as Partial<GoalSuggestion>;
      switch (key) {
        case 'icon':
          goal.icon = value;
          break;
        case 'description':
          goal.description = value;
          break;
        case 'reason':
          goal.reason = value;
          break;
      }
    }
  }

  /**
   * 難易度レベルをパースする
   * 
   * @param value - パースする値
   * @returns 難易度レベル（デフォルト: beginner）
   */
  private parseDifficultyLevel(value: string): DifficultyLevel {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'beginner' || normalized === 'intermediate' || normalized === 'advanced') {
      return normalized;
    }
    return 'beginner'; // デフォルト値
  }

  /**
   * 習慣スタッキングトリガーをパースする
   * 
   * @param value - カンマ区切りの文字列
   * @returns トリガーの配列
   */
  private parseHabitStackingTriggers(value: string): string[] {
    if (!value || value === 'null') {
      return [];
    }
    return value.split(',').map(trigger => trigger.trim()).filter(trigger => trigger.length > 0);
  }

  /**
   * 現在のアイテムを適切な配列に保存
   */
  private saveCurrentItem(
    item: Partial<HabitSuggestion | GoalSuggestion> | null,
    itemType: 'habit' | 'goal' | null,
    habits: HabitSuggestion[],
    goals: GoalSuggestion[],
    subcategory: string | null
  ): void {
    if (!item || !itemType) return;

    if (itemType === 'habit') {
      const habit = item as Partial<HabitSuggestion>;
      if (habit.name && habit.type && habit.frequency) {
        habits.push({
          name: habit.name,
          type: habit.type,
          frequency: habit.frequency,
          suggestedTargetCount: habit.suggestedTargetCount || 1,
          workloadUnit: habit.workloadUnit || null,
          reason: habit.reason || '',
          triggerTime: habit.triggerTime,
          duration: habit.duration,
          subcategory: subcategory || undefined,
          difficultyLevel: habit.difficultyLevel || 'beginner',
          habitStackingTriggers: habit.habitStackingTriggers || [],
        });
      }
    } else if (itemType === 'goal') {
      const goal = item as Partial<GoalSuggestion>;
      if (goal.name) {
        goals.push({
          name: goal.name,
          description: goal.description || '',
          icon: goal.icon || '🎯',
          reason: goal.reason || '',
          suggestedHabits: goal.suggestedHabits || [],
        });
      }
    }
  }

  /**
   * キャッシュをクリアする
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Master data cache cleared');
  }

  /**
   * ファイル読み込み回数を取得（テスト用）
   */
  getFileReadCount(): number {
    return this.fileReadCount;
  }

  /**
   * ファイル読み込み回数をリセット（テスト用）
   */
  resetFileReadCount(): void {
    this.fileReadCount = 0;
  }

  /**
   * キャッシュサイズを取得
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// シングルトンインスタンス
let masterDataLoaderInstance: MasterDataLoader | null = null;

/**
 * MasterDataLoaderのシングルトンインスタンスを取得する
 *
 * @param suggestionsDir - マスターデータのディレクトリパス（オプション）
 * @returns MasterDataLoaderインスタンス
 */
export function getMasterDataLoader(suggestionsDir?: string): MasterDataLoader {
  if (!masterDataLoaderInstance) {
    masterDataLoaderInstance = new MasterDataLoader(suggestionsDir);
  }
  return masterDataLoaderInstance;
}

/**
 * MasterDataLoaderインスタンスをリセットする（テスト用）
 */
export function resetMasterDataLoader(): void {
  masterDataLoaderInstance = null;
}
