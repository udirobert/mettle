'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * The one disclosure pattern for secondary detail across every phase:
 * a quiet ruled line with a label and a count. Primary judgment stays above it.
 */
export function Fold({
  label,
  meta,
  defaultOpen = false,
  children,
}: {
  label: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div>
      <button
        className="mettle-fold"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span>
          {label}
          {meta ? ` · ${meta}` : ''}
        </span>
        <ChevronDown
          size={16}
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
          aria-hidden="true"
        />
      </button>
      <div id={contentId} hidden={!open} className="mettle-fold-body">
        {open && children}
      </div>
    </div>
  );
}
