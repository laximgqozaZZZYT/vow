/**
 * Connector Service
 *
 * Handles natural language commands from external connectors (Slack, ChatGPT).
 * Validates premium access and routes to appropriate AI services.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getNLHabitParser } from './nlHabitParser.js';
import { getSubscriptionService } from './subscriptionService.js';
import { HabitRepository } from '../repositories/habitRepository.js';
import { getLogger } from '../utils/logger.js';
import { AIServiceError, AIErrorCode, type ParsedHabitData } from '../schemas/ai.js';
import type { SlackBlock } from './slackBlockBuilder.js';

const logger = getLogger('connectorService');

/**
 * Slack response structure.
 */
export interface SlackNLResponse {
  success: boolean;
  responseType: 'ephemeral' | 'in_channel';
  text: string;
  blocks?: SlackBlock[];
  parsed?: ParsedHabitData;
  habitId?: string;
  tokensUsed?: number;
  remainingTokens?: number;
  error?: string;
}

/**
 * NL command type detection result.
 */
export interface NLCommandDetection {
  isNLCommand: boolean;
  commandType: 'create' | 'edit' | 'unknown';
  text: string;
}

/**
 * NL command patterns for detection.
 */
const NL_COMMAND_PATTERNS = {
  create: [
    /^新しい習慣[:：]?\s*(.+)$/,
    /^習慣を追加[:：]?\s*(.+)$/,
    /^習慣登録[:：]?\s*(.+)$/,
    /^add habit[:：]?\s*(.+)$/i,
    /^new habit[:：]?\s*(.+)$/i,
    /^create habit[:：]?\s*(.+)$/i,
  ],
  edit: [
    /^習慣を編集[:：]?\s*(.+)$/,
    /^習慣を変更[:：]?\s*(.+)$/,
    /^習慣を修正[:：]?\s*(.+)$/,
    /^edit habit[:：]?\s*(.+)$/i,
    /^change habit[:：]?\s*(.+)$/i,
    /^modify habit[:：]?\s*(.+)$/i,
  ],
};

/**
 * Connector Service for handling NL commands from external sources.
 */
export class ConnectorService {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Detect if text is a natural language command.
   *
   * Requirements: 6.2
   */
  detectNLCommand(text: string): NLCommandDetection {
    const trimmedText = text.trim();

    // Check create patterns
    for (const pattern of NL_COMMAND_PATTERNS.create) {
      const match = trimmedText.match(pattern);
      if (match && match[1]) {
        return {
          isNLCommand: true,
          commandType: 'create',
          text: match[1].trim(),
        };
      }
    }

    // Check edit patterns
    for (const pattern of NL_COMMAND_PATTERNS.edit) {
      const match = trimmedText.match(pattern);
      if (match && match[1]) {
        return {
          isNLCommand: true,
          commandType: 'edit',
          text: match[1].trim(),
        };
      }
    }

    return {
      isNLCommand: false,
      commandType: 'unknown',
      text: trimmedText,
    };
  }

  /**
   * Validate premium access for a user.
   *
   * Requirements: 6.5
   */
  async validatePremiumAccess(userId: string): Promise<{
    hasAccess: boolean;
    planType: string;
    message?: string;
  }> {
    try {
      const subscriptionService = getSubscriptionService(this.supabase);
      const hasPremium = await subscriptionService.hasPremiumAccess(userId);
      const planType = await subscriptionService.getPlanType(userId);

      if (!hasPremium) {
        return {
          hasAccess: false,
          planType,
          message: 'この機能はPremiumプランでのみ利用可能です。',
        };
      }

      // Check if user has slack_nl feature
      const hasFeature = await subscriptionService.hasFeatureAccess(userId, 'slack_nl');
      if (!hasFeature) {
        return {
          hasAccess: false,
          planType,
          message: 'この機能はPremiumプランでのみ利用可能です。',
        };
      }

      return {
        hasAccess: true,
        planType,
      };
    } catch (error) {
      logger.error('Failed to validate premium access', error instanceof Error ? error : undefined, { userId });
      return {
        hasAccess: false,
        planType: 'free',
        message: 'サブスクリプション情報の取得に失敗しました。',
      };
    }
  }

  /**
   * Handle Slack natural language command.
   *
   * Requirements: 6.1, 6.3, 6.5, 6.6
   */
  async handleSlackNLCommand(
    userId: string,
    text: string,
    ownerType: string = 'user'
  ): Promise<SlackNLResponse> {
    // Detect command type
    const detection = this.detectNLCommand(text);

    if (!detection.isNLCommand) {
      return {
        success: false,
        responseType: 'ephemeral',
        text: 'コマンドを認識できませんでした。',
        blocks: this.buildHelpBlocks(),
        error: 'UNKNOWN_COMMAND',
      };
    }

    // Validate premium access
    const accessCheck = await this.validatePremiumAccess(userId);
    if (!accessCheck.hasAccess) {
      return {
        success: false,
        responseType: 'ephemeral',
        text: accessCheck.message || 'Premiumプランが必要です。',
        blocks: this.buildUpgradePromptBlocks(),
        error: 'PREMIUM_REQUIRED',
      };
    }

    try {
      if (detection.commandType === 'create') {
        return await this.handleCreateCommand(userId, detection.text, ownerType);
      } else if (detection.commandType === 'edit') {
        return await this.handleEditCommand(userId, detection.text, ownerType);
      }

      return {
        success: false,
        responseType: 'ephemeral',
        text: 'コマンドを認識できませんでした。',
        blocks: this.buildHelpBlocks(),
        error: 'UNKNOWN_COMMAND',
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle create habit command.
   */
  private async handleCreateCommand(
    userId: string,
    text: string,
    ownerType: string
  ): Promise<SlackNLResponse> {
    const nlParser = getNLHabitParser(this.supabase);

    // Get user's goals for context
    const goals = await nlParser.getUserGoals(userId);
    const context = {
      existingGoals: goals,
    };

    // Parse the natural language input
    const parseResult = await nlParser.parse(userId, text, context);

    // Create the habit
    const habitRepo = new HabitRepository(this.supabase);
    const habitData = {
      owner_id: userId,
      owner_type: ownerType,
      name: parseResult.parsed.name,
      type: parseResult.parsed.type,
      frequency: parseResult.parsed.frequency || 'daily',
      trigger_time: parseResult.parsed.triggerTime,
      target_count: parseResult.parsed.targetCount || 1,
      workload_unit: parseResult.parsed.workloadUnit,
      goal_id: parseResult.parsed.goalId,
      is_active: true,
    };

    const habit = await habitRepo.create(habitData);

    logger.info('Created habit via Slack NL command', {
      userId,
      habitId: habit.id,
      habitName: habit.name,
      tokensUsed: parseResult.tokensUsed,
    });

    return {
      success: true,
      responseType: 'in_channel',
      text: `✅ 習慣「${habit.name}」を登録しました！`,
      blocks: this.buildCreateSuccessBlocks(habit, parseResult),
      parsed: parseResult.parsed,
      habitId: habit.id,
      tokensUsed: parseResult.tokensUsed,
      remainingTokens: parseResult.remainingTokens,
    };
  }

  /**
   * Handle edit habit command.
   */
  private async handleEditCommand(
    userId: string,
    text: string,
    _ownerType: string
  ): Promise<SlackNLResponse> {
    const nlParser = getNLHabitParser(this.supabase);

    // Get user's existing habits
    const existingHabits = await nlParser.getUserHabits(userId);

    if (existingHabits.length === 0) {
      return {
        success: false,
        responseType: 'ephemeral',
        text: '編集可能な習慣がありません。',
        error: 'NO_HABITS',
      };
    }

    // Parse the edit command
    const editResult = await nlParser.parseEdit(userId, text, existingHabits);

    if (!editResult.targetHabitId) {
      // Could not identify target habit
      if (editResult.candidates.length > 0) {
        return {
          success: false,
          responseType: 'ephemeral',
          text: '対象の習慣を特定できませんでした。',
          blocks: this.buildCandidatesBlocks(editResult.candidates),
          tokensUsed: editResult.tokensUsed,
          remainingTokens: editResult.remainingTokens,
          error: 'AMBIGUOUS_TARGET',
        };
      }

      return {
        success: false,
        responseType: 'ephemeral',
        text: '対象の習慣が見つかりませんでした。',
        tokensUsed: editResult.tokensUsed,
        remainingTokens: editResult.remainingTokens,
        error: 'HABIT_NOT_FOUND',
      };
    }

    // Apply changes
    const habitRepo = new HabitRepository(this.supabase);
    const updateData: Record<string, unknown> = {};

    if (editResult.changes.name) updateData['name'] = editResult.changes.name;
    if (editResult.changes.type) updateData['type'] = editResult.changes.type;
    if (editResult.changes.frequency) updateData['frequency'] = editResult.changes.frequency;
    if (editResult.changes.triggerTime !== undefined) updateData['trigger_time'] = editResult.changes.triggerTime;
    if (editResult.changes.targetCount !== undefined) updateData['target_count'] = editResult.changes.targetCount;
    if (editResult.changes.workloadUnit !== undefined) updateData['workload_unit'] = editResult.changes.workloadUnit;
    if (editResult.changes.isActive !== undefined) updateData['is_active'] = editResult.changes.isActive;

    if (Object.keys(updateData).length === 0) {
      return {
        success: false,
        responseType: 'ephemeral',
        text: '変更内容を特定できませんでした。',
        tokensUsed: editResult.tokensUsed,
        remainingTokens: editResult.remainingTokens,
        error: 'NO_CHANGES',
      };
    }

    const updatedHabit = await habitRepo.update(editResult.targetHabitId, updateData);

    logger.info('Updated habit via Slack NL command', {
      userId,
      habitId: editResult.targetHabitId,
      changes: Object.keys(updateData),
      tokensUsed: editResult.tokensUsed,
    });

    return {
      success: true,
      responseType: 'in_channel',
      text: `✅ 習慣「${editResult.targetHabitName}」を更新しました！`,
      blocks: this.buildEditSuccessBlocks(updatedHabit, editResult),
      habitId: editResult.targetHabitId,
      tokensUsed: editResult.tokensUsed,
      remainingTokens: editResult.remainingTokens,
    };
  }

  /**
   * Handle errors and return appropriate Slack response.
   */
  private handleError(error: unknown): SlackNLResponse {
    if (error instanceof AIServiceError) {
      if (error.code === AIErrorCode.QUOTA_EXCEEDED) {
        return {
          success: false,
          responseType: 'ephemeral',
          text: error.message,
          blocks: this.buildQuotaExceededBlocks(),
          error: 'QUOTA_EXCEEDED',
        };
      }

      if (error.code === AIErrorCode.RATE_LIMITED) {
        return {
          success: false,
          responseType: 'ephemeral',
          text: 'APIレート制限に達しました。しばらくしてから再試行してください。',
          error: 'RATE_LIMITED',
        };
      }

      return {
        success: false,
        responseType: 'ephemeral',
        text: error.message,
        error: error.code,
      };
    }

    logger.error('Unexpected error in connector service', error instanceof Error ? error : undefined);

    return {
      success: false,
      responseType: 'ephemeral',
      text: 'エラーが発生しました。しばらくしてから再試行してください。',
      error: 'INTERNAL_ERROR',
    };
  }

  /**
   * Build help blocks for unknown commands.
   */
  private buildHelpBlocks(): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🤖 自然言語コマンドの使い方*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*習慣を追加:*\n`新しい習慣: 毎朝7時に30分ジョギング`\n`習慣登録: 毎日水を2L飲む`',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*習慣を編集:*\n`習慣を編集: ジョギングを45分に変更`\n`習慣を変更: 読書の時間を夜9時に`',
        },
      },
    ];
  }

  /**
   * Build upgrade prompt blocks.
   */
  private buildUpgradePromptBlocks(): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🔒 *この機能はPremiumプランでのみ利用可能です*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Premiumプランにアップグレードすると、自然言語で習慣を登録・編集できます。',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'プランを確認',
              emoji: true,
            },
            url: `${process.env['FRONTEND_URL'] || 'https://vow.app'}/settings/subscription`,
            action_id: 'view_plans',
          },
        ],
      },
    ];
  }

  /**
   * Build quota exceeded blocks.
   */
  private buildQuotaExceededBlocks(): SlackBlock[] {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚠️ *今月のトークン上限に達しました*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '次の請求サイクルでリセットされます。より多くのトークンが必要な場合は、プランのアップグレードをご検討ください。',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'プランを確認',
              emoji: true,
            },
            url: `${process.env['FRONTEND_URL'] || 'https://vow.app'}/settings/subscription`,
            action_id: 'view_plans',
          },
        ],
      },
    ];
  }

  /**
   * Build success blocks for habit creation.
   */
  private buildCreateSuccessBlocks(
    habit: { id: string; name: string; type?: string; frequency?: string; trigger_time?: string | null | undefined; target_count?: number; workload_unit?: string | null | undefined },
    parseResult: { tokensUsed: number; remainingTokens: number; parsed: ParsedHabitData }
  ): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *習慣「${habit.name}」を登録しました！*`,
        },
      },
    ];

    // Build details
    const details: string[] = [];
    if (habit.type) details.push(`タイプ: ${habit.type === 'do' ? '実行' : '回避'}`);
    if (habit.frequency) details.push(`頻度: ${this.formatFrequency(habit.frequency)}`);
    if (habit.trigger_time) details.push(`時刻: ${habit.trigger_time}`);
    if (habit.target_count && habit.target_count > 1) {
      const unit = habit.workload_unit || '回';
      details.push(`目標: ${habit.target_count}${unit}`);
    }

    if (details.length > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: details.join(' | '),
          },
        ],
      });
    }

    // Token usage info
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🎫 使用トークン: ${parseResult.tokensUsed.toLocaleString()} | 残り: ${parseResult.remainingTokens.toLocaleString()}`,
        },
      ],
    });

    return blocks;
  }

  /**
   * Build success blocks for habit edit.
   */
  private buildEditSuccessBlocks(
    habit: { id: string; name: string } | null,
    editResult: { targetHabitName: string | null; changes: Record<string, unknown>; tokensUsed: number; remainingTokens: number }
  ): SlackBlock[] {
    const habitName = habit?.name || editResult.targetHabitName || '習慣';
    const blocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *習慣「${habitName}」を更新しました！*`,
        },
      },
    ];

    // Show changes
    const changeDescriptions: string[] = [];
    const changes = editResult.changes;
    if (changes['name']) changeDescriptions.push(`名前: ${changes['name']}`);
    if (changes['frequency']) changeDescriptions.push(`頻度: ${this.formatFrequency(changes['frequency'] as string)}`);
    if (changes['triggerTime']) changeDescriptions.push(`時刻: ${changes['triggerTime']}`);
    if (changes['targetCount']) changeDescriptions.push(`目標: ${changes['targetCount']}`);
    if (changes['isActive'] !== undefined) changeDescriptions.push(`状態: ${changes['isActive'] ? '有効' : '無効'}`);

    if (changeDescriptions.length > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `変更内容: ${changeDescriptions.join(', ')}`,
          },
        ],
      });
    }

    // Token usage info
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🎫 使用トークン: ${editResult.tokensUsed.toLocaleString()} | 残り: ${editResult.remainingTokens.toLocaleString()}`,
        },
      ],
    });

    return blocks;
  }

  /**
   * Build blocks showing candidate habits.
   */
  private buildCandidatesBlocks(
    candidates: Array<{ habitId: string; habitName: string; similarity: number }>
  ): SlackBlock[] {
    const blocks: SlackBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🤔 *対象の習慣を特定できませんでした*\n以下の習慣のいずれかを指定してください:',
        },
      },
    ];

    const candidateList = candidates
      .slice(0, 5)
      .map((c, i) => `${i + 1}. ${c.habitName}`)
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: candidateList,
      },
    });

    return blocks;
  }

  /**
   * Format frequency for display.
   */
  private formatFrequency(frequency: string): string {
    switch (frequency) {
      case 'daily':
        return '毎日';
      case 'weekly':
        return '毎週';
      case 'monthly':
        return '毎月';
      default:
        return frequency;
    }
  }
}

// Singleton instance
let _connectorService: ConnectorService | null = null;

/**
 * Get or create the singleton connector service instance.
 */
export function getConnectorService(supabase: SupabaseClient): ConnectorService {
  if (_connectorService === null) {
    _connectorService = new ConnectorService(supabase);
  }
  return _connectorService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetConnectorService(): void {
  _connectorService = null;
}
