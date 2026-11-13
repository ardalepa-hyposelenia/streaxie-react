import type {
  Habit,
  Log,
  Pending,
  Profile,
  Rules,
  Settings,
  Status,
} from "./types";

export const passed = (status?: Status) =>
  status === "PERFECT" || status === "PASSED_TOLERATED";
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function logicalDate(settings: Settings, now = Date.now()) {
  const s =
    settings.pending && settings.pending.effective_from <= now
      ? settings.pending
      : settings.current;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: s.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return Number(parts.hour) * 60 + Number(parts.minute) < s.day_rollover_minutes
    ? addDays(date, -1)
    : date;
}
export function evaluate(
  r: Rules,
  value: number,
  unchecked: boolean,
  date: string,
  occurred?: string,
): Status {
  if (unchecked) return "UNCHECKED";
  let actual = value;
  if (r.habit_type === "TIME_LIMIT")
    actual +=
      ((Date.parse((occurred || date) + "T00:00Z") -
        Date.parse(addDays(date, r.target_day_offset) + "T00:00Z")) /
        86400000) *
      1440;
  const delta = actual - r.target_value;
  const distance =
    r.target_operator === "LTE"
      ? delta
      : r.target_operator === "GTE"
        ? -delta
        : Math.abs(delta);
  return distance <= 0
    ? "PERFECT"
    : distance <= r.tolerance_value
      ? "PASSED_TOLERATED"
      : "FAILED";
}
export function currentRules(h: Habit, date: string): Rules {
  return h.pending_rules?.effective_date &&
    h.pending_rules.effective_date <= date
    ? h.pending_rules
    : h;
}
export function displayLog(
  h: Habit,
  logs: Log[],
  pending: Pending[],
  date: string,
): (Log & { pending?: boolean; error?: string }) | undefined {
  const p = pending
    .filter((p) => p.habit_id === h.id && p.logical_date === date)
    .sort((a, b) => b.client_recorded_at - a.client_recorded_at)[0];
  if (p) {
    const rules = p.rules || currentRules(h, date);
    return {
      ...p,
      rules,
      eval_status: evaluate(
        rules,
        p.actual_value,
        p.is_unchecked,
        date,
        p.occurred_date,
      ),
      pending: true,
    };
  }
  return logs.find((l) => l.habit_id === h.id && l.logical_date === date);
}
// Rebuild from the history downloaded by paginated sync; this also handles
// queued check-ins on yesterday when the page is opened after rollover.
export function streak(
  h: Habit,
  logs: Log[],
  pending: Pending[],
  today: string,
) {
  if (!pending.some((p) => p.habit_id === h.id)) {
    return h.last_completed_date && h.last_completed_date >= addDays(today, -1)
      ? h.current_streak
      : 0;
  }
  let cursor = passed(displayLog(h, logs, pending, today)?.eval_status)
      ? today
      : addDays(today, -1),
    n = 0;
  const oldest = [...logs, ...pending]
    .filter((l) => l.habit_id === h.id)
    .map((l) => l.logical_date)
    .sort()[0];
  while (cursor >= (oldest || today)) {
    if (!passed(displayLog(h, logs, pending, cursor)?.eval_status)) break;
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}
export const readOnly = (p: Profile) =>
  p.read_only ||
  (!p.email_verified_at && Date.now() >= p.verification_deadline);
export const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
export const minutes = (s: string) =>
  Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
export function targetLabel(r: Rules) {
  return r.habit_type === "BINARY"
    ? "One check-in a day"
    : `${r.target_operator === "LTE" ? "At most" : "At least"} ${r.habit_type === "TIME_LIMIT" ? clock(r.target_value) : r.target_value}${r.unit_label ? " " + r.unit_label : ""}${r.target_day_offset === -1 ? " · previous day" : ""}`;
}
export const statusLabel = (s?: Status) =>
  ({
    PERFECT: "On target",
    PASSED_TOLERATED: "Within flexibility",
    FAILED: "Outside target",
    UNCHECKED: "Not checked in",
  })[s || "UNCHECKED"];
