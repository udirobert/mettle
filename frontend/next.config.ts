import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for Docker self-hosting; Vercel's adapter does not
  // emit the files Next.js 16.3 expects when standalone is enabled, causing an
  // ENOENT for next-server.js.nft.json. See vercel/next.js#96646.
  output: process.env.VERCEL ? undefined : "standalone",
  serverExternalPackages: ["@copilotkit/runtime"],
  env: {
    // The public Threads UI flag is DERIVED from the server-side license token.
    // Set COPILOTKIT_LICENSE_TOKEN (only) to enable Threads — do not set this flag
    // directly. NOTE: NEXT_PUBLIC_* resolves at BUILD time while the runtime reads
    // the token per-request, so the UI gate and runtime agree only when the token is
    // present at build time (the standard `next dev` / host-build flow). For a
    // standalone/Docker image built without the token and injected at runtime, set
    // COPILOTKIT_LICENSE_TOKEN at build time too (or gate the UI at runtime) so the
    // baked flag reflects it.
    NEXT_PUBLIC_COPILOTKIT_THREADS_ENABLED: process.env.COPILOTKIT_LICENSE_TOKEN
      ? "true"
      : "false",
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // microphone=(self): push-to-talk uses the browser's SpeechRecognition,
      // which Chrome gates behind the microphone permissions policy.
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), tools=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      {
        // Wide CSP: Next.js injects inline scripts/styles and the app talks to
        // arbitrary agent/LLM origins, so we lock frame-ancestors, object-src,
        // and base-uri rather than fully restricting script-src.
        key: "Content-Security-Policy",
        value:
          "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; " +
          "form-action 'self' https://*.vercel.app; upgrade-insecure-requests",
      },
    ];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  typescript: {
    // Full type checking enforced at build; previously disabled for an
    // HttpAgent/CopilotRuntime mismatch that is now resolved.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
