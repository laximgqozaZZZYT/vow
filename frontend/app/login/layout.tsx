import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo.metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Login - Access Your VOW Account",
  description: "Sign in to your VOW account to sync your habits and goals across devices. Login with Google or GitHub for secure access.",
  path: "/login",
  noIndex: true, // ログインページは検索エンジンにインデックスしない
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}