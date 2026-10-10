import * as React from "react";
import type { PlaceResolution } from "@/lib/matrundan/place-discovery";
import { ArrowLeft, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AddPlaceResultDialogs } from "./AddPlaceResultDialogs";
import { ManualAddPlaceForm, type ManualAddPlaceSnapshot } from "./ManualAddPlaceForm";
import { PlaceDiscovery, type PlaceDiscoverySnapshot } from "./PlaceDiscovery";
import type { SourceMatchResult } from "./SearchResultSections";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { emojiForCategory } from "@/lib/matrundan/add-place-utils";
import {
  completedBulkExternalIds,
  remainingBulkSelections,
  successfulBulkPlaceCount,
  toProviderPlaceBatchInput,
  toggleBulkPlaceSelection,
  type BulkPlaceAddItemResult,
  type BulkPlaceAddResult,
} from "@/lib/matrundan/bulk-place-add";
import {
  hiddenPlaceRecordKey,
  hiddenPlaceSuggestionKey,
  listDemoHiddenPlaceSuggestions,
  listGroupHiddenPlaceSuggestions,
} from "@/lib/matrundan/hidden-place-suggestions";
import {
  linkLiveProviderSourceToManualPlace,
  linkLocalManualSource,
} from "@/lib/matrundan/manual-place-source-links";
import { liveCreateOrLinkProviderPlacesBatch } from "@/lib/matrundan/live-mutations";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

type AddPlaceView = "search" | "fallback";

function comparisonLocation(place?: { address: string; city: string }): string {
  if (!place) return "";
  const addressCity = place.address.split(",").at(-1)?.trim().toLocaleLowerCase("sv-SE");
  return addressCity === place.city.trim().toLocaleLowerCase("sv-SE")
    ? place.address
    : [place.address, place.city].filter(Boolean).join(", ");
}

export function AddPlaceDialogContent({
  open,
  onOpenChange,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}) {
  const { state, addPlace } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const [manualSnapshot, setManualSnapshot] = React.useState<ManualAddPlaceSnapshot | null>(null);
  const [view, setView] = React.useState<AddPlaceView>("search");
  const [mobileSearchExpanded, setMobileSearchExpanded] = React.useState(false);
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [pendingSourceMatch, setPendingSourceMatch] = React.useState<SourceMatchResult | null>(
    null,
  );
  const [addedResultIds, setAddedResultIds] = React.useState<Set<string>>(() => new Set());
  const [selectedResults, setSelectedResults] = React.useState<PlaceSuggestion[]>([]);
  const [discoverySnapshot, setDiscoverySnapshot] = React.useState<PlaceDiscoverySnapshot | null>(
    null,
  );
  const [resolutions, setResolutions] = React.useState<Record<string, PlaceResolution>>({});
  const currentScopeRef = React.useRef({ groupId: activeGroupId, mode });
  currentScopeRef.current = { groupId: activeGroupId, mode };
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [sourceLinkBusy, setSourceLinkBusy] = React.useState(false);
  const searchDialogRef = React.useRef<HTMLDivElement | null>(null);
  const searchScrollTopRef = React.useRef(0);
  const returningToSearchRef = React.useRef(false);

  React.useEffect(() => {
    const removeHiddenSelections = () => {
      const groupId = mode === "live" ? activeGroupId : state.group.id;
      if (!groupId) return;

      void Promise.resolve(
        mode === "live"
          ? listGroupHiddenPlaceSuggestions(groupId)
          : listDemoHiddenPlaceSuggestions(groupId),
      )
        .then((rows) => {
          const hiddenKeys = new Set(rows.map(hiddenPlaceRecordKey));
          setSelectedResults((current) =>
            current.filter((result) => !hiddenKeys.has(hiddenPlaceSuggestionKey(result))),
          );
        })
        .catch((error) => {
          console.warn("[Matrundan] kunde inte rensa dolda bulkval:", error);
        });
    };

    window.addEventListener("matrundan:hidden-place-suggestions-changed", removeHiddenSelections);
    return () =>
      window.removeEventListener(
        "matrundan:hidden-place-suggestions-changed",
        removeHiddenSelections,
      );
  }, [activeGroupId, mode, state.group.id]);

  React.useEffect(() => {
    setPending(null);
    setPendingSourceMatch(null);
    setSelectedResults([]);
    setAddedResultIds(new Set());
    setDiscoverySnapshot(null);
    setResolutions({});
    setManualSnapshot(null);
    setMobileSearchExpanded(false);
  }, [activeGroupId, mode]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && (pending != null || pendingSourceMatch != null)) return;
    if (!nextOpen && !bulkBusy && !sourceLinkBusy) {
      setPending(null);
      setPendingSourceMatch(null);
      setSelectedResults([]);
      setAddedResultIds(new Set());
      setDiscoverySnapshot(null);
      setView("search");
      setMobileSearchExpanded(false);
      searchScrollTopRef.current = 0;
      returningToSearchRef.current = false;
    }
    onOpenChange(nextOpen);
  }

  function rememberSearchPosition() {
    searchScrollTopRef.current = searchDialogRef.current?.scrollTop ?? 0;
    returningToSearchRef.current = true;
  }

  function beginAdd(suggestion: PlaceSuggestion) {
    setMobileSearchExpanded(false);
    rememberSearchPosition();
    setPending(suggestion);
  }

  function beginSourceMatch(match: SourceMatchResult) {
    setMobileSearchExpanded(false);
    rememberSearchPosition();
    setPendingSourceMatch(match);
  }

  function markCompleted(externalIds: string[]) {
    setAddedResultIds((current) => {
      const next = new Set(current);
      externalIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleSingleAdded(externalId: string) {
    markCompleted([externalId]);
    setSelectedResults((current) => current.filter((result) => result.externalId !== externalId));
  }

  async function addDemoResults(items: PlaceSuggestion[]): Promise<BulkPlaceAddResult> {
    const results: BulkPlaceAddItemResult[] = [];

    for (const [index, suggestion] of items.entries()) {
      const existing = state.places.find(
        (place) =>
          place.name.trim().toLocaleLowerCase("sv") ===
            suggestion.name.trim().toLocaleLowerCase("sv") &&
          place.address.trim().toLocaleLowerCase("sv") ===
            suggestion.address.trim().toLocaleLowerCase("sv"),
      );
      try {
        const added = await addPlace({
          name: suggestion.name,
          category: suggestion.category,
          cuisines: suggestion.cuisines ?? [],
          occasions: [],
          address: suggestion.address,
          area: suggestion.area,
          city: suggestion.city,
          lat: suggestion.lat,
          lng: suggestion.lng,
          addedBy: state.currentUserId,
          photo: emojiForCategory(suggestion.category),
          notes: undefined,
          origin: "provider",
        });
        results.push({
          externalId: suggestion.externalId,
          name: suggestion.name,
          status: existing?.collectionStatus === "archived" ? "restored" : "added",
          placeId: added.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kunde inte lägga till stället.";
        results.push({
          externalId: suggestion.externalId,
          name: suggestion.name,
          status: /redan|already|duplicate|unique/i.test(message) ? "existing" : "failed",
          message,
        });
      }
      if (index < items.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1));
      }
    }

    return {
      items: results,
      added: results.filter((item) => item.status === "added").length,
      restored: results.filter((item) => item.status === "restored").length,
      existing: results.filter((item) => item.status === "existing").length,
      failed: results.filter((item) => item.status === "failed").length,
    };
  }

  async function addSelectedResults() {
    if (bulkBusy || selectedResults.length === 0) return;
    setBulkBusy(true);
    const operationScope = currentScopeRef.current;
    try {
      if (mode === "live" && !activeGroupId) throw new Error("Ingen aktiv grupp.");
      const result =
        mode === "live"
          ? await liveCreateOrLinkProviderPlacesBatch(
              activeGroupId!,
              selectedResults.map(toProviderPlaceBatchInput),
            )
          : await addDemoResults(selectedResults);

      if (
        operationScope.groupId !== currentScopeRef.current.groupId ||
        operationScope.mode !== currentScopeRef.current.mode
      )
        return;
      setResolutions((current) => ({
        ...current,
        ...Object.fromEntries(
          result.items
            .filter((item) => item.resolution)
            .map((item) => [item.externalId, item.resolution!]),
        ),
      }));
      const completedIds = completedBulkExternalIds(result);
      markCompleted(completedIds);
      const reviewItem = result.items.find((item) => item.resolution?.status === "review_required");
      setSelectedResults((current) =>
        remainingBulkSelections(current, result).filter(
          (item) =>
            !result.items.some(
              (outcome) => outcome.externalId === item.externalId && outcome.resolution,
            ),
        ),
      );
      if (reviewItem?.resolution) {
        const selected = selectedResults.find((item) => item.externalId === reviewItem.externalId);
        if (selected) {
          const identity = {
            providerPlaceId: selected.externalId,
            providerVersion: reviewItem.resolution.providerVersion ?? "",
            knownPlace: null,
            candidates: reviewItem.resolution.candidates ?? [],
            reviewRequired: true,
            identityConflict: false,
          };
          setPending({ ...selected, ...reviewItem.resolution.provider, identity });
        }
      }

      if (mode === "live" && completedIds.length > 0) {
        window.dispatchEvent(new Event("matrundan:reload"));
      }

      const addedCount = successfulBulkPlaceCount(result);
      if (result.failed > 0) {
        toast.warning(
          `${addedCount} ${addedCount === 1 ? "ställe tillagt" : "ställen tillagda"}. ${result.failed} kunde inte läggas till.`,
          {
            description: reviewItem
              ? "Granska matchningen som öppnats innan du fortsätter."
              : "De misslyckade ställena är fortfarande valda så att du kan försöka igen.",
          },
        );
      } else if (addedCount > 0) {
        toast.success(`${addedCount} ${addedCount === 1 ? "ställe tillagt" : "ställen tillagda"}`, {
          description:
            result.existing > 0
              ? `${result.existing} fanns redan i gruppen. Uppgifter kan kompletteras löpande.`
              : "Uppgifter kan kompletteras löpande i gruppens lista.",
        });
      } else {
        toast.info("De valda ställena finns redan i gruppen.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till ställena.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function confirmSourceLink() {
    if (!pendingSourceMatch || sourceLinkBusy) return;
    const groupId = mode === "live" ? activeGroupId : state.group.id;
    if (!groupId) {
      toast.error("Ingen aktiv grupp.");
      return;
    }

    setSourceLinkBusy(true);
    try {
      if (mode === "live") {
        await linkLiveProviderSourceToManualPlace(
          groupId,
          pendingSourceMatch.place.id,
          pendingSourceMatch.result,
        );
        window.dispatchEvent(new Event("matrundan:reload"));
      } else {
        linkLocalManualSource(
          groupId,
          pendingSourceMatch.place.id,
          pendingSourceMatch.result,
          exampleMode ? "session" : "local",
        );
      }
      markCompleted([pendingSourceMatch.result.externalId]);
      setSelectedResults((current) =>
        current.filter((result) => result.externalId !== pendingSourceMatch.result.externalId),
      );
      toast.success("Den externa källan är länkad", {
        description: `${pendingSourceMatch.place.name} behåller samma historik och gruppuppgifter.`,
      });
      setPendingSourceMatch(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Källan kunde inte länkas.");
    } finally {
      setSourceLinkBusy(false);
    }
  }

  const searchDialogOpen = open && pending == null && pendingSourceMatch == null;

  // Mobile keyboards resize the visual viewport, not necessarily the layout viewport.
  // Only resize the suggestions surface; never collapse or reset the active search.
  React.useLayoutEffect(() => {
    if (!searchDialogOpen || view !== "search") return;
    const viewport = window.visualViewport;
    const update = () => {
      const dialog = searchDialogRef.current;
      if (!dialog) return;
      dialog.style.setProperty(
        "--search-viewport-height",
        `${Math.max(200, viewport?.height ?? window.innerHeight)}px`,
      );
      dialog.style.setProperty("--search-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [searchDialogOpen, view]);

  React.useLayoutEffect(() => {
    if (!searchDialogOpen || !returningToSearchRef.current) return;

    const restore = () => {
      if (searchDialogRef.current) {
        searchDialogRef.current.scrollTop = searchScrollTopRef.current;
      }
    };
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      restore();
      secondFrame = window.requestAnimationFrame(restore);
    });
    const timeout = window.setTimeout(() => {
      restore();
      returningToSearchRef.current = false;
    }, 120);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeout);
    };
  }, [searchDialogOpen]);

  return (
    <>
      <Dialog open={searchDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          ref={searchDialogRef}
          onEscapeKeyDown={(event) => {
            if (mobileSearchExpanded && view === "search") {
              event.preventDefault();
              setMobileSearchExpanded(false);
              document.getElementById("place-query")?.blur();
              return;
            }
            // The first Escape dismisses the suggestions; a second closes the dialog.
            if (
              event.target instanceof Element &&
              event.target.closest('[role="combobox"][aria-expanded="true"]')
            ) {
              event.preventDefault();
            }
          }}
          onOpenAutoFocus={(event) => {
            if (view === "search" && window.matchMedia("(max-width: 1023px)").matches) {
              event.preventDefault();
              searchDialogRef.current?.focus({ preventScroll: true });
              return;
            }
            if (!returningToSearchRef.current) return;
            event.preventDefault();
            searchDialogRef.current?.focus({ preventScroll: true });
          }}
          data-search-mode={mobileSearchExpanded && view === "search" ? "expanded" : "normal"}
          data-search-shell={view === "search" ? "unified" : "fallback"}
          className={[
            "max-h-[94dvh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-5xl",
            view === "search"
              ? "max-lg:top-[calc(var(--search-viewport-top,0px)+0.5rem)] max-lg:h-auto max-lg:max-h-[calc(var(--search-viewport-height,100dvh)-1rem)] max-lg:w-[calc(100vw-1rem)] max-lg:translate-y-0 max-lg:flex max-lg:min-h-0 max-lg:flex-col max-lg:gap-3 max-lg:overflow-hidden max-lg:rounded-2xl max-lg:border max-lg:bg-card max-lg:p-4 max-lg:duration-0"
              : "",
          ].join(" ")}
        >
          <DialogHeader
            className={
              view === "search"
                ? "max-lg:items-start max-lg:gap-0 max-lg:space-y-0 max-lg:pr-9 max-lg:shrink-0 max-lg:text-left"
                : undefined
            }
          >
            <DialogTitle
              className={
                view === "search" ? "font-display text-xl lg:text-2xl" : "font-display text-2xl"
              }
            >
              {view === "search" ? "Lägg till matställe" : "Stället saknas i sökningen"}
            </DialogTitle>
            <DialogDescription className={view === "search" ? "sr-only" : undefined}>
              {view === "search"
                ? "Sök efter ett matställe. Om du inte hittar rätt ställe kan du lägga till det som saknas."
                : "Lägg till ett verkligt matställe som du inte kunde identifiera bland sökträffarna."}
            </DialogDescription>
          </DialogHeader>

          {view === "search" ? (
            <PlaceDiscovery
              initialQuery={initialQuery}
              resolutions={resolutions}
              addedResultIds={addedResultIds}
              selectedResults={selectedResults}
              bulkBusy={bulkBusy || sourceLinkBusy}
              snapshot={discoverySnapshot}
              onSnapshotChange={setDiscoverySnapshot}
              mobileSearchExpanded={mobileSearchExpanded}
              onMobileSearchExpandedChange={setMobileSearchExpanded}
              onToggleSelected={(suggestion) =>
                setSelectedResults((current) => toggleBulkPlaceSelection(current, suggestion))
              }
              onClearSelected={() => setSelectedResults([])}
              onAddSelected={() => void addSelectedResults()}
              onBeginAdd={beginAdd}
              onLinkSource={beginSourceMatch}
              onMissingPlace={() => {
                setMobileSearchExpanded(false);
                setView("fallback");
              }}
              onClose={() => handleOpenChange(false)}
            />
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-fit px-2"
                onClick={() => setView("search")}
              >
                <ArrowLeft className="h-4 w-4" />
                Tillbaka till sök
              </Button>
              <ManualAddPlaceForm
                onClose={() => handleOpenChange(false)}
                onProviderFound={beginAdd}
                snapshot={manualSnapshot}
                onSnapshotChange={setManualSnapshot}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
      <AddPlaceResultDialogs
        parentOpen={open}
        pending={pending}
        onPendingChange={setPending}
        onAdded={handleSingleAdded}
      />
      <AlertDialog
        open={open && pendingSourceMatch != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !sourceLinkBusy) setPendingSourceMatch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Är det samma ställe?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <span className="block">
                Kartträffen <strong>{pendingSourceMatch?.result.name}</strong> verkar motsvara
                <strong> {pendingSourceMatch?.place.name}</strong> som redan finns i gruppen.
              </span>
              <span className="grid gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                <span>
                  <strong>Hittat i kartan:</strong> {comparisonLocation(pendingSourceMatch?.result)}
                </span>
                <span>
                  <strong>Redan i Matrundan:</strong>{" "}
                  {comparisonLocation(pendingSourceMatch?.place)}
                </span>
              </span>
              <span className="block">
                Kartinformationen kompletterar stället. Besök, omdömen och gruppuppgifter ligger
                kvar.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sourceLinkBusy}>Tillbaka</AlertDialogCancel>
            <Button
              className="h-auto min-h-11 whitespace-normal"
              disabled={sourceLinkBusy}
              onClick={() => void confirmSourceLink()}
            >
              {sourceLinkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Ja, använd stället som redan finns
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
