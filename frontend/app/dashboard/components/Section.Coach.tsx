'use client';

/**
 * Unified AI Coach Section with Conversation Support
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
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CoachingWidget } from './Widget.Coaching';
import { HabitStatsCard, type HabitStats } from './Widget.HabitStats';
import { WorkloadChart, type WorkloadData } from './Widget.WorkloadChart';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';
import { ProgressIndicator } from './Widget.Progress';
import { QuickActionButtons, type QuickAction } from './Widget.QuickActions';
import { HabitModal } from './Modal.Habit';

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
  // Additional fields for detailed form
  triggerTime?: string | null;
  duration?: number | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: DetectedIntent;
  data?: any; // Parsed habit, suggestions, etc.
  uiComponents?: UIComponentData[]; // UI components to render
}

interface UIComponentData {
  type: 'ui_component';
  component: 'habit_stats' | 'choice_buttons' | 'workload_chart' | 'progress_indicator' | 'quick_actions';
  data: any;
}

interface CoachSectionProps {
  goals: Goal[];
  onHabitCreated?: () => void;
}

type DetectedIntent = 'create' | 'edit' | 'suggest' | 'coaching' | 'followup' | null;

export function CoachSection({ goals, onHabitCreated }: CoachSectionProps) {
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

  // Current action state - use HabitModal for habit creation
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

  // Helper to open HabitModal with initial values from AI
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

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Detect intent is now handled by AI backend - this is kept for type compatibility
  const detectIntent = useCallback((text: string): DetectedIntent => {
    return null; // AI will determine intent
  }, []);

  // Add message to conversation
  const addMessage = useCallback((role: 'user' | 'assistant', content: string, intent?: DetectedIntent, data?: any, uiComponents?: UIComponentData[]) => {
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

  // Handle habit creation from HabitModal
  const handleHabitCreated = useCallback((payload: any) => {
    addMessage('assistant', `✅ 「${payload.name}」を作成しました！他に追加したい習慣はありますか？`);
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    onHabitCreated?.();
  }, [addMessage, onHabitCreated]);

  // Generate follow-up question based on context
  const generateFollowUp = useCallback((intent: DetectedIntent, data: any): string => {
    switch (intent) {
      case 'create':
        if (!data?.triggerTime) {
          return '何時頃に実行しますか？（例: 朝7時、夜9時）';
        }
        if (!data?.duration && data?.type === 'do') {
          return 'どのくらいの時間をかけますか？（例: 30分、1時間）';
        }
        if (!data?.goalId && goals.length > 0) {
          return `どのゴールに関連付けますか？\n${goals.map((g, i) => `${i + 1}. ${g.name}`).join('\n')}`;
        }
        return '他に追加したい習慣はありますか？';
      case 'suggest':
        return '提案された習慣の中で気になるものはありますか？クリックして詳細を編集できます。';
      case 'edit':
        return '他に変更したい習慣はありますか？';
      default:
        return '他に何かお手伝いできることはありますか？';
    }
  }, [goals]);

  // Process input using AI chat endpoint (natural language understanding)
  const handleProcess = async () => {
    if (!input.trim() || !apiUrl) return;

    const userInput = input.trim();
    setInput('');
    setProcessing(true);
    setError(null);

    // Add user message
    addMessage('user', userInput);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        addMessage('assistant', '認証が必要です。ログインしてください。');
        return;
      }

      // Use the new AI chat endpoint for natural language understanding
      await handleAIChat(session.access_token, userInput);
    } catch (err: any) {
      const errorMsg = err.message || 'エラーが発生しました';
      setError(errorMsg);
      addMessage('assistant', `エラー: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  };

  // Main AI chat handler - uses Function Calling for intelligent coaching
  const handleAIChat = async (token: string, userInput: string) => {
    // Build conversation history for context
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

    // Extract UI components from response
    const uiComponents: UIComponentData[] = data.data?.uiComponents || [];

    // Add AI response with UI components
    addMessage('assistant', data.response, null, data, uiComponents);

    // Handle structured habit data from AI tools
    if (data.data?.parsedHabit) {
      // Single habit suggestion - open HabitModal
      const habit = data.data.parsedHabit;
      openHabitModal({
        name: habit.name || '',
        type: habit.type === 'avoid' ? 'avoid' : 'do',
        triggerTime: habit.triggerTime || null,
        goalId: habit.goalId || (goals.length > 0 ? goals[0].id : null),
      });
    }

    // Handle multiple habit suggestions
    if (data.data?.habitSuggestions && data.data.habitSuggestions.length > 0) {
      const suggestionList: HabitSuggestion[] = data.data.habitSuggestions.map((s: any) => ({
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

    // Show analysis data if available
    if (data.data?.analysis && data.data.analysis.length > 0) {
      // Show habit analysis summary
      const lowCompletionHabits = data.data.analysis.filter((a: any) => a.completionRate < 0.5);
      if (lowCompletionHabits.length > 0) {
        setTimeout(() => {
          const analysisMsg = `📊 分析結果:\n${lowCompletionHabits.slice(0, 3).map((a: any) => 
            `• ${a.habitName}: 達成率 ${Math.round(a.completionRate * 100)}% (${a.trend === 'improving' ? '↑改善中' : a.trend === 'declining' ? '↓下降中' : '→安定'})`
          ).join('\n')}`;
          addMessage('assistant', analysisMsg);
        }, 300);
      }
    }

    // Show workload summary if available
    if (data.data?.workload) {
      const workload = data.data.workload;
      const statusEmojiMap: Record<string, string> = {
        light: '🟢',
        moderate: '🟡',
        heavy: '🟠',
        overloaded: '🔴',
      };
      const statusEmoji = statusEmojiMap[workload.status as string] || '⚪';
      
      setTimeout(() => {
        addMessage('assistant', `${statusEmoji} ワークロード: 1日約${workload.dailyMinutes}分 (${workload.activeHabits}個の習慣)`);
      }, 500);
    }

    // Show suggestions if available (adjustment suggestions, not habit suggestions)
    if (data.data?.suggestions && data.data.suggestions.length > 0 && !data.data?.habitSuggestions) {
      setTimeout(() => {
        const suggestionsMsg = `💡 調整提案:\n${data.data.suggestions.slice(0, 3).map((s: any) => 
          `• ${s.habitName}: ${s.suggestion}\n  理由: ${s.reason}`
        ).join('\n\n')}`;
        addMessage('assistant', suggestionsMsg);
      }, 700);
    }

    // Update token info if provided
    if (data.remainingTokens !== undefined) {
      setTokenInfo(prev => prev ? { ...prev, remaining: data.remainingTokens } : null);
    }
  };

  // Legacy handlers for direct actions (kept for backward compatibility)
  const handleCreate = async (token: string, userInput: string) => {
    const response = await fetch(`${apiUrl}/api/ai/parse-habit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: userInput,
        context: { existingGoals: goals },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'AI解析に失敗しました');
    }

    const data = await response.json();
    const parsed = data.parsed as ParsedHabit;
    
    // Open HabitModal with parsed data
    openHabitModal({
      name: parsed.name,
      type: parsed.type,
      triggerTime: parsed.triggerTime,
      goalId: parsed.goalId,
    });
    
    // Build response message
    let responseMsg = `「${parsed.name}」を解析しました。\n`;
    responseMsg += `タイプ: ${parsed.type === 'do' ? '実行する習慣' : '避ける習慣'}\n`;
    if (parsed.frequency) responseMsg += `頻度: ${parsed.frequency === 'daily' ? '毎日' : parsed.frequency === 'weekly' ? '毎週' : '毎月'}\n`;
    if (parsed.triggerTime) responseMsg += `時刻: ${parsed.triggerTime}\n`;
    if (parsed.duration) responseMsg += `所要時間: ${parsed.duration}分\n`;
    if (parsed.targetCount) responseMsg += `目標: ${parsed.targetCount}${parsed.workloadUnit || '回'}\n`;
    responseMsg += `\nモーダルで内容を確認・編集してください。`;
    
    addMessage('assistant', responseMsg, 'create', parsed);
  };

  const handleEdit = async (token: string, userInput: string) => {
    const response = await fetch(`${apiUrl}/api/ai/edit-habit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: userInput }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'AI編集に失敗しました');
    }

    const data = await response.json();
    
    let responseMsg = `編集対象: 「${data.targetHabitName || '不明'}」\n`;
    responseMsg += `変更内容:\n`;
    Object.entries(data.changes || {}).forEach(([key, value]) => {
      responseMsg += `  - ${key}: ${value}\n`;
    });
    responseMsg += `信頼度: ${Math.round((data.confidence || 0) * 100)}%`;
    
    addMessage('assistant', responseMsg, 'edit', data);
    
    // Add follow-up
    setTimeout(() => addMessage('assistant', generateFollowUp('edit', data)), 500);
  };

  const handleSuggest = async (token: string, userInput: string) => {
    // Determine which goal to use
    let goalId = selectedGoalId;
    
    // Try to detect goal from input
    if (!goalId && goals.length > 0) {
      const lowerInput = userInput.toLowerCase();
      const matchedGoal = goals.find(g => lowerInput.includes(g.name.toLowerCase()));
      if (matchedGoal) {
        goalId = matchedGoal.id;
      } else {
        goalId = goals[0].id;
      }
    }

    if (!goalId) {
      addMessage('assistant', 'まずゴールを作成してください。ゴールがないと習慣の提案ができません。');
      return;
    }

    const response = await fetch(`${apiUrl}/api/ai/suggest-habits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ goalId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || '提案の取得に失敗しました');
    }

    const data = await response.json();
    const suggestionList = (data.suggestions || []) as HabitSuggestion[];
    setSuggestions(suggestionList);
    
    const goalName = goals.find(g => g.id === goalId)?.name || 'ゴール';
    let responseMsg = `「${goalName}」達成のための習慣を${suggestionList.length}つ提案します:\n\n`;
    
    suggestionList.forEach((s, i) => {
      responseMsg += `${i + 1}. ${s.name}\n`;
      responseMsg += `   頻度: ${s.frequency === 'daily' ? '毎日' : s.frequency === 'weekly' ? '毎週' : '毎月'}`;
      if (s.suggestedTargetCount > 1 || s.workloadUnit) {
        responseMsg += ` / 目標: ${s.suggestedTargetCount}${s.workloadUnit || '回'}`;
      }
      responseMsg += `\n   理由: ${s.reason}\n\n`;
    });
    
    responseMsg += '気になる習慣をクリックすると、詳細を編集して作成できます。';
    
    addMessage('assistant', responseMsg, 'suggest', suggestionList);
  };

  // Create habit from suggestion - open HabitModal
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

  // Handle choice button selection
  const handleChoiceSelect = useCallback(async (choice: Choice) => {
    // Send the choice as a user message
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
    } catch (err: any) {
      const errorMsg = err.message || 'エラーが発生しました';
      setError(errorMsg);
      addMessage('assistant', `エラー: ${errorMsg}`);
    } finally {
      setProcessing(false);
    }
  }, [addMessage, handleAIChat]);

  // Clear conversation
  const handleClearConversation = () => {
    setMessages([]);
    setHabitModalOpen(false);
    setHabitModalInitial(undefined);
    setSuggestions([]);
    setShowCoaching(false);
    setError(null);
  };

  const hasAccess = isPremium || isAdmin;

  if (loading) {
    return (
      <section className="p-4 bg-card border border-border rounded-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 bg-card border border-border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🤖</span>
          <span>AI Coach</span>
          {isAdmin && (
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              Admin
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleClearConversation}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              会話をクリア
            </button>
          )}
          {hasAccess && tokenInfo && (
            <div className="text-xs text-muted-foreground">
              残り: 約{Math.floor(tokenInfo.remaining / 1000)}回
            </div>
          )}
        </div>
      </div>

      {!hasAccess ? (
        <UpgradePrompt />
      ) : (
        <div className="space-y-4">
          {/* Conversation History */}
          {messages.length > 0 && (
            <div className="max-h-96 overflow-y-auto space-y-3 p-3 bg-muted/30 rounded-lg">
              {messages.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border border-border'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {/* Render UI Components */}
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

          {/* Goal Selector (for suggestions) */}
          {goals.length > 1 && (
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
          )}

          {/* Input Area */}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={messages.length === 0 
                ? "例: 毎朝7時に30分ジョギングする / ゴール達成のための習慣を提案して"
                : "続けて入力..."
              }
              className="flex-1 h-16 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
              className="px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {processing ? '...' : '送信'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          {/* HabitModal for creating habits */}
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

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <SuggestionsView
              suggestions={suggestions}
              onClose={() => setSuggestions([])}
              onSelect={handleSelectSuggestion}
            />
          )}

          {/* Coaching */}
          {showCoaching && (
            <div className="space-y-4">
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

          {/* Quick Examples (only when no conversation) */}
          {messages.length === 0 && !habitModalOpen && suggestions.length === 0 && !showCoaching && !processing && (
            <QuickExamples onSelect={setInput} />
          )}
        </div>
      )}
    </section>
  );
}

// Suggestions View with detailed info
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">提案された習慣</h4>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
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
          
          {/* Detailed info grid */}
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
            <p className="text-sm text-muted-foreground mt-3 italic">
              💡 {suggestion.reason}
            </p>
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

// Quick Examples
function QuickExamples({ onSelect }: { onSelect: (text: string) => void }) {
  const examples = [
    { text: '毎朝7時に30分ジョギング', icon: '🏃' },
    { text: '寝る前にスマホを見ない', icon: '📵' },
    { text: 'ジョギングを8時に変更', icon: '✏️' },
    { text: 'ゴール達成のための習慣を提案して', icon: '💡' },
    { text: 'ワークロードを調整したい', icon: '📊' },
  ];

  return (
    <div className="pt-2 border-t border-border">
      <p className="text-xs text-muted-foreground mb-2">入力例:</p>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button
            key={ex.text}
            onClick={() => onSelect(ex.text)}
            className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 flex items-center gap-1"
          >
            <span>{ex.icon}</span>
            <span>{ex.text}</span>
          </button>
        ))}
      </div>
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
    case 'habit_stats':
      return (
        <HabitStatsCard
          stats={{
            habitId: component.data.habitId,
            habitName: component.data.habitName,
            completionRate: component.data.completionRate,
            trend: component.data.trend,
            streakDays: component.data.streak || 0,
            recentHistory: component.data.recentHistory,
          }}
          className="max-w-sm"
        />
      );

    case 'workload_chart':
      return (
        <WorkloadChart
          data={component.data as WorkloadData}
          type={component.data.chartType || 'bar'}
          className="max-w-md"
        />
      );

    case 'choice_buttons':
      return (
        <div className="space-y-2 max-w-md">
          {component.data.title && (
            <p className="text-sm font-medium text-foreground">{component.data.title}</p>
          )}
          <ChoiceButtons
            choices={component.data.choices}
            onSelect={onChoiceSelect}
          />
        </div>
      );

    case 'progress_indicator':
      return (
        <ProgressIndicator
          value={component.data.value}
          max={component.data.max}
          type={component.data.type}
          size={component.data.size}
          color={component.data.color}
          label={component.data.label}
          className="max-w-xs"
        />
      );

    case 'quick_actions':
      return (
        <QuickActionButtons
          actions={component.data.actions as QuickAction[]}
          onAction={(actionId) => {
            const action = component.data.actions.find((a: QuickAction) => a.id === actionId);
            if (action) {
              onChoiceSelect({ id: action.id, label: action.label, description: action.description });
            }
          }}
          layout={component.data.layout}
          size={component.data.size}
          className="max-w-md"
        />
      );

    default:
      return null;
  }
}

// Upgrade Prompt
function UpgradePrompt() {
  return (
    <div className="p-6 text-center">
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
  );
}

export default CoachSection;
