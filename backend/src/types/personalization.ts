/**
 * Personalization Types
 *
 * ユーザーコンテキスト分析とパーソナライズのための型定義
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3
 */

/**
 * ユーザーの習慣管理経験レベル
 */
export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * 習慣の頻度タイプ
 */
export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

/**
 * 時間帯の情報
 */
export interface TimeSlot {
  /** 時間（0-23） */
  hour: number;
  /** 曜日（0=日曜, 1=月曜, ..., 6=土曜）。省略時は全曜日 */
  dayOfWeek?: number;
  /** この時間帯の使用頻度 */
  frequency: number;
}

/**
 * アンカー習慣（習慣スタッキングの起点となる習慣）
 */
export interface AnchorHabit {
  /** 習慣ID */
  habitId: string;
  /** 習慣名 */
  habitName: string;
  /** 達成率（0-1） */
  completionRate: number;
  /** トリガー時刻（HH:MM形式） */
  triggerTime: string | null;
}

/**
 * ユーザーコンテキスト
 * AIコーチがパーソナライズされた提案を行うための情報
 */
export interface UserContext {
  /** ユーザーID */
  userId: string;
  /** アクティブな習慣の数 */
  activeHabitCount: number;
  /** 平均達成率（0-1） */
  averageCompletionRate: number;
  /** ユーザーレベル */
  userLevel: UserLevel;
  /** 好みの頻度 */
  preferredFrequency: HabitFrequency;
  /** 好みの時間帯（使用頻度順） */
  preferredTimeSlots: TimeSlot[];
  /** 既存の習慣名リスト */
  existingHabitNames: string[];
  /** アンカー習慣（達成率80%以上の習慣） */
  anchorHabits: AnchorHabit[];
  // THLI-24 レベル関連コンテキスト
  /** 習慣レベル分布 */
  levelDistribution?: {
    beginner: number;
    intermediate: number;
    advanced: number;
    expert: number;
    unassessed: number;
  };
  /** 平均習慣レベル（評価済み習慣のみ） */
  averageHabitLevel?: number;
  /** 最高レベルの習慣 */
  highestLevelHabit?: {
    habitId: string;
    habitName: string;
    level: number;
    tier: string;
  };
  /** 最低レベルの習慣 */
  lowestLevelHabit?: {
    habitId: string;
    habitName: string;
    level: number;
    tier: string;
  };
}

/**
 * 類似度チェック結果
 */
export interface SimilarityResult {
  /** 一意かどうか（類似度が閾値未満） */
  isUnique: boolean;
  /** 最も類似した習慣名 */
  mostSimilarHabit: string | null;
  /** 類似度スコア（0-1） */
  similarityScore: number;
}

/**
 * 提案バリデーション結果
 */
export interface SuggestionValidationResult {
  /** 有効かどうか */
  isValid: boolean;
  /** エラーメッセージ */
  errors: string[];
  /** 警告メッセージ */
  warnings: string[];
  /** 類似度チェック結果 */
  similarityCheck: SimilarityResult;
}

/**
 * 拡張された習慣提案（難易度・習慣スタッキング情報付き）
 */
export interface EnhancedHabitSuggestion {
  /** 習慣名 */
  name: string;
  /** タイプ: do=実行する習慣, avoid=避ける習慣 */
  type: 'do' | 'avoid';
  /** 頻度 */
  frequency: HabitFrequency;
  /** 推奨目標回数 */
  suggestedTargetCount: number;
  /** 単位（回、分、ページなど） */
  workloadUnit: string | null;
  /** 実行時刻（HH:MM形式） */
  triggerTime: string | null;
  /** 所要時間（分） */
  duration: number | null;
  /** 提案理由 */
  reason: string;
  /** 難易度レベル */
  difficultyLevel: UserLevel;
  /** 習慣スタッキングのトリガー例 */
  habitStackingTriggers: string[];
  /** サブカテゴリ */
  subcategory: string | undefined;
}

/**
 * PersonalizationEngineインターフェース
 */
export interface IPersonalizationEngine {
  /**
   * ユーザーコンテキストを分析する
   * @param userId ユーザーID
   * @returns ユーザーコンテキスト
   */
  analyzeUserContext(userId: string): Promise<UserContext>;

  /**
   * ユーザーレベルを判定する
   * @param context 部分的なユーザーコンテキスト
   * @returns ユーザーレベル
   */
  determineUserLevel(context: Partial<UserContext>): UserLevel;

  /**
   * 好みの時間帯を特定する
   * @param activities アクティビティリスト
   * @returns 時間帯リスト（使用頻度順）
   */
  identifyPreferredTimeSlots(activities: Array<{ completedAt: Date }>): TimeSlot[];

  /**
   * アンカー習慣を特定する
   * @param habits 習慣リスト
   * @param completionRates 習慣IDと達成率のマップ
   * @returns アンカー習慣リスト
   */
  identifyAnchorHabits(
    habits: Array<{ id: string; name: string; triggerTime: string | null }>,
    completionRates: Map<string, number>
  ): AnchorHabit[];
}

/**
 * SimilarityCheckerインターフェース
 */
export interface ISimilarityChecker {
  /**
   * 類似度をチェックする
   * @param newHabitName 新しい習慣名
   * @param existingHabitNames 既存の習慣名リスト
   * @returns 類似度チェック結果
   */
  checkSimilarity(newHabitName: string, existingHabitNames: string[]): SimilarityResult;

  /**
   * 類似度スコアを計算する
   * @param name1 習慣名1
   * @param name2 習慣名2
   * @returns 類似度スコア（0-1）
   */
  calculateSimilarityScore(name1: string, name2: string): number;

  /**
   * 習慣名を正規化する
   * @param name 習慣名
   * @returns 正規化された習慣名
   */
  normalizeHabitName(name: string): string;
}

/**
 * PromptBuilderインターフェース
 */
export interface IPromptBuilder {
  /**
   * システムプロンプトを構築する
   * @param userContext ユーザーコンテキスト
   * @param basePrompt ベースプロンプト
   * @returns 構築されたシステムプロンプト
   */
  buildSystemPrompt(userContext: UserContext, basePrompt: string): string;

  /**
   * コンテキストサマリーを構築する
   * @param userContext ユーザーコンテキスト
   * @returns コンテキストサマリー文字列
   */
  buildContextSummary(userContext: UserContext): string;
}
