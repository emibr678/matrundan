import * as React from "react";
import { shareVisitToGroup } from "@/lib/matrundan/live-sharing";
import {
  findShareVisitDuplicate,
  type StrongVisitDuplicateCandidate,
} from "@/lib/matrundan/visit-duplicates";
import {
  runVisitShareJobs,
  type DuplicateDecision,
  type VisitShareJob,
} from "@/lib/matrundan/visit-share-batch";
import { VisitDuplicatePrompt } from "./VisitDuplicatePrompt";

export function useVisitShareBatch() {
  const [candidate, setCandidate] = React.useState<StrongVisitDuplicateCandidate | null>(null);
  const [targetName, setTargetName] = React.useState<string | null>(null);
  const decision = React.useRef<((value: DuplicateDecision) => void) | null>(null);
  const running = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      decision.current?.("cancel");
      decision.current = null;
    };
  }, []);
  function resolve(value: DuplicateDecision) {
    const complete = decision.current;
    decision.current = null;
    setCandidate(null);
    setTargetName(null);
    complete?.(value);
  }
  async function run(jobs: VisitShareJob[]) {
    if (running.current) throw new Error("Delningen pågår redan.");
    running.current = true;
    try {
      return await runVisitShareJobs(jobs, {
        findDuplicate: findShareVisitDuplicate,
        isCancelled: () => !mounted.current,
        decide: (duplicate, job) =>
          new Promise((done) => {
            if (!mounted.current) {
              done("cancel");
              return;
            }
            decision.current = done;
            setTargetName(job.label);
            setCandidate(duplicate);
          }),
        share: (job, allow) =>
          shareVisitToGroup(job.visitId, job.groupId, job.shareComment, allow, job.sharePhoto),
      });
    } finally {
      running.current = false;
    }
  }
  return {
    run,
    duplicatePrompt: (
      <VisitDuplicatePrompt
        candidate={candidate}
        mode="share"
        busy={false}
        targetName={targetName ?? undefined}
        onDismiss={() => resolve("cancel")}
        onUseExisting={() => resolve("skip")}
        onDifferentVisit={() => resolve("share")}
      />
    ),
  };
}
