import type { StrongVisitDuplicateCandidate } from "./visit-duplicates";
import type { Occasion } from "./types";

export interface VisitShareJob {
  visitId: string;
  groupId: string;
  label: string;
  shareComment: boolean;
  sharePhoto: boolean;
  alreadyLinked?: boolean;
  confirmedExperience?: Occasion[];
}
export type DuplicateDecision = "share" | "skip" | "cancel";
export interface VisitShareResult {
  job: VisitShareJob;
  status: "success" | "failed" | "skipped" | "pending";
  error?: string;
}

/** One transaction per target. Confirming one duplicate never approves another. */
export async function runVisitShareJobs(
  jobs: VisitShareJob[],
  dependencies: {
    isCancelled?: () => boolean;
    findDuplicate: (
      visitId: string,
      groupId: string,
    ) => Promise<StrongVisitDuplicateCandidate | null>;
    decide: (
      candidate: StrongVisitDuplicateCandidate,
      job: VisitShareJob,
    ) => Promise<DuplicateDecision>;
    share: (job: VisitShareJob, allowDuplicate: boolean) => Promise<unknown>;
  },
): Promise<VisitShareResult[]> {
  const results: VisitShareResult[] = [];
  const seen = new Set<string>();
  let cancelled = false;
  for (const job of jobs) {
    const key = `${job.visitId}:${job.groupId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (cancelled || dependencies.isCancelled?.()) {
      results.push({ job, status: "pending" });
      continue;
    }
    try {
      const duplicate = job.alreadyLinked
        ? null
        : await dependencies.findDuplicate(job.visitId, job.groupId);
      if (dependencies.isCancelled?.()) {
        cancelled = true;
        results.push({ job, status: "pending" });
        continue;
      }
      const decision = duplicate ? await dependencies.decide(duplicate, job) : "share";
      if (decision !== "share") {
        cancelled = decision === "cancel";
        results.push({ job, status: cancelled ? "pending" : "skipped" });
        continue;
      }
      await dependencies.share(job, duplicate != null);
      results.push({ job, status: "success" });
    } catch (error) {
      results.push({
        job,
        status: "failed",
        error: error instanceof Error ? error.message : "Kunde inte lägga till besöket.",
      });
    }
  }
  return results;
}
