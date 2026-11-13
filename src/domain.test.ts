import { describe, expect, it } from "vitest";
import { displayLog, evaluate, logicalDate, streak } from "./domain";
import type { Habit, Log, Pending, Settings } from "./types";
const habit: Habit = {
  id: "habit",
  title: "Read",
  habit_type: "BINARY",
  target_operator: "EQ",
  target_value: 1,
  tolerance_value: 0,
  evaluation_time_minutes: 480,
  target_day_offset: 0,
  version: 1,
  current_streak: 3,
  last_completed_date: "2026-11-13",
  longest_streak: 2,
  created_at: 0,
  is_archived: false,
};
const log = (date: string): Log => ({
  id: date,
  habit_id: "habit",
  logical_date: date,
  actual_value: 1,
  eval_status: "PERFECT",
  rules: habit,
  client_recorded_at: 0,
});
describe("habit rules", () => {
  it("evaluates sleep after midnight against the previous day", () => {
    const rules = {
      ...habit,
      habit_type: "TIME_LIMIT" as const,
      target_operator: "LTE" as const,
      target_value: 1260,
      tolerance_value: 30,
      target_day_offset: -1,
    };
    expect(evaluate(rules, 30, false, "2026-11-13", "2026-11-13")).toBe(
      "FAILED",
    );
    expect(evaluate(rules, 1270, false, "2026-11-13", "2026-11-12")).toBe(
      "PASSED_TOLERATED",
    );
  });
  it("uses wall clock boundaries across daylight saving", () => {
    const s: Settings = {
      current: {
        timezone: "America/New_York",
        day_rollover_minutes: 180,
        effective_from: 0,
      },
    };
    expect(logicalDate(s, Date.parse("2026-11-01T07:30Z"))).toBe("2026-10-31");
    expect(logicalDate(s, Date.parse("2026-11-01T08:00Z"))).toBe("2026-11-01");
  });
  it("activates pending settings only at their boundary", () => {
    const s: Settings = {
      current: { timezone: "UTC", day_rollover_minutes: 0, effective_from: 0 },
      pending: {
        timezone: "Asia/Tokyo",
        day_rollover_minutes: 0,
        effective_from: Date.parse("2026-11-13T20:00Z"),
      },
    };
    expect(logicalDate(s, Date.parse("2026-11-13T19:59Z"))).toBe("2026-11-13");
    expect(logicalDate(s, Date.parse("2026-11-13T20:00Z"))).toBe("2026-11-14");
  });
  it("adds today once, and restores yesterday when unchecked", () => {
    const logs = [log("2026-11-11"), log("2026-11-12"), log("2026-11-13")];
    expect(streak(habit, logs, [], "2026-11-13")).toBe(3);
    const p: Pending = {
      id: "p",
      local_id: "p",
      habit_id: "habit",
      logical_date: "2026-11-13",
      actual_value: 0,
      is_unchecked: true,
      client_recorded_at: 1,
    };
    expect(streak(habit, logs, [p], "2026-11-13")).toBe(2);
    expect(streak(habit, logs, [p], "2026-11-14")).toBe(0);
  });
  it("counts pending yesterday after rollover without a confirmed log", () => {
    const p: Pending = {
      id: "p",
      local_id: "p",
      habit_id: "habit",
      logical_date: "2026-11-13",
      actual_value: 1,
      is_unchecked: false,
      client_recorded_at: 1,
      rules: habit,
    };
    expect(streak(habit, [], [p], "2026-11-14")).toBe(1);
    expect(displayLog(habit, [], [p], "2026-11-13")?.pending).toBe(true);
  });
});
