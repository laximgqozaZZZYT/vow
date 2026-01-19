'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSlackIntegration } from '@/hooks/useSlackIntegration';
import { DAYS_OF_WEEK, TIME_OPTIONS } from '@/lib/types/slack';

type SettingsSection = 'profile' | 'notifications' | 'integrations';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('integrations');
  const {
    status: slackStatus,
    loading: slackLoading,
    error: slackError,
    connectSlack,
    disconnectSlack,
    updatePreferences,
    testConnection,
  } = useSlackIntegration();
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

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

  const handlePreferenceChange = async (key: string, value: boolean | number | string) => {
    await updatePreferences({ [key]: value });
  };

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
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
            ))}
          </nav>
        </aside>

        {/* Mobile navigation */}
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-card border-b border-border">
          <div className="flex overflow-x-auto p-2 gap-2">
            {sections.map((section) => (
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
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 md:ml-64 p-6 mt-12 md:mt-0">
          <div className="max-w-2xl mx-auto">
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Profile Settings</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-muted-foreground">Profile settings coming soon...</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
                  <div className="bg-card border border-border rounded-lg p-6">
                    <p className="text-muted-foreground">Notification settings coming soon...</p>
                  </div>
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
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Habit reminders via Slack</span>
                                <input
                                  type="checkbox"
                                  checked={slackStatus.preferences?.slackNotificationsEnabled ?? false}
                                  onChange={(e) => handlePreferenceChange('slackNotificationsEnabled', e.target.checked)}
                                  className="w-4 h-4 rounded border-border"
                                />
                              </label>
                              
                              <label className="flex items-center justify-between">
                                <span className="text-sm">Weekly reports via Slack</span>
                                <input
                                  type="checkbox"
                                  checked={slackStatus.preferences?.weeklySlackReportEnabled ?? false}
                                  onChange={(e) => handlePreferenceChange('weeklySlackReportEnabled', e.target.checked)}
                                  className="w-4 h-4 rounded border-border"
                                />
                              </label>
                              
                              {slackStatus.preferences?.weeklySlackReportEnabled && (
                                <div className="flex items-center gap-4 pl-4">
                                  <select
                                    value={slackStatus.preferences?.weeklyReportDay ?? 0}
                                    onChange={(e) => handlePreferenceChange('weeklyReportDay', parseInt(e.target.value))}
                                    className="px-2 py-1 text-sm bg-background border border-border rounded-md"
                                  >
                                    {DAYS_OF_WEEK.map(day => (
                                      <option key={day.value} value={day.value}>{day.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={slackStatus.preferences?.weeklyReportTime ?? '09:00'}
                                    onChange={(e) => handlePreferenceChange('weeklyReportTime', e.target.value)}
                                    className="px-2 py-1 text-sm bg-background border border-border rounded-md"
                                  >
                                    {TIME_OPTIONS.map(time => (
                                      <option key={time.value} value={time.value}>{time.label}</option>
                                    ))}
                                  </select>
                                </div>
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
