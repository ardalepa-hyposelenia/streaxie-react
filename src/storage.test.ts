import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { acknowledge, enqueue, putCache, snapshot } from "./storage";
import type { Pending } from "./types";
const p: Pending = {
  id: "log",
  local_id: "old",
  habit_id: "habit",
  logical_date: "2026-11-13",
  actual_value: 1,
  is_unchecked: false,
  client_recorded_at: 1,
};
it("isolates accounts and never clears a replacement edit when an older request is acknowledged", async () => {
  const cache = {
    habits: [],
    logs: [],
    revision: 0,
    settings: {
      current: { timezone: "UTC", day_rollover_minutes: 0, effective_from: 0 },
    },
  };
  await putCache("a", cache);
  await putCache("b", cache);
  await enqueue("a", p);
  await enqueue("b", { ...p, local_id: "other" });
  await enqueue("a", {
    ...p,
    local_id: "new",
    actual_value: 0,
    client_recorded_at: 2,
  });
  await acknowledge("a", p);
  expect((await snapshot("a"))!.pending.map((x) => x.local_id)).toEqual([
    "new",
  ]);
  expect((await snapshot("b"))!.pending.map((x) => x.local_id)).toEqual([
    "other",
  ]);
  await acknowledge("a", { ...p, local_id: "other" });
  expect((await snapshot("b"))!.pending).toHaveLength(1);
  await enqueue("a", { ...p, local_id: "late-old", client_recorded_at: 1 });
  expect((await snapshot("a"))!.pending.map((x) => x.local_id)).toEqual([
    "new",
  ]);
});
