import type { Cache, Pending, Profile, Snapshot } from "./types";
const db = new Promise<IDBDatabase>((resolve, reject) => {
  const r = indexedDB.open("streaxie", 1);
  r.onupgradeneeded = () => {
    r.result.createObjectStore("cache");
    r.result.createObjectStore("pending", { keyPath: "local_id" });
    r.result.createObjectStore("profiles");
  };
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  action: (tx: IDBTransaction) => IDBRequest<T>,
): Promise<T> {
  const d = await db;
  return new Promise((resolve, reject) => {
    const tx = d.transaction(stores, mode);
    const request = action(tx);
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = tx.onerror = () => reject(tx.error || request.error);
  });
}
export const saveProfile = (p: Profile) =>
  transaction(["profiles"], "readwrite", (t) =>
    t.objectStore("profiles").put(p, p.id),
  );
export const getProfile = (id: string) =>
  transaction<Profile | undefined>(["profiles"], "readonly", (t) =>
    t.objectStore("profiles").get(id),
  );
export const putCache = (id: string, c: Cache) =>
  transaction(["cache"], "readwrite", (t) => t.objectStore("cache").put(c, id));
export async function snapshot(id: string): Promise<Snapshot | undefined> {
  const [cache, all] = await Promise.all([
    transaction<Cache | undefined>(["cache"], "readonly", (t) =>
      t.objectStore("cache").get(id),
    ),
    transaction<(Pending & { owner: string })[]>(["pending"], "readonly", (t) =>
      t.objectStore("pending").getAll(),
    ),
  ]);
  return cache
    ? { ...cache, pending: all.filter((p) => p.owner === id) }
    : undefined;
}
export async function enqueue(owner: string, p: Pending) {
  const d = await db;
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("pending", "readwrite"),
      s = tx.objectStore("pending"),
      r = s.getAll();
    r.onsuccess = () => {
      if (
        r.result.some(
          (old: Pending & { owner: string }) =>
            old.owner === owner &&
            old.habit_id === p.habit_id &&
            old.logical_date === p.logical_date &&
            old.client_recorded_at > p.client_recorded_at,
        )
      )
        return;
      for (const old of r.result)
        if (
          old.owner === owner &&
          old.habit_id === p.habit_id &&
          old.logical_date === p.logical_date
        )
          s.delete(old.local_id);
      s.put({ ...p, owner });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function acknowledge(owner: string, p: Pending, error?: string) {
  const d = await db;
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction("pending", "readwrite"),
      s = tx.objectStore("pending"),
      r = s.get(p.local_id);
    r.onsuccess = () => {
      if (r.result?.owner === owner) {
        if (error) s.put({ ...r.result, error });
        else s.delete(p.local_id);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
