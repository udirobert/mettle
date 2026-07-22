"use client";

import { useState } from "react";

import {
  CopilotChat,
  CopilotChatConfigurationProvider,
  CopilotThreadsDrawer,
} from "@copilotkit/react-core/v2";

import { CoachPanel } from "@/components/coach-panel";
import { OpponentChat } from "@/components/opponent-chat";
import { WingmanSidePanel } from "@/components/wingman-side-panel";
import { DebriefView } from "@/components/debrief-view";
import { useConversationState } from "@/hooks/use-conversation-state";

import styles from "./page.module.css";

type Phase = "prep" | "rehearsal" | "live" | "debrief";

const PHASE_LABELS: Record<Phase, string> = {
  prep: "Coach",
  rehearsal: "Opponent",
  live: "Wingman",
  debrief: "Debrief",
};

function PhaseCanvas({ phase }: { phase: Phase }) {
  switch (phase) {
    case "prep":
      return <CoachPanel />;
    case "rehearsal":
      return <OpponentChat />;
    case "live":
      return <WingmanSidePanel />;
    case "debrief":
      return <DebriefView />;
  }
}

function PhaseSwitcher({
  phase,
  onChange,
}: {
  phase: Phase;
  onChange: (p: Phase) => void;
}) {
  return (
    <nav className="flex gap-1 p-2 border-b border-current/10">
      {(Object.keys(PHASE_LABELS) as Phase[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            phase === p ? "bg-current/10" : "hover:bg-current/5"
          }`}
        >
          {PHASE_LABELS[p]}
        </button>
      ))}
    </nav>
  );
}

export default function HomePage() {
  const { state, setPhase } = useConversationState();
  const [localPhase, setLocalPhase] = useState<Phase>(
    state.phase ?? "prep",
  );

  const selectPhase = (p: Phase) => {
    setLocalPhase(p);
    setPhase(p);
  };

  return (
    <CopilotChatConfigurationProvider agentId="default">
      <div className={styles.layout}>
        <CopilotThreadsDrawer agentId="default" />
        <div className={styles.mainPanel}>
          <div className="flex flex-col h-full">
            <PhaseSwitcher phase={localPhase} onChange={selectPhase} />
            <div className="flex-1 min-h-0">
              <PhaseCanvas phase={localPhase} />
            </div>
          </div>
          <aside className="w-[420px] border-l border-current/10 flex flex-col">
            <CopilotChat
              attachments={{ enabled: true }}
              input={{ disclaimer: () => null, className: "pb-6" }}
            />
          </aside>
        </div>
      </div>
    </CopilotChatConfigurationProvider>
  );
}
