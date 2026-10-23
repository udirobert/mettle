import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mettle Support',
  description: 'Support, feedback, and data-deletion requests for Mettle and the ChatGPT MCP tool.',
};

export default function SupportPage() {
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
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Support &amp; Contact</h1>
      <p>
        Need help with the Mettle web workspace, the ChatGPT MCP connector (
        <code>https://mettle-xi.vercel.app/mcp</code>), or a counterpart memory deletion request?
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>Self-serve controls</h2>
      <ul>
        <li>
          <strong>Forget counterpart memory:</strong> Open any counterpart dossier in Mettle and
          click <em>Forget</em> to clear both server-stored memory and local browser records.
        </li>
        <li>
          <strong>Private session mode:</strong> Toggle <em>Private</em> in the top bar before a
          rehearsal or debrief to prevent saving notes beyond the active tab.
        </li>
        <li>
          <strong>Diagnostic bundle:</strong> Use the redacted debug export if a Coach or Scout run
          falls back unexpectedly.
        </li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>Contact</h2>
      <p>
        For bug reports, plugin integration issues, or privacy questions, reach out via GitHub
        Issues on the Mettle repository or email{' '}
        <a href="mailto:support@mettle.app">support@mettle.app</a>.
      </p>

      <p style={{ marginTop: '2rem' }}>
        <a href="/">Open Mettle</a>
        {' · '}
        <a href="/plans">Plans</a>
        {' · '}
        <a href="/privacy">Privacy Policy</a>
      </p>
    </main>
  );
}
