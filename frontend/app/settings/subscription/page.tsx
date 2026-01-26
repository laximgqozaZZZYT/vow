'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSubscription, PLAN_CONFIGS, type PlanType } from '@/hooks/useSubscription';

export default function SubscriptionPage() {
  const {
    subscription,
    tokenUsage,
    loading,
    error,
    checkoutLoading,
    currentPlan,
    isPremium,
    startCheckout,
    openCustomerPortal,
    cancelSubscription,
  } = useSubscription();
  
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handleCancel = async () => {
    if (!cancelConfirm) {
      setCancelConfirm(true);
      return;
    }
    setCanceling(true);
    await cancelSubscription();
    setCanceling(false);
    setCancelConfirm(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">設定に戻る</span>
            </Link>
          </div>
          <h1 className="text-lg font-semibold">プラン管理</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="pt-20 pb-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Error display */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              {error}
            </div>
          )}

          {/* Current Plan Status */}
          {!loading && subscription && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">現在のプラン</h2>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {PLAN_CONFIGS[currentPlan].nameJa}
                    </span>
                    {subscription.status === 'active' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300 rounded-full">
                        有効
                      </span>
                    )}
                    {subscription.status === 'canceled' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 rounded-full">
                        キャンセル予定
                      </span>
                    )}
                    {subscription.status === 'past_due' && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-300 rounded-full">
                        支払い遅延
                      </span>
                    )}
                  </div>
                  {isPremium && subscription.currentPeriodEnd && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {subscription.cancelAt
                        ? `${formatDate(subscription.cancelAt)} に終了予定`
                        : `次回更新日: ${formatDate(subscription.currentPeriodEnd)}`}
                    </p>
                  )}
                </div>
                {isPremium && (
                  <button
                    onClick={openCustomerPortal}
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
                  >
                    支払い情報を管理
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Token Usage (Premium only) */}
          {!loading && isPremium && tokenUsage && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">トークン使用量</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {formatTokens(tokenUsage.usedQuota)} / {formatTokens(tokenUsage.monthlyQuota)} トークン
                    </span>
                    <span className="font-medium">{tokenUsage.percentageUsed.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        tokenUsage.percentageUsed >= 90
                          ? 'bg-red-500'
                          : tokenUsage.percentageUsed >= 70
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(tokenUsage.percentageUsed, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">推定残り操作回数</span>
                  <span className="font-medium">約 {tokenUsage.estimatedOperations} 回</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  リセット日: {formatDate(tokenUsage.resetAt)}
                </p>
              </div>
            </div>
          )}

          {/* Plan Comparison */}
          <div>
            <h2 className="text-lg font-semibold mb-4">プラン比較</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {(Object.entries(PLAN_CONFIGS) as [PlanType, typeof PLAN_CONFIGS[PlanType]][]).map(
                ([planType, config]) => {
                  const isCurrentPlan = currentPlan === planType;
                  const canUpgrade = !isCurrentPlan && planType !== 'free';
                  const canDowngrade = isCurrentPlan && planType !== 'free';
                  
                  return (
                    <div
                      key={planType}
                      className={`relative bg-card border rounded-lg p-6 ${
                        config.recommended
                          ? 'border-primary shadow-md'
                          : 'border-border'
                      } ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
                    >
                      {config.recommended && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                          おすすめ
                        </div>
                      )}
                      {isCurrentPlan && (
                        <div className="absolute -top-3 right-4 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                          現在のプラン
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <h3 className="text-xl font-bold">{config.nameJa}</h3>
                        <div className="mt-2">
                          <span className="text-3xl font-bold">
                            ¥{config.price.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">/月</span>
                        </div>
                        {config.monthlyQuota > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatTokens(config.monthlyQuota)} トークン/月
                          </p>
                        )}
                      </div>
                      
                      <ul className="space-y-2 mb-6">
                        {config.featuresJa.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <svg
                              className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      {loading ? (
                        <div className="h-10 bg-muted rounded-md animate-pulse" />
                      ) : canUpgrade ? (
                        <button
                          onClick={() => startCheckout(planType as 'premium_basic' | 'premium_pro')}
                          disabled={checkoutLoading}
                          className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                            config.recommended
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-accent hover:bg-accent/80'
                          } disabled:opacity-50`}
                        >
                          {checkoutLoading ? '処理中...' : 'アップグレード'}
                        </button>
                      ) : canDowngrade ? (
                        <button
                          onClick={handleCancel}
                          disabled={canceling}
                          className="w-full py-2 px-4 rounded-md font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {canceling
                            ? '処理中...'
                            : cancelConfirm
                            ? '本当にキャンセルしますか？'
                            : 'キャンセル'}
                        </button>
                      ) : isCurrentPlan ? (
                        <div className="w-full py-2 px-4 rounded-md font-medium bg-muted text-center text-muted-foreground">
                          現在のプラン
                        </div>
                      ) : null}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">よくある質問</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">トークンとは何ですか？</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  トークンはAI機能を使用する際に消費される単位です。自然言語でのHabit登録・編集、AI提案などで使用されます。1回の操作で約1,000トークンを消費します。
                </p>
              </div>
              <div>
                <h3 className="font-medium">トークンが足りなくなったらどうなりますか？</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  月間トークン上限に達すると、AI機能は翌月のリセットまで使用できなくなります。基本的なHabit管理機能は引き続き利用可能です。
                </p>
              </div>
              <div>
                <h3 className="font-medium">プランの変更はいつでもできますか？</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  はい、いつでもアップグレード・ダウングレードが可能です。アップグレードは即時反映され、ダウングレードは現在の請求期間終了時に適用されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
