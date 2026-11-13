import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BarChartIcon,
  CheckCircledIcon,
  GearIcon,
  HomeIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import Auth from "./Auth";
import Landing from "./Landing";
import {
  api,
  ApiError,
  announceSession,
  clearSession,
  ensureAccess,
  json,
  refresh,
} from "./api";
import {
  addDays,
  currentRules,
  displayLog,
  logicalDate,
  minutes,
  passed,
  readOnly,
  streak,
} from "./domain";
import {
  Dialog,
  Empty,
  Field,
  HabitCard,
  HabitForm,
  Notice,
} from "./components";
import { active, flush, pull } from "./sync";
import {
  acknowledge,
  enqueue,
  getProfile,
  saveProfile,
  snapshot,
} from "./storage";
import type { Mutation, Profile, Snapshot } from "./types";
const Insights = lazy(() => import("./Insights"));
const SettingsPage = lazy(() => import("./Settings"));
const AUTH_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export default function App() {
  const [path, setPath] = useState(location.pathname),
    [linkVersion, setLinkVersion] = useState(0),
    [profile, setProfile] = useState<Profile>(),
    [state, setState] = useState<Snapshot>(),
    [loading, setLoading] = useState(true),
    [online, setOnline] = useState(navigator.onLine),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [newHabit, setNewHabit] = useState(false),
    [syncing, setSyncing] = useState(false),
    [signout, setSignout] = useState(false),
    [tick, setTick] = useState(Date.now());
  const owner = useRef<string | undefined>(undefined),
    busy = useRef(false),
    mounted = useRef(true);
  function go(url: string) {
    history.pushState(null, "", url);
    setPath(url);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const readLocal = useCallback(async (id: string) => {
    const s = await snapshot(id);
    if (mounted.current && owner.current === id && s) setState(s);
  }, []);
  const reload = useCallback(async () => {
    const id = owner.current;
    if (!id) return;
    await ensureAccess();
    const [p, s] = await Promise.all([api<Profile>("/auth/me"), pull(id)]);
    if (owner.current !== id || !mounted.current) return;
    await saveProfile(p);
    setProfile(p);
    setState(s);
  }, []);
  const runSync = useCallback(async () => {
    const id = owner.current;
    if (
      !id ||
      busy.current ||
      !navigator.onLine ||
      AUTH_PATHS.includes(location.pathname)
    )
      return;
    busy.current = true;
    setSyncing(true);
    try {
      await reload();
      await flush(
        id,
        () =>
          owner.current === id &&
          localStorage.getItem("streaxie.active") === id,
        () => readLocal(id),
      );
      if (owner.current === id) {
        await reload();
        setError("");
      }
    } catch (e) {
      if (owner.current === id) {
        if (e instanceof ApiError && e.status === 401) {
          setError(
            "Your session ended. Sign in again to send pending check-ins.",
          );
          owner.current = undefined;
          setProfile(undefined);
          setState(undefined);
        } else
          setError(
            e instanceof ApiError
              ? e.message
              : "Connection interrupted. Check-ins saved on this device will retry automatically.",
          );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSyncing(false);
    }
  }, [readLocal, reload]);
  async function authenticated(p: Profile) {
    announceSession();
    owner.current = p.id;
    await saveProfile(p);
    localStorage.setItem("streaxie.active", p.id);
    setProfile(p);
    setState(await snapshot(p.id));
    go("/today");
    await runSync();
  }
  useEffect(() => {
    mounted.current = true;
    const pop = () => setPath(location.pathname),
      connection = () => {
        setOnline(navigator.onLine);
        if (navigator.onLine) void runSync();
      };
    const changed = () => {
      owner.current = undefined;
      setProfile(undefined);
      setState(undefined);
      setError("Account session changed in another tab. Sign in to continue.");
    };
    const hash = () => setLinkVersion((v) => v + 1);
    window.addEventListener("hashchange", hash);
    window.addEventListener("popstate", pop);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("sessionchange", changed);
    let cancelled = false;
    void (async () => {
      try {
        // Offline cache is opened only for the account last active on this device.
        const id = localStorage.getItem("streaxie.active");
        if (id) {
          const p = await getProfile(id);
          const s = await snapshot(id);
          if (!cancelled && p && s) {
            owner.current = id;
            setProfile(p);
            setState(s);
          }
        }
        if (navigator.onLine && id && !AUTH_PATHS.includes(location.pathname)) {
          await refresh();
          const p = await api<Profile>("/auth/me");
          if (cancelled) return;
          owner.current = p.id;
          await saveProfile(p);
          localStorage.setItem("streaxie.active", p.id);
          setProfile(p);
          setState(await snapshot(p.id));
          await runSync();
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && !cancelled) {
          owner.current = undefined;
          setProfile(undefined);
          setState(undefined);
          localStorage.removeItem("streaxie.active");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const timer = window.setInterval(() => {
      setTick(Date.now());
      if (document.visibilityState === "visible") void runSync();
    }, 30000);
    return () => {
      cancelled = true;
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("sessionchange", changed);
    };
  }, [runSync]);
  async function logout() {
    if (!online) {
      setError(
        "Connect to sign out so the server can end this session. Pending check-ins stay on this device.",
      );
      return;
    }
    try {
      await api("/auth/logout", json("POST", {}));
      owner.current = undefined;
      clearSession();
      setProfile(undefined);
      setState(undefined);
      setSignout(false);
      go("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save(m: Omit<Mutation, "id" | "client_recorded_at">) {
    const id = owner.current;
    if (!id || !profile || readOnly(profile))
      throw new Error("Verify your email before checking in.");
    const h = state?.habits.find((h) => h.id === m.habit_id);
    const p = {
      ...m,
      id: crypto.randomUUID(),
      local_id: crypto.randomUUID(),
      rules: h ? currentRules(h, m.logical_date) : undefined,
      client_recorded_at: Math.max(
        Date.now(),
        ...(state?.pending.map((p) => p.client_recorded_at + 1) || []),
      ),
    };
    await enqueue(id, p);
    await readLocal(id);
    void runSync();
  }
  async function resend() {
    setMessage("");
    try {
      const r = await api<{ message: string }>(
        "/auth/resend-verification",
        json("POST", {}),
      );
      setMessage(r.message);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const authPath = AUTH_PATHS.includes(path);
  if (authPath)
    return (
      <Auth
        key={path + linkVersion}
        path={path}
        go={go}
        authenticated={authenticated}
      />
    );
  if (loading && !profile)
    return (
      <div className="loading-shell" role="status">
        Opening your daily space…
        <Skeleton />
      </div>
    );
  if (!profile)
    return path === "/" ? (
      <Landing go={go} />
    ) : (
      <Auth key="login" path="/login" go={go} authenticated={authenticated} />
    );
  const date = state ? logicalDate(state.settings, tick) : "",
    habits = state ? active(state.habits) : [],
    readonly = readOnly(profile),
    completed = state
      ? habits.filter((h) =>
          passed(displayLog(h, state.logs, state.pending, date)?.eval_status),
        ).length
      : 0;
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="/today"
          onClick={(e) => {
            e.preventDefault();
            go("/today");
          }}
        >
          streaxie<span>.</span>
        </a>
        <nav className="app-nav" aria-label="Main navigation">
          {[
            ["/today", "Today", HomeIcon],
            ["/insights", "Insights", BarChartIcon],
            ["/settings", "Settings", GearIcon],
          ].map(([url, label, Icon]) => (
            <a
              key={url as string}
              href={url as string}
              aria-current={path === url ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                go(url as string);
              }}
            >
              <Icon />
              {label as string}
            </a>
          ))}
        </nav>
        <span className="connection-label">
          {!online
            ? "Offline"
            : syncing
              ? "Syncing…"
              : state?.pending.length
                ? `${state.pending.length} pending`
                : "All up to date"}
        </span>
      </header>
      <main className="app-main">
        {!profile.email_verified_at && (
          <div className="verification-banner">
            <span>
              {readonly
                ? "Your account is read-only. Verify your email to make changes."
                : `Verify your email by ${new Date(profile.verification_deadline).toLocaleDateString("en", { month: "short", day: "numeric" })} to keep checking in.`}
            </span>
            <button
              className="text-button"
              disabled={!online}
              onClick={() => void resend()}
            >
              Send verification link
            </button>
          </div>
        )}
        {!online && (
          <Notice>
            You’re offline. Existing habits and check-ins are saved on this
            device.
          </Notice>
        )}
        {error && (
          <Notice error>
            {error}{" "}
            <button
              className="text-button"
              disabled={!online}
              onClick={() => void runSync()}
            >
              Retry
            </button>
          </Notice>
        )}
        {message && <Notice>{message}</Notice>}
        {!state ? (
          <>
            <Skeleton />
            <button onClick={() => void runSync()}>Try loading again</button>
          </>
        ) : !profile.onboarding_completed && state.habits.length === 0 ? (
          <Onboarding online={online} readonly={readonly} done={reload} />
        ) : (
          <Suspense fallback={<Skeleton />}>
            {path === "/insights" ? (
              <Insights state={state} date={date} />
            ) : path === "/settings" ? (
              <SettingsPage
                state={state}
                profile={profile}
                online={online}
                readonly={readonly}
                reload={reload}
                logout={async () => {
                  if (state.pending.length) setSignout(true);
                  else await logout();
                }}
              />
            ) : (
              <>
                <div className="page-heading flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow">
                      {new Date(date + "T12:00:00").toLocaleDateString("en", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <h1>Today</h1>
                    <p className="muted">A few things, just for you.</p>
                  </div>
                  <button
                    className="primary"
                    disabled={!online || readonly}
                    onClick={() => setNewHabit(true)}
                  >
                    <PlusIcon />
                    New habit
                  </button>
                </div>
                <div className="today-layout">
                  <section aria-label="Today’s habits">
                    <div className="list-heading">
                      <h2>
                        Your habits{" "}
                        <span className="muted">{habits.length}</span>
                      </h2>
                      <span>
                        {completed} of {habits.length} on target
                      </span>
                    </div>
                    <div className="habit-list">
                      {habits.length ? (
                        habits.map((h) => (
                          <HabitCard
                            key={h.id + date}
                            habit={h}
                            state={state}
                            date={date}
                            readonly={readonly}
                            onSave={save}
                          />
                        ))
                      ) : (
                        <Empty
                          action={
                            !readonly && online
                              ? () => setNewHabit(true)
                              : undefined
                          }
                        >
                          Choose something small you want to come back to.
                        </Empty>
                      )}
                    </div>
                  </section>
                  <aside className="today-aside">
                    <section className="progress-panel">
                      <span className="eyebrow">A LITTLE PROGRESS</span>
                      <div className="progress-number">
                        {completed}
                        <span>/{habits.length}</span>
                      </div>
                      <p>
                        {completed === habits.length && habits.length
                          ? "You’ve made time for every habit today."
                          : "Every check-in is a step worth taking."}
                      </p>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${habits.length ? (completed / habits.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <small>
                        {state.pending.length
                          ? "Includes check-ins waiting to sync."
                          : "Your progress for this logical day."}
                      </small>
                    </section>
                    <section className="streak-panel">
                      <h2>Keep showing up.</h2>
                      <p className="muted">
                        Your current streaks, side by side.
                      </p>
                      {habits.map((h) => (
                        <div className="streak-row" key={h.id}>
                          <span>{h.title}</span>
                          <strong>
                            {streak(h, state.logs, state.pending, date)}{" "}
                            <small>
                              days
                              {state.pending.some((p) => p.habit_id === h.id)
                                ? " · pending"
                                : ""}
                            </small>
                          </strong>
                        </div>
                      ))}
                      <button
                        className="text-button mt-4"
                        onClick={() => go("/insights")}
                      >
                        See your progress
                      </button>
                    </section>
                    <p className="day-note">
                      Your day follows {state.settings.current.timezone}.
                      Yesterday: {addDays(date, -1)}.
                    </p>
                  </aside>
                </div>
              </>
            )}
          </Suspense>
        )}
        {state?.pending.some((p) => p.error) && (
          <section className="panel mt-6">
            <h2>Check-ins needing attention</h2>
            <p className="muted">
              The server did not accept these edits. They remain on this device
              until you dismiss them.
            </p>
            {state.pending
              .filter((p) => p.error)
              .map((p) => (
                <div className="rejection" key={p.local_id}>
                  <p>
                    <strong>
                      {state.habits.find((h) => h.id === p.habit_id)?.title ||
                        "Habit"}{" "}
                      · {p.logical_date}
                    </strong>
                    <br />
                    {p.error}
                  </p>
                  <button
                    disabled={!online || readonly}
                    onClick={() => {
                      const { error: _error, ...retry } = p;
                      void enqueue(profile.id, retry)
                        .then(async () => {
                          await readLocal(profile.id);
                          void runSync();
                        })
                        .catch((e) => setError((e as Error).message));
                    }}
                  >
                    Retry original check-in
                  </button>
                  <button
                    onClick={() =>
                      void acknowledge(profile.id, p).then(() =>
                        readLocal(profile.id),
                      )
                    }
                  >
                    Dismiss local edit
                  </button>
                </div>
              ))}
          </section>
        )}
      </main>
      <footer className="app-footer">
        <CheckCircledIcon />
        One day at a time.
      </footer>
      {newHabit && (
        <Dialog title="A new habit" close={() => setNewHabit(false)}>
          <HabitForm
            cancel={() => setNewHabit(false)}
            submit={async (input) => {
              await api("/habits", json("POST", input));
              await reload();
              setNewHabit(false);
            }}
          />
        </Dialog>
      )}
      {signout && (
        <Dialog
          title="Some check-ins are still pending"
          close={() => setSignout(false)}
        >
          <p className="my-5">
            They will stay on this device, linked to {profile.email}. Sending
            pauses until you sign in to this same account again.
          </p>
          <div className="flex gap-2">
            <button className="primary" onClick={() => void logout()}>
              Sign out and keep pending
            </button>
            <button onClick={() => setSignout(false)}>Stay here</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Onboarding({
  online,
  readonly,
  done,
}: {
  online: boolean;
  readonly: boolean;
  done: () => Promise<void>;
}) {
  const [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [custom, setCustom] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="onboarding-panel">
      <p className="eyebrow">WELCOME TO YOUR DAILY SPACE</p>
      <h1>First, let’s set your day.</h1>
      <p className="muted mb-7">
        Confirm your timezone before creating your first habit. Your day starts
        at midnight unless you choose another time.
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          void api(
            "/settings/onboarding",
            json("POST", {
              timezone,
              day_rollover_minutes: custom
                ? minutes(String(f.get("rollover")))
                : 0,
            }),
          )
            .then(done)
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        <Field label="Your timezone">
          <input
            required
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={custom}
            onChange={(e) => setCustom(e.target.checked)}
          />
          My day starts at a different time
        </label>
        {custom && (
          <Field label="Start a new day at">
            <input required type="time" name="rollover" defaultValue="00:00" />
          </Field>
        )}
        {error && <Notice error>{error}</Notice>}
        <button className="primary" disabled={!online || readonly || busy}>
          {busy ? <ReloadIcon /> : null}Confirm my day
        </button>
      </form>
    </section>
  );
}
function Skeleton() {
  return (
    <div className="skeleton-list" role="status" aria-label="Loading habits">
      {[1, 2, 3].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
