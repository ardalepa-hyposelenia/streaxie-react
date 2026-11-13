import { next } from "@vercel/edge";

export const config = { matcher: ["/api/:path*"], runtime: "nodejs" };

export default function middleware(request: Request): Response {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json({ code: "PROXY_UNAVAILABLE" }, { status: 503 });
  }
  const headers = new Headers(request.headers);
  // Vercel supplies x-real-ip at the frontend edge. Replace any caller headers
  // before the rewrite; only the shared secret authorizes this IP at the API.
  headers.set("X-Streaxie-Client-IP", request.headers.get("x-real-ip") || "");
  headers.set("X-Streaxie-Proxy-Key", secret);
  return next({ request: { headers } });
}
