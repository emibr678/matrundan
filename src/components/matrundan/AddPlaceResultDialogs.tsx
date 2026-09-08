import * as React from "react";
import { ArrowLeft, Clock3, Globe2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { OccasionPicker } from "./OccasionPicker";
import { PlaceDataLimitedInfoNotice } from "./PlaceDataSignalNotice";
import { PlaceExternalLink } from "./PlaceExternalLink";
import { PlaceIdentityMark } from "./PlaceIdentityMark";
import { PlaceSuggestionReportDialog } from "./PlaceSuggestionReportDialog";
import { PlaceSuggestionSignalPanel } from "./PlaceSuggestionSignalPanel";
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
import { emojiForCategory, safeParse } from "@/lib/matrundan/add-place-utils";
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
import { usePlaceDataSignalForReportableSuggestion } from "@/lib/matrundan/use-place-data-signals";

function suggestionWebsite(suggestion: PlaceSuggestion): string | undefined {
  return normalizeWebsiteUrl((suggestion as PlaceSuggestion & { website?: string | null }).website);
}

function suggestionHasOpeningHours(suggestion: PlaceSuggestion): boolean {
  return Boolean((suggestion as PlaceSuggestion & { hasOpeningHours?: boolean }).hasOpeningHours);
}

function PendingPlaceSummary({
  pending,
  reportablePending,
}: {
  pending: PlaceSuggestion;
  reportablePending: ReportablePlaceSuggestion;
}) {
  const websiteUrl = suggestionWebsite(pending);
  const hasOpeningHours = suggestionHasOpeningHours(pending);
  const { signal } = usePlaceDataSignalForReportableSuggestion(reportablePending);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div className="bg-gradient-to-br from-secondary to-secondary/40 p-4 sm:p-5">
        <div
          data-testid="pending-place-identity-grid"
          className="grid min-h-16 grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 min-[390px]:min-h-20 min-[390px]:grid-cols-[5rem_minmax(0,1fr)] sm:gap-x-4"
        >
          <PlaceIdentityMark
            category={pending.category}
            symbol={emojiForCategory(pending.category)}
            size="detail"
          />
          <div className="min-w-0 self-center">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[pending.category]}
            </div>
            <h2 className="break-words font-display text-2xl font-semibold leading-tight md:text-3xl">
              {pending.name}
            </h2>
            {pending.cuisines?.length ? (
              <div className="mt-1 break-words text-xs text-muted-foreground">
                {pending.cuisines.join(" · ")}
              </div>
            ) : null}
          </div>
        </div>

        <div
          data-testid="pending-place-practical-info"
          className="relative mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background/35"
        >
          <div className="relative flex min-h-11 items-center px-3">
            <PlaceExternalLink
              href={googleMapsSearchUrl(pending)}
              target="_blank"
              rel="noreferrer"
              icon={MapPin}
              prefix={pending.address ? `${pending.address}, ` : undefined}
              tail={pending.city || pending.area || "Google Maps"}
              className="min-w-0 flex-1"
              aria-label={`Öppna ${pending.name} i Google Maps`}
            />
          </div>

          <div className="grid min-w-0 grid-cols-2 border-t border-border/60">
            <div className="min-w-0 border-r border-border/60">
              {websiteUrl ? (
                <PlaceExternalLink
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  icon={Globe2}
                  tail="Webbplats"
                  className="w-full px-3"
                  aria-label={`Öppna webbplatsen för ${pending.name}`}
                />
              ) : (
                <div className="flex min-h-11 items-center gap-2 px-3 text-sm text-muted-foreground">
                  <Globe2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Webbplats ej angiven</span>
                </div>
              )}
            </div>
            <div className="flex min-h-11 min-w-0 items-center gap-2 px-3 text-sm">
              <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[11px] font-medium text-muted-foreground">
                  Öppettider
                </span>
                <span className="block truncate font-medium">
                  {hasOpeningHours ? "Finns i kartdatan" : "Ej angivna"}
                </span>
              </span>
            </div>
          </div>

          <PlaceDataLimitedInfoNotice signal={signal} />
        </div>
      </div>
    </div>
  );
}

function PendingPlaceSignalStatus({
  reportablePending,
  disabled,
}: {
  reportablePending: ReportablePlaceSuggestion;
  disabled: boolean;
}) {
  const { signal, target } = usePlaceDataSignalForReportableSuggestion(reportablePending);
  return <PlaceSuggestionSignalPanel signal={signal} target={target} disabled={disabled} />;
}

export function AddPlaceResultDialogs({
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

            <PendingPlaceSummary pending={pending} reportablePending={reportablePending} />

            <div className="space-y-5 border-t border-border/60 pt-5">
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
            </div>

            <PendingPlaceSignalStatus
              reportablePending={reportablePending}
              disabled={isBusy || state.group.lifecycleStatus === "archived"}
            />

            <div className="border-t border-border/60 pt-1">
              <PlaceSuggestionReportDialog
                suggestion={reportablePending}
                canHide={canHideSuggestion}
                disabled={isBusy || state.group.lifecycleStatus === "archived"}
                onHide={() => hideFromReport(pending)}
                onHidden={resetPending}
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
