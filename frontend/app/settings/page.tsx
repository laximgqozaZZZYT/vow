'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { TIME_OPTIONS } from '@/lib/types/slack';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useUserLevel, getUserLevelTierColors } from '../hooks/useUserLevel';
import { supabase } from '@/lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import XPRecoveryConfirmModal from '../dashboard/components/Modal.XPRecoveryConfirm';
import { useXPRecovery, XPRecoveryResult } from '@/hooks/useXPRecovery';
import { useSkillLevels } from '@/hooks/useSkillLevels';
import { useMultiAgentServer } from '../dashboard/hooks/useMultiAgentServer';
import type { McpServer } from '../dashboard/types/agent.types';
import { useCredentials } from '@/hooks/useCredentials';
import AIProviderSettings from './components/AIProviderSettings';

// Feature flags from environment variables
// Default to false if not set (safer for production)
const ENABLE_SUBSCRIPTION = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION === 'true';

type SettingsSection = 'profile' | 'notifications' | 'integrations' | 'api-keys' | 'jwt-tokens' | 'ai-config';

/**
 * Hook to read section from URL query parameter
 */
function useSectionFromUrl(setActiveSection: (section: SettingsSection) => void) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const section = searchParams.get('section');
    if (section && ['profile', 'notifications', 'integrations', 'ai-config'].includes(section)) {
      setActiveSection(section as SettingsSection);
    }
  }, [searchParams, setActiveSection]);
}

/**
 * Component to handle URL search params reading (wrapped in Suspense)
 */
function SectionFromUrl({ setActiveSection }: { setActiveSection: (section: SettingsSection) => void }) {
  useSectionFromUrl(setActiveSection);
  return null;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [userId, setUserId] = useState<string | null>(null);
  const {
    status: slackStatus,
    loading: slackLoading,
    error: slackError,
    connectSlack,
    disconnectSlack,
    testConnection,
  } = useSlackIntegration();
  
  // Notification preferences
  const {
    preferences: notificationPrefs,
    isLoading: notificationLoading,
    isSaving: notificationSaving,
    error: notificationError,
    updateInAppPreference,
    updateSlackPreference,
    updateWebPushPreference,
  } = useNotificationPreferences();
  
  // Push notifications
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    permission: pushPermission,
    isLoading: pushLoading,
    error: pushError,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();
  
  // User level
  const { userLevel, isLoading: userLevelLoading } = useUserLevel(userId);
  
  // Skill levels
  const { skillLevels, isLoading: skillLevelsLoading, refetch: refetchSkillLevels } = useSkillLevels(userId);
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // XP Recovery state
  const [showXPRecoveryConfirm, setShowXPRecoveryConfirm] = useState(false);
  const [xpRecoveryResult, setXPRecoveryResult] = useState<XPRecoveryResult | null>(null);
  const [showXPRecoveryResult, setShowXPRecoveryResult] = useState(false);
  
  // XP Recovery hook
  const {
    recalculateXP,
    isLoading: xpRecoveryLoading,
    error: xpRecoveryError,
    reset: resetXPRecovery,
  } = useXPRecovery();

  // Auth token for API calls
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Multi-Agent Server hook for MCP configuration
  const multiAgentServer = useMultiAgentServer({ authToken });

  // Credentials hook for OpenAI API key
  const {
    credential: openaiCredential,
    isLoading: credentialLoading,
    isSaving: credentialSaving,
    error: credentialError,
    checkCredential,
    saveCredential,
    deleteCredential,
    clearError: clearCredentialError,
  } = useCredentials(authToken);

  // AI Configuration state
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o');
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [aiConfigSuccess, setAiConfigSuccess] = useState(false);

  // New MCP server form state
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerToken, setNewServerToken] = useState('');
  const [showAddServer, setShowAddServer] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  // Edit server form state
  const [editServerName, setEditServerName] = useState('');
  const [editServerUrl, setEditServerUrl] = useState('');
  const [editServerToken, setEditServerToken] = useState('');
  const [editServerEnabled, setEditServerEnabled] = useState(true);
  const [editServerPriority, setEditServerPriority] = useState(5);

  // Drag and drop state
  const [draggedServerId, setDraggedServerId] = useState<string | null>(null);

  // Debug log state
  const [debugLogs, setDebugLogs] = useState<Map<string, string[]>>(new Map());
  const [debugTesting, setDebugTesting] = useState(false);

  // Load AI config from backend
  useEffect(() => {
    if (authToken) {
      checkCredential('openai').then((info) => {
        if (info?.exists && info.model) {
          setOpenaiModel(info.model);
        }
      });
    }
  }, [authToken, checkCredential]);

  // Save AI config
  const handleSaveAiConfig = async () => {
    if (!authToken) {
      setAiConfigError('ログインが必要です');
      return;
    }

    if (!openaiApiKey.trim()) {
      setAiConfigError('APIキーを入力してください');
      return;
    }

    setAiConfigSaving(true);
    setAiConfigError(null);
    setAiConfigSuccess(false);

    try {
      const success = await saveCredential('openai', {
        apiKey: openaiApiKey,
        model: openaiModel,
      });

      if (success) {
        setAiConfigSuccess(true);
        setOpenaiApiKey(''); // Clear the input after saving
        setTimeout(() => setAiConfigSuccess(false), 3000);
      } else {
        setAiConfigError(credentialError || '保存に失敗しました');
      }
    } catch (err) {
      setAiConfigError(err instanceof Error ? err.message : 'Failed to save AI configuration');
    } finally {
      setAiConfigSaving(false);
    }
  };

  // Delete OpenAI credential
  const handleDeleteOpenAICredential = async () => {
    if (!authToken) {
      setAiConfigError('ログインが必要です');
      return;
    }

    if (!confirm('OpenAI APIキーを削除してもよろしいですか？')) {
      return;
    }

    setAiConfigSaving(true);
    setAiConfigError(null);

    try {
      const success = await deleteCredential('openai');
      if (success) {
        setOpenaiApiKey('');
        setOpenaiModel('gpt-4o');
      } else {
        setAiConfigError(credentialError || '削除に失敗しました');
      }
    } catch (err) {
      setAiConfigError(err instanceof Error ? err.message : 'Failed to delete credential');
    } finally {
      setAiConfigSaving(false);
    }
  };

  // Add new MCP server
  const handleAddServer = () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      setAiConfigError('サーバー名とURLは必須です');
      return;
    }

    multiAgentServer.addServer({
      name: newServerName.trim(),
      serverUrl: newServerUrl.trim(),
      serverToken: newServerToken.trim(),
      enabled: true,
      autoConnect: true,
    });

    // Reset form
    setNewServerName('');
    setNewServerUrl('');
    setNewServerToken('');
    setShowAddServer(false);
    setAiConfigError(null);
  };

  // Delete MCP server
  const handleDeleteServer = (serverId: string) => {
    if (!confirm('このサーバーを削除してもよろしいですか？')) return;
    multiAgentServer.removeServer(serverId);
    if (editingServerId === serverId) {
      setEditingServerId(null);
    }
  };

  // Start editing a server
  const handleStartEditServer = (server: McpServer) => {
    setEditingServerId(server.id);
    setEditServerName(server.name);
    setEditServerUrl(server.serverUrl || '');
    setEditServerToken(''); // Don't show existing token
    setEditServerEnabled(server.enabled);
    setEditServerPriority(server.priority ?? 5);
    setShowAddServer(false);
  };

  // Save edited server
  const handleSaveEditServer = () => {
    if (!editingServerId || !editServerName.trim() || !editServerUrl.trim()) {
      setAiConfigError('サーバー名とURLは必須です');
      return;
    }

    // Build updates object, only including serverToken if it was provided
    const updates: Partial<McpServer> = {
      name: editServerName.trim(),
      serverUrl: editServerUrl.trim(),
      enabled: editServerEnabled,
      priority: editServerPriority,
    };

    // Only update token if user entered a new one
    if (editServerToken.trim()) {
      updates.serverToken = editServerToken.trim();
    }

    multiAgentServer.updateServer(editingServerId, updates);

    setEditingServerId(null);
    setAiConfigError(null);
  };

  // Cancel editing
  const handleCancelEditServer = () => {
    setEditingServerId(null);
    setEditServerName('');
    setEditServerUrl('');
    setEditServerToken('');
    setEditServerEnabled(true);
    setEditServerPriority(5);
  };

  // Drag and drop handlers
  const handleDragStart = (serverId: string) => {
    setDraggedServerId(serverId);
  };

  const handleDragOver = (e: React.DragEvent, targetServerId: string) => {
    e.preventDefault();
    if (!draggedServerId || draggedServerId === targetServerId) return;
  };

  const handleDrop = (e: React.DragEvent, targetServerId: string) => {
    e.preventDefault();
    if (!draggedServerId || draggedServerId === targetServerId) return;

    const servers = [...multiAgentServer.config.servers];
    const sortedServers = servers.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

    const draggedIndex = sortedServers.findIndex(s => s.id === draggedServerId);
    const targetIndex = sortedServers.findIndex(s => s.id === targetServerId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder the array
    const [draggedServer] = sortedServers.splice(draggedIndex, 1);
    sortedServers.splice(targetIndex, 0, draggedServer);

    // Update priorities based on new order - update all servers at once to avoid race conditions
    const updatedServers = sortedServers.map((server, index) => ({
      ...server,
      priority: index + 1,
    }));

    // Use updateConfig to update all servers in a single operation
    multiAgentServer.updateConfig({ servers: updatedServers });

    setDraggedServerId(null);
  };

  const handleDragEnd = () => {
    setDraggedServerId(null);
  };

  // Toggle server connection
  const handleToggleServerConnection = async (server: McpServer) => {
    const connection = multiAgentServer.connections.get(server.id);
    if (connection?.connectionState === 'connected') {
      multiAgentServer.disconnectServer(server.id);
    } else {
      await multiAgentServer.connectServer(server.id);
    }
  };

  // Run debug connection test
  const handleDebugTest = async (server: McpServer) => {
    setDebugTesting(true);
    const sid = server.id;
    const url = server.serverUrl || editServerUrl;

    // Clear previous logs for this server
    setDebugLogs(prev => {
      const next = new Map(prev);
      next.set(sid, []);
      return next;
    });

    // Helper to add log (needs to work with fresh state)
    const log = (msg: string) => {
      const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
      setDebugLogs(prev => {
        const next = new Map(prev);
        const logs = next.get(sid) || [];
        next.set(sid, [...logs, `[${ts}] ${msg}`]);
        return next;
      });
    };

    log(`[INFO] テスト開始: ${server.name} (${url})`);

    // Step 1: Health check
    log(`[STEP 1] ヘルスチェック: GET ${url}/health`);
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      const body = await res.text().catch(() => '(no body)');
      log(`[STEP 1] 結果: status=${res.status}, body=${body.substring(0, 200)}`);
    } catch (err) {
      log(`[STEP 1] エラー: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 2: Auth test
    const token = server.serverToken || editServerToken;
    log(`[STEP 2] 認証テスト: GET ${url}/agents (Bearer token${token ? '付き' : 'なし'})`);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${url}/agents`, { headers, signal: AbortSignal.timeout(5000) });
      const body = await res.text().catch(() => '(no body)');
      log(`[STEP 2] 結果: status=${res.status}, body=${body.substring(0, 200)}`);
    } catch (err) {
      log(`[STEP 2] エラー: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 3: SSE connection test
    log(`[STEP 3] SSE接続テスト: EventSource ${url}/events`);
    try {
      await new Promise<void>((resolve) => {
        const sseUrl = token ? `${url}/events?token=${encodeURIComponent(token)}` : `${url}/events`;
        const es = new EventSource(sseUrl);
        const timeout = setTimeout(() => {
          log(`[STEP 3] 結果: 3秒タイムアウト（接続は開いたが、イベント受信なし）`);
          es.close();
          resolve();
        }, 3000);

        es.onopen = () => {
          log(`[STEP 3] SSE接続オープン成功`);
        };
        es.onmessage = (event) => {
          log(`[STEP 3] イベント受信: ${String(event.data).substring(0, 100)}`);
          clearTimeout(timeout);
          es.close();
          resolve();
        };
        es.onerror = () => {
          log(`[STEP 3] SSE接続エラー（readyState=${es.readyState}）`);
          clearTimeout(timeout);
          es.close();
          resolve();
        };
      });
    } catch (err) {
      log(`[STEP 3] エラー: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Connection state from Map
    const conn = multiAgentServer.connections.get(sid);
    log(`[INFO] 現在のconnection state: ${conn?.connectionState ?? 'なし（未接続）'}`);
    log(`[INFO] テスト完了`);

    setDebugTesting(false);
  };

  // Save debug log as .txt file download
  const handleSaveDebugLog = (server: McpServer) => {
    const logs = debugLogs.get(server.id);
    if (!logs || logs.length === 0) return;

    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-debug-${server.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear debug log for a server
  const handleClearDebugLog = (serverId: string) => {
    setDebugLogs(prev => {
      const next = new Map(prev);
      next.delete(serverId);
      return next;
    });
  };

  // Get user ID and auth token from Supabase session
  useEffect(() => {
    if (!supabase) return;

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      setAuthToken(session?.access_token || null);
    };
    getSession();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUserId(session?.user?.id || null);
      setAuthToken(session?.access_token || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Handle XP recovery confirmation
   * Calls the API and shows the result
   * Validates: Requirements 5.3, 5.5, 5.6
   */
  const handleXPRecoveryConfirm = async () => {
    if (!userId) {
      return;
    }
    
    const result = await recalculateXP(userId);
    setShowXPRecoveryConfirm(false);
    
    if (result) {
      setXPRecoveryResult(result);
      setShowXPRecoveryResult(true);
      // Refetch skill levels after XP recovery
      refetchSkillLevels();
    }
  };

  /**
   * Close the XP recovery result display
   */
  const handleCloseXPRecoveryResult = () => {
    setShowXPRecoveryResult(false);
    setXPRecoveryResult(null);
    resetXPRecovery();
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const success = await testConnection();
    setTestResult({
      success,
      message: success ? 'Test message sent! Check your Slack DMs.' : 'Failed to send test message.',
    });
    setTestingConnection(false);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack?')) return;
    setDisconnecting(true);
    await disconnectSlack();
    setDisconnecting(false);
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode; href?: string }[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      href: '/dashboard/settings/api-keys',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
    {
      id: 'jwt-tokens',
      label: 'JWT Tokens',
      href: '/dashboard/settings/jwt-tokens',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'ai-config',
      label: 'AI設定',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* URL section parameter handler */}
      <Suspense fallback={null}>
        <SectionFromUrl setActiveSection={setActiveSection} />
      </Suspense>

      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="pt-14 flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-14 bottom-0 w-64 border-r border-border bg-card p-4 hidden md:block">
          <nav className="space-y-1">
            {sections.map((section) => (
              section.href ? (
                <Link
                  key={section.id}
                  href={section.href}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {section.icon}
                  {section.label}
                </Link>
              ) : (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              )
            ))}
          </nav>
        </aside>

        {/* Mobile navigation - icons only to prevent overlap */}
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-card border-b border-border">
          <div className="flex justify-around p-2">
            {sections.map((section) => (
              section.href ? (
                <Link
                  key={section.id}
                  href={section.href}
                  className="flex flex-col items-center justify-center p-2 rounded-md transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={section.label}
                >
                  {section.icon}
                  <span className="text-[10px] mt-0.5 truncate max-w-[48px]">{section.label}</span>
                </Link>
              ) : (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-md transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                  title={section.label}
                >
                  {section.icon}
                  <span className="text-[10px] mt-0.5 truncate max-w-[48px]">{section.label}</span>
                </button>
              )
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 md:ml-64 p-4 sm:p-6 mt-14 md:mt-0 overflow-x-hidden">
          <div className="max-w-2xl mx-auto w-full">
            {activeSection === 'profile' && (
              <div className="space-y-6">
                {/* User Level Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">ユーザーレベル</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    {userLevelLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </div>
                    ) : userLevel ? (
                      <div className="space-y-4">
                        {/* Level Badge */}
                        <div className="flex items-center gap-4">
                          {(() => {
                            const colors = getUserLevelTierColors(userLevel.overallTier);
                            return (
                              <div className={`inline-flex items-center gap-2 px-4 py-2 ${colors.bg} ${colors.text} border ${colors.border} rounded-lg text-lg font-medium`}>
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                                </svg>
                                <span className="font-bold text-xl">Lv. {userLevel.overallLevel}</span>
                                <span className="text-sm opacity-80">{colors.labelJa}</span>
                              </div>
                            );
                          })()}
                        </div>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">総経験値</div>
                            <div className="text-2xl font-bold mt-1">
                              {userLevel.totalExperiencePoints.toLocaleString()}
                              <span className="text-sm font-normal text-muted-foreground ml-1">XP</span>
                            </div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">習慣継続力</div>
                            <div className="text-2xl font-bold mt-1">
                              {userLevel.habitContinuityPower}
                              <span className="text-sm font-normal text-muted-foreground ml-1">pt</span>
                            </div>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">レジリエンス</div>
                            <div className="text-2xl font-bold mt-1">
                              {userLevel.resilienceScore}
                              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                            </div>
                          </div>
                        </div>
                        
                        {userLevel.lastCalculatedAt && (
                          <div className="text-xs text-muted-foreground mt-2">
                            最終更新: {new Date(userLevel.lastCalculatedAt).toLocaleString('ja-JP')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">ユーザーレベル情報を取得できませんでした。</p>
                    )}
                  </div>
                </div>
                
                {/* Skill Levels Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">スキルレベル</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    {skillLevelsLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </div>
                    ) : skillLevels.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          習慣に付けたタグごとのスキルレベルです。習慣を完了するとタグに紐づくスキルが上がります。
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {skillLevels.map((skill) => (
                            <div
                              key={skill.tagId}
                              className="flex items-center justify-between p-3 rounded-lg border"
                              style={{
                                backgroundColor: `${skill.tagColor}10`,
                                borderColor: `${skill.tagColor}30`,
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: skill.tagColor }}
                                />
                                <span className="font-medium">{skill.tagName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                  {skill.totalXP.toLocaleString()} XP
                                </span>
                                <span
                                  className="font-bold px-2 py-0.5 rounded text-sm"
                                  style={{
                                    backgroundColor: `${skill.tagColor}20`,
                                    color: skill.tagColor,
                                  }}
                                >
                                  Lv.{skill.level}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        スキルレベルがありません。習慣にタグを付けて完了すると、タグごとのスキルレベルが表示されます。
                      </p>
                    )}
                  </div>
                </div>
                
                {/* XP Recovery Section */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">経験値の再計算</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    {/* Error display - Requirement 5.6 */}
                    {xpRecoveryError && !showXPRecoveryResult && (
                      <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-start gap-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{xpRecoveryError}</span>
                      </div>
                    )}
                    
                    {/* Success result display - Requirement 5.5 */}
                    {showXPRecoveryResult && xpRecoveryResult && xpRecoveryResult.success && (
                      <div className="mb-4 p-4 bg-success/10 border border-success/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-success/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-success mb-2">再計算が完了しました</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">付与された経験値</span>
                                <span className="font-semibold text-foreground">
                                  +{xpRecoveryResult.totalXPAwarded.toLocaleString()} XP
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">処理したアクティビティ</span>
                                <span className="font-medium text-foreground">
                                  {xpRecoveryResult.activitiesProcessed.toLocaleString()} 件
                                </span>
                              </div>
                              {xpRecoveryResult.skipped > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">スキップ（付与済み）</span>
                                  <span className="text-muted-foreground">
                                    {xpRecoveryResult.skipped.toLocaleString()} 件
                                  </span>
                                </div>
                              )}
                              {xpRecoveryResult.levelChange && (
                                <div className="flex items-center justify-between pt-2 border-t border-success/20">
                                  <span className="text-muted-foreground">レベル変更</span>
                                  <span className="font-semibold text-success">
                                    Lv.{xpRecoveryResult.levelChange.oldLevel} → Lv.{xpRecoveryResult.levelChange.newLevel}
                                  </span>
                                </div>
                              )}
                              {xpRecoveryResult.newLevel && !xpRecoveryResult.levelChange && (
                                <div className="flex items-center justify-between pt-2 border-t border-success/20">
                                  <span className="text-muted-foreground">現在のレベル</span>
                                  <span className="font-semibold text-foreground">
                                    Lv.{xpRecoveryResult.newLevel}
                                  </span>
                                </div>
                              )}
                              {/* Skill Levels Display */}
                              {xpRecoveryResult.skillLevels && xpRecoveryResult.skillLevels.length > 0 && (
                                <div className="pt-3 mt-3 border-t border-success/20">
                                  <div className="text-sm text-muted-foreground mb-2">スキルレベル</div>
                                  <div className="flex flex-wrap gap-2">
                                    {xpRecoveryResult.skillLevels.slice(0, 10).map((skill) => (
                                      <div
                                        key={skill.tagId}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                                        style={{
                                          backgroundColor: `${skill.tagColor}20`,
                                          color: skill.tagColor,
                                          border: `1px solid ${skill.tagColor}40`,
                                        }}
                                      >
                                        <span>{skill.tagName}</span>
                                        <span className="opacity-80">Lv.{skill.level}</span>
                                      </div>
                                    ))}
                                    {xpRecoveryResult.skillLevels.length > 10 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{xpRecoveryResult.skillLevels.length - 10} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={handleCloseXPRecoveryResult}
                              className="mt-3 text-sm text-success hover:underline"
                            >
                              閉じる
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">過去の習慣履歴から経験値を再計算</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          過去に完了した習慣の履歴から経験値を再計算し、レベルを更新します。
                          既に付与済みの経験値は重複して付与されません。
                        </p>
                        <button
                          onClick={() => setShowXPRecoveryConfirm(true)}
                          disabled={xpRecoveryLoading || !userId}
                          className="
                            mt-4 px-4 py-2 
                            bg-primary text-primary-foreground 
                            rounded-md shadow-sm
                            hover:opacity-90 
                            focus-visible:outline-2 focus-visible:outline-primary
                            transition-opacity
                            text-sm font-medium
                            disabled:opacity-50 disabled:cursor-not-allowed
                            flex items-center gap-2
                          "
                        >
                          {xpRecoveryLoading ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>処理中...</span>
                            </>
                          ) : (
                            '経験値を再計算'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-muted-foreground">Profile settings coming soon...</p>
                  </div>
                </div>
                
                {/* Subscription Management - Only show when enabled */}
                {ENABLE_SUBSCRIPTION && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Subscription</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">プランを管理</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          サブスクリプションプランの確認・変更、トークン使用量の確認ができます。
                        </p>
                      </div>
                      <Link
                        href="/settings/subscription"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        プランを管理
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
                  
                  {/* Error display */}
                  {notificationError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                      {notificationError}
                    </div>
                  )}
                  
                  {notificationLoading ? (
                    <div className="bg-card border border-border rounded-lg p-6">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* In-App Notifications */}
                      <div className="bg-card border border-border rounded-lg p-6 mb-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium">アプリ内通知</h3>
                            <p className="text-sm text-muted-foreground">ダッシュボードに表示される通知</p>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <label className="flex items-center justify-between">
                            <span className="text-sm">ワークロードコーチング</span>
                            <input
                              type="checkbox"
                              checked={notificationPrefs.inApp.workloadCoaching}
                              onChange={(e) => updateInAppPreference('workloadCoaching', e.target.checked)}
                              disabled={notificationSaving}
                              className="w-4 h-4 rounded border-border"
                            />
                          </label>
                          
                          <label className="flex items-center justify-between">
                            <span className="text-sm">トークン使用量警告</span>
                            <input
                              type="checkbox"
                              checked={notificationPrefs.inApp.tokenWarning}
                              onChange={(e) => updateInAppPreference('tokenWarning', e.target.checked)}
                              disabled={notificationSaving}
                              className="w-4 h-4 rounded border-border"
                            />
                          </label>
                          
                          <label className="flex items-center justify-between">
                            <span className="text-sm">週次レポート</span>
                            <input
                              type="checkbox"
                              checked={notificationPrefs.inApp.weeklyReport}
                              onChange={(e) => updateInAppPreference('weeklyReport', e.target.checked)}
                              disabled={notificationSaving}
                              className="w-4 h-4 rounded border-border"
                            />
                          </label>
                        </div>
                      </div>
                      
                      {/* Web Push Notifications */}
                      <div className="bg-card border border-border rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-medium">プッシュ通知</h3>
                            <p className="text-sm text-muted-foreground">ブラウザのプッシュ通知</p>
                          </div>
                        </div>
                        
                        {!pushSupported ? (
                          <p className="text-sm text-muted-foreground">
                            お使いのブラウザはプッシュ通知に対応していません。
                          </p>
                        ) : pushPermission === 'denied' ? (
                          <p className="text-sm text-destructive">
                            プッシュ通知がブロックされています。ブラウザの設定から許可してください。
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {pushError && (
                              <p className="text-sm text-destructive">{pushError}</p>
                            )}
                            
                            {!pushSubscribed ? (
                              <button
                                onClick={subscribePush}
                                disabled={pushLoading}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {pushLoading ? '設定中...' : 'プッシュ通知を有効化'}
                              </button>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  プッシュ通知が有効です
                                </div>
                                
                                <label className="flex items-center justify-between">
                                  <span className="text-sm">デイリーリマインダー</span>
                                  <input
                                    type="checkbox"
                                    checked={notificationPrefs.webPush.dailyReminder}
                                    onChange={(e) => updateWebPushPreference('dailyReminder', e.target.checked)}
                                    disabled={notificationSaving}
                                    className="w-4 h-4 rounded border-border"
                                  />
                                </label>
                                
                                {notificationPrefs.webPush.dailyReminder && (
                                  <div className="flex items-center justify-between pl-4">
                                    <span className="text-sm">リマインダー時刻</span>
                                    <select
                                      value={notificationPrefs.webPush.dailyReminderTime}
                                      onChange={(e) => updateWebPushPreference('dailyReminderTime', e.target.value)}
                                      disabled={notificationSaving}
                                      className="px-2 py-1 text-sm bg-background border border-border rounded-md"
                                    >
                                      {TIME_OPTIONS.map(time => (
                                        <option key={time.value} value={time.value}>{time.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                
                                <label className="flex items-center justify-between">
                                  <span className="text-sm">ワークロードコーチング</span>
                                  <input
                                    type="checkbox"
                                    checked={notificationPrefs.webPush.workloadCoaching}
                                    onChange={(e) => updateWebPushPreference('workloadCoaching', e.target.checked)}
                                    disabled={notificationSaving}
                                    className="w-4 h-4 rounded border-border"
                                  />
                                </label>
                                
                                <button
                                  onClick={unsubscribePush}
                                  disabled={pushLoading}
                                  className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                                >
                                  {pushLoading ? '解除中...' : 'プッシュ通知を無効化'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'ai-config' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">AI設定</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    AIエージェントの接続設定を管理します。MCPサーバーまたはOpenAI APIを使用して、複数のAIエージェントを統合できます。
                  </p>

                  {/* Error/Success display */}
                  {aiConfigError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                      {aiConfigError}
                    </div>
                  )}
                  {aiConfigSuccess && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-700 dark:text-green-300 text-sm">
                      設定を保存しました
                    </div>
                  )}

                  {/* MCP Server Configuration */}
                  <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium">MCPサーバー</h3>
                        <p className="text-sm text-muted-foreground">マルチエージェントタスクサーバーへの接続</p>
                      </div>
                    </div>

                    {/* Server List */}
                    <div className="space-y-3 mb-4">
                      {multiAgentServer.config.servers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                          </svg>
                          <p className="text-sm">MCPサーバーが設定されていません</p>
                          <p className="text-xs mt-1">下のボタンからサーバーを追加してください</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground mb-2">
                            ドラッグ&ドロップで優先順位を変更できます。クリックで編集画面を開きます。
                          </p>
                          {[...multiAgentServer.config.servers]
                            .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
                            .map((server) => {
                              const connection = multiAgentServer.connections.get(server.id);
                              const isConnected = connection?.connectionState === 'connected';
                              const isConnecting = connection?.connectionState === 'connecting';
                              const hasError = connection?.connectionState === 'error';
                              const isDragging = draggedServerId === server.id;

                              return (
                                <div
                                  key={server.id}
                                  draggable
                                  onDragStart={() => handleDragStart(server.id)}
                                  onDragOver={(e) => handleDragOver(e, server.id)}
                                  onDrop={(e) => handleDrop(e, server.id)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => handleStartEditServer(server)}
                                  className={`p-3 bg-muted/50 rounded-lg border transition-all cursor-pointer ${
                                    isDragging
                                      ? 'border-primary opacity-50'
                                      : editingServerId === server.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50 hover:bg-muted'
                                  }`}
                                >
                                  <div className="flex items-start sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                      {/* Drag handle */}
                                      <div className="flex-shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing hidden sm:block">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                        </svg>
                                      </div>
                                      {/* Priority badge */}
                                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/10 rounded text-xs font-medium text-primary" title={`優先度: ${server.priority ?? 5}`}>
                                        {server.priority ?? 5}
                                      </div>
                                      {/* Status indicator */}
                                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                        isConnected ? 'bg-green-500' :
                                        isConnecting ? 'bg-yellow-500 animate-pulse' :
                                        hasError ? 'bg-red-500' :
                                        'bg-gray-400'
                                      }`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm">{server.name}</span>
                                          {!server.enabled && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                              無効
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[200px]">
                                          {server.serverUrl}
                                        </div>
                                        {hasError && connection?.error && (
                                          <div className="text-xs text-destructive mt-1 break-words">
                                            {connection.error}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleServerConnection(server);
                                        }}
                                        disabled={isConnecting}
                                        className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-md transition-colors ${
                                          isConnected
                                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                                        } disabled:opacity-50`}
                                      >
                                        {isConnecting ? '...' : isConnected ? '切断' : '接続'}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteServer(server.id);
                                        }}
                                        className="p-1 sm:p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                                        title="削除"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </>
                      )}
                    </div>

                    {/* Edit Server Form */}
                    {editingServerId && (
                      <div className="border border-primary rounded-lg p-4 bg-primary/5 mb-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          サーバーを編集
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">サーバー名</label>
                            <input
                              type="text"
                              value={editServerName}
                              onChange={(e) => setEditServerName(e.target.value)}
                              placeholder="例: Production Server"
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">サーバーURL</label>
                            <input
                              type="url"
                              value={editServerUrl}
                              onChange={(e) => setEditServerUrl(e.target.value)}
                              placeholder="例: http://localhost:3456"
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">認証トークン（変更する場合のみ入力）</label>
                            <input
                              type="password"
                              value={editServerToken}
                              onChange={(e) => setEditServerToken(e.target.value)}
                              placeholder="新しいトークンを入力..."
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground mt-1">空欄の場合は既存のトークンを保持します</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">優先度 ({editServerPriority})</label>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              value={editServerPriority}
                              onChange={(e) => setEditServerPriority(Number(e.target.value))}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>1 (最高)</span>
                              <span>10 (最低)</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="edit-server-enabled"
                              checked={editServerEnabled}
                              onChange={(e) => setEditServerEnabled(e.target.checked)}
                              className="w-4 h-4 rounded border-border"
                            />
                            <label htmlFor="edit-server-enabled" className="text-sm">
                              このサーバーを有効にする
                            </label>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleSaveEditServer}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancelEditServer}
                              className="px-4 py-2 text-foreground hover:bg-muted rounded-md text-sm transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>

                          {/* Debug Log Section */}
                          {(() => {
                            const debugServer = multiAgentServer.config.servers.find(s => s.id === editingServerId);
                            if (!debugServer) return null;
                            const logs = debugLogs.get(debugServer.id) || [];
                            return (
                              <div className="border-t border-border pt-4 mt-4">
                                <h5 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  デバッグログ
                                </h5>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <button
                                    onClick={() => handleDebugTest(debugServer)}
                                    disabled={debugTesting}
                                    className="px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                  >
                                    {debugTesting ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        テスト中...
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        接続テスト（デバッグ）
                                      </>
                                    )}
                                  </button>
                                  {logs.length > 0 && (
                                    <>
                                      <button
                                        onClick={() => handleSaveDebugLog(debugServer)}
                                        className="px-3 py-1.5 border border-border text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors flex items-center gap-1.5"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        ログを保存
                                      </button>
                                      <button
                                        onClick={() => handleClearDebugLog(debugServer.id)}
                                        className="px-3 py-1.5 border border-border text-muted-foreground rounded-md text-xs font-medium hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        ログをクリア
                                      </button>
                                    </>
                                  )}
                                </div>
                                {logs.length > 0 && (
                                  <pre className="bg-black/80 text-green-400 text-xs font-mono p-3 rounded-md max-h-64 overflow-auto whitespace-pre-wrap break-all">
                                    {logs.join('\n')}
                                  </pre>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Add Server Form */}
                    {showAddServer ? (
                      <div className="border border-border rounded-lg p-4 bg-muted/30">
                        <h4 className="font-medium mb-3">新しいサーバーを追加</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">サーバー名</label>
                            <input
                              type="text"
                              value={newServerName}
                              onChange={(e) => setNewServerName(e.target.value)}
                              placeholder="例: Production Server"
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">サーバーURL</label>
                            <input
                              type="url"
                              value={newServerUrl}
                              onChange={(e) => setNewServerUrl(e.target.value)}
                              placeholder="例: http://localhost:3456"
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">認証トークン</label>
                            <input
                              type="password"
                              value={newServerToken}
                              onChange={(e) => setNewServerToken(e.target.value)}
                              placeholder="サーバー認証トークン"
                              className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleAddServer}
                              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              追加
                            </button>
                            <button
                              onClick={() => {
                                setShowAddServer(false);
                                setNewServerName('');
                                setNewServerUrl('');
                                setNewServerToken('');
                              }}
                              className="px-4 py-2 text-foreground hover:bg-muted rounded-md text-sm transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowAddServer(true);
                          setEditingServerId(null); // Close edit form when adding new server
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary transition-colors w-full justify-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        サーバーを追加
                      </button>
                    )}
                  </div>

                  {/* Chat Agent Settings */}
                  <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium">チャットエージェント設定</h3>
                        <p className="text-sm text-muted-foreground">MOCセクションでのチャット時に使用するエージェント</p>
                      </div>
                    </div>

                    {/* MCP Agent Toggle */}
                    <div className="space-y-4">
                      <div className="flex items-start sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <label className="text-sm font-medium">MCPエージェントを使用</label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            MCPサーバ接続時、チャットにMCPエージェントを使用します
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current = multiAgentServer.chatAgentSettings;
                            multiAgentServer.updateChatAgentSettings({ useMcpAgent: !current.useMcpAgent });
                          }}
                          disabled={multiAgentServer.config.servers.length === 0}
                          className={`
                            relative w-11 h-6 rounded-full transition-colors
                            ${multiAgentServer.chatAgentSettings.useMcpAgent ? 'bg-primary' : 'bg-muted-foreground/30'}
                            ${multiAgentServer.config.servers.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <span
                            className={`
                              absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow
                              ${multiAgentServer.chatAgentSettings.useMcpAgent ? 'translate-x-5' : ''}
                            `}
                          />
                        </button>
                      </div>

                      {multiAgentServer.config.servers.length === 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            MCPサーバが設定されていません。上記でサーバを追加してからこの機能を有効にしてください。
                          </p>
                        </div>
                      )}

                      {/* Server Selection Mode */}
                      {multiAgentServer.chatAgentSettings.useMcpAgent && multiAgentServer.config.servers.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">サーバ選択モード</label>
                          <select
                            value={multiAgentServer.chatAgentSettings.selectionMode || 'manual'}
                            onChange={(e) => {
                              const mode = e.target.value as 'manual' | 'priority' | 'failover';
                              multiAgentServer.updateChatAgentSettings({
                                selectionMode: mode,
                                mcpServerId: mode !== 'manual' ? undefined : multiAgentServer.chatAgentSettings.mcpServerId,
                                mcpAgentId: undefined,
                              });
                            }}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="manual">手動選択</option>
                            <option value="priority">優先順位自動選択</option>
                            <option value="failover">フェイルオーバー</option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            {multiAgentServer.chatAgentSettings.selectionMode === 'priority'
                              ? '優先度の高い（数字の小さい）接続サーバを自動選択'
                              : multiAgentServer.chatAgentSettings.selectionMode === 'failover'
                              ? '優先順位に従ってフェイルオーバー（接続失敗時に次のサーバを試行）'
                              : '使用するサーバを手動で選択'}
                          </p>
                        </div>
                      )}

                      {/* Server Selection (Manual Mode) */}
                      {multiAgentServer.chatAgentSettings.useMcpAgent &&
                        multiAgentServer.config.servers.length > 0 &&
                        (multiAgentServer.chatAgentSettings.selectionMode || 'manual') === 'manual' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">MCPサーバ</label>
                          <select
                            value={multiAgentServer.chatAgentSettings.mcpServerId || ''}
                            onChange={(e) => multiAgentServer.updateChatAgentSettings({
                              mcpServerId: e.target.value || undefined,
                              mcpAgentId: undefined,
                            })}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">自動選択</option>
                            {[...multiAgentServer.config.servers]
                              .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
                              .map(server => {
                                const conn = multiAgentServer.connections.get(server.id);
                                const isConnected = conn?.connectionState === 'connected';
                                return (
                                  <option key={server.id} value={server.id}>
                                    [{server.priority ?? 5}] {server.name} {isConnected ? '✓' : '○'}
                                  </option>
                                );
                              })}
                          </select>
                          <p className="text-xs text-muted-foreground">✓=接続中 ○=未接続</p>
                        </div>
                      )}

                      {/* Priority Server List (Priority/Failover Mode) */}
                      {multiAgentServer.chatAgentSettings.useMcpAgent &&
                        multiAgentServer.config.servers.length > 0 &&
                        (multiAgentServer.chatAgentSettings.selectionMode === 'priority' || multiAgentServer.chatAgentSettings.selectionMode === 'failover') && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">サーバ優先順位</label>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {[...multiAgentServer.config.servers]
                              .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
                              .map((server, idx) => {
                                const conn = multiAgentServer.connections.get(server.id);
                                const isConnected = conn?.connectionState === 'connected';
                                return (
                                  <div
                                    key={server.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                                      idx === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                                    }`}
                                  >
                                    <span className="w-6 h-6 flex items-center justify-center bg-primary/20 rounded text-xs font-medium">
                                      {server.priority ?? 5}
                                    </span>
                                    <span className="flex-1 truncate">{server.name}</span>
                                    <span className={`text-xs ${isConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                                      {isConnected ? '接続中' : '未接続'}
                                    </span>
                                    {idx === 0 && isConnected && (
                                      <span className="text-xs text-primary font-medium">使用中</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ※ 優先度は上記のサーバ一覧で変更できます
                          </p>
                        </div>
                      )}

                      {/* Agent Selection */}
                      {multiAgentServer.chatAgentSettings.useMcpAgent &&
                        multiAgentServer.config.servers.length > 0 &&
                        multiAgentServer.agents.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">エージェント</label>
                          <select
                            value={multiAgentServer.chatAgentSettings.mcpAgentId || ''}
                            onChange={(e) => multiAgentServer.updateChatAgentSettings({ mcpAgentId: e.target.value || undefined })}
                            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">自動選択（最初のエージェント）</option>
                            {multiAgentServer.agents
                              .filter(a => !multiAgentServer.chatAgentSettings.mcpServerId || a.serverId === multiAgentServer.chatAgentSettings.mcpServerId)
                              .map(agent => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name} ({agent.role}) - {agent.serverName}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Fallback Setting */}
                      {multiAgentServer.chatAgentSettings.useMcpAgent && (
                        <div className="flex items-start sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border-t border-border mt-4">
                          <div className="flex-1 min-w-0">
                            <label className="text-sm font-medium">フォールバック</label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              MCP接続失敗時、デフォルトAIに切り替え
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              multiAgentServer.updateChatAgentSettings({
                                fallbackToApi: !multiAgentServer.chatAgentSettings.fallbackToApi
                              });
                            }}
                            className={`
                              relative w-11 h-6 rounded-full transition-colors
                              ${multiAgentServer.chatAgentSettings.fallbackToApi ? 'bg-primary' : 'bg-muted-foreground/30'}
                            `}
                          >
                            <span
                              className={`
                                absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow
                                ${multiAgentServer.chatAgentSettings.fallbackToApi ? 'translate-x-5' : ''}
                              `}
                            />
                          </button>
                        </div>
                      )}

                      {/* Current Status */}
                      <div className="pt-4 mt-4 border-t border-border">
                        <h4 className="text-sm font-medium mb-2">現在の状態</h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">チャットエージェント</span>
                            <span className={`font-medium ${
                              multiAgentServer.chatAgentSettings.useMcpAgent &&
                              Array.from(multiAgentServer.connections.values()).some(c => c.connectionState === 'connected')
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-muted-foreground'
                            }`}>
                              {multiAgentServer.chatAgentSettings.useMcpAgent &&
                              Array.from(multiAgentServer.connections.values()).some(c => c.connectionState === 'connected')
                                ? 'MCPエージェント'
                                : 'デフォルトAI'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">登録サーバ数</span>
                            <span className="font-medium">{multiAgentServer.config.servers.length}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">接続サーバ数</span>
                            <span className="font-medium">
                              {Array.from(multiAgentServer.connections.values()).filter(c => c.connectionState === 'connected').length}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">利用可能エージェント</span>
                            <span className="font-medium">{multiAgentServer.agents.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Provider API Keys Configuration */}
                  <AIProviderSettings authToken={authToken} />
                </div>
              </div>
            )}

            {activeSection === 'integrations' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Integrations</h2>

                  {/* Error display */}
                  {slackError && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                      {slackError}
                    </div>
                  )}

                  {/* Test result display */}
                  {testResult && (
                    <div className={`mb-4 p-3 rounded-md text-sm ${
                      testResult.success
                        ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300'
                        : 'bg-destructive/10 border border-destructive/20 text-destructive'
                    }`}>
                      {testResult.message}
                    </div>
                  )}

                  {/* Slack Integration Section */}
                  <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="w-12 h-12 bg-[#4A154B] rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium">Slack</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Connect Slack to report habit completions, receive follow-up reminders, and get weekly reports.
                        </p>
                        
                        {slackLoading ? (
                          <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Loading...
                          </div>
                        ) : slackStatus?.connected ? (
                          <div className="mt-4 space-y-4">
                            {/* Connected status */}
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <span className="text-green-700 dark:text-green-300">Connected</span>
                              {slackStatus.connection?.slackTeamName && (
                                <span className="text-muted-foreground">
                                  to {slackStatus.connection.slackTeamName}
                                </span>
                              )}
                            </div>
                            
                            {/* Preferences */}
                            <div className="space-y-3 pt-2 border-t border-border">
                              <h4 className="text-sm font-medium text-muted-foreground">通知設定</h4>
                              
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Slack通知を有効化</span>
                                <input
                                  type="checkbox"
                                  checked={notificationPrefs.slack.enabled}
                                  onChange={(e) => updateSlackPreference('enabled', e.target.checked)}
                                  disabled={notificationSaving}
                                  className="w-4 h-4 rounded border-border"
                                />
                              </label>
                              
                              {notificationPrefs.slack.enabled && (
                                <>
                                  <label className="flex items-center justify-between pl-4">
                                    <span className="text-sm">ワークロードコーチング</span>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs.slack.workloadCoaching}
                                      onChange={(e) => updateSlackPreference('workloadCoaching', e.target.checked)}
                                      disabled={notificationSaving}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                  </label>
                                  
                                  <label className="flex items-center justify-between pl-4">
                                    <span className="text-sm">トークン使用量警告</span>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs.slack.tokenWarning}
                                      onChange={(e) => updateSlackPreference('tokenWarning', e.target.checked)}
                                      disabled={notificationSaving}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                  </label>
                                  
                                  <label className="flex items-center justify-between pl-4">
                                    <span className="text-sm">週次レポート</span>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs.slack.weeklyReport}
                                      onChange={(e) => updateSlackPreference('weeklyReport', e.target.checked)}
                                      disabled={notificationSaving}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                  </label>
                                  
                                  <div className="flex items-center justify-between pl-4">
                                    <span className="text-sm">通知時刻</span>
                                    <select
                                      value={notificationPrefs.slack.notificationTime}
                                      onChange={(e) => updateSlackPreference('notificationTime', e.target.value)}
                                      disabled={notificationSaving}
                                      className="px-2 py-1 text-sm bg-background border border-border rounded-md"
                                    >
                                      {TIME_OPTIONS.map(time => (
                                        <option key={time.value} value={time.value}>{time.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                onClick={handleTestConnection}
                                disabled={testingConnection}
                                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                              >
                                {testingConnection ? 'Sending...' : 'Test Connection'}
                              </button>
                              <button
                                onClick={handleDisconnect}
                                disabled={disconnecting}
                                className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                              >
                                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4">
                            <button
                              onClick={connectSlack}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              Connect Slack
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* XP Recovery Confirmation Modal */}
      <XPRecoveryConfirmModal
        isOpen={showXPRecoveryConfirm}
        onClose={() => setShowXPRecoveryConfirm(false)}
        onConfirm={handleXPRecoveryConfirm}
        loading={xpRecoveryLoading}
      />
    </div>
  );
}
