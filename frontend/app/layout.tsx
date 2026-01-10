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
        {children}
      </body>
    </html>
  );
}
