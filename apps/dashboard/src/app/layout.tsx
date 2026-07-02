import '@repo/ui/globals.css';
import type { Metadata } from 'next';

import { ThemeProvider } from './ThemeProvider';

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
