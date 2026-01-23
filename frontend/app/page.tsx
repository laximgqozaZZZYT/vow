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
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background dark:from-primary/10" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-16 sm:py-24">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Image src="/window.svg" alt="" width={24} height={24} className="invert" />
              </div>
              <span className="text-2xl font-bold tracking-tight">VOW</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
              >
                無料で始める
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          <main className="flex flex-col lg:flex-row lg:items-center gap-12 lg:gap-16">
            <section className="flex-1 max-w-2xl" aria-labelledby="hero-heading">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                シンプル・無料・すぐに始められる
              </div>

              <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                習慣を変えて、
                <br />
                <span className="text-primary">人生を変える</span>
              </h1>
              
              <p className="mt-6 text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl">
                VOWは、日々の習慣管理と目標達成をサポートするシンプルなアプリ。
                継続の力で、あなたの理想を現実に。
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <Link
                  href="/dashboard"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-all hover:shadow-xl hover:shadow-primary/30"
                >
                  ゲストとして始める
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-14 items-center justify-center rounded-full border-2 border-border bg-card px-8 text-base font-medium hover:bg-muted transition-colors"
                >
                  アカウントでログイン
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-10 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  登録不要
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  完全無料
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  プライバシー重視
                </div>
              </div>
            </section>

            {/* Feature Cards - Desktop only */}
            <aside className="hidden lg:flex flex-col gap-4 w-80" aria-label="主な機能">
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="習慣トラッキング"
                description="毎日の習慣をシンプルに記録。継続日数やヒートマップで進捗を可視化。"
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                title="目標管理"
                description="大きな目標を小さなステップに分解。階層構造で整理して着実に達成。"
              />
              <FeatureCard
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                title="統計・分析"
                description="達成率やトレンドをグラフで確認。データに基づいた振り返りが可能。"
              />
            </aside>
          </main>
        </div>
      </header>

      {/* Features Section - Mobile */}
      <section className="lg:hidden px-6 py-12 bg-muted/30" aria-labelledby="mobile-features-heading">
        <h2 id="mobile-features-heading" className="sr-only">主な機能</h2>
        <div className="grid gap-4 max-w-md mx-auto">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="習慣トラッキング"
            description="毎日の習慣をシンプルに記録。継続日数やヒートマップで進捗を可視化。"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            title="目標管理"
            description="大きな目標を小さなステップに分解。階層構造で整理して着実に達成。"
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="統計・分析"
            description="達成率やトレンドをグラフで確認。データに基づいた振り返りが可能。"
          />
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-16 sm:py-24 bg-muted/20" aria-labelledby="demo-heading">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <h2 id="demo-heading" className="text-3xl sm:text-4xl font-bold tracking-tight">
              実際の画面をプレビュー
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              VOWのダッシュボードを体験してみてください。
              習慣管理、目標設定、統計分析がひとつの画面に。
            </p>
          </div>
          <LazyDemoSection className="w-full" />
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-24" aria-labelledby="how-it-works-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 id="how-it-works-heading" className="text-3xl sm:text-4xl font-bold tracking-tight">
              3ステップで始める
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              登録不要。今すぐ習慣管理を始められます。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="習慣を設定"
              description="身につけたい習慣を登録。毎日・週次など、自分のペースで設定できます。"
            />
            <StepCard
              number="2"
              title="毎日チェック"
              description="ダッシュボードで今日のタスクを確認。ワンタップで完了を記録。"
            />
            <StepCard
              number="3"
              title="振り返り"
              description="統計画面で進捗を確認。継続のモチベーションを維持できます。"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-primary/5" aria-labelledby="cta-heading">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold tracking-tight">
            今日から始めよう
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            小さな一歩が、大きな変化につながります。
            VOWで、あなたの習慣づくりをサポートします。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link
              href="/dashboard"
              className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-all"
            >
              無料で始める
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Image src="/window.svg" alt="" width={18} height={18} className="invert" />
              </div>
              <span className="text-lg font-semibold">VOW</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} VOW — 集中と継続のために
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="p-5 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </article>
  );
}

// Step Card Component
function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <article className="relative p-6 rounded-xl bg-card border border-border">
      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </article>
  );
}
