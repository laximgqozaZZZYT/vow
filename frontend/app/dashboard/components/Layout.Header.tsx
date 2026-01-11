import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../../../lib/api';
import type { DashboardHeaderProps } from '../types';

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
  const [hasGuestData, setHasGuestData] = useState(false);

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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-[#071013]/90">
      <div className="flex h-14 items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle menu"
            className="rounded px-2 py-1 text-xl sm:text-2xl leading-none hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            ☰
          </button>
          <div className="text-base sm:text-lg font-bold tracking-wide">VOW</div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {actorLabel && (
            <div className="hidden text-xs text-zinc-500 sm:block truncate max-w-24 lg:max-w-none">{actorLabel}</div>
          )}
          
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
                className="underline hover:no-underline"
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
              className="rounded border border-blue-200 bg-blue-50 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 dark:hover:bg-blue-950/35"
            >
              <span className="hidden sm:inline">Migrate Guest Data</span>
              <span className="sm:hidden">Migrate</span>
            </button>
          )}
          {isAuthed && !isGuest ? (
            <button
              onClick={handleLogout}
              className="rounded border border-red-200 bg-red-50 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/35"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded border border-zinc-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/10"
            >
              Login
            </Link>
          )}
          <button
            onClick={onEditLayout}
            className="rounded border border-zinc-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
          >
            <span className="hidden sm:inline">Editor Layout</span>
            <span className="sm:hidden">Edit</span>
          </button>
        </div>
      </div>
    </header>
  );
}