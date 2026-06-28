import '@repo/ui/globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feature Flag Dashboard',
  description: 'Self-hosted feature flag platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
