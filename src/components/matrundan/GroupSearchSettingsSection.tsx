import * as React from "react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";
import { SearchAreaPill } from "@/components/matrundan/SearchAreaPill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  replaceGroupSearchSettings,
  updateGroupSettings,
  type VerifiedSearchArea,
} from "@/lib/matrundan/live-admin";
import {
  isBroadAdministrativeSearchArea,
  SEARCH_RADIUS_OPTIONS,
  searchAreaMode,
} from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import type { HomeLocation, SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

const MAX_SEARCH_AREAS = 5;

function toVerifiedAreas(areas: SearchArea[]): VerifiedSearchArea[] {
  return areas
    .filter((area) => area.provider === "geoapify")
    .map((area) => ({
      label: area.label,
      lat: area.lat,
      lng: area.lng,
      provider: "geoapify",
      placeId: area.placeId,
      searchMode: searchAreaMode(area),
      resultType: area.resultType,
    }));
}

function areasKey(areas: VerifiedSearchArea[]): string {
  return JSON.stringify(
    areas.map(({ label, lat, lng, provider, placeId, searchMode, resultType }) => ({
      label,
      lat,
      lng,
      provider,
      placeId,
      searchMode: searchMode === "boundary" ? "boundary" : "point",
      resultType: resultType ?? null,
    })),
  );
}

export function GroupSearchSettingsSection({
  groupId,
  initialName,
  initialEmoji,
  initialSearchAreas,
  initialRadius,
  initialHome,
  onDirtyChange,
}: {
  groupId: string;
  initialName: string;
  initialEmoji: string;
  initialSearchAreas: SearchArea[];
  initialRadius: SearchRadiusKm;
  initialHome: HomeLocation | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const initialAreas = React.useMemo(
    () => toVerifiedAreas(initialSearchAreas),
    [initialSearchAreas],
  );
  const [name, setName] = React.useState(initialName);
  const [emoji, setEmoji] = React.useState(initialEmoji);
  const [areas, setAreas] = React.useState<VerifiedSearchArea[]>(initialAreas);
  const [radius, setRadius] = React.useState<SearchRadiusKm>(initialRadius);
  const [locationText, setLocationText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(() => ({
    name: initialName.trim(),
    emoji: initialEmoji,
    areas: areasKey(initialAreas),
    radius: initialRadius,
  }));
  const { refreshGroups } = useSession();

  const dirty =
    name.trim() !== saved.name ||
    emoji !== saved.emoji ||
    areasKey(areas) !== saved.areas ||
    radius !== saved.radius;

  React.useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const atAreaLimit = areas.length >= MAX_SEARCH_AREAS;
  const broadLegacyPoints = areas.filter(
    (area) =>
      area.searchMode !== "boundary" && isBroadAdministrativeSearchArea(area.resultType, area.label),
  );
  const boundaryCount = areas.filter((area) => area.searchMode === "boundary").length;
  const legacyOnly = areas.length === 0 && !!initialHome && !initialHome.verified;

  function addArea(value: VerifiedSearchArea) {
    if (areas.some((area) => area.placeId === value.placeId)) {
      toast.info("Det området finns redan i gruppen.");
      setLocationText("");
      return;
    }
    if (atAreaLimit) {
      toast.error("En grupp kan ha högst fem sökområden.");
      return;
    }
    setAreas((current) => [...current, value]);
    setLocationText("");
  }

  async function save() {
    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      toast.error("Gruppnamnet måste vara minst två tecken.");
      return;
    }
    setBusy(true);
    try {
      await updateGroupSettings(groupId, {
        name: normalizedName,
        emoji,
        homeLocation: null,
      });
      await replaceGroupSearchSettings(groupId, areas, radius);
      await refreshGroups();
      setName(normalizedName);
      setSaved({ name: normalizedName, emoji, areas: areasKey(areas), radius });
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
      toast.success("Gruppen är uppdaterad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Grunduppgifter och sökning</h3>
      <Card className="space-y-4 rounded-2xl border-border/70 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="gs-name">Namn</Label>
          <Input id="gs-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gs-emoji">Emoji</Label>
          <Input
            id="gs-emoji"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            maxLength={4}
          />
        </div>

        <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Vanliga sökområden</div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Alla är valda när sökningen öppnas och kan avmarkeras tillfälligt.
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {areas.length} av {MAX_SEARCH_AREAS}
            </span>
          </div>

          {areas.length > 0 ? (
            <div
              className="flex min-w-0 flex-wrap gap-1.5"
              role="list"
              aria-label="Sparade sökområden"
            >
              {areas.map((area) => (
                <SearchAreaPill
                  key={`${area.provider}:${area.placeId}`}
                  area={area}
                  onRemove={() =>
                    setAreas((current) => current.filter((item) => item.placeId !== area.placeId))
                  }
                  removeAriaLabel={`Ta bort ${area.label} från gruppens sökområden`}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-2.5 text-xs text-muted-foreground">
              Inga vanliga sökområden ännu. Ni kan fortfarande välja ett område direkt i sökningen.
            </p>
          )}

          {boundaryCount > 0 ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {boundaryCount === 1 ? "Ett område söks" : `${boundaryCount} områden söks`} inom sin
              verifierade geografiska gräns.
            </p>
          ) : null}

          {atAreaLimit ? (
            <p className="text-[11px] text-muted-foreground">
              Fem områden är valda. Ta bort ett för att lägga till ett annat.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="gs-add-area" className="text-xs">
                Lägg till område
              </Label>
              <GeoapifyLocationInput
                id="gs-add-area"
                value={locationText}
                onChange={setLocationText}
                onSelect={addArea}
                placeholder="Sök kommun, ort, stadsdel eller adress"
                disabled={busy}
                allowBoundaryAreas
              />
            </div>
          )}

          {broadLegacyPoints.length > 0 ? (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Ett äldre brett val behåller sitt tidigare punktbeteende. Ta bort och välj området igen
              om ni vill använda dess verifierade geografiska gräns.
            </p>
          ) : null}
          {legacyOnly ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Gruppen har ett äldre område ({initialHome?.label}). Välj det igen från listan.
            </p>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="gs-radius" className="text-xs">
              Avstånd runt adresser och platser
            </Label>
            <Select
              value={String(radius)}
              onValueChange={(value) => setRadius(Number(value) as SearchRadiusKm)}
              disabled={busy}
            >
              <SelectTrigger id="gs-radius" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH_RADIUS_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value === 50 ? "Större avstånd · inom 50 km" : `Inom ${value} km`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Gäller punktbaserade val som adresser. Boundaryområden söks inom sin egen gräns.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {dirty ? "Osparade ändringar" : "Alla ändringar är sparade"}
          </span>
          <Button onClick={() => void save()} disabled={busy || !dirty} className="min-h-11">
            {busy ? "Sparar…" : "Spara ändringar"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
