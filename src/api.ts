export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let access = "";
let refreshing: Promise<void> | undefined;
const authChannel = new BroadcastChannel("streaxie-session");
authChannel.onmessage = (e) => {
  if (e.data === "changed") {
    access = "";
    window.dispatchEvent(new Event("sessionchange"));
  }
};
export function clearSession() {
  access = "";
  localStorage.removeItem("streaxie.active");
  authChannel.postMessage("changed");
}
export function setAccess(value: string) {
  access = value;
}
export async function ensureAccess() {
  if (!access) await refresh();
}
export function announceSession() {
  authChannel.postMessage("changed");
}
export function assertAccount(owner: string) {
  let subject = "";
  try {
    subject = JSON.parse(
      atob(access.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ).sub;
  } catch {
    /* no authenticated session */
  }
  if (subject !== owner || localStorage.getItem("streaxie.active") !== owner)
    throw new ApiError(
      401,
      "ACCOUNT_CHANGED",
      "Account changed. Sign in again before syncing.",
    );
}
export async function api<T = void>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Streaxie-Browser", "1");
  if (access) headers.set("Authorization", "Bearer " + access);
  const response = await fetch("/api/v1" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  if (
    response.status === 401 &&
    retry &&
    (!path.startsWith("/auth/") ||
      ["/auth/me", "/auth/logout", "/auth/resend-verification"].includes(path))
  ) {
    await refresh();
    return api<T>(path, options, false);
  }
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      e.code || "REQUEST_FAILED",
      e.message || "The request could not be completed.",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function refresh() {
  if (!refreshing)
    refreshing = navigator.locks
      .request("streaxie-refresh", async () => {
        const t = await api<{ access_token: string }>(
          "/auth/refresh",
          { method: "POST", body: "{}" },
          false,
        );
        access = t.access_token;
      })
      .finally(() => {
        refreshing = undefined;
      });
  return refreshing;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
