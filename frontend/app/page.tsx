import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createPageMetadata } from "../lib/seo.metadata";

// locale-aware metadata generator
export async function generateMetadata({ params, searchParams }: { params: { locale?: string }; searchParams: any }): Promise<Metadata> {
  const locale = params?.locale || 'en';
  return createPageMetadata({
    title: "VOW — Habit & Goal Tracker",
    description: "VOW helps you build habits and make progress on goals with a minimal, focused workflow.",
    path: '/',
    locale: locale as any,
  });
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-black dark:via-zinc-900 dark:to-zinc-900 font-sans">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 sm:flex-row sm:items-center">
        <section className="flex w-full flex-col gap-8 sm:w-1/2">
          <div className="flex items-center gap-3">
            <Image src="/window.svg" alt="VOW" width={48} height={48} />
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              VOW
            </h1>
          </div>

          <div>
            <h2 className="text-4xl font-bold leading-tight text-black dark:text-zinc-50">
              Build better habits. Achieve real goals.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              Focused habit tracking, simple goal planning, and reflections that help
              you keep momentum. Get started quickly as a guest or create an account
              to sync your data.
            </p>
          </div>

          <div className="flex w-full max-w-md gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Continue as Guest
            </Link>
          </div>

          <ul className="mt-6 flex max-w-md flex-col gap-3">
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • Daily habit tracking with simple streaks
            </li>
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • Goal planning and review to keep progress visible
            </li>
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • Lightweight, privacy-first approach — your data belongs to you
            </li>
          </ul>
        </section>

        <aside className="hidden w-1/2 flex-col gap-6 sm:flex">
          <div className="rounded-2xl bg-white/60 p-6 shadow-md dark:bg-zinc-900/60">
            <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Quick glance</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Your dashboard surfaces today's habits, active goals, and recent reflections so you can act in minutes.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Habits</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Daily check-ins, custom reminders, and streak tracking.</p>
            </div>
            <div className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Goals</h4>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Break goals into small steps and review progress weekly.</p>
            </div>
          </div>
        </aside>
      </main>

      <footer className="border-t border-zinc-200 bg-transparent py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="mx-auto max-w-4xl px-6">© {new Date().getFullYear()} VOW — Built for focus and consistency.</div>
      </footer>
    </div>
  );
}
