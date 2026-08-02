import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDefaultOsmPublicText,
  normalizeOsmPublicText,
  OSM_NOTE_STATUS_LABEL,
} from "@/lib/matrundan/osm-notes";
import { publishAnonymousOsmNote, refreshOsmNoteStatus } from "@/lib/matrundan/osm-notes.functions";
import {
  listGroupPlaceDataReports,
  listLocalPlaceDataReports,
  PLACE_DATA_REPORT_CATEGORY_LABEL,
  PLACE_DATA_REPORT_STATUS_LABEL,
  publishLocalOsmNote,
  refreshLocalOsmNoteStatus,
  reviewGroupPlaceDataReport,
  reviewLocalPlaceDataReport,
  type PlaceDataReport,
  type PlaceDataReportStatus,
} from "@/lib/matrundan/place-data-reports";
import { googleMapsSearchUrl, normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

const ACTIVE_STATUSES = new Set<PlaceDataReportStatus>(["open", "ready_for_osm"]);
const PLACE_DATA_HEADING_ID = "group-place-data-heading";

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

function publicationErrorText(code: string | null): string | null {
  if (code === "moderation_zone") {
    return "OpenStreetMap tillåter inte anonyma anteckningar på den här platsen.";
  }
  if (code === "rate_limit") return "OpenStreetMap används mycket. Försök igen senare.";
  if (code === "rejected") return "OpenStreetMap avvisade texten eller kartpositionen.";
  if (code) return "Publiceringen misslyckades. Granska texten och försök igen.";
  return null;
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
  const pendingReviewCount = reports.filter((report) => report.status === "open").length;

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

  async function publish(report: PlaceDataReport, publicText: string): Promise<boolean> {
    try {
      const normalized = normalizeOsmPublicText(publicText);
      if (mode === "live") {
        await publishAnonymousOsmNote({
          data: { groupId: groupId!, reportId: report.id, publicText: normalized },
        });
        toast.success("Den anonyma OSM-anteckningen är publicerad.");
      } else {
        publishLocalOsmNote(groupId!, report.id, normalized, storageKind);
        toast.success("OSM-publiceringen är simulerad i det lokala läget.");
      }
      await load();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte publicera till OpenStreetMap.",
      );
      await load();
      return false;
    }
  }

  async function refresh(report: PlaceDataReport): Promise<boolean> {
    try {
      if (mode === "live") {
        await refreshOsmNoteStatus({ data: { groupId: groupId!, reportId: report.id } });
      } else {
        refreshLocalOsmNoteStatus(groupId!, report.id, storageKind);
      }
      await load();
      toast.success(
        mode === "live" ? "OSM-statusen är uppdaterad." : "Statuskontrollen är simulerad.",
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte kontrollera OSM-statusen.");
      return false;
    }
  }

  return (
    <section aria-labelledby={PLACE_DATA_HEADING_ID}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id={PLACE_DATA_HEADING_ID} className="text-sm font-medium">
          Platsdata
        </h3>
        {pendingReviewCount > 0 ? (
          <Badge variant="secondary" className="rounded-full">
            {pendingReviewCount} att granska
          </Badge>
        ) : null}
      </div>
      <Card className="rounded-2xl border-border/70 p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>
              Gruppens rapporter är privata. Bara en särskilt granskad text och kartposition kan
              publiceras anonymt till OpenStreetMap.
            </p>
            <p>
              OpenStreetMaps kartläggare avgör om kartan ska ändras. Matrundan kan följa statusen,
              men inte kommentera eller stänga en anonym anteckning.
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
              <PlaceDataReportCard
                key={report.id}
                report={report}
                live={mode === "live"}
                onSave={save}
                onPublish={publish}
                onRefresh={refresh}
              />
            ))}

            {completed.length > 0 ? (
              <details className="group rounded-xl border border-border/70">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
                  Tidigare granskade ({completed.length})
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-border/60 p-3">
                  {completed.map((report) => (
                    <PlaceDataReportCard
                      key={report.id}
                      report={report}
                      live={mode === "live"}
                      onSave={save}
                      onPublish={publish}
                      onRefresh={refresh}
                    />
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
  live,
  onSave,
  onPublish,
  onRefresh,
}: {
  report: PlaceDataReport;
  live: boolean;
  onSave: (
    report: PlaceDataReport,
    status: PlaceDataReportStatus,
    resolutionNote: string,
  ) => Promise<boolean>;
  onPublish: (report: PlaceDataReport, publicText: string) => Promise<boolean>;
  onRefresh: (report: PlaceDataReport) => Promise<boolean>;
}) {
  const [resolutionNote, setResolutionNote] = React.useState(report.resolutionNote ?? "");
  const [publicText, setPublicText] = React.useState(
    report.osmPublicText ?? buildDefaultOsmPublicText(report),
  );
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);

  React.useEffect(() => {
    setResolutionNote(report.resolutionNote ?? "");
    setPublicText(report.osmPublicText ?? buildDefaultOsmPublicText(report));
  }, [report]);

  const published = report.osmSubmissionState === "published" && !!report.osmNoteStatus;
  const canPublish = report.status === "ready_for_osm" && !published;
  const publicationError = publicationErrorText(report.osmSubmissionErrorCode);
  const websiteUrl = normalizeWebsiteUrl(report.placeWebsite);
  const noteChanged = resolutionNote.trim() !== (report.resolutionNote ?? "");

  async function saveAs(status: PlaceDataReportStatus): Promise<void> {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(report, status, resolutionNote);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="group min-w-0 rounded-xl border border-border/70 bg-background">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-medium">{report.placeName}</div>
          <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
            {PLACE_DATA_REPORT_CATEGORY_LABEL[report.category]} · {report.reporterName}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {report.targetKind === "suggestion" ? (
              <Badge variant="outline" className="rounded-full">
                Sökträff
              </Badge>
            ) : null}
            <Badge
              variant={report.status === "ready_for_osm" ? "outline" : "secondary"}
              className="max-w-full whitespace-normal rounded-full text-left"
            >
              {PLACE_DATA_REPORT_STATUS_LABEL[report.status]}
            </Badge>
            {report.osmNoteStatus ? (
              <Badge variant="secondary" className="max-w-full whitespace-normal rounded-full">
                {OSM_NOTE_STATUS_LABEL[report.osmNoteStatus]}
              </Badge>
            ) : null}
          </div>
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

        {report.targetKind === "place" && report.placeId ? (
          <Button asChild variant="outline" size="sm" className="min-h-11 w-full">
            <Link to="/matstallen/$placeId" params={{ placeId: report.placeId }}>
              Öppna stället
            </Link>
          </Button>
        ) : (
          <div className={websiteUrl ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
            {websiteUrl ? (
              <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
                <a href={websiteUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4 shrink-0" /> Webbplats
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
              <a
                href={googleMapsSearchUrl({
                  name: report.placeName,
                  address: report.placeAddress,
                  city: report.placeCity,
                })}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4 shrink-0" /> Google Maps
              </a>
            </Button>
          </div>
        )}

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

        {report.status === "open" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Välj nästa steg</div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Förbered rapporten för OpenStreetMap när underlaget verkar stämma. Annars kan den
                markeras som åtgärdad i Matrundan eller avslutas utan åtgärd.
              </p>
            </div>
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={saving}
              onClick={() => void saveAs("ready_for_osm")}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Förbered för OpenStreetMap
            </Button>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 whitespace-normal"
                disabled={saving}
                onClick={() => void saveAs("resolved")}
              >
                <CheckCircle2 className="h-4 w-4" /> Markera som åtgärdad
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 whitespace-normal text-muted-foreground"
                disabled={saving}
                onClick={() => void saveAs("dismissed")}
              >
                <CircleAlert className="h-4 w-4" /> Avsluta utan åtgärd
              </Button>
            </div>
          </div>
        ) : report.status === "ready_for_osm" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rapporten är förberedd för OpenStreetMap. Granska den offentliga texten nedan innan
              något publiceras. Gruppnamn, rapportör och den interna anteckningen skickas inte.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={saving || !noteChanged}
              onClick={() => void saveAs("ready_for_osm")}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Spara intern anteckning
            </Button>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 whitespace-normal"
                disabled={saving}
                onClick={() => void saveAs("resolved")}
              >
                <CheckCircle2 className="h-4 w-4" /> Markera som åtgärdad
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 whitespace-normal text-muted-foreground"
                disabled={saving}
                onClick={() => void saveAs("dismissed")}
              >
                <CircleAlert className="h-4 w-4" /> Avsluta utan åtgärd
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={saving || !noteChanged}
            onClick={() => void saveAs(report.status)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara intern anteckning
          </Button>
        )}

        {canPublish ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="space-y-1">
              <Label htmlFor={`place-data-report-osm-text-${report.id}`}>
                Offentlig text till OpenStreetMap
              </Label>
              <p
                id={`place-data-report-osm-help-${report.id}`}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                Texten och kartpositionen blir offentliga. Gruppnamn, rapportör och intern
                anteckning skickas inte. En neutral Matrundan-referens läggs till automatiskt.
              </p>
            </div>
            <Textarea
              id={`place-data-report-osm-text-${report.id}`}
              aria-describedby={`place-data-report-osm-help-${report.id}`}
              value={publicText}
              onChange={(event) => setPublicText(event.target.value)}
              maxLength={1000}
              rows={7}
              className="resize-y"
            />
            {publicationError ? (
              <p className="text-xs leading-relaxed text-destructive">{publicationError}</p>
            ) : null}
            {report.osmSubmissionState === "submitting" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ett tidigare försök kunde inte bekräftas. Vänta några minuter innan du kontrollerar
                och försöker igen; Matrundan söker först efter samma offentliga referens.
              </p>
            ) : null}
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={publishing || publicText.trim().length < 20}
              onClick={() => setConfirmPublish(true)}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {report.osmSubmissionState === "not_submitted"
                ? "Publicera anonym OSM-anteckning"
                : "Kontrollera och försök publicera igen"}
            </Button>
          </div>
        ) : null}

        {published && report.osmNoteStatus ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                {OSM_NOTE_STATUS_LABEL[report.osmNoteStatus]}
              </Badge>
              {report.osmNoteCreatedAt ? (
                <span className="text-[11px] text-muted-foreground">
                  Publicerad {formatReportDate(report.osmNoteCreatedAt)}
                </span>
              ) : null}
            </div>
            {live && report.osmNoteUrl ? (
              <Button asChild variant="outline" className="min-h-11 w-full">
                <a href={report.osmNoteUrl} target="_blank" rel="noreferrer">
                  Öppna i OpenStreetMap <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Simulerad OSM-anteckning. Inget skickades utanför det lokala läget.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh(report);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Kontrollera OSM-status
            </Button>
            {report.osmNoteLastCheckedAt ? (
              <p className="text-[11px] text-muted-foreground">
                Senast kontrollerad {formatReportDate(report.osmNoteLastCheckedAt)}
              </p>
            ) : null}
            {report.osmPublicText ? (
              <details className="rounded-lg border border-border/60 bg-background">
                <summary className="min-h-11 cursor-pointer px-3 py-2 text-xs font-medium">
                  Visa den offentliga texten
                </summary>
                <p className="whitespace-pre-wrap break-words border-t border-border/60 p-3 text-xs leading-relaxed">
                  {report.osmPublicText}
                </p>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicera offentligt till OpenStreetMap?</AlertDialogTitle>
            <AlertDialogDescription>
              Texten och kartpositionen blir offentliga i OSM. Anteckningen publiceras anonymt och
              kan inte redigeras, kommenteras eller stängas från Matrundan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={publishing}
              onClick={async (event) => {
                event.preventDefault();
                setPublishing(true);
                try {
                  const success = await onPublish(report, publicText);
                  if (success) setConfirmPublish(false);
                } finally {
                  setPublishing(false);
                }
              }}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publicera anonymt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </details>
  );
}
