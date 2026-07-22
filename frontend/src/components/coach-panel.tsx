'use client';

import { useConversationState } from '@/hooks/use-conversation-state';

/**
 * Coach phase UI — owned by Person B (proactive).
 *
 * Renders the pre-conversation prep surface: stakes, counterpart profile,
 * weak points, and the LLM stress-test analysis (blind spots, concrete moves,
 * likely objections, opening strategy). All driven through shared state.
 */
export function CoachPanel() {
  const { state, setPartial } = useConversationState();

  const weakPoints = state.user_weak_points ?? [];
  const analysis = state.coach_analysis;

  const addWeakPoint = () => {
    const next = [...weakPoints, 'New weak point — edit me'];
    setPartial({ user_weak_points: next });
  };

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-6">
      <header>
        <h2 className="text-xl font-semibold">Coach — Prep</h2>
        <p className="text-sm opacity-70 mt-1">Scenario: {state.scenario_id || '—'}</p>
      </header>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">Stakes</h3>
        <p className="mt-2">{state.stakes || 'Not set yet.'}</p>
      </section>

      {analysis && <OpeningStrategy strategy={analysis.opening_strategy} />}

      {analysis && <AnalysisSection title="Blind spots" items={analysis.blind_spots} />}
      {analysis && <AnalysisSection title="Concrete moves" items={analysis.concrete_moves} />}
      {analysis && <AnalysisSection title="Likely objections" items={analysis.likely_objections} />}

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">
            Your weak points
          </h3>
          <button
            onClick={addWeakPoint}
            className="text-xs px-2 py-1 rounded border border-current/20 hover:bg-current/5"
          >
            + add
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-2">
          {weakPoints.length === 0 && (
            <li className="text-sm opacity-50">No weak points surfaced yet.</li>
          )}
          {weakPoints.map((point, i) => (
            <li key={i} className="text-sm rounded border border-current/10 p-3">
              {point}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OpeningStrategy({ strategy }: { strategy: string }) {
  return (
    <section className="rounded-lg border border-blue-400/30 bg-blue-400/5 p-4">
      <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">Opening strategy</h3>
      <p className="mt-2 text-sm">{strategy}</p>
    </section>
  );
}

function AnalysisSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-medium uppercase tracking-wide opacity-60">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm rounded border border-current/10 p-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
