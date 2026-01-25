'use client';

/**
 * Unified AI Coach Section
 *
 * Single intelligent interface that auto-detects user intent:
 * - Create habit from natural language
 * - Edit existing habit
 * - Get habit suggestions for goals
 * - Coaching/workload advice
 *
 * Requirements: Premium subscription features
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { CoachingWidget } from './Widget.Coaching';

interface Goal {
  id: string;
  name: string;
}

interface Habit {
  id: string;
  name: string;
  type: 'do' | 'avoid';
  frequency?: string;
  triggerTime?: string;
  duration?: number;
  targetCount?: number;
  workloadUnit?: string;
  goalId?: string;
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

interface CoachSectionProps {
  goals: Goal[];
  onHabitCreated?: () => void;
}

type DetectedIntent = 'create' | 'edit' | 'suggest' | 'coaching' | null;

export function CoachSection({ goals, onHabitCreated }: CoachSectionProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ remaining: number; total: number } | null>(null);

  // Unified input state
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent>(null);
  const [parsedHabit, setParsedHabit] = useState<ParsedHabit | null>(null);
  const [editResult, setEditResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showCoaching, setShowCoaching] = useState(false);

  // Editable form state (for create/edit)
  const [formData, setFormData] = useState<ParsedHabit | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

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

  // Detect intent from input text
  const detectIntent = useCallback((text: string): DetectedIntent => {
    const lowerText = text.toLowerCase();
    
    // Edit patterns
    if (lowerText.match(/変更|編集|修正|更新|を.*に(する|変える)|時間を|頻度を|回数を/)) {
      return 'edit';
    }
    
    // Suggestion patterns
    if (lowerText.match(/提案|おすすめ|サジェスト|何をすれば|どんな習慣|アドバイス.*ゴール|ゴール.*達成/)) {
      return 'suggest';
    }
    
    // Coaching patterns
    if (lowerText.match(/コーチ|ワークロード|負荷|調整|バランス|疲れ|きつい|多すぎ|少なすぎ/)) {
      return 'coaching';
    }
    
    // Default to create
    return 'create';
  }, []);

  // Process input based on detected intent
  const handleProcess = async () => {
    if (!input.trim() || !apiUrl) return;

    setProcessing(true);
    setError(null);
    resetResults();

    const intent = detectIntent(input);
    setDetectedIntent(intent);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      switch (intent) {
        case 'create':
          await handleCreate(session.access_token);
          break;
        case 'edit':
          await handleEdit(session.access_token);
          break;
        case 'suggest':
          await handleSuggest(session.access_token);
          break;
        case 'coaching':
          setShowCoaching(true);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setProcessing(false);
    }
  };

  const resetResults = () => {
    setParsedHabit(null);
    setEditResult(null);
    setSuggestions([]);
    setShowCoaching(false);
    setFormData(null);
  };

  const handleCreate = async (token: string) => {
    const response = await fetch(`${apiUrl}/api/ai/parse-habit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input,
        context: { existingGoals: goals },
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'AI解析に失敗しました');
    }

    const data = await response.json();
    setParsedHabit(data.parsed);
    setFormData(data.parsed);
  };

  const handleEdit = async (token: string) => {
    const response = await fetch(`${apiUrl}/api/ai/edit-habit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: input }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'AI編集に失敗しました');
    }

    const data = await response.json();
    setEditResult(data);
  };

  const handleSuggest = async (token: string) => {
    // If no goal mentioned, show goal selector
    if (goals.length === 0) {
      setError('まずゴールを作成してください');
      return;
    }

    // Use first goal or try to detect from input
    const goalId = goals[0].id;

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
    setSuggestions(data.suggestions || []);
  };

  // Create habit from form data
  const handleCreateHabit = async () => {
    if (!formData || !apiUrl) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const payload = {
        name: formData.name,
        type: formData.type,
        goalId: formData.goalId || (goals.length > 0 ? goals[0].id : undefined),
        time: formData.triggerTime || undefined,
        repeat: formData.frequency || 'daily',
        workloadUnit: formData.workloadUnit || undefined,
        workloadTotal: formData.targetCount || undefined,
        duration: formData.duration || undefined,
      };

      const response = await fetch(`${apiUrl}/api/habits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setInput('');
        resetResults();
        onHabitCreated?.();
      }
    } catch (err) {
      console.error('Failed to create habit:', err);
    }
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
        {hasAccess && tokenInfo && (
          <div className="text-xs text-muted-foreground">
            残り: 約{Math.floor(tokenInfo.remaining / 1000)}回
          </div>
        )}
      </div>

      {!hasAccess ? (
        <UpgradePrompt />
      ) : (
        <div className="space-y-4">
          {/* Unified Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              何でも聞いてください
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例: 毎朝7時に30分ジョギングする / ジョギングの時間を8時に変更 / ゴール達成のための習慣を提案して"
              className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              disabled={processing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleProcess();
                }
              }}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Process Button */}
          {!formData && !editResult && suggestions.length === 0 && !showCoaching && (
            <button
              onClick={handleProcess}
              disabled={processing || !input.trim()}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {processing ? 'AI処理中...' : 'AIに聞く'}
            </button>
          )}

          {/* Intent Indicator */}
          {detectedIntent && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>検出された意図:</span>
              <span className="px-2 py-0.5 bg-muted rounded">
                {detectedIntent === 'create' && '✨ 習慣作成'}
                {detectedIntent === 'edit' && '✏️ 習慣編集'}
                {detectedIntent === 'suggest' && '💡 提案'}
                {detectedIntent === 'coaching' && '📊 コーチング'}
              </span>
            </div>
          )}

          {/* Create Result - Editable Form */}
          {formData && (
            <HabitForm
              data={formData}
              goals={goals}
              onChange={setFormData}
              onSubmit={handleCreateHabit}
              onCancel={() => {
                resetResults();
              }}
            />
          )}

          {/* Edit Result */}
          {editResult && (
            <EditResultView
              result={editResult}
              onClose={() => setEditResult(null)}
            />
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <SuggestionsView
              suggestions={suggestions}
              onClose={() => setSuggestions([])}
              onSelect={(suggestion) => {
                setFormData({
                  name: suggestion.name,
                  type: 'do',
                  frequency: suggestion.frequency || 'daily',
                  triggerTime: null,
                  duration: null,
                  targetCount: null,
                  workloadUnit: null,
                  goalId: null,
                  confidence: 1,
                });
                setSuggestions([]);
              }}
            />
          )}

          {/* Coaching */}
          {showCoaching && (
            <div className="space-y-4">
              <CoachingWidget onProposalApplied={onHabitCreated} />
              <button
                onClick={() => setShowCoaching(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                閉じる
              </button>
            </div>
          )}

          {/* Quick Examples */}
          {!formData && !editResult && suggestions.length === 0 && !showCoaching && !processing && (
            <QuickExamples onSelect={setInput} />
          )}
        </div>
      )}
    </section>
  );
}

// Editable Habit Form (matching Modal.Habit fields)
function HabitForm({
  data,
  goals,
  onChange,
  onSubmit,
  onCancel,
}: {
  data: ParsedHabit;
  goals: Goal[];
  onChange: (data: ParsedHabit) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">解析結果を確認・編集</h4>
        <span className="text-xs text-muted-foreground">
          信頼度: {Math.round(data.confidence * 100)}%
        </span>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">名前</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">タイプ</label>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={data.type === 'do'}
              onChange={() => onChange({ ...data, type: 'do' })}
              className="form-radio"
            />
            <span className="text-sm">実行する (Good)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={data.type === 'avoid'}
              onChange={() => onChange({ ...data, type: 'avoid' })}
              className="form-radio"
            />
            <span className="text-sm">避ける (Bad)</span>
          </label>
        </div>
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">頻度</label>
        <select
          value={data.frequency || 'daily'}
          onChange={(e) => onChange({ ...data, frequency: e.target.value as any })}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="daily">毎日</option>
          <option value="weekly">毎週</option>
          <option value="monthly">毎月</option>
        </select>
      </div>

      {/* Time */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">時刻</label>
        <input
          type="time"
          value={data.triggerTime || ''}
          onChange={(e) => onChange({ ...data, triggerTime: e.target.value || null })}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">所要時間 (分)</label>
        <input
          type="number"
          value={data.duration || ''}
          onChange={(e) => onChange({ ...data, duration: e.target.value ? Number(e.target.value) : null })}
          placeholder="例: 30"
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        />
      </div>

      {/* Target Count / Workload */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">目標回数/量</label>
          <input
            type="number"
            value={data.targetCount || ''}
            onChange={(e) => onChange({ ...data, targetCount: e.target.value ? Number(e.target.value) : null })}
            placeholder="例: 3"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">単位</label>
          <input
            type="text"
            value={data.workloadUnit || ''}
            onChange={(e) => onChange({ ...data, workloadUnit: e.target.value || null })}
            placeholder="例: 回, ページ, 分"
            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
      </div>

      {/* Goal */}
      <div>
        <label className="block text-sm text-muted-foreground mb-1">ゴール</label>
        <select
          value={data.goalId || ''}
          onChange={(e) => onChange({ ...data, goalId: e.target.value || null })}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
        >
          <option value="">ゴールを選択...</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSubmit}
          className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90"
        >
          この内容で作成
        </button>
        <button
          onClick={onCancel}
          className="py-2 px-4 border border-border rounded-md hover:bg-accent"
        >
          やり直す
        </button>
      </div>
    </div>
  );
}

// Edit Result View
function EditResultView({
  result,
  onClose,
}: {
  result: any;
  onClose: () => void;
}) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
      <h4 className="font-medium">編集対象: {result.targetHabitName || '不明'}</h4>
      
      {result.candidates && result.candidates.length > 1 && (
        <div className="text-sm text-muted-foreground">
          候補: {result.candidates.map((c: any) => c.habitName).join(', ')}
        </div>
      )}

      <div className="text-sm">
        <span className="text-muted-foreground">変更内容:</span>
        <div className="mt-2 space-y-1">
          {Object.entries(result.changes || {}).map(([key, value]) => (
            <div key={key} className="flex justify-between px-2 py-1 bg-background rounded">
              <span className="text-muted-foreground">{key}:</span>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        信頼度: {Math.round((result.confidence || 0) * 100)}%
      </p>

      <button
        onClick={onClose}
        className="w-full py-2 px-4 border border-border rounded-md hover:bg-accent text-sm"
      >
        閉じる
      </button>
    </div>
  );
}

// Suggestions View
function SuggestionsView({
  suggestions,
  onClose,
  onSelect,
}: {
  suggestions: any[];
  onClose: () => void;
  onSelect: (suggestion: any) => void;
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
          className="p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
          onClick={() => onSelect(suggestion)}
        >
          <div className="font-medium">{suggestion.name}</div>
          {suggestion.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {suggestion.description}
            </p>
          )}
          {suggestion.frequency && (
            <p className="text-xs text-muted-foreground mt-1">
              頻度: {suggestion.frequency}
            </p>
          )}
          <p className="text-xs text-primary mt-2">クリックして作成フォームへ →</p>
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
