'use client';

/**
 * Section.AIAssistant - Unified AI Assistant Section
 *
 * Combines Coach and Manager modes into a single AI Assistant interface.
 * Features:
 * - Mode switching UI (Coach | Manager tabs)
 * - Premium/Admin user check
 * - MCP connection state indicator
 * - Settings button for Multi-Agent configuration
 * - Responsive layout for mobile and desktop
 *
 * @module Section.AIAssistant
 */

import { useState, useCallback } from 'react';
import { useAIAssistantMode, type AIAssistantMode } from '../hooks/useAIAssistantMode';
import { useAuth } from '../hooks/useAuth';
import { useMultiAgentServerContext } from '../contexts/MultiAgentServerContext';
import type { ConnectionState } from '../hooks/useMultiAgentServer';
import MultiAgentConfigModal from './Modal.MultiAgentConfig';
import type { Goal, Habit } from '../types';

/**
 * Props for AIAssistantSection component
 */
export interface AIAssistantSectionProps {
  /** List of user goals */
  goals: Goal[];
  /** List of user habits */
  habits: Habit[];
  /** Callback when a habit is created */
  onHabitCreated?: () => void;
  /** Callback when a goal is created */
  onGoalCreated?: () => void;
  /** Language preference */
  locale?: 'ja' | 'en';
}

/**
 * Header component with mode toggle and connection state
 */
function Header({
  mode,
  onModeChange,
  connectionState,
  onSettingsClick,
  locale = 'ja',
}: {
  mode: AIAssistantMode;
  onModeChange: (mode: AIAssistantMode) => void;
  connectionState: ConnectionState;
  onSettingsClick: () => void;
  locale?: 'ja' | 'en';
}) {
  const labels = {
    ja: {
      coach: 'Coach',
      manager: 'Manager',
      connected: '接続中',
      connecting: '接続処理中',
      disconnected: '未接続',
      error: '接続エラー',
      settings: '設定',
    },
    en: {
      coach: 'Coach',
      manager: 'Manager',
      connected: 'Connected',
      connecting: 'Connecting',
      disconnected: 'Disconnected',
      error: 'Error',
      settings: 'Settings',
    },
  };

  const t = labels[locale];

  const connectionStatusConfig: Record<
    ConnectionState,
    { color: string; pulseClass: string; label: string }
  > = {
    connected: {
      color: 'bg-green-500',
      pulseClass: '',
      label: t.connected,
    },
    connecting: {
      color: 'bg-yellow-500',
      pulseClass: 'animate-pulse',
      label: t.connecting,
    },
    disconnected: {
      color: 'bg-gray-400',
      pulseClass: '',
      label: t.disconnected,
    },
    error: {
      color: 'bg-red-500',
      pulseClass: '',
      label: t.error,
    },
  };

  const status = connectionStatusConfig[connectionState];

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card">
      {/* Title and Mode Toggle */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span>🤖</span>
          <span>AI Assistant</span>
        </h2>

        {/* Mode Toggle Tabs */}
        <div className="flex items-center bg-muted rounded-lg p-1">
          <button
            onClick={() => onModeChange('coach')}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${
                mode === 'coach'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }
            `}
          >
            {t.coach}
          </button>
          <button
            onClick={() => onModeChange('manager')}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-all
              ${
                mode === 'manager'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }
            `}
          >
            {t.manager}
          </button>
        </div>
      </div>

      {/* Connection Status and Settings */}
      <div className="flex items-center gap-3">
        {/* MCP Connection Indicator */}
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          title={status.label}
        >
          <span
            className={`w-2 h-2 rounded-full ${status.color} ${status.pulseClass}`}
          />
          <span className="hidden sm:inline">{status.label}</span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="
            p-2 rounded-md text-muted-foreground
            hover:text-foreground hover:bg-muted
            transition-colors
          "
          title={t.settings}
          aria-label={t.settings}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

/**
 * Premium Required Message Component
 */
function PremiumRequiredMessage({ locale = 'ja' }: { locale?: 'ja' | 'en' }) {
  const content = {
    ja: {
      title: 'AI Assistant機能はPremiumプランで利用可能',
      description:
        'AIコーチング、マネージャー機能、MCP連携などをご利用いただけます。',
      cta: 'プランを見る',
    },
    en: {
      title: 'AI Assistant is available with Premium plan',
      description:
        'Get access to AI coaching, manager features, and MCP integration.',
      cta: 'View Plans',
    },
  };

  const t = content[locale];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🔒</div>
        <h3 className="font-semibold text-lg mb-2">{t.title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{t.description}</p>
        <a
          href="/dashboard/settings/subscription"
          className="
            inline-flex items-center gap-2 px-5 py-2.5
            bg-primary text-primary-foreground rounded-lg
            font-medium hover:opacity-90 transition-opacity
          "
        >
          {t.cta}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}

/**
 * Placeholder for Coach Mode View
 * Will be replaced with actual implementation in subsequent tasks
 */
function CoachModeView({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  locale = 'ja',
}: {
  goals: Goal[];
  habits: Habit[];
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
  locale?: 'ja' | 'en';
}) {
  const content = {
    ja: {
      title: 'Coach Mode',
      description: 'AIコーチがあなたの習慣形成をサポートします。',
      placeholder: '後続タスクで実装予定',
    },
    en: {
      title: 'Coach Mode',
      description: 'AI coach supports your habit building journey.',
      placeholder: 'To be implemented in subsequent tasks',
    },
  };

  const t = content[locale];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4">🎯</div>
      <h3 className="font-semibold text-lg mb-2">{t.title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t.description}</p>
      <div className="px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground">
        {t.placeholder}
      </div>
      {/* Debug info - remove in production */}
      <div className="mt-4 text-xs text-muted-foreground">
        Goals: {goals.length} | Habits: {habits.length}
      </div>
    </div>
  );
}

/**
 * Placeholder for Manager Mode View
 * Will be replaced with actual implementation in subsequent tasks
 */
function ManagerModeView({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  locale = 'ja',
}: {
  goals: Goal[];
  habits: Habit[];
  onHabitCreated?: () => void;
  onGoalCreated?: () => void;
  locale?: 'ja' | 'en';
}) {
  const content = {
    ja: {
      title: 'Manager Mode',
      description: 'AIマネージャーがタスクを管理・監督します。',
      placeholder: '後続タスクで実装予定',
    },
    en: {
      title: 'Manager Mode',
      description: 'AI manager oversees and manages your tasks.',
      placeholder: 'To be implemented in subsequent tasks',
    },
  };

  const t = content[locale];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4">📋</div>
      <h3 className="font-semibold text-lg mb-2">{t.title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t.description}</p>
      <div className="px-4 py-2 bg-muted rounded-md text-sm text-muted-foreground">
        {t.placeholder}
      </div>
      {/* Debug info - remove in production */}
      <div className="mt-4 text-xs text-muted-foreground">
        Goals: {goals.length} | Habits: {habits.length}
      </div>
    </div>
  );
}

/**
 * Unified Input Area Component
 * Shared between Coach and Manager modes
 */
function UnifiedInputArea({
  mode,
  locale = 'ja',
  disabled = false,
}: {
  mode: AIAssistantMode;
  locale?: 'ja' | 'en';
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');

  const placeholders = {
    ja: {
      coach: '例: 毎朝7時に30分ジョギングする',
      manager: '例: タスクを作成して担当者を割り当てて',
    },
    en: {
      coach: 'e.g., Jog for 30 minutes at 7am every day',
      manager: 'e.g., Create a task and assign it to someone',
    },
  };

  const sendLabel = locale === 'ja' ? '送信' : 'Send';

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || disabled) return;
      // TODO: Implement send functionality in subsequent tasks
      console.log(`[${mode}] Send:`, input);
      setInput('');
    },
    [input, mode, disabled]
  );

  return (
    <div className="border-t border-border bg-card p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholders[locale][mode]}
          disabled={disabled}
          className="
            flex-1 px-3 sm:px-4 py-2 sm:py-3
            rounded-lg border border-input bg-background
            text-sm sm:text-base
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="
            px-4 sm:px-6 py-2 sm:py-3
            bg-primary text-primary-foreground rounded-lg
            font-medium text-sm sm:text-base
            hover:opacity-90 transition-opacity
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          {sendLabel}
        </button>
      </form>
    </div>
  );
}

/**
 * AIAssistantSection - Main Component
 *
 * Unified AI Assistant interface combining Coach and Manager modes.
 * Requires Premium or Admin access.
 */
export default function AIAssistantSection({
  goals,
  habits,
  onHabitCreated,
  onGoalCreated,
  locale = 'ja',
}: AIAssistantSectionProps) {
  // Hooks
  const { mode, setMode, isCoachMode, isManagerMode } = useAIAssistantMode();
  const { isPremium, isAdmin, authToken } = useAuth();
  const multiAgentServer = useMultiAgentServerContext();

  // Local state
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Check access
  const hasAccess = isPremium || isAdmin;

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    setShowConfigModal(true);
  }, []);

  // Handle config modal close
  const handleConfigModalClose = useCallback(() => {
    setShowConfigModal(false);
  }, []);

  // Test connection handler for the config modal
  const handleTestConnection = useCallback(
    async (
      url: string,
      token: string
    ): Promise<{ success: boolean; message: string }> => {
      try {
        const response = await fetch(`${url}/health`);
        if (response.ok) {
          return { success: true, message: locale === 'ja' ? '接続成功' : 'Connection successful' };
        }
        return {
          success: false,
          message: locale === 'ja' ? '接続失敗' : 'Connection failed',
        };
      } catch {
        return {
          success: false,
          message: locale === 'ja' ? '接続エラー' : 'Connection error',
        };
      }
    },
    [locale]
  );

  // If no access, show premium required message
  if (!hasAccess) {
    return (
      <section className="flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-card border border-border rounded-lg shadow-sm">
        <Header
          mode={mode}
          onModeChange={setMode}
          connectionState="disconnected"
          onSettingsClick={handleSettingsClick}
          locale={locale}
        />
        <PremiumRequiredMessage locale={locale} />
      </section>
    );
  }

  return (
    <section className="flex flex-col h-full min-h-[400px] md:min-h-[500px] bg-card border border-border rounded-lg shadow-sm">
      {/* Header with mode toggle */}
      <Header
        mode={mode}
        onModeChange={setMode}
        connectionState={multiAgentServer.connectionState}
        onSettingsClick={handleSettingsClick}
        locale={locale}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {isCoachMode && (
          <CoachModeView
            goals={goals}
            habits={habits}
            onHabitCreated={onHabitCreated}
            onGoalCreated={onGoalCreated}
            locale={locale}
          />
        )}
        {isManagerMode && (
          <ManagerModeView
            goals={goals}
            habits={habits}
            onHabitCreated={onHabitCreated}
            onGoalCreated={onGoalCreated}
            locale={locale}
          />
        )}
      </div>

      {/* Unified Input Area */}
      <UnifiedInputArea mode={mode} locale={locale} />

      {/* Multi-Agent Config Modal */}
      <MultiAgentConfigModal
        isOpen={showConfigModal}
        onClose={handleConfigModalClose}
        config={multiAgentServer.config}
        onUpdateConfig={multiAgentServer.updateConfig}
        connections={multiAgentServer.connections}
        connectionState={multiAgentServer.connectionState}
        error={multiAgentServer.error}
        onAddServer={multiAgentServer.addServer}
        onUpdateServer={multiAgentServer.updateServer}
        onRemoveServer={multiAgentServer.removeServer}
        onConnectServer={multiAgentServer.connectServer}
        onDisconnectServer={multiAgentServer.disconnectServer}
        onConnectAllEnabled={multiAgentServer.connectAllEnabled}
        onDisconnectAll={multiAgentServer.disconnectAll}
      />
    </section>
  );
}

// Named export for flexibility
export { AIAssistantSection };
