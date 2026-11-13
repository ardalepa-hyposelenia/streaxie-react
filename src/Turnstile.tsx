import { useEffect, useRef, useState } from "react";

type Widget = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Widget;
  }
}
export const turnstileEnabled = Boolean(
  import.meta.env.VITE_TURNSTILE_SITE_KEY,
);
let loading: Promise<void> | undefined;
function load() {
  if (window.turnstile) return Promise.resolve();
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error("Security check could not load. Check your connection."),
        );
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
export default function Turnstile({
  action,
  onToken,
}: {
  action: string;
  onToken: (token: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!turnstileEnabled) return;
    setError("");
    let disposed = false,
      id: string | undefined;
    void load()
      .then(() => {
        if (disposed || !element.current) return;
        id = window.turnstile!.render(element.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          action,
          theme: "light",
          size: "flexible",
          callback: (token: string) => {
            setError("");
            onToken(token);
          },
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            setError("Security check failed. Please try again.");
          },
        });
      })
      .catch((error) => {
        if (!disposed) setError((error as Error).message);
      });
    return () => {
      disposed = true;
      if (id) window.turnstile?.remove(id);
      onToken("");
    };
  }, [action, onToken, attempt]);
  if (!turnstileEnabled) return null;
  return (
    <div>
      <div ref={element} />
      {error && (
        <div>
          <p role="alert" className="muted">
            {error}
          </p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry security check
          </button>
        </div>
      )}
    </div>
  );
}
