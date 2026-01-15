import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createPageMetadata } from "../lib/seo.metadata";

// locale-aware metadata generator
export async function generateMetadata({ params, searchParams }: { params: { locale?: string }; searchParams: any }): Promise<Metadata> {
  const locale = params?.locale || 'ja';
  return createPageMetadata({
    title: 'VOW - 習慣・目標トラッカー | シンプルなTODOアプリ',
    description: 'VOWは無料のブラウザベースTODOアプリ。AI駆動のタスク管理で習慣を身につけ、目標を達成。シンプルで使いやすい習慣管理・目標設定ツール。',
    path: '/',
    locale: locale as 'en' | 'ja',
    keywords: ['無料', 'ブラウザアプリ', 'オンライン', 'クラウド同期'],
  });
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-black dark:via-zinc-900 dark:to-zinc-900 font-sans">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 sm:flex-row sm:items-center">
        <section className="flex w-full flex-col gap-8 sm:w-1/2" aria-labelledby="hero-heading">
          <div className="flex items-center gap-3">
            <Image src="/window.svg" alt="VOW ロゴ" width={48} height={48} />
            <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              VOW
            </span>
          </div>

          <div>
            <h1 id="hero-heading" className="text-4xl font-bold leading-tight text-black dark:text-zinc-50">
              より良い習慣を身につける。本当の目標を達成する。
            </h1>
            <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
              集中的な習慣管理、シンプルな目標計画、そして継続をサポートする振り返り機能。
              ゲストとしてすぐに始めるか、アカウントを作成してデータを同期できます。
            </p>
          </div>

          <div className="flex w-full max-w-md gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              ログイン
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 bg-white px-6 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              ゲストとして続行
            </Link>
          </div>

          <ul className="mt-6 flex max-w-md flex-col gap-3">
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • シンプルな継続記録による日々の習慣管理
            </li>
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • 進捗を見える化する目標計画とレビュー
            </li>
            <li className="rounded-md bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              • 軽量でプライバシー重視のアプローチ — あなたのデータはあなたのもの
            </li>
          </ul>
        </section>

        <section className="hidden w-1/2 flex-col gap-6 sm:flex" aria-labelledby="features-heading">
          <div className="rounded-2xl bg-white/60 p-6 shadow-md dark:bg-zinc-900/60">
            <h2 id="features-heading" className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">一目で確認</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              ダッシュボードには今日の習慣、アクティブな目標、最近の振り返りが表示され、
              数分で行動に移すことができます。
            </p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">習慣</h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">日々のチェックイン、カスタムリマインダー、継続記録の管理。</p>
            </article>
            <article className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">目標</h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">目標を小さなステップに分解し、週次で進捗をレビュー。</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-transparent py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <div className="mx-auto max-w-4xl px-6">© {new Date().getFullYear()} VOW — 集中と継続のために作られました。</div>
      </footer>
    </div>
  );
}
