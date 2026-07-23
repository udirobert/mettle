'use client';

import { AlertOctagon, Clock, Mic, Repeat, Zap, type LucideIcon } from 'lucide-react';
import type { Nudge } from '@/hooks/use-conversation-state';
import styles from './nudge-card.module.css';

type NudgeKind = Nudge['kind'];

type KindMeta = {
  label: string;
  icon: LucideIcon;
  hint?: string;
};

const KIND_META: Record<NudgeKind, KindMeta> = {
  concession: {
    label: 'Possible commitment',
    icon: AlertOctagon,
    hint: 'Qualify it before moving on.',
  },
  long_monologue: {
    label: 'Long answer',
    icon: Mic,
    hint: 'Pause and invite their reaction.',
  },
  repetition: {
    label: 'Repeating a point',
    icon: Repeat,
    hint: 'Ask what evidence would change their view.',
  },
  timing: {
    label: 'Timing signal',
    icon: Clock,
  },
  other: {
    label: 'Signal',
    icon: Zap,
  },
};

type NudgeCardVariant = 'panel' | 'signal';

type NudgeCardProps = {
  nudge: Nudge;
  variant?: NudgeCardVariant;
};

function kindClassName(kind: NudgeKind): string {
  if (kind === 'long_monologue') return styles.longMonologue;
  return styles[kind] ?? styles.other;
}

export function NudgeCard({ nudge, variant = 'panel' }: NudgeCardProps) {
  const meta = KIND_META[nudge.kind] ?? KIND_META.other;
  const Icon = meta.icon;
  const isSignal = variant === 'signal';

  return (
    <div
      className={[
        isSignal ? styles.signal : `mettle-card ${styles.panel}`,
        kindClassName(nudge.kind),
      ].join(' ')}
    >
      <div className={styles.header}>
        <Icon size={isSignal ? 16 : 14} aria-hidden="true" />
        <span className={styles.label}>{meta.label}</span>
      </div>
      <strong className={styles.message}>{nudge.message}</strong>
      {meta.hint && <p className={styles.hint}>{meta.hint}</p>}
    </div>
  );
}
