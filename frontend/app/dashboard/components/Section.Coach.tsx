'use client';

/**
 * Section.Coach.tsx - AI Coach Section Wrapper
 *
 * This component wraps View.CoachMode to provide a complete Coach section
 * with header, state management, and modals.
 *
 * For embedding coach functionality without header/footer,
 * use View.CoachMode directly.
 *
 * Features:
 * - Premium/Admin access control
 * - Mastra agent integration
 * - Habit and Goal modals
 * - Suggestion history
 * - Level assessment
 * - Conversation state management
 *
 * Requirements: Premium subscription features
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { HabitModal } from './Modal.Habit';
import { GoalModal } from './Modal.Goal';
import { useMastraAgent, type MastraMessage } from '../hooks/useMastraAgent';
import type { ToolCallResult } from '../../../lib/mastra/config';
import {
  CoachModeView,
  type CoachModeViewProps,
  type Goal,
  type Habit,
  type Message,
  type UIComponentData,
  type DetectedIntent,
  type HabitSuggestion,
  type GoalSuggestion,
  type WorkflowStep,
} from './View.CoachMode';
import type { Choice } from './Widget.ChoiceButtons';
import type { LevelVariables } from './Widget.LevelAssessmentSliders';

// Re-export types for backward compatibility
export type {
  Goal,
  Habit,
  Message,
  UIComponentData,
  DetectedIntent,
  HabitSuggestion,
  GoalSuggestion,
  WorkflowStep,
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Quick action ID to prompt mapping
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

// ============================================================================
// Types
// ============================================================================

interface CoachSectionProps {
  goals: Goal[];
  habits?: Habit[];
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
  onHabitUpdated?: () => void;
  /** Language preference */
  locale?: 'ja' | 'en';
  /** Enable Mastra agent integration (default: true) */
  useMastra?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function CoachSection({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  onHabitUpdated,
  locale = 'ja',
  useMastra: enableMastra = true,
}: CoachSectionProps) {
  // Access control state
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ remaining: number; total: number } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mastra agent state
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState(0);

  // Quick action prompts
  const quickActionPrompts = locale === 'ja' ? QUICK_ACTION_PROMPTS : QUICK_ACTION_PROMPTS_EN;

  // Level assessment state
  const [levelAssessmentHabit, setLevelAssessmentHabit] = useState<{ id: string; name: string } | null>(null);
  const [levelAssessmentLoading, setLevelAssessmentLoading] = useState(false);

  // Modal state
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [habitModalInitial, setHabitModalInitial] = useState<{
    name?: string;
    date?: string;
    time?: string;
    endTime?: string;
    type?: 'do' | 'avoid';
    goalId?: string;
  } | undefined>(undefined);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState<{
    name?: string;
    parentId?: string | null;
  } | undefined>(undefined);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [goalSuggestions, setGoalSuggestions] = useState<GoalSuggestion[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  // UI state
  const [showCoaching, setShowCoaching] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  // ============================================================================
  // Callbacks
  // ============================================================================

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

  // ============================================================================
  // Effects
  // ============================================================================

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

  // Extract suggestions from Mastra toolCalls when message is complete
  useEffect(() => {
    if (!enableMastra) return;

    // Find the latest complete assistant message with toolCalls
    const latestAssistantMsg = mastraAgent.messages
      .filter(m => m.role === 'assistant' && m.status === 'complete' && m.toolCalls?.length)
      .pop();

    if (!latestAssistantMsg?.toolCalls) return;

    // Debug: Log all toolCalls for debugging
    console.log('[Section.Coach] Processing toolCalls:', {
      messageId: latestAssistantMsg.id,
      toolCallCount: latestAssistantMsg.toolCalls.length,
      toolNames: latestAssistantMsg.toolCalls.map(tc => tc.toolName),
      toolCalls: latestAssistantMsg.toolCalls.map(tc => ({
        toolName: tc.toolName,
        hasOutput: !!tc.output,
        outputKeys: tc.output && typeof tc.output === 'object' ? Object.keys(tc.output as object) : [],
        outputPreview: tc.output ? JSON.stringify(tc.output).slice(0, 200) : null,
      })),
    });

    // Process toolCalls to extract suggestions
    for (const tc of latestAssistantMsg.toolCalls) {
      const output = tc.output as Record<string, unknown> | null;
      if (!output) continue;

      // Debug: Log each tool call processing
      console.log('[Section.Coach] Processing tool:', {
        toolName: tc.toolName,
        hasSuggestions: 'suggestions' in output,
        hasHabit: 'habit' in output,
        outputKeys: Object.keys(output),
      });

      // Handle suggest_habits tool
      if (tc.toolName === 'suggest_habits' && output.suggestions) {
        const rawSuggestions = output.suggestions as Array<Record<string, unknown>>;
        const habitSuggestions: HabitSuggestion[] = rawSuggestions.map(s => {
          // Parse duration from estimatedTime - can be number or string like "5分"
          let durationNum: number | null = null;
          if (typeof s.duration === 'number') {
            durationNum = s.duration;
          } else if (typeof s.duration === 'string') {
            const parsed = parseInt(s.duration, 10);
            if (!isNaN(parsed)) durationNum = parsed;
          } else if (typeof s.estimatedTime === 'string') {
            const parsed = parseInt(s.estimatedTime, 10);
            if (!isNaN(parsed)) durationNum = parsed;
          }

          // Map backend frequency to frontend format
          let frequency: 'daily' | 'weekly' | 'monthly' = 'daily';
          const backendFreq = s.frequency as string;
          if (backendFreq === 'weekly' || backendFreq === '3x/week') {
            frequency = 'weekly';
          } else if (backendFreq === 'monthly') {
            frequency = 'monthly';
          }

          return {
            name: (s.name as string) || '',
            // Backend doesn't have type, default to 'do' for good habits
            type: (s.type as 'do' | 'avoid') || (s.suggestionType === 'habit' ? 'do' : 'do'),
            frequency,
            suggestedTargetCount: (s.suggestedTargetCount as number) || (s.targetCount as number) || 1,
            workloadUnit: (s.workloadUnit as string) || null,
            // Backend uses 'rationale' not 'reason', also check 'description'
            reason: (s.rationale as string) || (s.reason as string) || (s.description as string) || (s.stackingTip as string) || '',
            confidence: (s.confidence as number) || 0.8,
            triggerTime: (s.triggerTime as string) || null,
            duration: durationNum,
          };
        });
        if (habitSuggestions.length > 0) {
          console.log('[Section.Coach] Setting habit suggestions:', {
            count: habitSuggestions.length,
            suggestions: habitSuggestions,
          });
          setSuggestions(habitSuggestions);
          // Save to history
          for (const s of habitSuggestions) {
            saveSuggestionToHistory('habit', s as unknown as Record<string, unknown>, selectedGoalId || null);
          }
        }
      }

      // Handle parse_habit tool (single habit parsing)
      if (tc.toolName === 'parse_habit' && output.habit) {
        const habit = output.habit as Record<string, unknown>;
        // Parse duration
        let durationNum: number | null = null;
        if (typeof habit.duration === 'number') {
          durationNum = habit.duration;
        } else if (typeof habit.duration === 'string') {
          const parsed = parseInt(habit.duration, 10);
          if (!isNaN(parsed)) durationNum = parsed;
        }
        const habitSuggestions: HabitSuggestion[] = [{
          name: (habit.name as string) || '',
          type: (habit.type as 'do' | 'avoid') || 'do',
          frequency: (habit.frequency as 'daily' | 'weekly' | 'monthly') || 'daily',
          suggestedTargetCount: (habit.targetCount as number) || (habit.suggestedTargetCount as number) || 1,
          workloadUnit: (habit.workloadUnit as string) || null,
          reason: (habit.reason as string) || '',
          confidence: (habit.confidence as number) || 0.8,
          triggerTime: (habit.triggerTime as string) || null,
          duration: durationNum,
        }];
        setSuggestions(habitSuggestions);
        saveSuggestionToHistory('habit', habit, selectedGoalId || null);
      }

      // Handle suggest_goals tool
      if (tc.toolName === 'suggest_goals' && output.suggestions) {
        const rawGoals = output.suggestions as Array<Record<string, unknown>>;
        const goalList: GoalSuggestion[] = rawGoals.map(g => ({
          name: (g.name as string) || '',
          description: (g.description as string) || '',
          icon: (g.icon as string) || '🎯',
          reason: (g.reason as string) || '',
          suggestedHabits: (g.suggestedHabits as string[]) || [],
        }));
        if (goalList.length > 0) {
          setGoalSuggestions(goalList);
          for (const g of goalList) {
            saveSuggestionToHistory('goal', g as unknown as Record<string, unknown>);
          }
        }
      }
    }
  }, [enableMastra, mastraAgent.messages, saveSuggestionToHistory, selectedGoalId]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleHabitCreated = useCallback((payload: { name: string }) => {
    addMessage('assistant', `✅ 「${payload.name}」${locale === 'ja' ? 'を作成しました！他に追加したい習慣はありますか？' : ' created! Want to add more habits?'}`);
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    onHabitCreated?.();
  }, [addMessage, onHabitCreated, locale]);

  const handleGoalCreated = useCallback((payload: { name: string }) => {
    addMessage('assistant', `✅ ${locale === 'ja' ? 'ゴール' : 'Goal'} 「${payload.name}」${locale === 'ja' ? 'を作成しました！このゴールに向けた習慣を追加しますか？' : ' created! Want to add habits for this goal?'}`);
    setGoalModalOpen(false);
    setGoalModalInitial(undefined);
    setGoalSuggestions([]);
    onGoalCreated?.();
  }, [addMessage, onGoalCreated, locale]);

  // Level assessment handlers
  const handleStartLevelAssessment = useCallback(() => {
    // Prioritize unassessed habits, prioritize incomplete habits
    const unassessedHabits = (habits || [])
      .filter(h => h.level === null || h.level === undefined)
      .sort((a, b) => {
        // Prioritize incomplete
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return 0;
      });

    if (unassessedHabits.length === 0) {
      addMessage('assistant', locale === 'ja'
        ? 'すべての習慣にレベルが設定されています。特定の習慣のレベルを再設定したい場合は、その習慣名を教えてください。'
        : 'All habits have levels set. If you want to reset a specific habit\'s level, please tell me the habit name.');
      return;
    }

    const firstHabit = unassessedHabits[0];
    setLevelAssessmentHabit({ id: firstHabit.id, name: firstHabit.name });
    addMessage('assistant', `「${firstHabit.name}」${locale === 'ja' ? 'のレベルを設定しましょう。以下のスライダーで各観点を評価してください。' : ' - Let\'s set the level. Please evaluate each aspect using the sliders below.'}`, 'level_assessment');
  }, [habits, addMessage, locale]);

  const handleLevelAssessmentSubmit = useCallback(async (habitId: string, variables: LevelVariables, level: number) => {
    setLevelAssessmentLoading(true);
    try {
      if (!supabase) {
        addMessage('assistant', locale === 'ja' ? 'Supabaseが初期化されていません。' : 'Supabase is not initialized.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        addMessage('assistant', locale === 'ja' ? '認証が必要です。ログインしてください。' : 'Authentication required. Please log in.');
        return;
      }

      // Calculate tier
      const tier = level < 50 ? 'beginner' : level < 100 ? 'intermediate' : level < 150 ? 'advanced' : 'expert';
      const now = new Date().toISOString();

      // Update habit level directly via Supabase
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
        throw new Error(`${locale === 'ja' ? 'レベルの保存に失敗しました' : 'Failed to save level'}: ${error.message}`);
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

      const habitName = levelAssessmentHabit?.name || (locale === 'ja' ? '習慣' : 'Habit');
      const tierLabel = locale === 'ja'
        ? (tier === 'beginner' ? '初級' : tier === 'intermediate' ? '中級' : tier === 'advanced' ? '上級' : '達人')
        : (tier === 'beginner' ? 'Beginner' : tier === 'intermediate' ? 'Intermediate' : tier === 'advanced' ? 'Advanced' : 'Expert');
      addMessage('assistant', `✅ 「${habitName}」${locale === 'ja' ? 'のレベルを' : ' level set to'} Lv. ${level} (${tierLabel})${locale === 'ja' ? 'に設定しました！' : '!'}`);

      setLevelAssessmentHabit(null);
      onHabitUpdated?.();

      // Suggest next unassessed habit if any
      const remainingUnassessed = (habits || [])
        .filter(h => h.id !== habitId && (h.level === null || h.level === undefined));

      if (remainingUnassessed.length > 0) {
        addMessage('assistant', locale === 'ja'
          ? `まだ ${remainingUnassessed.length} 件の習慣にレベルが設定されていません。続けて設定しますか？`
          : `There are still ${remainingUnassessed.length} habits without levels. Continue setting?`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setLevelAssessmentLoading(false);
    }
  }, [levelAssessmentHabit, habits, addMessage, onHabitUpdated, locale]);

  const handleLevelAssessmentCancel = useCallback(() => {
    setLevelAssessmentHabit(null);
    addMessage('assistant', locale === 'ja'
      ? 'レベル設定をキャンセルしました。他に何かお手伝いできることはありますか？'
      : 'Level setting cancelled. Is there anything else I can help with?');
  }, [addMessage, locale]);

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
      throw new Error(data.message || (locale === 'ja' ? 'AI処理に失敗しました' : 'AI processing failed'));
    }

    const data = await response.json();
    const uiComponents: UIComponentData[] = data.data?.uiComponents || [];

    addMessage('assistant', data.response, null, data, uiComponents);

    // Handle structured data from AI tools
    if (data.data?.parsedHabit) {
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
      for (const s of data.data.habitSuggestions) {
        saveSuggestionToHistory('habit', s as Record<string, unknown>, selectedGoalId || null);
      }
    }

    if (data.data?.parsedGoal) {
      const goal = data.data.parsedGoal;
      const goalList: GoalSuggestion[] = [{
        name: goal.name || '',
        description: goal.description || '',
        icon: goal.icon || '🎯',
        reason: goal.reason || '',
        suggestedHabits: goal.suggestedHabits || [],
      }];
      setGoalSuggestions(goalList);
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
      for (const g of data.data.goalSuggestions) {
        saveSuggestionToHistory('goal', g as Record<string, unknown>);
      }
    }

    if (data.remainingTokens !== undefined) {
      setTokenInfo(prev => prev ? { ...prev, remaining: data.remainingTokens } : null);
    }
  }, [apiUrl, messages, addMessage, saveSuggestionToHistory, selectedGoalId, locale]);

  // Send message handler
  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || !apiUrl) return;

    setError(null);

    // Use Mastra agent if enabled
    if (enableMastra && authToken) {
      setProcessing(true);
      setActiveToolCall('default');

      // Initialize workflow steps for complex operations
      if (userInput.includes(locale === 'ja' ? '習慣' : 'habit')) {
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
        const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
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
      const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
      setError(errorMsg);
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [apiUrl, enableMastra, authToken, mastraAgent, addMessage, handleAIChat, locale]);

  // Quick action handler
  const handleQuickAction = useCallback(async (choice: Choice) => {
    const prompt = quickActionPrompts[choice.id];
    if (!prompt || !apiUrl) return;

    // Level assessment action is handled specially
    if (choice.id === 'assess-level') {
      addMessage('user', prompt);
      handleStartLevelAssessment();
      return;
    }

    setError(null);

    // Use Mastra agent if enabled
    if (enableMastra && authToken) {
      setProcessing(true);
      setActiveToolCall('default');
      try {
        await mastraAgent.sendMessage(prompt);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
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
      const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
      setError(errorMsg);
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [apiUrl, addMessage, handleAIChat, handleStartLevelAssessment, enableMastra, authToken, mastraAgent, quickActionPrompts, locale]);

  // Choice selection handler
  const handleChoiceSelect = useCallback(async (choice: Choice) => {
    const userMessage = choice.description
      ? `${choice.label}${locale === 'ja' ? 'を選択しました: ' : ' selected: '}${choice.description}`
      : `${choice.label}${locale === 'ja' ? 'を選択しました' : ' selected'}`;

    setProcessing(true);
    addMessage('user', userMessage);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError(locale === 'ja' ? '認証が必要です' : 'Authentication required');
        addMessage('assistant', locale === 'ja' ? '認証が必要です。ログインしてください。' : 'Authentication required. Please log in.');
        return;
      }

      await handleAIChat(session.access_token, userMessage);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred');
      setError(errorMsg);
      addMessage('assistant', `${locale === 'ja' ? 'エラー' : 'Error'}: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [addMessage, handleAIChat, locale]);

  // Contextual prompt handler
  const handleContextualPromptSelect = useCallback((prompt: Choice) => {
    const promptText = prompt.description || prompt.label;
    handleSendMessage(promptText);
  }, [handleSendMessage]);

  // Clear conversation
  const handleClearConversation = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    setMessages([]);
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
  }, [enableMastra, mastraAgent]);

  // Suggestion selection handler
  const handleSelectSuggestion = useCallback((suggestion: HabitSuggestion) => {
    openHabitModal({
      name: suggestion.name,
      type: suggestion.type,
      triggerTime: suggestion.triggerTime || null,
      goalId: selectedGoalId || (goals.length > 0 ? goals[0].id : null),
    });
    setSuggestions([]);
    addMessage('assistant', `「${suggestion.name}」${locale === 'ja' ? 'を選択しました。モーダルで詳細を編集してください。' : ' selected. Please edit details in the modal.'}`);
  }, [openHabitModal, selectedGoalId, goals, addMessage, locale]);

  // Goal suggestion selection handler
  const handleSelectGoalSuggestion = useCallback((suggestion: GoalSuggestion) => {
    openGoalModal({ name: suggestion.name });
    setGoalSuggestions([]);
    addMessage('assistant', `「${suggestion.name}」${locale === 'ja' ? 'を選択しました。モーダルで詳細を編集してください。' : ' selected. Please edit details in the modal.'}`);
  }, [openGoalModal, addMessage, locale]);

  const hasAccess = isPremium || isAdmin;

  // ============================================================================
  // Render
  // ============================================================================

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
        <UpgradePrompt locale={locale} />
      ) : (
        <CoachModeView
          goals={goals}
          habits={habits}
          messages={messages}
          onSendMessage={handleSendMessage}
          onHabitCreated={onHabitCreated}
          onGoalCreated={onGoalCreated}
          onHabitUpdated={onHabitUpdated}
          locale={locale}
          isLoading={loading}
          isProcessing={processing}
          error={error}
          onClearError={() => setError(null)}
          useMastra={enableMastra}
          authToken={authToken}
          isPremium={isPremium}
          isAdmin={isAdmin}
          isPro={isPro}
          tokenInfo={tokenInfo}
          selectedGoalId={selectedGoalId}
          onSelectedGoalChange={setSelectedGoalId}
          showHistory={showHistory}
          onToggleHistory={() => setShowHistory(!showHistory)}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          onCloseSuggestions={() => setSuggestions([])}
          goalSuggestions={goalSuggestions}
          onSelectGoalSuggestion={handleSelectGoalSuggestion}
          onCloseGoalSuggestions={() => setGoalSuggestions([])}
          showCoaching={showCoaching}
          onCloseCoaching={() => {
            setShowCoaching(false);
            addMessage('assistant', locale === 'ja' ? 'コーチングを閉じました。他に何かお手伝いできることはありますか？' : 'Coaching closed. Is there anything else I can help with?');
          }}
          levelAssessmentHabit={levelAssessmentHabit}
          onLevelAssessmentSubmit={handleLevelAssessmentSubmit}
          onLevelAssessmentCancel={handleLevelAssessmentCancel}
          levelAssessmentLoading={levelAssessmentLoading}
          mastraAgent={mastraAgent}
          workflowSteps={workflowSteps}
          currentWorkflowStep={currentWorkflowStep}
          activeToolCall={activeToolCall}
          onQuickAction={handleQuickAction}
          onChoiceSelect={handleChoiceSelect}
          onContextualPromptSelect={handleContextualPromptSelect}
          onOpenHabitModal={openHabitModal}
          onOpenGoalModal={openGoalModal}
          onAddMessage={addMessage}
        />
      )}

      {/* Modals */}
      <HabitModal
        open={habitModalOpen}
        onClose={() => {
          setHabitModalOpen(false);
          setHabitModalInitial(undefined);
          addMessage('assistant', locale === 'ja' ? 'キャンセルしました。他に何かお手伝いできることはありますか？' : 'Cancelled. Is there anything else I can help with?');
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
          addMessage('assistant', locale === 'ja' ? 'キャンセルしました。他に何かお手伝いできることはありますか？' : 'Cancelled. Is there anything else I can help with?');
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
            <h3 className="font-semibold mb-2">
              {locale === 'ja' ? '会話をクリアしますか？' : 'Clear conversation?'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {locale === 'ja'
                ? 'すべての会話履歴が削除されます。この操作は取り消せません。'
                : 'All conversation history will be deleted. This action cannot be undone.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                {locale === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
              <button
                onClick={confirmClear}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition-opacity"
              >
                {locale === 'ja' ? 'クリア' : 'Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Upgrade Prompt Component
 */
function UpgradePrompt({ locale = 'ja' }: { locale?: 'ja' | 'en' }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-medium mb-2">
          {locale === 'ja'
            ? 'AI Coach機能はPremiumプランで利用可能'
            : 'AI Coach is available with Premium plan'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {locale === 'ja'
            ? '自然言語での習慣入力、AI編集、習慣提案などの機能をご利用いただけます。'
            : 'Natural language habit input, AI editing, habit suggestions and more.'}
        </p>
        <a
          href="/settings/subscription"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          {locale === 'ja' ? 'プランを見る' : 'View Plans'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export default CoachSection;
