import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mettle Privacy Policy',
  description:
    'How Mettle handles pasted correspondence, claim approval gates, and counterpart memory.',
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3rem 1.5rem',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.55,
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}
      >
        Mettle
      </p>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Privacy Policy</h1>
      <p>
        Mettle is built for high-stakes personal conversations where confidentiality is
        non-negotiable. This policy covers both the Mettle web product (
        <code>https://mettle-xi.vercel.app</code>) and the remote ChatGPT MCP tool (
        <code>meeting_brief</code> at <code>/mcp</code>).
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>1. ChatGPT MCP tool (/mcp)</h2>
      <ul>
        <li>
          <code>meeting_brief</code> runs statelessly in memory to extract an evidence brief and
          likely counterpart objections from the text you provide.
        </li>
        <li>
          Pasted thread content sent to <code>/mcp</code> is <strong>not</strong> persisted to our
          database or used to train any models.
        </li>
        <li>
          We log only aggregate, non-reversible request counters (tool call count, rate-limit hash)
          to keep the service reliable.
        </li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>
        2. Web workspace &amp; human approval gate
      </h2>
      <ul>
        <li>
          External text (forwarded threads or web research) is treated as untrusted data and
          screened for prompt-injection instructions before extraction.
        </li>
        <li>
          Every extracted claim requires explicit human approval (Keep / Reject) before reaching the
          Coach council.
        </li>
        <li>
          When Privacy Mode is set to <strong>Private</strong>, counterpart memory is not written
          after a debrief, and you can delete stored counterpart history at any time with the{' '}
          <strong>Forget</strong> control.
        </li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>3. Share links &amp; exports</h2>
      <p>
        Debrief share links encode commitments and next moves inside the URL fragment (
        <code>#d=...</code>) so the payload is never sent to our servers on page load. Raw
        transcripts and unapproved evidence claims are excluded from share cards.
      </p>

      <p style={{ marginTop: '2rem' }}>
        <a href="/">Open Mettle</a>
        {' · '}
        <a href="/plans">Plans</a>
        {' · '}
        <a href="/support">Support</a>
      </p>
    </main>
  );
}
