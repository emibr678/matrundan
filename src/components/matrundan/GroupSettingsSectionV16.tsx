import * as React from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";
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
import { Switch } from "@/components/ui/switch";
import {
  replaceGroupSearchSettings,
  updateGroupSettings,
  type VerifiedSearchArea,
} from "@/lib/matrundan/live-admin";
import { SEARCH_RADIUS_OPTIONS } from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import type { HomeLocation, SearchArea, SearchRadiusKm } from "@/lib/matrundan/types";

export function GroupSettingsSectionV16({
  groupId,
  initialName,
  initialEmoji,
  initialSearchAreas,
  initialRadius,
  initialHome,
  initialShareCounts,
}: {
  groupId: string;
  initialName: string;
  initialEmoji: string;
  initialSearchAreas: SearchArea[];
  initialRadius: SearchRadiusKm;
  initialHome: HomeLocation | null;
  initialShareCounts: boolean;
}) {
  const [name, setName] = React.useState(initialName);
  const [emoji, setEmoji] = React.useState(initialEmoji);
  const [areas, setAreas] = React.useState<VerifiedSearchArea[]>(() =>
    initialSearchAreas
      .filter((area) => area.provider === "geoapify")
      .map((area) => ({
        label: area.label,
        lat: area.lat,
        lng: area.lng,
        provider: "geoapify",
        placeId: area.placeId,
      })),
  );
  const [radius, setRadius] = React.useState<SearchRadiusKm>(initialRadius);
  const [locationText, setLocationText] = React.useState("");
  const [candidate, setCandidate] = React.useState<VerifiedSearchArea | null>(null);
  const [shareCounts, setShareCounts] = React.useState(initialShareCounts);
  const [busy, setBusy] = React.useState(false);
  const { refreshGroups } = useSession();

  const candidateMatchesText =
    !!candidate && candidate.label.trim() === locationText.trim() && locationText.trim().length > 0;
  const duplicateCandidate =
    candidateMatchesText && areas.some((area) => area.placeId === candidate?.placeId);
  const legacyOnly = areas.length === 0 && !!initialHome && !initialHome.verified;

  function addArea() {
    if (!candidateMatchesText || !candidate) {
      toast.error("Välj sökområdet från listan.");
      return;
    }
    if (areas.length >= 5) {
      toast.error("En grupp kan ha högst fem sökområden.");
      return;
    }
    if (duplicateCandidate) {
      toast.info("Det området finns redan i gruppen.");
      return;
    }
    setAreas((current) => [...current, candidate]);
    setLocationText("");
    setCandidate(null);
  }

  async function save() {
    if (name.trim().length < 2) {
      toast.error("Gruppnamnet måste vara minst två tecken.");
      return;
    }
    setBusy(true);
    try {
      await updateGroupSettings(groupId, {
        name: name.trim(),
        emoji,
        homeLocation: null,
        sharedVisitsCountForProgression: shareCounts,
      });
      await replaceGroupSearchSettings(groupId, areas, radius);
      await refreshGroups();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("matrundan:reload"));
      }
      toast.success("Gruppen är uppdaterad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Gruppinställningar</h3>
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

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div>
            <div className="text-sm font-medium">Vanliga sökområden</div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Alla områden är valda när någon söker. De kan tillfälligt avmarkeras i sökningen.
            </p>
          </div>

          {areas.length > 0 ? (
            <div className="space-y-2" aria-label="Sparade sökområden">
              {areas.map((area) => (
                <div
                  key={`${area.provider}:${area.placeId}`}
                  className="flex min-w-0 items-start gap-2 rounded-xl border border-border/60 bg-background p-3"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 break-words text-sm">{area.label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() =>
                      setAreas((current) => current.filter((item) => item.placeId !== area.placeId))
                    }
                    aria-label={`Ta bort ${area.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
              Gruppen har inga verifierade sökområden ännu. Ni kan fortfarande välja en annan plats
              direkt i sökningen.
            </p>
          )}

          {legacyOnly ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Gruppen har ett äldre område ({initialHome?.label}). Välj det igen från listan för att
              använda det i den nya sökningen.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="gs-add-area">Lägg till sökområde</Label>
            <GeoapifyLocationInput
              id="gs-add-area"
              value={locationText}
              onChange={(text) => {
                setLocationText(text);
                if (candidate && text !== candidate.label) setCandidate(null);
              }}
              onSelect={(value) => {
                setCandidate({
                  label: value.label,
                  lat: value.lat,
                  lng: value.lng,
                  provider: "geoapify",
                  placeId: value.placeId,
                });
                setLocationText(value.label);
              }}
              onClearVerified={() => setCandidate(null)}
              placeholder="t.ex. Gamla Enskede, Stockholm"
              ariaInvalid={locationText.trim().length > 0 && !candidateMatchesText}
            />
            {duplicateCandidate ? (
              <p className="text-xs text-muted-foreground">Det området finns redan i gruppen.</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={busy || !candidateMatchesText || duplicateCandidate || areas.length >= 5}
              onClick={addArea}
            >
              <Plus className="h-4 w-4" /> Lägg till område
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gs-radius">Vanlig sökradie</Label>
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
                    {value === 50 ? "Större område · inom 50 km" : `Inom ${value} km`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Samma radie används runt alla valda områden och kan ändras för en enskild sökning.
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="text-sm font-medium">Delade besök</div>
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="gs-share-counts" className="text-sm font-normal">
              Räkna delade besök i progression
            </Label>
            <Switch
              id="gs-share-counts"
              checked={shareCounts}
              onCheckedChange={setShareCounts}
              disabled={busy}
            />
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Delade besök syns alltid i historik, besöksstatus och betyg. Inställningen påverkar bara
            framtida nivåer och märken.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={busy} className="min-h-11">
            {busy ? "Sparar…" : "Spara"}
          </Button>
        </div>
      </Card>
    </section>
  );
}
