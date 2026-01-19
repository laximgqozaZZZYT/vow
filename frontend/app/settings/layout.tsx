import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings | VOW',
  description: 'Manage your account settings, notifications, and integrations',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
