'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, ListTodo, Scale, ShieldCheck } from 'lucide-react';
import {
  decodeCouncilShareLink,
  decodeShareLink,
  type SharedCouncilSplit,
  type SharedDebrief,
} from '@/lib/share-link';
import { trackClientEvent } from '@/lib/telemetry';

type ShareArtifactState =
  | null
  | 'invalid'
  | { kind: 'debrief'; data: SharedDebrief }
  | { kind: 'council'; data: SharedCouncilSplit };

/**
 * Read-only shared artifact (Debrief memo `#d=...` or Council split `#c=...`).
 * Payload arrives via the URL fragment — nothing is stored server-side and
 * nothing about the sender's session leaks.
 */
export default function SharePage() {
  const [artifact, setArtifact] = useState<ShareArtifactState>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const debrief = decodeShareLink(hash);
    if (debrief) {
      setArtifact({ kind: 'debrief', data: debrief });
      trackClientEvent('off_platform_click', { utmSource: 'share_debrief' });
      return;
    }
    const council = decodeCouncilShareLink(hash);
    if (council) {
      setArtifact({ kind: 'council', data: council });
      trackClientEvent('off_platform_click', { utmSource: 'share_council' });
      return;
    }
    setArtifact('invalid');
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

      {artifact === null ? (
        <p className="mettle-share-status">Loading card…</p>
      ) : artifact === 'invalid' ? (
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
          <Link className="mettle-action" href="/?utm_source=share_artifact&entry=rehearsal">
            Try a 60-second rehearsal <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </section>
      ) : artifact.kind === 'council' ? (
        <section className="mettle-share-card">
          <p className="mettle-kicker">
            <Scale size={13} /> Council split · read-only
          </p>
          <h1 className="mettle-share-title">
            {artifact.data.counterpart}
            {artifact.data.stakes ? ` — ${artifact.data.stakes}` : ''}
          </h1>
          <p className="mettle-share-date">
            Three adversarial perspectives argued this position. No transcript or private evidence
            included.
          </p>

          <p className="mettle-kicker">
            <CheckCircle2 size={13} /> They agreed
          </p>
          <ul className="mettle-list">
            <li>{artifact.data.agreed}</li>
          </ul>

          <p className="mettle-kicker">They split</p>
          <ul className="mettle-list">
            <li>{artifact.data.split}</li>
          </ul>

          <p className="mettle-kicker">
            <ListTodo size={13} /> The move
          </p>
          <ul className="mettle-list">
            <li>{artifact.data.move}</li>
          </ul>

          <div className="mettle-share-cta">
            <p>
              Pressure-test the conversation you cannot afford to get wrong — before you walk into
              the room.
            </p>
            <Link className="mettle-action" href="/?utm_source=share_artifact&entry=rehearsal">
              Rehearse your own conversation in 60s <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="mettle-share-card">
          <p className="mettle-kicker">
            <ShieldCheck size={13} /> Conversation debrief · read-only
          </p>
          <h1 className="mettle-share-title">
            {artifact.data.counterpart} conversation
            {artifact.data.stakes ? ` — ${artifact.data.stakes}` : ''}
          </h1>
          {artifact.data.savedAt && (
            <p className="mettle-share-date">Debriefed {formatDate(artifact.data.savedAt)}</p>
          )}
          {artifact.data.source === 'rehearsal' && (
            <p className="mettle-share-date">
              From a rehearsal run — commitments are intended lines, not promises made.
            </p>
          )}

          {artifact.data.commitments.length > 0 && (
            <>
              <p className="mettle-kicker">
                <CheckCircle2 size={13} /> Commitments made
              </p>
              <ul className="mettle-list">
                {artifact.data.commitments.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {artifact.data.stillOpen.length > 0 && (
            <>
              <p className="mettle-kicker">Still open</p>
              <ul className="mettle-list">
                {artifact.data.stillOpen.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {artifact.data.alsoDo.length > 0 && (
            <>
              <p className="mettle-kicker">
                <ListTodo size={13} /> Next moves
              </p>
              <ul className="mettle-list">
                {artifact.data.alsoDo.map((item, i) => (
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
            <Link className="mettle-action" href="/?utm_source=share_artifact&entry=rehearsal">
              Rehearse your own conversation in 60s <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
