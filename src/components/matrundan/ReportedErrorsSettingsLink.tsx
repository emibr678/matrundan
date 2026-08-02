import * as React from "react";
import { ChevronRight, CircleAlert, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { countReportsByFilter } from "@/lib/matrundan/place-data-report-view";
import {
  listGroupPlaceDataReports,
  listLocalPlaceDataReports,
  type PlaceDataReport,
} from "@/lib/matrundan/place-data-reports";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

export function ReportedErrorsSettingsLink() {
  const { mode, activeGroupId, exampleMode } = useSession();
  const { state } = useStore();
  const [reports, setReports] = React.useState<PlaceDataReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const storageKind = exampleMode ? "session" : "local";

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!groupId) {
        setReports([]);
        setLoading(false);
        return;
      }
      try {
        const next =
          mode === "live"
            ? await listGroupPlaceDataReports(groupId)
            : listLocalPlaceDataReports(groupId, storageKind);
        if (!cancelled) setReports(next);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Kunde inte läsa rapporterade fel.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const reload = () => void load();
    window.addEventListener("matrundan:place-data-reports-changed", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("matrundan:place-data-reports-changed", reload);
    };
  }, [groupId, mode, storageKind]);

  if (!groupId) return null;
  const counts = countReportsByFilter(reports);
  const summary = [
    counts.review ? `${counts.review} att granska` : null,
    counts.ready ? `${counts.ready} redo` : null,
    counts.sent ? `${counts.sent} skickade` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Rapporterade fel</h3>
      <Card className="rounded-2xl border-border/70 p-0">
        <Link
          to="/rapporterade-fel"
          search={{ filter: undefined, query: "", report: "" }}
          className="flex min-h-16 w-full items-center gap-3 rounded-2xl p-4 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Hantera rapporterade fel</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Stängda matställen, fel namn, adresser och andra felaktiga uppgifter.
            </div>
            {loading ? (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Laddar…
              </div>
            ) : summary ? (
              <div className="mt-1 text-[11px] text-muted-foreground">{summary}</div>
            ) : (
              <div className="mt-1 text-[11px] text-muted-foreground">Inga rapporterade fel</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </Card>
    </section>
  );
}
