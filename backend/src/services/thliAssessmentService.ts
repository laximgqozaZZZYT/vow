/**
 * THLI-24 Assessment Service
 *
 * THLI-24（Total Habit Load Index）フレームワークを使用した
 * 習慣レベル評価サービス。
 *
 * Requirements:
 * - 2.1: THLI-24 Assessment Engine - 会話型監査
 * - 2.2: ICI（Information Completeness Index）計算
 * - 2.3: Missingness Firewall
 * - 2.4-2.5: THLI-24スコアリングアルゴリズム
 * - 2.7: VOI質問生成
 * - 4.2: クォータチェック
 * - 10.6: マルチターン会話
 * - 11.7: コンテキスト注入
 * - 12.1-12.4: クロスフレームワーク検証
 * - 15.5: プロンプトコンテキスト注入
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { getTHLIPromptLoader, type THLIPromptContext } from './specLoader.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { GoalRepository } from '../repositories/goalRepository.js';
import { getTHLIErrorHandler, type THLIErrorHandler } from './thliErrorHandler.js';
import { withTHLIRetry } from '../utils/thliRetry.js';
import type {
  HabitFacts,
  FactValue,
  THLIVariable,
  LevelEstimate,
  AssessmentSession,
  AssessmentStep,
  VOIQuestion,
  QuotaStatus,
  CrossFrameworkValidation,
  ValidationResult,
  AssessmentData,
  VariableId,
  DiscreteScore,
  UType,
  FactId,
} from '../types/thli.js';
import {
  DISCRETE_SCORE_SET,
  CORE_FACT_IDS,
  NO_INFERENCE_FACTS,
  calculateICI,
  shouldTriggerFirewall,
  calculateLevelTier,
  sumVariableScores,
  determineStoplight,
  isDiscreteScore,
} from '../types/thli.js';

const logger = getLogger('thliAssessmentService');

// =============================================================================
// Constants
// =============================================================================

/**
 * THLI-24変数の定義
 * 各変数のID、名前、ドメイン、関連ファクトを定義
 */
const THLI_VARIABLE_DEFINITIONS: Array<{
  id: VariableId;
  name: string;
  nameJa: string;
  domain: 'cognitive' | 'physical' | 'temporal' | 'social';
  relatedFacts: FactId[];
}> = [
  // Cognitive Domain (①-⑥)
  { id: '①', name: 'Action Complexity', nameJa: 'アクション複雑性', domain: 'cognitive', relatedFacts: ['F01', 'F02'] },
  { id: '②', name: 'Decision Load', nameJa: '意思決定負荷', domain: 'cognitive', relatedFacts: ['F01', 'F06'] },
  { id: '③', name: 'Skill Requirement', nameJa: 'スキル要件', domain: 'cognitive', relatedFacts: ['F15'] },
  { id: '④', name: 'Attention Demand', nameJa: '注意力要求', domain: 'cognitive', relatedFacts: ['F12'] },
  { id: '⑤', name: 'Memory Load', nameJa: '記憶負荷', domain: 'cognitive', relatedFacts: ['F09', 'F10'] },
  { id: '⑥', name: 'Planning Requirement', nameJa: '計画要件', domain: 'cognitive', relatedFacts: ['F06', 'F07'] },
  // Physical Domain (⑦-⑫)
  { id: '⑦', name: 'Physical Effort', nameJa: '身体的努力', domain: 'physical', relatedFacts: ['F01', 'F03'] },
  { id: '⑧', name: 'Location Dependency', nameJa: '場所依存性', domain: 'physical', relatedFacts: ['F07', 'F08'] },
  { id: '⑨', name: 'Tool Requirement', nameJa: 'ツール要件', domain: 'physical', relatedFacts: ['F09'] },
  { id: '⑩', name: 'Travel Distance', nameJa: '移動距離', domain: 'physical', relatedFacts: ['F08'] },
  { id: '⑪', name: 'Setup/Cleanup', nameJa: '準備/片付け', domain: 'physical', relatedFacts: ['F10', 'F11'] },
  { id: '⑫', name: 'Environmental Control', nameJa: '環境制御', domain: 'physical', relatedFacts: ['F07', 'F12'] },
  // Temporal Domain (⑬-⑱)
  { id: '⑬', name: 'Duration', nameJa: '所要時間', domain: 'temporal', relatedFacts: ['F03'] },
  { id: '⑭', name: 'Time Window Rigidity', nameJa: '時間枠の厳格さ', domain: 'temporal', relatedFacts: ['F06'] },
  { id: '⑮', name: 'Scheduling Complexity', nameJa: 'スケジュール複雑性', domain: 'temporal', relatedFacts: ['F04', 'F05'] },
  { id: '⑯', name: 'Interruption Risk', nameJa: '中断リスク', domain: 'temporal', relatedFacts: ['F12'] },
  { id: '⑰', name: 'Recovery Time', nameJa: '回復時間', domain: 'temporal', relatedFacts: ['F03', 'F11'] },
  { id: '⑱', name: 'Frequency', nameJa: '頻度', domain: 'temporal', relatedFacts: ['F04', 'F05'] },
  // Social Domain (⑲-㉔)
  { id: '⑲', name: 'Social Visibility', nameJa: '社会的可視性', domain: 'social', relatedFacts: ['F13'] },
  { id: '⑳', name: 'Accountability', nameJa: '説明責任', domain: 'social', relatedFacts: ['F14'] },
  { id: '㉑', name: 'Social Coordination', nameJa: '社会的調整', domain: 'social', relatedFacts: ['F07', 'F12'] },
  { id: '㉒', name: 'External Dependency', nameJa: '外部依存性', domain: 'social', relatedFacts: ['F09', 'F12'] },
  { id: '㉓', name: 'Avoidance Triggers', nameJa: '回避トリガー', domain: 'social', relatedFacts: ['F16'] },
  { id: '㉔', name: 'Identity Alignment', nameJa: 'アイデンティティ整合性', domain: 'social', relatedFacts: ['F01', 'F14'] },
];

/**
 * VOI質問テンプレート
 * 各ファクトに対する質問テンプレート
 */
const VOI_QUESTION_TEMPLATES: Record<FactId, { question: string; questionJa: string; baseImpact: number }> = {
  F01: { question: 'What specific action do you perform for this habit?', questionJa: 'この習慣で具体的にどのようなアクションを行いますか？', baseImpact: 8 },
  F02: { question: 'How do you know when the habit is complete?', questionJa: 'この習慣が完了したとどのように判断しますか？', baseImpact: 6 },
  F03: { question: 'How long does this habit typically take?', questionJa: 'この習慣には通常どのくらいの時間がかかりますか？', baseImpact: 7 },
  F04: { question: 'How often do you actually perform this habit?', questionJa: '実際にこの習慣をどのくらいの頻度で行っていますか？', baseImpact: 9 },
  F05: { question: 'What is your target frequency for this habit?', questionJa: 'この習慣の目標頻度は何ですか？', baseImpact: 5 },
  F06: { question: 'Do you have a fixed time window for this habit?', questionJa: 'この習慣には決まった時間枠がありますか？', baseImpact: 6 },
  F07: { question: 'Where do you perform this habit?', questionJa: 'この習慣はどこで行いますか？', baseImpact: 5 },
  F08: { question: 'How do you get to the location and how far is it?', questionJa: 'その場所までどのように行きますか？距離はどのくらいですか？', baseImpact: 4 },
  F09: { question: 'What tools or resources do you need?', questionJa: 'どのようなツールやリソースが必要ですか？', baseImpact: 5 },
  F10: { question: 'What setup steps are required before starting?', questionJa: '開始前にどのような準備が必要ですか？', baseImpact: 4 },
  F11: { question: 'What cleanup is needed after finishing?', questionJa: '終了後にどのような片付けが必要ですか？', baseImpact: 3 },
  F12: { question: 'What typically interrupts this habit?', questionJa: 'この習慣を中断させるものは何ですか？', baseImpact: 6 },
  F13: { question: 'Who can see you performing this habit?', questionJa: 'この習慣を行っているところを誰が見ることができますか？', baseImpact: 7 },
  F14: { question: 'What happens if you fail to complete this habit?', questionJa: 'この習慣を完了できなかった場合、どうなりますか？', baseImpact: 8 },
  F15: { question: 'How confident are you in your ability to perform this habit?', questionJa: 'この習慣を行う能力にどの程度自信がありますか？', baseImpact: 5 },
  F16: { question: 'What signals make you want to avoid this habit?', questionJa: 'この習慣を避けたくなるシグナルは何ですか？', baseImpact: 8 },
};

// =============================================================================
// In-Memory Session Store
// =============================================================================

/**
 * 評価セッションのインメモリストア
 * 本番環境ではRedisやDBに置き換えることを推奨
 */
const sessionStore = new Map<string, AssessmentSession>();

/**
 * 会話履歴のインメモリストア
 */
const conversationStore = new Map<string, ChatCompletionMessageParam[]>();

// =============================================================================
// THLIAssessmentService Class
// =============================================================================

/**
 * THLI-24評価サービス
 *
 * 習慣の難易度レベルを評価するためのサービス。
 * THLI-24フレームワークに基づいて、会話型監査、スコアリング、
 * クロスフレームワーク検証を実行する。
 */
export class THLIAssessmentService {
  private openai: OpenAI | null = null;
  private model: string;
  private habitRepo: HabitRepository;
  private goalRepo: GoalRepository;
  private supabase: SupabaseClient;
  private promptVersion: string = 'v1.9';
  private errorHandler: THLIErrorHandler;

  /**
   * THLIAssessmentServiceを初期化する
   *
   * @param supabase - Supabaseクライアント
   */
  constructor(supabase: SupabaseClient) {
    const settings = getSettings();
    this.model = settings.openaiModel || 'gpt-4o-mini';
    this.supabase = supabase;

    if (settings.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: settings.openaiApiKey });
    }

    this.habitRepo = new HabitRepository(supabase);
    this.goalRepo = new GoalRepository(supabase);
    this.errorHandler = getTHLIErrorHandler(supabase);
  }

  /**
   * サービスが利用可能かチェック
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  // ===========================================================================
  // 4.1: initiateAssessment - 評価の開始
  // ===========================================================================

  /**
   * 新しいTHLI-24評価を開始する
   *
   * Requirements: 2.1, 4.2, 11.7, 15.5
   *
   * @param habitId - 評価対象の習慣ID
   * @param userId - ユーザーID
   * @param language - 言語設定（'en' | 'ja'）
   * @returns 評価セッション
   */
  async initiateAssessment(
    habitId: string,
    userId: string,
    language: 'en' | 'ja' = 'ja'
  ): Promise<AssessmentSession> {
    logger.info('Initiating THLI-24 assessment', { habitId, userId, language });

    // 1. クォータチェック
    const quotaStatus = await this.checkUserQuota(userId);
    if (!quotaStatus.isUnlimited && quotaStatus.remaining <= 0) {
      throw new Error('QUOTA_EXCEEDED: 今月のTHLI-24評価回数の上限に達しました。');
    }

    // 2. 習慣情報を取得
    const habit = await this.habitRepo.getById(habitId);
    if (!habit) {
      throw new Error(`Habit not found: ${habitId}`);
    }

    // 3. ゴール情報を取得（存在する場合）
    let goalContext = '';
    if (habit.goal_id) {
      const goal = await this.goalRepo.getById(habit.goal_id);
      if (goal) {
        goalContext = goal.name;
      }
    }

    // 4. THLI-24プロンプトを読み込み、コンテキストを注入
    const promptLoader = getTHLIPromptLoader();
    const context: THLIPromptContext = {
      habitName: habit.name,
      currentWorkload: this.formatWorkload(habit),
      goalContext: goalContext || '特になし',
      userLevel: '未評価',
    };

    const { prompt, validation } = await promptLoader.prepareTHLIPrompt(
      language,
      context,
      this.promptVersion
    );

    if (!validation.isValid) {
      logger.warning('THLI prompt validation failed', {
        missingSections: validation.missingSections,
      });
    }

    // 5. セッションを作成
    const sessionId = this.generateSessionId();
    const conversationId = this.generateConversationId();

    const session: AssessmentSession = {
      sessionId,
      habitId,
      userId,
      status: 'in_progress',
      conversationId,
      currentStep: 'audit',
      gatheredFacts: {},
      createdAt: new Date(),
    };

    // 6. セッションを保存
    sessionStore.set(sessionId, session);

    // 7. 初期会話を設定
    const systemMessage: ChatCompletionMessageParam = {
      role: 'system',
      content: prompt,
    };

    const initialUserMessage: ChatCompletionMessageParam = {
      role: 'user',
      content: language === 'ja'
        ? `「${habit.name}」という習慣のレベルを評価してください。`
        : `Please assess the level of the habit "${habit.name}".`,
    };

    conversationStore.set(conversationId, [systemMessage, initialUserMessage]);

    logger.info('Assessment session created', {
      sessionId,
      habitId,
      userId,
      promptVersion: this.promptVersion,
    });

    return session;
  }

  // ===========================================================================
  // 4.2: continueAssessment - マルチターン会話の継続
  // ===========================================================================

  /**
   * 評価を継続する（ユーザー応答を処理）
   *
   * Requirements: 2.1, 10.6, 18.1, 18.2, 18.3, 18.6
   *
   * @param sessionId - セッションID
   * @param userResponse - ユーザーの応答
   * @returns 次のステップ（質問または結果）
   */
  async continueAssessment(
    sessionId: string,
    userResponse: string
  ): Promise<AssessmentStep> {
    logger.info('Continuing assessment', { sessionId });

    // 1. セッションを取得
    const session = sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'in_progress') {
      throw new Error(`Session is not in progress: ${session.status}`);
    }

    // 2. 会話履歴を取得
    const conversation = conversationStore.get(session.conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${session.conversationId}`);
    }

    // 3. ユーザー応答を追加
    conversation.push({ role: 'user', content: userResponse });

    // 4. OpenAI APIを呼び出し（リトライロジック付き）
    // Requirements: 18.1 - Retry up to 3 times with exponential backoff (2s, 4s, 8s)
    if (!this.openai) {
      throw new Error('OpenAI API not configured');
    }

    const openai = this.openai;
    const model = this.model;

    // Execute with retry logic
    const retryResult = await withTHLIRetry(
      async () => {
        const response = await openai.chat.completions.create({
          model: model,
          messages: conversation,
          temperature: 0.7,
          max_tokens: 2000,
        });
        return response;
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000, // 2s, 4s, 8s
      }
    );

    // Handle retry failure
    // Requirements: 18.2 - Save conversation state on failure
    if (!retryResult.success) {
      logger.error('OpenAI API call failed after retries', retryResult.error, {
        sessionId,
        attempts: retryResult.attempts,
      });

      // Save failed assessment for resumption
      const saveResult = await this.errorHandler.saveFailedAssessment(
        session,
        conversation,
        retryResult.error,
        retryResult.attempts
      );

      session.status = 'failed';
      sessionStore.set(sessionId, session);

      return {
        type: 'error',
        error: saveResult.userMessage,
        progress: { current: Object.keys(session.gatheredFacts).length, total: 16 },
      };
    }

    const response = retryResult.result!;
    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage) {
      throw new Error('No response from OpenAI');
    }

    // 5. アシスタント応答を会話履歴に追加
    conversation.push({
      role: 'assistant',
      content: assistantMessage.content || '',
    });

    // 6. 応答を解析してファクトを抽出
    const extractedFacts = this.parseResponseForFacts(assistantMessage.content || '');
    this.mergeGatheredFacts(session, extractedFacts);

    // 7. 評価の進捗を計算
    const gatheredCount = Object.keys(session.gatheredFacts).length;
    const progress = { current: gatheredCount, total: 16 };

    // 8. スコアリングに移行するか判断
    const ici = calculateICI(session.gatheredFacts);
    const shouldScore = this.shouldMoveToScoring(session.gatheredFacts, ici);

    if (shouldScore) {
      // スコアリングフェーズに移行
      session.currentStep = 'score';
      const levelEstimate = await this.calculateLevel(session.gatheredFacts);

      // ファイアウォールがトリガーされた場合
      // Requirements: 18.3 - Firewall is not treated as error
      if (levelEstimate.firewallTriggered) {
        session.status = 'needs_more_data';
        sessionStore.set(sessionId, session);

        // Return with needs_more_data status (not error)
        return {
          type: 'result',
          result: levelEstimate,
          progress,
        };
      }

      // クロスフレームワーク検証
      session.currentStep = 'validation';
      const crossFrameworkResult = await this.crossFrameworkValidation(
        levelEstimate.expected.min,
        session.gatheredFacts
      );

      // Requirements: 18.6 - Store THLI assessment even if gate fails
      // Handle cross-framework failure with partial success
      const resultWithWarnings = this.errorHandler.handleCrossFrameworkFailure(
        levelEstimate,
        crossFrameworkResult
      );

      // 評価完了
      session.status = 'completed';
      sessionStore.set(sessionId, session);

      // 評価データを保存（警告フラグ付き）
      await this.storeAssessmentData(
        session.habitId,
        session.userId,
        levelEstimate,
        session.gatheredFacts,
        crossFrameworkResult
      );

      // Add warnings to result if gate failed
      if (resultWithWarnings.warnings.length > 0) {
        logger.warning('Assessment completed with warnings', {
          sessionId,
          warnings: resultWithWarnings.warnings,
          gateStatus: resultWithWarnings.gateStatus,
        });
      }

      return {
        type: 'result',
        result: levelEstimate,
        progress: { current: 16, total: 16 },
      };
    }

    // 次の質問を返す
    return {
      type: 'question',
      question: assistantMessage.content || '',
      progress,
    };
  }

  /**
   * 応答からファクトを解析して抽出
   */
  private parseResponseForFacts(response: string): Partial<HabitFacts> {
    const facts: Partial<HabitFacts> = {};

    // JSON形式のファクト抽出を試みる
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
        // パースされたJSONからファクトを抽出
        for (const [key, value] of Object.entries(parsed)) {
          if (key.startsWith('F') && typeof value === 'object' && value !== null) {
            const factKey = this.mapFactIdToKey(key as FactId);
            if (factKey) {
              facts[factKey] = value as FactValue;
            }
          }
        }
      } catch {
        // JSONパース失敗は無視
      }
    }

    return facts;
  }

  /**
   * ファクトIDをHabitFactsのキーにマッピング
   */
  private mapFactIdToKey(factId: FactId): keyof HabitFacts | null {
    const mapping: Record<FactId, keyof HabitFacts> = {
      F01: 'F01_action_definition',
      F02: 'F02_done_definition',
      F03: 'F03_typical_duration',
      F04: 'F04_actual_frequency',
      F05: 'F05_target_frequency',
      F06: 'F06_time_window_fixed',
      F07: 'F07_locations',
      F08: 'F08_travel_mode_distance',
      F09: 'F09_tools_resources',
      F10: 'F10_setup_steps',
      F11: 'F11_cleanup_steps',
      F12: 'F12_interruptions',
      F13: 'F13_visibility',
      F14: 'F14_failure_consequence',
      F15: 'F15_skill_certainty',
      F16: 'F16_avoidance_signals',
    };
    return mapping[factId] || null;
  }

  /**
   * 収集済みファクトをマージ
   */
  private mergeGatheredFacts(
    session: AssessmentSession,
    newFacts: Partial<HabitFacts>
  ): void {
    for (const [key, value] of Object.entries(newFacts)) {
      if (value) {
        (session.gatheredFacts as Record<string, FactValue>)[key] = value;
      }
    }
  }

  /**
   * スコアリングに移行すべきか判断
   */
  private shouldMoveToScoring(facts: Partial<HabitFacts>, ici: number): boolean {
    // ICI >= 0.6 かつ No-Inferenceファクトが揃っている場合
    if (ici < 0.6) return false;

    // No-Inferenceファクトのチェック
    const noInferenceKeys: (keyof HabitFacts)[] = [
      'F04_actual_frequency',
      'F13_visibility',
      'F14_failure_consequence',
      'F16_avoidance_signals',
    ];

    for (const key of noInferenceKeys) {
      const fact = facts[key];
      if (!fact || fact.uType !== 'U0') {
        return false;
      }
    }

    return true;
  }

  // ===========================================================================
  // 4.3: ICI Calculation
  // ===========================================================================

  /**
   * ICI（Information Completeness Index）を計算
   *
   * Requirements: 2.2
   *
   * @param facts - 習慣ファクト
   * @returns ICI値（0-1）
   */
  calculateICI(facts: Partial<HabitFacts>): number {
    return calculateICI(facts);
  }

  // ===========================================================================
  // 4.4: Missingness Firewall
  // ===========================================================================

  /**
   * Missingness Firewallをチェック
   *
   * Requirements: 2.3, 2.8
   *
   * @param facts - 習慣ファクト
   * @param abUsed - 使用した仮定予算
   * @returns ファイアウォールがトリガーされる場合はtrue
   */
  checkFirewall(facts: Partial<HabitFacts>, abUsed: number): boolean {
    return shouldTriggerFirewall(facts, abUsed);
  }

  /**
   * ファイアウォールトリガー理由を取得
   */
  getFirewallTriggerReasons(
    facts: Partial<HabitFacts>,
    abUsed: number
  ): string[] {
    const reasons: string[] = [];
    const ici = calculateICI(facts);

    if (ici < 0.6) {
      reasons.push(`ICI (${(ici * 100).toFixed(1)}%) < 60%`);
    }

    if (abUsed > 6) {
      reasons.push(`AB_used (${abUsed}) > 6`);
    }

    // U4ファクトのチェック
    const factValues = Object.values(facts).filter(
      (v): v is FactValue => v !== undefined
    );
    if (factValues.some((fv) => fv.uType === 'U4')) {
      reasons.push('U4 fact exists');
    }

    // No-Inferenceファクトのチェック
    const noInferenceKeys: (keyof HabitFacts)[] = [
      'F04_actual_frequency',
      'F13_visibility',
      'F14_failure_consequence',
      'F16_avoidance_signals',
    ];

    for (const key of noInferenceKeys) {
      const fact = facts[key];
      if (fact && fact.uType !== 'U0') {
        const factId = key.split('_')[0];
        reasons.push(`No-Inference fact ${factId} is not U0`);
      }
    }

    return reasons;
  }

  // ===========================================================================
  // 4.5: THLI-24 Scoring Algorithm
  // ===========================================================================

  /**
   * THLI-24レベルを計算
   *
   * Requirements: 2.4, 2.5
   *
   * @param facts - 習慣ファクト
   * @returns レベル推定結果
   */
  async calculateLevel(facts: Partial<HabitFacts>): Promise<LevelEstimate> {
    logger.info('Calculating THLI-24 level');

    // 1. 仮定予算を計算
    const abUsed = this.calculateAssumptionBudget(facts);

    // 2. ファイアウォールチェック
    const firewallTriggered = this.checkFirewall(facts, abUsed);
    const ici = this.calculateICI(facts);

    if (firewallTriggered) {
      // ファイアウォールがトリガーされた場合、VOI質問を生成
      const voiQuestions = this.generateVOIQuestions(facts);

      return {
        optimistic: 0,
        expected: { min: 0, max: 199 },
        conservative: 199,
        tier: 'expert',
        variables: this.createEmptyVariables(),
        ici,
        abUsed,
        firewallTriggered: true,
        voiQuestions,
        promptVersion: this.promptVersion,
      };
    }

    // 3. 24変数をスコアリング
    const variables = this.scoreAllVariables(facts);

    // 4. O/E/Cレベルを計算
    const totalScore = sumVariableScores(variables);
    const { optimistic, expected, conservative } = this.calculateOECLevels(
      totalScore,
      ici,
      abUsed
    );

    // 5. レベルティアを決定
    const tier = calculateLevelTier(expected.min);

    // 6. Range Justification Contractを適用
    this.applyRangeJustificationContract(variables);

    return {
      optimistic,
      expected,
      conservative,
      tier,
      variables,
      ici,
      abUsed,
      firewallTriggered: false,
      promptVersion: this.promptVersion,
    };
  }

  /**
   * 仮定予算（AB_used）を計算
   */
  private calculateAssumptionBudget(facts: Partial<HabitFacts>): number {
    let abUsed = 0;

    for (const value of Object.values(facts)) {
      if (value) {
        // U1-U3は仮定を使用
        if (value.uType === 'U1') abUsed += 0.5;
        else if (value.uType === 'U2') abUsed += 1;
        else if (value.uType === 'U3') abUsed += 2;
      }
    }

    return Math.round(abUsed);
  }

  /**
   * 全24変数をスコアリング
   */
  private scoreAllVariables(facts: Partial<HabitFacts>): THLIVariable[] {
    return THLI_VARIABLE_DEFINITIONS.map((def) => {
      const score = this.scoreVariable(def, facts);
      const stoplight = determineStoplight(score);

      return {
        id: def.id,
        name: def.name,
        domain: def.domain,
        score,
        stoplight,
        rationale: this.generateRationale(def, facts, score),
        causingFacts: def.relatedFacts,
      };
    });
  }

  /**
   * 単一変数をスコアリング
   */
  private scoreVariable(
    def: (typeof THLI_VARIABLE_DEFINITIONS)[number],
    facts: Partial<HabitFacts>
  ): DiscreteScore {
    // 関連ファクトの値を取得
    const relatedValues: FactValue[] = [];
    for (const factId of def.relatedFacts) {
      const key = this.mapFactIdToKey(factId);
      if (key && facts[key]) {
        relatedValues.push(facts[key]!);
      }
    }

    // ファクトがない場合はデフォルトスコア
    if (relatedValues.length === 0) {
      return 4.1; // 中間値
    }

    // 変数ごとのスコアリングロジック
    const rawScore = this.calculateRawScore(def.id, relatedValues, facts);

    // 離散スコアセットに丸める
    return this.roundToDiscreteScore(rawScore);
  }

  /**
   * 生のスコアを計算（変数ごとのロジック）
   */
  private calculateRawScore(
    variableId: VariableId,
    relatedValues: FactValue[],
    facts: Partial<HabitFacts>
  ): number {
    // 変数ごとの詳細なスコアリングロジック
    // ここでは簡略化した実装
    switch (variableId) {
      case '⑱': // Frequency
        return this.scoreFrequency(facts);
      case '⑬': // Duration
        return this.scoreDuration(facts);
      case '⑩': // Travel Distance
        return this.scoreTravelDistance(facts);
      default:
        // デフォルト: 関連ファクトの不確実性に基づくスコア
        return this.scoreByUncertainty(relatedValues);
    }
  }

  /**
   * 頻度をスコアリング
   */
  private scoreFrequency(facts: Partial<HabitFacts>): number {
    const freq = facts.F04_actual_frequency?.value;
    if (!freq) return 4.1;

    const freqStr = String(freq).toLowerCase();
    if (freqStr.includes('daily') || freqStr.includes('毎日')) return 8.3;
    if (freqStr.includes('3x') || freqStr.includes('週3')) return 6.9;
    if (freqStr.includes('weekly') || freqStr.includes('週1')) return 4.1;
    if (freqStr.includes('biweekly') || freqStr.includes('隔週')) return 2.8;
    if (freqStr.includes('monthly') || freqStr.includes('月1')) return 1.4;

    return 4.1;
  }

  /**
   * 所要時間をスコアリング
   */
  private scoreDuration(facts: Partial<HabitFacts>): number {
    const duration = facts.F03_typical_duration?.value;
    if (!duration) return 4.1;

    const minutes = typeof duration === 'number' ? duration : parseInt(String(duration), 10);
    if (isNaN(minutes)) return 4.1;

    if (minutes >= 60) return 8.3;
    if (minutes >= 45) return 6.9;
    if (minutes >= 30) return 5.5;
    if (minutes >= 15) return 4.1;
    if (minutes >= 10) return 2.8;
    if (minutes >= 5) return 1.4;

    return 0.0;
  }

  /**
   * 移動距離をスコアリング
   */
  private scoreTravelDistance(facts: Partial<HabitFacts>): number {
    const travel = facts.F08_travel_mode_distance?.value;
    if (!travel) return 0.0;

    const travelStr = String(travel).toLowerCase();
    if (travelStr.includes('home') || travelStr.includes('自宅') || travelStr.includes('0')) {
      return 0.0;
    }
    if (travelStr.includes('walk') || travelStr.includes('徒歩')) return 2.8;
    if (travelStr.includes('bike') || travelStr.includes('自転車')) return 4.1;
    if (travelStr.includes('car') || travelStr.includes('車')) return 5.5;
    if (travelStr.includes('train') || travelStr.includes('電車')) return 6.9;

    return 2.8;
  }

  /**
   * 不確実性に基づくスコアリング
   */
  private scoreByUncertainty(values: FactValue[]): number {
    if (values.length === 0) return 4.1;

    // 不確実性が高いほどスコアが高い（保守的）
    const avgUncertainty = values.reduce((sum, v) => {
      const uWeight: Record<UType, number> = {
        U0: 0,
        U1: 1,
        U2: 2,
        U3: 3,
        U4: 4,
      };
      return sum + uWeight[v.uType];
    }, 0) / values.length;

    return this.roundToDiscreteScore(avgUncertainty * 2);
  }

  /**
   * 離散スコアセットに丸める
   */
  private roundToDiscreteScore(rawScore: number): DiscreteScore {
    // 最も近い離散スコアを見つける
    let closest: DiscreteScore = 0.0;
    let minDiff = Infinity;

    for (const score of DISCRETE_SCORE_SET) {
      const diff = Math.abs(rawScore - score);
      if (diff < minDiff) {
        minDiff = diff;
        closest = score;
      }
    }

    return closest;
  }

  /**
   * O/E/Cレベルを計算
   */
  private calculateOECLevels(
    totalScore: number,
    ici: number,
    abUsed: number
  ): { optimistic: number; expected: { min: number; max: number }; conservative: number } {
    // 基本レベル = 総スコア（0-199.2の範囲）
    const baseLevel = Math.min(199, Math.round(totalScore));

    // 不確実性に基づく範囲を計算
    const uncertaintyFactor = (1 - ici) * 20 + abUsed * 3;

    const optimistic = Math.max(0, Math.round(baseLevel - uncertaintyFactor));
    const conservative = Math.min(199, Math.round(baseLevel + uncertaintyFactor));
    const expectedMin = Math.max(0, Math.round(baseLevel - uncertaintyFactor / 2));
    const expectedMax = Math.min(199, Math.round(baseLevel + uncertaintyFactor / 2));

    return {
      optimistic,
      expected: { min: expectedMin, max: expectedMax },
      conservative,
    };
  }

  /**
   * Range Justification Contractを適用
   */
  private applyRangeJustificationContract(variables: THLIVariable[]): void {
    // 各変数のスコアが離散スコアセットに含まれていることを確認
    for (const variable of variables) {
      if (!isDiscreteScore(variable.score)) {
        logger.warning('Invalid discrete score detected', {
          variableId: variable.id,
          score: variable.score,
        });
        // 最も近い離散スコアに修正
        variable.score = this.roundToDiscreteScore(variable.score);
      }
    }
  }

  /**
   * 変数のスコア根拠を生成
   */
  private generateRationale(
    def: (typeof THLI_VARIABLE_DEFINITIONS)[number],
    facts: Partial<HabitFacts>,
    score: DiscreteScore
  ): string {
    const relatedFactValues: string[] = [];

    for (const factId of def.relatedFacts) {
      const key = this.mapFactIdToKey(factId);
      if (key && facts[key]) {
        relatedFactValues.push(`${factId}: ${facts[key]!.value}`);
      }
    }

    if (relatedFactValues.length === 0) {
      return `No data available for ${def.name}. Using default score.`;
    }

    return `Based on ${relatedFactValues.join(', ')}. Score: ${score}`;
  }

  /**
   * 空の変数配列を作成
   */
  private createEmptyVariables(): THLIVariable[] {
    return THLI_VARIABLE_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      domain: def.domain,
      score: 0.0 as DiscreteScore,
      stoplight: 'green' as const,
      rationale: 'Not scored due to firewall',
      causingFacts: def.relatedFacts,
    }));
  }

  // ===========================================================================
  // 4.6: VOI Question Generation
  // ===========================================================================

  /**
   * VOI（Value of Information）質問を生成
   *
   * Requirements: 2.7
   *
   * @param facts - 現在の習慣ファクト
   * @param language - 言語設定
   * @returns VOI質問リスト（最大5件）
   */
  generateVOIQuestions(
    facts: Partial<HabitFacts>,
    language: 'en' | 'ja' = 'ja'
  ): VOIQuestion[] {
    const questions: VOIQuestion[] = [];

    // 欠落しているファクトを特定
    const factKeyMap: Record<FactId, keyof HabitFacts> = {
      F01: 'F01_action_definition',
      F02: 'F02_done_definition',
      F03: 'F03_typical_duration',
      F04: 'F04_actual_frequency',
      F05: 'F05_target_frequency',
      F06: 'F06_time_window_fixed',
      F07: 'F07_locations',
      F08: 'F08_travel_mode_distance',
      F09: 'F09_tools_resources',
      F10: 'F10_setup_steps',
      F11: 'F11_cleanup_steps',
      F12: 'F12_interruptions',
      F13: 'F13_visibility',
      F14: 'F14_failure_consequence',
      F15: 'F15_skill_certainty',
      F16: 'F16_avoidance_signals',
    };

    for (const [factId, key] of Object.entries(factKeyMap)) {
      const fact = facts[key as keyof HabitFacts];

      // ファクトが欠落しているか、U0でない場合
      if (!fact || fact.uType !== 'U0') {
        const template = VOI_QUESTION_TEMPLATES[factId as FactId];
        if (template) {
          // ΔLv_upperを計算（影響度）
          const deltaLvUpper = this.calculateDeltaLvUpper(factId as FactId, facts);

          questions.push({
            factId: factId as FactId,
            question: language === 'ja' ? template.questionJa : template.question,
            deltaLvUpper,
            priority: Math.min(5, Math.ceil(deltaLvUpper / 2)),
          });
        }
      }
    }

    // ΔLv_upperでソートして上位5件を返す
    return questions
      .sort((a, b) => b.deltaLvUpper - a.deltaLvUpper)
      .slice(0, 5);
  }

  /**
   * ΔLv_upper（レベル推定への潜在的影響）を計算
   */
  private calculateDeltaLvUpper(factId: FactId, _facts: Partial<HabitFacts>): number {
    const template = VOI_QUESTION_TEMPLATES[factId];
    if (!template) return 0;

    // 基本影響度
    let impact = template.baseImpact;

    // No-Inferenceファクトは影響度が高い
    if (NO_INFERENCE_FACTS.includes(factId as typeof NO_INFERENCE_FACTS[number])) {
      impact *= 1.5;
    }

    // コアファクトは影響度が高い
    if (CORE_FACT_IDS.includes(factId as typeof CORE_FACT_IDS[number])) {
      impact *= 1.2;
    }

    return Math.round(impact);
  }

  // ===========================================================================
  // 4.7: Cross-Framework Validation
  // ===========================================================================

  /**
   * クロスフレームワーク検証を実行
   *
   * Requirements: 12.1, 12.2
   *
   * @param thliScore - THLI-24スコア
   * @param facts - 習慣ファクト
   * @returns 検証結果
   */
  async crossFrameworkValidation(
    thliScore: number,
    facts: Partial<HabitFacts>
  ): Promise<ValidationResult> {
    logger.info('Performing cross-framework validation', { thliScore });

    // 1. NASA-TLXスコアを計算（6次元）
    const tlxScore = this.calculateNASATLX(facts);

    // 2. SRBAIスコアを計算（4プロンプト）
    const srbaiScore = this.calculateSRBAI(facts);

    // 3. COM-Bフレームワークにマッピング
    const combScore = this.calculateCOMB(facts);

    // 4. 偏差をチェック（> 20ポイント）
    const discrepancyDetails: ValidationResult['discrepancyDetails'] = [];

    if (Math.abs(thliScore - tlxScore) > 20) {
      discrepancyDetails.push({
        domain: 'cognitive',
        thliScore,
        externalScore: tlxScore,
        difference: Math.abs(thliScore - tlxScore),
      });
    }

    if (Math.abs(thliScore - srbaiScore) > 20) {
      discrepancyDetails.push({
        domain: 'temporal',
        thliScore,
        externalScore: srbaiScore,
        difference: Math.abs(thliScore - srbaiScore),
      });
    }

    if (Math.abs(thliScore - combScore) > 20) {
      discrepancyDetails.push({
        domain: 'social',
        thliScore,
        externalScore: combScore,
        difference: Math.abs(thliScore - combScore),
      });
    }

    // 5. ゲートステータスを決定
    const gateStatus = discrepancyDetails.length > 0 ? 'fail' : 'pass';

    const result: ValidationResult = {
      tlxScore,
      srbaiScore,
      combScore,
      gateStatus,
      discrepancyDetails: discrepancyDetails.length > 0 ? discrepancyDetails : undefined,
    };

    // 6. 検証ログを記録
    await this.logValidation(thliScore, result);

    return result;
  }

  /**
   * NASA-TLXスコアを計算
   * 6次元: Mental, Physical, Temporal, Effort, Frustration, Performance
   */
  private calculateNASATLX(facts: Partial<HabitFacts>): number {
    let score = 0;

    // Mental Demand (認知負荷)
    const actionDef = facts.F01_action_definition;
    if (actionDef) {
      const complexity = String(actionDef.value).length;
      score += Math.min(33, complexity / 3);
    }

    // Physical Demand (身体負荷)
    const duration = facts.F03_typical_duration;
    if (duration && typeof duration.value === 'number') {
      score += Math.min(33, duration.value / 2);
    }

    // Temporal Demand (時間負荷)
    const frequency = facts.F04_actual_frequency;
    if (frequency) {
      const freqStr = String(frequency.value).toLowerCase();
      if (freqStr.includes('daily')) score += 33;
      else if (freqStr.includes('weekly')) score += 20;
      else score += 10;
    }

    // Effort (努力)
    const skill = facts.F15_skill_certainty;
    if (skill && typeof skill.value === 'number') {
      score += Math.max(0, 33 - skill.value * 3);
    }

    // Frustration (フラストレーション)
    const avoidance = facts.F16_avoidance_signals;
    if (avoidance) {
      const signals = String(avoidance.value);
      score += Math.min(33, signals.length / 5);
    }

    // Performance (パフォーマンス) - 逆スコア
    const doneDef = facts.F02_done_definition;
    if (doneDef) {
      score += 10; // 明確な完了定義があれば低負荷
    }

    // 0-199スケールに正規化
    return Math.min(199, Math.round(score));
  }

  /**
   * SRBAIスコアを計算
   * 4プロンプト: 自動性、意識的努力、習慣性、ルーティン化
   */
  private calculateSRBAI(facts: Partial<HabitFacts>): number {
    let score = 0;

    // 自動性（低いほど高スコア = 難しい）
    const frequency = facts.F04_actual_frequency;
    if (frequency) {
      const freqStr = String(frequency.value).toLowerCase();
      if (freqStr.includes('daily')) score += 20; // 毎日 = より自動化
      else if (freqStr.includes('weekly')) score += 40;
      else score += 60;
    }

    // 意識的努力
    const setup = facts.F10_setup_steps;
    if (setup) {
      const steps = String(setup.value).split(',').length;
      score += Math.min(50, steps * 10);
    }

    // 習慣性（トリガーの明確さ）
    const timeWindow = facts.F06_time_window_fixed;
    if (timeWindow && timeWindow.value === true) {
      score -= 20; // 固定時間枠 = より習慣化
    } else {
      score += 20;
    }

    // ルーティン化
    const location = facts.F07_locations;
    if (location) {
      const locStr = String(location.value).toLowerCase();
      if (locStr.includes('home') || locStr.includes('自宅')) {
        score -= 10; // 自宅 = より習慣化しやすい
      } else {
        score += 20;
      }
    }

    // 0-199スケールに正規化
    return Math.max(0, Math.min(199, Math.round(score + 50)));
  }

  /**
   * COM-Bスコアを計算
   * Capability, Opportunity, Motivation - Behaviour
   */
  private calculateCOMB(facts: Partial<HabitFacts>): number {
    let score = 0;

    // Capability (能力)
    const skill = facts.F15_skill_certainty;
    if (skill && typeof skill.value === 'number') {
      score += Math.max(0, 66 - skill.value * 6); // 低スキル = 高難易度
    } else {
      score += 33;
    }

    // Opportunity (機会)
    const tools = facts.F09_tools_resources;
    if (tools) {
      const toolCount = String(tools.value).split(',').length;
      score += Math.min(66, toolCount * 10); // 多くのツール = 高難易度
    }

    const travel = facts.F08_travel_mode_distance;
    if (travel) {
      const travelStr = String(travel.value);
      if (travelStr.includes('0') || travelStr.includes('home')) {
        score += 0;
      } else {
        score += 20;
      }
    }

    // Motivation (動機)
    const consequence = facts.F14_failure_consequence;
    if (consequence) {
      const consStr = String(consequence.value).toLowerCase();
      if (consStr.includes('none') || consStr.includes('なし')) {
        score += 30; // 結果なし = 低動機 = 高難易度
      } else {
        score += 10;
      }
    }

    // 0-199スケールに正規化
    return Math.min(199, Math.round(score));
  }

  /**
   * 検証結果をログに記録
   */
  private async logValidation(
    thliScore: number,
    result: ValidationResult
  ): Promise<void> {
    try {
      // thli_validation_logテーブルに記録
      // 注: テーブルが存在しない場合はスキップ
      logger.info('Cross-framework validation completed', {
        thliScore,
        tlxScore: result.tlxScore,
        srbaiScore: result.srbaiScore,
        combScore: result.combScore,
        gateStatus: result.gateStatus,
      });
    } catch (error) {
      logger.warning('Failed to log validation result', {
        error: (error as Error).message,
      });
    }
  }

  // ===========================================================================
  // 4.8: Assessment Data Storage
  // ===========================================================================

  /**
   * 評価データを保存
   *
   * Requirements: 1.4, 1.5, 12.4
   *
   * @param habitId - 習慣ID
   * @param userId - ユーザーID
   * @param levelEstimate - レベル推定結果
   * @param facts - 習慣ファクト
   * @param crossFramework - クロスフレームワーク検証結果
   */
  async storeAssessmentData(
    habitId: string,
    userId: string,
    levelEstimate: LevelEstimate,
    facts: Partial<HabitFacts>,
    crossFramework: CrossFrameworkValidation
  ): Promise<void> {
    logger.info('Storing assessment data', { habitId, userId });

    const now = new Date().toISOString();

    // 1. AssessmentDataを構築
    const assessmentData: AssessmentData = {
      facts: facts as HabitFacts,
      variables: levelEstimate.variables,
      ici: levelEstimate.ici,
      abUsed: levelEstimate.abUsed,
      firewallTriggered: levelEstimate.firewallTriggered,
      oLevel: levelEstimate.optimistic,
      eLevelRange: levelEstimate.expected,
      cLevel: levelEstimate.conservative,
      crossFramework,
      promptVersion: levelEstimate.promptVersion,
      assessedAt: now,
    };

    // 2. 習慣のレベルを更新
    const newLevel = levelEstimate.expected.min;
    const newTier = calculateLevelTier(newLevel);

    // 現在の習慣データを取得
    const habit = await this.habitRepo.getById(habitId);
    const oldLevel = habit?.level ?? null;

    // 習慣テーブルを更新
    const { error: updateError } = await this.supabase
      .from('habits')
      .update({
        level: newLevel,
        level_tier: newTier,
        level_assessment_data: assessmentData,
        level_last_assessed_at: now,
        updated_at: now,
      })
      .eq('id', habitId);

    if (updateError) {
      logger.error('Failed to update habit level', updateError as Error, { habitId });
      throw new Error(`Failed to update habit level: ${updateError.message}`);
    }

    // 3. level_historyに記録
    await this.recordLevelHistory(
      habitId,
      'habit',
      oldLevel,
      newLevel,
      oldLevel === null ? 'initial_assessment' : 're_assessment',
      {}
    );

    // 4. thli_validation_logに記録
    await this.recordValidationLog(
      habitId,
      userId,
      newLevel,
      crossFramework
    );

    // 5. クォータを消費
    await this.consumeQuota(userId);

    logger.info('Assessment data stored successfully', {
      habitId,
      oldLevel,
      newLevel,
      tier: newTier,
    });
  }

  /**
   * レベル履歴を記録
   */
  private async recordLevelHistory(
    entityId: string,
    entityType: 'habit' | 'goal',
    oldLevel: number | null,
    newLevel: number,
    reason: string,
    workloadDelta: Record<string, unknown>
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('level_history').insert({
        entity_type: entityType,
        entity_id: entityId,
        old_level: oldLevel,
        new_level: newLevel,
        reason,
        workload_delta: workloadDelta,
        assessed_at: new Date().toISOString(),
      });

      if (error) {
        logger.warning('Failed to record level history', {
          error: error.message,
          entityId,
        });
      }
    } catch (error) {
      logger.warning('Failed to record level history', {
        error: (error as Error).message,
        entityId,
      });
    }
  }

  /**
   * 検証ログを記録
   */
  private async recordValidationLog(
    habitId: string,
    userId: string,
    thliScore: number,
    validation: CrossFrameworkValidation | ValidationResult
  ): Promise<void> {
    try {
      // ValidationResultの場合はdiscrepancyDetailsを取得
      const discrepancyDetails = 'discrepancyDetails' in validation 
        ? validation.discrepancyDetails 
        : null;

      const { error } = await this.supabase.from('thli_validation_log').insert({
        habit_id: habitId,
        user_id: userId,
        thli_score: thliScore,
        tlx_score: validation.tlxScore,
        srbai_score: validation.srbaiScore,
        comb_score: validation.combScore,
        gate_status: validation.gateStatus,
        discrepancy_details: discrepancyDetails,
      });

      if (error) {
        logger.warning('Failed to record validation log', {
          error: error.message,
          habitId,
        });
      }
    } catch (error) {
      logger.warning('Failed to record validation log', {
        error: (error as Error).message,
        habitId,
      });
    }
  }

  // ===========================================================================
  // Quota Management
  // ===========================================================================

  /**
   * ユーザーのクォータステータスを確認
   *
   * Requirements: 7.3
   */
  async checkUserQuota(userId: string): Promise<QuotaStatus> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // token_quotasテーブルからクォータを取得
    const { data, error } = await this.supabase
      .from('token_quotas')
      .select('*')
      .eq('user_id', userId)
      .eq('quota_type', 'thli_assessments')
      .gte('period_end', now.toISOString())
      .lte('period_start', now.toISOString())
      .single();

    if (error || !data) {
      // クォータが存在しない場合、デフォルト値を返す
      return {
        quotaUsed: 0,
        quotaLimit: 10, // Free plan default
        remaining: 10,
        periodStart,
        periodEnd,
        isUnlimited: false,
      };
    }

    const isUnlimited = data.quota_limit === -1;
    const remaining = isUnlimited ? -1 : Math.max(0, data.quota_limit - data.quota_used);

    return {
      quotaUsed: data.quota_used,
      quotaLimit: data.quota_limit,
      remaining,
      periodStart: new Date(data.period_start),
      periodEnd: new Date(data.period_end),
      isUnlimited,
    };
  }

  /**
   * クォータを消費
   *
   * Requirements: 7.6
   */
  private async consumeQuota(userId: string): Promise<void> {
    const now = new Date();

    const { error } = await this.supabase
      .from('token_quotas')
      .update({
        quota_used: this.supabase.rpc('increment_quota_used'),
      })
      .eq('user_id', userId)
      .eq('quota_type', 'thli_assessments')
      .gte('period_end', now.toISOString())
      .lte('period_start', now.toISOString());

    if (error) {
      // RPCが使えない場合は直接更新
      const { data: quota } = await this.supabase
        .from('token_quotas')
        .select('quota_used')
        .eq('user_id', userId)
        .eq('quota_type', 'thli_assessments')
        .gte('period_end', now.toISOString())
        .lte('period_start', now.toISOString())
        .single();

      if (quota) {
        await this.supabase
          .from('token_quotas')
          .update({ quota_used: quota.quota_used + 1 })
          .eq('user_id', userId)
          .eq('quota_type', 'thli_assessments')
          .gte('period_end', now.toISOString())
          .lte('period_start', now.toISOString());
      }
    }
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * ワークロードをフォーマット
   */
  private formatWorkload(habit: {
    frequency?: string;
    target_count?: number;
    workload_unit?: string | null | undefined;
    workload_per_count?: number;
  }): string {
    const parts: string[] = [];

    if (habit.frequency) {
      const freqMap: Record<string, string> = {
        daily: '毎日',
        weekly: '毎週',
        monthly: '毎月',
      };
      parts.push(freqMap[habit.frequency] || habit.frequency);
    }

    if (habit.target_count && habit.target_count > 1) {
      parts.push(`${habit.target_count}回`);
    }

    if (habit.workload_per_count && habit.workload_unit) {
      parts.push(`${habit.workload_per_count}${habit.workload_unit}`);
    }

    return parts.join(' ') || '未設定';
  }

  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 会話IDを生成
   */
  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * セッションを取得
   */
  getSession(sessionId: string): AssessmentSession | undefined {
    return sessionStore.get(sessionId);
  }

  /**
   * セッションを削除
   */
  deleteSession(sessionId: string): void {
    const session = sessionStore.get(sessionId);
    if (session) {
      conversationStore.delete(session.conversationId);
      sessionStore.delete(sessionId);
    }
  }

  /**
   * ユーザーのアクティブセッションを取得
   */
  getActiveSessionsForUser(userId: string): AssessmentSession[] {
    const sessions: AssessmentSession[] = [];
    for (const session of sessionStore.values()) {
      if (session.userId === userId && session.status === 'in_progress') {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * 期限切れセッションをクリーンアップ
   */
  cleanupExpiredSessions(maxAgeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of sessionStore.entries()) {
      const age = now - session.createdAt.getTime();
      if (age > maxAgeMs) {
        this.deleteSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired sessions', { count: cleaned });
    }

    return cleaned;
  }

  // ===========================================================================
  // 16.3: Assessment Resumption
  // ===========================================================================

  /**
   * 失敗した評価を再開する
   *
   * Requirements: 18.7
   * - Load state from resumption token
   * - Continue conversation from last question
   *
   * @param resumptionToken - 再開トークン
   * @param userId - ユーザーID
   * @returns 再開されたセッション
   */
  async resumeAssessment(
    resumptionToken: string,
    userId: string
  ): Promise<AssessmentSession> {
    logger.info('Resuming assessment', { resumptionToken, userId });

    // Load failed assessment
    const loadResult = await this.errorHandler.loadFailedAssessment(
      resumptionToken,
      userId
    );

    if (!loadResult.success || !loadResult.session) {
      throw new Error(loadResult.error || '評価の再開に失敗しました。');
    }

    // Create new session from loaded state
    const sessionId = this.generateSessionId();
    const session: AssessmentSession = {
      sessionId,
      habitId: loadResult.session.habitId!,
      userId: loadResult.session.userId!,
      status: 'in_progress',
      conversationId: loadResult.session.conversationId!,
      currentStep: loadResult.session.currentStep!,
      gatheredFacts: loadResult.gatheredFacts || {},
      createdAt: new Date(),
    };

    // Restore session and conversation
    sessionStore.set(sessionId, session);
    if (loadResult.conversationHistory) {
      conversationStore.set(session.conversationId, loadResult.conversationHistory);
    }

    logger.info('Assessment resumed successfully', {
      sessionId,
      resumptionToken,
      currentStep: session.currentStep,
      gatheredFactsCount: Object.keys(session.gatheredFacts).length,
    });

    return session;
  }

  /**
   * ユーザーの再開可能な評価を取得
   *
   * @param userId - ユーザーID
   * @returns 再開可能な評価のリスト
   */
  async getPendingResumableAssessments(
    userId: string
  ): Promise<{ habitId: string; habitName: string; resumptionToken: string; failedAt: string }[]> {
    return this.errorHandler.getPendingFailedAssessments(userId);
  }

  // ===========================================================================
  // 16.5: Graceful Quota Exhaustion Handling
  // ===========================================================================

  /**
   * クォータ枯渇時の処理を判断
   *
   * Requirements: 18.4
   * - Complete current assessment even if quota exhausted mid-assessment
   * - Block only subsequent attempts
   *
   * @param userId - ユーザーID
   * @param sessionId - セッションID（進行中の場合）
   * @returns 許可するかどうかと理由
   */
  async handleQuotaExhaustion(
    userId: string,
    sessionId?: string
  ): Promise<{
    allowed: boolean;
    reason: string;
    showUpgradePrompt: boolean;
  }> {
    const isInProgress = sessionId ? sessionStore.has(sessionId) : false;
    return this.errorHandler.shouldAllowDespiteQuotaExhaustion(userId, isInProgress);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let thliAssessmentServiceInstance: THLIAssessmentService | null = null;

/**
 * THLIAssessmentServiceのシングルトンインスタンスを取得
 */
export function getTHLIAssessmentService(
  supabase: SupabaseClient
): THLIAssessmentService {
  if (!thliAssessmentServiceInstance) {
    thliAssessmentServiceInstance = new THLIAssessmentService(supabase);
  }
  return thliAssessmentServiceInstance;
}

/**
 * THLIAssessmentServiceインスタンスをリセット（テスト用）
 */
export function resetTHLIAssessmentService(): void {
  thliAssessmentServiceInstance = null;
}

// =============================================================================
// Exports
// =============================================================================

export {
  THLI_VARIABLE_DEFINITIONS,
  VOI_QUESTION_TEMPLATES,
};
