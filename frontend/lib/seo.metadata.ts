import type { Metadata } from 'next';

// アプリケーションの基本情報
export const APP_CONFIG = {
  name: 'VOW',
  description: 'Your personal habit and goal tracking application. Track your progress, build better habits, and achieve your goals with VOW.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://vow-app.vercel.app',
  ogImage: '/og-image.png',
  twitterHandle: '@vow_app',
} as const;

// 基本メタデータ
export const baseMetadata: Metadata = {
  metadataBase: new URL(APP_CONFIG.url),
  title: {
    default: APP_CONFIG.name,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.description,
  keywords: [
    'habit tracking',
    'goal setting',
    'productivity',
    'personal development',
    'habit tracker',
    'goal tracker',
    'progress tracking',
    'self improvement',
  ],
  authors: [{ name: 'VOW Team' }],
  creator: 'VOW Team',
  publisher: 'VOW Team',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: APP_CONFIG.url,
    siteName: APP_CONFIG.name,
    title: APP_CONFIG.name,
    description: APP_CONFIG.description,
    images: [
      {
        url: APP_CONFIG.ogImage,
        width: 1200,
        height: 630,
        alt: `${APP_CONFIG.name} - Habit and Goal Tracking`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: APP_CONFIG.twitterHandle,
    creator: APP_CONFIG.twitterHandle,
    title: APP_CONFIG.name,
    description: APP_CONFIG.description,
    images: [APP_CONFIG.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Google Search Console verification (環境変数から取得)
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

// ページ別メタデータ生成ヘルパー
export function createPageMetadata({
  title,
  description,
  path = '',
  noIndex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${APP_CONFIG.url}${path}`;
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [
        {
          url: APP_CONFIG.ogImage,
          width: 1200,
          height: 630,
          alt: `${title} | ${APP_CONFIG.name}`,
        },
      ],
    },
    twitter: {
      title,
      description,
      images: [APP_CONFIG.ogImage],
    },
    alternates: {
      canonical: url,
    },
    robots: noIndex ? {
      index: false,
      follow: false,
    } : undefined,
  };
}

// 構造化データ生成ヘルパー
export function createWebApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: APP_CONFIG.name,
    description: APP_CONFIG.description,
    url: APP_CONFIG.url,
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'VOW Team',
    },
  };
}