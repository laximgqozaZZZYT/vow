import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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

  return (
    <html lang="en">
      <head>
        {/* 構造化データ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webAppSchema),
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
        {/* Accessible skip link for keyboard users */}
        <a href="#skip-target" className="skip-link">Skip to content</a>

        {/* Header */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <div>
          {/* Importing client component */}
          {/* @ts-ignore */}
          {typeof window !== 'undefined' ? require('./components/Header').default() : null}
        </div>

        {/* Wrap children in a landmark role to avoid nesting <main> if pages already use it */}
        <div id="skip-target" role="main">
          {children}
        </div>
      </body>
    </html>
  );
}
