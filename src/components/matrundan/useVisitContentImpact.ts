import * as React from "react";
import { getVisitContentImpact, type VisitContentImpact } from "@/lib/matrundan/live-sharing";

export function useVisitContentImpact(
  enabled: boolean,
  visitId: string | undefined,
  groupId: string,
  photoOwnerId?: string,
) {
  const [state, setState] = React.useState<{
    key: string;
    impact: VisitContentImpact | null;
    failed: boolean;
  } | null>(null);
  const key = `${visitId}:${groupId}:${photoOwnerId ?? "own"}`;
  React.useEffect(() => {
    if (!enabled || !visitId) return;
    let cancelled = false;
    setState(null);
    getVisitContentImpact(visitId, groupId, photoOwnerId)
      .then((impact) => {
        if (!cancelled) setState({ key, impact, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, impact: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, visitId, groupId, photoOwnerId, key]);
  return enabled && state?.key === key ? state : null;
}
