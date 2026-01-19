import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../../../lib/api';
import type { DashboardHeaderProps } from '../types';
import { useHandedness } from '../contexts/HandednessContext';
import { useLocale } from '@/contexts/LocaleContext';

export default function DashboardHeader({ 
  onToggleSidebar, 
  showSidebar, 
  onEditLayout
}: DashboardHeaderProps) {
  const { 
    isAuthed, 
    actorLabel, 
    authError, 
    handleLogout, 
    isGuest,
    migrationStatus,
    migrationResult,
    migrationError,
    retryMigration
  } = useAuth();
  const { handedness, setHandedness, isLeftHanded } = useHandedness();
  const { locale, setLocale } = useLocale();
  const [hasGuestData, setHasGuestData] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check for guest data on component mount and migration status changes
  useEffect(() => {
    const checkGuestData = async () => {
      try {
        const { GuestDataMigration } = await import('../../../lib/guest-data-migration');
        setHasGuestData(GuestDataMigration.hasGuestData());
      } catch (error) {
        console.error('[Header] Error checking guest data:', error);
      }
    };
    
    checkGuestData();
    
    // Listen for migration completion to update guest data status
    const handleMigrationComplete = () => {
      setHasGuestData(false);
    };
    
    window.addEventListener('guestDataMigrated', handleMigrationComplete);
    return () => {
      window.removeEventListener('guestDataMigrated', handleMigrationComplete);
    };
  }, [migrationStatus]);

  const handleClearGuestData = async () => {
    const { GuestDataMigration } = await import('../../../lib/guest-data-migration');
    
    if (!GuestDataMigration.hasGuestData()) {
      return;
    }

    if (!confirm('Do you want to migrate your guest data to your account? This will move your goals, habits, and activities from local storage to your authenticated account.')) {
      return;
    }

    // Use the retry migration function from useAuth hook
    try {
      await retryMigration();
    } catch (error) {
      console.error('[Header] Error triggering migration:', error);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className={`flex h-14 items-center justify-between px-4 sm:px-6 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle menu"
            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xl sm:text-2xl leading-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ☰
          </button>
          
          <div className="text-base sm:text-lg font-bold tracking-wide">VOW</div>
        </div>

        <div className={`flex items-center gap-1 sm:gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          {/* Migration status display */}
          {migrationStatus === 'migrating' && (
            <div className="flex items-center text-xs sm:text-sm text-blue-600 bg-blue-50 px-2 sm:px-3 py-1 rounded dark:bg-blue-950/20 dark:text-blue-300">
              <div className="animate-spin w-3 h-3 sm:w-4 sm:h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-1 sm:mr-2"></div>
              <span className="hidden sm:inline">Migrating your data...</span>
              <span className="sm:hidden">Migrating...</span>
            </div>
          )}

          {migrationStatus === 'success' && migrationResult && (
            <div className="flex items-center text-xs sm:text-sm text-green-600 bg-green-50 px-2 sm:px-3 py-1 rounded dark:bg-green-950/20 dark:text-green-300">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="hidden lg:inline">Successfully migrated {migrationResult.migratedGoals} goals, {migrationResult.migratedHabits} habits, and {migrationResult.migratedActivities} activities</span>
              <span className="lg:hidden">Migration complete</span>
            </div>
          )}

          {migrationStatus === 'error' && migrationError && (
            <div className="flex items-center text-xs sm:text-sm text-red-600 bg-red-50 px-2 sm:px-3 py-1 rounded dark:bg-red-950/20 dark:text-red-300">
              <span className="mr-1 sm:mr-2">Migration failed.</span>
              <button 
                onClick={retryMigration}
                className="inline-flex items-center justify-center underline hover:no-underline transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          
          {authError && migrationStatus === 'idle' && (
            <div 
              className={`hidden max-w-[200px] lg:max-w-[420px] truncate text-xs sm:block ${
                authError.startsWith('Successfully migrated') || authError.includes('cleared')
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-amber-700 dark:text-amber-300'
              }`} 
              title={authError}
            >
              {authError}
            </div>
          )}
          {/* ゲストデータ移行ボタン（認証ユーザーかつゲストデータが存在する場合のみ表示） */}
          {isAuthed && !isGuest && hasGuestData && migrationStatus === 'idle' && (
            <button
              onClick={handleClearGuestData}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="hidden sm:inline">Migrate Guest Data</span>
              <span className="sm:hidden">Migrate</span>
            </button>
          )}
          {isAuthed && !isGuest ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setShowAccountMenu(!showAccountMenu)}
                className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground w-9 h-9 transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Account"
                aria-label="Account menu"
                aria-expanded={showAccountMenu}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              
              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md bg-card border border-border shadow-lg py-1 z-50">
                  {actorLabel && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border truncate">
                      {actorLabel}
                    </div>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setShowAccountMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Login
            </Link>
          )}
          <button
            onClick={onEditLayout}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="hidden sm:inline">Editor Layout</span>
            <span className="sm:hidden">Edit</span>
          </button>
        </div>
      </div>
    </header>
  );
}