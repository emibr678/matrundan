import * as React from "react";
import { toast } from "sonner";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createGroupWithOwner,
  type VerifiedSearchArea,
} from "@/lib/matrundan/live-admin";
import { SEARCH_RADIUS_OPTIONS } from "@/lib/matrundan/search-areas";
import { useSession } from "@/lib/matrundan/session";
import type { SearchRadiusKm } from "@/lib/matrundan/types";

const EMOJIS = ["🍝", "🥐", "🍜", "🍔", "🥗", "🍣", "🌮", "🍕", "🍽️"];

export function CreateGroupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { refreshGroups, selectGroup } = useSession();
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("🍽️");
  const [locationText, setLocationText] = React.useState("");
  const [verified, setVerified] = React.useState<VerifiedSearchArea | null>(null);
  const [radius, setRadius] = React.useState<SearchRadiusKm>(1);
  const [busy, setBusy] = React.useState(false);

  const locHasText = locationText.trim().length > 0;
  const locMatchesVerified = !!verified && locationText.trim() === verified.label.trim();
  const locInvalid = locHasText && !locMatchesVerified;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Ge din grupp ett namn.");
    if (locInvalid) {
      toast.error("Välj sökområdet från listan eller lämna fältet tomt.");
      return;
    }
    setBusy(true);
    try {
      const gid = await createGroupWithOwner(
        name.trim(),
        emoji,
        locMatchesVerified && verified ? [verified] : [],
        radius,
      );
      await refreshGroups();
      if (gid) selectGroup(gid);
      toast.success("Gruppen är skapad!");
      onOpenChange(false);
      setName("");
      setLocationText("");
      setVerified(null);
      setRadius(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa gruppen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skapa ny grupp</DialogTitle>
          <DialogDescription>
            Du blir automatiskt ägare. Du kan bjuda in fler och lägga till fler sökområden efteråt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cg-name">Gruppens namn</Label>
            <Input
              id="cg-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="t.ex. Fredagsgänget"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={emoji === option}
                  onClick={() => setEmoji(option)}
                  className={
                    "h-10 w-10 rounded-xl border text-xl transition " +
                    (emoji === option
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:bg-muted")
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-loc">Första sökområdet (valfritt)</Label>
            <GeoapifyLocationInput
              id="cg-loc"
              value={locationText}
              onChange={(text) => {
                setLocationText(text);
                if (verified && text !== verified.label) setVerified(null);
              }}
              onSelect={(value) => {
                setVerified({
                  label: value.label,
                  lat: value.lat,
                  lng: value.lng,
                  provider: "geoapify",
                  placeId: value.placeId,
                });
                setLocationText(value.label);
              }}
              onClearVerified={() => setVerified(null)}
              placeholder="t.ex. Gamla Enskede, Stockholm"
            />
            {locInvalid ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Välj sökområdet från listan eller lämna fältet tomt.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Området blir förvalt i sökningen. Fler områden läggs till i gruppinställningarna.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-radius">Vanlig sökradie</Label>
            <Select
              value={String(radius)}
              onValueChange={(value) => setRadius(Number(value) as SearchRadiusKm)}
            >
              <SelectTrigger id="cg-radius" className="min-h-11">
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
              Samma radie används runt alla gruppens valda sökområden.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Skapar…" : "Skapa grupp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
