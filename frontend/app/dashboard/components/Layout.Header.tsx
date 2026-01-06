import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import type { DashboardHeaderProps } from '../types';

export default function DashboardHeader({ 
  onToggleSidebar, 
  showSidebar, 
  onEditLayout 
}: DashboardHeaderProps) {
  const { isAuthed, actorLabel, authError, handleLogout } = useAuth();

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
            <div className="hidden max-w-[420px] truncate text-xs text-amber-700 sm:block dark:text-amber-300" title={authError}>
              {authError}
            </div>
          )}
          {isAuthed ? (
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