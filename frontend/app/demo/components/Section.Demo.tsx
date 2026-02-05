'use client';

/**
 * Section.Demo - Interactive Demo Section Component for Landing Page
 *
 * This component displays an interactive preview of the actual dashboard
 * with tab navigation for different sections (Board, Stickies, Calendar, Statistics).
 *
 * CRITICAL Requirements:
 * - THE Demo_Section SHALL use tabs to switch between dashboard sections
 * - THE Demo_Section SHALL allow interactive operations (habit actions, sticky create/complete)
 * - THE Demo_Section SHALL use actual dashboard components with demo data
 * - THE Demo_Section SHALL NOT make any API calls
 */

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { DemoDataProvider, useDemoData } from '../contexts/DemoDataContext';
import { HandednessProvider } from '@/app/dashboard/contexts/HandednessContext';

// Reuse actual dashboard components
import BoardSection from '@/app/dashboard/components/Section.Board';
import StickiesSection from '@/app/dashboard/components/Section.Stickies';
import CalendarWidget from '@/app/dashboard/components/Widget.Calendar';
import StaticsSection from '@/app/dashboard/components/Section.Statistics';

// ============================================================================
// Types
// ============================================================================

type TabKey = 'board' | 'stickies' | 'calendar' | 'statistics';

interface TabConfig {
  key: TabKey;
  label: string;
  labelJa: string;
  icon: React.ReactNode;
  description: string;
}

interface DemoSectionProps {
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// Tab Configuration
// ============================================================================

const TABS: TabConfig[] = [
  {
    key: 'board',
    label: 'Board',
    labelJa: 'ボード',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="18" rx="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="12" rx="1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    description: '習慣をカンバン形式で管理',
  },
  {
    key: 'stickies',
    label: 'Stickies',
    labelJa: '付箋',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    description: 'メモやタスクを付箋で整理',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    labelJa: 'カレンダー',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'スケジュールを一目で確認',
  },
  {
    key: 'statistics',
    label: 'Statistics',
    labelJa: '統計',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: '達成率やトレンドを分析',
  },
];

// ============================================================================
// Tab Navigation Component
// ============================================================================

function TabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 p-1.5 bg-muted/80 backdrop-blur-sm rounded-xl border border-border/50">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              relative flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-300 ease-out
              ${isActive
                ? 'bg-card text-foreground shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
              }
            `}
            aria-selected={isActive}
            role="tab"
          >
            <span className={`transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
              {tab.icon}
            </span>
            <span className="hidden sm:inline">{tab.labelJa}</span>

            {/* Active indicator dot for mobile */}
            {isActive && (
              <span className="sm:hidden absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Demo Dashboard Content Component
// ============================================================================

function DemoDashboardContent({
  activeTab,
  onAction,
}: {
  activeTab: TabKey;
  onAction: () => void;
}) {
  const {
    habits,
    goals,
    activities,
    stickies,
    onHabitAction,
    onStickyCreate,
    onStickyComplete,
  } = useDemoData();

  // Wrap handlers to trigger visual feedback
  const handleHabitAction = useCallback((habitId: string, action: any, amount?: number) => {
    onHabitAction(habitId, action, amount);
    onAction();
  }, [onHabitAction, onAction]);

  const handleStickyCreate = useCallback(async (payload?: { parentStickyId?: string }) => {
    const result = await onStickyCreate(payload);
    onAction();
    return result;
  }, [onStickyCreate, onAction]);

  const handleStickyComplete = useCallback((stickyId: string) => {
    onStickyComplete(stickyId);
    onAction();
  }, [onStickyComplete, onAction]);

  // Mock handlers for demo (no-op or simple state updates)
  const handleHabitEdit = useCallback((habitId: string) => {
    console.log('[Demo] Habit edit requested:', habitId);
  }, []);

  const handleStickyEdit = useCallback((stickyId: string) => {
    console.log('[Demo] Sticky edit requested:', stickyId);
  }, []);

  const handleStickyDelete = useCallback((stickyId: string) => {
    console.log('[Demo] Sticky delete requested:', stickyId);
  }, []);

  const handleStickyNameChange = useCallback((stickyId: string, name: string) => {
    console.log('[Demo] Sticky name change requested:', stickyId, name);
  }, []);

  // Calendar event handlers (no-op for demo)
  const handleEventClick = useCallback((id: string) => {
    console.log('[Demo] Calendar event clicked:', id);
  }, []);

  const handleSlotSelect = useCallback((isoDate: string, time?: string, endTime?: string) => {
    console.log('[Demo] Calendar slot selected:', isoDate, time, endTime);
  }, []);

  const handleEventChange = useCallback((id: string, updated: { start?: string; end?: string; timingIndex?: number }) => {
    console.log('[Demo] Calendar event changed:', id, updated);
  }, []);

  // Render the active section
  const renderActiveSection = () => {
    switch (activeTab) {
      case 'board':
        return (
          <BoardSection
            habits={habits}
            activities={activities}
            onHabitAction={handleHabitAction}
            onHabitEdit={handleHabitEdit}
          />
        );
      case 'stickies':
        return (
          <StickiesSection
            stickies={stickies}
            onStickyCreate={handleStickyCreate}
            onStickyEdit={handleStickyEdit}
            onStickyComplete={handleStickyComplete}
            onStickyDelete={handleStickyDelete}
            onStickyNameChange={handleStickyNameChange}
          />
        );
      case 'calendar':
        return (
          <CalendarWidget
            habits={habits}
            goals={goals}
            activities={activities}
            onEventClick={handleEventClick}
            onSlotSelect={handleSlotSelect}
            onEventChange={handleEventChange}
          />
        );
      case 'statistics':
        return (
          <StaticsSection
            habits={habits as any}
            activities={activities as any}
            goals={goals as any}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[450px] transition-all duration-300">
      {renderActiveSection()}
    </div>
  );
}

// ============================================================================
// Interactive Guide Component
// ============================================================================

function InteractiveGuide({
  activeTab,
  actionCount,
}: {
  activeTab: TabKey;
  actionCount: number;
}) {
  const guides: Record<TabKey, { action: string; icon: React.ReactNode }> = {
    board: {
      action: 'チェックボタンをクリックして習慣を完了',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    stickies: {
      action: '「+」で付箋追加、チェックで完了',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    calendar: {
      action: 'カレンダーでスケジュールを確認',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    statistics: {
      action: '達成率やトレンドを確認',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  };

  const guide = guides[activeTab];
  const showSuccess = actionCount > 0;

  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-xl
      transition-all duration-500
      ${showSuccess
        ? 'bg-gradient-to-r from-success/10 to-success/5 border border-success/20'
        : 'bg-gradient-to-r from-primary/8 to-primary/3 border border-primary/10'
      }
    `}>
      {/* Icon with animation */}
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-lg
        transition-all duration-500
        ${showSuccess
          ? 'bg-success/20 text-success'
          : 'bg-primary/15 text-primary'
        }
      `}>
        {showSuccess ? (
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animationIterationCount: 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          guide.icon
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium transition-colors duration-300 ${showSuccess ? 'text-success' : 'text-foreground'}`}>
          {showSuccess ? 'いいね! その調子です' : '試してみよう'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {showSuccess && actionCount > 1
            ? `${actionCount}回操作しました`
            : guide.action
          }
        </p>
      </div>

      {/* Action count badge */}
      {actionCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/20 text-success text-xs font-semibold">
          <span>{actionCount}</span>
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Demo Section Component
// ============================================================================

export default function DemoSection({ className = '' }: DemoSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('board');
  const [actionCount, setActionCount] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTabChange = (tab: TabKey) => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 150);
  };

  const handleAction = useCallback(() => {
    setActionCount((prev) => prev + 1);
  }, []);

  // Reset action count when tab changes
  useEffect(() => {
    setActionCount(0);
  }, [activeTab]);

  const currentTab = TABS.find((t) => t.key === activeTab);

  return (
    <section
      className={`w-full ${className}`}
      aria-label="インタラクティブデモ"
    >
      {/* Demo Frame Container */}
      <div className="
        mx-auto
        rounded-2xl
        border border-border
        bg-gradient-to-b from-card to-card/95
        shadow-2xl shadow-primary/5
        overflow-hidden
        relative
      ">
        {/* Decorative gradient border effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />

        {/* Demo Header with Tabs */}
        <div className="relative border-b border-border bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50">
          <div className="flex flex-col gap-4 p-4 sm:p-6">
            {/* Top row: Badge and description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Animated demo badge */}
                <span className="
                  relative inline-flex items-center gap-2
                  px-3 py-1.5
                  rounded-full
                  text-xs font-semibold
                  bg-gradient-to-r from-primary to-primary/80
                  text-primary-foreground
                  shadow-lg shadow-primary/25
                ">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
                  </span>
                  LIVE デモ
                </span>

                {/* Current tab description */}
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {currentTab?.description}
                </span>
              </div>

              {/* Window controls decoration */}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
            </div>

            {/* Tab Navigation */}
            <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </div>

        {/* Interactive Guide */}
        <div className="relative p-4 sm:px-6 pb-0">
          <InteractiveGuide activeTab={activeTab} actionCount={actionCount} />
        </div>

        {/* Dashboard Content */}
        <div className={`
          relative p-4 sm:p-6
          transition-opacity duration-300
          ${isTransitioning ? 'opacity-50' : 'opacity-100'}
        `}>
          <DemoDataProvider>
            <HandednessProvider>
              <DemoDashboardContent activeTab={activeTab} onAction={handleAction} />
            </HandednessProvider>
          </DemoDataProvider>
        </div>

        {/* CTA Footer */}
        <div className="relative p-4 sm:p-6 pt-4 border-t border-border bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-foreground">
                気に入りましたか?
              </p>
              <p className="text-xs text-muted-foreground">
                実際のダッシュボードでより多くの機能をお試しください
              </p>
            </div>

            <Link
              href="/dashboard"
              className="
                group
                inline-flex h-12 items-center justify-center
                rounded-full bg-primary px-8
                text-sm font-semibold text-primary-foreground
                shadow-lg shadow-primary/25
                hover:shadow-xl hover:shadow-primary/30
                hover:scale-[1.02]
                transition-all duration-200
                whitespace-nowrap
              "
            >
              実際のダッシュボードで試す
              <svg className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export { DemoSection, DemoDashboardContent };
export type { DemoSectionProps, TabKey };
