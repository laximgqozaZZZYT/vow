import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo.metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Authentication Test - VOW Development",
  description: "Development page for testing authentication configuration and Supabase integration.",
  path: "/test-auth",
  noIndex: true, // 開発用ページなので検索エンジンにインデックスしない
});

export default function TestAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}