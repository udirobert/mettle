import './globals.css';
import '@copilotkit/react-core/v2/styles.css';

import type { Metadata, Viewport } from 'next';

import { Providers } from '@/components/providers';

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

const title = 'Mettle — rehearse your hardest conversation';
const description =
  'Mettle plays the other side, finds your weak spot, and hands you the line to say. The personal agent for the conversations you cannot afford to get wrong.';

export const metadata: Metadata = {
  metadataBase: new URL(productionHost ? `https://${productionHost}` : 'http://localhost:3000'),
  title,
  description,
  icons: { icon: '/copilotkit-logo-mark.svg' },
  openGraph: {
    title,
    description,
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Mettle walk-in card' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: '#f7f4ec',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      {/*
        suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
        attributes like data-gr-ext-installed onto <body> before React hydrates,
        which would otherwise surface as a hydration mismatch on first load.
        This only relaxes the check for <body>'s own attributes (one level deep);
        everything rendered inside <body> is still fully hydration-checked.
      */}
      <body className={`antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
