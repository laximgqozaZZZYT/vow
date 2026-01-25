"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

// 開発環境で許可されるメールアドレス（環境変数から取得）
const ALLOWED_EMAILS_DEV = process.env.NEXT_PUBLIC_ALLOWED_EMAILS_DEV?.split(',').map(e => e.trim().toLowerCase()) || [];
const IS_DEV_ENV = process.env.NEXT_PUBLIC_ENV === 'development';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 開発環境でのアクセス制限チェック
  useEffect(() => {
    const checkDevAccess = async () => {
      if (!IS_DEV_ENV || !supabase) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        if (ALLOWED_EMAILS_DEV.length > 0 && !ALLOWED_EMAILS_DEV.includes(userEmail)) {
          // 許可されていないメールアドレスの場合、ログアウト
          await supabase.auth.signOut();
          setError('この開発環境へのアクセスは許可されていません。');
        }
      }
    };
    
    checkDevAccess();
  }, []);

  async function doLogout() {
    setError(null);
    setBusy(true);
    try {
      await api.logout();
      router.push('/dashboard')
    } catch (e: any) {
      setError(e?.body || e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'github') {
    setError(null);
    setBusy(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
      // redirect happens by supabase
    } catch (e: any) {
      setError(e?.message || String(e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-semibold">Login</h1>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <button
              className="block w-full rounded-lg border border-zinc-200 px-4 py-2 text-center text-sm text-zinc-800 hover:bg-zinc-50"
              onClick={() => oauth('google')}
              disabled={busy}
              type="button"
            >
              Continue with Google
            </button>
            <button
              className="block w-full rounded-lg border border-zinc-200 px-4 py-2 text-center text-sm text-zinc-800 hover:bg-zinc-50"
              onClick={() => oauth('github')}
              disabled={busy}
              type="button"
            >
              Continue with GitHub
            </button>
            <div className="text-xs text-zinc-500">
              OAuth認証でログインしてください。ログイン後、現在のゲストデータがアカウントにマージされます。
            </div>
          </div>



          {error && (
            <pre className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {error}
            </pre>
          )}

          <button
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-zinc-800 disabled:opacity-60"
            disabled={busy}
            onClick={doLogout}
            type="button"
          >
            ログアウト
          </button>

          {IS_DEV_ENV ? (
            <div className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
              ⚠️ 開発環境: 管理者アカウントでのログインが必要です。
            </div>
          ) : (
            <div className="text-xs text-zinc-500">
              ダッシュボードはログインなしでも使用できます。ログインすると現在のゲストデータがアカウントにマージされます。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
