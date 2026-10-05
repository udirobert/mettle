'use client';

import { AlertTriangle, ChevronDown, Crosshair, User } from 'lucide-react';

import styles from './dossier.module.css';

export type CounterpartProfile = {
  name?: string;
  role?: string;
  style?: string[];
  leverage?: string;
  concerns?: string[];
};

/**
 * The counterpart as a briefing rather than a form field.
 *
 * Dana's leverage and concerns are already in state — the backend extracts them
 * and the council reasons over them — but they were rendered nowhere. This is
 * the "what am I walking into" document, and it should read like one: their
 * constraints stated plainly, and their concerns in their own terms.
 *
 * Collapsed by default with the count visible, for the same reason the Scout log
 * is: the load-bearing detail is available on demand without crowding the phase.
 */
export function CounterpartDossier({
  profile,
  defaultOpen = false,
}: {
  profile: CounterpartProfile | undefined;
  defaultOpen?: boolean;
}) {
  const style = profile?.style ?? [];
  const concerns = profile?.concerns ?? [];
  const leverage = profile?.leverage?.trim() ?? '';
  const hasContent = Boolean(leverage || concerns.length > 0 || style.length > 0);

  if (!profile?.name || !hasContent) return null;

  return (
    <section className={styles.dossier} aria-label={`${profile.name} briefing`}>
      <details className={styles.details} open={defaultOpen}>
        <summary className={styles.summary}>
          <span className={styles.summaryLeft}>
            <User size={13} aria-hidden="true" />
            <span className={styles.summaryName}>{profile.name}</span>
            {profile.role && <span className={styles.summaryRole}>{profile.role}</span>}
          </span>
          <span className={styles.summaryRight}>
            <span className={styles.summaryCount}>
              {concerns.length} concern{concerns.length === 1 ? '' : 's'}
            </span>
            <ChevronDown size={15} aria-hidden="true" className={styles.chevron} />
          </span>
        </summary>

        <div className={styles.body}>
          {style.length > 0 && (
            <div className={styles.block}>
              <p className={styles.blockLabel}>How they operate</p>
              <ul className={styles.styleList}>
                {style.map((trait) => (
                  <li key={trait} className={styles.styleChip}>
                    {trait}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {leverage && (
            <div className={`${styles.block} ${styles.blockLeverage}`}>
              <p className={styles.blockLabel}>
                <Crosshair size={12} aria-hidden="true" /> Their leverage
              </p>
              <p className={styles.leverageText}>{leverage}</p>
            </div>
          )}

          {concerns.length > 0 && (
            <div className={styles.block}>
              <p className={styles.blockLabel}>
                <AlertTriangle size={12} aria-hidden="true" /> What they will push on
              </p>
              <ul className={styles.concernList}>
                {concerns.map((concern) => (
                  <li key={concern} className={styles.concernItem}>
                    {concern}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
