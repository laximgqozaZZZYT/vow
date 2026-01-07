import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vow - Personal Goal & Habit Tracker",
  description: "Track your goals and habits with Vow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
