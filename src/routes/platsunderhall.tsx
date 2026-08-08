import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PlaceMap } from "@/components/matrundan/PlaceMap";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  linkPlaceMaintenanceProviderMatch,
  searchPlaceMaintenanceProviderMatches,
  type PlaceMaintenanceProviderMatch,
} from "@/lib/matrundan/place-maintenance.functions";
import {
  dismissPlaceMaintenanceCandidate,
  getPlaceMaintenanceAccess,
  listPlaceMaintenanceCandidates,
  markPlaceMaintenanceNeedsOsm,
  PLACE_MAINTENANCE_DISMISSAL_LABEL,
  type PlaceMaintenanceCandidate,
  type PlaceMaintenanceDismissalReason,
} from "@/lib/matrundan/place-maintenance";
import { useSession } from "@/lib/matrundan/session";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

export const Route = createFileRoute("/platsunderhall")({
  head: () => ({
    meta: [
      { title: "Platsunderhåll · Matrundan" },
      {
        name: "description",
        content: "Intern granskning av neutrala förbättringskandidater för matställen.",
      },
    ],
  }),
  component: PlaceMaintenancePage,
});

type QueueMode = "open" | "needs_osm" | "closed";
type AccessState = "loading" | "allowed" | "denied";

const QUEUE_LABEL: Record<QueueMode, string> = {
  open: "Att kontrollera",
  needs_osm: "OSM-åtgärd",
  closed: "Avslutade",
};

const STATUS_LABEL: Record<PlaceMaintenanceCandidate["status"], string> = {
  open: "Att kontrollera",
  needs_osm: "Behöver OSM-åtgärd",
  resolved: "Löst",
  dismissed: "Avfärdat",
};

const DEMO_CANDIDATES: PlaceMaintenanceCandidate[] = [
  {
    candidateId: "10000000-0000-4000-8000-000000000001",
    placeId: "20000000-0000-4000-8000-000000000001",
    reason: "unmatched_verified_manual",
    status: "open",
    createdAt: "2026-08-08T08:20:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Bistro Malma Kvarn",
    category: "restaurang",
    address: "Malma Kvarnväg 10",
    area: "Värmdö",
    city: "Stavsnäs",
    lat: 59.3092,
    lng: 18.6841,
    website: "https://example.com",
    activeSource: null,
  },
  {
    candidateId: "10000000-0000-4000-8000-000000000002",
    placeId: "20000000-0000-4000-8000-000000000002",
    reason: "unmatched_verified_manual",
    status: "open",
    createdAt: "2026-08-07T15:45:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Skärgårdsfiket",
    category: "café",
    address: "Hamnvägen 4",
    area: null,
    city: "Djurö",
    lat: 59.3074,
    lng: 18.7087,
    website: null,
    activeSource: null,
  },
  {
    candidateId: "10000000-0000-4000-8000-000000000003",
    placeId: "20000000-0000-4000-8000-000000000003",
    reason: "unmatched_verified_manual",
    status: "needs_osm",
    createdAt: "2026-08-06T11:10:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Bryggans Bageri",
    category: "bageri",
    address: "Skärgårdsvägen 21",
    area: null,
    city: "Djurhamn",
    lat: 59.3062,
    lng: 18.6968,
    website: null,
    activeSource: null,
  },
  {
    candidateId: "10000000-0000-4000-8000-000000000004",
    placeId: "20000000-0000-4000-8000-000000000004",
    reason: "unmatched_verified_manual",
    status: "resolved",
    createdAt: "2026-08-04T12:00:00.000Z",
    resolvedAt: "2026-08-05T09:30:00.000Z",
    dismissalReason: null,
    name: "Kajkanten",
    category: "restaurang",
    address: "Strandvägen 2",
    area: null,
    city: "Stavsnäs",
    lat: 59.2868,
    lng: 18.6892,
    website: null,
    activeSource: { provider: "openstreetmap", providerPlaceId: "node:123456" },
  },
  {
    candidateId: "10000000-0000-4000-8000-000000000005",
    placeId: "20000000-0000-4000-8000-000000000005",
    reason: "unmatched_verified_manual",
    status: "dismissed",
    createdAt: "2026-08-03T10:15:00.000Z",
    resolvedAt: "2026-08-04T08:00:00.000Z",
    dismissalReason: "not_food_place",
    name: "Hamnboden",
    category: "café",
    address: "Hamnplan 1",
    area: null,
    city: "Stavsnäs",
    lat: 59.2892,
    lng: 18.6927,
    website: null,
    activeSource: null,
  },
];

const DEMO_MATCHES: Record<string, PlaceMaintenanceProviderMatch[]> = {
  "10000000-0000-4000-8000-000000000001": [
    {
      providerPlaceId: "demo-geoapify-bistro-malma-kvarn",
      name: "Bistro Malma Kvarn & Krog",
      category: "restaurang",
      address: "Malma Kvarnväg 10",
      area: "Värmdö",
      city: "Stavsnäs",
      lat: 59.30922,
      lng: 18.68408,
      distanceKm: 0.003,
      website: "https://example.com",
      externalUrl: null,
      attribution: "Fiktiv demodata",
    },
  ],
  "10000000-0000-4000-8000-000000000003": [
    {
      providerPlaceId: "demo-geoapify-bryggans-bageri",
      name: "Bryggans Bageri",
      category: "bageri",
      address: "Skärgårdsvägen 21",
      area: null,
      city: "Djurhamn",
      lat: 59.30621,
      lng: 18.69682,
      distanceKm: 0.002,
      website: null,
      externalUrl: null,
      attribution: "Fiktiv demodata",
    },
  ],
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function queueIncludes(mode: QueueMode, candidate: PlaceMaintenanceCandidate) {
  if (mode === "open") return candidate.status === "open";
  if (mode === "needs_osm") return candidate.status === "needs_osm";
  return candidate.status === "resolved" || candidate.status === "dismissed";
}

function candidateLocation(candidate: PlaceMaintenanceCandidate) {
  return [candidate.address, candidate.area, candidate.city].filter(Boolean).join(" · ");
}

function osmMapUrl(candidate: PlaceMaintenanceCandidate) {
  const lat = candidate.lat.toFixed(6);
  const lng = candidate.lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

function PlaceMaintenancePage() {
  const { mode } = useSession();
  const demo = mode === "demo";
  const [access, setAccess] = React.useState<AccessState>(demo ? "allowed" : "loading");
  const [candidates, setCandidates] = React.useState<PlaceMaintenanceCandidate[]>(
    demo ? DEMO_CANDIDATES : [],
  );
  const [loading, setLoading] = React.useState(!demo);
  const [queue, setQueue] = React.useState<QueueMode>("open");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    demo ? DEMO_CANDIDATES[0]?.candidateId ?? null : null,
  );
  const [providerMatches, setProviderMatches] = React.useState<PlaceMaintenanceProviderMatch[]>([]);
  const [providerLoading, setProviderLoading] = React.useState(false);
  const [linkMatch, setLinkMatch] = React.useState<PlaceMaintenanceProviderMatch | null>(null);
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const [dismissReason, setDismissReason] = React.useState<PlaceMaintenanceDismissalReason>(
    "insufficient_evidence",
  );
  const [actionBusy, setActionBusy] = React.useState(false);

  const loadLive = React.useCallback(async () => {
    setLoading(true);
    try {
      const allowed = await getPlaceMaintenanceAccess();
      if (!allowed) {
        setAccess("denied");
        setCandidates([]);
        return;
      }
      setAccess("allowed");
      const page = await listPlaceMaintenanceCandidates({ limit: 100 });
      setCandidates(page.items);
    } catch {
      setAccess("denied");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (demo) {
      setAccess("allowed");
      setLoading(false);
      return;
    }
    if (mode !== "live") {
      setAccess("denied");
      setLoading(false);
      return;
    }
    void loadLive();
  }, [demo, loadLive, mode]);

  const visible = React.useMemo(
    () => candidates.filter((candidate) => queueIncludes(queue, candidate)),
    [candidates, queue],
  );
  const selected = candidates.find((candidate) => candidate.candidateId === selectedId) ?? null;

  React.useEffect(() => {
    if (selected && queueIncludes(queue, selected)) return;
    setSelectedId(visible[0]?.candidateId ?? null);
    setProviderMatches([]);
  }, [queue, selected, visible]);

  function patchCandidate(
    candidateId: string,
    patch: Partial<PlaceMaintenanceCandidate>,
  ) {
    setCandidates((current) =>
      current.map((candidate) =>
        candidate.candidateId === candidateId ? { ...candidate, ...patch } : candidate,
      ),
    );
  }

  async function refreshAfterAction(candidateId?: string) {
    if (demo) return;
    await loadLive();
    if (candidateId) setSelectedId(candidateId);
  }

  async function searchMatches() {
    if (!selected) return;
    setProviderLoading(true);
    try {
      const matches = demo
        ? (DEMO_MATCHES[selected.candidateId] ?? [])
        : await searchPlaceMaintenanceProviderMatches({ data: { candidateId: selected.candidateId } });
      setProviderMatches(matches);
      if (matches.length === 0) toast.message("Ingen tydlig extern träff hittades nära platsen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte kontrollera extern matchning.");
    } finally {
      setProviderLoading(false);
    }
  }

  async function confirmLink() {
    if (!selected || !linkMatch) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchCandidate(selected.candidateId, {
          status: "resolved",
          resolvedAt: new Date().toISOString(),
          activeSource: { provider: "geoapify", providerPlaceId: linkMatch.providerPlaceId },
        });
      } else {
        await linkPlaceMaintenanceProviderMatch({
          data: {
            candidateId: selected.candidateId,
            providerPlaceId: linkMatch.providerPlaceId,
          },
        });
        await refreshAfterAction(selected.candidateId);
      }
      setProviderMatches([]);
      setLinkMatch(null);
      toast.success("Den externa källan är länkad till samma matställe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte länka den externa källan.");
    } finally {
      setActionBusy(false);
    }
  }

  async function markNeedsOsm() {
    if (!selected) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchCandidate(selected.candidateId, { status: "needs_osm" });
      } else {
        await markPlaceMaintenanceNeedsOsm(selected.candidateId);
        await refreshAfterAction(selected.candidateId);
      }
      setQueue("needs_osm");
      setProviderMatches([]);
      toast.success("Ärendet är markerat för manuell OSM-åtgärd.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera underhållsärendet.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDismiss() {
    if (!selected) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchCandidate(selected.candidateId, {
          status: "dismissed",
          dismissalReason: dismissReason,
          resolvedAt: new Date().toISOString(),
        });
      } else {
        await dismissPlaceMaintenanceCandidate(selected.candidateId, dismissReason);
        await refreshAfterAction(selected.candidateId);
      }
      setDismissOpen(false);
      setQueue("closed");
      setProviderMatches([]);
      toast.success("Underhållsärendet är avfärdat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte avfärda underhållsärendet.");
    } finally {
      setActionBusy(false);
    }
  }

  async function copyPlaceInfo(candidate: PlaceMaintenanceCandidate) {
    const text = [
      candidate.name,
      CATEGORY_LABEL[candidate.category],
      candidateLocation(candidate),
      `${candidate.lat.toFixed(6)}, ${candidate.lng.toFixed(6)}`,
      candidate.website ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Neutral platsinformation kopierad.");
    } catch {
      toast.error("Kunde inte kopiera platsinformationen.");
    }
  }

  if (loading || access === "loading") {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Card className="flex items-center gap-3 rounded-2xl p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Kontrollerar behörighet…
        </Card>
      </div>
    );
  }

  if (access !== "allowed") {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Card className="rounded-2xl border-border/70 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-semibold">Platsunderhåll</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Den här ytan är endast tillgänglig för särskilt behöriga platsunderhållare.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/">Till Matrundan</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const counts: Record<QueueMode, number> = {
    open: candidates.filter((candidate) => candidate.status === "open").length,
    needs_osm: candidates.filter((candidate) => candidate.status === "needs_osm").length,
    closed: candidates.filter(
      (candidate) => candidate.status === "resolved" || candidate.status === "dismissed",
    ).length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pt-2 pb-8">
      <header className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Matrundan
          </Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">Platsunderhåll</h1>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Ställen att kontrollera utan att exponera grupper, medlemskap eller privata anteckningar.
            </p>
          </div>
          {demo ? (
            <Badge variant="outline" className="w-fit shrink-0 rounded-full">
              Fiktiv demodata för utveckling
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Underhållskö">
        {(Object.keys(QUEUE_LABEL) as QueueMode[]).map((item) => (
          <Button
            key={item}
            type="button"
            variant={queue === item ? "default" : "outline"}
            className="min-h-11 w-full justify-between rounded-xl sm:justify-center"
            onClick={() => setQueue(item)}
          >
            <span>{QUEUE_LABEL[item]}</span>
            <Badge
              variant={queue === item ? "secondary" : "outline"}
              className="ml-2 rounded-full px-1.5"
            >
              {counts[item]}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 space-y-2" aria-label={QUEUE_LABEL[queue]}>
          <div className="px-1 text-sm font-medium">Ställen att kontrollera</div>
          {visible.length === 0 ? (
            <Card className="rounded-2xl border-border/70 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">Inget här just nu</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Välj ett annat läge för att se övriga underhållsärenden.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="divide-y divide-border/60 overflow-hidden rounded-2xl border-border/70 p-0">
              {visible.map((candidate) => (
                <button
                  key={candidate.candidateId}
                  type="button"
                  className={`min-h-24 w-full p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    selectedId === candidate.candidateId ? "bg-accent/50" : ""
                  }`}
                  onClick={() => {
                    setSelectedId(candidate.candidateId);
                    setProviderMatches([]);
                  }}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium">{candidate.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {CATEGORY_LABEL[candidate.category]}
                      </div>
                      <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-words">{candidateLocation(candidate)}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                      {STATUS_LABEL[candidate.status]}
                    </Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Skapad {formatDate(candidate.createdAt)}
                  </div>
                </button>
              ))}
            </Card>
          )}
        </section>

        <section className="min-w-0 lg:sticky lg:top-20 lg:self-start" aria-label="Underhållsdetalj">
          {selected ? (
            <Card className="min-w-0 space-y-5 rounded-2xl border-border/70 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-primary">
                      {CATEGORY_LABEL[selected.category]}
                    </div>
                    <h2 className="mt-0.5 break-words font-display text-xl font-semibold">
                      {selected.name}
                    </h2>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {STATUS_LABEL[selected.status]}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-words">{candidateLocation(selected)}</span>
                  </div>
                  {selected.website ? (
                    <a
                      href={selected.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 break-all text-primary hover:underline"
                    >
                      {selected.website}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  ) : null}
                </div>
              </div>

              <PlaceMap
                items={[
                  {
                    id: selected.placeId,
                    name: selected.name,
                    lat: selected.lat,
                    lng: selected.lng,
                    category: selected.category,
                    eyebrow: CATEGORY_LABEL[selected.category],
                    description: candidateLocation(selected),
                  },
                ]}
                selectedId={selected.placeId}
                center={{ lat: selected.lat, lng: selected.lng }}
                className="min-h-[280px]"
                ariaLabel={`Verifierad position för ${selected.name}`}
              />

              {selected.status === "open" || selected.status === "needs_osm" ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={providerLoading || actionBusy}
                      onClick={() => void searchMatches()}
                    >
                      {providerLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : providerMatches.length > 0 ? (
                        <RefreshCw className="h-4 w-4" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      {providerMatches.length > 0 ? "Kontrollera igen" : "Sök extern matchning"}
                    </Button>
                    {selected.status === "open" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={actionBusy}
                        onClick={() => void markNeedsOsm()}
                      >
                        <Wrench className="h-4 w-4" /> Behöver OSM-åtgärd
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 text-muted-foreground"
                      disabled={actionBusy}
                      onClick={() => setDismissOpen(true)}
                    >
                      <XCircle className="h-4 w-4" /> Avfärda
                    </Button>
                  </div>

                  {selected.status === "needs_osm" ? (
                    <Card className="rounded-xl border-border/70 bg-muted/30 p-3">
                      <div className="text-sm font-medium">Manuellt OSM-arbete</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Öppna platsen i OpenStreetMap eller kopiera neutral platsinformation. Matrundan skriver inget till OSM i detta steg.
                      </p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button asChild variant="outline" size="sm" className="min-h-11">
                          <a href={osmMapUrl(selected)} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" /> Öppna OpenStreetMap
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onClick={() => void copyPlaceInfo(selected)}
                        >
                          <Clipboard className="h-4 w-4" /> Kopiera platsinfo
                        </Button>
                      </div>
                    </Card>
                  ) : null}

                  {providerMatches.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Möjliga externa träffar</div>
                      {providerMatches.map((match) => (
                        <Card
                          key={match.providerPlaceId}
                          className="rounded-xl border-border/70 p-3"
                        >
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="break-words text-sm font-medium">{match.name}</div>
                              <div className="mt-0.5 break-words text-xs text-muted-foreground">
                                {[match.address, match.area, match.city].filter(Boolean).join(" · ")}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {match.distanceKm == null
                                  ? "Avstånd saknas"
                                  : `${Math.round(match.distanceKm * 1000)} m från kandidatens position`}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="min-h-11 shrink-0"
                              onClick={() => setLinkMatch(match)}
                            >
                              Länka som samma ställe
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Card className="rounded-xl border-border/70 bg-muted/30 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    {selected.status === "resolved" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <div>
                      <div className="font-medium">{STATUS_LABEL[selected.status]}</div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {selected.status === "dismissed" && selected.dismissalReason
                          ? PLACE_MAINTENANCE_DISMISSAL_LABEL[selected.dismissalReason]
                          : selected.activeSource
                            ? `Aktiv extern källa: ${selected.activeSource.provider}.`
                            : "Ärendet är avslutat."}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/70 p-5 text-sm text-muted-foreground">
              Välj ett ställe i kön för att granska underlaget.
            </Card>
          )}
        </section>
      </div>

      <AlertDialog open={Boolean(linkMatch)} onOpenChange={(open) => !open && setLinkMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Länka som samma ställe?</AlertDialogTitle>
            <AlertDialogDescription>
              Den externa identiteten kopplas till samma kanoniska matställe och ärendet löses. Befintliga besök och grupprelationer påverkas inte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {linkMatch && selected ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
              <div className="font-medium">{selected.name}</div>
              <div className="mt-1 text-muted-foreground">↔ {linkMatch.name}</div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>Avbryt</AlertDialogCancel>
            <AlertDialogAction disabled={actionBusy} onClick={() => void confirmLink()}>
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Länka
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dismissOpen} onOpenChange={(open) => !actionBusy && setDismissOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Avfärda underhållsärende</DialogTitle>
            <DialogDescription>
              Välj en strukturerad orsak. Ingen privat fri text sparas i den globala underhållshistoriken.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={dismissReason}
            onValueChange={(value) => setDismissReason(value as PlaceMaintenanceDismissalReason)}
          >
            <SelectTrigger aria-label="Orsak till avfärdande">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLACE_MAINTENANCE_DISMISSAL_LABEL) as PlaceMaintenanceDismissalReason[]).map(
                (reason) => (
                  <SelectItem key={reason} value={reason}>
                    {PLACE_MAINTENANCE_DISMISSAL_LABEL[reason]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={actionBusy} onClick={() => setDismissOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" variant="destructive" disabled={actionBusy} onClick={() => void confirmDismiss()}>
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Avfärda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
