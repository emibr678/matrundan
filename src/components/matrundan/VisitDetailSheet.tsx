import * as React from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRoundCheck,
  Users2,
  UsersRound,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useStore } from "@/lib/matrundan/store";
import { useSession } from "@/lib/matrundan/session";
import { removeSharedVisitFromGroup } from "@/lib/matrundan/live-sharing";
import { formatVisitContext } from "@/lib/matrundan/visit-context";
import { GuestMemberLinkDialog } from "./GuestMemberLinkDialog";
import { ShareVisitDialog } from "./ShareVisitDialog";
import { VisitGuestParticipationPrompt } from "./VisitGuestParticipationPrompt";
import { VisitParticipationControls } from "./VisitParticipationControls";
import { VisitPhotoManager } from "./VisitPhotoManager";
import { VisitReviewsSection } from "./VisitReviewsSection";
import { canDeleteOriginalVisit, canEditOriginalVisit } from "@/lib/matrundan/visit-permissions";
import { EditVisitDialog } from "./EditVisitDialog";

function formatVisitDate(iso: string) {
  const calendarDate = /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(0, 10)}T12:00:00` : iso;
  return new Date(calendarDate).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function VisitDetailSheet({
  visitId,
  focusReviewId = null,
  open,
  onOpenChange,
  onReviewFlowExit,
}: {
  visitId: string | null;
  focusReviewId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewFlowExit?: () => void;
}) {
  const { state, getPlace, memberById, deleteVisit, demoReadOnly } = useStore();
  const { mode, activeGroupId, activeGroupRole, userGroups } = useSession();
  const visit = React.useMemo(
    () => (visitId ? state.visits.find((item) => item.id === visitId) : undefined),
    [visitId, state.visits],
  );
  const place = visit ? getPlace(visit.placeId) : undefined;

  const isLive = mode === "live" && !!activeGroupId;
  const isDemo = mode === "demo";
  const groupArchived = state.group.lifecycleStatus === "archived";
  const participantFallback = !!visit && visit.participantIds.includes(state.currentUserId);
  const participationStatus =
    visit?.currentUserParticipationStatus ?? (participantFallback ? "participant" : "none");
  const isParticipant = participationStatus === "participant";
  const isShared = visit?.linkType === "shared";
  const activeGroupCount = userGroups.filter((group) => group.lifecycleStatus === "active").length;
  const privateGuests =
    visit?.participants?.filter((participant) => participant.status === "guest") ?? [];
  const hasPrivateGuests = privateGuests.length > 0;
  const hasExternalParticipants = (visit?.externalParticipantCount ?? 0) > 0;
  const canLinkGuest =
    !groupArchived && isLive && !isShared && hasPrivateGuests && activeGroupCount >= 2;
  const canUnlink =
    !groupArchived &&
    isLive &&
    isShared &&
    !!visit &&
    (visit.linkedBy === state.currentUserId ||
      activeGroupRole === "owner" ||
      activeGroupRole === "admin");
  const canShare = !groupArchived && isLive && !!visit && isParticipant && activeGroupCount >= 2;
  const canChangeParticipation =
    !!visit &&
    participationStatus !== "none" &&
    visit.createdBy !== state.currentUserId &&
    !groupArchived &&
    !demoReadOnly;
  const currentRole = state.members.find((member) => member.id === state.currentUserId)?.role;
  const canDelete =
    !!visit && canDeleteOriginalVisit(visit, state.currentUserId, currentRole, groupArchived);
  const canEdit =
    !!visit && !demoReadOnly && canEditOriginalVisit(visit, state.currentUserId, groupArchived);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [guestLinkOpen, setGuestLinkOpen] = React.useState(false);
  const [guestLinkTarget, setGuestLinkTarget] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
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
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-md [&>button]:z-20"
        >
          {visit && place ? (
            <div className="flex flex-col">
              <SheetHeader className="relative space-y-0 border-b border-border/60 bg-gradient-to-br from-sage/40 to-secondary p-5 pr-24 text-left">
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
                <Link
                  to="/matstallen/$placeId"
                  params={{ placeId: place.id }}
                  onClick={() => onOpenChange(false)}
                  aria-label={`Till ${place.name}`}
                  className="group -mx-2 mt-1 block min-h-14 max-w-full rounded-lg px-2 py-1.5 transition-colors hover:bg-background/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-1.5">
                    <SheetTitle className="min-w-0 font-display text-2xl leading-tight transition-colors group-hover:text-foreground">
                      {place.name}
                    </SheetTitle>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground/80">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {place.address}, {place.city}
                    </span>
                  </div>
                </Link>
                <SheetDescription className="mt-1 text-xs">
                  {formatVisitDate(visit.date)} · {formatVisitContext(visit)}
                </SheetDescription>

                {canEdit || canUnlink || canDelete ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-12 top-3 h-9 w-9 rounded-full text-muted-foreground hover:bg-background/70 hover:text-foreground"
                        aria-label="Besöksalternativ"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit ? (
                        <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                          <Pencil className="h-4 w-4" />
                          Redigera besök
                        </DropdownMenuItem>
                      ) : null}
                      {canUnlink || canDelete ? <DropdownMenuSeparator /> : null}
                      {canUnlink ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setConfirmUnlink(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Ta bort från gruppen
                        </DropdownMenuItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setConfirmDelete(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Radera besöket
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </SheetHeader>

              <div className="space-y-4 p-5">
                <section>
                  <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">Deltagare</h3>
                    {canChangeParticipation ? (
                      <VisitParticipationControls
                        visit={visit}
                        currentUserId={state.currentUserId}
                        groupArchived={groupArchived}
                        demoReadOnly={demoReadOnly}
                        onChanged={reload}
                      />
                    ) : null}
                  </div>
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
                    {hasExternalParticipants ? (
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
                  {canLinkGuest && privateGuests.length > 0 ? (
                    <div className="mt-1.5 space-y-0.5">
                      {privateGuests.map((guestParticipant) => (
                        <Button
                          key={guestParticipant.id}
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-auto min-h-8 max-w-full justify-start px-1.5 py-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setGuestLinkTarget({
                              id: guestParticipant.id,
                              name: guestParticipant.name,
                            });
                            setGuestLinkOpen(true);
                          }}
                        >
                          <UserRoundCheck className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            Koppla {guestParticipant.name} till gruppmedlem
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </section>

                {(isLive && activeGroupId) || (isDemo && isShared && !isParticipant) ? (
                  <VisitGuestParticipationPrompt
                    visitId={visit.id}
                    groupId={isLive ? activeGroupId : null}
                    groupArchived={groupArchived}
                    onChanged={reload}
                    demoPending={isDemo && isShared && !isParticipant && hasExternalParticipants}
                  />
                ) : null}

                <VisitReviewsSection
                  visit={visit}
                  placeName={place.name}
                  groupArchived={groupArchived}
                  demoReadOnly={demoReadOnly}
                  focusReviewId={focusReviewId}
                  onChanged={reload}
                  onOwnReviewFlowExit={onReviewFlowExit}
                />

                <VisitPhotoManager visit={visit} />

                {canShare ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full"
                    onClick={() => setShareOpen(true)}
                  >
                    <UsersRound className="h-4 w-4" />
                    Lägg till besöket i en annan grupp
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {visit && place ? (
        <EditVisitDialog
          visit={visit}
          place={place}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={reload}
        />
      ) : null}

      {isLive && activeGroupId && !groupArchived ? (
        <>
          <ShareVisitDialog
            visitId={visit?.id ?? null}
            currentGroupId={activeGroupId}
            open={shareOpen}
            onOpenChange={setShareOpen}
            onShared={reload}
          />
          <GuestMemberLinkDialog
            visitId={visit?.id ?? null}
            sourceGroupId={activeGroupId}
            initialGuestId={guestLinkTarget?.id ?? null}
            initialGuestName={guestLinkTarget?.name ?? null}
            open={guestLinkOpen}
            onOpenChange={(nextOpen) => {
              setGuestLinkOpen(nextOpen);
              if (!nextOpen) setGuestLinkTarget(null);
            }}
          />
        </>
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
              Besöket, bilderna och alla omdömen tas bort. Gruppens progression räknas om. Om
              besöket har lagts till i andra grupper försvinner det även där. Det går inte att
              ångra.
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
