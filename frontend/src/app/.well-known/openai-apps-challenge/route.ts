import { NextResponse } from 'next/server';

/**
 * Domain verification token for ChatGPT plugin submission.
 * Set OPENAI_APPS_CHALLENGE_TOKEN in Vercel env when OpenAI issues the token.
 * Until then returns a placeholder so the route exists at a stable path.
 */
export async function GET() {
  const token =
    process.env.OPENAI_APPS_CHALLENGE_TOKEN ||
    'mettle-openai-apps-challenge-placeholder';
  return new NextResponse(token, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
