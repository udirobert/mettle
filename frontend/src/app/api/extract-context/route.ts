import { extractBriefFromPaste } from '@/lib/extract-evidence';

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    counterpart_name?: string;
  };
  const text = body.text ?? '';
  const counterpartName = body.counterpart_name ?? 'Counterpart';

  const agentUrl = (
    process.env.AGENT_URL ||
    process.env.LANGGRAPH_DEPLOYMENT_URL ||
    'http://localhost:8123'
  ).replace(/\/$/, '');

  try {
    const response = await fetch(`${agentUrl}/extract-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, counterpart_name: counterpartName }),
    });
    if (response.ok) {
      return Response.json(await response.json());
    }
  } catch {
    // Agent down — extract locally so paste still works.
  }

  return Response.json(extractBriefFromPaste(text, counterpartName));
}
