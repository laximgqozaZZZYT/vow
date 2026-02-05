'use client';

/**
 * View.CoachMode.tsx
 *
 * Coach Mode View Component - Core UI for AI Coach functionality
 *
 * Extracted from Section.Coach.tsx for reusability.
 * Can be embedded in Section.AIAssistant or used standalone.
 *
 * Features:
 * - Mastra agent integration with streaming responses
 * - Habit/Goal suggestion cards with selection
 * - Level assessment UI
 * - Conversation history with tool call visualization
 * - Context-based recommended prompts
 *
 * Note: Header and footer management is delegated to parent component.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CoachingWidget } from './Widget.Coaching';
import { HabitStatsCard, type HabitStats } from './Widget.HabitStats';
import { WorkloadChart, type WorkloadData } from './Widget.WorkloadChart';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';
import { ProgressIndicator } from './Widget.Progress';
import { SuggestionHistory } from './Widget.SuggestionHistory';
import LevelAssessmentSliders, { type LevelVariables } from './Widget.LevelAssessmentSliders';
import { useMastraAgent, type MastraMessage } from '../hooks/useMastraAgent';
import type { ToolCallResult } from '../../../lib/mastra/config';

// ============================================================================
// Types
// ============================================================================

export interface Goal {
  id: string;
  name: string;
  /** Linked habit IDs (optional, for contextual prompts) */
  linkedHabits?: string[];
}

export interface Habit {
  id: string;
  goalId: string;
  name: string;
  level?: number | null;
  completed?: boolean;
  levelAssessmentRaw?: {
    variables?: LevelVariables;
  };
  /** THPI level (alias for level, for contextual prompts compatibility) */
  thpiLevel?: number | null;
  /** Whether the habit is completed today */
  completedToday?: boolean;
  /** Completion rate (0-100) for contextual prompts */
  completionRate?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: DetectedIntent;
  data?: unknown;
  uiComponents?: UIComponentData[];
}

export interface UIComponentData {
  type: 'ui_component';
  component: 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';
  data: Record<string, unknown>;
}

export interface HabitSuggestion {
  name: string;
  type: 'do' | 'avoid';
  frequency: 'daily' | 'weekly' | 'monthly';
  suggestedTargetCount: number;
  workloadUnit: string | null;
  reason: string;
  confidence: number;
  triggerTime?: string | null;
  duration?: number | null;
}

export interface GoalSuggestion {
  name: string;
  description?: string;
  icon?: string;
  reason: string;
  suggestedHabits?: string[];
}

export type DetectedIntent = 'create' | 'edit' | 'suggest' | 'coaching' | 'followup' | 'level_assessment' | null;

/**
 * Props for CoachModeView component
 */
export interface CoachModeViewProps {
  /** List of user goals */
  goals: Goal[];
  /** List of user habits */
  habits?: Habit[];
  /** Conversation messages (controlled from parent) */
  messages: Message[];
  /** Callback when sending a message */
  onSendMessage: (content: string) => void;
  /** Callback when a habit is created */
  onHabitCreated?: () => void;
  /** Callback when a goal is created */
  onGoalCreated?: () => void;
  /** Callback when a habit is updated */
  onHabitUpdated?: () => void;
  /** Locale for i18n */
  locale?: 'ja' | 'en';
  /** Loading state */
  isLoading?: boolean;
  /** Processing state (AI is thinking) */
  isProcessing?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Callback to clear error */
  onClearError?: () => void;
  /** Enable Mastra agent (default: true) */
  useMastra?: boolean;
  /** Auth token for Mastra */
  authToken?: string | null;
  /** Whether user is premium */
  isPremium?: boolean;
  /** Whether user is admin */
  isAdmin?: boolean;
  /** Whether user is pro */
  isPro?: boolean;
  /** Token info for display */
  tokenInfo?: { remaining: number; total: number } | null;
  /** Selected goal ID for suggestions */
  selectedGoalId?: string;
  /** Callback when selected goal changes */
  onSelectedGoalChange?: (goalId: string) => void;
  /** Show suggestion history panel */
  showHistory?: boolean;
  /** Callback to toggle history panel */
  onToggleHistory?: () => void;
  /** Habit suggestions from AI */
  suggestions?: HabitSuggestion[];
  /** Callback when suggestion is selected */
  onSelectSuggestion?: (suggestion: HabitSuggestion) => void;
  /** Callback to close suggestions */
  onCloseSuggestions?: () => void;
  /** Goal suggestions from AI */
  goalSuggestions?: GoalSuggestion[];
  /** Callback when goal suggestion is selected */
  onSelectGoalSuggestion?: (suggestion: GoalSuggestion) => void;
  /** Callback to close goal suggestions */
  onCloseGoalSuggestions?: () => void;
  /** Show coaching widget */
  showCoaching?: boolean;
  /** Callback to close coaching widget */
  onCloseCoaching?: () => void;
  /** Level assessment habit state */
  levelAssessmentHabit?: { id: string; name: string } | null;
  /** Callback when level assessment is submitted */
  onLevelAssessmentSubmit?: (habitId: string, variables: LevelVariables, level: number) => void;
  /** Callback when level assessment is cancelled */
  onLevelAssessmentCancel?: () => void;
  /** Level assessment loading state */
  levelAssessmentLoading?: boolean;
  /** Mastra agent instance (optional, for external control) */
  mastraAgent?: ReturnType<typeof useMastraAgent>;
  /** Workflow steps for progress indicator */
  workflowSteps?: WorkflowStep[];
  /** Current workflow step index */
  currentWorkflowStep?: number;
  /** Active tool call name for streaming indicator */
  activeToolCall?: string | null;
  /** Callback for quick action selection */
  onQuickAction?: (choice: Choice) => void;
  /** Callback for choice selection from UI components */
  onChoiceSelect?: (choice: Choice) => void;
  /** Callback for contextual prompt selection */
  onContextualPromptSelect?: (prompt: Choice) => void;
  /** Callback to open habit modal */
  onOpenHabitModal?: (data: { name?: string; type?: 'do' | 'avoid'; triggerTime?: string | null; goalId?: string | null }) => void;
  /** Callback to open goal modal */
  onOpenGoalModal?: (data: { name?: string; parentId?: string | null }) => void;
  /** Callback to add message (for internal use) */
  onAddMessage?: (role: 'user' | 'assistant', content: string, intent?: DetectedIntent, data?: unknown, uiComponents?: UIComponentData[]) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Tool call icons and descriptions for visualization
 */
const TOOL_CALL_CONFIG: Record<string, { icon: string; label: string; labelEn: string; description: string; descriptionEn: string }> = {
  parse_habit: {
    icon: '📝',
    label: '習慣解析',
    labelEn: 'Parsing Habit',
    description: '入力から習慣情報を抽出中...',
    descriptionEn: 'Extracting habit info from input...',
  },
  suggest_habits: {
    icon: '💡',
    label: '習慣提案',
    labelEn: 'Suggesting Habits',
    description: 'おすすめの習慣を生成中...',
    descriptionEn: 'Generating habit suggestions...',
  },
  analyze_progress: {
    icon: '📊',
    label: '進捗分析',
    labelEn: 'Analyzing Progress',
    description: '習慣の達成状況を分析中...',
    descriptionEn: 'Analyzing habit progress...',
  },
  get_coaching: {
    icon: '🎯',
    label: 'コーチング',
    labelEn: 'Coaching',
    description: 'パーソナライズされたアドバイスを生成中...',
    descriptionEn: 'Generating personalized advice...',
  },
  assess_level: {
    icon: '📈',
    label: 'レベル評価',
    labelEn: 'Level Assessment',
    description: '習慣のレベルを評価中...',
    descriptionEn: 'Assessing habit level...',
  },
  search_habits: {
    icon: '🔍',
    label: '習慣検索',
    labelEn: 'Searching Habits',
    description: '関連する習慣を検索中...',
    descriptionEn: 'Searching for related habits...',
  },
  calculate_workload: {
    icon: '⚖️',
    label: 'ワークロード計算',
    labelEn: 'Calculating Workload',
    description: '日々の負荷を計算中...',
    descriptionEn: 'Calculating daily workload...',
  },
  default: {
    icon: '⚙️',
    label: 'ツール実行',
    labelEn: 'Running Tool',
    description: 'ツールを実行中...',
    descriptionEn: 'Running tool...',
  },
};

/**
 * Workflow steps for progress indicator
 */
export interface WorkflowStep {
  id: string;
  label: string;
  labelEn: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

/**
 * Default quick actions (Choice format)
 */
const DEFAULT_QUICK_ACTIONS: Choice[] = [
  {
    id: 'assess-level',
    label: 'レベル設定',
    icon: '📈',
    description: '習慣のレベルを設定します',
  },
  {
    id: 'add-habit',
    label: '習慣を追加',
    icon: '➕',
    description: '新しい習慣を作成します',
  },
  {
    id: 'set-goal',
    label: 'ゴールを設定',
    icon: '🎯',
    description: '目標を設定します',
  },
  {
    id: 'check-progress',
    label: '進捗を確認',
    icon: '📊',
    description: '習慣の達成状況を確認します',
  },
  {
    id: 'get-advice',
    label: 'アドバイス',
    icon: '💡',
    description: '習慣継続のアドバイスを受けます',
  },
];

/**
 * English versions of quick actions
 */
const DEFAULT_QUICK_ACTIONS_EN: Choice[] = [
  {
    id: 'assess-level',
    label: 'Set Level',
    icon: '📈',
    description: 'Set the level for your habits',
  },
  {
    id: 'add-habit',
    label: 'Add Habit',
    icon: '➕',
    description: 'Create a new habit',
  },
  {
    id: 'set-goal',
    label: 'Set Goal',
    icon: '🎯',
    description: 'Set a goal',
  },
  {
    id: 'check-progress',
    label: 'Check Progress',
    icon: '📊',
    description: 'Check your habit progress',
  },
  {
    id: 'get-advice',
    label: 'Get Advice',
    icon: '💡',
    description: 'Get tips for habit building',
  },
];

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Tool name display mapping for localization
 */
function getToolDisplayName(toolName: string, locale: 'ja' | 'en'): string {
  const names: Record<string, { ja: string; en: string }> = {
    'get_habits': { ja: '習慣を取得', en: 'Get Habits' },
    'get_goals': { ja: 'ゴールを取得', en: 'Get Goals' },
    'create_habit': { ja: '習慣を作成', en: 'Create Habit' },
    'update_habit': { ja: '習慣を更新', en: 'Update Habit' },
    'delete_habit': { ja: '習慣を削除', en: 'Delete Habit' },
    'analyze_habits': { ja: '習慣を分析', en: 'Analyze Habits' },
    'parse_habit': { ja: '習慣解析', en: 'Parse Habit' },
    'suggest_habits': { ja: '習慣提案', en: 'Suggest Habits' },
    'analyze_progress': { ja: '進捗分析', en: 'Analyze Progress' },
    'get_coaching': { ja: 'コーチング', en: 'Get Coaching' },
    'assess_level': { ja: 'レベル評価', en: 'Assess Level' },
    'search_habits': { ja: '習慣検索', en: 'Search Habits' },
    'calculate_workload': { ja: 'ワークロード計算', en: 'Calculate Workload' },
    'create_goal': { ja: 'ゴールを作成', en: 'Create Goal' },
    'update_goal': { ja: 'ゴールを更新', en: 'Update Goal' },
    'delete_goal': { ja: 'ゴールを削除', en: 'Delete Goal' },
    'get_user_stats': { ja: 'ユーザー統計を取得', en: 'Get User Stats' },
    'mark_habit_complete': { ja: '習慣を完了', en: 'Mark Habit Complete' },
  };
  return names[toolName]?.[locale] ?? toolName;
}

/**
 * Props for individual tool call visualization
 */
interface ToolCallVisualizationItemProps {
  toolName: string;
  toolDescription?: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  onRetry?: () => void;
  locale?: 'ja' | 'en';
  index?: number;
  total?: number;
}

/**
 * Individual Tool Call Visualization Item Component
 * Displays a single tool call with status, description, and retry option
 */
function ToolCallVisualizationItem({
  toolName,
  toolDescription,
  status,
  result,
  error,
  onRetry,
  locale = 'ja',
  index,
  total,
}: ToolCallVisualizationItemProps) {
  const config = TOOL_CALL_CONFIG[toolName] || TOOL_CALL_CONFIG.default;
  const displayName = getToolDisplayName(toolName, locale);
  const description = toolDescription || (locale === 'ja' ? config.description : config.descriptionEn);

  // Determine result count if available
  const resultCount = Array.isArray(result) ? result.length : null;

  return (
    <div
      className={`
        flex flex-col p-2 rounded-lg text-sm border
        ${status === 'pending' ? 'bg-muted/30 border-muted' : ''}
        ${status === 'running' ? 'bg-blue-500/10 border-blue-500/30' : ''}
        ${status === 'success' ? 'bg-green-500/10 border-green-500/30' : ''}
        ${status === 'error' ? 'bg-red-500/10 border-red-500/30' : ''}
      `}
      role="status"
      aria-live="polite"
      aria-label={`${displayName} - ${
        status === 'pending' ? (locale === 'ja' ? '待機中' : 'Pending') :
        status === 'running' ? (locale === 'ja' ? '実行中' : 'Running') :
        status === 'success' ? (locale === 'ja' ? '完了' : 'Completed') :
        (locale === 'ja' ? 'エラー' : 'Error')
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Order indicator for multiple tool calls */}
        {total !== undefined && total > 1 && index !== undefined && (
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium"
            aria-label={locale === 'ja' ? `${total}個中${index + 1}番目` : `${index + 1} of ${total}`}
          >
            {index + 1}
          </span>
        )}

        {/* Status indicator: Spinner for running, icon for others */}
        {status === 'running' && (
          <div
            className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
            role="progressbar"
            aria-label={locale === 'ja' ? '実行中' : 'Running'}
          />
        )}
        {status === 'pending' && (
          <span className="text-muted-foreground" aria-hidden="true">{config.icon}</span>
        )}
        {status === 'success' && (
          <span className="text-green-500" aria-hidden="true">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-500" aria-hidden="true">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}

        {/* Tool name and description */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium truncate">{displayName}</span>
          {status === 'success' && resultCount !== null && (
            <span className="text-muted-foreground text-xs">
              ({resultCount}{locale === 'ja' ? '件' : ' items'})
            </span>
          )}
          {status === 'running' && (
            <span className="text-muted-foreground text-xs truncate">
              {locale === 'ja' ? '実行中...' : 'Running...'}
            </span>
          )}
          {toolDescription && status !== 'running' && (
            <span className="text-muted-foreground text-xs truncate hidden sm:inline">
              {toolDescription}
            </span>
          )}
        </div>

        {/* Retry button for error state */}
        {status === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="
              flex items-center gap-1 px-2 py-1
              text-xs font-medium text-primary
              bg-primary/10 hover:bg-primary/20
              rounded transition-colors
            "
            aria-label={locale === 'ja' ? '再試行' : 'Retry'}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {locale === 'ja' ? '再試行' : 'Retry'}
          </button>
        )}
      </div>

      {/* Error message display */}
      {status === 'error' && error && (
        <div
          className="mt-2 text-xs text-red-500 bg-red-500/5 rounded p-2"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Tool Call Visualization Component (Container)
 * Displays multiple tool calls with their statuses
 */
function ToolCallVisualization({
  toolCalls,
  locale = 'ja',
  onRetry,
}: {
  toolCalls: ToolCallResult[];
  locale?: 'ja' | 'en';
  onRetry?: (toolName: string) => void;
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const total = toolCalls.length;

  return (
    <div
      className="flex flex-col gap-2 mt-3"
      role="region"
      aria-label={locale === 'ja' ? 'ツール実行状況' : 'Tool execution status'}
    >
      {toolCalls.map((call, idx) => (
        <ToolCallVisualizationItem
          key={`tool-${idx}-${call.toolName}`}
          toolName={call.toolName}
          status={call.success ? 'success' : 'error'}
          result={call.output}
          error={call.error}
          onRetry={onRetry ? () => onRetry(call.toolName) : undefined}
          locale={locale}
          index={idx}
          total={total}
        />
      ))}
    </div>
  );
}

/**
 * Streaming Message Indicator Component
 */
function StreamingIndicator({
  toolName,
  locale = 'ja',
}: {
  toolName?: string;
  locale?: 'ja' | 'en';
}) {
  const config = toolName
    ? (TOOL_CALL_CONFIG[toolName] || TOOL_CALL_CONFIG.default)
    : TOOL_CALL_CONFIG.default;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="flex items-center gap-1">
        <span>{config.icon}</span>
        <span>{locale === 'ja' ? config.description : config.descriptionEn}</span>
      </span>
    </div>
  );
}

/**
 * Workflow Progress Component
 */
function WorkflowProgress({
  steps,
  currentStep,
  locale = 'ja',
}: {
  steps: WorkflowStep[];
  currentStep: number;
  locale?: 'ja' | 'en';
}) {
  return (
    <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep || step.status === 'completed';
        const isError = step.status === 'error';

        return (
          <div key={step.id} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-6 h-0.5 mx-1 ${
                  isCompleted ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-muted'
                }`}
              />
            )}
            <div
              className={`
                flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                ${isActive ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' : ''}
                ${isCompleted && !isActive ? 'bg-green-500 text-white' : ''}
                ${isError ? 'bg-red-500 text-white' : ''}
                ${!isActive && !isCompleted && !isError ? 'bg-muted text-muted-foreground' : ''}
              `}
              title={locale === 'ja' ? step.label : step.labelEn}
            >
              {isCompleted && !isActive ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : isError ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Contextual Prompts Display Component
 */
function ContextualPromptsSection({
  prompts,
  onSelect,
  locale = 'ja',
}: {
  prompts: Choice[];
  onSelect: (prompt: Choice) => void;
  locale?: 'ja' | 'en';
}) {
  if (prompts.length === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        {locale === 'ja' ? 'おすすめ' : 'Recommended'}
      </h4>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelect(prompt)}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              bg-primary/5 hover:bg-primary/10
              border border-primary/20 hover:border-primary/40
              rounded-full text-sm transition-colors
            "
          >
            <span>{prompt.icon}</span>
            <span>{prompt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Habit Suggestions View
 */
function SuggestionsView({
  suggestions,
  onClose,
  onSelect,
  locale = 'ja',
}: {
  suggestions: HabitSuggestion[];
  onClose: () => void;
  onSelect: (suggestion: HabitSuggestion) => void;
  locale?: 'ja' | 'en';
}) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{locale === 'ja' ? '提案された習慣' : 'Suggested Habits'}</h4>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          {locale === 'ja' ? '閉じる' : 'Close'}
        </button>
      </div>
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
          onClick={() => onSelect(suggestion)}
        >
          <div className="flex items-start justify-between">
            <div className="font-medium text-base">{suggestion.name}</div>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
              {suggestion.type === 'do' ? 'Good' : 'Bad'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground text-xs block">
                {locale === 'ja' ? '頻度' : 'Frequency'}
              </span>
              <span>
                {suggestion.frequency === 'daily'
                  ? locale === 'ja' ? '毎日' : 'Daily'
                  : suggestion.frequency === 'weekly'
                  ? locale === 'ja' ? '毎週' : 'Weekly'
                  : locale === 'ja' ? '毎月' : 'Monthly'}
              </span>
            </div>
            <div className="bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground text-xs block">
                {locale === 'ja' ? '目標' : 'Target'}
              </span>
              <span>{suggestion.suggestedTargetCount}{suggestion.workloadUnit || (locale === 'ja' ? '回' : 'x')}</span>
            </div>
            <div className="bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground text-xs block">
                {locale === 'ja' ? '信頼度' : 'Confidence'}
              </span>
              <span>{Math.round(suggestion.confidence * 100)}%</span>
            </div>
          </div>
          {suggestion.reason && (
            <p className="text-sm text-muted-foreground mt-3 italic">💡 {suggestion.reason}</p>
          )}
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            <span>{locale === 'ja' ? 'クリックして詳細を編集' : 'Click to edit details'}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Goal Suggestions View
 */
function GoalSuggestionsView({
  suggestions,
  onClose,
  onSelect,
  locale = 'ja',
}: {
  suggestions: GoalSuggestion[];
  onClose: () => void;
  onSelect: (suggestion: GoalSuggestion) => void;
  locale?: 'ja' | 'en';
}) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{locale === 'ja' ? '提案されたゴール' : 'Suggested Goals'}</h4>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          {locale === 'ja' ? '閉じる' : 'Close'}
        </button>
      </div>
      {suggestions.map((suggestion, index) => (
        <div
          key={index}
          className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
          onClick={() => onSelect(suggestion)}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{suggestion.icon || '🎯'}</span>
            <div className="flex-1">
              <div className="font-medium text-base">{suggestion.name}</div>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
              )}
            </div>
          </div>
          {suggestion.reason && (
            <p className="text-sm text-muted-foreground mt-3 italic">💡 {suggestion.reason}</p>
          )}
          {suggestion.suggestedHabits && suggestion.suggestedHabits.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-medium">
                {locale === 'ja' ? '関連する習慣例:' : 'Related habits:'}
              </span>
              <span className="ml-1">{suggestion.suggestedHabits.slice(0, 3).join(locale === 'ja' ? '、' : ', ')}</span>
            </div>
          )}
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            <span>{locale === 'ja' ? 'クリックして作成' : 'Click to create'}</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * UI Component Renderer
 */
function UIComponentRenderer({
  component,
  onChoiceSelect,
}: {
  component: UIComponentData;
  onChoiceSelect: (choice: Choice) => void;
}) {
  switch (component.component) {
    case 'habit_stats': {
      const recentHistory = component.data.recentHistory as Array<{ date: string; completed: boolean }> | undefined;
      return (
        <HabitStatsCard
          stats={{
            habitId: component.data.habitId as string,
            habitName: component.data.habitName as string,
            completionRate: component.data.completionRate as number,
            trend: component.data.trend as 'improving' | 'stable' | 'declining',
            streakDays: (component.data.streak as number) || 0,
            recentHistory,
          }}
          className="max-w-sm"
        />
      );
    }

    case 'workload_chart':
      return (
        <WorkloadChart
          data={component.data as unknown as WorkloadData}
          type={(component.data.chartType as 'bar' | 'donut') || 'bar'}
          className="max-w-md"
        />
      );

    case 'choice_buttons': {
      const choices = component.data.choices as Choice[];
      const title = component.data.title as string | undefined;
      const layout = component.data.layout as 'vertical' | 'horizontal' | 'grid' | undefined;
      const size = component.data.size as 'sm' | 'md' | 'lg' | undefined;
      return (
        <div className="space-y-2 max-w-md">
          {title && <p className="text-sm font-medium text-foreground">{title}</p>}
          <ChoiceButtons
            choices={choices}
            onSelect={onChoiceSelect}
            layout={layout}
            size={size}
          />
        </div>
      );
    }

    case 'progress_indicator':
      return (
        <ProgressIndicator
          value={component.data.value as number}
          max={component.data.max as number}
          type={component.data.type as 'linear' | 'circular'}
          size={component.data.size as 'sm' | 'md' | 'lg'}
          color={component.data.color as 'success' | 'primary' | 'warning' | 'danger' | undefined}
          label={component.data.label as string}
          className="max-w-xs"
        />
      );

    case 'quick_actions': {
      const actions = component.data.actions as Array<{ id: string; label: string; icon?: string; description?: string }>;
      const choices: Choice[] = actions.map(a => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        description: a.description,
      }));
      return (
        <ChoiceButtons
          choices={choices}
          onSelect={onChoiceSelect}
          layout={component.data.layout as 'vertical' | 'horizontal' | 'grid'}
          size={component.data.size as 'sm' | 'md' | 'lg'}
          className="max-w-md"
        />
      );
    }

    default:
      return null;
  }
}

/**
 * Parse buttons JSON from AI response content
 * The AI Coach system prompt instructs AI to include buttons in JSON format at the end of the response:
 * ```json
 * {"buttons": [{"label": "...", "value": "..."}]}
 * ```
 * This function extracts those buttons and converts them to Choice format
 */
function parseButtonsFromContent(content: string): { choices: Choice[]; cleanedContent: string } | null {
  if (!content) return null;

  // Pattern to match JSON with buttons array, including inside code blocks
  // Supports: {"buttons": [...]} or ```json\n{"buttons": [...]}\n```
  const jsonCodeBlockPattern = /```(?:json)?\s*\n?\s*(\{"buttons"\s*:\s*\[[\s\S]*?\]\})\s*\n?\s*```/gi;
  const inlineJsonPattern = /(\{"buttons"\s*:\s*\[[\s\S]*?\]\})/gi;

  let buttonsData: Array<{ label: string; value: string; icon?: string }> | null = null;
  let matchedJson: string | null = null;

  // First try to find JSON in code blocks
  const codeBlockMatch = jsonCodeBlockPattern.exec(content);
  if (codeBlockMatch && codeBlockMatch[1]) {
    matchedJson = codeBlockMatch[0]; // Full match including ```json...```
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.buttons && Array.isArray(parsed.buttons)) {
        buttonsData = parsed.buttons;
      }
    } catch (e) {
      console.warn('[parseButtonsFromContent] Failed to parse JSON in code block:', e);
    }
  }

  // If not found in code blocks, try inline JSON
  if (!buttonsData) {
    const inlineMatch = inlineJsonPattern.exec(content);
    if (inlineMatch && inlineMatch[1]) {
      matchedJson = inlineMatch[0];
      try {
        const parsed = JSON.parse(inlineMatch[1]);
        if (parsed.buttons && Array.isArray(parsed.buttons)) {
          buttonsData = parsed.buttons;
        }
      } catch (e) {
        console.warn('[parseButtonsFromContent] Failed to parse inline JSON:', e);
      }
    }
  }

  if (!buttonsData || buttonsData.length === 0) {
    return null;
  }

  // Remove the JSON from content for cleaner display
  const cleanedContent = matchedJson
    ? content.replace(matchedJson, '').trim()
    : content;

  // Convert to Choice format
  const choices: Choice[] = buttonsData.map((btn, index) => ({
    id: `btn-${index}-${btn.value || btn.label}`,
    label: btn.label || '',
    value: btn.value || btn.label || '',
    icon: btn.icon,
  }));

  return { choices, cleanedContent };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Contextual prompt interface for smart recommendations
 */
export interface ContextualPrompt {
  id: string;
  label: string;
  labelJa: string;
  icon: string;
  priority: number;
}

/**
 * Determine the current time of day
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Context-based recommended prompts based on user data
 * Enhanced version with time-of-day awareness and smarter recommendations
 */
function getContextualPrompts(
  habits: CoachModeViewProps['habits'],
  goals: CoachModeViewProps['goals'],
  locale: 'ja' | 'en' = 'ja',
  timeOfDay?: 'morning' | 'afternoon' | 'evening'
): Choice[] {
  const prompts: ContextualPrompt[] = [];
  const currentTimeOfDay = timeOfDay ?? getTimeOfDay();

  // 1. Time-of-day based suggestions
  if (currentTimeOfDay === 'morning') {
    prompts.push({
      id: 'morning-check',
      label: "Check today's habits",
      labelJa: '今日の習慣をチェック',
      icon: '☀️',
      priority: 10,
    });
  } else if (currentTimeOfDay === 'evening') {
    prompts.push({
      id: 'evening-review',
      label: "Review today's progress",
      labelJa: '今日の振り返り',
      icon: '🌙',
      priority: 10,
    });
  }

  // 2. Check for habits without levels (thpiLevel or level)
  const habitsWithoutLevel = (habits || []).filter(h => {
    // Check both thpiLevel and level for compatibility
    const hasThpiLevel = h.thpiLevel !== null && h.thpiLevel !== undefined;
    const hasLevel = h.level !== null && h.level !== undefined;
    return !hasThpiLevel && !hasLevel;
  });
  if (habitsWithoutLevel.length > 0) {
    prompts.push({
      id: 'set-levels',
      label: `Set levels for ${habitsWithoutLevel.length} habits`,
      labelJa: `${habitsWithoutLevel.length}件の習慣にレベル設定`,
      icon: '📊',
      priority: 9,
    });
  }

  // 3. Check for incomplete habits today (completedToday or completed)
  const todayIncomplete = (habits || []).filter(h => {
    // Check both completedToday and completed for compatibility
    const completedToday = h.completedToday ?? h.completed;
    return !completedToday;
  });
  if (todayIncomplete.length > 0) {
    prompts.push({
      id: 'incomplete-today',
      label: `${todayIncomplete.length} habits remaining today`,
      labelJa: `今日残り${todayIncomplete.length}件`,
      icon: '✅',
      priority: 8,
    });
  }

  // 4. Check for goals without habits (linkedHabits or computed from habits)
  const goalsWithoutHabits = (goals || []).filter(g => {
    // Check linkedHabits first, then compute from habits array
    if (g.linkedHabits && g.linkedHabits.length > 0) {
      return false;
    }
    const goalHabits = (habits || []).filter(h => h.goalId === g.id);
    return goalHabits.length === 0;
  });
  if (goalsWithoutHabits.length > 0) {
    prompts.push({
      id: 'goals-need-habits',
      label: `${goalsWithoutHabits.length} goals need habits`,
      labelJa: `${goalsWithoutHabits.length}件のゴールに習慣が必要`,
      icon: '🎯',
      priority: 7,
    });
  }

  // 5. Follow-up for habits with low achievement rate
  const lowAchievement = (habits || []).filter(h =>
    h.completionRate !== undefined && h.completionRate < 50
  );
  if (lowAchievement.length > 0) {
    prompts.push({
      id: 'low-achievement',
      label: 'Improve struggling habits',
      labelJa: '達成率の低い習慣を改善',
      icon: '💪',
      priority: 6,
    });
  }

  // Sort by priority (descending) and take top 3
  const sortedPrompts = prompts
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  // Convert to Choice format
  return sortedPrompts.map(p => ({
    id: p.id,
    label: locale === 'ja' ? p.labelJa : p.label,
    icon: p.icon,
    description: undefined, // ContextualPrompt does not have description
  }));
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * CoachModeView - Core view component for AI Coach functionality
 *
 * This component renders the main chat interface, suggestions, and
 * level assessment UI. It does not include header/footer - those
 * should be managed by the parent component.
 */
export function CoachModeView({
  goals,
  habits,
  messages,
  onSendMessage,
  onHabitCreated,
  onGoalCreated,
  onHabitUpdated,
  locale = 'ja',
  isLoading = false,
  isProcessing = false,
  error,
  onClearError,
  useMastra: enableMastra = true,
  authToken,
  isPremium = false,
  isAdmin = false,
  isPro = false,
  tokenInfo,
  selectedGoalId = '',
  onSelectedGoalChange,
  showHistory = false,
  onToggleHistory,
  suggestions = [],
  onSelectSuggestion,
  onCloseSuggestions,
  goalSuggestions = [],
  onSelectGoalSuggestion,
  onCloseGoalSuggestions,
  showCoaching = false,
  onCloseCoaching,
  levelAssessmentHabit,
  onLevelAssessmentSubmit,
  onLevelAssessmentCancel,
  levelAssessmentLoading = false,
  mastraAgent,
  workflowSteps = [],
  currentWorkflowStep = 0,
  activeToolCall,
  onQuickAction,
  onChoiceSelect,
  onContextualPromptSelect,
  onOpenHabitModal,
  onOpenGoalModal,
  onAddMessage,
}: CoachModeViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');

  // Get localized quick actions
  const quickActions = locale === 'ja' ? DEFAULT_QUICK_ACTIONS : DEFAULT_QUICK_ACTIONS_EN;

  // Context-based prompts
  const contextualPrompts = useMemo(
    () => getContextualPrompts(habits, goals, locale),
    [habits, goals, locale]
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Min 80px, max 160px
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 80), 160)}px`;
    }
  }, [input]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  }, [input, onSendMessage]);

  // Handle quick action
  const handleQuickAction = useCallback((choice: Choice) => {
    if (onQuickAction) {
      onQuickAction(choice);
    }
  }, [onQuickAction]);

  // Handle choice select
  const handleChoiceSelect = useCallback((choice: Choice) => {
    if (onChoiceSelect) {
      onChoiceSelect(choice);
    }
  }, [onChoiceSelect]);

  // Handle contextual prompt select
  const handleContextualPromptSelect = useCallback((prompt: Choice) => {
    if (onContextualPromptSelect) {
      onContextualPromptSelect(prompt);
    } else {
      // Default behavior: set input and send
      const promptText = prompt.description || prompt.label;
      setInput(promptText);
      setTimeout(() => {
        onSendMessage(promptText);
        setInput('');
      }, 100);
    }
  }, [onContextualPromptSelect, onSendMessage]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((suggestion: HabitSuggestion) => {
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    } else if (onOpenHabitModal) {
      onOpenHabitModal({
        name: suggestion.name,
        type: suggestion.type,
        triggerTime: suggestion.triggerTime || null,
        goalId: selectedGoalId || (goals.length > 0 ? goals[0].id : null),
      });
    }
    if (onCloseSuggestions) {
      onCloseSuggestions();
    }
  }, [onSelectSuggestion, onOpenHabitModal, onCloseSuggestions, selectedGoalId, goals]);

  // Handle goal suggestion selection
  const handleSelectGoalSuggestion = useCallback((suggestion: GoalSuggestion) => {
    if (onSelectGoalSuggestion) {
      onSelectGoalSuggestion(suggestion);
    } else if (onOpenGoalModal) {
      onOpenGoalModal({ name: suggestion.name });
    }
    if (onCloseGoalSuggestions) {
      onCloseGoalSuggestions();
    }
  }, [onSelectGoalSuggestion, onOpenGoalModal, onCloseGoalSuggestions]);

  // Check streaming state
  const isStreaming = mastraAgent?.isStreaming ?? false;
  const isDisabled = isProcessing || isStreaming || isLoading;

  // Render suggestion history if active
  if (showHistory) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <SuggestionHistory
          onClose={() => onToggleHistory?.()}
          onSelectSuggestion={(suggestion) => {
            if (suggestion.suggestionType === 'habit') {
              onOpenHabitModal?.({
                name: suggestion.suggestionData.name || '',
                type: suggestion.suggestionData.type || 'do',
                triggerTime: null,
                goalId: suggestion.goalId || (goals.length > 0 ? goals[0].id : null),
              });
            } else {
              onOpenGoalModal?.({
                name: suggestion.suggestionData.name || '',
                parentId: null,
              });
            }
            onToggleHistory?.();
            onAddMessage?.('assistant', `${locale === 'ja' ? '履歴から' : 'From history: '}「${suggestion.suggestionData.name}」${locale === 'ja' ? 'を選択しました。モーダルで詳細を編集してください。' : ' selected. Edit details in the modal.'}`);
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Chat Area - scrollable, with padding-bottom for fixed input */}
      <div className="flex-1 overflow-y-auto p-4 pb-40 md:pb-36">
        {/* Workflow Progress Indicator */}
        {workflowSteps.length > 0 && (
          <div className="mb-4">
            <WorkflowProgress
              steps={workflowSteps}
              currentStep={currentWorkflowStep}
              locale={locale}
            />
          </div>
        )}

        {messages.length === 0 ? (
          /* Quick Actions - centered with more top spacing */
          <div className="flex flex-col items-center justify-center min-h-[300px] pt-12">
            <p className="text-lg text-muted-foreground mb-6 text-center">
              {locale === 'ja' ? '何をお手伝いしましょうか？' : 'How can I help you?'}
            </p>

            {/* Contextual Prompts based on user data */}
            {contextualPrompts.length > 0 && (
              <ContextualPromptsSection
                prompts={contextualPrompts}
                onSelect={handleContextualPromptSelect}
                locale={locale}
              />
            )}

            <ChoiceButtons
              choices={quickActions}
              onSelect={handleQuickAction}
              layout="vertical"
              size="md"
              className="w-full max-w-md"
            />
          </div>
        ) : (
          /* Conversation History */
          <div className="space-y-4">
            {messages.map((msg) => {
              // Check for tool calls in message data (from Mastra)
              const toolCalls = (msg.data as { toolCalls?: ToolCallResult[] })?.toolCalls;

              // Parse buttons from content for assistant messages
              const parsedButtons = msg.role === 'assistant' ? parseButtonsFromContent(msg.content) : null;
              const displayContent = parsedButtons?.cleanedContent || msg.content;
              const contentButtons = parsedButtons?.choices;

              return (
                <div key={msg.id} className="space-y-2">
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[95%] md:max-w-[85%] px-4 py-3 rounded-xl text-base whitespace-pre-wrap break-words ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted border border-border rounded-bl-sm'
                      }`}
                    >
                      {displayContent}
                      {/* Tool Call Visualization for assistant messages */}
                      {msg.role === 'assistant' && toolCalls && toolCalls.length > 0 && (
                        <ToolCallVisualization toolCalls={toolCalls} locale={locale} />
                      )}
                    </div>
                  </div>
                  {/* Buttons parsed from content (JSON format in AI response) */}
                  {contentButtons && contentButtons.length > 0 && (
                    <div className="ml-2">
                      <ChoiceButtons
                        choices={contentButtons}
                        onSelect={handleChoiceSelect}
                        layout="horizontal"
                        size="sm"
                      />
                    </div>
                  )}
                  {/* UI Components */}
                  {msg.uiComponents && msg.uiComponents.length > 0 && (
                    <div className="space-y-2 ml-2">
                      {msg.uiComponents.map((comp, idx) => (
                        <UIComponentRenderer
                          key={`${msg.id}-ui-${idx}`}
                          component={comp}
                          onChoiceSelect={handleChoiceSelect}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Level Assessment Slider UI */}
            {levelAssessmentHabit && onLevelAssessmentSubmit && onLevelAssessmentCancel && (
              <div className="mt-4">
                <LevelAssessmentSliders
                  habitId={levelAssessmentHabit.id}
                  habitName={levelAssessmentHabit.name}
                  initialValues={(habits?.find(h => h.id === levelAssessmentHabit.id) as Habit | undefined)?.levelAssessmentRaw?.variables}
                  onSubmit={onLevelAssessmentSubmit}
                  onCancel={onLevelAssessmentCancel}
                  isLoading={levelAssessmentLoading}
                />
              </div>
            )}

            {/* Streaming/Processing indicator */}
            {(isProcessing || isStreaming) && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-xl bg-muted border border-border rounded-bl-sm">
                  {activeToolCall ? (
                    <StreamingIndicator toolName={activeToolCall} locale={locale} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]"></span>
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]"></span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {locale === 'ja' ? '考え中...' : 'Thinking...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error retry button for Mastra */}
            {enableMastra && mastraAgent?.error && (
              <div className="flex justify-start">
                <button
                  onClick={() => mastraAgent.retry()}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {locale === 'ja' ? '再試行' : 'Retry'}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Habit Suggestions */}
        {suggestions.length > 0 && onCloseSuggestions && (
          <SuggestionsView
            suggestions={suggestions}
            onClose={onCloseSuggestions}
            onSelect={handleSelectSuggestion}
            locale={locale}
          />
        )}

        {/* Goal Suggestions */}
        {goalSuggestions.length > 0 && onCloseGoalSuggestions && (
          <GoalSuggestionsView
            suggestions={goalSuggestions}
            onClose={onCloseGoalSuggestions}
            onSelect={handleSelectGoalSuggestion}
            locale={locale}
          />
        )}

        {/* Coaching Widget */}
        {showCoaching && (
          <div className="space-y-4 mt-4">
            <CoachingWidget onProposalApplied={onHabitCreated} />
            <button
              onClick={onCloseCoaching}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {locale === 'ja' ? '閉じる' : 'Close'}
            </button>
          </div>
        )}
      </div>

      {/* Goal Selector - fixed above input */}
      {goals.length > 1 && onSelectedGoalChange && (
        <div className="absolute bottom-24 md:bottom-20 left-0 right-0 px-4 py-2 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">
              {locale === 'ja' ? '提案対象ゴール:' : 'Target Goal:'}
            </label>
            <select
              value={selectedGoalId}
              onChange={(e) => onSelectedGoalChange(e.target.value)}
              className="text-xs px-2 py-1 rounded border border-input bg-background"
            >
              <option value="">{locale === 'ja' ? '自動選択' : 'Auto-select'}</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Input Area - FIXED at absolute bottom */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-3 md:p-4">
        {error && (
          <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            {onClearError && (
              <button
                onClick={onClearError}
                className="text-destructive/70 hover:text-destructive"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 md:gap-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length === 0
              ? locale === 'ja'
                ? '例: 毎朝7時に30分ジョギングする'
                : 'e.g., Jog for 30 minutes at 7am every day'
              : locale === 'ja'
                ? '続けて入力...'
                : 'Continue typing...'
            }
            className="flex-1 min-h-[44px] md:min-h-[52px] max-h-[100px] px-3 md:px-4 py-2 md:py-3 rounded-lg border border-input bg-background text-base resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            disabled={isDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isDisabled || !input.trim()}
            className="px-4 md:px-6 py-2 md:py-3 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isDisabled ? '...' : locale === 'ja' ? '送信' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}

export default CoachModeView;
