import { describe, expect, test } from "bun:test";
import { DEMO_STATE } from "./demo-data";
import { GroupReadError, LiveGroupCache, type LiveGroupRead } from "./live-group-cache";
import type { AppState } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

function read(groupId: string, label = groupId): LiveGroupRead {
  const state: AppState = {
    ...DEMO_STATE,
    currentUserId: "user",
    group: { ...DEMO_STATE.group, id: groupId, name: label },
  };
  return { state, loadPhotos: async () => state, dispose() {} };
}

describe("gruppcache under aktuell session", () => {
  test("basdata visas före långsamma bilder och en annan grupp har egen snapshot", async () => {
    const photos = deferred<AppState>();
    const a = read("a");
    a.loadPhotos = () => photos.promise;
    const cache = new LiveGroupCache("user", async (id) => (id === "a" ? a : read(id)));
    await cache.load("a");
    expect(cache.getSnapshot("a").state?.group.id).toBe("a");
    expect(cache.getSnapshot("b").state).toBeNull();
    await cache.load("b");
    expect(cache.getSnapshot("a").state?.group.id).toBe("a");
    photos.resolve({ ...a.state, group: { ...a.state.group, name: "med bilder" } });
    await Promise.resolve();
    expect(cache.getSnapshot("b").state?.group.name).toBe("b");
    expect(cache.getSnapshot("a").state?.group.name).toBe("med bilder");
  });

  test("återbesök behåller bekräftad vy medan färsk läsning pågår", async () => {
    const next = deferred<LiveGroupRead>();
    let response = Promise.resolve(read("a"));
    const cache = new LiveGroupCache("user", () => response);
    await cache.load("a");
    response = next.promise;
    const pending = cache.load("a");
    expect(cache.getSnapshot("a").state?.group.name).toBe("a");
    expect(cache.load("a")).toBe(pending);
    next.resolve(read("a", "uppdaterad"));
    await pending;
    expect(cache.getSnapshot("a").state?.group.name).toBe("uppdaterad");
  });

  test("mutation tvingar färsk läsning och sent gammalt svar kasseras", async () => {
    const old = deferred<LiveGroupRead>();
    let response = old.promise;
    const cache = new LiveGroupCache("user", () => response);
    const pending = cache.load("a");
    response = Promise.resolve(read("a", "efter ändring"));
    await cache.load("a", true);
    let disposed = false;
    old.resolve({
      ...read("a", "före ändring"),
      dispose() {
        disposed = true;
      },
    });
    await pending;
    expect(disposed).toBe(true);
    expect(cache.getSnapshot("a").state?.group.name).toBe("efter ändring");
  });

  test("gamla bilder kan inte skriva över en ny basrevision", async () => {
    const photos = deferred<AppState>();
    const old = read("a", "gammal");
    old.loadPhotos = () => photos.promise;
    let response = old;
    const cache = new LiveGroupCache("user", async () => response);
    await cache.load("a");
    response = read("a", "ny");
    await cache.load("a", true);
    photos.resolve(old.state);
    await Promise.resolve();
    expect(cache.getSnapshot("a").state?.group.name).toBe("ny");
  });

  test("nätfel behåller bekräftad data, nekad åtkomst rensar den", async () => {
    let fail: Error | null = null;
    let disposed = 0;
    const cache = new LiveGroupCache("user", async (id) => {
      if (fail) throw fail;
      return {
        ...read(id),
        dispose() {
          disposed += 1;
        },
      };
    });
    await cache.load("a");
    fail = new GroupReadError(false);
    await cache.load("a");
    expect(cache.getSnapshot("a").state?.group.id).toBe("a");
    expect(cache.getSnapshot("a").error).toBeTruthy();
    fail = new GroupReadError(true);
    await cache.load("a");
    expect(cache.getSnapshot("a").state).toBeNull();
    expect(disposed).toBe(1);
  });

  test("utloggning stoppar sena svar och frigör bilder", async () => {
    const photos = deferred<AppState>();
    let signal: AbortSignal | undefined;
    let disposed = 0;
    const a = read("a");
    a.loadPhotos = (nextSignal) => {
      signal = nextSignal;
      return photos.promise;
    };
    a.dispose = () => {
      disposed += 1;
    };
    const cache = new LiveGroupCache("user", async () => a);
    await cache.load("a");
    cache.clear();
    photos.resolve(a.state);
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(disposed).toBe(1);
    expect(cache.getSnapshot("a").state).toBeNull();
  });

  test("serveridentitet måste matcha både konto och grupp", async () => {
    const cache = new LiveGroupCache("annat-konto", async () => read("a"));
    await cache.load("a");
    expect(cache.getSnapshot("a").state).toBeNull();
    expect(cache.getSnapshot("a").error).toBeTruthy();
    const wrongGroup = new LiveGroupCache("user", async () => read("b"));
    await wrongGroup.load("a");
    expect(wrongGroup.getSnapshot("a").state).toBeNull();
  });

  test("medlemskap, cross-group-mutation och LRU rensar berörda poster", async () => {
    let disposed = 0;
    const cache = new LiveGroupCache("user", async (id) => ({
      ...read(id),
      dispose() {
        disposed += 1;
      },
    }));
    for (const id of ["a", "b", "c", "d", "e", "f"]) await cache.load(id);
    expect(cache.getSnapshot("a").state).toBeNull();
    expect(disposed).toBe(1);
    cache.retain(["e", "f"]);
    expect(cache.getSnapshot("b").state).toBeNull();
    cache.invalidateOthers("f");
    expect(cache.getSnapshot("e").state).toBeNull();
    expect(cache.getSnapshot("f").state?.group.id).toBe("f");
  });

  test("aktiv vy försvinner inte på grund av cacheålder under ett pågående flöde", async () => {
    let now = 1;
    const cache = new LiveGroupCache(
      "user",
      async (id) => read(id),
      () => now,
    );
    await cache.activate("a");
    now += 6 * 60 * 1000;
    expect(cache.getSnapshot("a").state?.group.id).toBe("a");
    await cache.activate("b");
    expect(cache.getSnapshot("a").state).toBeNull();
  });

  test("utgången cache kan inte låsa retry bakom laddningsvy", async () => {
    let now = 1;
    let fail = false;
    const cache = new LiveGroupCache(
      "user",
      async (id) => {
        if (fail) throw new GroupReadError(false);
        return read(id);
      },
      () => now,
    );
    await cache.load("a");
    now += 6 * 60 * 1000;
    expect(cache.getSnapshot("a").state).toBeNull();
    fail = true;
    await cache.load("a");
    expect(cache.getSnapshot("a").error).toBeTruthy();
  });
});
