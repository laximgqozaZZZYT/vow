import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { baseMetadata, createWebApplicationSchema } from "../lib/seo.metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = baseMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const webAppSchema = createWebApplicationSchema();
  
  // JSON-LD構造化データのシリアライズ（エラーハンドリング付き）
  let structuredDataJson = '';
  try {
    structuredDataJson = JSON.stringify(webAppSchema);
  } catch (error) {
    console.error('Failed to serialize structured data:', error);
    // フォールバック: 最小限の有効なスキーマ
    structuredDataJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'VOW',
      url: process.env.NEXT_PUBLIC_SITE_URL || 'https://vow-app.vercel.app',
    });
  }

  return (
    <html lang="ja">
      <head>
        {/* 構造化データ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: structuredDataJson,
          }}
        />
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Ensure proper mobile scaling */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//supabase.co" />
        <link rel="dns-prefetch" href="//vercel.app" />
        {/* Language alternatives - 将来の多言語対応のための準備 */}
        <link rel="alternate" hrefLang="en" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/`} />
        <link rel="alternate" hrefLang="ja" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/ja`} />
        <link rel="alternate" hrefLang="x-default" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/`} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* アクセシビリティ: スキップリンク */}
        <a href="#main-content" className="skip-link">
          コンテンツへスキップ
        </a>

        {/* セマンティックヘッダー */}
        <Header />

        {/* メインコンテンツ */}
        <main id="main-content">
          {children}
        </main>

        {/* セマンティックフッター */}
        <footer className="border-t border-zinc-200 bg-transparent py-8">
          <div className="mx-auto max-w-4xl px-6 text-center text-sm text-zinc-600">
            © {new Date().getFullYear()} VOW — 集中と継続のために作られました。
          </div>
        </footer>
      </body>
    </html>
  );
}
