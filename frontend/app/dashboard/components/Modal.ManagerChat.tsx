"use client";

/**
 * ManagerChatModal Component
 *
 * Modal for chatting with the Manager agent.
 * Features:
 * - Message history display
 * - Markdown rendering for Manager responses
 * - Action buttons for task approval/rejection
 * - Session management
 *
 * @module Modal.ManagerChat
 */

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, ChatSession, ChatAction, AgentTask } from '../types/agent.types';
import { MOCK_CHAT_MESSAGES, MOCK_CHAT_SESSIONS } from '../mocks/mockAgentData';
import type { ConnectionState } from '../hooks/useMultiAgentServer';

interface ManagerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Connection state for displaying status */
  connectionState?: ConnectionState;
  /** Create task on the server */
  onCreateTask?: (task: Partial<AgentTask>) => Promise<AgentTask | null>;
  /** Server error if any */
  serverError?: string | null;
}

/**
 * Message Bubble Component
 */
function MessageBubble({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction?: (action: ChatAction) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          max-w-[85%] rounded-lg px-3 py-2
          ${isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
          }
        `}
      >
        {/* Role Label */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="6" height="8" rx="1" />
              <rect x="15" y="11" width="6" height="8" rx="1" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="6" r="3" />
            </svg>
            <span>Manager</span>
          </div>
        )}

        {/* Content */}
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Actions */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/50">
            {message.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => onAction?.(action)}
                className={`
                  text-xs px-2.5 py-1 rounded-md
                  transition-colors
                  ${action.type === 'approve'
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : action.type === 'reject'
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-primary/10 hover:bg-primary/20 text-primary'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

/**
 * Session Selector Component
 */
function SessionSelector({
  sessions,
  currentSessionId,
  onSelect,
  onNewSession,
}: {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        <span className="truncate max-w-[200px]">{currentSession?.title || 'Select session'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onSelect(session.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full text-left px-3 py-2 text-sm
                  hover:bg-muted transition-colors
                  ${session.id === currentSessionId ? 'bg-muted' : ''}
                `}
              >
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => {
                onNewSession();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Session</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Quick Command Buttons
 */
function QuickCommands({ onCommand }: { onCommand: (command: string) => void }) {
  const commands = [
    { label: 'Status', command: '現在のエージェント状況を教えてください', icon: '📊' },
    { label: 'Tasks', command: '進行中のタスク一覧を表示してください', icon: '📋' },
    { label: 'Assign', command: 'タスクを割り当ててください', icon: '👥' },
  ];

  return (
    <div className="flex gap-2 p-2 border-t border-border">
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={() => onCommand(cmd.command)}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
        >
          <span>{cmd.icon}</span>
          <span>{cmd.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * ManagerChatModal Component
 */
export default function ManagerChatModal({
  isOpen,
  onClose,
  connectionState = 'disconnected',
  onCreateTask,
  serverError,
}: ManagerChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [sessions, setSessions] = useState<ChatSession[]>(MOCK_CHAT_SESSIONS);
  const [currentSessionId, setCurrentSessionId] = useState(MOCK_CHAT_SESSIONS[0]?.id || '');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionState === 'connected';

  // Filter messages for current session
  const sessionMessages = messages.filter(m => m.sessionId === currentSessionId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionMessages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userContent = inputValue.trim();
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content: userContent,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');
    setIsLoading(true);

    // If connected to real server, create a task
    if (isConnected && onCreateTask) {
      try {
        const task = await onCreateTask({
          title: userContent.slice(0, 100),
          description: userContent,
          priority: 'normal',
          tags: ['manager-instruction'],
        });

        const responseMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId: currentSessionId,
          role: 'manager',
          content: task
            ? `タスクを作成しました。\n\nタスクID: ${task.id}\nタイトル: ${task.title}\nステータス: ${task.status}\n\nManager エージェントが自動的にタスクを取得して処理します。`
            : 'タスクの作成に失敗しました。サーバー接続を確認してください。',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, responseMessage]);
      } catch (error: any) {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId: currentSessionId,
          role: 'manager',
          content: `エラー: ${error.message || 'タスクの作成に失敗しました'}`,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
      setIsLoading(false);
    } else {
      // Fallback to mock response when not connected
      setTimeout(() => {
        const mockResponse: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId: currentSessionId,
          role: 'manager',
          content: `[オフライン モード]\n\nサーバーに接続されていません。\n設定からMCPタスクサーバーに接続してください。\n\n接続後は、このメッセージがタスクとしてManagerエージェントに送信されます。`,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, mockResponse]);
        setIsLoading(false);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAction = (action: ChatAction) => {
    console.log('Action clicked:', action);
    // MOC: Just show a confirmation
    const confirmMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'manager',
      content: `[MOC] アクション「${action.label}」を実行しました。`,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      userId: 'user-001',
      title: `新規セッション ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const handleQuickCommand = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal - Mobile: account for bottom nav bar (~70px) */}
      <div className="fixed inset-x-4 top-4 bottom-[calc(70px+env(safe-area-inset-bottom,0px)+16px)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[600px] sm:h-[80vh] sm:max-h-[700px] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-500/10' : 'bg-primary/10'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isConnected ? 'text-green-500' : 'text-primary'}>
                <rect x="3" y="11" width="6" height="8" rx="1" />
                <rect x="15" y="11" width="6" height="8" rx="1" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Manager Chat
                {isConnected ? (
                  <span className="text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    LIVE
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    OFFLINE
                  </span>
                )}
              </h2>
              <SessionSelector
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelect={setCurrentSessionId}
                onNewSession={handleNewSession}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {sessionMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="text-sm">マネージャーに質問や指示を送信してください</p>
            </div>
          ) : (
            <>
              {sessionMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onAction={handleAction}
                />
              ))}
              {isLoading && (
                <div className="flex justify-start mb-3">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Commands */}
        <QuickCommands onCommand={handleQuickCommand} />

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              disabled={isLoading}
              className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
