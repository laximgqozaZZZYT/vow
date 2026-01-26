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
 *
 * Requirements: Premium subscription features
 * 
 * UI Design:
 * - Gemini-style spacious layout
 * - Chat area: flex-1, min-h-400px (desktop), min-h-250px (mobile)
 * - Input area: sticky bottom, auto-expand (max 160px)
 * - Quick actions: centered when no conversation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CoachingWidget } from './Widget.Coaching';
import { HabitStatsCard, type HabitStats } from './Widget.HabitStats';
import { WorkloadChart, type WorkloadData } from './Widget.WorkloadChart';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';
import { ProgressIndicator } from './Widget.Progress';
import { HabitModal } from './Modal.Habit';
import { GoalModal } from './Modal.Goal';

/**
 * デフォルトのクイックアクション（Choice形式）
 */
const DEFAULT_QUICK_ACTIONS: Choice[] = [
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
 * クイックアクションIDからプロンプトへのマッピング
 */
const QUICK_ACTION_PROMPTS: Record<string, string> = {
  'add-habit': '新しい習慣を追加したい',
  'set-goal': 'ゴールを設定したい',
  'check-progress': '習慣の進捗を確認したい',
  'get-advice': '習慣を続けるコツを教えて',
};

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
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
}

type DetectedIntent = 'create' | 'edit' | 'suggest' | 'coaching' | 'followup' | null;

export function CoachSection({ goals, onHabitCreated, onGoalCreated }: CoachSectionProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ remaining: number; total: number } | null>(null);

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Check premium/admin status
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

        const response = await fetch(`${apiUrl}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const planType = data.subscription?.planType;
          setIsPremium(planType === 'premium_basic' || planType === 'premium_pro');
          
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
      const habit = data.data.parsedHabit;
      openHabitModal({
        name: habit.name || '',
        type: habit.type === 'avoid' ? 'avoid' : 'do',
        triggerTime: habit.triggerTime || null,
        goalId: habit.goalId || (goals.length > 0 ? goals[0].id : null),
      });
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
    }

    if (data.data?.parsedGoal) {
      const goal = data.data.parsedGoal;
      openGoalModal({ name: goal.name || '', parentId: null });
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
    }

    if (data.remainingTokens !== undefined) {
      setTokenInfo(prev => prev ? { ...prev, remaining: data.remainingTokens } : null);
    }
  }, [apiUrl, messages, addMessage, openHabitModal, openGoalModal, goals]);

  const handleProcess = async () => {
    if (!input.trim() || !apiUrl) return;

    const userInput = input.trim();
    setInput('');
    setProcessing(true);
    setError(null);

    addMessage('user', userInput);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        addMessage('assistant', '認証が必要です。ログインしてください。');
        return;
      }

      await handleAIChat(session.access_token, userInput);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMsg);
      addMessage('assistant', `エラー: ${errorMsg}`);
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
    const prompt = QUICK_ACTION_PROMPTS[choice.id];
    if (!prompt || !apiUrl) return;
    
    setInput('');
    setProcessing(true);
    addMessage('user', prompt);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        addMessage('assistant', '認証が必要です。ログインしてください。');
        return;
      }

      await handleAIChat(session.access_token, prompt);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'エラーが発生しました';
      setError(errorMsg);
      addMessage('assistant', `エラー: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [apiUrl, addMessage, handleAIChat]);

  const handleClearConversation = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    setMessages([]);
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    setGoalModalOpen(false);
    setGoalModalInitial(undefined);
    setSuggestions([]);
    setGoalSuggestions([]);
    setShowCoaching(false);
    setError(null);
    setShowClearConfirm(false);
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
    <section className="flex flex-col h-[calc(100vh-200px)] min-h-[400px] max-h-[800px] bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      {/* Header - 48px */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🤖</span>
          <span>AI Coach</span>
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              Admin
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          {hasAccess && tokenInfo && (
            <div className="text-xs text-muted-foreground">
              残り: 約{Math.floor(tokenInfo.remaining / 1000)}回
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearConversation}
              className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              クリア
            </button>
          )}
        </div>
      </header>

      {!hasAccess ? (
        <UpgradePrompt />
      ) : (
        <>
          {/* Chat Area - flex-1 to fill remaining space, scrollable */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">
            {messages.length === 0 ? (
              /* Quick Actions - left aligned at bottom like ChatGPT/Gemini */
              <div className="flex-1 flex flex-col justify-end">
                <p className="text-lg text-muted-foreground mb-4">何をお手伝いしましょうか？</p>
                <ChoiceButtons
                  choices={DEFAULT_QUICK_ACTIONS}
                  onSelect={handleQuickAction}
                  layout="vertical"
                  size="md"
                  className="w-full max-w-md"
                />
              </div>
            ) : (
              /* Conversation History */
              <div className="space-y-4">
                {messages.map((msg) => (
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
                ))}
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

          {/* Goal Selector */}
          {goals.length > 1 && (
            <div className="px-4 py-2 border-t border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">提案対象ゴール:</label>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-input bg-background"
                >
                  <option value="">自動選択</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Input Area - sticky bottom, min-h-80px, max-h-160px */}
          <div className="shrink-0 border-t border-border bg-card p-4">
            {error && (
              <div className="mb-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={messages.length === 0 
                  ? "例: 毎朝7時に30分ジョギングする"
                  : "続けて入力..."
                }
                className="flex-1 min-h-[60px] md:min-h-[80px] max-h-[160px] px-4 py-3 rounded-lg border border-input bg-background text-base resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                disabled={processing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleProcess();
                  }
                }}
              />
              <button
                onClick={handleProcess}
                disabled={processing || !input.trim()}
                className="px-6 py-3 min-h-[48px] bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {processing ? '...' : '送信'}
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
