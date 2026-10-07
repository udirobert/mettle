import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mettle plans (informational)',
  description: 'Informational overview of Mettle capabilities. No checkout on this page.',
};

/**
 * Informational plans page for ChatGPT plugin free→paid ladder.
 * OpenAI allows linking to informational plans — not in-plugin digital checkout.
 */
export default function PlansPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '3rem 1.5rem',
        fontFamily: 'system-ui, sans-serif',
        lineHeight: 1.5,
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
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Plans (informational)</h1>
      <p>
        This page explains what is free in ChatGPT versus what lives in the Mettle product. There is{' '}
        <strong>no checkout</strong> here — OpenAI does not allow selling digital subscriptions
        inside ChatGPT plugins.
      </p>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>Free in ChatGPT</h2>
      <ul>
        <li>
          <code>meeting_brief</code> — paste a thread → evidence brief + likely objections
          (&quot;help me prepare for this meeting&quot; / &quot;what are they going to ask
          me&quot;).
        </li>
      </ul>

      <h2 style={{ fontSize: '1.15rem', marginTop: '2rem' }}>
        In the Mettle product (existing account)
      </h2>
      <ul>
        <li>Coach council (Skeptic / Counterpart / Negotiator)</li>
        <li>Opponent rehearsal / roleplay</li>
        <li>Live Wingman</li>
        <li>Post-meeting debrief + follow-up memo</li>
      </ul>
      <p>
        Sign in on the product site if you already have an account. Billing and upgrades happen only
        on Mettle&apos;s own site — never inside ChatGPT.
      </p>
      <p style={{ marginTop: '2rem' }}>
        <a href="https://mettle-xi.vercel.app">Open Mettle</a>
        {' · '}
        <a href="https://mettle-xi.vercel.app/webmcp">WebMCP demo</a>
        {' · '}
        <a href="https://mettle-xi.vercel.app/mcp">MCP endpoint</a>
      </p>
    </main>
  );
}
