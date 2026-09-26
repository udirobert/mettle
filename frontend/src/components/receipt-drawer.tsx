'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';

import type { ContextSource } from '@/hooks/use-conversation-state';
import { replayHref } from '@/lib/research';
import { ReplayPlayer } from '@/components/replay-player';
import 'rrweb-player/dist/style.css';
import styles from './receipt-drawer.module.css';

/**
 * The receipt: the claim on top, the recorded Solari session that found it
 * playing underneath. Opens beside the brief so you never lose your place.
 */
export function ReceiptDrawer({
  claim,
  source,
  onClose,
}: {
  claim: string;
  source: ContextSource;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const host = source.url ? new URL(source.url).hostname.replace(/^www\./, '') : source.author;
  const fullPage = replayHref(source);

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-labelledby="receipt-claim"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className="mettle-label">Receipt · recorded by Solari</span>
          <button className={styles.close} onClick={onClose} type="button" aria-label="Close receipt">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <blockquote className={styles.claim}>
          <p id="receipt-claim">&ldquo;{claim}&rdquo;</p>
          <footer className="mettle-label">
            {host}
            {source.title && source.title !== host ? ` · ${source.title}` : ''}
          </footer>
        </blockquote>

        <div className={`${styles.stage} mettle-plan`}>
          <span className={`${styles.stageLabel} mettle-label`}>
            <span className="mettle-spike" aria-hidden="true" />
            The session that read it
          </span>
          {source.replay_session_id && (
            <ReplayPlayer sessionId={source.replay_session_id} height={300} />
          )}
        </div>

        <p className={styles.fine}>
          A recorded cloud browser read this page for your brief. Nothing reaches the council
          until you keep it.
        </p>

        <div className={styles.links}>
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              Open the page <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
          {fullPage && (
            <a href={fullPage} target="_blank" rel="noopener noreferrer">
              Full-screen replay <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </dialog>
  );
}
