import type { VercelConfig } from "@vercel/config/v1";

const configured = process.env.BACKEND_ORIGIN;
if (process.env.VERCEL === "1" && !configured) {
  throw new Error(
    "BACKEND_ORIGIN must be the stable backend production origin.",
  );
}
const backend = new URL(configured || "http://127.0.0.1:8080");
if (
  backend.username ||
  backend.password ||
  backend.search ||
  backend.hash ||
  backend.pathname !== "/" ||
  (process.env.VERCEL === "1" && backend.protocol !== "https:")
) {
  throw new Error(
    "BACKEND_ORIGIN must be an HTTPS origin without credentials or a path.",
  );
}

const config: VercelConfig = {
  bunVersion: "1.4.x",
  framework: "vite",
  installCommand: "bun install --frozen-lockfile",
  buildCommand: "bun run test && bun run build",
  outputDirectory: "dist",
  git: { deploymentEnabled: { main: true, "*": false } },
  rewrites: [
    { source: "/api/:path*", destination: `${backend.origin}/api/:path*` },
    { source: "/healthz", destination: `${backend.origin}/healthz` },
    { source: "/(.*)", destination: "/index.html" },
  ],
  headers: [
    {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    },
    {
      source: "/sw.js",
      headers: [{ key: "Cache-Control", value: "no-cache" }],
    },
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
        },
      ],
    },
  ],
};
export default config;
