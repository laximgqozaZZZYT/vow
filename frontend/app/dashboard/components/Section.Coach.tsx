'use client';

/**
 * Unified AI Coach Section with Conversation Support (Gemini-style UI)
 *
 * Single intelligent interface that auto-detects user intent:
 * - Create habit from natural language
 * - Edit existing habit
 * - Get habit suggestions for goals
 * - Coaching/workload advice
 * - Continuous conversation with follow-up questions
 * - UI component rendering from AI responses
 * - View past AI suggestions history
 * - Level assessment for habits (THLI-24)
 *
 * Mastra Agent Integration:
 * - Streaming response display via SSE
 * - Tool call visualization with icons and descriptions
 * - User context-based recommended prompts
 * - Workflow progress indicator
 *
 * Requirements: Premium subscription features
 *
 * UI Design:
 * - Gemini-style spacious layout
 * - Chat area: flex-1, min-h-400px (desktop), min-h-250px (mobile)
 * - Input area: sticky bottom, auto-expand (max 160px)
 * - Quick actions: centered when no conversation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CoachingWidget } from './Widget.Coaching';
import { HabitStatsCard, type HabitStats } from './Widget.HabitStats';
import { WorkloadChart, type WorkloadData } from './Widget.WorkloadChart';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';
import { ProgressIndicator } from './Widget.Progress';
import { HabitModal } from './Modal.Habit';
import { GoalModal } from './Modal.Goal';
import { SuggestionHistory } from './Widget.SuggestionHistory';
import LevelAssessmentSliders, { type LevelVariables, calculateLevel } from './Widget.LevelAssessmentSliders';
import { useMastraAgent, type MastraMessage, type UseMastraAgentOptions } from '../hooks/useMastraAgent';
import type { ToolCallResult } from '../../../lib/mastra/config';

/**
 * Tool call icons and descriptions for visualization
 * ツール呼び出しの視覚化用アイコンと説明
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
 * ワークフロー進行状況インジケーター用のステップ
 */
interface WorkflowStep {
  id: string;
  label: string;
  labelEn: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

/**
 * デフォルトのクイックアクション（Choice形式）
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

/**
 * クイックアクションIDからプロンプトへのマッピング
 */
const QUICK_ACTION_PROMPTS: Record<string, string> = {
  'assess-level': '既存の習慣のレベル設定をして下さい',
  'add-habit': '新しい習慣を追加したい',
  'set-goal': 'ゴールを設定したい',
  'check-progress': '習慣の進捗を確認したい',
  'get-advice': '習慣を続けるコツを教えて',
};

const QUICK_ACTION_PROMPTS_EN: Record<string, string> = {
  'assess-level': 'Please help me set levels for my existing habits',
  'add-habit': 'I want to add a new habit',
  'set-goal': 'I want to set a goal',
  'check-progress': 'I want to check my habit progress',
  'get-advice': 'Give me tips for sticking to habits',
};

/**
 * Context-based recommended prompts based on user data
 * ユーザーコンテキストに基づく推奨プロンプト
 */
function getContextualPrompts(
  habits: CoachSectionProps['habits'],
  goals: CoachSectionProps['goals'],
  locale: 'ja' | 'en' = 'ja'
): Choice[] {
  const prompts: Choice[] = [];

  // Check for habits without levels
  const unassessedHabits = (habits || []).filter(h => h.level === null || h.level === undefined);
  if (unassessedHabits.length > 0) {
    prompts.push({
      id: 'assess-unleveled',
      label: locale === 'ja' ? `${unassessedHabits.length}件の習慣にレベル設定` : `Set levels for ${unassessedHabits.length} habits`,
      icon: '📈',
      description: locale === 'ja'
        ? `「${unassessedHabits[0]?.name}」など未設定の習慣があります`
        : `"${unassessedHabits[0]?.name}" and others need levels`,
    });
  }

  // Check for incomplete habits today
  const incompleteHabits = (habits || []).filter(h => !h.completed);
  if (incompleteHabits.length > 0 && incompleteHabits.length < 5) {
    prompts.push({
      id: 'motivate-incomplete',
      label: locale === 'ja' ? '今日の習慣を達成するコツ' : 'Tips to complete today\'s habits',
      icon: '🔥',
      description: locale === 'ja'
        ? `残り${incompleteHabits.length}件の習慣があります`
        : `${incompleteHabits.length} habits remaining`,
    });
  }

  // Check for goals without habits
  const goalsWithoutHabits = (goals || []).filter(g => {
    const goalHabits = (habits || []).filter(h => h.goalId === g.id);
    return goalHabits.length === 0;
  });
  if (goalsWithoutHabits.length > 0) {
    prompts.push({
      id: 'suggest-for-goal',
      label: locale === 'ja' ? `「${goalsWithoutHabits[0]?.name}」の習慣を提案` : `Suggest habits for "${goalsWithoutHabits[0]?.name}"`,
      icon: '🎯',
      description: locale === 'ja'
        ? 'このゴールに向けた習慣を提案します'
        : 'Get habit suggestions for this goal',
    });
  }

  // General suggestions when not much context
  if (prompts.length === 0) {
    prompts.push({
      id: 'weekly-review',
      label: locale === 'ja' ? '今週の振り返り' : 'Weekly Review',
      icon: '📅',
      description: locale === 'ja' ? '今週の習慣達成状況を確認' : 'Review this week\'s progress',
    });
  }

  return prompts.slice(0, 3);
}

interface Goal {
  id: string;
  name: string;
}

interface ParsedHabit {
  name: string;
  type: 'do' | 'avoid';
  frequency: 'daily' | 'weekly' | 'monthly' | null;
  triggerTime: string | null;
  duration: number | null;
  targetCount: number | null;
  workloadUnit: string | null;
  goalId: string | null;
  confidence: number;
}

interface HabitSuggestion {
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

interface GoalSuggestion {
  name: string;
  description?: string;
  icon?: string;
  reason: string;
  suggestedHabits?: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: DetectedIntent;
  data?: unknown;
  uiComponents?: UIComponentData[];
}

interface UIComponentData {
  type: 'ui_component';
  component: 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';
  data: Record<string, unknown>;
}

interface CoachSectionProps {
  goals: Goal[];
  habits?: { id: string; goalId: string; name: string; level?: number | null; completed?: boolean }[];
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
  onHabitUpdated?: () => void;
  /** Language preference */
  locale?: 'ja' | 'en';
  /** Enable Mastra agent integration (default: true) */
  useMastra?: boolean;
}

type DetectedIntent = 'create' | 'edit' | 'suggest' | 'coaching' | 'followup' | 'level_assessment' | null;

/**
 * Tool Call Visualization Component
 * ツール呼び出しの視覚化コンポーネント
 */
function ToolCallVisualization({
  toolCalls,
  locale = 'ja',
}: {
  toolCalls: ToolCallResult[];
  locale?: 'ja' | 'en';
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {toolCalls.map((call, idx) => {
        const config = TOOL_CALL_CONFIG[call.toolName] || TOOL_CALL_CONFIG.default;
        const isSuccess = call.success;

        return (
          <div
            key={`tool-${idx}-${call.toolName}`}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-md text-xs
              ${isSuccess
                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
              }
            `}
            title={call.error || (locale === 'ja' ? config.description : config.descriptionEn)}
          >
            <span>{config.icon}</span>
            <span>{locale === 'ja' ? config.label : config.labelEn}</span>
            {isSuccess ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Streaming Message Indicator Component
 * ストリーミングメッセージインジケーターコンポーネント
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
 * ワークフロー進行状況コンポーネント
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
 * コンテキストに基づくプロンプト表示コンポーネント
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

export function CoachSection({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  onHabitUpdated,
  locale = 'ja',
  useMastra: enableMastra = true,
}: CoachSectionProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ remaining: number; total: number } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mastra agent state
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(0);

  // Context-based prompts
  const contextualPrompts = useMemo(
    () => getContextualPrompts(habits, goals, locale),
    [habits, goals, locale]
  );

  // Get localized quick actions
  const quickActions = locale === 'ja' ? DEFAULT_QUICK_ACTIONS : DEFAULT_QUICK_ACTIONS_EN;
  const quickActionPrompts = locale === 'ja' ? QUICK_ACTION_PROMPTS : QUICK_ACTION_PROMPTS_EN;

  // Level assessment state
  const [levelAssessmentHabit, setLevelAssessmentHabit] = useState<{ id: string; name: string } | null>(null);
  const [levelAssessmentLoading, setLevelAssessmentLoading] = useState(false);

  // Current action state
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [habitModalInitial, setHabitModalInitial] = useState<{
    name?: string;
    date?: string;
    time?: string;
    endTime?: string;
    type?: 'do' | 'avoid';
    goalId?: string;
  } | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [showCoaching, setShowCoaching] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  // Goal modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState<{
    name?: string;
    parentId?: string | null;
  } | undefined>(undefined);
  const [goalSuggestions, setGoalSuggestions] = useState<GoalSuggestion[]>([]);

  // Clear confirmation dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Suggestion history panel
  const [showHistory, setShowHistory] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const openHabitModal = useCallback((data: {
    name?: string;
    type?: 'do' | 'avoid';
    triggerTime?: string | null;
    goalId?: string | null;
  }) => {
    setHabitModalInitial({
      name: data.name || '',
      type: data.type || 'do',
      time: data.triggerTime || undefined,
      goalId: data.goalId || (goals.length > 0 ? goals[0].id : undefined),
    });
    setHabitModalOpen(true);
  }, [goals]);

  const openGoalModal = useCallback((data: {
    name?: string;
    parentId?: string | null;
  }) => {
    setGoalModalInitial({
      name: data.name || '',
      parentId: data.parentId || null,
    });
    setGoalModalOpen(true);
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  // Helper function to save suggestion to history
  const saveSuggestionToHistory = useCallback(async (
    suggestionType: 'habit' | 'goal',
    suggestionData: Record<string, unknown>,
    goalId?: string | null
  ) => {
    if (!apiUrl) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${apiUrl}/api/ai/suggestion-history`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionType,
          suggestionData,
          goalId: goalId || null,
          status: 'pending',
        }),
      });
    } catch (err) {
      console.error('Failed to save suggestion to history:', err);
    }
  }, [apiUrl]);

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

  // Check premium/admin status and get auth token
  useEffect(() => {
    const checkStatus = async () => {
      if (!apiUrl) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        // Store auth token for Mastra agent
        setAuthToken(session.access_token);

        const response = await fetch(`${apiUrl}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const planType = data.subscription?.planType;
          setIsPremium(planType === 'premium_basic' || planType === 'premium_pro');
          setIsPro(planType === 'premium_pro');

          if (data.tokenUsage) {
            setTokenInfo({
              remaining: data.tokenUsage.monthlyQuota - data.tokenUsage.usedQuota,
              total: data.tokenUsage.monthlyQuota,
            });
          }
        }

        // Check admin status
        const adminCheck = await fetch(`${apiUrl}/api/ai/parse-habit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '' }),
        });

        if (adminCheck.status !== 402) {
          setIsAdmin(true);
          setIsPremium(true);
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [apiUrl]);

  // Mastra Agent Hook Integration
  // This provides streaming responses and tool call visualization
  const mastraAgent = useMastraAgent({
    authToken,
    enableStreaming: true,
    systemMessage: locale === 'ja'
      ? 'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'
      : 'You are a habit coach for the VOW app. You help users build better habits.',
    onMessage: useCallback((msg: MastraMessage) => {
      // Process tool calls for visualization
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        setActiveToolCall(null);
      }

      // Update workflow progress on completion
      if (msg.status === 'complete' && workflowSteps.length > 0) {
        setWorkflowSteps(prev => prev.map((step, idx) =>
          idx === currentWorkflowStep
            ? { ...step, status: 'completed' }
            : step
        ));
        setCurrentWorkflowStep(prev => Math.min(prev + 1, workflowSteps.length - 1));
      }
    }, [workflowSteps.length, currentWorkflowStep]),
    onError: useCallback((err: Error) => {
      setError(err.message);
      setActiveToolCall(null);
      // Mark current workflow step as error
      if (workflowSteps.length > 0) {
        setWorkflowSteps(prev => prev.map((step, idx) =>
          idx === currentWorkflowStep
            ? { ...step, status: 'error' }
            : step
        ));
      }
    }, [workflowSteps.length, currentWorkflowStep]),
  });

  // Sync Mastra messages to local messages state when using Mastra
  useEffect(() => {
    if (!enableMastra) return;

    // Convert Mastra messages to local Message format
    const convertedMessages: Message[] = mastraAgent.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp || new Date(),
        data: m.toolCalls ? { toolCalls: m.toolCalls } : undefined,
      }));

    if (convertedMessages.length > 0) {
      setMessages(convertedMessages);
    }
  }, [enableMastra, mastraAgent.messages]);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, intent?: DetectedIntent, data?: unknown, uiComponents?: UIComponentData[]) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
      intent,
      data,
      uiComponents,
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const handleHabitCreated = useCallback((payload: { name: string }) => {
    addMessage('assistant', `✅ 「${payload.name}」を作成しました！他に追加したい習慣はありますか？`);
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    onHabitCreated?.();
  }, [addMessage, onHabitCreated]);

  const handleGoalCreated = useCallback((payload: { name: string }) => {
    addMessage('assistant', `✅ ゴール「${payload.name}」を作成しました！このゴールに向けた習慣を追加しますか？`);
    setGoalModalOpen(false);
    setGoalModalInitial(undefined);
    setGoalSuggestions([]);
    onGoalCreated?.();
  }, [addMessage, onGoalCreated]);

  // Level assessment handlers
  const handleStartLevelAssessment = useCallback(() => {
    // 未完了の習慣を優先、レベル未設定の習慣を優先
    const unassessedHabits = (habits || [])
      .filter(h => h.level === null || h.level === undefined)
      .sort((a, b) => {
        // 未完了を優先
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return 0;
      });

    if (unassessedHabits.length === 0) {
      addMessage('assistant', 'すべての習慣にレベルが設定されています。特定の習慣のレベルを再設定したい場合は、その習慣名を教えてください。');
      return;
    }

    const firstHabit = unassessedHabits[0];
    setLevelAssessmentHabit({ id: firstHabit.id, name: firstHabit.name });
    addMessage('assistant', `「${firstHabit.name}」のレベルを設定しましょう。以下のスライダーで各観点を評価してください。`, 'level_assessment');
  }, [habits, addMessage]);

  const handleLevelAssessmentSubmit = useCallback(async (habitId: string, variables: LevelVariables, level: number) => {
    setLevelAssessmentLoading(true);
    try {
      if (!supabase) {
        addMessage('assistant', 'Supabaseが初期化されていません。');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        addMessage('assistant', '認証が必要です。ログインしてください。');
        return;
      }

      // Calculate tier
      const tier = level < 50 ? 'beginner' : level < 100 ? 'intermediate' : level < 150 ? 'advanced' : 'expert';
      const now = new Date().toISOString();

      // Update habit level directly via Supabase
      // Note: level_tier is auto-calculated by database trigger, but we set it explicitly for consistency
      const { error } = await supabase
        .from('habits')
        .update({
          level,
          level_tier: tier,
          level_assessed_at: now,
          level_assessment_raw: {
            assessmentType: 'manual_slider',
            variables,
            level,
            tier,
            assessedAt: now,
          },
          updated_at: now,
        })
        .eq('id', habitId)
        .eq('owner_id', session.user.id);

      if (error) {
        throw new Error(`レベルの保存に失敗しました: ${error.message}`);
      }

      // Record in level_history
      await supabase.from('level_history').insert({
        habit_id: habitId,
        user_id: session.user.id,
        old_level: null,
        new_level: level,
        change_reason: 'manual_adjustment',
        workload_delta: variables,
      });

      const habitName = levelAssessmentHabit?.name || '習慣';
      const tierLabel = tier === 'beginner' ? '初級' : tier === 'intermediate' ? '中級' : tier === 'advanced' ? '上級' : '達人';
      addMessage('assistant', `✅ 「${habitName}」のレベルを Lv. ${level} (${tierLabel}) に設定しました！`);
      
      setLevelAssessmentHabit(null);
      onHabitUpdated?.();

      // 次の未設定習慣があれば提案
      const remainingUnassessed = (habits || [])
        .filter(h => h.id !== habitId && (h.level === null || h.level === undefined));
      
      if (remainingUnassessed.length > 0) {
        addMessage('assistant', `まだ ${remainingUnassessed.length} 件の習慣にレベルが設定されていません。続けて設定しますか？`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'エラーが発生しました';
      addMessage('assistant', `エラー: ${errorMsg}`);
    } finally {
      setLevelAssessmentLoading(false);
    }
  }, [levelAssessmentHabit, habits, addMessage, onHabitUpdated]);

  const handleLevelAssessmentCancel = useCallback(() => {
    setLevelAssessmentHabit(null);
    addMessage('assistant', 'レベル設定をキャンセルしました。他に何かお手伝いできることはありますか？');
  }, [addMessage]);


  // Main AI chat handler
  const handleAIChat = useCallback(async (token: string, userInput: string) => {
    const conversationHistory = messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch(`${apiUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userInput,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'AI処理に失敗しました');
    }

    const data = await response.json();
    const uiComponents: UIComponentData[] = data.data?.uiComponents || [];

    addMessage('assistant', data.response, null, data, uiComponents);

    // Handle structured data from AI tools
    if (data.data?.parsedHabit) {
      // 単一の習慣提案も候補リストとして表示（即座にモーダルを開かない）
      const habit = data.data.parsedHabit;
      const suggestionList: HabitSuggestion[] = [{
        name: habit.name || '',
        type: habit.type === 'avoid' ? 'avoid' : 'do',
        frequency: habit.frequency || 'daily',
        suggestedTargetCount: habit.targetCount || habit.suggestedTargetCount || 1,
        workloadUnit: habit.workloadUnit || null,
        reason: habit.reason || '',
        confidence: habit.confidence || 0.8,
        triggerTime: habit.triggerTime || null,
        duration: habit.duration || null,
      }];
      setSuggestions(suggestionList);
      // 履歴に保存
      saveSuggestionToHistory('habit', habit, selectedGoalId || null);
    }

    if (data.data?.habitSuggestions?.length > 0) {
      const suggestionList: HabitSuggestion[] = data.data.habitSuggestions.map((s: Record<string, unknown>) => ({
        name: s.name || '',
        type: s.type === 'avoid' ? 'avoid' : 'do',
        frequency: s.frequency || 'daily',
        suggestedTargetCount: s.suggestedTargetCount || 1,
        workloadUnit: s.workloadUnit || null,
        reason: s.reason || '',
        confidence: s.confidence || 0.8,
        triggerTime: s.triggerTime || null,
        duration: s.duration || null,
      }));
      setSuggestions(suggestionList);
      // 各提案を履歴に保存
      for (const s of data.data.habitSuggestions) {
        saveSuggestionToHistory('habit', s as Record<string, unknown>, selectedGoalId || null);
      }
    }

    if (data.data?.parsedGoal) {
      // 単一のゴール提案も候補リストとして表示（即座にモーダルを開かない）
      const goal = data.data.parsedGoal;
      const goalList: GoalSuggestion[] = [{
        name: goal.name || '',
        description: goal.description || '',
        icon: goal.icon || '🎯',
        reason: goal.reason || '',
        suggestedHabits: goal.suggestedHabits || [],
      }];
      setGoalSuggestions(goalList);
      // 履歴に保存
      saveSuggestionToHistory('goal', goal);
    }

    if (data.data?.goalSuggestions?.length > 0) {
      const goalList: GoalSuggestion[] = data.data.goalSuggestions.map((g: Record<string, unknown>) => ({
        name: g.name || '',
        description: g.description || '',
        icon: g.icon || '🎯',
        reason: g.reason || '',
        suggestedHabits: g.suggestedHabits || [],
      }));
      setGoalSuggestions(goalList);
      // 各提案を履歴に保存
      for (const g of data.data.goalSuggestions) {
        saveSuggestionToHistory('goal', g as Record<string, unknown>);
      }
    }

    if (data.remainingTokens !== undefined) {
      setTokenInfo(prev => prev ? { ...prev, remaining: data.remainingTokens } : null);
    }
  }, [apiUrl, messages, addMessage, saveSuggestionToHistory, selectedGoalId]);

  const handleProcess = async () => {
    if (!input.trim() || !apiUrl) return;

    const userInput = input.trim();
    setInput('');
    setError(null);

    // Use Mastra agent if enabled
    if (enableMastra && authToken) {
      setProcessing(true);
      setActiveToolCall('default'); // Show generic processing indicator

      // Initialize workflow steps for complex operations
      if (userInput.includes('習慣') || userInput.includes('habit')) {
        setWorkflowSteps([
          { id: 'analyze', label: '解析', labelEn: 'Analyze', status: 'pending' },
          { id: 'process', label: '処理', labelEn: 'Process', status: 'pending' },
          { id: 'respond', label: '応答', labelEn: 'Respond', status: 'pending' },
        ]);
        setCurrentWorkflowStep(0);
        setWorkflowSteps(prev => prev.map((step, idx) =>
          idx === 0 ? { ...step, status: 'active' } : step
        ));
      }

      try {
        await mastraAgent.sendMessage(userInput);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : locale === 'ja' ? 'エラーが発生しました' : 'An error occurred';
        setError(errorMsg);
      } finally {
        setProcessing(false);
        setActiveToolCall(null);
        setWorkflowSteps([]);
        setCurrentWorkflowStep(0);
      }
      return;
    }

    // Fallback to legacy API
    setProcessing(true);
    addMessage('user', userInput);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const errMsg = locale === 'ja' ? '認証が必要です' : 'Authentication required';
        setError(errMsg);
        addMessage('assistant', locale === 'ja' ? '認証が必要です。ログインしてください。' : 'Authentication required. Please log in.');
        return;
      }

      await handleAIChat(session.access_token, userInput);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : locale === 'ja' ? 'エラーが発生しました' : 'An error occurred';
      setError(errorMsg);
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleChoiceSelect = useCallback(async (choice: Choice) => {
    const userMessage = choice.description 
      ? `${choice.label}を選択しました: ${choice.description}`
      : `${choice.label}を選択しました`;
    
    setInput('');
    setProcessing(true);
    addMessage('user', userMessage);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        addMessage('assistant', '認証が必要です。ログインしてください。');
        return;
      }

      await handleAIChat(session.access_token, userMessage);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMsg);
      addMessage('assistant', `エラー: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [addMessage, handleAIChat]);

  const handleQuickAction = useCallback(async (choice: Choice) => {
    const prompt = quickActionPrompts[choice.id];
    if (!prompt || !apiUrl) return;

    // Level assessment action is handled specially
    if (choice.id === 'assess-level') {
      addMessage('user', prompt);
      handleStartLevelAssessment();
      return;
    }

    setInput('');
    setError(null);

    // Use Mastra agent if enabled
    if (enableMastra && authToken) {
      setProcessing(true);
      setActiveToolCall('default');
      try {
        await mastraAgent.sendMessage(prompt);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : locale === 'ja' ? 'エラーが発生しました' : 'An error occurred';
        setError(errorMsg);
      } finally {
        setProcessing(false);
        setActiveToolCall(null);
      }
      return;
    }

    // Fallback to legacy API
    setProcessing(true);
    addMessage('user', prompt);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const errMsg = locale === 'ja' ? '認証が必要です' : 'Authentication required';
        setError(errMsg);
        addMessage('assistant', locale === 'ja' ? '認証が必要です。ログインしてください。' : 'Authentication required. Please log in.');
        return;
      }

      await handleAIChat(session.access_token, prompt);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : locale === 'ja' ? 'エラーが発生しました' : 'An error occurred';
      setError(errorMsg);
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [apiUrl, addMessage, handleAIChat, handleStartLevelAssessment, enableMastra, authToken, mastraAgent, quickActionPrompts, locale]);

  // Handler for contextual prompt selection
  const handleContextualPromptSelect = useCallback((prompt: Choice) => {
    // Convert contextual prompt to input and process
    const promptText = prompt.description || prompt.label;
    setInput(promptText);
    // Trigger processing after a brief delay to show the input
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleProcess();
    }, 100);
  }, [handleProcess]);

  const handleClearConversation = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    setMessages([]);
    // Also clear Mastra messages if enabled
    if (enableMastra) {
      mastraAgent.clearMessages();
    }
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    setGoalModalOpen(false);
    setGoalModalInitial(undefined);
    setSuggestions([]);
    setGoalSuggestions([]);
    setShowCoaching(false);
    setError(null);
    setShowClearConfirm(false);
    setActiveToolCall(null);
    setWorkflowSteps([]);
    setCurrentWorkflowStep(0);
  };

  const handleSelectSuggestion = (suggestion: HabitSuggestion) => {
    openHabitModal({
      name: suggestion.name,
      type: suggestion.type,
      triggerTime: suggestion.triggerTime || null,
      goalId: selectedGoalId || (goals.length > 0 ? goals[0].id : null),
    });
    setSuggestions([]);
    addMessage('assistant', `「${suggestion.name}」を選択しました。モーダルで詳細を編集してください。`);
  };

  const hasAccess = isPremium || isAdmin;

  if (loading) {
    return (
      <section className="flex flex-col h-full min-h-[500px] bg-card border border-border rounded-lg">
        <div className="animate-pulse p-4">
          <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </section>
    );
  }


  return (
    <section className="relative flex flex-col h-full bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🤖</span>
          <span>AI Coach</span>
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              Admin
            </span>
          )}
          {/* Mastra Connection Indicator */}
          {enableMastra && (
            <span
              className={`w-2 h-2 rounded-full ${
                mastraAgent.connectionState === 'streaming'
                  ? 'bg-green-500 animate-pulse'
                  : mastraAgent.connectionState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : mastraAgent.connectionState === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-400'
              }`}
              title={
                mastraAgent.connectionState === 'streaming'
                  ? locale === 'ja' ? 'ストリーミング中' : 'Streaming'
                  : mastraAgent.connectionState === 'connecting'
                  ? locale === 'ja' ? '接続中' : 'Connecting'
                  : mastraAgent.connectionState === 'error'
                  ? locale === 'ja' ? 'エラー' : 'Error'
                  : locale === 'ja' ? '待機中' : 'Idle'
              }
            />
          )}
        </h2>
        <div className="flex items-center gap-3">
          {hasAccess && tokenInfo && (
            <div className="text-xs text-muted-foreground">
              {locale === 'ja' ? '残り' : 'Remaining'}: ~{Math.floor(tokenInfo.remaining / 1000)}{locale === 'ja' ? '回' : ' calls'}
            </div>
          )}
          {(isPro || isAdmin) && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                showHistory
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={locale === 'ja' ? 'AI提案履歴' : 'AI Suggestion History'}
            >
              <span>📋</span>
              <span className="hidden sm:inline">{locale === 'ja' ? '履歴' : 'History'}</span>
            </button>
          )}
          {/* Cancel streaming button */}
          {enableMastra && mastraAgent.isStreaming && (
            <button
              onClick={() => mastraAgent.cancelStream()}
              className="text-xs px-2 py-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title={locale === 'ja' ? 'キャンセル' : 'Cancel'}
            >
              {locale === 'ja' ? '停止' : 'Stop'}
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearConversation}
              className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              {locale === 'ja' ? 'クリア' : 'Clear'}
            </button>
          )}
        </div>
      </header>

      {!hasAccess ? (
        <UpgradePrompt />
      ) : showHistory ? (
        /* Suggestion History Panel */
        <div className="flex-1 overflow-y-auto p-4">
          <SuggestionHistory
            onClose={() => setShowHistory(false)}
            onSelectSuggestion={(suggestion) => {
              if (suggestion.suggestionType === 'habit') {
                openHabitModal({
                  name: suggestion.suggestionData.name || '',
                  type: suggestion.suggestionData.type || 'do',
                  triggerTime: null,
                  goalId: suggestion.goalId || (goals.length > 0 ? goals[0].id : null),
                });
              } else {
                openGoalModal({
                  name: suggestion.suggestionData.name || '',
                  parentId: null,
                });
              }
              setShowHistory(false);
              addMessage('assistant', `履歴から「${suggestion.suggestionData.name}」を選択しました。モーダルで詳細を編集してください。`);
            }}
          />
        </div>
      ) : (
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
                          {msg.content}
                          {/* Tool Call Visualization for assistant messages */}
                          {msg.role === 'assistant' && toolCalls && toolCalls.length > 0 && (
                            <ToolCallVisualization toolCalls={toolCalls} locale={locale} />
                          )}
                        </div>
                      </div>
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
                {levelAssessmentHabit && (
                  <div className="mt-4">
                    <LevelAssessmentSliders
                      habitId={levelAssessmentHabit.id}
                      habitName={levelAssessmentHabit.name}
                      initialValues={(levelAssessmentHabit as any).levelAssessmentRaw?.variables}
                      onSubmit={handleLevelAssessmentSubmit}
                      onCancel={handleLevelAssessmentCancel}
                      isLoading={levelAssessmentLoading}
                    />
                  </div>
                )}

                {/* Streaming/Processing indicator */}
                {(processing || mastraAgent.isStreaming) && (
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
                {enableMastra && mastraAgent.error && (
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
            {suggestions.length > 0 && (
              <SuggestionsView
                suggestions={suggestions}
                onClose={() => setSuggestions([])}
                onSelect={handleSelectSuggestion}
              />
            )}

            {/* Goal Suggestions */}
            {goalSuggestions.length > 0 && (
              <GoalSuggestionsView
                suggestions={goalSuggestions}
                onClose={() => setGoalSuggestions([])}
                onSelect={(suggestion) => {
                  openGoalModal({ name: suggestion.name });
                  setGoalSuggestions([]);
                  addMessage('assistant', `「${suggestion.name}」を選択しました。モーダルで詳細を編集してください。`);
                }}
              />
            )}

            {/* Coaching Widget */}
            {showCoaching && (
              <div className="space-y-4 mt-4">
                <CoachingWidget onProposalApplied={onHabitCreated} />
                <button
                  onClick={() => {
                    setShowCoaching(false);
                    addMessage('assistant', 'コーチングを閉じました。他に何かお手伝いできることはありますか？');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  閉じる
                </button>
              </div>
            )}
          </div>

          {/* Goal Selector - fixed above input */}
          {goals.length > 1 && (
            <div className="absolute bottom-24 md:bottom-20 left-0 right-0 px-4 py-2 bg-muted/30 border-t border-border">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">
                  {locale === 'ja' ? '提案対象ゴール:' : 'Target Goal:'}
                </label>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
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
                <button
                  onClick={() => setError(null)}
                  className="text-destructive/70 hover:text-destructive"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
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
                disabled={processing || mastraAgent.isStreaming}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleProcess();
                  }
                }}
              />
              <button
                onClick={handleProcess}
                disabled={processing || mastraAgent.isStreaming || !input.trim()}
                className="px-4 md:px-6 py-2 md:py-3 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {processing || mastraAgent.isStreaming ? '...' : locale === 'ja' ? '送信' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <HabitModal
        open={habitModalOpen}
        onClose={() => {
          setHabitModalOpen(false);
          setHabitModalInitial(undefined);
          addMessage('assistant', 'キャンセルしました。他に何かお手伝いできることはありますか？');
        }}
        habit={null}
        onCreate={handleHabitCreated}
        initial={habitModalInitial}
        categories={goals}
      />

      <GoalModal
        open={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setGoalModalInitial(undefined);
          addMessage('assistant', 'キャンセルしました。他に何かお手伝いできることはありますか？');
        }}
        goal={null}
        onCreate={handleGoalCreated}
        initial={goalModalInitial}
        goals={goals}
        habits={habits}
      />

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4 shadow-lg">
            <h3 className="font-semibold mb-2">会話をクリアしますか？</h3>
            <p className="text-sm text-muted-foreground mb-4">
              すべての会話履歴が削除されます。この操作は取り消せません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmClear}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                クリア
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


// Suggestions View
function SuggestionsView({
  suggestions,
  onClose,
  onSelect,
}: {
  suggestions: HabitSuggestion[];
  onClose: () => void;
  onSelect: (suggestion: HabitSuggestion) => void;
}) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">提案された習慣</h4>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          閉じる
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
              <span className="text-muted-foreground text-xs block">頻度</span>
              <span>{suggestion.frequency === 'daily' ? '毎日' : suggestion.frequency === 'weekly' ? '毎週' : '毎月'}</span>
            </div>
            <div className="bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground text-xs block">目標</span>
              <span>{suggestion.suggestedTargetCount}{suggestion.workloadUnit || '回'}</span>
            </div>
            <div className="bg-background/50 rounded px-2 py-1">
              <span className="text-muted-foreground text-xs block">信頼度</span>
              <span>{Math.round(suggestion.confidence * 100)}%</span>
            </div>
          </div>
          {suggestion.reason && (
            <p className="text-sm text-muted-foreground mt-3 italic">💡 {suggestion.reason}</p>
          )}
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            <span>クリックして詳細を編集</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </p>
        </div>
      ))}
    </div>
  );
}

// Goal Suggestions View
function GoalSuggestionsView({
  suggestions,
  onClose,
  onSelect,
}: {
  suggestions: GoalSuggestion[];
  onClose: () => void;
  onSelect: (suggestion: GoalSuggestion) => void;
}) {
  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">提案されたゴール</h4>
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
          閉じる
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
              <span className="font-medium">関連する習慣例:</span>
              <span className="ml-1">{suggestion.suggestedHabits.slice(0, 3).join('、')}</span>
            </div>
          )}
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            <span>クリックして作成</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </p>
        </div>
      ))}
    </div>
  );
}

// UI Component Renderer
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

// Upgrade Prompt
function UpgradePrompt() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-medium mb-2">AI Coach機能はPremiumプランで利用可能</h3>
        <p className="text-sm text-muted-foreground mb-4">
          自然言語での習慣入力、AI編集、習慣提案などの機能をご利用いただけます。
        </p>
        <a
          href="/settings/subscription"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          プランを見る
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export default CoachSection;
