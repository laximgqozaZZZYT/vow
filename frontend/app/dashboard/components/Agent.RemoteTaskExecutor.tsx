/**
 * Agent.RemoteTaskExecutor - Remote Task Execution Component
 *
 * Provides UI for executing tasks remotely via Claude Code
 *
 * @module Agent.RemoteTaskExecutor
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';

interface RemoteTaskExecutorProps {
  locale: 'ja' | 'en';
}

export function RemoteTaskExecutor({ locale }: RemoteTaskExecutorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [workingDir, setWorkingDir] = useState('/home/ubuntu/Downloads/vow');
  const [isExecuting, setIsExecuting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const executeTask = async () => {
    if (!prompt.trim()) return;

    setIsExecuting(true);
    setOutput([]);
    setErrors([]);
    setStatus('pending');
    setExitCode(null);

    try {
      // Create the remote task
      const res = await fetch('/api/agents/remote-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          workingDirectory: workingDir,
          timeoutMs: 30 * 60 * 1000, // 30 minutes
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors([data.error || 'Failed to create task']);
        setIsExecuting(false);
        setStatus('failed');
        return;
      }

      setTaskId(data.data.taskId);

      // Connect to SSE stream for output
      const eventSource = new EventSource(`/api/agents/remote-task/${data.data.taskId}/output`);

      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'output') {
            setOutput(prev => [...prev, msg.data]);
          } else if (msg.type === 'error') {
            setErrors(prev => [...prev, msg.data]);
          } else if (msg.type === 'status') {
            setStatus(msg.status || msg.data);
          } else if (msg.type === 'exit') {
            setExitCode(msg.code);
            setStatus(msg.status || 'completed');
            setIsExecuting(false);
            eventSource.close();
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setIsExecuting(false);
        eventSource.close();
      };

    } catch (err) {
      setErrors([`Error: ${(err as Error).message}`]);
      setIsExecuting(false);
      setStatus('failed');
    }
  };

  const cancelTask = async () => {
    if (!taskId) return;

    try {
      await fetch(`/api/agents/remote-task/${taskId}/cancel`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, errors]);

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-500',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-yellow-500',
    timeout: 'bg-orange-500',
  };

  const statusLabels: Record<string, { ja: string; en: string }> = {
    pending: { ja: '待機中', en: 'Pending' },
    running: { ja: '実行中', en: 'Running' },
    completed: { ja: '完了', en: 'Completed' },
    failed: { ja: '失敗', en: 'Failed' },
    cancelled: { ja: 'キャンセル', en: 'Cancelled' },
    timeout: { ja: 'タイムアウト', en: 'Timeout' },
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'リモートタスク実行' : 'Remote Task Execution'}
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
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground text-xs">
            {locale === 'ja'
              ? 'Claude Codeを使用してタスクをリモート実行します。'
              : 'Execute tasks remotely using Claude Code.'}
          </p>

          {/* Working Directory */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {locale === 'ja' ? '作業ディレクトリ' : 'Working Directory'}
            </label>
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="/home/ubuntu/Downloads/vow"
              disabled={isExecuting}
            />
          </div>

          {/* Prompt Input */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {locale === 'ja' ? 'タスク内容' : 'Task Prompt'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              rows={4}
              placeholder={locale === 'ja' ? 'タスク内容を入力...' : 'Enter task prompt...'}
              disabled={isExecuting}
            />
          </div>

          {/* Execute / Cancel Buttons */}
          <div className="flex gap-2">
            {!isExecuting ? (
              <button
                onClick={executeTask}
                disabled={!prompt.trim()}
                className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {locale === 'ja' ? '実行' : 'Execute'}
              </button>
            ) : (
              <button
                onClick={cancelTask}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {locale === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            )}
          </div>

          {/* Status Display */}
          {status && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'} ${status === 'running' ? 'animate-pulse' : ''}`} />
              <span>{statusLabels[status]?.[locale] || status}</span>
              {exitCode !== null && (
                <span className="text-muted-foreground ml-2">
                  ({locale === 'ja' ? '終了コード' : 'Exit code'}: {exitCode})
                </span>
              )}
            </div>
          )}

          {/* Output Display */}
          {(output.length > 0 || errors.length > 0) && (
            <div
              ref={outputRef}
              className="h-48 overflow-y-auto bg-gray-900 text-gray-100 rounded-lg p-2 font-mono text-xs"
            >
              {output.map((line, i) => (
                <div key={`out-${i}`} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {errors.map((line, i) => (
                <div key={`err-${i}`} className="whitespace-pre-wrap break-all text-red-400">
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Task ID */}
          {taskId && (
            <div className="text-xs text-muted-foreground">
              Task ID: <code className="font-mono text-foreground">{taskId}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RemoteTaskExecutor;
