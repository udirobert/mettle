'use client';

import { useState } from 'react';

import { useWebMCP } from '@/hooks/use-webmcp';
import styles from './page.module.css';

export default function WebMCPPage() {
  const { supported, registered, calls, tools, runDemo } = useWebMCP();
  const [demoLoading, setDemoLoading] = useState(false);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            margin: '0 0 0.75rem',
            textTransform: 'uppercase',
          }}
        >
          Mettle
        </p>
        <h1>Mettle on WebMCP</h1>
        <p className={styles.lead}>
          A high-stakes conversation layer the browser&apos;s own agent can drive. The page below
          exposes six Mettle tools via the emerging WebMCP standard so people and agents can
          prepare, rehearse, support, and debrief together.
        </p>
      </header>

      <section className={styles.status}>
        {supported === null && <p>Checking WebMCP support...</p>}
        {supported === false && (
          <div className={styles.noticeError}>
            <strong>WebMCP not detected.</strong>
            <p>
              Enable it in Chrome: <code>chrome://flags/#enable-webmcp-testing</code>, or open this
              page in ChatGPT&apos;s in-app browser where WebMCP is supported out of the box.
            </p>
          </div>
        )}
        {supported === true && (
          <div className={styles.noticeSuccess}>
            {registered
              ? `WebMCP is live. ${tools.length} Mettle tools are registered.`
              : 'Registering tools with the browser...'}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Registered tools</h2>
        <ul className={styles.toolList}>
          {tools.map((tool) => (
            <li key={tool.name} className={styles.toolItem}>
              <code className={styles.toolName}>{tool.name}</code>
              <p className={styles.toolDesc}>{tool.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>What the agent can do</h2>
        <ol className={styles.flow}>
          <li>
            <strong>Load the event</strong> — <code>mettle_get_event</code> returns the stakes and
            Elena Park&apos;s profile.
          </li>
          <li>
            <strong>Paste context</strong> — <code>mettle_extract_context</code> turns an email
            thread into approved evidence.
          </li>
          <li>
            <strong>Run Coach</strong> — <code>mettle_run_coach</code> gets the Skeptic,
            Counterpart, and Negotiator perspectives plus a synthesis.
          </li>
          <li>
            <strong>Rehearse</strong> — <code>mettle_rehearse_opponent</code> roleplays Elena&apos;s
            skeptical reply to the user&apos;s last turn.
          </li>
          <li>
            <strong>Ask Wingman</strong> — <code>mettle_ask_wingman</code> answers a quick tactical
            question mid-conversation.
          </li>
          <li>
            <strong>Debrief</strong> — <code>mettle_run_debrief</code> turns a transcript into
            commitments and next actions.
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Tool call log</h2>
        {calls.length === 0 ? (
          <p className={styles.empty}>No tool calls yet. Ask the agent to use a Mettle tool.</p>
        ) : (
          <ul className={styles.callList}>
            {calls.map((call, i) => (
              <li key={i} className={styles.callItem}>
                <div className={styles.callMeta}>
                  <code>{call.name}</code>
                  <span>{call.durationMs}ms</span>
                  <span>{new Date(call.time).toLocaleTimeString()}</span>
                </div>
                <details className={styles.callDetails}>
                  <summary>Input</summary>
                  <pre className={styles.codeBlock}>{JSON.stringify(call.input, null, 2)}</pre>
                </details>
                <details className={styles.callDetails}>
                  <summary>Output</summary>
                  <pre className={styles.codeBlock}>{JSON.stringify(call.output, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2>Run a demo</h2>
        <p>
          No WebMCP browser yet? Click below to simulate the agent calling every tool in the Elena
          Park / $40M LP renewal flow. The same endpoints power the registered WebMCP tools.
        </p>
        <button
          type="button"
          className={styles.demoButton}
          disabled={demoLoading}
          onClick={async () => {
            setDemoLoading(true);
            try {
              await runDemo();
            } finally {
              setDemoLoading(false);
            }
          }}
        >
          {demoLoading ? 'Running...' : 'Run full agent demo'}
        </button>
      </section>

      <section className={styles.section}>
        <h2>Try it</h2>
        <p>
          With WebMCP enabled, ask your in-browser agent: &quot;Open the Elena Park LP renewal
          event, extract the sample thread, run Coach, then tell me the opening strategy.&quot; The
          agent will call the tools in sequence and surface the answer without leaving the tab.
        </p>
      </section>
    </main>
  );
}
