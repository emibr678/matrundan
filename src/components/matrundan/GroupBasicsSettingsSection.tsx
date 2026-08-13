import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGroupSettings } from "@/lib/matrundan/live-admin";
import { useSession } from "@/lib/matrundan/session";

export function GroupBasicsSettingsSection({
  groupId,
  initialName,
  initialEmoji,
  onDirtyChange,
}: {
  groupId: string;
  initialName: string;
  initialEmoji: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [name, setName] = React.useState(initialName);
  const [emoji, setEmoji] = React.useState(initialEmoji);
  const [saved, setSaved] = React.useState(() => ({
    name: initialName.trim(),
    emoji: initialEmoji,
  }));
  const [busy, setBusy] = React.useState(false);
  const { refreshGroups } = useSession();

  const dirty = name.trim() !== saved.name || emoji !== saved.emoji;

  React.useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

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
      await refreshGroups();
      setName(normalizedName);
      setSaved({ name: normalizedName, emoji });
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
      toast.success("Gruppens uppgifter är uppdaterade.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Gruppens uppgifter</h3>
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
