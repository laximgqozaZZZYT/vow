import type { Metadata } from 'next';

// アプリケーションの基本情報
export const APP_CONFIG = {
  name: 'VOW',
  nameJa: 'VOW - 習慣・目標トラッカー',
  description: 'Your personal habit and goal tracking application. Track your progress, build better habits, and achieve your goals with VOW.',
  descriptionJa: 'あなた専用の習慣・目標管理アプリケーション。シンプルなTODOアプリで、タスク管理を無料でブラウザから。AI駆動のタスク管理で習慣を身につけ、目標を達成しましょう。',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://vow-app.vercel.app',
  ogImage: '/opengraph-image',
  twitterHandle: '@vow_app',
  keywords: {
    en: [
      'habit tracking',
      'goal setting',
      'productivity',
      'todo app',
      'task management',
      'free browser app',
      'AI-driven task management',
    ],
    ja: [
      'シンプル TODOアプリ',
      'タスク管理 無料 ブラウザ',
      'AI駆動 タスク管理',
      '習慣管理',
      '目標設定',
      '生産性向上',
      '習慣トラッカー',
      '目標管理アプリ',
    ],
  },
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
    ...APP_CONFIG.keywords.en,
    ...APP_CONFIG.keywords.ja,
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

// Supported locales in the Next.js app and mapping to OpenGraph locale tags
export const SUPPORTED_LOCALES = ['en', 'ja'] as const;
export const OG_LOCALE_MAP: Record<string, string> = {
  en: 'en_US',
  ja: 'ja_JP',
};

// ページ別メタデータ生成ヘルパー
interface PageMetadataOptions {
  title: string;
  description: string;
  path?: string;
  locale?: 'en' | 'ja';
  noIndex?: boolean;
  ogImage?: string;
  keywords?: string[];
}

export function createPageMetadata(options: PageMetadataOptions): Metadata {
  const {
    title,
    description,
    path = '',
    locale = 'en',
    noIndex = false,
    ogImage = APP_CONFIG.ogImage,
    keywords = [],
  } = options;

  const url = `${APP_CONFIG.url}${path}`;
  const ogLocale = locale === 'ja' ? 'ja_JP' : 'en_US';
  const allKeywords = [...APP_CONFIG.keywords[locale], ...keywords];

  return {
    title,
    description,
    keywords: allKeywords,
    openGraph: {
      title,
      description,
      url,
      locale: ogLocale,
      type: 'website',
      siteName: APP_CONFIG.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${title} | ${APP_CONFIG.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: APP_CONFIG.twitterHandle,
      creator: APP_CONFIG.twitterHandle,
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
      languages: {
        'en': `${APP_CONFIG.url}${path}`,
        'ja': `${APP_CONFIG.url}/ja${path}`,
        'x-default': `${APP_CONFIG.url}${path}`,
      },
    },
    robots: noIndex ? {
      index: false,
      follow: false,
    } : {
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
  };
}

// 構造化データ生成ヘルパー
export function createWebApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
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
      url: APP_CONFIG.url,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
    },
    featureList: [
      'Habit tracking',
      'Goal setting',
      'Progress visualization',
      'Daily reminders',
      'Multi-language support',
    ],
  };
}

// パンくずリスト構造化データ生成ヘルパー
export function createBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}