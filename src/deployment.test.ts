import { afterEach, expect, it, vi } from "vitest";
import middleware from "../middleware";
import config from "../vercel.json";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("overwrites caller proxy headers with the Vercel client IP and private key", () => {
  vi.stubEnv("PROXY_SHARED_SECRET", "a-private-test-secret-at-least-32-bytes");
  const response = middleware(
    new Request("https://streaxie.test/api/v1/auth/login", {
      headers: {
        "x-real-ip": "203.0.113.1",
        "x-streaxie-client-ip": "attacker",
        "x-streaxie-proxy-key": "attacker",
      },
    }),
  );
  expect(
    response.headers.get("x-middleware-request-x-streaxie-client-ip"),
  ).toBe("203.0.113.1");
  expect(
    response.headers.get("x-middleware-request-x-streaxie-proxy-key"),
  ).toBe("a-private-test-secret-at-least-32-bytes");
});
it("fails closed when the middleware secret is missing", () => {
  vi.stubEnv("PROXY_SHARED_SECRET", "");
  expect(
    middleware(new Request("https://streaxie.test/api/v1/auth/login")).status,
  ).toBe(503);
});
it("keeps API rewrites before SPA fallback and only enables main deployments", () => {
  expect(config.bunVersion).toBe("1.4.x");
  expect(config.rewrites?.[0]).toMatchObject({
    source: "/api/:path*",
    destination: "https://streaxie-go.vercel.app/api/:path*",
  });
  expect(config.git?.deploymentEnabled).toEqual({ main: true, "*": false });
  expect(config.rewrites?.at(-1)).toMatchObject({ destination: "/index.html" });
});
it("routes API traffic only to the stable HTTPS backend", () => {
  for (const route of config.rewrites.filter((r) =>
    r.destination.startsWith("http"),
  )) {
    expect(new URL(route.destination).origin).toBe(
      "https://streaxie-go.vercel.app",
    );
  }
});
