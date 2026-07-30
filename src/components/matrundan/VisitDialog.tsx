import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { RatingInput } from "./Rating";
import { useStore } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import { ShareVisitDialog } from "./ShareVisitDialog";
import { VisitPhotoField } from "./VisitPhotoField";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  listPlaceShareTargets,
  shareVisitToGroup,
  type PlaceShareTarget,
} from "@/lib/matrundan/live-sharing";

const MEALS = ["frukost", "lunch", "fika", "middag", "kväll"] as const;
const MEAL_LABEL: Record<(typeof MEALS)[number], string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

export function VisitDialog({
  open,
  onOpenChange,
  placeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  placeId: string | null;
}) {
  const { addVisit, saveVisitPhoto, state, getPlace, submitting, mode } = useStore();
  const { activeGroupId } = useSession();
  const [shareTargets, setShareTargets] = React.useState<PlaceShareTarget[]>([]);
  const [shareTargetsLoading, setShareTargetsLoading] = React.useState(false);
  const shareableGroups = React.useMemo(
    () => shareTargets.filter((group) => group.groupId !== activeGroupId),
    [shareTargets, activeGroupId],
  );
  const canShare =
    mode === "live" &&
    state.group.lifecycleStatus !== "archived" &&
    !!activeGroupId &&
    shareableGroups.length > 0;
  const [busy, setBusy] = React.useState(false);
  const [sharePayload, setSharePayload] = React.useState<{
    visitId: string;
    groupId: string;
  } | null>(null);
  const isBusy = busy || submitting;
  const place = placeId ? getPlace(placeId) : undefined;

  const [meal, setMeal] = React.useState<(typeof MEALS)[number]>("middag");
  const [date, setDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [overall, setOverall] = React.useState(0);
  const [participants, setParticipants] = React.useState<string[]>([state.currentUserId]);
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [shareGroupIds, setShareGroupIds] = React.useState<string[]>([]);
  const [shareComment, setShareComment] = React.useState(false);
  const hasComment = comment.trim().length > 0;

  React.useEffect(() => {
    if (!open) {
      setMeal("middag");
      setDate(new Date().toISOString().slice(0, 10));
      setOverall(0);
      setParticipants([state.currentUserId]);
      setTaste(0);
      setValue(0);
      setService(0);
      setComment("");
      setShowDetails(false);
      setPhotoFile(null);
      setShareComment(false);
      setShareTargets([]);
      setShareGroupIds([]);
    }
  }, [open, state.currentUserId]);

  // Hämta delningsmål när dialogen öppnas. Förval endast grupper där stället redan finns.
  React.useEffect(() => {
    if (!open || mode !== "live" || !placeId) return;
    let cancelled = false;
    setShareTargetsLoading(true);
    listPlaceShareTargets(placeId)
      .then((targets) => {
        if (cancelled) return;
        setShareTargets(targets);
        setShareGroupIds(targets.filter((t) => t.placeExistsInGroup).map((t) => t.groupId));
      })
      .catch(() => {
        if (cancelled) return;
        setShareTargets([]);
      })
      .finally(() => {
        if (!cancelled) setShareTargetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, placeId]);

  if (!place) return null;

  const toggleParticipant = (id: string) =>
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleShareGroup = (id: string) =>
    setShareGroupIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async () => {
    if (isBusy) return;
    if (participants.length === 0) {
      toast.error("Välj minst en deltagare");
      return;
    }
    if (overall < 1) {
      toast.error("Ge ett helhetsbetyg");
      return;
    }
    setBusy(true);
    try {
      const created = await addVisit({
        placeId: place.id,
        date: new Date(date).toISOString(),
        meal,
        participantIds: participants,
        overall,
        taste: taste || undefined,
        value: value || undefined,
        service: service || undefined,
        comment: comment.trim() || undefined,
        createdBy: state.currentUserId,
      });
      let photoError: Error | null = null;
      if (photoFile && created?.id) {
        try {
          await saveVisitPhoto(created.id, photoFile, created);
        } catch (error) {
          photoError = error instanceof Error ? error : new Error("Fotot kunde inte sparas.");
        }
      }

      // Dela vidare till de förkryssade grupperna. Besöket är kanoniskt och
      // skapas bara en gång – varje grupp får en delad länk till samma besök.
      const targets = canShare && created?.id ? shareGroupIds : [];
      const failed: string[] = [];
      let sharedCount = 0;
      for (const groupId of targets) {
        try {
          await shareVisitToGroup(created.id, groupId, hasComment ? shareComment : false);
          sharedCount += 1;
        } catch {
          failed.push(shareableGroups.find((g) => g.id === groupId)?.name ?? "en grupp");
        }
      }
      if (sharedCount > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("matrundan:reload"));
      }

      onOpenChange(false);
      toast.success("Besök registrerat", {
        description:
          sharedCount > 0
            ? `${place.name} · tillagt i ${sharedCount} ${sharedCount === 1 ? "grupp" : "grupper"} till`
            : place.name,
        duration: canShare && sharedCount === 0 ? 8000 : undefined,
        action:
          canShare && sharedCount === 0 && activeGroupId && created?.id
            ? {
                label: "Lägg till i annan grupp",
                onClick: () => setSharePayload({ visitId: created.id, groupId: activeGroupId }),
              }
            : undefined,
      });
      if (failed.length > 0) {
        toast.warning("Besöket kunde inte läggas till i alla grupper.", {
          description: failed.join(", "),
        });
      }
      if (photoError) {
        toast.warning("Besöket sparades utan foto.", { description: photoError.message });
      }
    } catch (e) {
      toast.error((e as Error).message || "Kunde inte spara besöket.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Registrera besök</DialogTitle>
          <DialogDescription>
            {place.name} · {place.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Datum</Label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tillfälle</Label>
              <Select value={meal} onValueChange={(v) => setMeal(v as typeof meal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEALS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEAL_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Deltagare</Label>
            <div className="flex flex-wrap gap-2">
              {state.members.map((m) => {
                const active = participants.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    aria-pressed={active}
                    aria-label={`${active ? "Ta bort" : "Lägg till"} ${m.name} som deltagare`}
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="cursor-pointer gap-1 rounded-full px-3 py-1"
                    >
                      <span>{m.avatar}</span>
                      <span>{m.name}</span>
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-secondary/60 p-4">
            <RatingInput value={overall} onChange={setOverall} label="Helhetsbetyg" size={32} />
            <p className="mt-1 text-xs text-muted-foreground">
              {overall > 0 ? `${overall} av 5` : "Välj ett betyg för att kunna spara."}
            </p>
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium"
              >
                <span>Detaljbetyg (frivilligt)</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid gap-3">
                <RatingInput value={taste} onChange={setTaste} label="Smak" />
                <RatingInput value={value} onChange={setValue} label="Prisvärdhet" />
                <RatingInput value={service} onChange={setService} label="Service" />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <VisitPhotoField file={photoFile} onFileChange={setPhotoFile} disabled={isBusy} />

          <div className="space-y-1.5">
            <Label htmlFor="comment">Kommentar (frivilligt)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="En liten minnesnotering…"
            />
          </div>

          {canShare ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/40 p-4">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Dela med dina andra grupper</Label>
                <p className="text-xs text-muted-foreground">
                  Besöket läggs till i de valda grupperna. Ursprungsgrupp, privata kommentarer och
                  andra gruppers medlemmar syns aldrig.
                </p>
              </div>
              <div className="space-y-2">
                {shareableGroups.map((group) => {
                  const checked = shareGroupIds.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-background px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleShareGroup(group.id)}
                        disabled={isBusy}
                        aria-label={`Dela besöket med ${group.name}`}
                      />
                      <span aria-hidden>{group.emoji ?? "🍽️"}</span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{group.name}</span>
                    </label>
                  );
                })}
              </div>
              {hasComment && shareGroupIds.length > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                  <Label htmlFor="share-comment" className="text-sm font-normal">
                    Dela även min kommentar
                  </Label>
                  <Switch
                    id="share-comment"
                    checked={shareComment}
                    onCheckedChange={setShareComment}
                    disabled={isBusy}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            Avbryt
          </Button>
          <Button
            onClick={() => submit()}
            disabled={isBusy || overall === 0}
            className="w-full sm:w-auto"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara besök
          </Button>
        </DialogFooter>
      </DialogContent>
      <ShareVisitDialog
        visitId={sharePayload?.visitId ?? null}
        currentGroupId={sharePayload?.groupId ?? ""}
        open={sharePayload !== null}
        onOpenChange={(o) => {
          if (!o) setSharePayload(null);
        }}
        onShared={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("matrundan:reload"));
          }
        }}
      />
    </Dialog>
  );
}
