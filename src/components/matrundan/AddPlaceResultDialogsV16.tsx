import * as React from "react";
import { ArrowLeft, ExternalLink, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { OccasionPicker } from "./OccasionPicker";
import { PlaceSuggestionReportDialog } from "./PlaceSuggestionReportDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { emojiForCategory, safeParse } from "@/lib/matrundan/add-place-v16-utils";
import {
  hideDemoPlaceSuggestion,
  hideGroupPlaceSuggestion,
} from "@/lib/matrundan/hidden-place-suggestions";
import {
  listOwnVisitsForPlaceOnAdd,
  shareVisitToGroup,
  type OwnVisitForPlace,
} from "@/lib/matrundan/live-sharing";
import {
  reportableSuggestionFromPlaceSuggestion,
  type ReportablePlaceSuggestion,
} from "@/lib/matrundan/place-data-reports";
import { googleMapsSearchUrl, normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";
import { useSession } from "@/lib/matrundan/session";
import {
  availableOwnVisits,
  formatMealType,
  formatOwnVisitDate,
  toggleAllSelection,
} from "@/lib/matrundan/sharing-selection";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type Occasion } from "@/lib/matrundan/types";

function suggestionWebsite(suggestion: PlaceSuggestion): string | undefined {
  return normalizeWebsiteUrl(
    (suggestion as PlaceSuggestion & { website?: string | null }).website,
  );
}

export function AddPlaceResultDialogsV16({
  parentOpen,
  pending,
  onPendingChange,
  onAdded,
}: {
  parentOpen: boolean;
  pending: PlaceSuggestion | null;
  onPendingChange: (pending: PlaceSuggestion | null) => void;
  onAdded: (externalId: string) => void;
}) {
  const { state, addPlace, addProviderPlace, submitting } = useStore();
  const { mode, activeGroupId, activeGroupRole } = useSession();
  const isLive = mode === "live";
  const canHideSuggestion =
    mode === "demo" || activeGroupRole === "owner" || activeGroupRole === "admin";
  const [cuisines, setCuisines] = React.useState<string[]>([]);
  const [occasions, setOccasions] = React.useState<Occasion[]>([]);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [hideBusy, setHideBusy] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [syncPlaceName, setSyncPlaceName] = React.useState("");
  const [syncVisits, setSyncVisits] = React.useState<OwnVisitForPlace[]>([]);
  const [syncVisitIds, setSyncVisitIds] = React.useState<string[]>([]);
  const [syncShareComment, setSyncShareComment] = React.useState(false);
  const [syncBusy, setSyncBusy] = React.useState(false);
  const isBusy = busy || hideBusy || submitting || syncBusy;
  const allSyncVisitsSelected =
    syncVisits.length > 0 && syncVisits.every((visit) => syncVisitIds.includes(visit.visitId));

  React.useEffect(() => {
    if (!pending) return;
    setCuisines(pending.cuisines ?? []);
    setOccasions([]);
    setNotes("");
  }, [pending]);

  function resetPending() {
    onPendingChange(null);
    setCuisines([]);
    setOccasions([]);
    setNotes("");
  }

  function closePending() {
    if (isBusy) return;
    resetPending();
  }

  function resetSync() {
    setSyncOpen(false);
    setSyncPlaceName("");
    setSyncVisits([]);
    setSyncVisitIds([]);
    setSyncShareComment(false);
  }

  async function hideSuggestionForGroup(suggestion: PlaceSuggestion): Promise<void> {
    const groupId = isLive ? activeGroupId : state.group.id;
    if (!groupId) throw new Error("Sökträffen kunde inte kopplas till gruppen.");
    if (isLive) await hideGroupPlaceSuggestion(groupId, suggestion);
    else hideDemoPlaceSuggestion(groupId, suggestion);
    window.dispatchEvent(new Event("matrundan:hidden-place-suggestions-changed"));
  }

  async function hidePendingSuggestion() {
    if (!pending || isBusy || !canHideSuggestion) return;
    setHideBusy(true);
    try {
      const hiddenName = pending.name;
      await hideSuggestionForGroup(pending);
      resetPending();
      toast.success(`${hiddenName} döljs från gruppens sökningar.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte dölja sökträffen från gruppen.",
      );
    } finally {
      setHideBusy(false);
    }
  }

  async function hideFromReport(suggestion: PlaceSuggestion): Promise<void> {
    setHideBusy(true);
    try {
      await hideSuggestionForGroup(suggestion);
    } finally {
      setHideBusy(false);
    }
  }

  async function confirmAdd() {
    if (!pending || isBusy) return;
    const externalId = pending.externalId;
    const shouldOfferSync =
      isLive && !!activeGroupId && !!pending.provider && pending.provider !== "demo";
    setBusy(true);
    try {
      const place = {
        name: pending.name,
        category: pending.category,
        cuisines,
        occasions,
        address: pending.address,
        area: pending.area,
        city: pending.city,
        lat: pending.lat,
        lng: pending.lng,
        addedBy: state.currentUserId,
        photo: emojiForCategory(pending.category),
        notes: notes.trim() || undefined,
      };
      const added =
        isLive && pending.provider && pending.provider !== "demo"
          ? await addProviderPlace({
              provider: pending.provider,
              providerPlaceId: pending.externalId,
              place,
              raw: safeParse(pending.raw),
            })
          : await addPlace(place);
      onAdded(externalId);
      resetPending();
      toast.success(`${added.name} tillagd i gruppen`);

      if (shouldOfferSync && activeGroupId) {
        try {
          const ownVisits = await listOwnVisitsForPlaceOnAdd(added.id, activeGroupId);
          const shareableVisits = availableOwnVisits(ownVisits);
          if (shareableVisits.length > 0) {
            setSyncPlaceName(added.name);
            setSyncVisits(shareableVisits);
            setSyncVisitIds([]);
            setSyncShareComment(false);
            setSyncOpen(true);
          }
        } catch (error) {
          toast.warning("Stället lades till, men tidigare besök kunde inte hämtas.", {
            description:
              error instanceof Error
                ? error.message
                : "Försök igen från besökets detaljsida senare.",
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kunde inte lägga till stället.";
      if (/redan|already|duplicate|unique/i.test(message)) {
        onAdded(externalId);
        resetPending();
        toast.info("Det här stället finns redan i gruppen.");
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmSyncVisits() {
    if (!activeGroupId || syncVisitIds.length === 0 || syncBusy) return;
    setSyncBusy(true);
    const failedIds: string[] = [];
    const failedGroups: string[] = [];
    const successfulIds: string[] = [];

    for (const visitId of syncVisitIds) {
      const visit = syncVisits.find((candidate) => candidate.visitId === visitId);
      if (!visit) continue;
      try {
        await shareVisitToGroup(
          visitId,
          activeGroupId,
          visit.ownHasComment ? syncShareComment : false,
        );
        successfulIds.push(visitId);
      } catch {
        failedIds.push(visitId);
        failedGroups.push(visit.groupName);
      }
    }

    if (successfulIds.length > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("matrundan:reload"));
    }
    if (failedIds.length > 0) {
      setSyncVisits((current) => current.filter((visit) => failedIds.includes(visit.visitId)));
      setSyncVisitIds(failedIds);
      setSyncBusy(false);
      toast.warning("Några besök kunde inte delas.", {
        description: `${[...new Set(failedGroups)].join(", ")}. Försök igen eller hoppa över.`,
      });
      return;
    }

    setSyncBusy(false);
    resetSync();
    toast.success(
      `${successfulIds.length} ${successfulIds.length === 1 ? "besök delat" : "besök delade"} till gruppen`,
    );
  }

  const reportablePending: ReportablePlaceSuggestion | null = pending
    ? reportableSuggestionFromPlaceSuggestion(pending)
    : null;
  const websiteUrl = pending ? suggestionWebsite(pending) : undefined;

  return (
    <>
      <Dialog
        open={parentOpen && pending != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closePending();
        }}
      >
        {pending && reportablePending ? (
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Lägg till i gruppen</DialogTitle>
              <DialogDescription className="sr-only">
                Granska och lägg till {pending.name} i gruppen.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary text-2xl">
                {emojiForCategory(pending.category)}
              </div>
              <div className="min-w-0">
                <div className="break-words font-medium">{pending.name}</div>
                <div className="text-xs text-muted-foreground">
                  {CATEGORY_LABEL[pending.category]}
                  {pending.cuisines?.length ? ` · ${pending.cuisines.join(", ")}` : ""}
                </div>
                <div className="break-words text-[11px] text-muted-foreground">
                  {[pending.address, pending.area, pending.city].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className={websiteUrl ? "grid grid-cols-2 gap-2" : "grid grid-cols-1"}>
                {websiteUrl ? (
                  <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Öppna webbplatsen för ${pending.name}`}
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      Webbplats
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="outline" className="min-h-11 min-w-0 px-2">
                  <a
                    href={googleMapsSearchUrl(pending)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Öppna ${pending.name} i Google Maps`}
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    Google Maps
                  </a>
                </Button>
              </div>
              {canHideSuggestion ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-start text-muted-foreground"
                  disabled={isBusy || state.group.lifecycleStatus === "archived"}
                  onClick={() => void hidePendingSuggestion()}
                >
                  {hideBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  Dölj från gruppens sökningar
                </Button>
              ) : null}
              <PlaceSuggestionReportDialog
                suggestion={reportablePending}
                canHide={canHideSuggestion}
                disabled={isBusy || state.group.lifecycleStatus === "archived"}
                onHide={() => hideFromReport(pending)}
                onHidden={resetPending}
              />
              <p className="px-3 text-[11px] leading-relaxed text-muted-foreground">
                Döljning påverkar bara den här gruppen. En rapport går till gruppens admin och
                publiceras aldrig automatiskt.
              </p>
            </div>
            <FoodTagMultiSelect
              id="pending-food-tags"
              label="Kök och inriktning (valfritt)"
              value={cuisines}
              onChange={setCuisines}
            />
            <OccasionPicker
              id="pending-occasions"
              value={occasions}
              onChange={setOccasions}
              description="Valfritt – kan fyllas i efter ett besök."
            />
            <div className="space-y-1.5">
              <Label htmlFor="pending-notes">Anteckning till gruppen (valfritt)</Label>
              <Textarea
                id="pending-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="min-h-11" disabled={isBusy} onClick={closePending}>
                <ArrowLeft className="h-4 w-4" /> Tillbaka
              </Button>
              <Button className="min-h-11" disabled={isBusy} onClick={confirmAdd}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lägg till i gruppen
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={parentOpen && syncOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !syncBusy) resetSync();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Dela tidigare besök</DialogTitle>
            <DialogDescription>
              {syncVisits.length === 1
                ? `Du har ett tidigare besök på ${syncPlaceName} i en annan grupp.`
                : `Du har ${syncVisits.length} tidigare besök på ${syncPlaceName} i andra grupper.`}{" "}
              Välj vilka du vill dela till den här gruppen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Besöken länkas till den här gruppen. Medlemmarna här ser inte ursprungsgruppen eller
                privata kommentarer. Din egen kommentar delas bara om du väljer det.
              </p>
              <button
                type="button"
                onClick={() =>
                  setSyncVisitIds(
                    toggleAllSelection(
                      syncVisits.map((visit) => visit.visitId),
                      syncVisitIds,
                    ),
                  )
                }
                disabled={syncBusy}
                className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
              >
                {allSyncVisitsSelected ? "Rensa val" : "Välj alla"}
              </button>
            </div>
            <div className="space-y-2">
              {syncVisits.map((visit) => {
                const checked = syncVisitIds.includes(visit.visitId);
                return (
                  <label
                    key={visit.visitId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() =>
                        setSyncVisitIds((current) =>
                          current.includes(visit.visitId)
                            ? current.filter((id) => id !== visit.visitId)
                            : [...current, visit.visitId],
                        )
                      }
                      disabled={syncBusy}
                      aria-label={`Dela besöket från ${visit.groupName}`}
                    />
                    <span aria-hidden>{visit.groupEmoji ?? "🍽️"}</span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {visit.groupName}
                      <span className="block text-xs text-muted-foreground">
                        {formatOwnVisitDate(visit.visitedOn)} · {formatMealType(visit.mealType)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {syncVisits.some(
              (visit) => syncVisitIds.includes(visit.visitId) && visit.ownHasComment,
            ) ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                <Label htmlFor="sync-share-comment" className="text-sm font-normal">
                  Dela även mina kommentarer
                </Label>
                <Switch
                  id="sync-share-comment"
                  checked={syncShareComment}
                  onCheckedChange={setSyncShareComment}
                  disabled={syncBusy}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="min-h-11" disabled={syncBusy} onClick={resetSync}>
              Hoppa över
            </Button>
            <Button
              className="min-h-11"
              disabled={syncBusy || syncVisitIds.length === 0}
              onClick={confirmSyncVisits}
            >
              {syncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Dela valda besök
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
