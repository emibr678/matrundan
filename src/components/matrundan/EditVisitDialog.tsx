import * as React from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import {
  listVisitShareTargets,
  shareVisitToGroup,
  type VisitShareTarget,
} from "@/lib/matrundan/live-sharing";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { reviewModelIncludesAtmosphere } from "@/lib/matrundan/review-model";
import type { Place, Visit } from "@/lib/matrundan/types";
import { VISIT_MEALS, VISIT_MEAL_LABEL, visitMealHasScore } from "@/lib/matrundan/visit-context";
import { canEditOriginalVisit } from "@/lib/matrundan/visit-permissions";
import { getOwnVisitPhoto } from "@/lib/matrundan/visit-photo";

interface DraftGuest {
  key: string;
  persistedId: string | null;
  name: string;
}

function normalizeGuestName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function persistedGuestId(id: string): string | null {
  if (!id.startsWith("guest:")) return null;
  const value = id.slice("guest:".length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export function EditVisitDialog({
  visit,
  place,
  open,
  onOpenChange,
  onSaved,
}: {
  visit: Visit;
  place: Place;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const { state, mode, demoReadOnly, submitting, updateVisit } = useStore();
  const { activeGroupId } = useSession();
  const groupArchived = state.group.lifecycleStatus === "archived";
  const canEdit = !demoReadOnly && canEditOriginalVisit(visit, state.currentUserId, groupArchived);

  const memberCandidates = React.useMemo(() => {
    const currentIds = new Set(state.members.map((member) => member.id));
    return [
      ...state.members.map((member) => ({
        id: member.id,
        name: member.name,
        avatar: member.avatar ?? "🙂",
        status: "active" as const,
      })),
      ...(visit.participants ?? [])
        .filter((participant) => participant.status === "left" && !currentIds.has(participant.id))
        .map((participant) => ({
          id: participant.id,
          name: participant.name,
          avatar: participant.avatar ?? "🙂",
          status: "left" as const,
        })),
    ];
  }, [state.members, visit.participants]);

  const ownReview = React.useMemo(
    () => (visit.visibleReviews ?? []).find((review) => review.userId === state.currentUserId),
    [state.currentUserId, visit.visibleReviews],
  );

  const [date, setDate] = React.useState(visit.date.slice(0, 10));
  const [meal, setMeal] = React.useState<Visit["meal"]>(visit.meal);
  const [isTakeaway, setIsTakeaway] = React.useState(visit.isTakeaway === true);
  const [participants, setParticipants] = React.useState<string[]>([]);
  const [guests, setGuests] = React.useState<DraftGuest[]>([]);
  const [guestInputOpen, setGuestInputOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [shareTargets, setShareTargets] = React.useState<VisitShareTarget[]>([]);
  const [shareLoading, setShareLoading] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [shareGroupIds, setShareGroupIds] = React.useState<string[]>([]);
  const [sharePhoto, setSharePhoto] = React.useState(false);
  const [shareComment, setShareComment] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmTakeaway, setConfirmTakeaway] = React.useState(false);

  const scoredVisit = visitMealHasScore(meal);
  const originalScored = visitMealHasScore(visit.meal);
  const scoreBoundaryChanged = scoredVisit !== originalScored;
  const isBusy = busy || submitting;
  const otherShareTargets = shareTargets.filter((target) => target.groupId !== activeGroupId);
  const selectedTargets = otherShareTargets.filter(
    (target) => !target.alreadyLinked && shareGroupIds.includes(target.groupId),
  );
  const hasOwnComment = Boolean(ownReview?.comment?.trim());
  const hasOwnPhoto = Boolean(getOwnVisitPhoto(visit, state.currentUserId));
  const takeawayChangesRatings =
    visit.isTakeaway !== true &&
    isTakeaway &&
    (visit.visibleReviews ?? []).some(
      (review) =>
        review.ratingVisible &&
        review.atmosphere != null &&
        reviewModelIncludesAtmosphere(review.reviewModel),
    );

  React.useEffect(() => {
    if (!open) return;

    setDate(visit.date.slice(0, 10));
    setMeal(visit.meal);
    setIsTakeaway(visit.isTakeaway === true);

    const editableIds = new Set(memberCandidates.map((member) => member.id));
    const initialParticipants = visit.participantIds.filter((id) => editableIds.has(id));
    setParticipants(
      initialParticipants.includes(state.currentUserId)
        ? initialParticipants
        : [state.currentUserId, ...initialParticipants],
    );

    setGuests(
      (visit.participants ?? [])
        .filter((participant) => participant.status === "guest")
        .map((participant) => ({
          key: participant.id,
          persistedId: mode === "live" ? persistedGuestId(participant.id) : null,
          name: participant.name,
        })),
    );
    setGuestInputOpen(false);
    setGuestName("");
    setShareGroupIds([]);
    setSharePhoto(hasOwnPhoto);
    setShareComment(hasOwnComment);
    setConfirmTakeaway(false);
  }, [
    memberCandidates,
    mode,
    open,
    hasOwnComment,
    hasOwnPhoto,
    ownReview,
    state.currentUserId,
    visit.date,
    visit.id,
    visit.isTakeaway,
    visit.meal,
    visit.participantIds,
    visit.participants,
  ]);

  React.useEffect(() => {
    if (meal === "dryck") setIsTakeaway(false);
  }, [meal]);

  React.useEffect(() => {
    if (!open || mode !== "live" || !activeGroupId) {
      setShareTargets([]);
      setShareError(null);
      return;
    }

    let cancelled = false;
    setShareLoading(true);
    setShareError(null);
    listVisitShareTargets(visit.id)
      .then((targets) => {
        if (!cancelled) setShareTargets(targets);
      })
      .catch((error) => {
        if (cancelled) return;
        setShareTargets([]);
        setShareError(
          error instanceof Error ? error.message : "Dina andra grupper kunde inte hämtas just nu.",
        );
      })
      .finally(() => {
        if (!cancelled) setShareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeGroupId, mode, open, visit.id]);

  function toggleParticipant(id: string) {
    if (id === state.currentUserId) return;
    setParticipants((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleShareTarget(groupId: string) {
    const removing = shareGroupIds.includes(groupId);
    setShareGroupIds((current) =>
      removing ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

  function closeGuestInput() {
    setGuestInputOpen(false);
    setGuestName("");
  }

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
      toast.error("Högst 10 gäster kan finnas på ett besök.");
      return;
    }
    setGuests((current) => [
      ...current,
      { key: `new-${Date.now()}-${current.length}`, persistedId: null, name },
    ]);
    closeGuestInput();
  }

  function validate(): boolean {
    if (!participants.includes(state.currentUserId)) {
      toast.error("Den som registrerade besöket måste vara deltagare.");
      return false;
    }
    return true;
  }

  async function save() {
    if (!canEdit || isBusy || !validate()) return;

    const initialGuestIds = new Set(
      (visit.participants ?? [])
        .filter((participant) => participant.status === "guest")
        .map((participant) => persistedGuestId(participant.id))
        .filter((id): id is string => Boolean(id)),
    );
    const keptGuestIds = new Set(
      guests.map((guest) => guest.persistedId).filter((id): id is string => Boolean(id)),
    );
    const removedGuestIds = [...initialGuestIds].filter((id) => !keptGuestIds.has(id));

    setBusy(true);
    try {
      await updateVisit(visit.id, {
        visitedOn: date,
        meal,
        isTakeaway: scoredVisit ? isTakeaway : false,
        participantIds: participants,
        guests: guests.map((guest) => ({ id: guest.persistedId, name: guest.name })),
        removedGuestIds,
      });

      let sharedCount = 0;
      const failed: string[] = [];
      for (const target of selectedTargets) {
        try {
          await shareVisitToGroup(
            visit.id,
            target.groupId,
            hasOwnComment ? shareComment : false,
            false,
            hasOwnPhoto ? sharePhoto : false,
          );
          sharedCount += 1;
        } catch {
          failed.push(target.name);
        }
      }

      if (sharedCount > 0 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("matrundan:reload"));
      }
      await onSaved();
      onOpenChange(false);
      toast.success("Besöket är uppdaterat.", {
        description:
          sharedCount > 0
            ? `Ändringarna sparades och besöket lades till i ${sharedCount} ${sharedCount === 1 ? "grupp" : "grupper"} till.`
            : place.name,
      });
      if (failed.length > 0) {
        toast.warning("Besöket kunde inte läggas till i alla grupper.", {
          description: failed.join(", "),
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera besöket.");
    } finally {
      setBusy(false);
    }
  }

  function requestSave() {
    if (!canEdit || isBusy || !validate()) return;
    if (takeawayChangesRatings) {
      setConfirmTakeaway(true);
      return;
    }
    void save();
  }

  if (!canEdit) return null;

  const mealOptions: Visit["meal"][] =
    visit.meal === "kväll" ? ["kväll", ...VISIT_MEALS] : [...VISIT_MEALS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Redigera besök</DialogTitle>
          <DialogDescription>
            {place.name} · rätta den gemensamma händelsen utan att skapa ett nytt besök.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`edit-visit-date-${visit.id}`}>Datum</Label>
              <input
                id={`edit-visit-date-${visit.id}`}
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isBusy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tillfälle</Label>
              <Select
                value={meal}
                onValueChange={(next) => setMeal(next as Visit["meal"])}
                disabled={isBusy}
              >
                <SelectTrigger aria-label="Tillfälle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mealOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "kväll" ? "Kväll (äldre)" : VISIT_MEAL_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {scoredVisit ? (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5">
              <div className="min-w-0">
                <Label htmlFor={`edit-visit-takeaway-${visit.id}`}>Hämtmat</Label>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Markera om maten inte åts på plats.
                </p>
              </div>
              <Switch
                id={`edit-visit-takeaway-${visit.id}`}
                checked={isTakeaway}
                onCheckedChange={setIsTakeaway}
                disabled={isBusy}
              />
            </div>
          ) : null}

          {scoreBoundaryChanged && ownReview ? (
            <div className="rounded-xl bg-secondary/40 px-3 py-2.5">
              <p className="text-sm font-medium">Omdömet bevaras</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Du ändrar mellan ett matbesök och {VISIT_MEAL_LABEL.dryck}. Ditt befintliga omdöme
                skrivs inte om och kan redigeras separat från besöksdetaljen efter att du har
                sparat.
              </p>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Deltagare</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Rätta vilka i gruppen som faktiskt var med. Omdömen från borttagna deltagare bevaras
              historiskt men räknas inte så länge personen inte är deltagare.
            </p>
            <div className="flex flex-wrap gap-2">
              {memberCandidates.map((member) => {
                const active = participants.includes(member.id);
                const registrar = member.id === state.currentUserId;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleParticipant(member.id)}
                    aria-pressed={active}
                    disabled={registrar || isBusy}
                    className="min-h-11 rounded-full disabled:cursor-default disabled:opacity-100"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="min-h-9 max-w-full gap-1 rounded-full px-3 py-1"
                    >
                      <span aria-hidden>{member.avatar}</span>
                      <span className="truncate">{member.name}</span>
                      {registrar ? (
                        <span className="ml-0.5 text-[10px] font-semibold opacity-75">Du</span>
                      ) : member.status === "left" ? (
                        <span className="ml-0.5 text-[10px] opacity-75">Tidigare medlem</span>
                      ) : null}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {(visit.externalParticipantCount ?? 0) > 0 ? (
              <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {visit.externalParticipantCount}{" "}
                {visit.externalParticipantCount === 1 ? "person" : "personer"} utanför den här
                gruppen är kopplade till samma besök och bevaras automatiskt.
              </p>
            ) : null}

            {guests.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Gäster på besöket">
                {guests.map((guest) => (
                  <Badge
                    key={guest.key}
                    variant="secondary"
                    className="min-h-9 max-w-full gap-1 rounded-full pr-1 pl-3"
                  >
                    <span aria-hidden>👤</span>
                    <span className="truncate">{guest.name}</span>
                    <button
                      type="button"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() =>
                        setGuests((current) => current.filter((item) => item.key !== guest.key))
                      }
                      disabled={isBusy}
                      aria-label={`Ta bort gästen ${guest.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}

            {guestInputOpen ? (
              <div className="space-y-2 rounded-xl border border-border/70 p-3">
                <Label htmlFor={`edit-visit-guest-${visit.id}`} className="sr-only">
                  Gästens namn
                </Label>
                <Input
                  id={`edit-visit-guest-${visit.id}`}
                  value={guestName}
                  maxLength={60}
                  placeholder="Gästens namn"
                  onChange={(event) => setGuestName(event.target.value)}
                  disabled={isBusy}
                  autoFocus
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeGuestInput} disabled={isBusy}>
                    Avbryt
                  </Button>
                  <Button type="button" variant="outline" onClick={addGuest} disabled={isBusy}>
                    Lägg till
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 w-fit rounded-full px-3 text-primary"
                onClick={() => setGuestInputOpen(true)}
                disabled={isBusy || guests.length >= 10}
              >
                <UserPlus className="h-4 w-4" /> Lägg till gäst
              </Button>
            )}
          </fieldset>

          {mode === "live" ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Lägg till i fler grupper</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Välj nya grupper som också ska få besöket.
                </p>
              </div>

              {shareLoading ? (
                <div className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Hämtar dina grupper…
                </div>
              ) : shareError ? (
                <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  {shareError}
                </p>
              ) : otherShareTargets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Det finns ingen annan aktiv grupp att lägga besöket i.
                </p>
              ) : (
                <div className="space-y-2">
                  {otherShareTargets.map((target) => {
                    const checked = shareGroupIds.includes(target.groupId);
                    return (
                      <div key={target.groupId} className="rounded-xl border border-border/70">
                        <label className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm">
                          <Checkbox
                            checked={target.alreadyLinked ? true : checked}
                            disabled={target.alreadyLinked || isBusy}
                            onCheckedChange={() => toggleShareTarget(target.groupId)}
                            aria-label={
                              target.alreadyLinked
                                ? `${target.name}, redan tillagt`
                                : `Lägg till besöket i ${target.name}`
                            }
                          />
                          <span aria-hidden>{target.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block [overflow-wrap:anywhere]">{target.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {target.alreadyLinked
                                ? "Besöket finns redan"
                                : target.placeExistsInGroup
                                  ? "Stället finns redan"
                                  : "Stället läggs till"}
                            </span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasOwnPhoto && selectedTargets.length > 0 ? (
                <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                  <Label htmlFor={`edit-visit-share-photo-${visit.id}`}>Dela min bild</Label>
                  <Switch
                    id={`edit-visit-share-photo-${visit.id}`}
                    checked={sharePhoto}
                    onCheckedChange={setSharePhoto}
                    disabled={isBusy}
                  />
                </div>
              ) : null}

              {hasOwnComment && selectedTargets.length > 0 ? (
                <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
                  <Label htmlFor={`edit-visit-share-comment-${visit.id}`}>
                    Dela min kommentar
                  </Label>
                  <Switch
                    id={`edit-visit-share-comment-${visit.id}`}
                    checked={shareComment}
                    onCheckedChange={setShareComment}
                    disabled={isBusy}
                  />
                </div>
              ) : null}
            </section>
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={requestSave}
            disabled={isBusy}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara ändringar
          </Button>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={confirmTakeaway} onOpenChange={setConfirmTakeaway}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Spara som hämtmat?</AlertDialogTitle>
            <AlertDialogDescription>
              Atmosfär döljs och räknas inte med vid hämtmat. Omdömena finns kvar, men
              helhetsbetygen kan ändras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>Gå tillbaka</AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={() => void save()}>
              Spara som hämtmat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
