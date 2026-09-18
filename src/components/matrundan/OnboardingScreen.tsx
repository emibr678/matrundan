import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/matrundan/session";
import { toast } from "sonner";
import {
  createGroupWithOwner,
  GROUP_DESCRIPTION_MAX_LENGTH,
  type VerifiedSearchArea,
} from "@/lib/matrundan/live-admin";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";

const EMOJIS = ["🍝", "🥐", "🍜", "🍔", "🥗", "🍣", "🌮", "🍕", "🍽️"];

export function OnboardingScreen() {
  const { refreshGroups, selectGroup, signOut } = useSession();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [emoji, setEmoji] = React.useState("🍽️");
  const [locationText, setLocationText] = React.useState("");
  const [verified, setVerified] = React.useState<VerifiedSearchArea | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);

  const locHasText = locationText.trim().length > 0;
  const locMatchesVerified = !!verified && locationText.trim() === verified.label.trim();
  const locInvalid = locHasText && !locMatchesVerified;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ge din grupp ett namn.");
      return;
    }
    if (locInvalid) {
      toast.error("Välj sökområdet från listan eller lämna fältet tomt.");
      return;
    }
    setBusy(true);
    try {
      const groupId = await createGroupWithOwner(
        name.trim(),
        emoji,
        description.trim() || null,
        locMatchesVerified ? verified : null,
      );
      await refreshGroups();
      if (groupId) selectGroup(groupId);
      toast.success("Din grupp är skapad!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Kunde inte skapa gruppen. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-10">
      <Card className="w-full rounded-3xl p-6 shadow-sm">
        <div className="text-4xl">{emoji}</div>
        <h1 className="mt-3 font-display text-2xl font-semibold">Välkommen till Matrundan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Skapa er första grupp för att börja samla, välja och betygsätta matställen tillsammans. Du
          blir automatiskt ägare och kan bjuda in fler senare.
        </p>

        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Gruppens namn</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Fredagsgänget"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="group-description">Kort beskrivning (valfritt)</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
              rows={3}
              placeholder="t.ex. Vi utforskar matställen nära där vi bor."
              className="resize-none"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              En kort mening om gruppens gemensamma matresa. Den går att ändra senare.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={emoji === e}
                  onClick={() => setEmoji(e)}
                  className={[
                    "h-10 w-10 rounded-xl border text-xl transition",
                    emoji === e
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:bg-muted",
                  ].join(" ")}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <Collapsible open={locationOpen} onOpenChange={setLocationOpen}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className="w-full justify-between">
                Lägg till vanligt sökområde (valfritt)
                <ChevronDown
                  className={[
                    "h-4 w-4 transition-transform",
                    locationOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-location">Vanligt sökområde (valfritt)</Label>
                <GeoapifyLocationInput
                  id="group-location"
                  value={locationText}
                  onChange={(text) => {
                    setLocationText(text);
                    if (verified && text !== verified.label) setVerified(null);
                  }}
                  onSelect={(v) => {
                    setVerified({
                      label: v.label,
                      lat: v.lat,
                      lng: v.lng,
                      provider: "geoapify",
                      placeId: v.placeId,
                      searchMode: v.searchMode ?? "point",
                      resultType: v.resultType,
                    });
                    setLocationText(v.label);
                  }}
                  onClearVerified={() => setVerified(null)}
                  placeholder="t.ex. Värmdö kommun eller Gamla Enskede"
                  allowBoundaryAreas
                />
                {locInvalid ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Välj sökområdet från listan eller lämna fältet tomt.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Områden med verifierad gräns söks inom hela området. Adresser och andra punktval
                  använder gruppens sökavstånd.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="ghost" onClick={() => void signOut()}>
              Logga ut
            </Button>
            <Button type="submit" disabled={busy} className="min-w-32">
              {busy ? "Skapar…" : "Skapa grupp"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
