import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valet: a valet key for AI agents to pay with PayPal',
  description:
    'Give any AI agent a scoped, revocable permission to pay with PayPal. Valet checks every payment against what you actually asked for. PayPal AI Hackathon 2026 prototype.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
