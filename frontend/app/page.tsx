import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createPageMetadata } from "../lib/seo.metadata";
import LazyDemoSection from "./demo/components/LazyDemoSection";

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
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Hero Section */}
      <header className="relative overflow-hidden min-h-[90vh] flex flex-col">
        {/* Animated Background */}
        <div className="absolute inset-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-background" />

          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-primary/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-to-tl from-primary/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />

          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--color-border)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--color-border)/0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        </div>

        <div className="relative flex-1 mx-auto max-w-7xl px-6 py-8 sm:py-12 flex flex-col">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-12 sm:mb-16">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <Image src="/window.svg" alt="" width={26} height={26} className="invert" />
              </div>
              <span className="text-2xl font-bold tracking-tight">VOW</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
              >
                ログイン
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] transition-all duration-200"
              >
                無料で始める
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <main className="flex-1 flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-20">
            <section className="flex-1 max-w-2xl" aria-labelledby="hero-heading">
              {/* Animated Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/15 to-primary/5 text-primary text-sm font-medium mb-8 border border-primary/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                シンプル・無料・今すぐ始められる
              </div>

              <h1 id="hero-heading" className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                毎日
                <span className="relative inline-block mx-2">
                  <span className="relative z-10 text-primary">5分</span>
                  <span className="absolute -bottom-1 left-0 right-0 h-3 bg-primary/20 rounded-sm -rotate-1"></span>
                </span>
                で、
                <br />
                <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                  習慣が定着
                </span>
              </h1>

              <p className="mt-8 text-xl sm:text-2xl text-muted-foreground leading-relaxed max-w-xl font-light">
                シンプルなチェックで習慣を記録。
                <br className="hidden sm:block" />
                VOWがあなたの目標達成をサポートします。
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <Link
                  href="/dashboard"
                  className="group inline-flex h-16 items-center justify-center rounded-full bg-primary px-10 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200"
                >
                  今すぐ無料で試す
                  <svg className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-16 items-center justify-center rounded-full border-2 border-border bg-card/50 backdrop-blur-sm px-10 text-lg font-medium hover:bg-card hover:border-primary/30 transition-all duration-200"
                >
                  ログイン
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-6 mt-12 pt-8 border-t border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">登録不要</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">完全無料</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">プライバシー重視</span>
                </div>
              </div>
            </section>

            {/* Feature Cards - Desktop only */}
            <aside className="hidden lg:flex flex-col gap-5 w-96" aria-label="主な機能">
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="習慣トラッキング"
                description="毎日の習慣をシンプルに記録。継続日数やヒートマップで進捗を可視化。"
                gradient="from-green-500/10 to-emerald-500/5"
                iconBg="bg-green-500/10 text-green-600 dark:text-green-400"
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                title="目標管理"
                description="大きな目標を小さなステップに分解。階層構造で整理して着実に達成。"
                gradient="from-blue-500/10 to-indigo-500/5"
                iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                title="統計・分析"
                description="達成率やトレンドをグラフで確認。データに基づいた振り返りが可能。"
                gradient="from-purple-500/10 to-pink-500/5"
                iconBg="bg-purple-500/10 text-purple-600 dark:text-purple-400"
              />
            </aside>
          </main>

          {/* Scroll indicator */}
          <div className="hidden sm:flex justify-center mt-8">
            <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
              <span className="text-xs font-medium tracking-wider uppercase">デモを見る</span>
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section - Mobile */}
      <section className="lg:hidden px-6 py-16 bg-muted/30" aria-labelledby="mobile-features-heading">
        <h2 id="mobile-features-heading" className="text-2xl font-bold text-center mb-8">主な機能</h2>
        <div className="grid gap-4 max-w-md mx-auto">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="習慣トラッキング"
            description="毎日の習慣をシンプルに記録。継続日数やヒートマップで進捗を可視化。"
            gradient="from-green-500/10 to-emerald-500/5"
            iconBg="bg-green-500/10 text-green-600 dark:text-green-400"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            title="目標管理"
            description="大きな目標を小さなステップに分解。階層構造で整理して着実に達成。"
            gradient="from-blue-500/10 to-indigo-500/5"
            iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="統計・分析"
            description="達成率やトレンドをグラフで確認。データに基づいた振り返りが可能。"
            gradient="from-purple-500/10 to-pink-500/5"
            iconBg="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          />
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-20 sm:py-28 relative overflow-hidden" aria-labelledby="demo-heading">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/30 to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              インタラクティブデモ
            </span>
            <h2 id="demo-heading" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              今すぐ体験してみよう
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              下のデモを実際に操作して、VOWの使いやすさを体感してください。
              <br className="hidden sm:block" />
              習慣のチェック、付箋の作成など、すべて試せます。
            </p>
          </div>
          <LazyDemoSection className="w-full" />
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-28 relative" aria-labelledby="how-it-works-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              簡単スタート
            </span>
            <h2 id="how-it-works-heading" className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              3ステップで始める
            </h2>
            <p className="text-xl text-muted-foreground">
              登録不要。今すぐ習慣管理を始められます。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection lines for desktop */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <StepCard
              number="1"
              title="習慣を設定"
              description="身につけたい習慣を登録。毎日・週次など、自分のペースで設定できます。"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
            />
            <StepCard
              number="2"
              title="毎日チェック"
              description="ダッシュボードで今日のタスクを確認。ワンタップで完了を記録。"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <StepCard
              number="3"
              title="振り返り"
              description="統計画面で進捗を確認。継続のモチベーションを維持できます。"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32 relative overflow-hidden" aria-labelledby="cta-heading">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 id="cta-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            今日から始めよう
          </h2>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            小さな一歩が、大きな変化につながります。
            <br />
            VOWで、あなたの習慣づくりをサポートします。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="group inline-flex h-16 items-center justify-center rounded-full bg-primary px-12 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-200"
            >
              無料で始める
              <svg className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 mt-12 pt-8 border-t border-border/30">
            <TrustBadge icon="shield" text="プライバシー重視" />
            <TrustBadge icon="credit" text="完全無料" />
            <TrustBadge icon="user" text="登録不要" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                <Image src="/window.svg" alt="" width={22} height={22} className="invert" />
              </div>
              <div>
                <span className="text-xl font-bold block">VOW</span>
                <span className="text-xs text-muted-foreground">習慣・目標トラッカー</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} VOW - 集中と継続のために
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component with Hover Animation
function FeatureCard({
  icon,
  title,
  description,
  gradient = "from-primary/10 to-primary/5",
  iconBg = "bg-primary/10 text-primary"
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient?: string;
  iconBg?: string;
}) {
  return (
    <article className={`group relative p-6 rounded-2xl bg-gradient-to-br ${gradient} border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 overflow-hidden`}>
      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative">
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </article>
  );
}

// Step Card Component
function StepCard({
  number,
  title,
  description,
  icon
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300">
      {/* Step number badge */}
      <div className="absolute -top-4 left-8 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-lg shadow-primary/30">
        {number}
      </div>

      {/* Icon */}
      <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 mt-2 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>

      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </article>
  );
}

// Trust Badge Component
function TrustBadge({ icon, text }: { icon: 'shield' | 'credit' | 'user'; text: string }) {
  const icons = {
    shield: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    credit: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    user: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <div className="text-success">{icons[icon]}</div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
