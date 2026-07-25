import { formatRating } from "@/lib/matrundan/version";
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  MapPin,
  MessageCircle,
  ExternalLink,
  Share2,
  Trash2,
  Users2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { formatDate, googleMapsUrl, useStore } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import {
  removeSharedVisitFromGroup,
  setReviewGroupVisibility,
} from "@/lib/matrundan/live-sharing";
import { RatingStars } from "./Rating";
import { ShareVisitDialog } from "./ShareVisitDialog";

const MEAL_LABEL: Record<string, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

export function VisitDetailSheet({
  visitId,
  open,
  onOpenChange,
}: {
  visitId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, getPlace, memberById } = useStore();
  const { mode, activeGroupId, activeGroupRole, userGroups } = useSession();
  const visit = React.useMemo(
    () => (visitId ? state.visits.find((v) => v.id === visitId) : undefined),
    [visitId, state.visits],
  );
  const place = visit ? getPlace(visit.placeId) : undefined;
  const author = visit ? memberById(visit.createdBy) : undefined;

  const isLive = mode === "live" && !!activeGroupId;
  const isParticipant = !!visit && visit.participantIds.includes(state.currentUserId);
  const isShared = visit?.linkType === "shared";
  const canUnlink =
    isLive &&
    isShared &&
    !!visit &&
    (visit.linkedBy === state.currentUserId ||
      activeGroupRole === "owner" ||
      activeGroupRole === "admin");
  const canShare =
    isLive && !!visit && isParticipant && userGroups.length >= 2;

  const myReview = React.useMemo(
    () => visit?.visibleReviews?.find((r) => r.userId === state.currentUserId),
    [visit, state.currentUserId],
  );

  const [shareOpen, setShareOpen] = React.useState(false);
  const [confirmUnlink, setConfirmUnlink] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const [savingVisibility, setSavingVisibility] = React.useState(false);

  async function reload() {
    // StoreProvider återladdar via onLiveMutation; enklast är att trigga
    // via en no-op supabase read? Vi använder select-hooken från store.
    // Signalera via location reload av data — vi utnyttjar att kallande
    // Sheet stängs; AppShell laddar när providern remountar. Här räcker
    // att ropa på reloadLive via en dummy mutation-callback är inte
    // exponerat. Istället triggar vi en soft-nav till samma URL.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
    }
  }

  async function doUnlink() {
    if (!visit || !activeGroupId) return;
    setUnlinking(true);
    try {
      await removeSharedVisitFromGroup(visit.id, activeGroupId);
      toast.success("Besöket är borttaget från gruppen.");
      setConfirmUnlink(false);
      onOpenChange(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte ta bort.");
    } finally {
      setUnlinking(false);
    }
  }

  async function toggleCommentVisibility(next: boolean) {
    if (!myReview || !activeGroupId) return;
    setSavingVisibility(true);
    // Rating behåller vi alltid synligt i denna UI-iteration.
    const prevComment = myReview.commentVisible;
    try {
      await setReviewGroupVisibility(myReview.id, activeGroupId, true, next);
      toast.success(
        next
          ? "Din kommentar är synlig i gruppen."
          : "Din kommentar är dold i gruppen.",
      );
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara.");
      // rollback visuellt: UI läser myReview.commentVisible från state,
      // som endast uppdateras efter reload. Här behöver vi ingen manuell
      // rollback då toggleControlled inte används.
      void prevComment;
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
          {visit && place ? (
            <div className="flex flex-col">
              <SheetHeader className="space-y-0 border-b border-border/60 bg-gradient-to-br from-sage/40 to-secondary p-5 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
                    Besök
                  </div>
                  {isShared ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/30 bg-primary/10 text-[10px] font-medium text-primary"
                    >
                      Delat besök
                    </Badge>
                  ) : null}
                  {visit.countsForProgression === false ? (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[10px] text-muted-foreground"
                      title="Räknas inte mot gruppens progression"
                    >
                      Utanför progression
                    </Badge>
                  ) : null}
                </div>
                <SheetTitle className="mt-1 font-display text-2xl leading-tight">
                  <Link
                    to="/matstallen/$placeId"
                    params={{ placeId: place.id }}
                    onClick={() => onOpenChange(false)}
                    className="hover:underline"
                  >
                    {place.name}
                  </Link>
                </SheetTitle>
                <SheetDescription className="mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {place.address}, {place.city}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 p-5">
                <Card className="rounded-2xl border-border/70 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-2xl">
                      {author?.avatar ?? "🙂"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">
                        <span className="font-medium">{author?.name ?? "Någon"}</span>
                        <span className="text-muted-foreground"> registrerade</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {MEAL_LABEL[visit.meal] ?? visit.meal} ·{" "}
                        {formatDate(visit.date)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <RatingStars value={visit.overall} size={18} />
                    <span className="text-sm font-medium">
                      {formatRating(visit.overall)} / 5
                    </span>
                  </div>
                </Card>

                <section>
                  <h3 className="mb-2 text-sm font-medium">Deltagare</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(visit.participants && visit.participants.length > 0
                      ? visit.participants
                      : visit.participantIds.map((pid) => {
                          const m = memberById(pid);
                          return {
                            id: pid,
                            name: m?.name ?? "Okänd",
                            avatar: m?.avatar ?? null,
                            avatarImage: m?.avatarImage ?? null,
                            status: "active" as const,
                          };
                        })
                    ).map((pp) => (
                      <Badge
                        key={pp.id}
                        variant="outline"
                        className="max-w-full rounded-full border-border/70 bg-secondary/60 px-2.5 py-1 text-xs font-normal"
                        title={pp.status === "left" ? "Tidigare medlem" : undefined}
                      >
                        <span className="mr-1">{pp.avatar ?? "🙂"}</span>
                        <span className="truncate">{pp.name}</span>
                        {pp.status === "left" ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            · Tidigare medlem
                          </span>
                        ) : null}
                      </Badge>
                    ))}
                    {(visit.externalParticipantCount ?? 0) > 0 ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-muted px-2.5 py-1 text-xs font-normal text-muted-foreground"
                        title="Personer utanför den här gruppen visas anonymt."
                      >
                        <Users2 className="mr-1 h-3 w-3" />
                        +{visit.externalParticipantCount} utanför gruppen
                      </Badge>
                    ) : null}
                  </div>
                </section>

                {(visit.taste || visit.value || visit.service) && (
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Detaljbetyg</h3>
                    <Card className="grid grid-cols-3 gap-3 rounded-2xl border-border/70 p-3 text-center">
                      <Detail label="Smak" value={visit.taste} />
                      <Detail label="Prisvärd" value={visit.value} />
                      <Detail label="Service" value={visit.service} />
                    </Card>
                  </section>
                )}

                {visit.comment ? (
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Kommentar</h3>
                    <Card className="flex items-start gap-2 rounded-2xl border-border/70 p-3 text-sm text-muted-foreground">
                      <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{visit.comment}</span>
                    </Card>
                  </section>
                ) : null}

                {isLive && myReview && myReview.comment ? (
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Din synlighet</h3>
                    <Card className="flex items-center justify-between gap-2 rounded-2xl border-border/70 p-3">
                      <Label
                        htmlFor="my-comment-visible"
                        className="flex items-center gap-2 text-sm"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Visa min kommentar i denna grupp
                      </Label>
                      <Switch
                        id="my-comment-visible"
                        checked={myReview.commentVisible}
                        disabled={savingVisibility}
                        onCheckedChange={(v) => void toggleCommentVisibility(v)}
                      />
                    </Card>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Betyget visas alltid för gruppen. Kommentaren kan du dölja
                      utan att ta bort besöket.
                    </p>
                  </section>
                ) : null}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button asChild variant="outline">
                    <Link
                      to="/matstallen/$placeId"
                      params={{ placeId: place.id }}
                      onClick={() => onOpenChange(false)}
                    >
                      Till stället
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Maps
                    </a>
                  </Button>
                </div>

                {canShare ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShareOpen(true)}
                  >
                    <Share2 className="h-4 w-4" />
                    Lägg till i annan grupp
                  </Button>
                ) : null}

                {canUnlink ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-destructive"
                    onClick={() => setConfirmUnlink(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Ta bort från gruppen
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {isLive && activeGroupId ? (
        <ShareVisitDialog
          visitId={visit?.id ?? null}
          currentGroupId={activeGroupId}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onShared={reload}
        />
      ) : null}

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort besöket från gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              Besöket försvinner från denna grupps historik. Originalbesöket och
              matstället ligger kvar där de skapades.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Avbryt</AlertDialogCancel>
            <AlertDialogAction disabled={unlinking} onClick={doUnlink}>
              {unlinking ? "Tar bort…" : "Ta bort"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">
        {value ? formatRating(value) : "–"}
      </div>
    </div>
  );
}
