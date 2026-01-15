import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo.metadata";

export const metadata: Metadata = createPageMetadata({
  title: "ログイン - VOW",
  description: "VOWにログインして、習慣と目標を管理。ゲストモードでも利用可能。データはクラウドに安全に保存されます。",
  path: "/login",
  locale: "ja",
  noIndex: true, // ログインページは検索エンジンにインデックスしない
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}