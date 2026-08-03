import * as React from "react";
import { ChevronDown, Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  listPlaceShareTargets,
  shareVisitToGroup,
  type PlaceShareTarget,
} from "@/lib/matrundan/live-sharing";
import { useSession } from "@/lib/matrundan/session";
import { defaultShareGroupIds, toggleAllSelection } from "@/lib/matrundan/sharing-selection";
import { useStore } from "@/lib/matrundan/store";
import type { VisitParticipant } from "@/lib/matrundan/types";
import { RatingInput } from "./Rating";
import { ShareVisitDialog } from "./ShareVisitDialog";
import { VisitPhotoField } from "./VisitPhotoField";

const MEALS = ["frukost", "lunch", "fika", "middag", "kväll"] as const;
const MEAL_LABEL: Record<(typeof MEALS)[number], string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

interface DraftGuest {
  id: string;
  name: string;
}

function normalizeGuestName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

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
  const [shareTargetsError, setShareTargetsError] = React.useState<string | null>(null);
  const shareableGroups = React.useMemo(
    () => shareTargets.filter((group) => group.groupId !== activeGroupId),
    [shareTargets, activeGroupId],
  );
  const showShareSection =
    mode === "live" && state.group.lifecycleStatus !== "archived" && !!activeGroupId;
  const canShare = showShareSection && shareableGroups.length > 0;
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
  const [guests, setGuests] = React.useState<DraftGuest[]>([]);
  const [guestInputOpen, setGuestInputOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [shareGroupIds, setShareGroupIds] = React.useState<string[]>([]);
  const [shareComment, setShareComment] = React.useState(false);
  const hasComment = comment.trim().length > 0;
  const allShareGroupsSelected =
    shareableGroups.length > 0 &&
    shareableGroups.every((group) => shareGroupIds.includes(group.groupId));

  React.useEffect(() => {
    if (!open) {
      setMeal("middag");
      setDate(new Date().toISOString().slice(0, 10));
      setOverall(0);
      setParticipants([state.currentUserId]);
      setGuests([]);
      setGuestInputOpen(false);
      setGuestName("");
      setTaste(0);
      setValue(0);
      setService(0);
      setComment("");
      setShowDetails(false);
      setPhotoFile(null);
      setShareComment(false);
      setShareTargets([]);
      setShareTargetsError(null);
      setShareGroupIds([]);
    }
  }, [open, state.currentUserId]);

  React.useEffect(() => {
    if (!open || mode !== "live" || !placeId) return;
    let cancelled = false;
    setShareTargetsLoading(true);
    setShareTargetsError(null);
    listPlaceShareTargets(placeId)
      .then((targets) => {
        if (cancelled) return;
        setShareTargets(targets);
        setShareGroupIds(defaultShareGroupIds(targets, activeGroupId));
      })
      .catch(() => {
        if (cancelled) return;
        setShareTargets([]);
        setShareGroupIds([]);
        setShareTargetsError("Dina andra grupper kunde inte hämtas just nu.");
      })
      .finally(() => {
        if (!cancelled) setShareTargetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeGroupId, open, mode, placeId]);

  if (!place) return null;

  const toggleParticipant = (id: string) =>
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleShareGroup = (id: string) =>
    setShareGroupIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  function addGuest() {
    const name = normalizeGuestName(guestName);
    if (!name) {
      toast.error("Skriv gästens namn.");
      return;
    }
    if (name.length > 60) {
      toast.error("Gästnamnet får vara högst 60 tecken.");
      return;
    }
    if (guests.length >= 10) {
      toast.error("Högst 10 gäster kan läggas till.");
      return;
    }
    setGuests((current) => [...current, { id: `guest-${Date.now()}-${current.length}`, name }]);
    setGuestName("");
  }

  const submit = async () => {
    if (isBusy) return;
    if (participants.length === 0) {
      toast.error("Välj minst en gruppmedlem som faktiskt deltog.");
      return;
    }
    if (overall < 1) {
      toast.error("Ge ett helhetsbetyg");
      return;
    }

    const participantSnapshots: VisitParticipant[] = [
      ...state.members
        .filter((member) => participants.includes(member.id))
        .map((member) => ({
          id: member.id,
          name: member.name,
          avatar: member.avatar ?? null,
          avatarImage: member.avatarImage ?? null,
          status: "active" as const,
        })),
      ...guests.map((guest) => ({
        id: guest.id,
        name: guest.name,
        avatar: "👤",
        avatarImage: null,
        status: "guest" as const,
      })),
    ];

    setBusy(true);
    try {
      const created = await addVisit({
        placeId: place.id,
        date: new Date(date).toISOString(),
        meal,
        participantIds: participants,
        participants: participantSnapshots,
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

      const targets = canShare && created?.id ? shareGroupIds : [];
      const failed: string[] = [];
      let sharedCount = 0;
      for (const groupId of targets) {
        try {
          await shareVisitToGroup(created.id, groupId, hasComment ? shareComment : false);
          sharedCount += 1;
        } catch {
          failed.push(
            shareableGroups.find((group) => group.groupId === groupId)?.name ?? "en grupp",
          );
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
    } catch (error) {
      toast.error((error as Error).message || "Kunde inte spara besöket.");
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
                onChange={(event) => setDate(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tillfälle</Label>
              <Select value={meal} onValueChange={(value) => setMeal(value as typeof meal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEALS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {MEAL_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Deltagare</legend>
            <p className="text-xs text-muted-foreground">
              Välj vilka som faktiskt deltog. Du är förvald.
            </p>
            <div className="flex flex-wrap gap-2">
              {state.members.map((member) => {
                const active = participants.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleParticipant(member.id)}
                    aria-pressed={active}
                    aria-label={`${active ? "Ta bort" : "Lägg till"} ${member.name} som deltagare`}
                    className="min-h-11 rounded-full"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="min-h-9 cursor-pointer gap-1 rounded-full px-3 py-1"
                    >
                      <span aria-hidden>{member.avatar}</span>
                      <span>{member.name}</span>
                    </Badge>
                  </button>
                );
              })}
            </div>

            {guests.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Tillagda gäster">
                {guests.map((guest) => (
                  <Badge
                    key={guest.id}
                    variant="secondary"
                    className="min-h-9 max-w-full gap-1 rounded-full pl-3 pr-1"
                  >
                    <span aria-hidden>👤</span>
                    <span className="truncate">{guest.name}</span>
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() =>
                        setGuests((current) => current.filter((item) => item.id !== guest.id))
                      }
                      aria-label={`Ta bort gästen ${guest.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            {guestInputOpen ? (
              <div className="flex min-w-0 gap-2">
                <Label htmlFor="visit-guest-name" className="sr-only">
                  Gästens namn
                </Label>
                <Input
                  id="visit-guest-name"
                  value={guestName}
                  maxLength={60}
                  placeholder="Gästens namn"
                  autoFocus
                  onChange={(event) => setGuestName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addGuest();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addGuest}
                  disabled={guests.length >= 10}
                >
                  Lägg till
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 w-fit rounded-full px-3 text-primary"
                onClick={() => setGuestInputOpen(true)}
              >
                <UserPlus className="h-4 w-4" /> Lägg till gäst
              </Button>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Gästen kopplas bara till besöket och blir inte medlem i gruppen. Vid delning visas
              gäster anonymt som ett antal.
            </p>
          </fieldset>

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
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              placeholder="En liten minnesnotering…"
            />
          </div>

          {showShareSection && shareTargetsLoading ? (
            <div
              role="status"
              className="flex min-h-11 items-center gap-2 rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Hämtar dina andra grupper…
            </div>
          ) : null}

          {showShareSection && shareTargetsError ? (
            <div
              role="alert"
              className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm"
            >
              <p>{shareTargetsError}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Besöket kan fortfarande sparas i den här gruppen.
              </p>
            </div>
          ) : null}

          {canShare && !shareTargetsLoading && !shareTargetsError ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Dela med dina andra grupper</Label>
                  <p className="text-xs text-muted-foreground">
                    Besöket och matstället läggs till i de valda grupperna. Ursprungsgrupp, privata
                    kommentarer, gästnamn och andra gruppers medlemmar syns aldrig.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setShareGroupIds(
                      toggleAllSelection(
                        shareableGroups.map((group) => group.groupId),
                        shareGroupIds,
                      ),
                    )
                  }
                  disabled={isBusy}
                  className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {allShareGroupsSelected ? "Rensa val" : "Välj alla"}
                </button>
              </div>
              <div className="space-y-2">
                {shareableGroups.map((group) => {
                  const checked = shareGroupIds.includes(group.groupId);
                  return (
                    <label
                      key={group.groupId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-background px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleShareGroup(group.groupId)}
                        disabled={isBusy}
                        aria-label={`Dela besöket med ${group.name}`}
                      />
                      <span aria-hidden>{group.emoji ?? "🍽️"}</span>
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{group.name}</span>
                      {group.placeExistsInGroup ? (
                        <span className="shrink-0 text-xs text-muted-foreground">finns redan</span>
                      ) : null}
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
          <Button onClick={submit} disabled={isBusy || overall === 0} className="w-full sm:w-auto">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara besök
          </Button>
        </DialogFooter>
      </DialogContent>
      <ShareVisitDialog
        visitId={sharePayload?.visitId ?? null}
        currentGroupId={sharePayload?.groupId ?? ""}
        open={sharePayload !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSharePayload(null);
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
