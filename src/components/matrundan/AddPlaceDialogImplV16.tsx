import * as React from "react";
import { Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AddPlaceResultDialogsV16 } from "./AddPlaceResultDialogsV16";
import { ManualAddPlaceFormV16 } from "./ManualAddPlaceFormV16";
import { PlaceDiscoveryV16 } from "./PlaceDiscoveryV16";
import type { SourceMatchResult } from "./SearchResultSectionsV16";
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
import { emojiForCategory } from "@/lib/matrundan/add-place-v16-utils";
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

type Tab = "sok" | "manuell";

export function AddPlaceDialogV16({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, addPlace } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const [tab, setTab] = React.useState<Tab>("sok");
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [pendingSourceMatch, setPendingSourceMatch] = React.useState<SourceMatchResult | null>(
    null,
  );
  const [addedResultIds, setAddedResultIds] = React.useState<Set<string>>(() => new Set());
  const [selectedResults, setSelectedResults] = React.useState<PlaceSuggestion[]>([]);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [sourceLinkBusy, setSourceLinkBusy] = React.useState(false);

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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !bulkBusy && !sourceLinkBusy) {
      setPending(null);
      setPendingSourceMatch(null);
      setSelectedResults([]);
      setAddedResultIds(new Set());
    }
    onOpenChange(nextOpen);
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
    try {
      if (mode === "live" && !activeGroupId) throw new Error("Ingen aktiv grupp.");
      const result =
        mode === "live"
          ? await liveCreateOrLinkProviderPlacesBatch(
              activeGroupId!,
              selectedResults.map(toProviderPlaceBatchInput),
            )
          : await addDemoResults(selectedResults);

      const completedIds = completedBulkExternalIds(result);
      markCompleted(completedIds);
      setSelectedResults((current) => remainingBulkSelections(current, result));

      if (mode === "live" && completedIds.length > 0) {
        window.dispatchEvent(new Event("matrundan:reload"));
      }

      const addedCount = successfulBulkPlaceCount(result);
      if (result.failed > 0) {
        toast.warning(
          `${addedCount} ${addedCount === 1 ? "ställe tillagt" : "ställen tillagda"}. ${result.failed} kunde inte läggas till.`,
          {
            description: "De misslyckade ställena är fortfarande valda så att du kan försöka igen.",
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

  return (
    <>
      <Dialog
        open={open && pending == null && pendingSourceMatch == null}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Lägg till matställe</DialogTitle>
            <DialogDescription className="sr-only">
              Sök efter ett matställe eller lägg till ett manuellt.
            </DialogDescription>
          </DialogHeader>
          <TabToggle value={tab} onChange={setTab} />
          {tab === "sok" ? (
            <PlaceDiscoveryV16
              addedResultIds={addedResultIds}
              selectedResults={selectedResults}
              bulkBusy={bulkBusy || sourceLinkBusy}
              onToggleSelected={(suggestion) =>
                setSelectedResults((current) => toggleBulkPlaceSelection(current, suggestion))
              }
              onClearSelected={() => setSelectedResults([])}
              onAddSelected={() => void addSelectedResults()}
              onBeginAdd={setPending}
              onLinkSource={setPendingSourceMatch}
              onClose={() => handleOpenChange(false)}
            />
          ) : (
            <ManualAddPlaceFormV16 onClose={() => handleOpenChange(false)} />
          )}
        </DialogContent>
      </Dialog>
      <AddPlaceResultDialogsV16
        parentOpen={open}
        pending={pending}
        onPendingChange={setPending}
        onAdded={handleSingleAdded}
      />
      <AlertDialog
        open={pendingSourceMatch != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !sourceLinkBusy) setPendingSourceMatch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Länka till befintligt matställe?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-left">
              <span className="block">
                Sökträffen <strong>{pendingSourceMatch?.result.name}</strong> verkar motsvara
                gruppens manuella ställe <strong>{pendingSourceMatch?.place.name}</strong>.
              </span>
              <span className="grid gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                <span>
                  <strong>Sökträff:</strong>{" "}
                  {[pendingSourceMatch?.result.address, pendingSourceMatch?.result.city]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                <span>
                  <strong>I gruppen:</strong>{" "}
                  {[pendingSourceMatch?.place.address, pendingSourceMatch?.place.city]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
              <span className="block">
                Bara den externa källidentiteten länkas. Det befintliga plats-ID:t, besök, omdömen
                och privata gruppuppgifter bevaras. Åtgärden slår inte ihop två redan etablerade
                matställen.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sourceLinkBusy}>Avbryt</AlertDialogCancel>
            <Button disabled={sourceLinkBusy} onClick={() => void confirmSourceLink()}>
              {sourceLinkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Länka källa
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TabToggle({ value, onChange }: { value: Tab; onChange: (value: Tab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {(["sok", "manuell"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`min-h-11 rounded-full px-2 text-sm font-medium ${
            value === tab ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
        >
          {tab === "sok" ? "Sök" : "Lägg till manuellt"}
        </button>
      ))}
    </div>
  );
}
