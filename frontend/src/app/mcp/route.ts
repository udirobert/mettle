import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { createMettleMcpServer } from '@/lib/mcp/create-mettle-server';
import { clientIp, isRateLimited } from '@/lib/mcp/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonError(status: number, message: string): Response {
  return withCors(
    Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message },
        id: null,
      },
      { status },
    ),
  );
}

/**
 * Public Streamable HTTP MCP endpoint for ChatGPT directory / mid-conversation
 * discovery. Stateless (sessionIdGenerator: undefined) so it works on Vercel.
 *
 * Production URL: https://mettle-xi.vercel.app/mcp
 */
async function handleMcp(request: Request): Promise<Response> {
  if (isRateLimited(clientIp(request))) {
    return jsonError(429, 'Too many requests');
  }

  const server = createMettleMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response);
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function GET(request: Request) {
  return handleMcp(request);
}

export async function POST(request: Request) {
  return handleMcp(request);
}

export async function DELETE(request: Request) {
  return handleMcp(request);
}
