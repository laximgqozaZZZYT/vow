'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { TIME_OPTIONS } from '@/lib/types/slack';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useUserLevel, getUserLevelTierColors } from '../hooks/useUserLevel';
import { supabase } from '@/lib/supabaseClient';

// Feature flags from environment variables
// Default to false if not set (safer for production)
const ENABLE_SUBSCRIPTION = process.env.NEXT_PUBLIC_ENABLE_SUBSCRIPTION === 'true';

type SettingsSection = 'profile' | 'notifications' | 'integrations' | 'api-keys';

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
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Get user ID from Supabase session
  useEffect(() => {
    const getUserId = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id || null);
      }
    };
    getUserId();
  }, []);

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
  ];

  return (
    <div className="min-h-screen bg-background">
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

        {/* Mobile navigation */}
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-card border-b border-border">
          <div className="flex overflow-x-auto p-2 gap-2">
            {sections.map((section) => (
              section.href ? (
                <Link
                  key={section.id}
                  href={section.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors text-muted-foreground hover:bg-accent"
                >
                  {section.icon}
                  {section.label}
                </Link>
              ) : (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {section.icon}
                  {section.label}
                </button>
              )
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 md:ml-64 p-6 mt-12 md:mt-0">
          <div className="max-w-2xl mx-auto">
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
                  <div className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-start gap-4">
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
    </div>
  );
}
