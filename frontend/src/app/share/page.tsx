'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, ListTodo, ShieldCheck } from 'lucide-react';
import { decodeShareLink, type SharedDebrief } from '@/lib/share-link';

/**
 * Read-only shared debrief memo. Payload arrives via the URL fragment —
 * nothing is stored server-side and nothing about the sender's session leaks.
 */
export default function SharePage() {
  const [memo, setMemo] = useState<SharedDebrief | null | 'invalid'>(null);

  useEffect(() => {
    setMemo(decodeShareLink(window.location.hash) ?? 'invalid');
  }, []);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <main className="mettle-share-root">
      <header className="mettle-share-top">
        <span className="mettle-share-mark">M</span>
        <span className="mettle-share-word">Mettle</span>
      </header>

      {memo === null ? (
        <p className="mettle-share-status">Loading memo…</p>
      ) : memo === 'invalid' ? (
        <section className="mettle-share-card">
          <p className="mettle-kicker">
            <CircleAlert size={13} /> Link not readable
          </p>
          <strong className="mettle-share-title">
            This share link is incomplete or was cut off.
          </strong>
          <p className="mettle-share-sub">
            Ask the sender to copy the full link — everything is encoded inside it, so nothing was
            stored on our side to fall back to.
          </p>
          <Link className="mettle-action" href="/">
            What is Mettle? <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <section className="mettle-share-card">
          <p className="mettle-kicker">
            <ShieldCheck size={13} /> Conversation debrief · read-only
          </p>
          <h1 className="mettle-share-title">
            {memo.counterpart} conversation{memo.stakes ? ` — ${memo.stakes}` : ''}
          </h1>
          {memo.savedAt && (
            <p className="mettle-share-date">Debriefed {formatDate(memo.savedAt)}</p>
          )}

          {memo.commitments.length > 0 && (
            <>
              <p className="mettle-kicker">
                <CheckCircle2 size={13} /> Commitments made
              </p>
              <ul className="mettle-list">
                {memo.commitments.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {memo.stillOpen.length > 0 && (
            <>
              <p className="mettle-kicker">Still open</p>
              <ul className="mettle-list">
                {memo.stillOpen.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {memo.alsoDo.length > 0 && (
            <>
              <p className="mettle-kicker">
                <ListTodo size={13} /> Next moves
              </p>
              <ul className="mettle-list">
                {memo.alsoDo.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          <div className="mettle-share-cta">
            <p>
              Prepared with Mettle — rehearsal, live coaching, and the accountability debrief for
              conversations you can&apos;t afford to get wrong.
            </p>
            <Link className="mettle-action" href="/">
              Prep your own conversation <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
