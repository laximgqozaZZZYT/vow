'use client';

/**
 * Coach Section
 *
 * AI-powered coaching features including:
 * - Natural language habit parsing
 * - AI habit editing
 * - AI habit suggestions for goals
 * - Workload coaching proposals
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

interface CoachSectionProps {
  goals: Goal[];
  onHabitCreated?: () => void;
}

type TabType = 'parse' | 'edit' | 'suggest' | 'coaching';

export function CoachSection({ goals, onHabitCreated }: CoachSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>('parse');
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ remaining: number; total: number } | null>(null);

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
          
          // Check token usage
          if (data.tokenUsage) {
            setTokenInfo({
              remaining: data.tokenUsage.monthlyQuota - data.tokenUsage.usedQuota,
              total: data.tokenUsage.monthlyQuota,
            });
          }
        }

        // Check admin status via a simple test call
        const adminCheck = await fetch(`${apiUrl}/api/ai/parse-habit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '' }),
        });
        
        // If we get 400 (bad request) instead of 402 (premium required), we have access
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
        <>
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-4 border-b border-border">
            <TabButton
              active={activeTab === 'parse'}
              onClick={() => setActiveTab('parse')}
              label="AI入力"
              icon="✨"
            />
            <TabButton
              active={activeTab === 'edit'}
              onClick={() => setActiveTab('edit')}
              label="AI編集"
              icon="✏️"
            />
            <TabButton
              active={activeTab === 'suggest'}
              onClick={() => setActiveTab('suggest')}
              label="提案"
              icon="💡"
            />
            <TabButton
              active={activeTab === 'coaching'}
              onClick={() => setActiveTab('coaching')}
              label="コーチング"
              icon="📊"
            />
          </div>

          {/* Tab Content */}
          <div className="min-h-[200px]">
            {activeTab === 'parse' && (
              <AIParseTab goals={goals} onHabitCreated={onHabitCreated} />
            )}
            {activeTab === 'edit' && <AIEditTab />}
            {activeTab === 'suggest' && (
              <AISuggestTab goals={goals} onHabitCreated={onHabitCreated} />
            )}
            {activeTab === 'coaching' && (
              <CoachingTab onProposalApplied={onHabitCreated} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-primary text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span className="mr-1">{icon}</span>
      {label}
    </button>
  );
}

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

// AI Parse Tab - Natural language habit creation
function AIParseTab({ goals, onHabitCreated }: { goals: Goal[]; onHabitCreated?: () => void }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  const handleParse = async () => {
    if (!input.trim() || !apiUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      const response = await fetch(`${apiUrl}/api/ai/parse-habit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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
      setResult(data.parsed);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!result || !apiUrl) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Create habit via API
      const response = await fetch(`${apiUrl}/api/habits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });

      if (response.ok) {
        setInput('');
        setResult(null);
        onHabitCreated?.();
      }
    } catch (err) {
      console.error('Failed to create habit:', err);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">自然言語で習慣を入力</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 毎朝7時に30分ジョギングする"
          className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={loading}
        />
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {!result && (
        <button
          onClick={handleParse}
          disabled={loading || !input.trim()}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'AI解析中...' : 'AIで解析'}
        </button>
      )}

      {result && (
        <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
          <h4 className="font-medium">解析結果</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">名前:</span> {result.name}</div>
            <div><span className="text-muted-foreground">タイプ:</span> {result.type === 'do' ? '実行' : '避ける'}</div>
            {result.frequency && (
              <div><span className="text-muted-foreground">頻度:</span> {result.frequency}</div>
            )}
            {result.triggerTime && (
              <div><span className="text-muted-foreground">時刻:</span> {result.triggerTime}</div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90"
            >
              この内容で作成
            </button>
            <button
              onClick={() => setResult(null)}
              className="py-2 px-4 border border-border rounded-md hover:bg-accent"
            >
              やり直す
            </button>
          </div>
        </div>
      )}

      {/* Example prompts */}
      {!result && !loading && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">入力例:</p>
          <div className="flex flex-wrap gap-2">
            {['毎朝7時に30分ジョギング', '寝る前にスマホを見ない', '週3回筋トレする'].map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// AI Edit Tab - Natural language habit editing
function AIEditTab() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  const handleEdit = async () => {
    if (!input.trim() || !apiUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      const response = await fetch(`${apiUrl}/api/ai/edit-habit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: input }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'AI編集に失敗しました');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">編集内容を自然言語で入力</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: ジョギングの時間を8時に変更"
          className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={loading}
        />
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleEdit}
        disabled={loading || !input.trim()}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'AI解析中...' : 'AIで編集内容を解析'}
      </button>

      {result && (
        <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
          <h4 className="font-medium">編集対象: {result.targetHabitName}</h4>
          <div className="text-sm">
            <span className="text-muted-foreground">変更内容:</span>
            <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto">
              {JSON.stringify(result.changes, null, 2)}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            信頼度: {Math.round((result.confidence || 0) * 100)}%
          </p>
        </div>
      )}

      {/* Example prompts */}
      {!result && !loading && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">入力例:</p>
          <div className="flex flex-wrap gap-2">
            {['ジョギングを8時に変更', '筋トレを週4回に増やす', '読書の時間を30分に'].map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// AI Suggest Tab - Goal-based habit suggestions
function AISuggestTab({ goals, onHabitCreated }: { goals: Goal[]; onHabitCreated?: () => void }) {
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  const handleSuggest = async () => {
    if (!selectedGoal || !apiUrl) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      const response = await fetch(`${apiUrl}/api/ai/suggest-habits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ goalId: selectedGoal }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '提案の取得に失敗しました');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">ゴールを選択</label>
        <select
          value={selectedGoal}
          onChange={(e) => setSelectedGoal(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={loading}
        >
          <option value="">ゴールを選択...</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      <button
        onClick={handleSuggest}
        disabled={loading || !selectedGoal}
        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'AI提案中...' : 'AIに習慣を提案してもらう'}
      </button>

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">提案された習慣</h4>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="p-3 bg-muted/50 rounded-lg border border-border"
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
            </div>
          ))}
        </div>
      )}

      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          まずゴールを作成してください
        </p>
      )}
    </div>
  );
}

// Coaching Tab - Workload coaching proposals
function CoachingTab({ onProposalApplied }: { onProposalApplied?: () => void }) {
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  useEffect(() => {
    const fetchTokenUsage = async () => {
      if (!apiUrl) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${apiUrl}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setTokenUsage(data.tokenUsage);
        }
      } catch (error) {
        console.error('Failed to fetch token usage:', error);
      }
    };

    fetchTokenUsage();
  }, [apiUrl]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        習慣の達成状況に基づいて、ワークロード調整の提案を表示します。
      </p>
      <CoachingWidget onProposalApplied={onProposalApplied} />
      
      {tokenUsage && (
        <div className="pt-4 border-t border-border">
          <h4 className="font-medium mb-2">トークン使用状況</h4>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex justify-between text-sm mb-2">
              <span>使用量</span>
              <span>{Math.round(tokenUsage.percentageUsed || 0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(tokenUsage.percentageUsed || 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>残り約{tokenUsage.estimatedOperations || 0}回</span>
              <span>リセット: {tokenUsage.resetAt ? new Date(tokenUsage.resetAt).toLocaleDateString('ja-JP') : '-'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoachSection;
