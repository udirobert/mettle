import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ReplayPlayer } from '@/components/replay-player';
import 'rrweb-player/dist/style.css';

export const metadata: Metadata = {
  title: 'Research replay · Mettle',
  description: 'Watch the recorded browser session that gathered this evidence.',
  robots: { index: false },
};

export default async function ReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ url?: string; title?: string }>;
}) {
  const { sessionId } = await params;
  const { url, title } = await searchParams;

  return (
    <main className="mettle-share-root">
      <div className="mettle-share-top">
        <Link href="/" className="mettle-icon-action">
          <ArrowLeft size={14} aria-hidden="true" /> Back to prep
        </Link>
      </div>
      <section className="mettle-share-card" aria-labelledby="replay-title">
        <p className="mettle-kicker">Research receipt · recorded by Solari</p>
        <h1 id="replay-title" className="mettle-share-title">
          {title || 'How this evidence was gathered'}
        </h1>
        <p className="mettle-copy">
          A recorded Solari cloud browser read this page for your brief. Watch exactly what it saw.
          Every claim it proposed traces back to this session.
          {url && (
            <>
              {' '}
              Source:{' '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                {new URL(url).hostname}
              </a>
            </>
          )}
        </p>
        <ReplayPlayer sessionId={sessionId} />
      </section>
    </main>
  );
}
