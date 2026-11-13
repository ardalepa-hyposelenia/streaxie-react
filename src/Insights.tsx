import { useMemo, useState } from "react";
import { addDays, clock, passed, statusLabel, streak } from "./domain";
import { Field } from "./components";
import type { Snapshot } from "./types";
export default function Insights({
  state,
  date,
}: {
  state: Snapshot;
  date: string;
}) {
  const habits = state.habits.filter((h) => !h.deleted_at),
    [id, setId] = useState(habits[0]?.id || ""),
    [end, setEnd] = useState(date),
    [start, setStart] = useState(addDays(date, -29));
  const h = habits.find((h) => h.id === id) || habits[0];
  const logs = useMemo(
    () =>
      state.logs
        .filter(
          (l) =>
            l.habit_id === h?.id &&
            l.logical_date >= start &&
            l.logical_date <= end,
        )
        .sort((a, b) => b.logical_date.localeCompare(a.logical_date)),
    [state.logs, h?.id, start, end],
  );
  if (!h)
    return (
      <section className="empty">
        <h2>Your story starts with a check-in.</h2>
        <p>Create a habit in Today, then come back to see your progress.</p>
      </section>
    );
  const days: string[] = [];
  for (let d = start; d <= end && days.length < 366; d = addDays(d, 1))
    days.push(d);
  return (
    <div className="space-y-7">
      <div className="page-heading">
        <p className="eyebrow">YOUR PROGRESS</p>
        <h1>Insights</h1>
        <p className="muted">
          A wider view of the small things you keep doing.
        </p>
      </div>
      <section className="panel">
        <Field label="Habit">
          <select value={h.id} onChange={(e) => setId(e.target.value)}>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
                {h.is_archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="stats-row">
          <div>
            <strong>{streak(h, state.logs, state.pending, date)}</strong>
            <span>
              Current streak
              {state.pending.some((p) => p.habit_id === h.id)
                ? " · pending"
                : ""}
            </span>
          </div>
          <div>
            <strong>{h.longest_streak}</strong>
            <span>Longest confirmed streak</span>
          </div>
          <div>
            <strong>{logs.filter((l) => passed(l.eval_status)).length}</strong>
            <span>Days on target in range</span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="From">
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={end}
              min={start}
              max={date}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <div className="calendar" aria-label="Daily check-in calendar">
          {days.map((d) => {
            const l = logs.find((l) => l.logical_date === d);
            return (
              <span
                key={d}
                className={
                  "calendar-day " +
                  (passed(l?.eval_status)
                    ? "pass"
                    : l?.eval_status === "FAILED"
                      ? "fail"
                      : "")
                }
                title={`${d}: ${statusLabel(l?.eval_status)}`}
              >
                <small>{Number(d.slice(8))}</small>
                <span className="sr-only">
                  {d}: {statusLabel(l?.eval_status)}
                </span>
              </span>
            );
          })}
        </div>
        {days.length === 366 && (
          <p className="muted">
            Calendar displays the first 366 days of the selected range.
          </p>
        )}
        <p className="muted">
          Filled: on target · outlined: outside target · light: no check-in.
          Pending edits appear in Today until confirmed.
        </p>
      </section>
      <section className="panel">
        <h2>Check-in history</h2>
        <p className="muted mb-5">
          Historical results use the rules in effect when they were recorded.
        </p>
        {logs.length === 0 ? (
          <p>No check-ins in this date range.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Recorded</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.logical_date}</td>
                    <td>
                      {l.eval_status === "UNCHECKED"
                        ? "—"
                        : l.rules.habit_type === "TIME_LIMIT"
                          ? `${clock(l.actual_value)} · ${l.occurred_date}`
                          : l.rules.habit_type === "BINARY"
                            ? "Checked"
                            : `${l.actual_value} ${l.rules.unit_label || ""}`}
                    </td>
                    <td>{statusLabel(l.eval_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>At a glance</h2>
        {habits.map((h) => (
          <button className="comparison" key={h.id} onClick={() => setId(h.id)}>
            <span>{h.title}</span>
            <strong>{streak(h, state.logs, state.pending, date)} days</strong>
          </button>
        ))}
      </section>
    </div>
  );
}
