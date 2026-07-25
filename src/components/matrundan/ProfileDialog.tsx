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
import { supabase } from "@/integrations/supabase/client";
import { updateProfile } from "@/lib/matrundan/live-admin";

const AVATAR_EMOJIS = [
  "🦊", "🐻", "🐝", "🦉", "🐿️", "🦔", "🐧", "🦆", "🐢", "🦩",
  "🍕", "🍜", "🥐", "🍣", "🥗",
];

export function ProfileDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [displayName, setDisplayName] = React.useState("");
  const [emoji, setEmoji] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoaded(false);
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_emoji")
        .eq("id", uid)
        .maybeSingle();
      setDisplayName(data?.display_name ?? "");
      setEmoji(data?.avatar_emoji ?? null);
      setLoaded(true);
    })();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = displayName.trim();
    if (n.length < 2 || n.length > 50) {
      return toast.error("Namnet måste vara 2–50 tecken.");
    }
    setBusy(true);
    try {
      await updateProfile(n, emoji);
      toast.success("Profilen är uppdaterad.");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara profilen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Min profil</DialogTitle>
          <DialogDescription>
            Så här ser gruppen dig i Matrundan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pn">Namn</Label>
            <Input
              id="pn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!loaded}
              minLength={2}
              maxLength={50}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Avatar (valfri emoji)</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={emoji === null}
                onClick={() => setEmoji(null)}
                className={
                  "h-10 rounded-xl border px-3 text-xs transition " +
                  (emoji === null
                    ? "border-primary bg-primary/10"
                    : "border-border/70 hover:bg-muted")
                }
              >
                Ingen
              </button>
              {AVATAR_EMOJIS.map((e) => (
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
            <p className="text-xs text-muted-foreground">
              Utan emoji används din Google-bild om den finns.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={busy || !loaded}>
              {busy ? "Sparar…" : "Spara"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
