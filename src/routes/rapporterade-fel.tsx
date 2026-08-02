import * as React from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { buildDefaultOsmPublicText, normalizeOsmPublicText } from "@/lib/matrundan/osm-notes";
import { publishAnonymousOsmNote, refreshOsmNoteStatus } from "@/lib/matrundan/osm-notes.functions";
import {
  chooseDefaultReportedErrorFilter,
  countReportsByFilter,
  filterAndSortPlaceDataReports,
  getPlaceDataReportView,
  REPORTED_ERROR_FILTER_LABEL,
  REPORTED_ERROR_FILTERS,
  type ReportedErrorFilter,
} from "@/lib/matrundan/place-data-report-view";
import {
  listGroupPlaceDataReports,
  listLocalPlaceDataReports,
  publishLocalOsmNote,
  refreshLocalOsmNoteStatus,
  reviewGroupPlaceDataReport,
  reviewLocalPlaceDataReport,
  type PlaceDataReport,
  type PlaceDataReportCategory,
  type PlaceDataReportStatus,
} from "@/lib/matrundan/place-data-reports";
import { googleMapsSearchUrl, normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

const SEARCH_DEFAULTS = { filter: "", query: "", report: "" };
const reportedErrorsSearchSchema = z.object({
  filter: fallback(z.string(), "").default(""),
  query: fallback(z.string(), "").default(""),
  report: fallback(z.string(), "").default(""),
});

const CATEGORY_LABEL: Record<PlaceDataReportCategory, string> = {
  missing_in_osm: "Saknas på kartan",
  closed_or_replaced: "Stängt eller ersatt",
  wrong_name: "Fel namn",
  wrong_address: "Fel adress eller kartposition",
  wrong_website: "Fel webbplats",
  wrong_opening_hours: "Fel öppettider",
  duplicate: "Dubblett",
  other: "Annan felaktig uppgift",
};

export const Route = createFileRoute("/rapporterade-fel")({
  validateSearch: zodValidator(reportedErrorsSearchSchema),
  search: { middlewares: [stripSearchParams(SEARCH_DEFAULTS)] },
  head: () => ({
    meta: [
      { title: "Rapporterade fel · Matrundan" },
      {
        name: "description",
        content: "Granska felaktiga uppgifter om gruppens matställen.",
      },
    ],
  }),
  component: ReportedErrorsPage,
});

function isReportedErrorFilter(value: string): value is ReportedErrorFilter {
  return REPORTED_ERROR_FILTERS.includes(value as ReportedErrorFilter);
}

function formatDateTime(value: string): string {
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

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function ReportedErrorsPage() {
  const { state } = useStore();
  const { mode, activeGroupId, activeGroupRole, exampleMode } = useSession();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/rapporterade-fel" });
  const [reports, setReports] = React.useState<PlaceDataReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visibleLimit, setVisibleLimit] = React.useState(20);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const storageKind = exampleMode ? "session" : "local";
  const reviewer = state.members.find((member) => member.id === state.currentUserId);
  const authorized = mode !== "live" || activeGroupRole === "owner" || activeGroupRole === "admin";

  const load = React.useCallback(async () => {
    if (!groupId || !authorized) {
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
      toast.error(error instanceof Error ? error.message : "Kunde inte läsa rapporterade fel.");
    } finally {
      setLoading(false);
    }
  }, [authorized, groupId, mode, storageKind]);

  React.useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("matrundan:place-data-reports-changed", reload);
    return () => window.removeEventListener("matrundan:place-data-reports-changed", reload);
  }, [load]);

  const requestedFilter = isReportedErrorFilter(search.filter) ? search.filter : null;
  const defaultFilter = React.useMemo(() => chooseDefaultReportedErrorFilter(reports), [reports]);
  const activeFilter = requestedFilter ?? defaultFilter;
  const counts = React.useMemo(() => countReportsByFilter(reports), [reports]);
  const filteredReports = React.useMemo(
    () => filterAndSortPlaceDataReports(reports, activeFilter, search.query),
    [activeFilter, reports, search.query],
  );
  const visibleReports = filteredReports.slice(0, visibleLimit);
  const selectedReport = reports.find((report) => report.id === search.report) ?? null;

  React.useEffect(() => {
    setVisibleLimit(20);
  }, [activeFilter, search.query]);

  React.useEffect(() => {
    if (!loading && !requestedFilter) {
      void navigate({
        replace: true,
        search: { filter: defaultFilter, query: search.query, report: search.report },
      });
    }
  }, [defaultFilter, loading, navigate, requestedFilter, search.query, search.report]);

  async function saveReport(
    report: PlaceDataReport,
    status: PlaceDataReportStatus,
    resolutionNote: string,
  ): Promise<boolean> {
    if (!groupId || !reviewer) return false;
    try {
      if (mode === "live") {
        await reviewGroupPlaceDataReport(groupId, report.id, { status, resolutionNote });
      } else {
        reviewLocalPlaceDataReport(
          groupId,
          report.id,
          reviewer,
          { status, resolutionNote },
          storageKind,
        );
      }
      await load();
      toast.success("Ändringen är sparad.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara ändringen.");
      return false;
    }
  }

  async function publishReport(report: PlaceDataReport, publicText: string): Promise<boolean> {
    if (!groupId) return false;
    try {
      const normalized = normalizeOsmPublicText(publicText);
      if (mode === "live") {
        await publishAnonymousOsmNote({
          data: { groupId, reportId: report.id, publicText: normalized },
        });
      } else {
        publishLocalOsmNote(groupId, report.id, normalized, storageKind);
      }
      await load();
      toast.success(
        mode === "live"
          ? "Rättelseförslaget är skickat."
          : "Rättelseförslaget är simulerat i det lokala läget.",
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka rättelseförslaget.");
      await load();
      return false;
    }
  }

  async function refreshReport(report: PlaceDataReport): Promise<boolean> {
    if (!groupId) return false;
    try {
      if (mode === "live") {
        await refreshOsmNoteStatus({ data: { groupId, reportId: report.id } });
      } else {
        refreshLocalOsmNoteStatus(groupId, report.id, storageKind);
      }
      await load();
      toast.success(mode === "live" ? "Statusen är uppdaterad." : "Statuskontrollen är simulerad.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera statusen.");
      return false;
    }
  }

  function setFilter(filter: ReportedErrorFilter) {
    void navigate({ search: { filter, query: search.query, report: "" } });
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Card className="rounded-2xl border-border/70 p-5">
          <h1 className="font-display text-xl">Rapporterade fel</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Bara gruppens ägare och administratörer kan granska rapporterade fel.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/gruppen">Tillbaka till gruppen</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pt-2 pb-6">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/gruppen">
            <ArrowLeft className="h-4 w-4" /> Gruppen
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Rapporterade fel</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Granska uppgifter om matställen som gruppen har rapporterat som felaktiga.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rapporterna visas bara för gruppens ägare och administratörer.
          </p>
        </div>
      </header>

      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        aria-label="Filtrera rapporterade fel"
      >
        {REPORTED_ERROR_FILTERS.map((filter) => (
          <Button
            key={filter}
            type="button"
            size="sm"
            variant={activeFilter === filter ? "default" : "outline"}
            className="w-full justify-between rounded-full sm:w-auto sm:justify-center"
            onClick={() => setFilter(filter)}
          >
            {REPORTED_ERROR_FILTER_LABEL[filter]}
            <Badge
              variant={activeFilter === filter ? "secondary" : "outline"}
              className="ml-1 rounded-full px-1.5"
            >
              {counts[filter]}
            </Badge>
          </Button>
        ))}
      </div>

      {reports.length >= 8 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.query}
            onChange={(event) =>
              void navigate({
                replace: true,
                search: { filter: activeFilter, query: event.target.value, report: "" },
              })
            }
            placeholder="Sök matställe, adress eller typ av fel"
            className="pl-9"
            aria-label="Sök bland rapporterade fel"
          />
        </div>
      ) : null}

      {loading ? (
        <Card className="flex items-center gap-2 rounded-2xl border-border/70 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar rapporter…
        </Card>
      ) : reports.length === 0 ? (
        <Card className="rounded-2xl border-border/70 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="font-medium">Inga rapporterade fel</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                När någon rapporterar en felaktig uppgift om ett matställe visas den här.
              </p>
            </div>
          </div>
        </Card>
      ) : filteredReports.length === 0 ? (
        <Card className="rounded-2xl border-border/70 p-5">
          <h2 className="font-medium">
            {search.query ? "Inga rapporter matchar sökningen" : emptyFilterTitle(activeFilter)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search.query
              ? "Prova ett annat namn eller ta bort sökningen."
              : "Välj ett annat filter för att se övriga rapporter."}
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {visibleReports.map((report) => {
            const view = getPlaceDataReportView(report);
            return (
              <button
                key={report.id}
                type="button"
                className="flex min-h-20 w-full items-center gap-3 p-4 text-left outline-none transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() =>
                  void navigate({
                    search: { filter: activeFilter, query: search.query, report: report.id },
                  })
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-medium">{report.placeName}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {CATEGORY_LABEL[report.category]}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {view.label} · {formatShortDate(view.sortDate)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </Card>
      )}

      {visibleLimit < filteredReports.length ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setVisibleLimit((current) => current + 20)}
        >
          Visa fler
        </Button>
      ) : null}

      <ReportedErrorDetailsSheet
        report={selectedReport}
        live={mode === "live"}
        open={selectedReport != null}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              search: { filter: activeFilter, query: search.query, report: "" },
            });
          }
        }}
        onSave={saveReport}
        onPublish={publishReport}
        onRefresh={refreshReport}
      />
    </div>
  );
}

function emptyFilterTitle(filter: ReportedErrorFilter): string {
  if (filter === "review") return "Inga rapporter att granska";
  if (filter === "ready") return "Inga förslag redo att skicka";
  if (filter === "sent") return "Inga skickade rättelseförslag";
  return "Inga avslutade rapporter";
}

function ReportedErrorDetailsSheet({
  report,
  live,
  open,
  onOpenChange,
  onSave,
  onPublish,
  onRefresh,
}: {
  report: PlaceDataReport | null;
  live: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    report: PlaceDataReport,
    status: PlaceDataReportStatus,
    resolutionNote: string,
  ) => Promise<boolean>;
  onPublish: (report: PlaceDataReport, publicText: string) => Promise<boolean>;
  onRefresh: (report: PlaceDataReport) => Promise<boolean>;
}) {
  const [resolutionNote, setResolutionNote] = React.useState("");
  const [publicText, setPublicText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [confirmPublish, setConfirmPublish] = React.useState(false);

  React.useEffect(() => {
    if (!report) return;
    setResolutionNote(report.resolutionNote ?? "");
    setPublicText(report.osmPublicText ?? buildDefaultOsmPublicText(report));
  }, [report]);

  if (!report) return null;
  const view = getPlaceDataReportView(report);
  const websiteUrl = normalizeWebsiteUrl(report.placeWebsite);
  const noteChanged = resolutionNote.trim() !== (report.resolutionNote ?? "");

  async function saveAs(status: PlaceDataReportStatus): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      return await onSave(report!, status, resolutionNote);
    } finally {
      setBusy(false);
    }
  }

  async function publish(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const success = await onPublish(report!, publicText);
      if (success) setConfirmPublish(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-none overflow-y-auto p-4 sm:max-w-xl sm:p-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="break-words">{report.placeName}</SheetTitle>
            <SheetDescription>{CATEGORY_LABEL[report.category]}</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-5">
            <div className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {report.description}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {[report.placeAddress, report.placeCity].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Rapporterad av {report.reporterName} · {formatDateTime(report.createdAt)}
              </p>
            </div>

            <ReportLinks report={report} websiteUrl={websiteUrl} />

            {view.state === "review" ? (
              <ReviewStep
                resolutionNote={resolutionNote}
                onResolutionNoteChange={setResolutionNote}
                busy={busy}
                onContinue={() => void saveAs("ready_for_osm")}
                onResolve={() => void saveAs("resolved")}
                onDismiss={() => void saveAs("dismissed")}
              />
            ) : view.state === "ready_to_send" ||
              view.state === "sending" ||
              view.state === "failed" ? (
              <CorrectionStep
                viewState={view.state}
                publicText={publicText}
                onPublicTextChange={setPublicText}
                resolutionNote={resolutionNote}
                onResolutionNoteChange={setResolutionNote}
                noteChanged={noteChanged}
                busy={busy}
                onHelp={() => setHelpOpen(true)}
                onPublish={() => setConfirmPublish(true)}
                onSaveNote={() => void saveAs("ready_for_osm")}
                onResolve={() => void saveAs("resolved")}
                onDismiss={() => void saveAs("dismissed")}
              />
            ) : view.state === "sent_pending" ||
              view.state === "sent_reviewed" ||
              view.state === "sent_unavailable" ? (
              <SentStep
                report={report}
                live={live}
                viewState={view.state}
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  try {
                    await onRefresh(report);
                  } finally {
                    setRefreshing(false);
                  }
                }}
              />
            ) : (
              <ClosedStep
                report={report}
                label={view.label}
                summary={view.summary}
                resolutionNote={resolutionNote}
                onResolutionNoteChange={setResolutionNote}
                noteChanged={noteChanged}
                busy={busy}
                onSave={() => void saveAs(report.status)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <OpenStreetMapHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skicka rättelseförslaget?</AlertDialogTitle>
            <AlertDialogDescription>
              Texten och kartpositionen blir offentliga i OpenStreetMap. Ditt namn, gruppens namn
              och den interna anteckningen skickas inte. Förslaget granskas av OpenStreetMaps
              användare och kan inte redigeras eller tas bort från Matrundan efteråt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || publicText.trim().length < 20}
              onClick={(event) => {
                event.preventDefault();
                void publish();
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Skicka förslaget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReportLinks({
  report,
  websiteUrl,
}: {
  report: PlaceDataReport;
  websiteUrl: string | undefined;
}) {
  if (report.targetKind === "place" && report.placeId) {
    return (
      <Button asChild variant="outline" className="w-full">
        <Link to="/matstallen/$placeId" params={{ placeId: report.placeId }}>
          Öppna matstället <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <div className={websiteUrl ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
      {websiteUrl ? (
        <Button asChild variant="outline" className="min-w-0 px-2">
          <a href={websiteUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 shrink-0" /> Webbplats
          </a>
        </Button>
      ) : null}
      <Button asChild variant="outline" className="min-w-0 px-2">
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
  );
}

function InternalNoteField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="reported-error-internal-note">Intern anteckning</Label>
      <Textarea
        id="reported-error-internal-note"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={1000}
        rows={3}
        className="resize-y"
        placeholder="Lägg till något som hjälper gruppens administratörer."
      />
      <p className="text-xs text-muted-foreground">
        Syns bara för gruppens ägare och administratörer.
      </p>
    </div>
  );
}

function ReviewStep({
  resolutionNote,
  onResolutionNoteChange,
  busy,
  onContinue,
  onResolve,
  onDismiss,
}: {
  resolutionNote: string;
  onResolutionNoteChange: (value: string) => void;
  busy: boolean;
  onContinue: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-4">
      <InternalNoteField value={resolutionNote} onChange={onResolutionNoteChange} />
      <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div>
          <h3 className="font-medium">Välj nästa steg</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Fortsätt när rapporten verkar stämma, eller avsluta den om ingen rättelse behövs.
          </p>
        </div>
        <Button type="button" className="w-full" disabled={busy} onClick={onContinue}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Fortsätt till rättelseförslag
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={onResolve}
        >
          <CheckCircle2 className="h-4 w-4" /> Markera som åtgärdad
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground"
          disabled={busy}
          onClick={onDismiss}
        >
          Avsluta utan åtgärd
        </Button>
      </div>
    </div>
  );
}

function CorrectionStep({
  viewState,
  publicText,
  onPublicTextChange,
  resolutionNote,
  onResolutionNoteChange,
  noteChanged,
  busy,
  onHelp,
  onPublish,
  onSaveNote,
  onResolve,
  onDismiss,
}: {
  viewState: "ready_to_send" | "sending" | "failed";
  publicText: string;
  onPublicTextChange: (value: string) => void;
  resolutionNote: string;
  onResolutionNoteChange: (value: string) => void;
  noteChanged: boolean;
  busy: boolean;
  onHelp: () => void;
  onPublish: () => void;
  onSaveNote: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  const uncertain = viewState === "sending";
  const failed = viewState === "failed";
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="font-medium">
              {uncertain || failed
                ? "Publiceringen kunde inte bekräftas"
                : "Hjälp till att rätta uppgiften på kartan"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {uncertain || failed
                ? "Matrundan kontrollerar först om rättelseförslaget redan har skapats, så att ingen dubblett skickas."
                : "Du kan skicka ett rättelseförslag till OpenStreetMap, en öppen karta som användare hjälps åt att hålla uppdaterad."}
            </p>
            <Button type="button" variant="link" className="h-auto px-0 text-xs" onClick={onHelp}>
              <Info className="h-3.5 w-3.5" /> Så fungerar det
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reported-error-public-text">Text som skickas till OpenStreetMap</Label>
          <Textarea
            id="reported-error-public-text"
            value={publicText}
            onChange={(event) => onPublicTextChange(event.target.value)}
            maxLength={1000}
            rows={7}
            className="resize-y"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Texten och kartpositionen blir offentliga. Ditt namn, gruppens namn och den interna
            anteckningen skickas inte.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={busy || publicText.trim().length < 20}
          onClick={onPublish}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {uncertain || failed ? "Kontrollera och försök igen" : "Skicka rättelseförslag"}
        </Button>
      </div>

      <details className="rounded-xl border border-border/70">
        <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium">
          Intern anteckning och fler alternativ
        </summary>
        <div className="space-y-3 border-t border-border/60 p-3">
          <InternalNoteField value={resolutionNote} onChange={onResolutionNoteChange} />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || !noteChanged}
            onClick={onSaveNote}
          >
            Spara intern anteckning
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={onResolve}
          >
            Markera som åtgärdad
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={busy}
            onClick={onDismiss}
          >
            Avsluta utan åtgärd
          </Button>
        </div>
      </details>
    </div>
  );
}

function SentStep({
  report,
  live,
  viewState,
  refreshing,
  onRefresh,
}: {
  report: PlaceDataReport;
  live: boolean;
  viewState: "sent_pending" | "sent_reviewed" | "sent_unavailable";
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const heading =
    viewState === "sent_pending"
      ? "Väntar på granskning"
      : viewState === "sent_reviewed"
        ? "Granskad i OpenStreetMap"
        : report.osmNoteStatus === "hidden"
          ? "Ärendet är inte längre tillgängligt"
          : "Statusen kunde inte hämtas";
  const description =
    viewState === "sent_pending"
      ? "Rättelseförslaget har skickats till OpenStreetMap och väntar på att granskas."
      : viewState === "sent_reviewed"
        ? "Ärendet har avslutats av en användare i OpenStreetMap. Det betyder inte alltid att informationen på kartan ändrades."
        : report.osmNoteStatus === "hidden"
          ? "Rättelseförslaget går inte längre att öppna i OpenStreetMap."
          : "Matrundan kunde inte kontrollera vad som har hänt med rättelseförslaget.";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <Badge variant="secondary" className="rounded-full">
          {heading}
        </Badge>
        <p className="mt-3 text-sm leading-relaxed">{description}</p>
        {report.osmNoteCreatedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Skickat {formatDateTime(report.osmNoteCreatedAt)}
          </p>
        ) : null}
      </div>

      {live && report.osmNoteUrl ? (
        <Button asChild variant="outline" className="w-full">
          <a href={report.osmNoteUrl} target="_blank" rel="noreferrer">
            Visa ärendet i OpenStreetMap <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={refreshing}
        onClick={onRefresh}
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Uppdatera status
      </Button>

      {report.osmNoteLastCheckedAt ? (
        <p className="text-center text-xs text-muted-foreground">
          Senast uppdaterad {formatDateTime(report.osmNoteLastCheckedAt)}
        </p>
      ) : null}

      {report.osmPublicText ? (
        <details className="rounded-xl border border-border/70">
          <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium">
            Visa texten som skickades
          </summary>
          <p className="whitespace-pre-wrap break-words border-t border-border/60 p-3 text-sm leading-relaxed">
            {report.osmPublicText}
          </p>
        </details>
      ) : null}

      {report.resolutionNote ? (
        <details className="rounded-xl border border-border/70">
          <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium">
            Visa intern anteckning
          </summary>
          <p className="whitespace-pre-wrap break-words border-t border-border/60 p-3 text-sm leading-relaxed">
            {report.resolutionNote}
          </p>
        </details>
      ) : null}
    </div>
  );
}

function ClosedStep({
  report,
  label,
  summary,
  resolutionNote,
  onResolutionNoteChange,
  noteChanged,
  busy,
  onSave,
}: {
  report: PlaceDataReport;
  label: string;
  summary: string;
  resolutionNote: string;
  onResolutionNoteChange: (value: string) => void;
  noteChanged: boolean;
  busy: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <Badge variant="secondary" className="rounded-full">
          {label}
        </Badge>
        <p className="mt-3 text-sm leading-relaxed">{summary}</p>
        {report.reviewedAt ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Senast bedömd {formatDateTime(report.reviewedAt)}
          </p>
        ) : null}
      </div>
      <InternalNoteField value={resolutionNote} onChange={onResolutionNoteChange} />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy || !noteChanged}
        onClick={onSave}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Spara intern anteckning
      </Button>
    </div>
  );
}

function OpenStreetMapHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rätta uppgifter i OpenStreetMap</DialogTitle>
          <DialogDescription>Så fungerar ett rättelseförslag utanför Matrundan.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Ibland är ett matställe markerat med fel namn eller adress, eller finns kvar på kartan
            trots att det har stängt. Då kan du skicka ett rättelseförslag till OpenStreetMap.
          </p>
          <p>
            OpenStreetMap är en öppen karta som användare hjälps åt att hålla uppdaterad. Andra
            appar och webbplatser kan använda informationen därifrån.
          </p>
          <p>
            Förslaget blir synligt för OpenStreetMaps användare, som kan kontrollera uppgiften och
            uppdatera kartan. Det är alltså inte säkert att kartan ändras direkt.
          </p>
          <p>
            Bara texten och kartpositionen som visas före publiceringen skickas vidare. Ditt namn,
            gruppens namn och den interna anteckningen skickas inte.
          </p>
          <p>En rättelse i OpenStreetMap ändrar inte informationen i Google Maps.</p>
          <p>
            Efteråt kan Matrundan visa om förslaget fortfarande väntar på granskning eller har
            avslutats.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
