import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, UserPlus, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  listPlaceShareTargets,
  shareVisitToGroup,
  type PlaceShareTarget,
} from "@/lib/matrundan/live-sharing";
import {
  deriveReviewOverall,
  reviewModelForContext,
  reviewModelIncludesAtmosphere,
  reviewRatingsComplete,
} from "@/lib/matrundan/review-model";
import { useSession } from "@/lib/matrundan/session";
import { defaultShareGroupIds, toggleAllSelection } from "@/lib/matrundan/sharing-selection";
import { useStore } from "@/lib/matrundan/store";
import type { Occasion, VisitParticipant } from "@/lib/matrundan/types";
import { VISIT_MEALS, VISIT_MEAL_LABEL, visitMealHasScore } from "@/lib/matrundan/visit-context";
import {
  findLocalRegistrationVisitDuplicate,
  findRegistrationVisitDuplicate,
  type StrongVisitDuplicateCandidate,
} from "@/lib/matrundan/visit-duplicates";
import { GuestMemberLinkDialog } from "./GuestMemberLinkDialog";
import { OccasionPicker } from "./OccasionPicker";
import { ReviewScoreFields } from "./ReviewScoreFields";
import { ShareVisitDialog } from "./ShareVisitDialog";
import { VisitDuplicatePrompt } from "./VisitDuplicatePrompt";
import { VisitPhotoField } from "./VisitPhotoField";

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
  const navigate = useNavigate();
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
  const [busy, setBusy] = React.useState(false);
  const [duplicateBusy, setDuplicateBusy] = React.useState(false);
  const [duplicateCandidate, setDuplicateCandidate] =
    React.useState<StrongVisitDuplicateCandidate | null>(null);
  const [sharePayload, setSharePayload] = React.useState<{
    visitId: string;
    groupId: string;
  } | null>(null);
  const [guestLinkPayload, setGuestLinkPayload] = React.useState<{
    visitId: string;
    sourceGroupId: string;
  } | null>(null);
  const isBusy = busy || duplicateBusy || submitting;
  const place = placeId ? getPlace(placeId) : undefined;

  const [meal, setMeal] = React.useState<(typeof VISIT_MEALS)[number]>("middag");
  const [isTakeaway, setIsTakeaway] = React.useState(false);
  const [date, setDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = React.useState<string[]>([state.currentUserId]);
  const [guests, setGuests] = React.useState<DraftGuest[]>([]);
  const [guestInputOpen, setGuestInputOpen] = React.useState(false);
  const [guestName, setGuestName] = React.useState("");
  const [taste, setTaste] = React.useState(0);
  const [value, setValue] = React.useState(0);
  const [service, setService] = React.useState(0);
  const [atmosphere, setAtmosphere] = React.useState(0);
  const [reviewOccasions, setReviewOccasions] = React.useState<Occasion[]>([]);
  const [comment, setComment] = React.useState("");
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [shareGroupIds, setShareGroupIds] = React.useState<string[]>([]);
  const [sharePhoto, setSharePhoto] = React.useState(false);
  const [shareComment, setShareComment] = React.useState(false);
  const scoredVisit = visitMealHasScore(meal);
  const currentUserParticipates = participants.includes(state.currentUserId);
  const canShare = showShareSection && currentUserParticipates && shareableGroups.length > 0;
  const hasComment = currentUserParticipates && comment.trim().length > 0;
  const allShareGroupsSelected =
    shareableGroups.length > 0 &&
    shareableGroups.every((group) => shareGroupIds.includes(group.groupId));

  React.useEffect(() => {
    if (!open) {
      setMeal("middag");
      setIsTakeaway(false);
      setDate(new Date().toISOString().slice(0, 10));
      setParticipants([state.currentUserId]);
      setGuests([]);
      setGuestInputOpen(false);
      setGuestName("");
      setTaste(0);
      setValue(0);
      setService(0);
      setAtmosphere(0);
      setReviewOccasions([]);
      setComment("");
      setPhotoFile(null);
      setSharePhoto(false);
      setShareComment(false);
      setShareTargets([]);
      setShareTargetsError(null);
      setShareGroupIds([]);
      setDuplicateCandidate(null);
      setDuplicateBusy(false);
    }
  }, [open, state.currentUserId]);

  React.useEffect(() => {
    if (open) {
      setParticipants((current) =>
        current.includes(state.currentUserId) ? current : [state.currentUserId, ...current],
      );
    }
  }, [open, state.currentUserId]);

  React.useEffect(() => {
    if (meal === "dryck") setIsTakeaway(false);
  }, [meal]);

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

  React.useEffect(() => {
    setSharePhoto(photoFile != null);
  }, [photoFile]);

  React.useEffect(() => {
    setShareComment(hasComment);
  }, [hasComment]);

  if (!place) return null;
  const currentPlace = place;
  const placeNeedsOccasionClassification = scoredVisit && currentPlace.occasions.length === 0;
  const needsOccasionForReview = placeNeedsOccasionClassification && !isTakeaway;
  const applicableOccasions = placeNeedsOccasionClassification
    ? reviewOccasions
    : currentPlace.occasions;
  const reviewModel = scoredVisit
    ? reviewModelForContext({ isTakeaway, occasions: applicableOccasions })
    : null;
  const reviewComplete = reviewRatingsComplete(reviewModel, {
    taste,
    service,
    value,
    atmosphere,
  });
  const derivedOverall =
    deriveReviewOverall(reviewModel, { taste, service, value, atmosphere }) ?? 0;
  const savingVisitWithoutReview = scoredVisit && reviewModel == null;

  const toggleParticipant = (id: string) => {
    if (id === state.currentUserId) return;
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleShareGroup = (id: string) => {
    const removing = shareGroupIds.includes(id);
    setShareGroupIds((cur) => (removing ? cur.filter((x) => x !== id) : [...cur, id]));
  };

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
      toast.error("Högst 10 gäster kan läggas till.");
      return;
    }
    setGuests((current) => [...current, { id: `guest-${Date.now()}-${current.length}`, name }]);
    closeGuestInput();
  }

  function participantSnapshots(): VisitParticipant[] {
    return [
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
  }

  async function persistNewVisit(allowStrongDuplicate = false) {
    const hasReview = scoredVisit && reviewModel != null;
    const created = await addVisit({
      placeId: currentPlace.id,
      date: new Date(date).toISOString(),
      meal,
      isTakeaway: scoredVisit ? isTakeaway : false,
      participantIds: participants,
      participants: participantSnapshots(),
      currentUserParticipationStatus: "participant",
      overall: hasReview ? derivedOverall : 0,
      taste: hasReview ? taste : undefined,
      value: hasReview ? value : undefined,
      service: hasReview ? service : undefined,
      atmosphere: hasReview && reviewModelIncludesAtmosphere(reviewModel) ? atmosphere : undefined,
      comment: scoredVisit && !hasReview ? undefined : comment.trim() || undefined,
      reviewOccasions:
        hasReview && placeNeedsOccasionClassification && reviewOccasions.length > 0
          ? reviewOccasions
          : undefined,
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
        await shareVisitToGroup(
          created.id,
          groupId,
          hasComment ? shareComment : false,
          allowStrongDuplicate,
          photoFile != null && photoError == null && sharePhoto,
        );
        sharedCount += 1;
      } catch {
        failed.push(shareableGroups.find((group) => group.groupId === groupId)?.name ?? "en grupp");
      }
    }
    if (sharedCount > 0 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("matrundan:reload"));
    }

    const continueToGuestLink =
      mode === "live" && guests.length > 0 && sharedCount > 0 && !!activeGroupId && !!created?.id;

    if (continueToGuestLink && activeGroupId && created?.id) {
      onOpenChange(false);
      setGuestLinkPayload({ visitId: created.id, sourceGroupId: activeGroupId });
    } else {
      onOpenChange(false);
    }

    toast.success("Besök registrerat", {
      description:
        sharedCount > 0
          ? `${currentPlace.name} · tillagt i ${sharedCount} ${sharedCount === 1 ? "grupp" : "grupper"} till`
          : currentPlace.name,
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
  }

  function validateVisitDraft(): boolean {
    if (!currentUserParticipates) {
      toast.error("Den som registrerar besöket måste vara deltagare.");
      return false;
    }
    if (scoredVisit && reviewModel && !reviewComplete) {
      toast.error("Sätt alla relevanta betyg.");
      return false;
    }
    return true;
  }

  const submit = async () => {
    if (isBusy || !validateVisitDraft()) return;

    setBusy(true);
    try {
      let duplicate: StrongVisitDuplicateCandidate | null = null;
      if (mode === "live" && activeGroupId) {
        duplicate = await findRegistrationVisitDuplicate(
          activeGroupId,
          currentPlace.id,
          date,
          meal,
          scoredVisit ? isTakeaway : false,
        );
      } else if (mode === "demo") {
        duplicate = findLocalRegistrationVisitDuplicate(
          state.visits,
          state.currentUserId,
          currentPlace.id,
          date,
          meal,
          scoredVisit ? isTakeaway : false,
        );
      }

      if (duplicate) {
        setDuplicateCandidate(duplicate);
        return;
      }
      await persistNewVisit();
    } catch (error) {
      toast.error((error as Error).message || "Kunde inte spara besöket.");
    } finally {
      setBusy(false);
    }
  };

  async function registerDifferentVisit() {
    if (isBusy || !validateVisitDraft()) return;
    setDuplicateCandidate(null);
    setBusy(true);
    try {
      await persistNewVisit(true);
    } catch (error) {
      toast.error((error as Error).message || "Kunde inte spara besöket.");
    } finally {
      setBusy(false);
    }
  }

  async function openExistingVisit() {
    const candidate = duplicateCandidate;
    if (!candidate || duplicateBusy) return;
    if (!candidate.alreadyVisibleInTargetGroup && !activeGroupId) return;

    setDuplicateBusy(true);
    try {
      if (!candidate.alreadyVisibleInTargetGroup && activeGroupId) {
        await shareVisitToGroup(candidate.visitId, activeGroupId, false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("matrundan:reload"));
        }
      }

      setDuplicateCandidate(null);
      onOpenChange(false);
      void navigate({
        to: "/matstallen/$placeId",
        params: { placeId: currentPlace.id },
        search: { visit: candidate.visitId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte öppna det befintliga besöket.",
      );
    } finally {
      setDuplicateBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Registrera besök</DialogTitle>
            <DialogDescription>
              {currentPlace.name} · {currentPlace.address}
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
                    {VISIT_MEALS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {VISIT_MEAL_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {scoredVisit ? (
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/35 px-3 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="visit-takeaway" className="text-sm font-medium">
                    Hämtmat
                  </Label>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Markera om maten inte åts på plats.
                  </p>
                </div>
                <Switch
                  id="visit-takeaway"
                  checked={isTakeaway}
                  onCheckedChange={setIsTakeaway}
                  disabled={isBusy}
                  aria-label="Markera besöket som Hämtmat"
                />
              </div>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Deltagare</legend>
              <p className="text-xs text-muted-foreground">Välj alla som var med.</p>
              <div className="flex flex-wrap gap-2">
                {state.members.map((member) => {
                  const active = participants.includes(member.id);
                  const isRegistrar = member.id === state.currentUserId;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleParticipant(member.id)}
                      aria-pressed={active}
                      aria-label={
                        isRegistrar
                          ? `${member.name}, du, deltagare`
                          : `${active ? "Ta bort" : "Lägg till"} ${member.name} som deltagare`
                      }
                      disabled={isRegistrar}
                      className="min-h-11 rounded-full disabled:cursor-default disabled:opacity-100"
                    >
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="min-h-9 cursor-pointer gap-1 rounded-full px-3 py-1"
                      >
                        <span aria-hidden>{member.avatar}</span>
                        <span>{member.name}</span>
                        {isRegistrar ? (
                          <span className="ml-0.5 text-[10px] font-semibold opacity-75">Du</span>
                        ) : null}
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
                      className="min-h-9 max-w-full gap-1 rounded-full pr-1 pl-3"
                    >
                      <span aria-hidden>👤</span>
                      <span className="truncate">{guest.name}</span>
                      <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
                <div className="space-y-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Label htmlFor="visit-guest-name" className="sr-only">
                      Gästens namn
                    </Label>
                    <Input
                      id="visit-guest-name"
                      value={guestName}
                      maxLength={60}
                      placeholder="Gästens namn"
                      autoFocus
                      className="min-w-0 flex-1"
                      onChange={(event) => setGuestName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addGuest();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          closeGuestInput();
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={closeGuestInput}
                      aria-label="Avbryt lägg till gäst"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Gäster hör bara till besöket och visas anonymt vid delning.
                  </p>
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
            </fieldset>

            {scoredVisit ? (
              <div className="space-y-4">
                {placeNeedsOccasionClassification ? (
                  <div className="rounded-2xl bg-secondary/40 p-4">
                    <OccasionPicker
                      id="visit-review-occasions"
                      value={reviewOccasions}
                      onChange={setReviewOccasions}
                      disabled={isBusy}
                      description={
                        isTakeaway
                          ? "Valfritt – välj vad stället passar för. Det hjälper gruppen att välja rätt ställe nästa gång."
                          : "Välj vad stället passar för om du vill lämna omdömet direkt. Det avgör om Atmosfär är relevant."
                      }
                    />
                  </div>
                ) : null}

                {reviewModel ? (
                  <ReviewScoreFields
                    model={reviewModel}
                    taste={taste}
                    service={service}
                    value={value}
                    atmosphere={atmosphere}
                    onTasteChange={setTaste}
                    onServiceChange={setService}
                    onValueChange={setValue}
                    onAtmosphereChange={setAtmosphere}
                  />
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                    <p className="text-sm font-medium">Spara besöket nu, omdömet kan vänta</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Besöket sparas även utan omdöme. Välj Passar för ovan om du vill betygsätta
                      direkt, eller komplettera ditt omdöme senare.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-secondary/40 p-4">
                <p className="text-sm font-medium">Besök utan betyg</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  För besök där ni främst tar något att dricka. Besöket sparas utan betyg.
                </p>
              </div>
            )}

            {!scoredVisit || reviewModel ? (
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
            ) : null}

            <VisitPhotoField
              file={photoFile}
              onFileChange={setPhotoFile}
              disabled={isBusy}
              showHelpText={false}
            />

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
                  <div className="min-w-0 space-y-1">
                    <Label className="text-sm font-medium">Dela med dina andra grupper</Label>
                    <p className="text-xs text-muted-foreground">
                      Välj vilka grupper som också ska få besöket.
                    </p>
                    <details className="text-xs text-muted-foreground">
                      <summary className="w-fit cursor-pointer font-medium text-primary">
                        Vad delas?
                      </summary>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
                        <li>Besöket och stället läggs till i valda grupper.</li>
                        <li>Din bild och kommentar följer med om valen nedan är på.</li>
                        <li>Ursprungsgrupp och privata gästuppgifter delas inte.</li>
                      </ul>
                    </details>
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
                      <div key={group.groupId} className="rounded-xl bg-background">
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleShareGroup(group.groupId)}
                            disabled={isBusy}
                            aria-label={`Dela besöket med ${group.name}`}
                          />
                          <span aria-hidden>{group.emoji ?? "🍽️"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block [overflow-wrap:anywhere]">{group.name}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {group.placeExistsInGroup
                                ? "Stället finns i gruppen"
                                : "Stället läggs till"}
                            </span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                {photoFile && shareGroupIds.length > 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                    <Label htmlFor="share-photo" className="text-sm font-normal">
                      Dela min bild
                    </Label>
                    <Switch
                      id="share-photo"
                      checked={sharePhoto}
                      onCheckedChange={setSharePhoto}
                      disabled={isBusy}
                    />
                  </div>
                ) : null}
                {hasComment && shareGroupIds.length > 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
                    <Label htmlFor="share-comment" className="text-sm font-normal">
                      Dela min kommentar
                    </Label>
                    <Switch
                      id="share-comment"
                      checked={shareComment}
                      onCheckedChange={setShareComment}
                      disabled={isBusy}
                    />
                  </div>
                ) : null}
                {guests.length > 0 && shareGroupIds.length > 0 ? (
                  <div className="flex gap-2 rounded-xl bg-background px-3 py-2.5 text-xs text-muted-foreground">
                    <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>
                      Efter sparandet kan du koppla en gäst till en medlem i en vald grupp. Personen
                      bekräftar själv.
                    </p>
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
              onClick={submit}
              disabled={isBusy || (scoredVisit && reviewModel != null && !reviewComplete)}
              className="w-full sm:w-auto"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingVisitWithoutReview ? "Spara besök utan omdöme" : "Spara besök"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <GuestMemberLinkDialog
        visitId={guestLinkPayload?.visitId ?? null}
        sourceGroupId={guestLinkPayload?.sourceGroupId ?? null}
        open={guestLinkPayload !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setGuestLinkPayload(null);
            onOpenChange(false);
          }
        }}
      />

      <VisitDuplicatePrompt
        candidate={duplicateCandidate}
        mode="register"
        busy={duplicateBusy || busy}
        onDismiss={() => setDuplicateCandidate(null)}
        onUseExisting={() => void openExistingVisit()}
        onDifferentVisit={() => void registerDifferentVisit()}
      />
    </>
  );
}
