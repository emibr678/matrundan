import { describe, expect, test } from "bun:test";
import { AccountGroups } from "./account-groups";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("sessionens grupphämtning", () => {
  test("bootstrap och upprepade auth-händelser delar ett anrop", async () => {
    const response = deferred<string[]>();
    let calls = 0;
    const groups = new AccountGroups(() => { calls += 1; return response.promise; });
    groups.setAccount("a");
    const first = groups.load();
    const second = groups.load();
    expect(first).toBe(second);
    expect(groups.getSnapshot().status).toBe("loading");
    response.resolve(["grupp-a"]);
    await first;
    await groups.load();
    expect(calls).toBe(1);
    expect(groups.getSnapshot().groups).toEqual(["grupp-a"]);
  });

  test("tomt lyckat svar skiljs från väntan och läsfel", async () => {
    const response = deferred<string[]>();
    const groups = new AccountGroups(() => response.promise);
    groups.setAccount("a");
    expect(groups.getSnapshot().status).toBe("idle");
    const pending = groups.load();
    expect(groups.getSnapshot().status).toBe("loading");
    response.resolve([]);
    await pending;
    expect(groups.getSnapshot()).toMatchObject({ status: "ready", groups: [] });
    const failed = new AccountGroups<string[]>(() => Promise.reject(new Error("offline")));
    failed.setAccount("a");
    await failed.load();
    expect(failed.getSnapshot().status).toBe("error");
  });

  test("sena medlemskap får inte återkomma efter kontobyte eller utloggning", async () => {
    const old = deferred<string[]>();
    let response = old.promise;
    const groups = new AccountGroups(() => response);
    groups.setAccount("a");
    const pending = groups.load();
    await Promise.resolve();
    groups.setAccount("b");
    response = Promise.resolve(["b"]);
    await groups.load();
    old.resolve(["a"]);
    await pending;
    expect(groups.getSnapshot()).toMatchObject({ userId: "b", groups: ["b"] });
    groups.reset();
    expect(groups.getSnapshot()).toMatchObject({ userId: null, groups: [], status: "idle" });
  });

  test("uttrycklig refresh ersätter gammal läsning och nätfel behåller bekräftade grupper", async () => {
    const old = deferred<string[]>();
    let response = old.promise;
    const groups = new AccountGroups(() => response);
    groups.setAccount("a");
    const pending = groups.load();
    await Promise.resolve();
    response = Promise.resolve(["ny"]);
    await groups.load(true);
    old.resolve(["gammal"]);
    await pending;
    expect(groups.getSnapshot().groups).toEqual(["ny"]);
    response = Promise.reject(new Error("offline"));
    await groups.load(true);
    expect(groups.getSnapshot()).toMatchObject({ status: "error", groups: ["ny"] });
  });
});
