import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
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
  dismissPlaceMaintenanceWorkItem,
  getPlaceMaintenanceAccess,
  listPlaceMaintenanceWorkItems,
  markPlaceMaintenanceWorkItemNeedsOsm,
  PLACE_MAINTENANCE_DISMISSAL_LABEL,
  PLACE_MAINTENANCE_ISSUE_LABEL,
  PLACE_MAINTENANCE_KIND_LABEL,
  resolvePlaceMaintenanceWorkItem,
  type PlaceMaintenanceDismissalReason,
  type PlaceMaintenanceWorkItem,
} from "@/lib/matrundan/place-maintenance";
import { useSession } from "@/lib/matrundan/session";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

export const Route = createFileRoute("/platsunderhall")({
  head: () => ({
    meta: [
      { title: "Platsunderhåll · Matrundan" },
      {
        name: "description",
        content: "Intern global arbetsyta för granskning och underhåll av Matrundans platsdata.",
      },
    ],
  }),
  component: PlaceMaintenancePage,
});

type QueueMode = "inbox" | "osm" | "closed";
type OriginFilter = "all" | "reported" | "manual";
type AccessState = "loading" | "allowed" | "denied";

const QUEUE_LABEL: Record<QueueMode, string> = {
  inbox: "Att hantera",
  osm: "OSM-arbete",
  closed: "Avslutade",
};

const ORIGIN_LABEL: Record<OriginFilter, string> = {
  all: "Alla",
  reported: "Användarrapporter",
  manual: "Manuellt tillagda",
};

const STATUS_LABEL: Record<PlaceMaintenanceWorkItem["status"], string> = {
  open: "Att hantera",
  needs_osm: "OSM-arbete",
  resolved: "Löst",
  dismissed: "Avfärdat",
};

const DEMO_ITEMS: PlaceMaintenanceWorkItem[] = [
  {
    workItemId: "10000000-0000-4000-8000-000000000001",
    kind: "reported_error",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000001",
    issueCategory: "wrong_website",
    status: "open",
    createdAt: "2026-08-08T10:15:00.000Z",
    updatedAt: "2026-08-08T10:15:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Kajkanten",
    category: "restaurang",
    address: "Strandvägen 2",
    area: null,
    city: "Stavsnäs",
    lat: 59.2868,
    lng: 18.6892,
    website: "https://example.com/gammal",
    activeSource: { provider: "openstreetmap", providerPlaceId: "node:123456" },
    externalReference: null,
    osmNote: null,
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000002",
    kind: "improvement_candidate",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000002",
    issueCategory: "unmatched_verified_manual",
    status: "open",
    createdAt: "2026-08-08T08:20:00.000Z",
    updatedAt: "2026-08-08T08:20:00.000Z",
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
    externalReference: null,
    osmNote: null,
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000003",
    kind: "reported_error",
    targetKind: "provider_suggestion",
    placeId: null,
    issueCategory: "wrong_address",
    status: "open",
    createdAt: "2026-08-07T15:45:00.000Z",
    updatedAt: "2026-08-07T15:45:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Skärgårdsfiket",
    category: null,
    address: "Hamnvägen 4",
    area: null,
    city: "Djurö",
    lat: 59.3074,
    lng: 18.7087,
    website: null,
    activeSource: null,
    externalReference: { provider: "geoapify", providerPlaceId: "demo-skargardsfiket" },
    osmNote: null,
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000004",
    kind: "reported_error",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000004",
    issueCategory: "missing_in_osm",
    status: "needs_osm",
    createdAt: "2026-08-06T11:10:00.000Z",
    updatedAt: "2026-08-07T09:10:00.000Z",
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
    activeSource: { provider: "geoapify", providerPlaceId: "demo-bryggan" },
    externalReference: null,
    osmNote: {
      submissionState: "published",
      url: "https://www.openstreetmap.org/note/123456",
      status: "open",
    },
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000005",
    kind: "improvement_candidate",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000005",
    issueCategory: "unmatched_verified_manual",
    status: "resolved",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-05T09:30:00.000Z",
    resolvedAt: "2026-08-05T09:30:00.000Z",
    dismissalReason: null,
    name: "Hamnkrogen",
    category: "restaurang",
    address: "Hamnplan 2",
    area: null,
    city: "Stavsnäs",
    lat: 59.2892,
    lng: 18.6927,
    website: null,
    activeSource: { provider: "openstreetmap", providerPlaceId: "node:654321" },
    externalReference: null,
    osmNote: null,
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000006",
    kind: "reported_error",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000006",
    issueCategory: "duplicate",
    status: "dismissed",
    createdAt: "2026-08-03T10:15:00.000Z",
    updatedAt: "2026-08-04T08:00:00.000Z",
    resolvedAt: "2026-08-04T08:00:00.000Z",
    dismissalReason: "not_relevant",
    name: "Hamnboden",
    category: "café",
    address: "Hamnplan 1",
    area: null,
    city: "Stavsnäs",
    lat: 59.289,
    lng: 18.6924,
    website: null,
    activeSource: null,
    externalReference: null,
    osmNote: null,
  },
  {
    workItemId: "10000000-0000-4000-8000-000000000007",
    kind: "improvement_candidate",
    targetKind: "canonical_place",
    placeId: "20000000-0000-4000-8000-000000000007",
    issueCategory: "unmatched_verified_manual",
    status: "needs_osm",
    createdAt: "2026-08-06T08:10:00.000Z",
    updatedAt: "2026-08-08T07:20:00.000Z",
    resolvedAt: null,
    dismissalReason: null,
    name: "Sjöstugan",
    category: "café",
    address: "Bryggvägen 7",
    area: null,
    city: "Djurö",
    lat: 59.3058,
    lng: 18.7042,
    website: null,
    activeSource: null,
    externalReference: null,
    osmNote: null,
  },
];

const DEMO_MATCHES: Record<string, PlaceMaintenanceProviderMatch[]> = {
  "10000000-0000-4000-8000-000000000002": [
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

function queueIncludes(mode: QueueMode, item: PlaceMaintenanceWorkItem) {
  if (mode === "inbox") return item.status === "open";
  if (mode === "osm") return item.status === "needs_osm";
  return item.status === "resolved" || item.status === "dismissed";
}

function originIncludes(filter: OriginFilter, item: PlaceMaintenanceWorkItem) {
  if (filter === "all") return true;
  if (filter === "reported") return item.kind === "reported_error";
  return item.kind === "improvement_candidate";
}

function itemLocation(item: PlaceMaintenanceWorkItem) {
  return [item.address, item.area, item.city].filter(Boolean).join(" · ");
}

function osmMapUrl(item: PlaceMaintenanceWorkItem) {
  if (item.lat == null || item.lng == null) return null;
  const lat = item.lat.toFixed(6);
  const lng = item.lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

function PlaceMaintenancePage() {
  const { mode } = useSession();
  const demo = mode === "demo";
  const [access, setAccess] = React.useState<AccessState>(demo ? "allowed" : "loading");
  const [items, setItems] = React.useState<PlaceMaintenanceWorkItem[]>(demo ? DEMO_ITEMS : []);
  const [loading, setLoading] = React.useState(!demo);
  const [queue, setQueue] = React.useState<QueueMode>("inbox");
  const [originFilter, setOriginFilter] = React.useState<OriginFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    demo ? (DEMO_ITEMS[0]?.workItemId ?? null) : null,
  );
  const [providerMatches, setProviderMatches] = React.useState<PlaceMaintenanceProviderMatch[]>([]);
  const [providerLoading, setProviderLoading] = React.useState(false);
  const [linkMatch, setLinkMatch] = React.useState<PlaceMaintenanceProviderMatch | null>(null);
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const [dismissReason, setDismissReason] =
    React.useState<PlaceMaintenanceDismissalReason>("insufficient_evidence");
  const [actionBusy, setActionBusy] = React.useState(false);

  const loadLive = React.useCallback(async () => {
    setLoading(true);
    try {
      const allowed = await getPlaceMaintenanceAccess();
      if (!allowed) {
        setAccess("denied");
        setItems([]);
        return;
      }
      setAccess("allowed");
      const page = await listPlaceMaintenanceWorkItems({ limit: 100 });
      setItems(page.items);
    } catch {
      setAccess("denied");
      setItems([]);
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
    () =>
      items.filter((item) => queueIncludes(queue, item) && originIncludes(originFilter, item)),
    [items, originFilter, queue],
  );
  const selected = items.find((item) => item.workItemId === selectedId) ?? null;

  React.useEffect(() => {
    if (selected && queueIncludes(queue, selected) && originIncludes(originFilter, selected)) return;
    setSelectedId(visible[0]?.workItemId ?? null);
    setProviderMatches([]);
  }, [originFilter, queue, selected, visible]);

  function patchItem(workItemId: string, patch: Partial<PlaceMaintenanceWorkItem>) {
    setItems((current) =>
      current.map((item) => (item.workItemId === workItemId ? { ...item, ...patch } : item)),
    );
  }

  async function refreshAfterAction(workItemId?: string) {
    if (demo) return;
    await loadLive();
    if (workItemId) setSelectedId(workItemId);
  }

  async function searchMatches() {
    if (!selected || selected.kind !== "improvement_candidate") return;
    setProviderLoading(true);
    try {
      const matches = demo
        ? (DEMO_MATCHES[selected.workItemId] ?? [])
        : await searchPlaceMaintenanceProviderMatches({
            data: { kind: selected.kind, workItemId: selected.workItemId },
          });
      setProviderMatches(matches);
      if (matches.length === 0) toast.message("Ingen tydlig kartträff hittades nära platsen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte söka efter kartträffar.");
    } finally {
      setProviderLoading(false);
    }
  }

  async function confirmLink() {
    if (!selected || selected.kind !== "improvement_candidate" || !linkMatch) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchItem(selected.workItemId, {
          status: "resolved",
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeSource: { provider: "geoapify", providerPlaceId: linkMatch.providerPlaceId },
        });
      } else {
        await linkPlaceMaintenanceProviderMatch({
          data: {
            kind: selected.kind,
            workItemId: selected.workItemId,
            providerPlaceId: linkMatch.providerPlaceId,
          },
        });
        await refreshAfterAction(selected.workItemId);
      }
      setProviderMatches([]);
      setLinkMatch(null);
      setQueue("closed");
      toast.success("Kartträffen är kopplad till matstället.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte koppla kartträffen.");
    } finally {
      setActionBusy(false);
    }
  }

  async function markNeedsOsm() {
    if (!selected) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchItem(selected.workItemId, {
          status: "needs_osm",
          updatedAt: new Date().toISOString(),
        });
      } else {
        await markPlaceMaintenanceWorkItemNeedsOsm(selected.kind, selected.workItemId);
        await refreshAfterAction(selected.workItemId);
      }
      setQueue("osm");
      setProviderMatches([]);
      toast.success("Ärendet är markerat för OSM-arbete.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera underhållsärendet.");
    } finally {
      setActionBusy(false);
    }
  }

  async function resolveReport() {
    if (!selected || selected.kind !== "reported_error") return;
    setActionBusy(true);
    try {
      if (demo) {
        patchItem(selected.workItemId, {
          status: "resolved",
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await resolvePlaceMaintenanceWorkItem(selected.kind, selected.workItemId);
        await refreshAfterAction(selected.workItemId);
      }
      setQueue("closed");
      setProviderMatches([]);
      toast.success("Rapporten är markerad som löst.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte markera rapporten som löst.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDismiss() {
    if (!selected) return;
    setActionBusy(true);
    try {
      if (demo) {
        patchItem(selected.workItemId, {
          status: "dismissed",
          dismissalReason: dismissReason,
          resolvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await dismissPlaceMaintenanceWorkItem(selected.kind, selected.workItemId, dismissReason);
        await refreshAfterAction(selected.workItemId);
      }
      setDismissOpen(false);
      setQueue("closed");
      setProviderMatches([]);
      toast.success(selected.kind === "reported_error" ? "Rapporten är avfärdad." : "Ärendet är avfärdat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte avfärda underhållsärendet.");
    } finally {
      setActionBusy(false);
    }
  }

  async function copyPlaceInfo(item: PlaceMaintenanceWorkItem) {
    const text = [
      item.name,
      item.category ? CATEGORY_LABEL[item.category] : "Rapporterad kartträff",
      PLACE_MAINTENANCE_ISSUE_LABEL[item.issueCategory],
      itemLocation(item),
      item.lat != null && item.lng != null ? `${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}` : "",
      item.website ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Platsinformationen är kopierad.");
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

  const counts = Object.fromEntries(
    (Object.keys(QUEUE_LABEL) as QueueMode[]).map((modeKey) => [
      modeKey,
      items.filter((item) => queueIncludes(modeKey, item)).length,
    ]),
  ) as Record<QueueMode, number>;

  const selectedOsmUrl = selected ? osmMapUrl(selected) : null;
  const selectedIsReport = selected?.kind === "reported_error";

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
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Granska platser där kartdatan behöver kontrolleras. Koppla befintliga kartträffar,
              hantera ändringar i OpenStreetMap eller avsluta ärenden som inte kräver mer arbete.
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              Här visas bara neutral platsdata – aldrig gruppnamn, medlemmar eller privata kommentarer.
            </p>
          </div>
          {demo ? (
            <Badge variant="outline" className="w-fit shrink-0 rounded-full">
              Fiktiv demodata för utveckling
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2" aria-label="Arbetsstatus">
        {(Object.keys(QUEUE_LABEL) as QueueMode[]).map((item) => (
          <Button
            key={item}
            type="button"
            variant={queue === item ? "default" : "outline"}
            className="min-h-11 w-full justify-between rounded-xl px-3 sm:justify-center"
            onClick={() => setQueue(item)}
          >
            <span className="min-w-0 truncate">{QUEUE_LABEL[item]}</span>
            <Badge
              variant={queue === item ? "secondary" : "outline"}
              className="ml-2 shrink-0 rounded-full px-1.5"
            >
              {counts[item]}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Filtrera efter ursprung">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Visa</span>
        {(Object.keys(ORIGIN_LABEL) as OriginFilter[]).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={originFilter === item ? "secondary" : "ghost"}
            className="min-h-9 rounded-full px-3"
            onClick={() => setOriginFilter(item)}
          >
            {ORIGIN_LABEL[item]}
          </Button>
        ))}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 space-y-2" aria-label={QUEUE_LABEL[queue]}>
          <div className="px-1 text-sm font-medium">{QUEUE_LABEL[queue]}</div>
          {visible.length === 0 ? (
            <Card className="rounded-2xl border-border/70 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">Inget här just nu</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Byt arbetsstatus eller filter för att se övriga underhållsärenden.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="divide-y divide-border/60 overflow-hidden rounded-2xl border-border/70 p-0">
              {visible.map((item) => (
                <button
                  key={`${item.kind}:${item.workItemId}`}
                  type="button"
                  className={`min-h-24 w-full p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                    selectedId === item.workItemId ? "bg-accent/50" : ""
                  }`}
                  onClick={() => {
                    setSelectedId(item.workItemId);
                    setProviderMatches([]);
                  }}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="break-words text-sm font-medium">{item.name}</span>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {PLACE_MAINTENANCE_ISSUE_LABEL[item.issueCategory]}
                      </div>
                      <div className="mt-1 flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-words">
                          {itemLocation(item) || "Platsadress saknas"}
                        </span>
                      </div>
                    </div>
                    {queue === "closed" ? (
                      <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {PLACE_MAINTENANCE_KIND_LABEL[item.kind]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      Uppdaterad {formatDate(item.updatedAt)}
                    </span>
                  </div>
                </button>
              ))}
            </Card>
          )}
        </section>

        <section
          className="min-w-0 lg:sticky lg:top-20 lg:self-start"
          aria-label="Underhållsdetalj"
        >
          {selected ? (
            <Card className="min-w-0 space-y-5 rounded-2xl border-border/70 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedIsReport ? (
                        <CircleAlert className="h-4 w-4 text-primary" />
                      ) : (
                        <Wrench className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-xs font-medium text-primary">
                        {PLACE_MAINTENANCE_KIND_LABEL[selected.kind]}
                      </span>
                    </div>
                    <h2 className="mt-1 break-words font-display text-xl font-semibold">
                      {selected.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {PLACE_MAINTENANCE_ISSUE_LABEL[selected.issueCategory]}
                    </p>
                  </div>
                  {queue === "closed" ? (
                    <Badge variant="outline" className="rounded-full">
                      {STATUS_LABEL[selected.status]}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {selected.category ? <div>{CATEGORY_LABEL[selected.category]}</div> : null}
                  <div className="flex min-w-0 items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-words">
                      {itemLocation(selected) || "Platsadress saknas"}
                    </span>
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

              {selected.lat != null && selected.lng != null ? (
                <PlaceMap
                  items={[
                    {
                      id: selected.placeId ?? selected.workItemId,
                      name: selected.name,
                      lat: selected.lat,
                      lng: selected.lng,
                      category: selected.category ?? undefined,
                      eyebrow: selected.category
                        ? CATEGORY_LABEL[selected.category]
                        : "Rapporterad kartträff",
                      description: itemLocation(selected),
                    },
                  ]}
                  selectedId={selected.placeId ?? selected.workItemId}
                  center={{ lat: selected.lat, lng: selected.lng }}
                  className="min-h-[280px]"
                  ariaLabel={`Position för ${selected.name}`}
                />
              ) : (
                <Card className="rounded-xl border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                  Kartposition saknas i underlaget.
                </Card>
              )}

              {selected.osmNote?.url ? (
                <Card className="rounded-xl border-border/70 bg-muted/30 p-3">
                  <div className="text-sm font-medium">Befintlig offentlig OSM-not</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tidigare offentlig OSM-historik finns kvar. Ingen privat gruppinformation visas här.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 min-h-11">
                    <a href={selected.osmNote.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Öppna OSM-not
                    </a>
                  </Button>
                </Card>
              ) : null}

              {selected.status === "open" ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">Vad behöver göras?</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Kontrollera underlaget och välj nästa steg för platsen.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {selected.kind === "improvement_candidate" ? (
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
                        {providerMatches.length > 0 ? "Sök igen" : "Sök efter kartträff"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={actionBusy}
                      onClick={() => void markNeedsOsm()}
                    >
                      <Wrench className="h-4 w-4" /> Markera för OSM-arbete
                    </Button>
                    {selectedIsReport ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={actionBusy}
                        onClick={() => void resolveReport()}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Markera som löst
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 text-muted-foreground"
                      disabled={actionBusy}
                      onClick={() => setDismissOpen(true)}
                    >
                      <XCircle className="h-4 w-4" />
                      {selectedIsReport ? "Avfärda rapporten" : "Avfärda ärendet"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {selected.status === "needs_osm" ? (
                <div className="space-y-3">
                  <Card className="rounded-xl border-border/70 bg-muted/30 p-3">
                    <div className="text-sm font-medium">OSM-arbete</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {selectedIsReport
                        ? "Rätta uppgiften i OpenStreetMap eller Every Door. När ändringen är hanterad kan rapporten markeras som löst."
                        : "Kontrollera om stället finns i OpenStreetMap och lägg till eller rätta det vid behov. När det finns som en tydlig kartträff, sök igen och koppla den till Matrundan."}
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {selectedOsmUrl ? (
                        <Button asChild variant="outline" size="sm" className="min-h-11">
                          <a href={selectedOsmUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" /> Öppna OpenStreetMap
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        onClick={() => void copyPlaceInfo(selected)}
                      >
                        <Clipboard className="h-4 w-4" /> Kopiera platsinfo
                      </Button>
                      {selected.kind === "improvement_candidate" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          disabled={providerLoading || actionBusy}
                          onClick={() => void searchMatches()}
                        >
                          {providerLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          Sök efter kartträff igen
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          disabled={actionBusy}
                          onClick={() => void resolveReport()}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Markera som löst
                        </Button>
                      )}
                    </div>
                  </Card>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 text-muted-foreground"
                    disabled={actionBusy}
                    onClick={() => setDismissOpen(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    {selectedIsReport ? "Avfärda rapporten" : "Avfärda ärendet"}
                  </Button>
                </div>
              ) : null}

              {providerMatches.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Möjliga kartträffar</div>
                  {providerMatches.map((match) => (
                    <Card key={match.providerPlaceId} className="rounded-xl border-border/70 p-3">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="break-words text-sm font-medium">{match.name}</div>
                          <div className="mt-0.5 break-words text-xs text-muted-foreground">
                            {[match.address, match.area, match.city].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {match.distanceKm == null
                              ? "Avstånd saknas"
                              : `${Math.round(match.distanceKm * 1000)} m från platsens position`}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11 shrink-0"
                          onClick={() => setLinkMatch(match)}
                        >
                          Koppla till stället
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : null}

              {selected.status === "resolved" || selected.status === "dismissed" ? (
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
                            ? "En kartkälla är kopplad och ärendet är avslutat."
                            : "Ärendet är markerat som löst."}
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}
            </Card>
          ) : (
            <Card className="rounded-2xl border-border/70 p-5 text-sm text-muted-foreground">
              Välj ett ärende i kön för att granska underlaget.
            </Card>
          )}
        </section>
      </div>

      <AlertDialog open={Boolean(linkMatch)} onOpenChange={(open) => !open && setLinkMatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Koppla kartträffen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected && linkMatch
                ? `Bekräfta att ${selected.name} och ${linkMatch.name} är samma ställe. Kartkällan kopplas till Matrundans ställe. Besök och gruppdata påverkas inte.`
                : "Kartkällan kopplas till Matrundans ställe. Besök och gruppdata påverkas inte."}
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
              Koppla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dismissOpen} onOpenChange={(open) => !actionBusy && setDismissOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedIsReport ? "Avfärda rapporten" : "Avfärda ärendet"}</DialogTitle>
            <DialogDescription>
              Välj varför ärendet inte behöver mer arbete. Privat rapporttext kopieras inte till den
              globala underhållshistoriken.
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
              {(
                Object.keys(PLACE_MAINTENANCE_DISMISSAL_LABEL) as PlaceMaintenanceDismissalReason[]
              ).map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {PLACE_MAINTENANCE_DISMISSAL_LABEL[reason]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={actionBusy}
              onClick={() => setDismissOpen(false)}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={actionBusy}
              onClick={() => void confirmDismiss()}
            >
              {actionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {selectedIsReport ? "Avfärda rapporten" : "Avfärda ärendet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
