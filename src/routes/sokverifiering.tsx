import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IS_STAGING } from "@/lib/app-environment";
import { useSession } from "@/lib/matrundan/session";
import {
  measureLiveSearch,
  type ProbeProgress,
} from "@/lib/matrundan/live-search-verification.functions";

export const Route = createFileRoute("/sokverifiering")({ component: Probe });
type Row = {
  target: string;
  strategy: string;
  areas: number;
  sample: number;
  action: string;
  requestedCache: string;
  httpMs: number;
  relayMs: number;
  browserMs: number;
  healthMs: number;
  count: number;
  failedAreas: number;
  canonicalIncomplete: boolean;
  requests: number | null;
  cacheHits: number | null;
  reservedCredits: number;
  limited: boolean;
  hasMore: boolean;
  error: string | null;
  sha: string;
};

function Probe() {
  const { activeGroupId, mode } = useSession();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState("Inte startad");
  if (!IS_STAGING) return <p>Endast staging</p>;
  if (mode !== "live" || !activeGroupId)
    return (
      <p>
        Logga in i den ordinarie appen och välj testgruppen. <a href="/">Öppna appen</a>
      </p>
    );
  async function run() {
    if (running || rows.length) return;
    setRunning(true);
    let spent = 44; // 4 verified credits plus 40 conservative credits for the rejected invalid-ID pilot.
    try {
      for (const sample of [0, 1])
        for (const areas of [1, 5] as const)
          for (const strategy of ["restaurant", "sushi"] as const)
            for (const target of (sample ? ["candidate", "main"] : ["main", "candidate"]) as Array<
              "main" | "candidate"
            >) {
              if (sample === 0 && areas === 1 && strategy === "restaurant") continue; // Already captured: eight valid observations.
              let progress: ProbeProgress | undefined;
              let more = false;
              for (const action of ["first", "more"] as const) {
                if (action === "more" && !more) continue;
                const inputProgress = progress;
                for (const requestedCache of ["cold", "warm"]) {
                  if (spent >= 240) {
                    setStatus("Stopp: 240 krediter reserverade");
                    return;
                  }
                  setStatus(
                    `${target} ${strategy} ${areas} områden ${action} ${requestedCache}, prov ${sample + 1}`,
                  );
                  const start = performance.now();
                  const result = await measureLiveSearch({
                    data: {
                      groupId: activeGroupId!,
                      target,
                      strategy,
                      areas,
                      sample,
                      action,
                      progress: inputProgress,
                      remainingCredits: 240 - spent,
                    },
                  });
                  const browserMs = performance.now() - start;
                  spent += result.budget.reservedCredits;
                  const row: Row = {
                    target,
                    strategy,
                    areas,
                    sample,
                    action,
                    requestedCache,
                    browserMs,
                    httpMs: result.httpMs,
                    relayMs: result.relayMs,
                    healthMs: result.healthMs,
                    count: result.count,
                    failedAreas: result.failedAreas,
                    canonicalIncomplete: result.canonicalIncomplete,
                    requests: result.budget.requests,
                    cacheHits: result.budget.cacheHits ?? null,
                    reservedCredits: result.budget.reservedCredits,
                    limited: result.budget.limited,
                    hasMore: result.hasMore,
                    error: result.error,
                    sha: result.sha,
                  };
                  setRows((prev) => [...prev, row]);
                  if (
                    result.error ||
                    result.budget.limited ||
                    result.failedAreas ||
                    result.canonicalIncomplete
                  ) {
                    setStatus("Stopp: fel eller ofullständigt svar");
                    return;
                  }
                  if (requestedCache === "cold") {
                    progress = result.progress;
                    more = result.hasMore;
                  }
                }
              }
            }
      setStatus("Klart");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const safe = /^PROBE_[A-Z0-9_]+$/.test(message)
        ? message
        : message.startsWith("Unauthorized:")
          ? "PROBE_AUTH_REJECTED"
          : "PROBE_RPC_FAILED";
      setStatus("Stopp: " + safe);
    } finally {
      setRunning(false);
    }
  }
  return (
    <main style={{ padding: 16 }}>
      <h1>Avgränsad liveverifiering av PR #515</h1>
      <p>
        Endast läsning. Oförändrad main och exakt kandidat. Två försök per cell. Kall betyder avsedd
        appcachemiss; kvittot avgör faktisk cache. Server-HTTP inkluderar autentisering, databas,
        provider, transport och serialisering. Providerlatens isoleras inte. Inga råsvar,
        identiteter eller sessionsuppgifter sparas.
      </p>
      <p>Högst 240 reserverade krediter för hela omgången. Ingen faktisk debitering rapporteras.</p>
      <button disabled={running || rows.length > 0} onClick={run}>
        Kör begränsat liveprov
      </button>
      <p role="status">{status}</p>
      <p>
        Observationer: {rows.length} · Reserverade krediter:{" "}
        {44 + rows.reduce((a, r) => a + r.reservedCredits, 0)}
      </p>
      <pre aria-label="Mätresultat">{JSON.stringify(rows, null, 2)}</pre>
    </main>
  );
}
