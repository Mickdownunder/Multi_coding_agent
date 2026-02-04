import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Control System',
    default: 'Control System - AI Agent Dashboard',
  },
  description: 'Autonomous AI agent control system for automated software development and verification.',
  keywords: ['AI', 'Agent', 'Automation', 'Software Development', 'Control System'],
  authors: [{ name: 'Michael Labitzke' }],
  referrer: 'origin-when-cross-origin',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: 'Control System',
    description: 'Autonomous AI agent control system',
    url: 'https://control-system.local',
    siteName: 'Control System',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Control System',
    description: 'Autonomous AI agent control system',
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
