import { needsPlaceComparison, unambiguousPlaceCandidate } from "@/lib/matrundan/place-discovery";
import * as React from "react";
import {
  PlaceResolutionError,
  type IdentityCandidate,
  type PlaceResolution,
} from "@/lib/matrundan/place-discovery";
import { ArrowLeft, Clock3, Globe2, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { MatrundanBrand } from "./MatrundanBrand";
import { useVisitShareBatch } from "./useVisitShareBatch";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { OccasionPicker } from "./OccasionPicker";
import { PlaceDataLimitedInfoNotice } from "./PlaceDataSignalNotice";
import { PlaceExternalLink } from "./PlaceExternalLink";
import { PlaceIdentityMark } from "./PlaceIdentityMark";
import { PlaceSuggestionReportDialog } from "./PlaceSuggestionReportDialog";
import { PlaceSuggestionSignalPanel } from "./PlaceSuggestionSignalPanel";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { resolvePlaceSymbol } from "@/lib/matrundan/place-symbol";
import {
  hideDemoPlaceSuggestion,
  hideGroupPlaceSuggestion,
} from "@/lib/matrundan/hidden-place-suggestions";
import { listOwnVisitsForPlaceOnAdd, type OwnVisitForPlace } from "@/lib/matrundan/live-sharing";
import {
  reportableSuggestionFromPlaceSuggestion,
  type ReportablePlaceSuggestion,
} from "@/lib/matrundan/place-data-reports";
import { formatPlaceAddressWithCity } from "@/lib/matrundan/place-location";
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
  cuisines,
  reportablePending,
}: {
  pending: PlaceSuggestion;
  cuisines: readonly string[];
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
            symbol={resolvePlaceSymbol({ category: pending.category, cuisines })}
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
  const scopeRef = React.useRef({ groupId: activeGroupId, mode });
  scopeRef.current = { groupId: activeGroupId, mode };
  const canHideSuggestion =
    mode === "demo" || activeGroupRole === "owner" || activeGroupRole === "admin";
  const [selectedCandidateId, setSelectedCandidateId] = React.useState<string | null>(null);
  const [review, setReview] = React.useState<PlaceResolution | null>(null);
  const [conflictMessage, setConflictMessage] = React.useState<string | null>(null);
  const canConfirmIdentity = activeGroupRole === "owner" || activeGroupRole === "admin";
  const [cuisines, setCuisines] = React.useState<string[]>([]);
  const [occasions, setOccasions] = React.useState<Occasion[]>([]);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [hideBusy, setHideBusy] = React.useState(false);
  const [syncOpen, setSyncOpen] = React.useState(false);
  const [syncPlaceName, setSyncPlaceName] = React.useState("");
  const [syncVisits, setSyncVisits] = React.useState<OwnVisitForPlace[]>([]);
  const [syncVisitIds, setSyncVisitIds] = React.useState<string[]>([]);
  const [syncShareComment, setSyncShareComment] = React.useState(true);
  const [syncSharePhoto, setSyncSharePhoto] = React.useState(true);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const syncBatch = useVisitShareBatch();
  const [syncBusy, setSyncBusy] = React.useState(false);
  const isBusy = busy || hideBusy || submitting || syncBusy;
  const allSyncVisitsSelected =
    syncVisits.length > 0 && syncVisits.every((visit) => syncVisitIds.includes(visit.visitId));

  React.useEffect(() => {
    if (!pending) return;
    setCuisines(pending.cuisines ?? []);
    setConflictMessage(
      pending.identity?.identityConflict
        ? "Kartkällorna pekar på olika ställen. Ingen ändring kan sparas här."
        : null,
    );
    setReview(
      needsPlaceComparison(pending)
        ? {
            status: "review_required",
            candidates: pending.identity?.candidates ?? [],
            providerVersion: pending.identity?.providerVersion,
          }
        : null,
    );
    setOccasions([]);
    setNotes("");
    setSelectedCandidateId(null);
  }, [pending]);
  React.useEffect(() => {
    setSelectedCandidateId(null);
  }, [review]);

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
    setSyncShareComment(true);
    setSyncSharePhoto(true);
    setSyncError(null);
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

  async function confirmAdd(
    choice: "auto" | "link" | "separate" = "auto",
    target?: IdentityCandidate,
    reuseOnly = false,
  ) {
    if (!pending || isBusy) return;
    const actionScope = scopeRef.current;
    const stale = () =>
      actionScope.groupId !== scopeRef.current.groupId ||
      actionScope.mode !== scopeRef.current.mode;
    const externalId = pending.externalId;
    const shouldOfferSync =
      isLive &&
      !!activeGroupId &&
      (pending.kind === "canonical" || (!!pending.provider && pending.provider !== "demo"));
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
        isLive &&
        (pending.kind === "canonical" || (pending.provider && pending.provider !== "demo"))
          ? await addProviderPlace({
              provider: pending.provider ?? "canonical",
              providerPlaceId: pending.externalId,
              place,
              raw: safeParse(pending.raw),
              canonicalPlaceId: reuseOnly ? target?.placeId : pending.canonical?.placeId,
              choice,
              identityPlaceId: target?.placeId,
              decisions:
                choice === "link" && target
                  ? [{ placeId: target.placeId, version: target.version }]
                  : review?.candidates?.map((c) => ({ placeId: c.placeId, version: c.version })),
              providerVersion: review?.providerVersion ?? pending.identity?.providerVersion,
            })
          : await addPlace(place);
      if (stale()) return;
      onAdded(externalId);
      resetPending();
      toast.success(`${added.name} tillagd i gruppen`);

      if (shouldOfferSync && activeGroupId) {
        try {
          const ownVisits = await listOwnVisitsForPlaceOnAdd(added.id, activeGroupId);
          if (stale()) return;
          const shareableVisits = availableOwnVisits(ownVisits);
          if (shareableVisits.length > 0) {
            setSyncPlaceName(added.name);
            setSyncVisits(shareableVisits);
            setSyncVisitIds([]);
            setSyncShareComment(true);
            setSyncSharePhoto(true);
            setSyncError(null);
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
      if (stale()) return;
      if (error instanceof PlaceResolutionError) {
        if (error.resolution.status === "review_required") {
          setReview(error.resolution);
          if (error.resolution.provider) setCuisines(error.resolution.provider.cuisines ?? []);
          toast.info("Kontrollera de aktuella uppgifterna innan du bekräftar.");
        } else setConflictMessage(error.message);
        return;
      }
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
    try {
      const selected = syncVisits.filter((visit) => syncVisitIds.includes(visit.visitId));
      const results = await syncBatch.run(
        selected.map((visit) => ({
          visitId: visit.visitId,
          groupId: activeGroupId,
          label: state.group.name,
          shareComment: visit.ownHasComment && syncShareComment,
          sharePhoto: visit.ownHasPhoto && syncSharePhoto,
        })),
      );
      const successful = results.filter((result) => result.status === "success");
      const remaining = results.filter(
        (result) => result.status === "failed" || result.status === "pending",
      );
      if (successful.length > 0) {
        window.dispatchEvent(new Event("matrundan:reload"));
        toast.success(
          `${successful.length} ${successful.length === 1 ? "besök tillagt" : "besök tillagda"} i gruppen.`,
        );
      }
      if (remaining.length > 0) {
        const ids = remaining.map((result) => result.job.visitId);
        setSyncVisits((current) => current.filter((visit) => ids.includes(visit.visitId)));
        setSyncVisitIds(ids);
        setSyncError(
          remaining.map((result) => result.error ?? "Besöket är inte sparat ännu.").join(" "),
        );
      } else resetSync();
    } finally {
      setSyncBusy(false);
    }
  }

  const chosenCandidate = review?.candidates?.find(
    (candidate) => candidate.placeId === selectedCandidateId,
  );
  const simpleCandidate = pending && !review ? unambiguousPlaceCandidate(pending) : null;
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
              <DialogTitle className="font-display text-2xl">
                {review
                  ? "Är det samma ställe?"
                  : pending.canonical?.groupStatus === "archived"
                    ? "Återställ i gruppen"
                    : "Lägg till i gruppen"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Granska och lägg till {pending.name} i gruppen.
              </DialogDescription>
            </DialogHeader>

            {pending.kind === "canonical" || simpleCandidate ? (
              <div className="space-y-1 rounded-xl border p-4">
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MatrundanBrand variant="mark" size="xs" />
                  Finns i Matrundan
                </p>
                <h2 className="break-words font-display text-2xl">
                  {simpleCandidate?.name ?? pending.name}
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  {formatPlaceAddressWithCity(
                    simpleCandidate?.address ?? pending.address,
                    simpleCandidate?.city ?? pending.city,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Stället som redan finns används. Gruppens egna uppgifter läggs till separat.
                </p>
              </div>
            ) : review ? (
              <div className="space-y-1 rounded-xl border bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Hittat i kartan</p>
                <h2 className="break-words font-display text-xl">
                  {(review.provider ?? pending).name}
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  {formatPlaceAddressWithCity(
                    (review.provider ?? pending).address,
                    (review.provider ?? pending).city,
                    ", ",
                  )}
                </p>
              </div>
            ) : (
              <PendingPlaceSummary
                pending={pending}
                cuisines={cuisines}
                reportablePending={reportablePending}
              />
            )}
            {simpleCandidate && canConfirmIdentity ? (
              <p className="text-xs text-muted-foreground">
                När du lägger till stället bekräftas också att kartträffen hör hit.
              </p>
            ) : null}
            {conflictMessage ? (
              <p role="alert" className="rounded-xl border p-3 text-sm">
                {conflictMessage}
              </p>
            ) : null}
            {review ? (
              <div className="space-y-3" aria-label="Granska möjlig matchning">
                <p className="text-sm text-muted-foreground">
                  Kartträffen kan redan finnas i Matrundan. Välj stället som stämmer. Besök och
                  gruppuppgifter ligger kvar.
                </p>
                <div role="radiogroup" aria-label="Välj stället som stämmer" className="space-y-2">
                  {(review.candidates ?? []).map((candidate) => (
                    <label
                      key={candidate.placeId}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left focus-within:ring-2 focus-within:ring-ring ${selectedCandidateId === candidate.placeId ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <input
                        type="radio"
                        name="reuse-place"
                        value={candidate.placeId}
                        checked={selectedCandidateId === candidate.placeId}
                        aria-label={`Välj ${candidate.name}`}
                        disabled={isBusy || !!conflictMessage}
                        onChange={() => setSelectedCandidateId(candidate.placeId)}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-muted-foreground">Redan i Matrundan</p>
                        <p className="break-words font-medium">{candidate.name}</p>
                        <p className="break-words text-sm text-muted-foreground">
                          {formatPlaceAddressWithCity(candidate.address, candidate.city)} ·{" "}
                          {Math.round(candidate.distanceKm * 1000)} m bort
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {review.candidates?.length ? (
                  <>
                    <Button
                      className="min-h-11 w-full whitespace-normal"
                      disabled={isBusy || !!conflictMessage || !chosenCandidate}
                      onClick={() =>
                        chosenCandidate &&
                        void confirmAdd(
                          chosenCandidate.canConfirmSource === true && canConfirmIdentity
                            ? "link"
                            : "auto",
                          chosenCandidate,
                          !(chosenCandidate.canConfirmSource === true && canConfirmIdentity),
                        )
                      }
                    >
                      Ja, använd stället som redan finns
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {chosenCandidate?.canConfirmSource === true && canConfirmIdentity
                        ? "När du fortsätter bekräftas också att kartträffen hör hit."
                        : "Stället används utan att kartkällan kopplas."}
                    </p>
                  </>
                ) : null}
                {!review.candidates?.length ? (
                  <p className="text-sm">
                    Matchningen behöver kontrolleras igen. Gå tillbaka och sök på nytt.
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    className="min-h-11 w-full whitespace-normal"
                    disabled={isBusy || !!conflictMessage}
                    onClick={() => void confirmAdd("separate")}
                  >
                    Nej, det är ett annat ställe
                  </Button>
                )}
              </div>
            ) : null}
            {!review ? (
              <Collapsible
                key={pending.externalId}
                defaultOpen={!simpleCandidate && pending.kind !== "canonical"}
                className="border-t border-border/60 pt-3"
              >
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="min-h-11 w-full justify-between px-0">
                    Lägg till uppgifter (valfritt)
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-5 pt-3">
                  {isLive ? (
                    <p className="text-sm text-muted-foreground">
                      {cuisines.length
                        ? cuisines.join(" · ")
                        : "Kök och inriktning kan kompletteras senare."}
                    </p>
                  ) : (
                    <FoodTagMultiSelect
                      id="pending-food-tags"
                      label="Kök och inriktning (valfritt)"
                      value={cuisines}
                      onChange={setCuisines}
                    />
                  )}
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
                </CollapsibleContent>
              </Collapsible>
            ) : null}
            {pending.kind !== "canonical" && !review && !simpleCandidate ? (
              <>
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
              </>
            ) : null}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="min-h-11" disabled={isBusy} onClick={closePending}>
                <ArrowLeft className="h-4 w-4" /> Tillbaka
              </Button>
              {!review && !conflictMessage ? (
                <Button
                  className="min-h-11"
                  disabled={isBusy}
                  onClick={() =>
                    void confirmAdd(
                      simpleCandidate && canConfirmIdentity ? "link" : "auto",
                      simpleCandidate ?? undefined,
                      !!simpleCandidate && !canConfirmIdentity,
                    )
                  }
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {pending.canonical?.groupStatus === "archived"
                    ? "Återställ i gruppen"
                    : "Lägg till i gruppen"}
                </Button>
              ) : null}
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
            <DialogTitle className="font-display text-2xl">Lägg till tidigare besök</DialogTitle>
            <DialogDescription>
              {syncVisits.length === 1
                ? `Du har ett tidigare besök på ${syncPlaceName} i en annan grupp.`
                : `Du har ${syncVisits.length} tidigare besök på ${syncPlaceName} i andra grupper.`}{" "}
              Välj vilka besök du vill lägga till i den här gruppen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Andras kommentarer och bilder följer inte med.
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
                      aria-label={`Lägg till besöket ${formatOwnVisitDate(visit.visitedOn)} från ${visit.groupName}`}
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
                  Dela min kommentar
                </Label>
                <Switch
                  id="sync-share-comment"
                  checked={syncShareComment}
                  onCheckedChange={setSyncShareComment}
                  disabled={syncBusy}
                />
              </div>
            ) : null}
            {syncVisits.some(
              (visit) => syncVisitIds.includes(visit.visitId) && visit.ownHasPhoto,
            ) ? (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                <Label htmlFor="sync-share-photo" className="text-sm font-normal">
                  Dela min bild
                </Label>
                <Switch
                  id="sync-share-photo"
                  checked={syncSharePhoto}
                  onCheckedChange={setSyncSharePhoto}
                  disabled={syncBusy}
                />
              </div>
            ) : null}
            {syncVisitIds.length > 1 ? (
              <p className="text-xs text-muted-foreground">Valen gäller alla markerade besök.</p>
            ) : null}
            {syncError ? (
              <p role="alert" className="text-sm">
                {syncError} Lyckade besök är sparade. Försök igen med de besök som återstår.
              </p>
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
              Lägg till valda besök
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {syncBatch.duplicatePrompt}
    </>
  );
}
