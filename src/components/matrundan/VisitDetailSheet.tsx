import * as React from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { MapPin, Share2, Trash2, Users2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatDate, useStore } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import { removeSharedVisitFromGroup } from "@/lib/matrundan/live-sharing";
import { ShareVisitDialog } from "./ShareVisitDialog";
import { VisitParticipationControls } from "./VisitParticipationControls";
import { VisitPhotoManager } from "./VisitPhotoManager";
import { VisitReviewsSection } from "./VisitReviewsSection";
import { canManageVisitPhoto } from "@/lib/matrundan/visit-photo";
import { canDeleteOriginalVisit } from "@/lib/matrundan/visit-permissions";

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
  onOpenChange: (open: boolean) => void;
}) {
  const { state, getPlace, memberById, deleteVisit, demoReadOnly } = useStore();
  const { mode, activeGroupId, activeGroupRole, userGroups } = useSession();
  const visit = React.useMemo(
    () => (visitId ? state.visits.find((item) => item.id === visitId) : undefined),
    [visitId, state.visits],
  );
  const place = visit ? getPlace(visit.placeId) : undefined;
  const author = visit ? memberById(visit.createdBy) : undefined;

  const isLive = mode === "live" && !!activeGroupId;
  const groupArchived = state.group.lifecycleStatus === "archived";
  const participantFallback = !!visit && visit.participantIds.includes(state.currentUserId);
  const participationStatus =
    visit?.currentUserParticipationStatus ?? (participantFallback ? "participant" : "none");
  const isParticipant = participationStatus === "participant";
  const isShared = visit?.linkType === "shared";
  const activeGroupCount = userGroups.filter((group) => group.lifecycleStatus === "active").length;
  const canUnlink =
    !groupArchived &&
    isLive &&
    isShared &&
    !!visit &&
    (visit.linkedBy === state.currentUserId ||
      activeGroupRole === "owner" ||
      activeGroupRole === "admin");
  const canShare = !groupArchived && isLive && !!visit && isParticipant && activeGroupCount >= 2;
  const currentRole = state.members.find((member) => member.id === state.currentUserId)?.role;
  const canManagePhoto =
    !!visit && canManageVisitPhoto(visit, state.currentUserId, currentRole, groupArchived);
  const canDelete =
    !!visit && canDeleteOriginalVisit(visit, state.currentUserId, currentRole, groupArchived);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [confirmUnlink, setConfirmUnlink] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function reload() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("matrundan:reload"));
    }
  }

  async function doUnlink() {
    if (!visit || !activeGroupId || groupArchived) return;
    setUnlinking(true);
    try {
      await removeSharedVisitFromGroup(visit.id, activeGroupId);
      toast.success("Besöket är borttaget från gruppen.");
      setConfirmUnlink(false);
      onOpenChange(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ta bort.");
    } finally {
      setUnlinking(false);
    }
  }

  async function doDelete() {
    if (!visit || groupArchived) return;
    setDeleting(true);
    try {
      await deleteVisit(visit.id);
      toast.success("Besöket är raderat.");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte radera besöket.");
    } finally {
      setDeleting(false);
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
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-sm"
                      aria-hidden="true"
                    >
                      {author?.avatar ?? "🙂"}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{author?.name ?? "Någon"}</span>{" "}
                      registrerade
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{MEAL_LABEL[visit.meal] ?? visit.meal}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(visit.date)}</span>
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-medium">Deltagare</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(visit.participants && visit.participants.length > 0
                      ? visit.participants
                      : visit.participantIds.map((participantId) => {
                          const member = memberById(participantId);
                          return {
                            id: participantId,
                            name: member?.name ?? "Okänd",
                            avatar: member?.avatar ?? null,
                            avatarImage: member?.avatarImage ?? null,
                            status: "active" as const,
                          };
                        })
                    ).map((participant) => (
                      <Badge
                        key={participant.id}
                        variant="outline"
                        className="max-w-full rounded-full border-border/70 bg-secondary/60 px-2.5 py-1 text-xs font-normal"
                        title={
                          participant.status === "left"
                            ? "Tidigare medlem"
                            : participant.status === "guest"
                              ? "Gäst på detta besök"
                              : undefined
                        }
                      >
                        <span className="mr-1">{participant.avatar ?? "🙂"}</span>
                        <span className="truncate">{participant.name}</span>
                        {participant.status === "left" ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            · Tidigare medlem
                          </span>
                        ) : participant.status === "guest" ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">· Gäst</span>
                        ) : null}
                      </Badge>
                    ))}
                    {(visit.externalParticipantCount ?? 0) > 0 ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-border/70 bg-muted px-2.5 py-1 text-xs font-normal text-muted-foreground"
                        title="Personer utanför den här gruppen visas anonymt."
                      >
                        <Users2 className="mr-1 h-3 w-3" />+{visit.externalParticipantCount} utanför
                        gruppen
                      </Badge>
                    ) : null}
                  </div>
                  {visit.participants?.some((participant) => participant.status === "guest") ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Gäster hör bara till detta besök och får ingen medlemsprogression.
                    </p>
                  ) : null}
                </section>

                {participationStatus === "declined" ? (
                  <VisitParticipationControls
                    visit={visit}
                    currentUserId={state.currentUserId}
                    groupArchived={groupArchived}
                    demoReadOnly={demoReadOnly}
                    onChanged={reload}
                  />
                ) : null}

                <VisitReviewsSection
                  visit={visit}
                  placeName={place.name}
                  groupArchived={groupArchived}
                  demoReadOnly={demoReadOnly}
                  onChanged={reload}
                />

                {participationStatus === "participant" ? (
                  <VisitParticipationControls
                    visit={visit}
                    currentUserId={state.currentUserId}
                    groupArchived={groupArchived}
                    demoReadOnly={demoReadOnly}
                    onChanged={reload}
                  />
                ) : null}

                <VisitPhotoManager visit={visit} canManage={canManagePhoto} />

                <Button asChild variant="outline" className="w-full">
                  <Link
                    to="/matstallen/$placeId"
                    params={{ placeId: place.id }}
                    onClick={() => onOpenChange(false)}
                  >
                    Till stället
                  </Link>
                </Button>

                {canShare ? (
                  <Button variant="secondary" className="w-full" onClick={() => setShareOpen(true)}>
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

                {canDelete ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Radera besöket
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {isLive && activeGroupId && !groupArchived ? (
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
              Besöket försvinner från denna grupps historik. Originalbesöket och matstället ligger
              kvar där de skapades.
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera besöket på {place?.name ?? "matstället"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Besöket, fotot och alla omdömen tas bort. Gruppens progression räknas om. Om besöket
              har lagts till i andra grupper försvinner det även där. Det går inte att ångra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground"
            >
              {deleting ? "Raderar…" : "Radera besöket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
