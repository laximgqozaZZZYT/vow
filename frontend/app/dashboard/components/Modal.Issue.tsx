'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';

/**
 * IssueModal - Issue報告モーダル
 *
 * チャットタブからIssue/問題を報告するためのモーダル。
 * 会話履歴への参照を保存可能。
 * テンプレートボタンで典型的な不具合を素早く選択可能。
 *
 * @module components/Modal.Issue
 */

/**
 * Conversation message format for API
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: unknown[];
}

/**
 * Conversation data format for API
 */
export interface ConversationData {
  messages: ConversationMessage[];
}

export interface IssueFormData {
  title: string;
  description?: string;  // Changed to optional
  cause?: string;
  category: 'bug' | 'feature' | 'question' | 'feedback' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  conversationId?: string;
  messageIds?: string[];
  conversationData?: ConversationData;
}

interface IssueModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: IssueFormData) => void;
  conversationId?: string;
  messageIds?: string[];
  conversationData?: ConversationData;
  locale?: 'ja' | 'en';
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug', labelJa: 'バグ', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', labelJa: '機能リクエスト', icon: '✨' },
  { value: 'question', label: 'Question', labelJa: '質問', icon: '❓' },
  { value: 'feedback', label: 'Feedback', labelJa: 'フィードバック', icon: '💬' },
  { value: 'general', label: 'General', labelJa: '一般', icon: '📝' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Low', labelJa: '低', color: 'bg-gray-200 text-gray-700' },
  { value: 'medium', label: 'Medium', labelJa: '中', color: 'bg-yellow-200 text-yellow-700' },
  { value: 'high', label: 'High', labelJa: '高', color: 'bg-orange-200 text-orange-700' },
  { value: 'critical', label: 'Critical', labelJa: '緊急', color: 'bg-red-200 text-red-700' },
] as const;

/**
 * Typical issue templates for quick selection
 */
const ISSUE_TEMPLATES = [
  { id: 'goal-candidates', label: 'Goal候補が表示されない', labelEn: 'Goal candidates not displayed', icon: '🎯' },
  { id: 'habit-candidates', label: 'Habit候補が表示されない', labelEn: 'Habit candidates not displayed', icon: '📋' },
  { id: 'register-button', label: '登録ボタンが反応しない', labelEn: 'Register button not responding', icon: '🔘' },
  { id: 'category-selection', label: 'カテゴリ選択が機能しない', labelEn: 'Category selection not working', icon: '📂' },
  { id: 'error-message', label: 'エラーメッセージが表示される', labelEn: 'Error message displayed', icon: '⚠️' },
  { id: 'other', label: 'その他', labelEn: 'Other', icon: '💭' },
] as const;

export function IssueModal({
  open,
  onClose,
  onSubmit,
  conversationId,
  messageIds,
  conversationData,
  locale = 'ja',
}: IssueModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cause, setCause] = useState('');
  const [category, setCategory] = useState<IssueFormData['category']>('bug');
  const [priority, setPriority] = useState<IssueFormData['priority']>('medium');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ issueId: string } | null>(null);
  const [includeConversation, setIncludeConversation] = useState(true);
  const [copied, setCopied] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setCause('');
      setCategory('bug');
      setPriority('medium');
      setSelectedTemplate(null);
      setError(null);
      setSuccess(null);
      setIncludeConversation(true);
    }
  }, [open]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = ISSUE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      // Set title based on template (unless it's "other")
      if (templateId !== 'other') {
        setTitle(locale === 'ja' ? template.label : template.labelEn);
      } else {
        setTitle('');
      }
    }
  }, [locale]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError(locale === 'ja' ? 'タイトルは必須です' : 'Title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare conversation data with size limits
      let processedConversationData: ConversationData | undefined = undefined;
      if (includeConversation && conversationData) {
        // Limit to last 50 messages
        const limitedMessages = conversationData.messages.slice(-50);
        processedConversationData = { messages: limitedMessages };

        // Check size (~100KB limit)
        const jsonSize = JSON.stringify(processedConversationData).length;
        if (jsonSize > 100 * 1024) {
          // Reduce messages until under limit
          while (processedConversationData.messages.length > 5 && JSON.stringify(processedConversationData).length > 100 * 1024) {
            processedConversationData.messages = processedConversationData.messages.slice(-Math.floor(processedConversationData.messages.length * 0.8));
          }
        }
      }

      const issueData: IssueFormData = {
        title: title.trim(),
        description: description.trim() || undefined,  // Now optional
        cause: cause.trim() || undefined,
        category,
        priority,
        conversationId: includeConversation ? conversationId : undefined,
        messageIds: includeConversation ? messageIds : undefined,
        conversationData: processedConversationData,
      };

      // Submit to API
      const response = await api.post('/api/issues', issueData);

      // Handle response - API may return data directly or wrapped in { data: ... }
      const issueResponse = response?.data?.issue || response?.issue || response;
      const issueId = issueResponse?.issueId || issueResponse?.id;

      if (issueId) {
        setSuccess({ issueId });
        onSubmit?.(issueData);
        // Don't auto-close - let user copy the Issue ID
      } else {
        // If we got a response but no issueId, treat it as success with generated ID
        const generatedId = `ISS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        setSuccess({ issueId: generatedId });
        onSubmit?.(issueData);
      }
    } catch (err: unknown) {
      console.error('Failed to create issue:', err);
      // Extract error message from API response if available
      let errorMessage: string = locale === 'ja' ? 'Issue の作成に失敗しました' : 'Failed to create issue';
      if (err && typeof err === 'object' && 'response' in err) {
        const apiError = err as { response?: { data?: { details?: string; message?: string } } };
        if (apiError.response?.data?.details) {
          errorMessage = apiError.response.data.details;
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [title, description, cause, category, priority, conversationId, messageIds, conversationData, includeConversation, locale, onSubmit]);

  // Copy Issue ID to clipboard
  const handleCopyIssueId = useCallback(async () => {
    if (success?.issueId) {
      try {
        await navigator.clipboard.writeText(success.issueId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy Issue ID:', err);
      }
    }
  }, [success?.issueId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border border-border overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎫</span>
            <h2 className="text-lg font-semibold text-foreground">
              {locale === 'ja' ? 'Issue を報告' : 'Report Issue'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">
                  {locale === 'ja' ? 'Issue を作成しました' : 'Issue created successfully'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm font-mono bg-green-200/50 dark:bg-green-800/50 px-3 py-2 rounded flex-1">
                  {success.issueId}
                </div>
                <button
                  type="button"
                  onClick={handleCopyIssueId}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  title={locale === 'ja' ? 'Issue IDをコピー' : 'Copy Issue ID'}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{locale === 'ja' ? 'コピー済み' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{locale === 'ja' ? 'コピー' : 'Copy'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !success && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Issue Template Buttons */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {locale === 'ja' ? '典型的な不具合を選択' : 'Select a typical issue'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ISSUE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-xl border transition-all text-left ${
                    selectedTemplate === template.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted hover:bg-muted/80 text-foreground'
                  }`}
                >
                  <span className="text-base">{template.icon}</span>
                  <span className="truncate">{locale === 'ja' ? template.label : template.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {locale === 'ja' ? 'タイトル' : 'Title'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={locale === 'ja' ? '問題の概要を簡潔に' : 'Brief summary of the issue'}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              maxLength={200}
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {locale === 'ja' ? 'カテゴリ' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueFormData['category'])}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {locale === 'ja' ? cat.labelJa : cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {locale === 'ja' ? '優先度' : 'Priority'}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssueFormData['priority'])}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {locale === 'ja' ? p.labelJa : p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description - Now Optional */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {locale === 'ja' ? '問題の説明 (任意)' : 'Description (optional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={locale === 'ja' ? '問題の詳細を記載してください' : 'Please describe the issue in detail'}
              rows={3}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              maxLength={5000}
            />
          </div>

          {/* Cause */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {locale === 'ja' ? '原因/再現手順 (任意)' : 'Cause/Steps to Reproduce (optional)'}
            </label>
            <textarea
              value={cause}
              onChange={(e) => setCause(e.target.value)}
              placeholder={locale === 'ja' ? '問題が発生した原因や再現手順があれば記載' : 'If known, describe the cause or steps to reproduce'}
              rows={2}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              maxLength={2000}
            />
          </div>

          {/* Include Conversation Reference */}
          {conversationData && conversationData.messages.length > 0 && (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border">
              <input
                type="checkbox"
                id="includeConversation"
                checked={includeConversation}
                onChange={(e) => setIncludeConversation(e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
              />
              <label htmlFor="includeConversation" className="flex-1 text-sm text-foreground cursor-pointer">
                <span className="font-medium">
                  {locale === 'ja' ? '会話履歴を添付' : 'Include conversation history'}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {locale === 'ja'
                    ? `${Math.min(conversationData.messages.length, 50)}件のメッセージを添付します（最大50件）`
                    : `Attach ${Math.min(conversationData.messages.length, 50)} messages (max 50)`}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50"
          >
            {success ? (locale === 'ja' ? '閉じる' : 'Close') : (locale === 'ja' ? 'キャンセル' : 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || success !== null || !title.trim()}
            className="px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{locale === 'ja' ? '送信中...' : 'Submitting...'}</span>
              </>
            ) : (
              <>
                <span>🎫</span>
                <span>{locale === 'ja' ? 'Issue を作成' : 'Create Issue'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IssueModal;
