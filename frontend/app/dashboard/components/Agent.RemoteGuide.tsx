/**
 * Agent.RemoteGuide - Remote Agent Setup Guide Component
 *
 * Displays documentation for remote MCP agent setup
 *
 * @module Agent.RemoteGuide
 */

'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface RemoteAgentGuideProps {
  locale: 'ja' | 'en';
}

export function RemoteAgentGuide({ locale }: RemoteAgentGuideProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch documentation on expand
  useEffect(() => {
    if (isExpanded && !content) {
      setIsLoading(true);
      fetch('/docs/remote-mcp-agent-setup.md')
        .then(res => res.text())
        .then(text => setContent(text))
        .catch(err => {
          console.error('Failed to fetch documentation:', err);
          setContent(locale === 'ja'
            ? 'ドキュメントの読み込みに失敗しました。'
            : 'Failed to load documentation.');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isExpanded, content, locale]);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'セットアップガイド' : 'Setup Guide'}
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : content ? (
            <div className="max-h-96 overflow-y-auto pr-2 prose prose-sm dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-table:text-xs prose-th:bg-muted prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 max-w-none text-xs">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {locale === 'ja' ? 'ドキュメントを読み込み中...' : 'Loading documentation...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default RemoteAgentGuide;
