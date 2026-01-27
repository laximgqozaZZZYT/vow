/**
 * THLI-24 (Total Habit Load Index) Types
 *
 * THLI-24フレームワークを使用した習慣レベル評価システムの型定義。
 * 24変数を4ドメイン（認知、身体、時間、社会）で評価し、
 * 0-199スケールで習慣の難易度を算出する。
 *
 * Requirements:
 * - 1.1-1.7: Schema Extensions for Level Tracking
 * - 2.1-2.8: THLI-24 Assessment Engine
 * - 6.1-6.7: Baby Step Generation
 * - 7.1-7.7: Usage Quota Management
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * THLI-24の離散スコアセット
 * 各変数のスコアはこのセットの値のみを取る
 */
export const DISCRETE_SCORE_SET = [0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3] as const;
export type DiscreteScore = (typeof DISCRETE_SCORE_SET)[number];

/**
 * レベルティア定義
 * beginner: 0-49, intermediate: 50-99, advanced: 100-149, expert: 150-199
 */
export const LEVEL_TIERS = {
  beginner: { min: 0, max: 49 },
  intermediate: { min: 50, max: 99 },
  advanced: { min: 100, max: 149 },
  expert: { min: 150, max: 199 },
} as const;

export type LevelTier = keyof typeof LEVEL_TIERS;

/**
 * コアファクトID（ICI計算に使用）
 * F05は除外（target_frequencyはコアファクトではない）
 */
export const CORE_FACT_IDS = [
  'F01', 'F02', 'F03', 'F04', 'F06', 'F07', 'F08',
  'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F16',
] as const;

export type CoreFactId = (typeof CORE_FACT_IDS)[number];

/**
 * 推論禁止ファクト（No-Inference Facts）
 * これらのファクトはU0（ユーザー明示）でなければならない
 */
export const NO_INFERENCE_FACTS = ['F04', 'F13', 'F14', 'F16'] as const;
export type NoInferenceFactId = (typeof NO_INFERENCE_FACTS)[number];

/**
 * 全ファクトID
 */
export const ALL_FACT_IDS = [
  'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08',
  'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16',
] as const;
export type FactId = (typeof ALL_FACT_IDS)[number];

/**
 * 変数ID（①〜㉔）
 */
export const VARIABLE_IDS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
  '㉑', '㉒', '㉓', '㉔',
] as const;
export type VariableId = (typeof VARIABLE_IDS)[number];

/**
 * 変数ドメイン
 */
export const VARIABLE_DOMAINS = ['cognitive', 'physical', 'temporal', 'social'] as const;
export type VariableDomain = (typeof VARIABLE_DOMAINS)[number];

/**
 * 不確実性タイプ（U-Type）
 * U0: ユーザー明示、U1: 高確信推論、U2: 中確信推論、U3: 低確信推論、U4: 不明
 */
export const U_TYPES = ['U0', 'U1', 'U2', 'U3', 'U4'] as const;
export type UType = (typeof U_TYPES)[number];

/**
 * エビデンスタイプ（E-Type）
 * E0: 直接観察、E1: 間接観察、E2: 自己報告、E3: 推測
 */
export const E_TYPES = ['E0', 'E1', 'E2', 'E3'] as const;
export type EType = (typeof E_TYPES)[number];

/**
 * ファクト値のソース
 */
export const FACT_SOURCES = ['user_stated', 'inferred', 'default'] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/**
 * ストップライト状態
 */
export const STOPLIGHT_STATUSES = ['green', 'yellow', 'red'] as const;
export type StoplightStatus = (typeof STOPLIGHT_STATUSES)[number];

/**
 * 評価セッションステータス
 */
export const ASSESSMENT_STATUSES = [
  'in_progress',
  'completed',
  'failed',
  'needs_more_data',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/**
 * 評価ステップ
 */
export const ASSESSMENT_STEPS = ['audit', 'score', 'validation'] as const;
export type AssessmentStepType = (typeof ASSESSMENT_STEPS)[number];

/**
 * レベル変更理由
 */
export const LEVEL_CHANGE_REASONS = [
  'initial_assessment',
  're_assessment',
  'level_up_progression',
  'level_down_baby_step_lv50',
  'level_down_baby_step_lv10',
] as const;
export type LevelChangeReason = (typeof LEVEL_CHANGE_REASONS)[number];

/**
 * レベル提案タイプ
 */
export const SUGGESTION_TYPES = ['level_up', 'level_down'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

/**
 * レベル提案ステータス
 */
export const SUGGESTION_STATUSES = ['pending', 'accepted', 'dismissed'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/**
 * クロスフレームワークゲートステータス
 */
export const GATE_STATUSES = ['pass', 'fail'] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

// =============================================================================
// Core Interfaces
// =============================================================================

/**
 * ファクト値
 * 各習慣ファクト（F01-F16）の値と不確実性情報
 */
export interface FactValue {
  /** ファクトの値（文字列、数値、または真偽値） */
  value: string | number | boolean;
  /** 不確実性タイプ */
  uType: UType;
  /** エビデンスタイプ */
  eType: EType;
  /** 値のソース */
  source: FactSource;
}

/**
 * 習慣ファクト（F01-F16）
 * THLI-24評価に必要な16のファクト
 */
export interface HabitFacts {
  /** F01: アクション定義 - 何をするか */
  F01_action_definition: FactValue;
  /** F02: 完了定義 - いつ完了とみなすか */
  F02_done_definition: FactValue;
  /** F03: 典型的な所要時間 */
  F03_typical_duration: FactValue;
  /** F04: 実際の頻度（No-Inference） */
  F04_actual_frequency: FactValue;
  /** F05: 目標頻度 */
  F05_target_frequency: FactValue;
  /** F06: 時間枠が固定か */
  F06_time_window_fixed: FactValue;
  /** F07: 実行場所 */
  F07_locations: FactValue;
  /** F08: 移動手段と距離 */
  F08_travel_mode_distance: FactValue;
  /** F09: 必要なツール・リソース */
  F09_tools_resources: FactValue;
  /** F10: 準備ステップ */
  F10_setup_steps: FactValue;
  /** F11: 片付けステップ */
  F11_cleanup_steps: FactValue;
  /** F12: 中断要因 */
  F12_interruptions: FactValue;
  /** F13: 可視性（No-Inference） */
  F13_visibility: FactValue;
  /** F14: 失敗時の結果（No-Inference） */
  F14_failure_consequence: FactValue;
  /** F15: スキル確信度 */
  F15_skill_certainty: FactValue;
  /** F16: 回避シグナル（No-Inference） */
  F16_avoidance_signals: FactValue;
}

/**
 * THLI-24変数
 * 24変数それぞれのスコアと詳細情報
 */
export interface THLIVariable {
  /** 変数ID（①〜㉔） */
  id: VariableId;
  /** 変数名（例: "Cognitive Load", "Physical Demand"） */
  name: string;
  /** ドメイン（認知、身体、時間、社会） */
  domain: VariableDomain;
  /** スコア（離散スコアセットから） */
  score: DiscreteScore;
  /** ストップライト状態 */
  stoplight: StoplightStatus;
  /** スコアの根拠 */
  rationale: string;
  /** このスコアの原因となったファクトID */
  causingFacts: FactId[];
}

/**
 * VOI（Value of Information）質問
 * 不足データを収集するための質問
 */
export interface VOIQuestion {
  /** 対象ファクトID */
  factId: FactId;
  /** ユーザーに尋ねる質問 */
  question: string;
  /** レベル推定への潜在的影響（ΔLv_upper） */
  deltaLvUpper: number;
  /** 優先度（1-5、高いほど重要） */
  priority: number;
}

/**
 * レベル推定結果
 * THLI-24評価の最終結果
 */
export interface LevelEstimate {
  /** 楽観的レベル（O level） */
  optimistic: number;
  /** 期待レベル範囲（E level） */
  expected: { min: number; max: number };
  /** 保守的レベル（C level） */
  conservative: number;
  /** レベルティア */
  tier: LevelTier;
  /** 全24変数のスコア */
  variables: THLIVariable[];
  /** 情報完全性指数（ICI） */
  ici: number;
  /** 使用した仮定予算（AB_used） */
  abUsed: number;
  /** ファイアウォールがトリガーされたか */
  firewallTriggered: boolean;
  /** VOI質問（ファイアウォールトリガー時） */
  voiQuestions?: VOIQuestion[];
  /** 使用したプロンプトバージョン */
  promptVersion: string;
}

/**
 * 評価セッション
 * THLI-24評価の進行状態を追跡
 */
export interface AssessmentSession {
  /** セッションID */
  sessionId: string;
  /** 評価対象の習慣ID */
  habitId: string;
  /** ユーザーID */
  userId: string;
  /** セッションステータス */
  status: AssessmentStatus;
  /** 会話ID */
  conversationId: string;
  /** 現在のステップ */
  currentStep: AssessmentStepType;
  /** 収集済みファクト */
  gatheredFacts: Partial<HabitFacts>;
  /** 作成日時 */
  createdAt: Date;
}

/**
 * 評価ステップ
 * 評価の各ステップの結果
 */
export interface AssessmentStep {
  /** ステップタイプ */
  type: 'question' | 'result' | 'error';
  /** 次の質問（questionタイプの場合） */
  question?: string;
  /** 最終結果（resultタイプの場合） */
  result?: LevelEstimate;
  /** エラーメッセージ（errorタイプの場合） */
  error?: string;
  /** 進捗状況 */
  progress: { current: number; total: number };
}

/**
 * クロスフレームワーク検証結果
 */
export interface CrossFrameworkValidation {
  /** NASA-TLXスコア */
  tlxScore: number;
  /** SRBAIスコア */
  srbaiScore: number;
  /** COM-Bスコア */
  combScore: number;
  /** ゲートステータス */
  gateStatus: GateStatus;
}

/**
 * 検証結果
 */
export interface ValidationResult extends CrossFrameworkValidation {
  /** 不一致の詳細 */
  discrepancyDetails?: {
    domain: VariableDomain;
    thliScore: number;
    externalScore: number;
    difference: number;
  }[] | undefined;
}

// =============================================================================
// Baby Step Interfaces
// =============================================================================

/**
 * ワークロード変更
 * レベルアップ/ダウン時のワークロード変更詳細
 */
export interface WorkloadChanges {
  /** 1回あたりのワークロード変更 */
  workloadPerCount?: { old: number; new: number; changePercent: number };
  /** 頻度変更 */
  frequency?: { old: string; new: string };
  /** 所要時間変更 */
  duration?: { old: number; new: number };
  /** 目標回数変更 */
  targetCount?: { old: number; new: number };
  /** 複雑さ変更 */
  complexity?: { old: string; new: string };
}

/**
 * 変数削減
 * ベビーステップ生成時の変数削減詳細
 */
export interface VariableReduction {
  /** 変数ID */
  variableId: VariableId;
  /** 変数名 */
  variableName: string;
  /** 現在の値 */
  currentValue: string;
  /** 新しい値 */
  newValue: string;
  /** 削減ポイント */
  pointsReduced: number;
  /** 削減の根拠 */
  rationale: string;
}

/**
 * ベビーステッププラン
 * 習慣を簡略化するためのプラン
 */
export interface BabyStepPlan {
  /** 目標レベル */
  targetLevel: number;
  /** 簡略化された習慣名 */
  name: string;
  /** 変数削減リスト */
  changes: VariableReduction[];
  /** ワークロード変更 */
  workloadChanges: WorkloadChanges;
  /** ユーザー向け説明 */
  explanation: string;
  /** 推定難易度（例: "半分の負荷"） */
  estimatedDifficulty: string;
}

/**
 * ベビーステッププラン（Lv.50とLv.10）
 */
export interface BabyStepPlans {
  /** Lv.50プラン（現在の半分） */
  lv50: BabyStepPlan;
  /** Lv.10プラン（最小限の習慣） */
  lv10: BabyStepPlan;
}

/**
 * 最小限の習慣（Lv.10用）
 */
export interface MinimalHabit {
  /** キュー（例: "朝起きたら"） */
  cue: string;
  /** アクション（例: "玄関で靴を履く"） */
  action: string;
  /** 停止条件（例: "靴を履いたら終わり"） */
  stopCondition: string;
  /** フォールバック（例: "靴を履けなかったら、靴を見るだけでもOK"） */
  fallback: string;
  /** 推定所要時間（分） */
  estimatedDuration: number;
}

// =============================================================================
// Level History Interfaces
// =============================================================================

/**
 * レベル変更履歴
 */
export interface LevelChange {
  /** 履歴ID */
  id: string;
  /** エンティティタイプ（習慣またはゴール） */
  entityType: 'habit' | 'goal';
  /** エンティティID */
  entityId: string;
  /** 旧レベル（初回評価時はnull） */
  oldLevel: number | null;
  /** 新レベル */
  newLevel: number;
  /** 変更理由 */
  reason: LevelChangeReason;
  /** ワークロード変更詳細 */
  workloadDelta: WorkloadChanges;
  /** 評価日時 */
  assessedAt: Date;
  /** 作成日時 */
  createdAt: Date;
}

/**
 * レベル履歴フィルター
 */
export interface LevelHistoryFilters {
  /** 日付範囲 */
  dateRange?: { start: Date; end: Date };
  /** 変更タイプ */
  changeType?: 'all' | 'level_up' | 'level_down' | 're_assessment';
}

// =============================================================================
// Level Suggestion Interfaces
// =============================================================================

/**
 * レベル提案
 * レベルアップ/ダウンの提案
 */
export interface LevelSuggestion {
  /** 提案ID */
  id: string;
  /** 習慣ID */
  habitId: string;
  /** 習慣名 */
  habitName: string;
  /** 提案タイプ */
  suggestionType: SuggestionType;
  /** 現在のレベル */
  currentLevel: number;
  /** 目標レベル */
  targetLevel: number;
  /** 提案された変更 */
  proposedChanges: WorkloadChanges | BabyStepPlan;
  /** 提案理由 */
  reason: string;
  /** 検出日時 */
  detectedAt: Date;
  /** ステータス */
  status: SuggestionStatus;
}

// =============================================================================
// Quota Interfaces
// =============================================================================

/**
 * クォータステータス
 * THLI-24評価のクォータ状況
 */
export interface QuotaStatus {
  /** 使用済みクォータ */
  quotaUsed: number;
  /** クォータ上限（-1は無制限） */
  quotaLimit: number;
  /** 残りクォータ */
  remaining: number;
  /** 期間開始日 */
  periodStart: Date;
  /** 期間終了日 */
  periodEnd: Date;
  /** 無制限かどうか */
  isUnlimited: boolean;
}

/**
 * クォータ期間
 */
export interface QuotaPeriod {
  /** 期間ID */
  id: string;
  /** ユーザーID */
  userId: string;
  /** クォータタイプ */
  quotaType: 'thli_assessments';
  /** 使用済みクォータ */
  quotaUsed: number;
  /** クォータ上限 */
  quotaLimit: number;
  /** 期間開始日 */
  periodStart: Date;
  /** 期間終了日 */
  periodEnd: Date;
  /** 作成日時 */
  createdAt: Date;
}

// =============================================================================
// Assessment Data Storage Interface
// =============================================================================

/**
 * 評価データ（JSONB格納用）
 * level_assessment_dataフィールドに格納される完全な評価データ
 */
export interface AssessmentData {
  /** 収集されたファクト */
  facts: HabitFacts;
  /** 24変数のスコア */
  variables: THLIVariable[];
  /** 情報完全性指数 */
  ici: number;
  /** 使用した仮定予算 */
  abUsed: number;
  /** ファイアウォールがトリガーされたか */
  firewallTriggered: boolean;
  /** 楽観的レベル */
  oLevel: number;
  /** 期待レベル範囲 */
  eLevelRange: { min: number; max: number };
  /** 保守的レベル */
  cLevel: number;
  /** クロスフレームワーク検証結果 */
  crossFramework: CrossFrameworkValidation;
  /** プロンプトバージョン */
  promptVersion: string;
  /** 評価日時 */
  assessedAt: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * DiscreteScoreかどうかを判定
 */
export function isDiscreteScore(value: number): value is DiscreteScore {
  return DISCRETE_SCORE_SET.includes(value as DiscreteScore);
}

/**
 * LevelTierかどうかを判定
 */
export function isLevelTier(value: string): value is LevelTier {
  return value in LEVEL_TIERS;
}

/**
 * FactIdかどうかを判定
 */
export function isFactId(value: string): value is FactId {
  return ALL_FACT_IDS.includes(value as FactId);
}

/**
 * CoreFactIdかどうかを判定
 */
export function isCoreFactId(value: string): value is CoreFactId {
  return CORE_FACT_IDS.includes(value as CoreFactId);
}

/**
 * NoInferenceFactIdかどうかを判定
 */
export function isNoInferenceFact(value: string): value is NoInferenceFactId {
  return NO_INFERENCE_FACTS.includes(value as NoInferenceFactId);
}

/**
 * VariableIdかどうかを判定
 */
export function isVariableId(value: string): value is VariableId {
  return VARIABLE_IDS.includes(value as VariableId);
}

/**
 * UTypeかどうかを判定
 */
export function isUType(value: string): value is UType {
  return U_TYPES.includes(value as UType);
}

/**
 * ETypeかどうかを判定
 */
export function isEType(value: string): value is EType {
  return E_TYPES.includes(value as EType);
}

/**
 * FactSourceかどうかを判定
 */
export function isFactSource(value: string): value is FactSource {
  return FACT_SOURCES.includes(value as FactSource);
}

/**
 * FactValueかどうかを判定
 */
export function isFactValue(obj: unknown): obj is FactValue {
  if (typeof obj !== 'object' || obj === null) return false;
  const fv = obj as FactValue;
  return (
    (typeof fv['value'] === 'string' ||
      typeof fv['value'] === 'number' ||
      typeof fv['value'] === 'boolean') &&
    typeof fv['uType'] === 'string' &&
    isUType(fv['uType']) &&
    typeof fv['eType'] === 'string' &&
    isEType(fv['eType']) &&
    typeof fv['source'] === 'string' &&
    isFactSource(fv['source'])
  );
}

/**
 * THLIVariableかどうかを判定
 */
export function isTHLIVariable(obj: unknown): obj is THLIVariable {
  if (typeof obj !== 'object' || obj === null) return false;
  const v = obj as THLIVariable;
  return (
    typeof v['id'] === 'string' &&
    isVariableId(v['id']) &&
    typeof v['name'] === 'string' &&
    typeof v['domain'] === 'string' &&
    VARIABLE_DOMAINS.includes(v['domain'] as VariableDomain) &&
    typeof v['score'] === 'number' &&
    isDiscreteScore(v['score']) &&
    typeof v['stoplight'] === 'string' &&
    STOPLIGHT_STATUSES.includes(v['stoplight'] as StoplightStatus) &&
    typeof v['rationale'] === 'string' &&
    Array.isArray(v['causingFacts']) &&
    (v['causingFacts'] as unknown[]).every((f) => typeof f === 'string' && isFactId(f as string))
  );
}

/**
 * LevelEstimateかどうかを判定
 */
export function isLevelEstimate(obj: unknown): obj is LevelEstimate {
  if (typeof obj !== 'object' || obj === null) return false;
  const le = obj as LevelEstimate;
  const expected = le['expected'] as { min?: number; max?: number } | null;
  return (
    typeof le['optimistic'] === 'number' &&
    le['optimistic'] >= 0 &&
    le['optimistic'] <= 199 &&
    typeof le['expected'] === 'object' &&
    le['expected'] !== null &&
    typeof expected?.min === 'number' &&
    typeof expected?.max === 'number' &&
    typeof le['conservative'] === 'number' &&
    le['conservative'] >= 0 &&
    le['conservative'] <= 199 &&
    typeof le['tier'] === 'string' &&
    isLevelTier(le['tier']) &&
    Array.isArray(le['variables']) &&
    typeof le['ici'] === 'number' &&
    le['ici'] >= 0 &&
    le['ici'] <= 1 &&
    typeof le['abUsed'] === 'number' &&
    typeof le['firewallTriggered'] === 'boolean' &&
    typeof le['promptVersion'] === 'string'
  );
}

/**
 * AssessmentSessionかどうかを判定
 */
export function isAssessmentSession(obj: unknown): obj is AssessmentSession {
  if (typeof obj !== 'object' || obj === null) return false;
  const as = obj as AssessmentSession;
  return (
    typeof as['sessionId'] === 'string' &&
    typeof as['habitId'] === 'string' &&
    typeof as['userId'] === 'string' &&
    typeof as['status'] === 'string' &&
    ASSESSMENT_STATUSES.includes(as['status'] as AssessmentStatus) &&
    typeof as['conversationId'] === 'string' &&
    typeof as['currentStep'] === 'string' &&
    ASSESSMENT_STEPS.includes(as['currentStep'] as AssessmentStepType) &&
    typeof as['gatheredFacts'] === 'object' &&
    as['createdAt'] instanceof Date
  );
}

/**
 * VOIQuestionかどうかを判定
 */
export function isVOIQuestion(obj: unknown): obj is VOIQuestion {
  if (typeof obj !== 'object' || obj === null) return false;
  const vq = obj as VOIQuestion;
  return (
    typeof vq['factId'] === 'string' &&
    isFactId(vq['factId']) &&
    typeof vq['question'] === 'string' &&
    typeof vq['deltaLvUpper'] === 'number' &&
    typeof vq['priority'] === 'number' &&
    vq['priority'] >= 1 &&
    vq['priority'] <= 5
  );
}

/**
 * BabyStepPlanかどうかを判定
 */
export function isBabyStepPlan(obj: unknown): obj is BabyStepPlan {
  if (typeof obj !== 'object' || obj === null) return false;
  const bp = obj as BabyStepPlan;
  return (
    typeof bp['targetLevel'] === 'number' &&
    bp['targetLevel'] >= 0 &&
    bp['targetLevel'] <= 199 &&
    typeof bp['name'] === 'string' &&
    Array.isArray(bp['changes']) &&
    typeof bp['workloadChanges'] === 'object' &&
    typeof bp['explanation'] === 'string' &&
    typeof bp['estimatedDifficulty'] === 'string'
  );
}

/**
 * WorkloadChangesかどうかを判定
 */
export function isWorkloadChanges(obj: unknown): obj is WorkloadChanges {
  if (typeof obj !== 'object' || obj === null) return false;
  const wc = obj as WorkloadChanges;
  // WorkloadChangesは全てオプショナルなので、オブジェクトであれば有効
  // 各フィールドが存在する場合は型をチェック
  if (wc['workloadPerCount'] !== undefined) {
    const wpc = wc['workloadPerCount'];
    if (
      typeof wpc['old'] !== 'number' ||
      typeof wpc['new'] !== 'number' ||
      typeof wpc['changePercent'] !== 'number'
    ) {
      return false;
    }
  }
  if (wc['frequency'] !== undefined) {
    const freq = wc['frequency'];
    if (typeof freq['old'] !== 'string' || typeof freq['new'] !== 'string') {
      return false;
    }
  }
  if (wc['duration'] !== undefined) {
    const dur = wc['duration'];
    if (typeof dur['old'] !== 'number' || typeof dur['new'] !== 'number') {
      return false;
    }
  }
  if (wc['targetCount'] !== undefined) {
    const tc = wc['targetCount'];
    if (typeof tc['old'] !== 'number' || typeof tc['new'] !== 'number') {
      return false;
    }
  }
  if (wc['complexity'] !== undefined) {
    const comp = wc['complexity'];
    if (typeof comp['old'] !== 'string' || typeof comp['new'] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * LevelChangeかどうかを判定
 */
export function isLevelChange(obj: unknown): obj is LevelChange {
  if (typeof obj !== 'object' || obj === null) return false;
  const lc = obj as LevelChange;
  return (
    typeof lc['id'] === 'string' &&
    (lc['entityType'] === 'habit' || lc['entityType'] === 'goal') &&
    typeof lc['entityId'] === 'string' &&
    (lc['oldLevel'] === null || typeof lc['oldLevel'] === 'number') &&
    typeof lc['newLevel'] === 'number' &&
    lc['newLevel'] >= 0 &&
    lc['newLevel'] <= 199 &&
    typeof lc['reason'] === 'string' &&
    LEVEL_CHANGE_REASONS.includes(lc['reason'] as LevelChangeReason) &&
    isWorkloadChanges(lc['workloadDelta']) &&
    lc['assessedAt'] instanceof Date &&
    lc['createdAt'] instanceof Date
  );
}

/**
 * LevelSuggestionかどうかを判定
 */
export function isLevelSuggestion(obj: unknown): obj is LevelSuggestion {
  if (typeof obj !== 'object' || obj === null) return false;
  const ls = obj as LevelSuggestion;
  return (
    typeof ls['id'] === 'string' &&
    typeof ls['habitId'] === 'string' &&
    typeof ls['habitName'] === 'string' &&
    typeof ls['suggestionType'] === 'string' &&
    SUGGESTION_TYPES.includes(ls['suggestionType'] as SuggestionType) &&
    typeof ls['currentLevel'] === 'number' &&
    typeof ls['targetLevel'] === 'number' &&
    typeof ls['proposedChanges'] === 'object' &&
    typeof ls['reason'] === 'string' &&
    ls['detectedAt'] instanceof Date &&
    typeof ls['status'] === 'string' &&
    SUGGESTION_STATUSES.includes(ls['status'] as SuggestionStatus)
  );
}

/**
 * QuotaStatusかどうかを判定
 */
export function isQuotaStatus(obj: unknown): obj is QuotaStatus {
  if (typeof obj !== 'object' || obj === null) return false;
  const qs = obj as QuotaStatus;
  return (
    typeof qs['quotaUsed'] === 'number' &&
    qs['quotaUsed'] >= 0 &&
    typeof qs['quotaLimit'] === 'number' &&
    typeof qs['remaining'] === 'number' &&
    qs['periodStart'] instanceof Date &&
    qs['periodEnd'] instanceof Date &&
    typeof qs['isUnlimited'] === 'boolean'
  );
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * バリデーションエラー
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * フィールドバリデーション結果
 */
export interface FieldValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * FactValueをバリデート
 */
export function validateFactValue(
  factValue: unknown,
  factId: string
): FieldValidationResult {
  const errors: ValidationError[] = [];

  if (!isFactValue(factValue)) {
    errors.push({
      field: factId,
      message: 'Invalid FactValue structure',
      code: 'INVALID_FACT_VALUE',
    });
    return { isValid: false, errors };
  }

  // No-Inferenceファクトの場合、U0でなければならない
  if (isNoInferenceFact(factId) && factValue.uType !== 'U0') {
    errors.push({
      field: factId,
      message: `No-Inference fact ${factId} must have uType U0, got ${factValue.uType}`,
      code: 'NO_INFERENCE_FACT_NOT_U0',
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * HabitFactsをバリデート
 */
export function validateHabitFacts(facts: unknown): FieldValidationResult {
  const errors: ValidationError[] = [];

  if (typeof facts !== 'object' || facts === null) {
    errors.push({
      field: 'facts',
      message: 'HabitFacts must be an object',
      code: 'INVALID_HABIT_FACTS',
    });
    return { isValid: false, errors };
  }

  const factsObj = facts as Record<string, unknown>;

  // 各ファクトをバリデート
  const factKeys = [
    'F01_action_definition',
    'F02_done_definition',
    'F03_typical_duration',
    'F04_actual_frequency',
    'F05_target_frequency',
    'F06_time_window_fixed',
    'F07_locations',
    'F08_travel_mode_distance',
    'F09_tools_resources',
    'F10_setup_steps',
    'F11_cleanup_steps',
    'F12_interruptions',
    'F13_visibility',
    'F14_failure_consequence',
    'F15_skill_certainty',
    'F16_avoidance_signals',
  ];

  for (const key of factKeys) {
    const factId = key.split('_')[0];
    if (factId && factsObj[key] !== undefined) {
      const result = validateFactValue(factsObj[key], factId);
      errors.push(...result.errors);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * THLIVariableをバリデート
 */
export function validateTHLIVariable(variable: unknown): FieldValidationResult {
  const errors: ValidationError[] = [];

  if (!isTHLIVariable(variable)) {
    errors.push({
      field: 'variable',
      message: 'Invalid THLIVariable structure',
      code: 'INVALID_THLI_VARIABLE',
    });
    return { isValid: false, errors };
  }

  // スコアが離散スコアセットに含まれているか確認
  if (!isDiscreteScore(variable.score)) {
    errors.push({
      field: `variable.${variable.id}.score`,
      message: `Score ${variable.score} is not in discrete score set`,
      code: 'INVALID_DISCRETE_SCORE',
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * LevelEstimateをバリデート
 */
export function validateLevelEstimate(estimate: unknown): FieldValidationResult {
  const errors: ValidationError[] = [];

  if (!isLevelEstimate(estimate)) {
    errors.push({
      field: 'estimate',
      message: 'Invalid LevelEstimate structure',
      code: 'INVALID_LEVEL_ESTIMATE',
    });
    return { isValid: false, errors };
  }

  // レベル範囲チェック
  if (estimate.optimistic < 0 || estimate.optimistic > 199) {
    errors.push({
      field: 'optimistic',
      message: 'Optimistic level must be between 0 and 199',
      code: 'LEVEL_OUT_OF_RANGE',
    });
  }

  if (estimate.conservative < 0 || estimate.conservative > 199) {
    errors.push({
      field: 'conservative',
      message: 'Conservative level must be between 0 and 199',
      code: 'LEVEL_OUT_OF_RANGE',
    });
  }

  // O <= E <= C の関係をチェック
  if (estimate.optimistic > estimate.expected.min) {
    errors.push({
      field: 'expected',
      message: 'Optimistic level should be <= expected min',
      code: 'INVALID_LEVEL_ORDER',
    });
  }

  if (estimate.expected.max > estimate.conservative) {
    errors.push({
      field: 'expected',
      message: 'Expected max should be <= conservative level',
      code: 'INVALID_LEVEL_ORDER',
    });
  }

  // 24変数が存在するか確認
  if (estimate.variables.length !== 24) {
    errors.push({
      field: 'variables',
      message: `Expected 24 variables, got ${estimate.variables.length}`,
      code: 'INVALID_VARIABLE_COUNT',
    });
  }

  // 各変数をバリデート
  for (const variable of estimate.variables) {
    const result = validateTHLIVariable(variable);
    errors.push(...result.errors);
  }

  // ICIチェック
  if (estimate.ici < 0 || estimate.ici > 1) {
    errors.push({
      field: 'ici',
      message: 'ICI must be between 0 and 1',
      code: 'INVALID_ICI',
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * AssessmentDataをバリデート
 */
export function validateAssessmentData(data: unknown): FieldValidationResult {
  const errors: ValidationError[] = [];

  if (typeof data !== 'object' || data === null) {
    errors.push({
      field: 'assessmentData',
      message: 'AssessmentData must be an object',
      code: 'INVALID_ASSESSMENT_DATA',
    });
    return { isValid: false, errors };
  }

  const ad = data as Record<string, unknown>;

  // 必須フィールドチェック
  const requiredFields = [
    'facts',
    'variables',
    'ici',
    'abUsed',
    'firewallTriggered',
    'oLevel',
    'eLevelRange',
    'cLevel',
    'crossFramework',
    'promptVersion',
    'assessedAt',
  ];

  for (const field of requiredFields) {
    if (ad[field] === undefined) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
        code: 'MISSING_REQUIRED_FIELD',
      });
    }
  }

  // factsバリデート
  if (ad['facts'] !== undefined) {
    const factsResult = validateHabitFacts(ad['facts']);
    errors.push(...factsResult.errors);
  }

  // variablesバリデート
  if (Array.isArray(ad['variables'])) {
    if ((ad['variables'] as unknown[]).length !== 24) {
      errors.push({
        field: 'variables',
        message: `Expected 24 variables, got ${(ad['variables'] as unknown[]).length}`,
        code: 'INVALID_VARIABLE_COUNT',
      });
    }
    for (const v of ad['variables'] as unknown[]) {
      const result = validateTHLIVariable(v);
      errors.push(...result.errors);
    }
  }

  // レベル範囲チェック
  if (typeof ad['oLevel'] === 'number' && (ad['oLevel'] < 0 || ad['oLevel'] > 199)) {
    errors.push({
      field: 'oLevel',
      message: 'oLevel must be between 0 and 199',
      code: 'LEVEL_OUT_OF_RANGE',
    });
  }

  if (typeof ad['cLevel'] === 'number' && (ad['cLevel'] < 0 || ad['cLevel'] > 199)) {
    errors.push({
      field: 'cLevel',
      message: 'cLevel must be between 0 and 199',
      code: 'LEVEL_OUT_OF_RANGE',
    });
  }

  return { isValid: errors.length === 0, errors };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * レベル値からレベルティアを計算
 * @param level レベル値（0-199）
 * @returns レベルティア
 */
export function calculateLevelTier(level: number): LevelTier {
  if (level < 0 || level > 199) {
    throw new Error(`Level must be between 0 and 199, got ${level}`);
  }

  if (level <= LEVEL_TIERS.beginner.max) return 'beginner';
  if (level <= LEVEL_TIERS.intermediate.max) return 'intermediate';
  if (level <= LEVEL_TIERS.advanced.max) return 'advanced';
  return 'expert';
}

/**
 * レベルティアの境界値を取得
 * @param tier レベルティア
 * @returns 最小値と最大値
 */
export function getLevelTierBounds(tier: LevelTier): { min: number; max: number } {
  return LEVEL_TIERS[tier];
}

/**
 * ICI（Information Completeness Index）を計算
 * @param facts 習慣ファクト（部分的でも可）
 * @returns ICI値（0-1）
 */
export function calculateICI(facts: Partial<HabitFacts>): number {
  const factKeyMap: Record<CoreFactId, keyof HabitFacts> = {
    F01: 'F01_action_definition',
    F02: 'F02_done_definition',
    F03: 'F03_typical_duration',
    F04: 'F04_actual_frequency',
    F06: 'F06_time_window_fixed',
    F07: 'F07_locations',
    F08: 'F08_travel_mode_distance',
    F09: 'F09_tools_resources',
    F10: 'F10_setup_steps',
    F11: 'F11_cleanup_steps',
    F12: 'F12_interruptions',
    F13: 'F13_visibility',
    F14: 'F14_failure_consequence',
    F16: 'F16_avoidance_signals',
  };

  let u0Count = 0;

  for (const factId of CORE_FACT_IDS) {
    const key = factKeyMap[factId];
    const factValue = facts[key];
    if (factValue && factValue.uType === 'U0') {
      u0Count++;
    }
  }

  return u0Count / 14;
}

/**
 * Missingness Firewallがトリガーされるかチェック
 * @param facts 習慣ファクト
 * @param abUsed 使用した仮定予算
 * @returns ファイアウォールがトリガーされる場合はtrue
 */
export function shouldTriggerFirewall(
  facts: Partial<HabitFacts>,
  abUsed: number
): boolean {
  // ICI < 0.6
  const ici = calculateICI(facts);
  if (ici < 0.6) return true;

  // AB_used > 6
  if (abUsed > 6) return true;

  // U4が存在するか
  const factValues = Object.values(facts).filter(
    (v): v is FactValue => v !== undefined
  );
  if (factValues.some((fv) => fv.uType === 'U4')) return true;

  // No-Inferenceファクトがすべて U0 か
  const noInferenceFactKeys: (keyof HabitFacts)[] = [
    'F04_actual_frequency',
    'F13_visibility',
    'F14_failure_consequence',
    'F16_avoidance_signals',
  ];

  for (const key of noInferenceFactKeys) {
    const factValue = facts[key];
    if (factValue && factValue.uType !== 'U0') {
      return true;
    }
  }

  return false;
}

/**
 * 変数スコアの合計を計算
 * @param variables THLI-24変数配列
 * @returns スコア合計
 */
export function sumVariableScores(variables: THLIVariable[]): number {
  return variables.reduce((sum, v) => sum + v.score, 0);
}

/**
 * ストップライト状態を決定
 * @param score 変数スコア
 * @returns ストップライト状態
 */
export function determineStoplight(score: DiscreteScore): StoplightStatus {
  if (score <= 2.8) return 'green';
  if (score <= 5.5) return 'yellow';
  return 'red';
}

/**
 * クォータステータスを計算
 * @param quotaUsed 使用済みクォータ
 * @param quotaLimit クォータ上限（-1は無制限）
 * @param periodStart 期間開始日
 * @param periodEnd 期間終了日
 * @returns クォータステータス
 */
export function calculateQuotaStatus(
  quotaUsed: number,
  quotaLimit: number,
  periodStart: Date,
  periodEnd: Date
): QuotaStatus {
  const isUnlimited = quotaLimit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, quotaLimit - quotaUsed);

  return {
    quotaUsed,
    quotaLimit,
    remaining: isUnlimited ? -1 : remaining,
    periodStart,
    periodEnd,
    isUnlimited,
  };
}

/**
 * クォータが利用可能かチェック
 * @param status クォータステータス
 * @returns 利用可能な場合はtrue
 */
export function isQuotaAvailable(status: QuotaStatus): boolean {
  if (status.isUnlimited) return true;
  return status.remaining > 0;
}

/**
 * Lv.50の目標レベルを計算
 * @param currentLevel 現在のレベル
 * @returns 目標レベル
 */
export function calculateLv50Target(currentLevel: number): number {
  return Math.floor(currentLevel * 0.5);
}

/**
 * Lv.10の目標レベルを計算（常に10以下）
 * @param currentLevel 現在のレベル（使用しないが一貫性のため引数に含める）
 * @returns 目標レベル（10以下）
 */
export function calculateLv10Target(_currentLevel: number): number {
  return 10;
}

/**
 * 頻度変換ルール
 * 頻度を下げる際のポイント削減量
 */
export const FREQUENCY_REDUCTION_RULES = {
  'daily_to_3x_week': { from: 'daily', to: '3x/week', pointsReduced: 2.8 },
  '3x_week_to_weekly': { from: '3x/week', to: 'weekly', pointsReduced: 1.4 },
  'weekly_to_biweekly': { from: 'weekly', to: 'biweekly', pointsReduced: 1.4 },
} as const;

/**
 * 所要時間変換ルール
 * 所要時間を下げる際のポイント削減量
 */
export const DURATION_REDUCTION_RULES = {
  '60_to_30': { from: 60, to: 30, pointsReduced: 2.8 },
  '30_to_15': { from: 30, to: 15, pointsReduced: 1.4 },
  '15_to_5': { from: 15, to: 5, pointsReduced: 1.4 },
} as const;

/**
 * 変数削減優先順位
 * ベビーステップ生成時に優先的に削減する変数
 */
export const VARIABLE_REDUCTION_PRIORITY: VariableId[] = [
  '⑱', // Frequency (temporal)
  '⑬', // Duration (temporal)
  '⑫', // Complexity (cognitive)
  '⑪', // Setup/Cleanup (physical)
  '⑩', // Travel Distance (physical)
  '⑨', // Tools/Resources (physical)
  '⑧', // Interruptions (social)
];

/**
 * 空のHabitFactsを作成
 */
export function createEmptyHabitFacts(): Partial<HabitFacts> {
  return {};
}

/**
 * デフォルトのFactValueを作成
 */
export function createDefaultFactValue(
  value: string | number | boolean
): FactValue {
  return {
    value,
    uType: 'U4',
    eType: 'E3',
    source: 'default',
  };
}

/**
 * ユーザー入力からFactValueを作成
 */
export function createUserStatedFactValue(
  value: string | number | boolean
): FactValue {
  return {
    value,
    uType: 'U0',
    eType: 'E2',
    source: 'user_stated',
  };
}

/**
 * 推論からFactValueを作成
 */
export function createInferredFactValue(
  value: string | number | boolean,
  confidence: 'high' | 'medium' | 'low'
): FactValue {
  const uTypeMap: Record<'high' | 'medium' | 'low', UType> = {
    high: 'U1',
    medium: 'U2',
    low: 'U3',
  };

  return {
    value,
    uType: uTypeMap[confidence],
    eType: 'E1',
    source: 'inferred',
  };
}

/**
 * レベル変更理由を日本語に変換
 */
export function translateLevelChangeReason(reason: LevelChangeReason): string {
  const translations: Record<LevelChangeReason, string> = {
    initial_assessment: '初回評価',
    re_assessment: '再評価',
    level_up_progression: 'レベルアップ',
    level_down_baby_step_lv50: 'ベビーステップ (Lv.50)',
    level_down_baby_step_lv10: 'ベビーステップ (Lv.10)',
  };
  return translations[reason];
}

/**
 * レベルティアを日本語に変換
 */
export function translateLevelTier(tier: LevelTier): string {
  const translations: Record<LevelTier, string> = {
    beginner: '初級',
    intermediate: '中級',
    advanced: '上級',
    expert: 'エキスパート',
  };
  return translations[tier];
}

/**
 * 変数ドメインを日本語に変換
 */
export function translateVariableDomain(domain: VariableDomain): string {
  const translations: Record<VariableDomain, string> = {
    cognitive: '認知',
    physical: '身体',
    temporal: '時間',
    social: '社会',
  };
  return translations[domain];
}
