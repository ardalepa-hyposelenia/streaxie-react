import { api, ApiError, assertAccount, json } from "./api";
import { acknowledge, putCache, snapshot } from "./storage";
import { logicalDate } from "./domain";
import type {
  Cache,
  Habit,
  Log,
  Mutation,
  Pending,
  Snapshot,
  SyncPage,
} from "./types";
const merge = <T extends { id: string }>(a: T[], b: T[]) => [
  ...new Map([...a, ...b].map((x) => [x.id, x])).values(),
];
export async function pull(owner: string): Promise<Snapshot> {
  return navigator.locks.request("streaxie-pull-" + owner, () =>
    pullPages(owner),
  );
}
async function pullPages(owner: string): Promise<Snapshot> {
  let cache = await snapshot(owner),
    cursor: unknown,
    revision = cache?.revision || 0;
  let next: Cache = cache || {
    habits: [],
    logs: [],
    revision: 0,
    settings: {
      current: { timezone: "UTC", day_rollover_minutes: 0, effective_from: 0 },
    },
  };
  do {
    assertAccount(owner);
    const p = await api<SyncPage>(
      "/sync",
      json(
        "POST",
        cursor
          ? { pull_cursor: cursor, mutations: { habits: [], habit_logs: [] } }
          : {
              last_synced_revision: revision,
              mutations: { habits: [], habit_logs: [] },
            },
      ),
    );
    assertAccount(owner);
    const logs = [...next.logs];
    for (const l of p.changes.habit_logs || []) {
      const i = logs.findIndex(
        (x) => x.habit_id === l.habit_id && x.logical_date === l.logical_date,
      );
      if (i >= 0) logs.splice(i, 1);
      logs.push(l);
    }
    next = {
      ...next,
      habits: merge(next.habits, p.changes.habits || []),
      logs,
      settings: p.settings,
    };
    cursor = p.next_pull_cursor;
    // Persist each page, but only advance the durable watermark on completion.
    if (!cursor) next.revision = p.sync_revision;
    await putCache(owner, next);
  } while (cursor);
  return (await snapshot(owner))!;
}
export const wire = (p: Pending): Mutation => ({
  id: p.id,
  habit_id: p.habit_id,
  logical_date: p.logical_date,
  actual_value: p.actual_value,
  is_unchecked: p.is_unchecked,
  client_recorded_at: p.client_recorded_at,
  ...(p.occurred_date ? { occurred_date: p.occurred_date } : {}),
});
export async function flush(
  owner: string,
  isCurrent: () => boolean,
  updated: () => Promise<void>,
) {
  // Cross-tab serialization prevents refresh-token rotation and queue races.
  await navigator.locks.request("streaxie-sync", async () => {
    let state = await snapshot(owner);
    if (!state || !isCurrent()) return;
    for (const pending of state.pending
      .filter((p) => !p.error)
      .sort((a, b) => a.client_recorded_at - b.client_recorded_at)) {
      if (!isCurrent() || !navigator.onLine) return;
      const p = wire(pending);
      try {
        assertAccount(owner);
        if (p.logical_date === logicalDate(state.settings)) {
          const { habit_id, logical_date, ...body } = p;
          try {
            await api(
              `/habits/${habit_id}/logs/${logical_date}`,
              json("PUT", body),
            );
          } catch (e) {
            if (!(e instanceof ApiError) || e.code !== "DAY_LOCKED") throw e;
            await push(p);
          }
        } else await push(p);
        // Pull acknowledged server state BEFORE removing the local draft.
        if (!isCurrent()) return;
        await pull(owner);
        await acknowledge(owner, pending);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status >= 500 || e.status === 429)
          throw e;
        if (e.status === 401) throw e;
        await acknowledge(owner, pending, e.message + " (" + e.code + ")");
      }
      await updated();
      state = (await snapshot(owner))!;
    }
  });
}
async function push(p: Mutation) {
  const result = await api<SyncPage>(
    "/sync",
    json("POST", { mutations: { habits: [], habit_logs: [p] } }),
  );
  const rejected = result.sync_report.rejected_logs?.find(
    (r) => r.log_id === p.id,
  );
  if (rejected) throw new ApiError(422, rejected.reason_code, rejected.message);
}
export function active(habits: Habit[]) {
  return habits
    .filter((h) => !h.deleted_at && !h.is_archived)
    .sort(
      (a, b) =>
        a.evaluation_time_minutes - b.evaluation_time_minutes ||
        a.created_at - b.created_at,
    );
}
