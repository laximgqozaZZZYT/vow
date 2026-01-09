import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../../../lib/api';
import type { DashboardHeaderProps } from '../types';

export default function DashboardHeader({ 
  onToggleSidebar, 
  showSidebar, 
  onEditLayout 
}: DashboardHeaderProps) {
  const { isAuthed, actorLabel, authError, handleLogout, isGuest } = useAuth();
  const [clearingData, setClearingData] = useState(false);

  const handleClearGuestData = async () => {
    if (!confirm('Are you sure you want to clear all guest data from localStorage? This cannot be undone.')) {
      return;
    }

    setClearingData(true);
    try {
      // ゲストデータをクリア
      const guestKeys = ['guest-goals', 'guest-habits', 'guest-activities', 'guest-diary-cards', 'guest-diary-tags'];
      guestKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('[Header] Guest data cleared successfully');
      alert('Guest data cleared successfully. Page will reload.');
      
      // ページをリロードしてデータを再取得
      window.location.reload();
    } catch (error) {
      console.error('[Header] Error clearing guest data:', error);
      alert(`Error clearing guest data: ${(error as any)?.message || error}`);
    } finally {
      setClearingData(false);
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-[#071013]/90">
      <div className="flex h-14 items-center justify-between px-2 sm:px-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle menu"
            className="rounded px-2 py-1 text-2xl leading-none hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            ☰
          </button>
          <div className="text-lg font-bold tracking-wide">VOW</div>
        </div>

        <div className="flex items-center gap-2">
          {actorLabel && (
            <div className="hidden text-xs text-zinc-500 sm:block">{actorLabel}</div>
          )}
          {authError && (
            <div 
              className={`hidden max-w-[420px] truncate text-xs sm:block ${
                authError.startsWith('Data migrated:') || authError.includes('cleared')
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-amber-700 dark:text-amber-300'
              }`} 
              title={authError}
            >
              {authError}
            </div>
          )}
          {/* ゲストデータクリアボタン（認証ユーザーのみ表示） */}
          {isAuthed && !isGuest && (
            <button
              onClick={handleClearGuestData}
              disabled={clearingData}
              className="rounded border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200 dark:hover:bg-orange-950/35"
            >
              {clearingData ? 'Clearing...' : 'Clear Guest Data'}
            </button>
          )}
          {isAuthed && !isGuest ? (
            <button
              onClick={handleLogout}
              className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/35"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/10"
            >
              Login
            </Link>
          )}
          <button
            onClick={onEditLayout}
            className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
          >
            Editor Layout
          </button>
        </div>
      </div>
    </header>
  );
}