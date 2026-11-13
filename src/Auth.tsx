import { useState, type FormEvent } from "react";
import { api, json, setAccess } from "./api";
import { Field, Notice } from "./components";
import type { Profile } from "./types";
export default function Auth({
  path,
  go,
  authenticated,
}: {
  path: string;
  go: (path: string) => void;
  authenticated: (p: Profile) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("token") || "",
  );
  const register = path === "/register",
    forgot = path === "/forgot-password",
    reset = path === "/reset-password",
    verify = path === "/verify-email";
  const title = register
    ? "Make room for a new habit."
    : forgot
      ? "Find your way back."
      : reset
        ? "Choose a new password."
        : verify
          ? "Verify your email."
          : "Welcome back.";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (forgot) {
        const r = await api<{ message: string }>(
          "/auth/forgot-password",
          json("POST", { email: f.get("email") }),
        );
        setMessage(r.message);
      } else if (reset || verify) {
        await api(
          "/auth/" + (reset ? "reset-password" : "verify-email"),
          json("POST", {
            token,
            ...(reset ? { password: f.get("password") } : {}),
          }),
        );
        history.replaceState(null, "", path);
        setMessage(
          reset
            ? "Password updated. Sign in again to continue."
            : "Email verified. You can now continue to your habits.",
        );
      } else {
        const t = await api<{ access_token: string }>(
          "/auth/" + (register ? "register" : "login"),
          json("POST", { email: f.get("email"), password: f.get("password") }),
        );
        setAccess(t.access_token);
        const p = await api<Profile>("/auth/me");
        await authenticated(p);
        if (register)
          void api("/auth/resend-verification", json("POST", {})).catch(
            () => {},
          );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          go("/");
        }}
        className="brand"
      >
        streaxie<span>.</span>
      </a>
      <section className="auth-panel">
        <p className="eyebrow">A daily practice, at your pace</p>
        <h1>{title}</h1>
        <p className="muted">
          {register
            ? "All features are free. No card needed."
            : verify
              ? "Confirm the link you opened from your email."
              : reset
                ? "Resetting ends all previous sessions."
                : "Small steps are easier to keep coming back to."}
        </p>
        <form onSubmit={submit} className="space-y-5 mt-7">
          {!reset && !verify && (
            <Field label="Email">
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                required
                autoFocus
              />
            </Field>
          )}
          {!forgot && !verify && (
            <Field
              label="Password"
              hint={
                register || reset
                  ? "At least 15 characters. A memorable phrase works well."
                  : undefined
              }
            >
              <input
                name="password"
                type="password"
                autoComplete={
                  register || reset ? "new-password" : "current-password"
                }
                required
                minLength={register || reset ? 15 : 1}
                maxLength={1024}
              />
            </Field>
          )}
          {(reset || verify) && !token && (
            <Notice error>
              This link is missing its token. Request a new email.
            </Notice>
          )}
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {!message && (
            <button
              className="primary w-full"
              disabled={busy || ((verify || reset) && !token)}
            >
              {busy
                ? "Please wait…"
                : register
                  ? "Create account"
                  : forgot
                    ? "Send reset link"
                    : reset
                      ? "Set new password"
                      : verify
                        ? "Verify email"
                        : "Sign in"}
            </button>
          )}
        </form>
        <div className="auth-links">
          {!register && !forgot && !reset && !verify && (
            <button
              className="text-button"
              onClick={() => go("/forgot-password")}
            >
              Forgot password?
            </button>
          )}
          <button
            className="text-button"
            onClick={() =>
              go(register || forgot || reset || verify ? "/login" : "/register")
            }
          >
            {register
              ? "Already have an account? Sign in"
              : forgot || reset || verify
                ? "Back to sign in"
                : "New here? Create an account"}
          </button>
        </div>
      </section>
      <p className="auth-footer">A little progress is still progress.</p>
    </main>
  );
}
