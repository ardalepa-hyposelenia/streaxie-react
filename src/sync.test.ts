import "fake-indexeddb/auto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./api", () => ({
  api: vi.fn(),
  assertAccount: vi.fn(),
  json: (method: string, body: unknown) => ({
    method,
    body: JSON.stringify(body),
  }),
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
import { api } from "./api";
import { enqueue, putCache, snapshot } from "./storage";
import { flush, pull } from "./sync";
import type { Cache, Pending, SyncPage } from "./types";
const cache: Cache = {
  habits: [],
  logs: [],
  revision: 1,
  settings: {
    current: { timezone: "UTC", day_rollover_minutes: 0, effective_from: 0 },
  },
};
const page: SyncPage = {
  sync_revision: 2,
  settings: cache.settings,
  changes: { habits: [], habit_logs: [] },
  sync_report: { rejected_logs: [] },
};
const pending: Pending = {
  id: "log",
  local_id: "local",
  habit_id: "habit",
  logical_date: "2000-01-01",
  actual_value: 1,
  is_unchecked: false,
  client_recorded_at: 946684800000,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("navigator", {
    onLine: true,
    locks: { request: (_name: string, fn: () => unknown) => fn() },
  });
});
it("sends a check-in from a past logical day through sync with its original timestamp", async () => {
  await putCache("rollover", cache);
  await enqueue("rollover", pending);
  vi.mocked(api).mockResolvedValue(page);
  await flush(
    "rollover",
    () => true,
    async () => {},
  );
  const [path, options] = vi.mocked(api).mock.calls[0];
  expect(path).toBe("/sync");
  expect(JSON.parse(options!.body as string).mutations.habit_logs[0]).toEqual({
    id: "log",
    habit_id: "habit",
    logical_date: "2000-01-01",
    actual_value: 1,
    is_unchecked: false,
    client_recorded_at: 946684800000,
  });
  expect((await snapshot("rollover"))!.pending).toHaveLength(0);
});
it("retains a rejected item even when the sync HTTP response was successful", async () => {
  await putCache("rejected", cache);
  await enqueue("rejected", pending);
  vi.mocked(api).mockResolvedValue({
    ...page,
    sync_report: {
      rejected_logs: [
        {
          log_id: "log",
          reason_code: "OFFLINE_TTL_EXPIRED",
          message: "Expired",
        },
      ],
    },
  });
  await flush(
    "rejected",
    () => true,
    async () => {},
  );
  expect((await snapshot("rejected"))!.pending[0].error).toContain(
    "OFFLINE_TTL_EXPIRED",
  );
});
it("keeps transient failures pending for automatic retry", async () => {
  await putCache("network", cache);
  await enqueue("network", pending);
  vi.mocked(api).mockRejectedValue(new TypeError("offline"));
  await expect(
    flush(
      "network",
      () => true,
      async () => {},
    ),
  ).rejects.toThrow("offline");
  expect((await snapshot("network"))!.pending[0].error).toBeUndefined();
});
it("does not advance the durable revision when a later pull page fails", async () => {
  await putCache("pages", cache);
  vi.mocked(api)
    .mockResolvedValueOnce({
      ...page,
      sync_revision: 42,
      next_pull_cursor: { after_id: "cursor" },
    })
    .mockRejectedValueOnce(new TypeError("offline"));
  await expect(pull("pages")).rejects.toThrow("offline");
  expect((await snapshot("pages"))!.revision).toBe(1);
  vi.mocked(api).mockResolvedValueOnce({ ...page, sync_revision: 43 });
  await pull("pages");
  expect((await snapshot("pages"))!.revision).toBe(43);
  expect(
    JSON.parse(vi.mocked(api).mock.calls[2][1]!.body as string)
      .last_synced_revision,
  ).toBe(1);
});
it("pauses the queue when its account is no longer active", async () => {
  await putCache("paused", cache);
  await enqueue("paused", pending);
  await flush(
    "paused",
    () => false,
    async () => {},
  );
  expect(api).not.toHaveBeenCalled();
  expect((await snapshot("paused"))!.pending).toHaveLength(1);
});
