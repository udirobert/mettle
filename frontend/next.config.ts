import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
    // Docker route override uses HttpAgent which has a type mismatch with CopilotRuntime
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
