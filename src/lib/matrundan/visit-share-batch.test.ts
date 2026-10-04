import { describe, expect, test } from "bun:test";
import { runVisitShareJobs, type VisitShareJob } from "./visit-share-batch";

const job = (groupId: string): VisitShareJob => ({
  visitId: "visit",
  groupId,
  label: groupId,
  shareComment: true,
  sharePhoto: true,
});
const duplicate = {
  visitId: "other",
  visitedOn: "2026-09-20",
  mealType: "middag",
  alreadyVisibleInTargetGroup: true,
};

describe("visit sharing batch", () => {
  test("partial success can retry only remaining targets, without repeating successful writes", async () => {
    const calls: string[] = [];
    let failing = true;
    const dependencies = {
      findDuplicate: async () => null,
      decide: async () => "share" as const,
      share: async (target: VisitShareJob) => {
        calls.push(target.groupId);
        if (target.groupId === "B" && failing) throw new Error("Medlemskapet ändrades");
      },
    };
    const first = await runVisitShareJobs([job("A"), job("B"), job("C"), job("A")], dependencies);
    expect(first.map(({ status }) => status)).toEqual(["success", "failed", "success"]);
    expect(first[1].error).toBe("Medlemskapet ändrades");
    failing = false;
    const retry = await runVisitShareJobs(
      first.filter(({ status }) => status === "failed").map(({ job }) => job),
      dependencies,
    );
    expect(retry[0].status).toBe("success");
    expect(calls).toEqual(["A", "B", "C", "B"]);
  });

  test("each target needs its own duplicate confirmation; cancel leaves later targets pending", async () => {
    const decisions: string[] = [];
    const writes: Array<[string, boolean]> = [];
    const result = await runVisitShareJobs([job("A"), job("B"), job("C")], {
      findDuplicate: async () => duplicate,
      decide: async (_, target) => {
        decisions.push(target.groupId);
        return target.groupId === "A" ? "share" : "cancel";
      },
      share: async (target, allow) => {
        writes.push([target.groupId, allow]);
      },
    });
    expect(decisions).toEqual(["A", "B"]);
    expect(writes).toEqual([["A", true]]);
    expect(result.map(({ status }) => status)).toEqual(["success", "pending", "pending"]);
  });

  test("an existing canonical link only grants own content and skips duplicate detection", async () => {
    let reads = 0;
    const writes: boolean[] = [];
    const result = await runVisitShareJobs(
      [{ ...job("A"), alreadyLinked: true, shareComment: false }],
      {
        findDuplicate: async () => {
          reads++;
          return duplicate;
        },
        decide: async () => "cancel",
        share: async (target, allow) => {
          expect(target.shareComment).toBe(false);
          expect(target.sharePhoto).toBe(true);
          writes.push(allow);
        },
      },
    );
    expect(reads).toBe(0);
    expect(writes).toEqual([false]);
    expect(result[0].status).toBe("success");
  });

  test("unmount cancellation stops writes even after an in-flight duplicate lookup", async () => {
    let cancelled = false;
    let writes = 0;
    const result = await runVisitShareJobs([job("A"), job("B")], {
      isCancelled: () => cancelled,
      findDuplicate: async () => {
        cancelled = true;
        return null;
      },
      decide: async () => "share",
      share: async () => {
        writes++;
      },
    });
    expect(writes).toBe(0);
    expect(result.map(({ status }) => status)).toEqual(["pending", "pending"]);
  });
});
