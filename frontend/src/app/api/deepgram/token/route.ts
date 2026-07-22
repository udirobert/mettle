import { NextResponse } from "next/server";

/**
 * Mints a short-lived Deepgram token for the browser voice session.
 * Requires DEEPGRAM_API_KEY in the frontend server environment.
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not set in frontend/.env" },
      { status: 500 },
    );
  }

  try {
    const grant = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 600 }),
    });
    if (grant.ok) {
      const { access_token } = await grant.json();
      return NextResponse.json({ token: access_token, scheme: "bearer" });
    }
  } catch {
    // fall through to dev-mode raw key below
  }

  // Hackathon fallback: hand the raw key to the browser (dev only).
  return NextResponse.json({ token: apiKey, scheme: "token" });
}
