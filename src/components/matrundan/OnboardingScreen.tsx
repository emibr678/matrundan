import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/matrundan/session";
import { toast } from "sonner";

const EMOJIS = ["🍝", "🥐", "🍜", "🍔", "🥗", "🍣", "🌮", "🍕", "🍽️"];

export function OnboardingScreen() {
  const { refreshGroups, selectGroup, signOut } = useSession();
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState("🍽️");
  const [location, setLocation] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ge din grupp ett namn.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_group_with_owner", {
        _name: name.trim(),
        _emoji: emoji,
        _home_label: location.trim() || undefined,
      });
      if (error) throw error;
      const groupId = data as unknown as string;
      await refreshGroups();
      if (groupId) selectGroup(groupId);
      toast.success("Din grupp är skapad!");
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte skapa gruppen. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-10">
      <Card className="w-full rounded-3xl p-6 shadow-sm">
        <div className="text-4xl">{emoji}</div>
        <h1 className="mt-3 font-display text-2xl font-semibold">
          Välkommen till Matrundan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Skapa er första grupp för att börja samla, välja och betygsätta
          matställen tillsammans. Du blir automatiskt ägare och kan bjuda in
          fler senare.
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

          <div className="space-y-1.5">
            <Label htmlFor="group-location">Hemområde (valfritt)</Label>
            <Input
              id="group-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="t.ex. Göteborg eller Söder, Stockholm"
            />
            <p className="text-xs text-muted-foreground">
              Endast förslag vid sökning. Ni kan alltid lägga till ställen var som
              helst.
            </p>
          </div>

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
