"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

const IS_DEV_ENV = process.env.NEXT_PUBLIC_ENV === 'development';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devRestricted, setDevRestricted] = useState(false);

  // 開発環境でのリダイレクト検出
  useEffect(() => {
    if (searchParams.get('dev_restricted') === 'true') {
      setDevRestricted(true);
      setError('この開発環境へのアクセスには管理者ログインが必要です。');
    }
  }, [searchParams]);

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
      
      // リダイレクト先を決定（開発環境制限からのリダイレクトの場合は元のパスに戻る）
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      const redirectTo = `${window.location.origin}${redirectPath}`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
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
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-center">
        <h1 className="text-xl font-semibold">Login</h1>
      </div>

      {devRestricted && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            🔒 開発環境へのアクセスには管理者アカウントでのログインが必要です。
          </p>
        </div>
      )}

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

        <div className="text-xs text-zinc-500">
          ダッシュボードはログインなしでも使用できます。ログインすると現在のゲストデータがアカウントにマージされます。
        </div>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-center">
        <h1 className="text-xl font-semibold">Login</h1>
      </div>
      <div className="mt-6 flex justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full"></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <Suspense fallback={<LoginFallback />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
