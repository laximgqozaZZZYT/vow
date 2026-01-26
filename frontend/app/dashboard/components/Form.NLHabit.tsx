'use client';

import React, { useState, useCallback } from 'react';
import { useNLHabitParser, type ParsedHabitData } from '@/hooks/useNLHabitParser';

interface NLHabitFormProps {
  onSubmit: (result: ParsedHabitData) => void;
  onCancel?: () => void;
  isPremium: boolean;
  remainingTokens: number;
  existingHabits?: string[];
  existingGoals?: Array<{ id: string; name: string }>;
}

export default function NLHabitForm({
  onSubmit,
  onCancel,
  isPremium,
  remainingTokens,
  existingHabits = [],
  existingGoals = [],
}: NLHabitFormProps) {
  const [inputText, setInputText] = useState('');
  const {
    parsedData,
    loading,
    error,
    parseHabit,
    clearResult,
  } = useNLHabitParser();

  const handleParse = useCallback(async () => {
    if (!inputText.trim()) return;
    await parseHabit(inputText, {
      existingHabits,
      existingGoals: existingGoals.map(g => g.name),
    });
  }, [inputText, existingHabits, existingGoals, parseHabit]);

  const handleConfirm = useCallback(() => {
    if (parsedData) {
      onSubmit(parsedData);
      setInputText('');
      clearResult();
    }
  }, [parsedData, onSubmit, clearResult]);

  const handleClear = useCallback(() => {
    setInputText('');
    clearResult();
  }, [clearResult]);

  // Non-premium users see upgrade prompt (disabled in production)
  if (!isPremium) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-5 h-5 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="font-medium text-muted-foreground">AI入力モード</span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          AI機能は準備中です。
        </p>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground cursor-not-allowed">
          Coming Soon
        </span>
      </div>
    );
  }

  // Quota exhausted
  if (remainingTokens <= 0) {
    return (
      <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="font-medium text-red-700 dark:text-red-300">トークン上限に達しました</span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300">
          今月のトークン上限に達したため、AI機能は翌月のリセットまで使用できません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input area */}
      <div>
        <label className="block text-sm font-medium mb-2">
          自然言語で入力
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="例: 毎朝7時に30分ジョギングする"
          className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground mt-1">
          残りトークン: 約 {Math.floor(remainingTokens / 1000)} 回の操作
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Parse button */}
      {!parsedData && (
        <div className="flex gap-2">
          <button
            onClick={handleParse}
            disabled={loading || !inputText.trim()}
            className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                解析中...
              </span>
            ) : (
              'AIで解析'
            )}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="py-2 px-4 border border-border rounded-md font-medium hover:bg-accent transition-colors"
            >
              キャンセル
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      {parsedData && (
        <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">解析結果プレビュー</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              parsedData.confidence >= 0.8
                ? 'bg-green-500/10 text-green-700 dark:text-green-300'
                : parsedData.confidence >= 0.5
                ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'
                : 'bg-red-500/10 text-red-700 dark:text-red-300'
            }`}>
              信頼度: {Math.round(parsedData.confidence * 100)}%
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">名前:</span>
              <span className="ml-2 font-medium">{parsedData.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">タイプ:</span>
              <span className="ml-2 font-medium">
                {parsedData.type === 'do' ? '実行する' : '避ける'}
              </span>
            </div>
            {parsedData.frequency && (
              <div>
                <span className="text-muted-foreground">頻度:</span>
                <span className="ml-2 font-medium">
                  {parsedData.frequency === 'daily' ? '毎日' :
                   parsedData.frequency === 'weekly' ? '毎週' : '毎月'}
                </span>
              </div>
            )}
            {parsedData.triggerTime && (
              <div>
                <span className="text-muted-foreground">時刻:</span>
                <span className="ml-2 font-medium">{parsedData.triggerTime}</span>
              </div>
            )}
            {parsedData.duration && (
              <div>
                <span className="text-muted-foreground">時間:</span>
                <span className="ml-2 font-medium">{parsedData.duration}分</span>
              </div>
            )}
            {parsedData.goalId && (
              <div className="col-span-2">
                <span className="text-muted-foreground">関連Goal:</span>
                <span className="ml-2 font-medium">
                  {existingGoals.find(g => g.id === parsedData.goalId)?.name || parsedData.goalId}
                </span>
              </div>
            )}
          </div>

          {parsedData.confidence < 0.5 && (
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              ⚠️ 信頼度が低いため、確認後に手動で修正することをお勧めします。
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              この内容で作成
            </button>
            <button
              onClick={handleClear}
              className="py-2 px-4 border border-border rounded-md font-medium hover:bg-accent transition-colors"
            >
              やり直す
            </button>
          </div>
        </div>
      )}

      {/* Example prompts */}
      {!parsedData && !loading && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">入力例:</p>
          <div className="flex flex-wrap gap-2">
            {[
              '毎朝7時に30分ジョギング',
              '寝る前にスマホを見ない',
              '週3回筋トレする',
              '毎日水を2L飲む',
            ].map((example) => (
              <button
                key={example}
                onClick={() => setInputText(example)}
                className="text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
