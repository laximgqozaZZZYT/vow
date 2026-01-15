import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo.metadata";

export const metadata: Metadata = createPageMetadata({
  title: "ダッシュボード - VOW",
  description: "習慣の進捗を確認し、目標を管理。カレンダービュー、統計グラフ、マインドマップで視覚的にタスクを管理。",
  path: "/dashboard",
  locale: "ja",
  noIndex: true, // ダッシュボードは個人的なページなので検索エンジンにインデックスしない
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}