import * as React from "react";
import { useSession } from "@/lib/matrundan/session";
import { USER_GUIDANCE } from "@/lib/matrundan/user-guidance";
import { useUserGuidance } from "@/lib/matrundan/user-guidance-context";

export type ReviewContextGateState = "ready" | "loading" | "guide";

export function useReviewContextGate({ open, eligible }: { open: boolean; eligible: boolean }) {
  const { mode, user } = useSession();
  const { status, isAcknowledged, isPreviewing, acknowledge } = useUserGuidance();
  const [acceptedInCurrentOpen, setAcceptedInCurrentOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setAcceptedInCurrentOpen(false);
  }, [open]);

  const liveEligible = open && eligible && mode === "live" && Boolean(user?.id);

  let state: ReviewContextGateState = "ready";
  if (liveEligible && !acceptedInCurrentOpen) {
    if (status === "loading") {
      state = "loading";
    } else if (
      isPreviewing(USER_GUIDANCE.reviewContext) ||
      (status === "ready" && !isAcknowledged(USER_GUIDANCE.reviewContext))
    ) {
      state = "guide";
    }
  }

  const accept = React.useCallback(() => {
    setAcceptedInCurrentOpen(true);
    void acknowledge(USER_GUIDANCE.reviewContext);
  }, [acknowledge]);

  return { state, accept };
}
