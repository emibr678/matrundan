import * as React from "react";
import { CheckCircle2, ChevronDown, CircleAlert, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  listGroupPlaceDataReports,
  listLocalPlaceDataReports,
  PLACE_DATA_REPORT_CATEGORY_LABEL,
  PLACE_DATA_REPORT_STATUS_LABEL,
  reviewGroupPlaceDataReport,
  reviewLocalPlaceDataReport,
  type PlaceDataReport,
  type PlaceDataReportStatus,
} from "@/lib/matrundan/place-data-reports";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

const ACTIVE_STATUSES = new Set<PlaceDataReportStatus>(["open", "ready_for_osm"]);
const STATUS_OPTIONS: PlaceDataReportStatus[] = ["open", "ready_for_osm", "resolved", "dismissed"];

function formatReportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PlaceDataReportsSection() {
  const { mode, activeGroupId, exampleMode } = useSession();
  const { state } = useStore();
  const [reports, setReports] = React.useState<PlaceDataReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const reviewer = state.members.find((member) => member.id === state.currentUserId);
  const storageKind = exampleMode ? "session" : "local";

  const load = React.useCallback(async () => {
    if (!groupId) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows =
        mode === "live"
          ? await listGroupPlaceDataReports(groupId)
          : listLocalPlaceDataReports(groupId, storageKind);
      setReports(rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte läsa platsdatarapporter.");
    } finally {
      setLoading(false);
    }
  }, [groupId, mode, storageKind]);

  React.useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("matrundan:place-data-reports-changed", reload);
    return () => window.removeEventListener("matrundan:place-data-reports-changed", reload);
  }, [load]);

  if (!groupId || !reviewer) return null;

  const active = reports.filter((report) => ACTIVE_STATUSES.has(report.status));
  const completed = reports.filter((report) => !ACTIVE_STATUSES.has(report.status));

  async function save(
    report: PlaceDataReport,
    status: PlaceDataReportStatus,
    resolutionNote: string,
  ): Promise<boolean> {
    try {
      if (mode === "live") {
        await reviewGroupPlaceDataReport(groupId!, report.id, { status, resolutionNote });
      } else {
        reviewLocalPlaceDataReport(
          groupId!,
          report.id,
          reviewer!,
          { status, resolutionNote },
          storageKind,
        );
      }
      await load();
      toast.success("Bedömningen är sparad.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara bedömningen.");
      return false;
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Platsdata</h3>
        {active.length > 0 ? (
          <Badge variant="secondary" className="rounded-full">
            {active.length} att granska
          </Badge>
        ) : null}
      </div>
      <Card className="rounded-2xl border-border/70 p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>
              Gruppens rapporter är privata. Granska underlaget, rätta det som hör till Matrundan
              och markera vad som senare kan skickas vidare till OpenStreetMap.
            </p>
            <p>
              <strong className="font-medium text-foreground">Förberedd för OpenStreetMap</strong>{" "}
              publicerar ingenting ännu.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Laddar rapporter…
          </div>
        ) : reports.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Inga platsdatarapporter ännu.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {active.map((report) => (
              <PlaceDataReportCard key={report.id} report={report} onSave={save} />
            ))}

            {completed.length > 0 ? (
              <details className="group rounded-xl border border-border/70">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
                  Tidigare granskade ({completed.length})
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-border/60 p-3">
                  {completed.map((report) => (
                    <PlaceDataReportCard key={report.id} report={report} onSave={save} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}

function PlaceDataReportCard({
  report,
  onSave,
}: {
  report: PlaceDataReport;
  onSave: (
    report: PlaceDataReport,
    status: PlaceDataReportStatus,
    resolutionNote: string,
  ) => Promise<boolean>;
}) {
  const [status, setStatus] = React.useState<PlaceDataReportStatus>(report.status);
  const [resolutionNote, setResolutionNote] = React.useState(report.resolutionNote ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setStatus(report.status);
    setResolutionNote(report.resolutionNote ?? "");
  }, [report]);

  return (
    <details className="group min-w-0 rounded-xl border border-border/70 bg-background">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-medium">{report.placeName}</div>
          <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
            {PLACE_DATA_REPORT_CATEGORY_LABEL[report.category]} · {report.reporterName}
          </div>
          <Badge
            variant={report.status === "ready_for_osm" ? "outline" : "secondary"}
            className="mt-2 max-w-full whitespace-normal rounded-full text-left"
          >
            {PLACE_DATA_REPORT_STATUS_LABEL[report.status]}
          </Badge>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-border/60 p-3">
        <div className="space-y-2 text-xs">
          <p className="whitespace-pre-wrap break-words leading-relaxed">{report.description}</p>
          <p className="break-words text-muted-foreground">
            {[report.placeAddress, report.placeCity].filter(Boolean).join(" · ")}
          </p>
          {report.placeWebsite ? (
            <p className="break-all text-muted-foreground">Webbplats: {report.placeWebsite}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Rapporterad {formatReportDate(report.createdAt)}
            {report.reviewerName && report.reviewedAt
              ? ` · Senast bedömd av ${report.reviewerName} ${formatReportDate(report.reviewedAt)}`
              : ""}
          </p>
        </div>

        <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
          <Link to="/matstallen/$placeId" params={{ placeId: report.placeId }}>
            Öppna stället
          </Link>
        </Button>

        <div className="space-y-2">
          <Label htmlFor={`place-data-report-status-${report.id}`}>Bedömning</Label>
          <select
            id={`place-data-report-status-${report.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value as PlaceDataReportStatus)}
            className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {PLACE_DATA_REPORT_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`place-data-report-note-${report.id}`}>Intern anteckning (valfri)</Label>
          <Textarea
            id={`place-data-report-note-${report.id}`}
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            maxLength={1000}
            rows={3}
            className="resize-y"
            placeholder="Exempel: Webbplatsen rättad i gruppen. OSM behöver fortfarande uppdateras."
          />
        </div>

        <Button
          type="button"
          className="min-h-11 w-full"
          disabled={
            saving ||
            (status === report.status && resolutionNote.trim() === (report.resolutionNote ?? ""))
          }
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(report, status, resolutionNote);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Spara bedömning
        </Button>
      </div>
    </details>
  );
}
