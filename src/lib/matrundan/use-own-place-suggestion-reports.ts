import * as React from "react";
import { z } from "zod";

import {
  listLocalPlaceDataReports,
  type LocalReportStorage,
  type PlaceDataReport,
} from "./place-data-reports";
import { rpcClient } from "./rpc-client";
import { useSession } from "./session";
import { useStore } from "./store";

const reportKeyListSchema = z.array(z.string().min(1));
const ACTIVE_REPORT_STATUSES = new Set<PlaceDataReport["status"]>(["open", "ready_for_osm"]);

function providerReportKey(provider: string, providerPlaceId: string): string {
  return `provider:${provider.trim().toLocaleLowerCase("en-US")}:${providerPlaceId.trim()}`;
}

function isMissingOwnReportRpc(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    /could not find the function|schema cache/i.test(message) &&
    message.toLocaleLowerCase("en-US").includes("list_own_open_place_suggestion_report_keys_v1")
  );
}

export function listOwnOpenLocalPlaceSuggestionReportKeys(
  groupId: string,
  reporterId: string,
  storageKind: LocalReportStorage,
): string[] {
  return [
    ...new Set(
      listLocalPlaceDataReports(groupId, storageKind)
        .filter(
          (report) =>
            report.targetKind === "suggestion" &&
            report.reporterId === reporterId &&
            ACTIVE_REPORT_STATUSES.has(report.status) &&
            Boolean(report.provider) &&
            Boolean(report.providerPlaceId),
        )
        .map((report) => providerReportKey(report.provider!, report.providerPlaceId!)),
    ),
  ];
}

async function listOwnOpenLivePlaceSuggestionReportKeys(groupId: string): Promise<string[]> {
  try {
    return await rpcClient.call(
      "list_own_open_place_suggestion_report_keys_v1",
      { _group_id: groupId },
      reportKeyListSchema,
      "Servern returnerade ett oväntat rapportstatusformat.",
    );
  } catch (error) {
    if (isMissingOwnReportRpc(error)) return [];
    throw error;
  }
}

export function useOwnOpenPlaceSuggestionReportKeys(): Set<string> {
  const { mode, activeGroupId, exampleMode } = useSession();
  const { state } = useStore();
  const [keys, setKeys] = React.useState<Set<string>>(() => new Set());
  const [revision, setRevision] = React.useState(0);
  const groupId = mode === "live" ? activeGroupId : state.group.id;

  React.useEffect(() => {
    const handleChanged = () => setRevision((value) => value + 1);
    window.addEventListener("matrundan:place-data-reports-changed", handleChanged);
    return () => window.removeEventListener("matrundan:place-data-reports-changed", handleChanged);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!groupId || !state.currentUserId) {
      setKeys(new Set());
      return;
    }

    if (mode !== "live") {
      const storageKind: LocalReportStorage = exampleMode ? "session" : "local";
      setKeys(
        new Set(
          listOwnOpenLocalPlaceSuggestionReportKeys(groupId, state.currentUserId, storageKind),
        ),
      );
      return;
    }

    void listOwnOpenLivePlaceSuggestionReportKeys(groupId)
      .then((rows) => {
        if (!cancelled) setKeys(new Set(rows));
      })
      .catch(() => {
        if (!cancelled) setKeys(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [exampleMode, groupId, mode, revision, state.currentUserId]);

  return keys;
}
