import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { clearLocalAccountSession, loadOwnProfile } from "@/lib/matrundan/account-client";
import {
  deleteOwnAccount,
  getAccountDeletionRequirements,
  type AccountDeletionRequirements,
} from "@/lib/matrundan/account.functions";
import { updateProfile } from "@/lib/matrundan/live-admin";
import { useSession } from "@/lib/matrundan/session";
import { NotificationSettingsSection } from "./NotificationSettingsSection";

const AVATAR_EMOJIS = [
  "🦊",
  "🐻",
  "🐝",
  "🦉",
  "🐿️",
  "🦔",
  "🐧",
  "🦆",
  "🐢",
  "🦩",
  "🍕",
  "🍜",
  "🥐",
  "🍣",
  "🥗",
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
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoaded(false);
    void (async () => {
      try {
        const profile = await loadOwnProfile();
        if (!profile) return;
        setDisplayName(profile.displayName);
        setEmoji(profile.avatarEmoji);
      } catch {
        toast.error("Kunde inte läsa profilen.");
      } finally {
        setLoaded(true);
      }
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Min profil</DialogTitle>
            <DialogDescription>Så här ser gruppen dig i Matrundan.</DialogDescription>
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

            <NotificationSettingsSection active={open} />

            <Card className="rounded-2xl border-destructive/25 p-4">
              <div className="text-sm font-medium">Radera konto</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tar bort dina personuppgifter och din inloggning. Gemensam besökshistorik
                anonymiseras.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-2 text-destructive hover:text-destructive"
                onClick={() => {
                  onOpenChange(false);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Radera mitt konto
              </Button>
            </Card>

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
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useSession();
  const [requirements, setRequirements] = React.useState<AccountDeletionRequirements | null>(null);
  const [successors, setSuccessors] = React.useState<Record<string, string>>({});
  const [confirmSolo, setConfirmSolo] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [step, setStep] = React.useState<1 | 2>(1);
  const [loading, setLoading] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadRequirements = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getAccountDeletionRequirements();
      setRequirements(result);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Kunde inte förbereda kontoborttagningen.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setRequirements(null);
    setSuccessors({});
    setConfirmSolo(false);
    setConfirmation("");
    setStep(1);
    void loadRequirements();
  }, [loadRequirements, open]);

  const successorGroups = requirements?.groups.filter((group) => group.requiresSuccessor) ?? [];
  const soloGroups = requirements?.groups.filter((group) => group.willBeDeleted) ?? [];
  const readyForConfirmation =
    successorGroups.every((group) => Boolean(successors[group.groupId])) &&
    (soloGroups.length === 0 || confirmSolo);

  async function removeAccount() {
    if (confirmation !== "RADERA" || !requirements || !readyForConfirmation) return;
    setDeleting(true);
    try {
      await deleteOwnAccount({
        data: {
          confirmation: "RADERA",
          confirmSoloGroupDeletion: confirmSolo,
          successors,
        },
      });
      try {
        await signOut();
      } catch {
        await clearLocalAccountSession();
      }
      onOpenChange(false);
      await navigate({ to: "/" });
      toast.success("Ditt konto är raderat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte radera kontot.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !deleting && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Radera ditt konto</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Kontrollera vad som händer med dina grupper och din historik."
              : "Det här går inte att ångra."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Förbereder…</p>
        ) : loadError ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" onClick={() => void loadRequirements()}>
              Försök igen
            </Button>
          </div>
        ) : requirements && step === 1 ? (
          <div className="space-y-4">
            <Card className="rounded-2xl border-border/70 p-4 text-sm">
              <p className="leading-relaxed text-muted-foreground">
                Ditt namn, din bild, dina kommentarer, favoriter och uppladdade bilder tas bort.
                Numeriska betyg och deltagande i genomförda besök finns kvar anonymt som{" "}
                <span className="font-medium text-foreground">Tidigare medlem</span>.
              </p>
            </Card>

            {successorGroups.map((group) => (
              <div key={group.groupId} className="space-y-1.5">
                <Label htmlFor={`successor-${group.groupId}`}>
                  Ny ägare för {group.emoji} {group.name}
                </Label>
                <Select
                  value={successors[group.groupId]}
                  onValueChange={(value) =>
                    setSuccessors((current) => ({ ...current, [group.groupId]: value }))
                  }
                >
                  <SelectTrigger id={`successor-${group.groupId}`}>
                    <SelectValue placeholder="Välj medlem" />
                  </SelectTrigger>
                  <SelectContent>
                    {group.candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.avatar ? `${candidate.avatar} ` : ""}
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {soloGroups.length > 0 ? (
              <Card className="rounded-2xl border-destructive/30 bg-destructive/[0.04] p-4">
                <div className="text-sm font-medium">Grupper som raderas permanent</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {soloGroups.map((group) => (
                    <li key={group.groupId}>
                      {group.emoji} {group.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Originalbesök från dessa grupper försvinner även om de har delats till en annan
                  grupp.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={confirmSolo}
                    onCheckedChange={(checked) => setConfirmSolo(checked === true)}
                    aria-label="Bekräfta permanent radering av ensamgrupper"
                  />
                  <span>Jag förstår och vill radera dessa grupper permanent.</span>
                </label>
              </Card>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button type="button" disabled={!readyForConfirmation} onClick={() => setStep(2)}>
                Fortsätt
              </Button>
            </DialogFooter>
          </div>
        ) : requirements ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirmation">Skriv RADERA för att bekräfta</Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={deleting} onClick={() => setStep(1)}>
                Tillbaka
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting || confirmation !== "RADERA"}
                onClick={() => void removeAccount()}
              >
                {deleting ? "Raderar…" : "Radera kontot permanent"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
