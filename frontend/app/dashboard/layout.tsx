import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo.metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Dashboard - Track Your Habits & Goals",
  description: "Monitor your progress, manage your habits, and achieve your goals with VOW's intuitive dashboard. View statistics, calendar, and activity tracking.",
  path: "/dashboard",
  noIndex: true, // ダッシュボードは個人的なページなので検索エンジンにインデックスしない
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}