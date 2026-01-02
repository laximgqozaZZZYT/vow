"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        await api.register({ email, password, name: name.trim() ? name.trim() : undefined });
      } else {
        await api.login({ email, password });
      }
      router.push("/dashboard");
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{mode === "login" ? "Login" : "Create account"}</h1>
          <button
            className="text-sm text-zinc-600 hover:text-zinc-900"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account?" : "Have an account?"}
          </button>
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
              OAuth is handled by Supabase Auth. After login, we'll merge your current guest data into your account.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <div className="text-xs text-zinc-500">or</div>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          {mode === "register" && (
            <label className="block">
              <div className="mb-1 text-sm text-zinc-700">Name (optional)</div>
              <input
                className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          )}

          <label className="block">
            <div className="mb-1 text-sm text-zinc-700">Email</div>
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-zinc-700">Password</div>
            <input
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <div className="mt-1 text-xs text-zinc-500">Minimum 8 chars for registration.</div>
          </label>

          {error && (
            <pre className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {error}
            </pre>
          )}

          <button
            className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
            disabled={busy || !email.trim() || !password}
            onClick={submit}
          >
            {busy ? "Working…" : mode === "login" ? "Login" : "Create account"}
          </button>

          <button
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-zinc-800 disabled:opacity-60"
            disabled={busy}
            onClick={doLogout}
            type="button"
          >
            Logout
          </button>

          <div className="text-xs text-zinc-500">
            You can use the dashboard without login. Logging in will merge your current guest data into your account.
          </div>
        </div>
      </div>
    </div>
  );
}
