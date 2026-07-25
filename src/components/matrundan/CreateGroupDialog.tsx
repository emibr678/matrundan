import * as React from "react";
import { toast } from "sonner";
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
import { useSession } from "@/lib/matrundan/session";
import { createGroupWithOwner, type VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import { GeoapifyLocationInput } from "@/components/matrundan/GeoapifyLocationInput";

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
  const [verified, setVerified] = React.useState<VerifiedHomeLocation | null>(null);
  const [busy, setBusy] = React.useState(false);

  const locHasText = locationText.trim().length > 0;
  const locMatchesVerified = !!verified && locationText.trim() === verified.label.trim();
  const locInvalid = locHasText && !locMatchesVerified;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        locMatchesVerified ? verified : null,
      );
      await refreshGroups();
      if (gid) selectGroup(gid);
      toast.success("Gruppen är skapad!");
      onOpenChange(false);
      setName("");
      setLocationText("");
      setVerified(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte skapa gruppen.");
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
            Du blir automatiskt ägare. Du kan bjuda in fler efteråt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cg-name">Gruppens namn</Label>
            <Input
              id="cg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Fredagsgänget"
              autoFocus
              required
            />
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
                  className={
                    "h-10 w-10 rounded-xl border text-xl transition " +
                    (emoji === e
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:bg-muted")
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cg-loc">Förvalt sökområde (valfritt)</Label>
            <GeoapifyLocationInput
              id="cg-loc"
              value={locationText}
              onChange={(text) => {
                setLocationText(text);
                if (verified && text !== verified.label) setVerified(null);
              }}
              onSelect={(v) => {
                setVerified(v);
                setLocationText(v.label);
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
              Fylls i automatiskt när gruppen söker efter nya matställen. Kan alltid ändras för en
              enskild sökning.
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
