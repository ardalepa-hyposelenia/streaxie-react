import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  LightningBoltIcon,
  PlusIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import {
  addDays,
  clock,
  currentRules,
  displayLog,
  minutes,
  passed,
  statusLabel,
  streak,
  targetLabel,
} from "./domain";
import type { Habit, Mutation, Snapshot } from "./types";

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={"notice " + (error ? "error" : "")}
    >
      {children}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(
        children as ReactElement<{ id: string; "aria-describedby"?: string }>,
        { id, "aria-describedby": hint ? id + "-hint" : undefined },
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="dialog-title"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Close" onClick={close}>
          <Cross2Icon />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function HabitCard({
  habit: h,
  state,
  date,
  readonly,
  onSave,
}: {
  habit: Habit;
  state: Snapshot;
  date: string;
  readonly: boolean;
  onSave: (m: Omit<Mutation, "id" | "client_recorded_at">) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const activation = useRef<HTMLButtonElement>(null);
  function closeEditor() {
    setOpen(false);
    requestAnimationFrame(() => activation.current?.focus());
  }
  const log = displayLog(h, state.logs, state.pending, date),
    r = currentRules(h, date),
    done = passed(log?.eval_status);
  const value =
    log && log.eval_status !== "UNCHECKED"
      ? r.habit_type === "TIME_LIMIT"
        ? clock(log.actual_value)
        : String(log.actual_value)
      : "";
  const [draft, setDraft] = useState(value),
    [occurred, setOccurred] = useState(
      log?.occurred_date || addDays(date, r.target_day_offset),
    );
  const count = streak(h, state.logs, state.pending, date),
    hasPending = state.pending.some((p) => p.habit_id === h.id);
  async function save(actual: number, unchecked = false) {
    setSaving(true);
    setError("");
    try {
      await onSave({
        habit_id: h.id,
        logical_date: date,
        actual_value: actual,
        is_unchecked: unchecked,
        ...(r.habit_type === "TIME_LIMIT" ? { occurred_date: occurred } : {}),
      });
      closeEditor();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function activate() {
    if (readonly) {
      setOpen(!open);
      return;
    }
    if (r.habit_type === "BINARY") {
      void save(done ? 0 : 1, done);
    } else {
      if (!open) {
        setDraft(value);
        setOccurred(log?.occurred_date || addDays(date, r.target_day_offset));
      }
      setOpen(!open);
    }
  }
  return (
    <article
      className={
        "habit-card " + (done ? "complete " : "") + (open ? "expanded" : "")
      }
    >
      <button
        ref={activation}
        className="card-activation"
        onClick={activate}
        disabled={saving}
        aria-label={`${h.title}, ${count} day streak. ${readonly ? "View details" : r.habit_type === "BINARY" ? (done ? "Undo check-in" : "Check in") : "Enter check-in"}`}
        aria-expanded={r.habit_type === "BINARY" ? undefined : open}
      />
      <div className="habit-grid">
        <span className={"habit-icon " + (done ? "done" : "")}>
          {done ? (
            <CheckIcon />
          ) : r.habit_type === "BINARY" ? (
            <CheckIcon />
          ) : r.habit_type === "TIME_LIMIT" ? (
            <span aria-hidden="true">◷</span>
          ) : (
            <span aria-hidden="true">≋</span>
          )}
        </span>
        <h3>{h.title}</h3>
        <span
          className={"streak " + (hasPending ? "pending" : "")}
          aria-label={`${count} day streak${hasPending ? ", pending" : ""}`}
        >
          <LightningBoltIcon />
          {count}
          <small>{count === 1 ? "day" : "days"}</small>
        </span>
        <p className="habit-meta">{targetLabel(r)}</p>
        <span className="card-chevron">
          <ChevronDownIcon />
        </span>
        <p className="habit-value">
          {log && log.eval_status !== "UNCHECKED"
            ? r.habit_type === "TIME_LIMIT"
              ? `${clock(log.actual_value)} · ${log.occurred_date}`
              : `${log.actual_value}${r.unit_label ? " " + r.unit_label : ""}`
            : "Ready when you are"}{" "}
          <span className="status-label">{statusLabel(log?.eval_status)}</span>
        </p>
        <div className="habit-footer">
          {hasPending ? (
            <span className="pending-text">
              {state.pending.some((p) => p.habit_id === h.id && p.error)
                ? "Needs attention"
                : "Pending sync"}
            </span>
          ) : (
            <span>{log ? "Saved" : "Not recorded yet"}</span>
          )}
          <span>Evaluate {clock(r.evaluation_time_minutes)}</span>
        </div>
      </div>
      {open && (
        <div className="editor-region">
          {readonly ? (
            <p>
              {targetLabel(r)}
              {r.tolerance_value > 0
                ? ` · Flexibility: ${r.tolerance_value}${r.habit_type === "TIME_LIMIT" ? " minutes" : ""}`
                : ""}
              . Longest streak: {h.longest_streak} days.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(
                  r.habit_type === "TIME_LIMIT"
                    ? minutes(draft)
                    : Number(draft),
                );
              }}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={
                    r.habit_type === "TIME_LIMIT"
                      ? "Actual time"
                      : `Amount${r.unit_label ? " (" + r.unit_label + ")" : ""}`
                  }
                >
                  <input
                    autoFocus
                    type={r.habit_type === "TIME_LIMIT" ? "time" : "number"}
                    min="0"
                    max="2147483647"
                    step="1"
                    required
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </Field>
                {r.habit_type === "TIME_LIMIT" && (
                  <Field label="Date it happened">
                    <input
                      required
                      type="date"
                      value={occurred}
                      onChange={(e) => setOccurred(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="primary" disabled={saving}>
                  Save
                </button>
                <button type="button" onClick={closeEditor}>
                  Cancel
                </button>
                {log && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={saving}
                    onClick={() => void save(0, true)}
                  >
                    Clear check-in
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      {error && (
        <div className="editor-region">
          <Notice error>{error}</Notice>
        </div>
      )}
    </article>
  );
}

export type HabitInput = {
  title: string;
  habit_type: Habit["habit_type"];
  target_operator: Habit["target_operator"];
  target_value: number;
  tolerance_value: number;
  unit_label?: string;
  evaluation_time_minutes: number;
  target_day_offset: number;
  version?: number;
  is_archived?: boolean;
};
export function HabitForm({
  initial,
  submit,
  cancel,
}: {
  initial?: Habit;
  submit: (input: HabitInput) => Promise<void>;
  cancel: () => void;
}) {
  const [step, setStep] = useState(initial ? 2 : 0),
    [type, setType] = useState<Habit["habit_type"]>(
      initial?.pending_rules?.habit_type || initial?.habit_type || "BINARY",
    ),
    [title, setTitle] = useState(initial?.title || ""),
    [flex, setFlex] = useState(
      !!(initial?.pending_rules || initial)?.tolerance_value,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const defaults = initial?.pending_rules || initial;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await submit({
        title: title.trim(),
        habit_type: type,
        target_operator:
          type === "BINARY"
            ? "EQ"
            : (f.get("operator") as Habit["target_operator"]),
        target_value:
          type === "BINARY"
            ? 1
            : type === "TIME_LIMIT"
              ? minutes(String(f.get("time")))
              : Number(f.get("quantity")),
        tolerance_value:
          flex && type !== "BINARY" ? Number(f.get("tolerance")) : 0,
        unit_label:
          type === "QUANTITY" ? String(f.get("unit") || "") : undefined,
        evaluation_time_minutes: minutes(String(f.get("evaluation"))),
        target_day_offset: type === "TIME_LIMIT" ? Number(f.get("offset")) : 0,
        ...(initial
          ? { version: initial.version, is_archived: initial.is_archived }
          : {}),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="eyebrow">
        {initial ? "Adjust your habit" : `Step ${step + 1} of 3`}
      </p>
      {step === 0 ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(1);
          }}
        >
          <Field
            label="What would you like to make a habit?"
            hint="A short name that feels like you."
          >
            <input
              autoFocus
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Read a few pages"
            />
          </Field>
          <button className="primary">Continue</button>
        </form>
      ) : step === 1 ? (
        <div className="space-y-4">
          <h3>How will you track it?</h3>
          {(
            [
              ["BINARY", "A simple check", "Done or not done."],
              [
                "QUANTITY",
                "An amount",
                "Water, pages, minutes, or another unit.",
              ],
              [
                "TIME_LIMIT",
                "A time of day",
                "A deadline or the earliest time.",
              ],
            ] as const
          ).map(([v, label, hint]) => (
            <button
              key={v}
              className={"type-option " + (type === v ? "selected" : "")}
              onClick={() => setType(v)}
            >
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
          <div className="flex gap-2">
            <button onClick={() => setStep(0)}>Back</button>
            <button className="primary" onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label="Habit name">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {type !== "BINARY" && (
            <>
              <Field label="Target">
                <select
                  name="operator"
                  defaultValue={
                    defaults?.target_operator ||
                    (type === "TIME_LIMIT" ? "LTE" : "GTE")
                  }
                >
                  <option value="GTE">
                    {type === "TIME_LIMIT" ? "At or after" : "At least"}
                  </option>
                  <option value="LTE">
                    {type === "TIME_LIMIT" ? "At or before" : "At most"}
                  </option>
                </select>
              </Field>
              {type === "TIME_LIMIT" ? (
                <>
                  <Field label="Target time">
                    <input
                      type="time"
                      name="time"
                      required
                      defaultValue={clock(defaults?.target_value ?? 1260)}
                    />
                  </Field>
                  <Field
                    label="Which day is the target on?"
                    hint="For sleep evaluated the next morning, choose the previous day."
                  >
                    <select
                      name="offset"
                      defaultValue={defaults?.target_day_offset || 0}
                    >
                      <option value="0">The evaluation day</option>
                      <option value="-1">The previous day</option>
                    </select>
                  </Field>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Target amount">
                    <input
                      name="quantity"
                      type="number"
                      min="0"
                      max="2147483647"
                      required
                      defaultValue={defaults?.target_value ?? 1}
                    />
                  </Field>
                  <Field label="Unit">
                    <input
                      name="unit"
                      maxLength={20}
                      defaultValue={defaults?.unit_label || ""}
                      placeholder="pages"
                    />
                  </Field>
                </div>
              )}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={flex}
                  onChange={(e) => setFlex(e.target.checked)}
                />
                Allow some flexibility
              </label>
              {flex && (
                <Field
                  label={
                    type === "TIME_LIMIT"
                      ? "Flexibility (minutes)"
                      : "Flexibility (same unit)"
                  }
                >
                  <input
                    name="tolerance"
                    required
                    type="number"
                    min="0"
                    max={type === "TIME_LIMIT" ? 1439 : 2147483647}
                    defaultValue={defaults?.tolerance_value || 0}
                  />
                </Field>
              )}
            </>
          )}
          <Field
            label="Daily evaluation time"
            hint="Used to arrange your habits through the day."
          >
            <input
              name="evaluation"
              type="time"
              required
              defaultValue={clock(defaults?.evaluation_time_minutes ?? 480)}
            />
          </Field>
          {initial && (
            <p className="muted">
              Target changes begin next logical day. Past records keep their
              original rules.
            </p>
          )}
          {error && <Notice error>{error}</Notice>}
          <div className="flex gap-2">
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : initial ? "Save habit" : "Create habit"}
            </button>
            <button type="button" onClick={initial ? cancel : () => setStep(1)}>
              {initial ? "Cancel" : "Back"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">
        <PlusIcon />
      </span>
      <h2>A little space for a new habit.</h2>
      <p>{children}</p>
      {action && (
        <button className="primary" onClick={action}>
          Create your first habit
        </button>
      )}
    </div>
  );
}
