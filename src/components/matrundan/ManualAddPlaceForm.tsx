import * as React from "react";
import { CheckCircle2, ChevronDown, Loader2, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { GeoapifyLocationInput, type VerifiedLocationSelection } from "./GeoapifyLocationInput";
import { OccasionPicker } from "./OccasionPicker";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyManualPlace,
  emojiForCategory,
  type ManualPlaceDraft,
} from "@/lib/matrundan/add-place-utils";
import type { ManualPlaceMutationHints } from "@/lib/matrundan/live-mutations";
import { normalizeWebsiteUrl } from "@/lib/matrundan/place-links";
import {
  getGroupPlacePracticalInfo,
  getLocalGroupPlacePracticalInfo,
  updateGroupPlacePracticalInfo,
  updateLocalGroupPlacePracticalInfo,
} from "@/lib/matrundan/practical-info";
import {
  isReusablePlaceRace,
  listLocalReusableManualPlaceCandidates,
  listReusableManualPlaceCandidates,
  type ReusableManualPlaceCandidate,
} from "@/lib/matrundan/reusable-manual-places";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type Place, type PlaceCategory } from "@/lib/matrundan/types";

type ManualAddInput = Omit<Place, "id" | "addedAt"> & ManualPlaceMutationHints;

export function ManualAddPlaceForm({ onClose }: { onClose: () => void }) {
  const { state, addPlace, submitting } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const [draft, setDraft] = React.useState<ManualPlaceDraft>(() => emptyManualPlace(""));
  const [website, setWebsite] = React.useState("");
  const [verifiedLocation, setVerifiedLocation] = React.useState<VerifiedLocationSelection | null>(
    null,
  );
  const [candidates, setCandidates] = React.useState<ReusableManualPlaceCandidate[]>([]);
  const [declinedCandidateIds, setDeclinedCandidateIds] = React.useState<string[]>([]);
  const [candidateLoading, setCandidateLoading] = React.useState(false);
  const [candidateError, setCandidateError] = React.useState<string | null>(null);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const candidateRequestRef = React.useRef(0);
  const isBusy = busy || submitting;
  const isLive = mode === "live";
  const localStorageKind = exampleMode ? "session" : "local";
  const normalizedWebsite = normalizeWebsiteUrl(website);
  const websiteInvalid = website.trim().length > 0 && !normalizedWebsite;

  const set = <K extends keyof ManualPlaceDraft>(key: K, value: ManualPlaceDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const candidateQuery = React.useMemo(() => {
    if (!verifiedLocation || draft.name.trim().length < 2) return null;
    return {
      name: draft.name.trim(),
      category: draft.category,
      address: draft.address.trim(),
      city: draft.city.trim(),
      lat: verifiedLocation.lat,
      lng: verifiedLocation.lng,
    };
  }, [draft.address, draft.category, draft.city, draft.name, verifiedLocation]);

  const loadCandidates = React.useCallback(async () => {
    const query = candidateQuery;
    if (!query) {
      setCandidates([]);
      setCandidateError(null);
      setCandidateLoading(false);
      return [] as ReusableManualPlaceCandidate[];
    }
    if (isLive && !activeGroupId) {
      setCandidates([]);
      setCandidateError("Ingen aktiv grupp kunde hittas.");
      return [] as ReusableManualPlaceCandidate[];
    }

    const requestId = ++candidateRequestRef.current;
    setCandidateLoading(true);
    setCandidateError(null);
    try {
      const rows = isLive
        ? await listReusableManualPlaceCandidates(activeGroupId!, query)
        : listLocalReusableManualPlaceCandidates(state.places, query);
      if (candidateRequestRef.current !== requestId) return rows;
      setCandidates(rows);
      return rows;
    } catch (error) {
      if (candidateRequestRef.current !== requestId) return [];
      setCandidates([]);
      setCandidateError(
        error instanceof Error ? error.message : "Kunde inte kontrollera befintliga matställen.",
      );
      return [];
    } finally {
      if (candidateRequestRef.current === requestId) setCandidateLoading(false);
    }
  }, [activeGroupId, candidateQuery, isLive, state.places]);

  React.useEffect(() => {
    setDeclinedCandidateIds([]);
    if (!candidateQuery) {
      setCandidates([]);
      setCandidateError(null);
      setCandidateLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void loadCandidates();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [candidateQuery, loadCandidates]);

  function changeLocationText(value: string) {
    setDraft((current) => ({
      ...current,
      address: value,
      city: verifiedLocation && value !== verifiedLocation.label ? "" : current.city,
      area: verifiedLocation && value !== verifiedLocation.label ? "" : current.area,
    }));
    if (verifiedLocation && value !== verifiedLocation.label) setVerifiedLocation(null);
  }

  function selectLocation(location: VerifiedLocationSelection) {
    setDraft((current) => ({
      ...current,
      address: location.label,
      city: location.city,
      area: location.area ?? "",
    }));
    setVerifiedLocation(location);
  }

  function baseAddInput(): ManualAddInput {
    return {
      name: draft.name.trim(),
      category: draft.category,
      cuisines: draft.cuisines,
      occasions: draft.occasions,
      address: draft.address.trim(),
      area: draft.area.trim() || undefined,
      city: draft.city.trim(),
      lat: verifiedLocation?.lat,
      lng: verifiedLocation?.lng,
      addedBy: state.currentUserId,
      notes: draft.notes.trim() || undefined,
      photo: draft.photo || emojiForCategory(draft.category),
      origin: "manual",
    };
  }

  function validateWebsite(): boolean {
    if (!websiteInvalid) return true;
    toast.error("Ange en giltig webbplats, till exempel restaurang.se");
    setMoreOpen(true);
    return false;
  }

  async function saveOptionalWebsite(placeId: string): Promise<boolean> {
    if (!normalizedWebsite) return true;
    try {
      const groupId = isLive ? activeGroupId : state.group.id;
      if (!groupId) throw new Error("Ingen aktiv grupp.");

      if (isLive) {
        const current = await getGroupPlacePracticalInfo(groupId, placeId);
        await updateGroupPlacePracticalInfo(groupId, placeId, {
          websiteOverride: normalizedWebsite,
          openingHoursOverride: current.openingHoursOverride,
          sourceUrl: current.sourceUrl,
          sourceNote: current.sourceNote,
        });
      } else {
        const current = getLocalGroupPlacePracticalInfo(groupId, placeId, localStorageKind);
        const actor = state.members.find((member) => member.id === state.currentUserId);
        updateLocalGroupPlacePracticalInfo(
          groupId,
          placeId,
          {
            websiteOverride: normalizedWebsite,
            openingHoursOverride: current.openingHoursOverride,
            sourceUrl: current.sourceUrl,
            sourceNote: current.sourceNote,
          },
          {
            id: state.currentUserId,
            name: actor?.name ?? "Du",
          },
          localStorageKind,
        );
      }
      return true;
    } catch (error) {
      console.warn("[Matrundan] kunde inte spara webbplats från fallbacken:", error);
      return false;
    }
  }

  async function reuseCandidate(candidate: ReusableManualPlaceCandidate) {
    if (!validateWebsite()) return;
    setBusy(true);
    try {
      if (candidate.groupStatus === "active") {
        const websiteSaved = await saveOptionalWebsite(candidate.placeId);
        toast.info(`${candidate.name} finns redan i gruppen.`, {
          description:
            normalizedWebsite && !websiteSaved
              ? "Webbplatsen kunde inte sparas. Du kan komplettera den senare."
              : undefined,
        });
        onClose();
        return;
      }

      let placeId = candidate.placeId;
      if (isLive) {
        const input: ManualAddInput = {
          ...baseAddInput(),
          reusePlaceId: candidate.placeId,
        };
        const added = await addPlace(input);
        placeId = added.id;
      } else {
        const local = state.places.find((place) => place.id === candidate.placeId);
        if (!local) throw new Error("Exempelstället kunde inte hittas.");
        const added = await addPlace({
          name: local.name,
          category: local.category,
          cuisines: local.cuisines,
          occasions: draft.occasions,
          address: local.address,
          area: local.area,
          city: local.city,
          lat: local.lat,
          lng: local.lng,
          addedBy: state.currentUserId,
          notes: draft.notes.trim() || local.notes,
          photo: local.photo ?? emojiForCategory(local.category),
          origin: "manual",
        });
        placeId = added.id;
      }

      const websiteSaved = await saveOptionalWebsite(placeId);
      toast.success(
        candidate.groupStatus === "archived"
          ? `${candidate.name} lades tillbaka i gruppen`
          : `${candidate.name} tillagd i gruppen`,
        {
          description: "Matrundan återanvände samma matställe i stället för att skapa en dubblett.",
        },
      );
      if (normalizedWebsite && !websiteSaved) {
        toast.warning("Webbplatsen kunde inte sparas", {
          description: "Matstället är tillagt. Webbplatsen kan kompletteras senare.",
        });
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återanvända matstället.");
      await loadCandidates();
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!draft.name.trim()) {
      toast.error("Ge stället ett namn");
      return;
    }
    if (!validateWebsite()) return;

    const unresolvedCandidates = candidates.filter(
      (candidate) => !declinedCandidateIds.includes(candidate.placeId),
    );
    if (unresolvedCandidates.length > 0) {
      toast.info("Kontrollera först om något av de föreslagna ställena är rätt.");
      return;
    }

    setBusy(true);
    try {
      const input: ManualAddInput = {
        ...baseAddInput(),
        declinedReusablePlaceIds: declinedCandidateIds,
      };
      const added = await addPlace(input);
      const websiteSaved = await saveOptionalWebsite(added.id);
      toast.success(`${added.name} tillagd i gruppen`);
      if (normalizedWebsite && !websiteSaved) {
        toast.warning("Webbplatsen kunde inte sparas", {
          description: "Matstället är tillagt. Webbplatsen kan kompletteras senare.",
        });
      }
      onClose();
    } catch (error) {
      if (isReusablePlaceRace(error)) {
        setDeclinedCandidateIds([]);
        await loadCandidates();
        toast.info("Matrundan hittade ett befintligt ställe som behöver kontrolleras först.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till stället.");
    } finally {
      setBusy(false);
    }
  }

  const allCandidatesDeclined =
    candidates.length > 0 &&
    candidates.every((candidate) => declinedCandidateIds.includes(candidate.placeId));

  return (
    <>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Lägg till ett ställe som saknas</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hittade du inte rätt ställe i sökningen? Lägg till det här så kan gruppen fortsätta
            direkt.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="manual-name">Namn</Label>
          <Input
            id="manual-name"
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            autoComplete="organization"
            disabled={isBusy}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={draft.category}
            onValueChange={(value) => {
              const category = value as PlaceCategory;
              setDraft((current) => ({
                ...current,
                category,
                photo: emojiForCategory(category),
              }));
            }}
            disabled={isBusy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FoodTagMultiSelect
          id="manual-food-tags"
          label="Kök och inriktning (valfritt)"
          value={draft.cuisines}
          onChange={(value) => set("cuisines", value)}
        />

        <div className="space-y-1.5">
          <Label htmlFor="manual-location">Plats</Label>
          <GeoapifyLocationInput
            id="manual-location"
            value={draft.address}
            onChange={changeLocationText}
            onSelect={selectLocation}
            onClearVerified={() => {
              setVerifiedLocation(null);
              setDraft((current) => ({ ...current, city: "", area: "" }));
            }}
            placeholder="Sök adress eller plats"
            disabled={isBusy}
            demoMode={!isLive}
            demoFallbackCity={state.group.city}
          />
          <div className="flex min-w-0 items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            {verifiedLocation ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <p className="min-w-0 break-words">
              {verifiedLocation
                ? ["Verifierad plats", verifiedLocation.area, verifiedLocation.city]
                    .filter(Boolean)
                    .join(" · ")
                : "Välj gärna en träff i listan. Då kan Matrundan säkrare undvika dubbletter och förbättra platsinformationen senare."}
            </p>
          </div>
        </div>

        {candidateLoading ? (
          <div
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Kontrollerar om stället redan finns i Matrundan…
          </div>
        ) : null}

        {candidateError ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            <p>Kunde inte kontrollera befintliga Matrundan-ställen just nu.</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 px-0"
              onClick={() => void loadCandidates()}
            >
              <RotateCcw className="h-4 w-4" /> Försök igen
            </Button>
          </div>
        ) : null}

        {candidates.length > 0 && !allCandidatesDeclined ? (
          <section
            className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3"
            aria-label="Befintliga Matrundan-ställen"
          >
            <div>
              <p className="text-sm font-semibold">Kolla om stället redan finns</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Matrundan hittade ställen nära den valda platsen. Ingen information om andra grupper
                visas.
              </p>
            </div>
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <ReusableCandidateCard
                  key={candidate.placeId}
                  candidate={candidate}
                  busy={isBusy}
                  onUse={() => void reuseCandidate(candidate)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-10 w-full justify-center"
              disabled={isBusy}
              onClick={() =>
                setDeclinedCandidateIds(candidates.map((candidate) => candidate.placeId))
              }
            >
              Inget av dessa stämmer
            </Button>
          </section>
        ) : null}

        {allCandidatesDeclined ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
            <span>Du har valt att skapa ett nytt ställe i stället.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setDeclinedCandidateIds([])}
            >
              Ångra
            </Button>
          </div>
        ) : null}

        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full justify-between px-2"
              disabled={isBusy}
            >
              <span>Fler uppgifter (valfritt)</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="manual-website">Webbplats</Label>
              <Input
                id="manual-website"
                type="url"
                inputMode="url"
                placeholder="restaurang.se"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={websiteInvalid}
                disabled={isBusy}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Valfritt. Kan också kompletteras senare.
              </p>
            </div>
            <OccasionPicker
              id="manual-occasions"
              value={draft.occasions}
              onChange={(value) => set("occasions", value)}
              description="Kan också fyllas i senare."
            />
            <div className="space-y-1.5">
              <Label htmlFor="manual-notes">Anteckning</Label>
              <Textarea
                id="manual-notes"
                rows={2}
                value={draft.notes}
                onChange={(event) => set("notes", event.target.value)}
                disabled={isBusy}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" className="min-h-11" disabled={isBusy} onClick={onClose}>
          Avbryt
        </Button>
        <Button className="min-h-11" disabled={isBusy || candidateLoading} onClick={submit}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lägg till i gruppen
        </Button>
      </DialogFooter>
    </>
  );
}

function ReusableCandidateCard({
  candidate,
  busy,
  onUse,
}: {
  candidate: ReusableManualPlaceCandidate;
  busy: boolean;
  onUse: () => void;
}) {
  const location = [candidate.address, candidate.area, candidate.city].filter(Boolean).join(" · ");
  const alreadyActive = candidate.groupStatus === "active";
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{candidate.name}</p>
          <p className="mt-0.5 break-words text-xs text-muted-foreground">
            {CATEGORY_LABEL[candidate.category]}
            {location ? ` · ${location}` : ""}
          </p>
          <p className="mt-1 text-[11px] font-medium text-primary">
            {candidate.matchKind === "exact"
              ? "Finns redan i Matrundan"
              : "Liknande ställe finns i Matrundan"}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={alreadyActive ? "secondary" : "outline"}
          className="min-h-10 shrink-0"
          disabled={busy}
          onClick={onUse}
        >
          {alreadyActive
            ? "Redan i gruppen"
            : candidate.groupStatus === "archived"
              ? "Lägg tillbaka"
              : "Använd detta"}
        </Button>
      </div>
    </div>
  );
}
