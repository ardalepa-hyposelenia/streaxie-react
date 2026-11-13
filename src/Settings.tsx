import { useState, type FormEvent } from "react";
import { api, json } from "./api";
import { clock, minutes, targetLabel } from "./domain";
import { Dialog, Field, HabitForm, Notice } from "./components";
import type { Habit, Profile, Snapshot } from "./types";
export default function SettingsPage({
  state,
  profile,
  online,
  readonly,
  reload,
  logout,
}: {
  state: Snapshot;
  profile: Profile;
  online: boolean;
  readonly: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Habit>(),
    [archive, setArchive] = useState(false),
    [deleting, setDeleting] = useState<Habit>();
  const blocked = !online || readonly;
  async function act(fn: () => Promise<unknown>, success: string) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
      await reload();
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
      try {
        await reload();
      } catch {
        /* preserve the original error */
      }
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void act(
      () =>
        api(
          "/settings",
          json("PUT", {
            timezone: f.get("timezone"),
            day_rollover_minutes: minutes(String(f.get("rollover"))),
          }),
        ),
      "Settings scheduled for the next day boundary.",
    );
  }
  const habits = state.habits.filter(
    (h) => !h.deleted_at && h.is_archived === archive,
  );
  return (
    <div className="space-y-7">
      <div className="page-heading">
        <p className="eyebrow">YOUR SPACE</p>
        <h1>Settings</h1>
        <p className="muted">Make Streaxie fit your day.</p>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <section className="panel">
        <h2>Your account</h2>
        <p className="mt-3">{profile.email}</p>
        <p className="muted">
          {profile.email_verified_at ? "Email verified" : "Email not verified"}
        </p>
        <button className="mt-4" disabled={busy} onClick={() => void logout()}>
          Sign out
        </button>
      </section>
      <section className="panel">
        <h2>Your day</h2>
        <p className="muted mb-5">
          Changes take effect after the next boundary of your current day.
        </p>
        <form onSubmit={save} className="space-y-4">
          <Field label="Timezone">
            <input
              name="timezone"
              required
              defaultValue={
                state.settings.pending?.timezone ||
                state.settings.current.timezone
              }
              list="timezones"
            />
          </Field>
          <TimezoneList />
          <Field label="Start a new day at">
            <input
              type="time"
              name="rollover"
              required
              defaultValue={clock(
                state.settings.pending?.day_rollover_minutes ??
                  state.settings.current.day_rollover_minutes,
              )}
            />
          </Field>
          {state.settings.pending && (
            <Notice>
              Pending: {state.settings.pending.timezone},{" "}
              {clock(state.settings.pending.day_rollover_minutes)}. Begins{" "}
              {new Date(state.settings.pending.effective_from).toLocaleString()}
              .
            </Notice>
          )}
          <button className="primary" disabled={busy || blocked}>
            Save settings
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="flex justify-between gap-4 mb-5">
          <h2>{archive ? "Archive" : "Your habits"}</h2>
          <button onClick={() => setArchive(!archive)}>
            {archive ? "Active habits" : "Open archive"}
          </button>
        </div>
        {!habits.length ? (
          <p className="muted">
            {archive ? "No archived habits." : "No active habits yet."}
          </p>
        ) : (
          habits.map((h) => (
            <div className="manage-habit" key={h.id}>
              <div>
                <strong>{h.title}</strong>
                <p className="muted">{targetLabel(h)}</p>
                {h.pending_rules && (
                  <p className="muted">
                    New target begins {h.pending_rules.effective_date}.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={blocked || busy} onClick={() => setEdit(h)}>
                  Edit habit
                </button>
                <button
                  disabled={blocked || busy}
                  onClick={() =>
                    void act(
                      () =>
                        api(
                          `/habits/${h.id}/archive`,
                          json("PATCH", {
                            version: h.version,
                            is_archived: !archive,
                          }),
                        ),
                      archive ? "Habit restored." : "Habit archived.",
                    )
                  }
                >
                  {archive ? "Restore" : "Archive"}
                </button>
                {archive && (
                  <button
                    className="text-button"
                    disabled={blocked || busy}
                    onClick={() => setDeleting(h)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
      {blocked && (
        <Notice>
          {readonly
            ? "Verify your email to change settings and habits."
            : "Changes to habits and settings need a connection. Existing habits can still be checked in offline."}
        </Notice>
      )}
      {edit && (
        <Dialog title="Edit habit" close={() => setEdit(undefined)}>
          <HabitForm
            initial={edit}
            cancel={() => setEdit(undefined)}
            submit={async (input) => {
              try {
                await api(`/habits/${edit.id}`, json("PUT", input));
                await reload();
                setEdit(undefined);
              } catch (e) {
                await reload();
                throw e;
              }
            }}
          />
        </Dialog>
      )}
      {deleting && (
        <Dialog title="Delete this habit?" close={() => setDeleting(undefined)}>
          <p className="my-5">
            {deleting.title} and its history will be removed from your account.
            This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api(
                    `/habits/${deleting.id}`,
                    json("DELETE", { version: deleting.version }),
                  );
                  setDeleting(undefined);
                }, "Habit deleted.")
              }
            >
              Delete habit
            </button>
            <button onClick={() => setDeleting(undefined)}>Keep habit</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
export function TimezoneList() {
  const zones = Intl.supportedValuesOf("timeZone");
  return (
    <datalist id="timezones">
      {zones.map((z) => (
        <option value={z} key={z} />
      ))}
    </datalist>
  );
}
