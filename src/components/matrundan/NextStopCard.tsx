import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flag,
  Loader2,
  MapPin,
  Shuffle,
  ThumbsUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  defaultNextStopDateValue,
  formatNextStopDate,
  isPastDateValue,
  localDateValue,
  normalizeNextStopTime,
} from "@/lib/matrundan/next-stop-date";
import { canWithdrawNextStopProposal } from "@/lib/matrundan/next-stop-v2";
import { useNextStopV2 } from "@/lib/matrundan/use-next-stop-v2";
import { useStore } from "@/lib/matrundan/store";
import type { NextStopPlaceProposal, Place } from "@/lib/matrundan/types";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

function proposalSupportLabel(count: number): string {
  if (count === 0) return "Ingen har markerat Gärna än";
  if (count === 1) return "1 vill gärna hit";
  return `${count} vill gärna hit`;
}

function proposalByLabel(
  proposal: NextStopPlaceProposal,
  state: ReturnType<typeof useStore>["state"],
): string {
  if (!proposal.proposedBy) return "På förslag";
  const member = state.members.find((item) => item.id === proposal.proposedBy);
  return member ? `Föreslaget av ${member.name}` : "Föreslaget tidigare";
}

export function NextStopCard({
  activePlaces,
  canWrite,
  onRegisterVisit,
}: {
  activePlaces: Place[];
  canWrite: boolean;
  onRegisterVisit: (placeId: string) => void;
}) {
  const { state, getPlace } = useStore();
  const {
    nextStop,
    backendReady,
    propose,
    setSupport,
    select,
    clearSelection,
    withdraw,
    setSchedule,
  } = useNextStopV2();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultNextStopDateValue);
  const [time, setTime] = React.useState("");
  const [selecting, setSelecting] = React.useState<NextStopPlaceProposal | null>(null);
  const [visitChooserOpen, setVisitChooserOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const proposals = React.useMemo(
    () =>
      (nextStop?.proposals ?? [])
        .map((proposal) => ({ proposal, place: getPlace(proposal.placeId) }))
        .filter((item): item is { proposal: NextStopPlaceProposal; place: Place } => Boolean(item.place)),
    [getPlace, nextStop?.proposals],
  );
  const selectedPlace = nextStop?.selectedPlaceId ? getPlace(nextStop.selectedPlaceId) : undefined;
  const plannedDate = nextStop?.plannedDate ?? null;
  const plannedTime = nextStop?.plannedTime ?? null;
  const passed = plannedDate ? isPastDateValue(plannedDate) : false;
  const canInteract = canWrite && backendReady;

  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  async function run(key: string, operation: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(key);
    try {
      await operation();
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte uppdatera nästa stopp.");
    } finally {
      setBusy(null);
    }
  }

  function openSchedule() {
    setDate(plannedDate ?? defaultNextStopDateValue());
    setTime(plannedTime ?? "");
    setScheduleOpen(true);
  }

  async function saveSchedule() {
    if (!date) {
      toast.error("Välj en dag.");
      return;
    }
    if (isPastDateValue(date)) {
      toast.error("Dagen kan inte ligga i det förflutna.");
      return;
    }

    let normalizedTime: string | null;
    try {
      normalizedTime = normalizeNextStopTime(time);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kontrollera tiden.");
      return;
    }

    await run(
      "schedule",
      async () => {
        await setSchedule(date, normalizedTime);
        setScheduleOpen(false);
      },
      normalizedTime ? "Dag och tid är sparade." : "Dagen är sparad.",
    );
  }

  async function randomProposal() {
    const alreadyProposed = new Set(proposals.map((item) => item.place.id));
    const preferredPool = untried.filter((place) => !alreadyProposed.has(place.id));
    const fallbackPool = activePlaces.filter((place) => !alreadyProposed.has(place.id));
    const pool = preferredPool.length > 0 ? preferredPool : fallbackPool;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) {
      toast.info("Alla aktiva ställen är redan på förslag.");
      return;
    }
    await run("shuffle", () => propose(pick.id), `${pick.name} är på förslag.`);
  }

  async function toggleSupport(proposal: NextStopPlaceProposal) {
    const supported = proposal.supports.some((item) => item.memberId === state.currentUserId);
    await run(
      `support:${proposal.id}`,
      () => setSupport(proposal.id, !supported),
      supported ? "Din Gärna-markering är borttagen." : "Markerat: Gärna!",
    );
  }

  async function confirmSelection() {
    if (!selecting) return;
    const place = getPlace(selecting.placeId);
    await run(
      `select:${selecting.id}`,
      async () => {
        await select(selecting.id);
        setSelecting(null);
      },
      place ? `${place.name} är gruppens nästa stopp.` : "Nästa stopp är bestämt.",
    );
  }

  async function clearPassedDate() {
    await run(
      "passed",
      () => setSchedule(null, null),
      selectedPlace
        ? `Dagen är borttagen. ${selectedPlace.name} ligger kvar som nästa stopp.`
        : "Dagen är borttagen. Förslagen ligger kvar.",
    );
  }

  const registerCandidates = selectedPlace
    ? [selectedPlace]
    : proposals.map((item) => item.place);

  if (passed && plannedDate) {
    const dateLabel = formatNextStopDate(plannedDate, plannedTime);
    return (
      <section>
        <NextStopHeading canInteract={canInteract} onShuffle={() => void randomProposal()} busy={busy} />
        <Card className="rounded-3xl border-mustard/60 bg-mustard/10 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mustard/30">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">Blev det av?</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {selectedPlace
                  ? `${selectedPlace.name} var ert nästa stopp ${dateLabel.toLocaleLowerCase("sv-SE")}.`
                  : proposals.length === 1
                    ? `${proposals[0].place.name} var på förslag ${dateLabel.toLocaleLowerCase("sv-SE")}.`
                    : proposals.length > 1
                      ? `Ni hade nästa stopp på gång ${dateLabel.toLocaleLowerCase("sv-SE")}.`
                      : `Ni hade tänkt gå ut ${dateLabel.toLocaleLowerCase("sv-SE")}.`}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {registerCandidates.length === 1 ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => onRegisterVisit(registerCandidates[0].id)}
                disabled={!canWrite}
              >
                <Check className="h-4 w-4" /> Registrera besöket
              </Button>
            ) : registerCandidates.length > 1 ? (
              <Button
                type="button"
                className="min-h-11"
                onClick={() => setVisitChooserOpen(true)}
                disabled={!canWrite}
              >
                <Check className="h-4 w-4" /> Registrera besöket
              </Button>
            ) : (
              <Button asChild className="min-h-11">
                <Link to="/matstallen">Välj ställe</Link>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void clearPassedDate()}
              disabled={!canInteract || busy !== null}
            >
              {busy === "passed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Nej, det blev inte av
            </Button>
          </div>
        </Card>
        <VisitChooserDialog
          open={visitChooserOpen}
          onOpenChange={setVisitChooserOpen}
          places={registerCandidates}
          onChoose={(placeId) => {
            setVisitChooserOpen(false);
            onRegisterVisit(placeId);
          }}
        />
      </section>
    );
  }

  const hasState = Boolean(selectedPlace || proposals.length > 0 || plannedDate || plannedTime);

  return (
    <section>
      <NextStopHeading canInteract={canInteract} onShuffle={() => void randomProposal()} busy={busy} />

      {!hasState ? (
        <Card className="rounded-3xl border-dashed border-border bg-card p-6 text-center shadow-sm">
          <div className="text-5xl">🎯</div>
          <h2 className="mt-3 font-display text-xl">Vart ska rundan gå härnäst?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Börja med ett ställe eller en dag. Resten kan ni fylla i när det passar.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/matstallen">Föreslå ett ställe</Link>
            </Button>
            {canInteract ? (
              <Button type="button" variant="outline" onClick={openSchedule}>
                <CalendarDays className="h-4 w-4" /> Lägg till dag
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-sm">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  När?
                </div>
                <div className="truncate text-sm font-medium">
                  {plannedDate ? formatNextStopDate(plannedDate, plannedTime) : "Ingen dag bestämd ännu"}
                </div>
              </div>
            </div>
            {canInteract ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 shrink-0 rounded-full px-3 text-primary"
                onClick={openSchedule}
              >
                {plannedDate ? "Ändra dag" : "Lägg till dag"}
              </Button>
            ) : null}
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Vart?
                </div>
                <h2 className="font-display text-lg font-semibold">
                  {selectedPlace
                    ? "Nästa stopp är bestämt"
                    : proposals.length > 1
                      ? "Vart ska rundan gå?"
                      : proposals.length === 1
                        ? `${proposals[0].place.name} är på förslag`
                        : "Vart ska rundan gå?"}
                </h2>
              </div>
              {proposals.length > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {proposals.length} förslag
                </span>
              ) : null}
            </div>

            {proposals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {plannedDate ? "Dagen är satt. Nu återstår bara vart ni ska gå." : "Inget ställe är på förslag ännu."}
                </p>
                <Button asChild variant="outline" className="mt-3 min-h-11">
                  <Link to="/matstallen">Föreslå ett ställe</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {proposals.map(({ proposal, place }, index) => {
                  const selected = nextStop?.selectedPlaceId === place.id;
                  const supported = proposal.supports.some(
                    (item) => item.memberId === state.currentUserId,
                  );
                  const canRemove = canInteract && canWithdrawNextStopProposal(state, proposal);
                  return (
                    <div
                      key={proposal.id}
                      data-next-stop-proposal={selected ? "selected" : "open"}
                      className={[
                        "rounded-2xl border p-3",
                        selected ? "border-primary/35 bg-primary/[0.05]" : "border-border/70 bg-background/50",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <Link
                          to="/matstallen/$placeId"
                          params={{ placeId: place.id }}
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Öppna ${place.name}`}
                        >
                          {place.photo ?? "🍽️"}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {selected ? <Badge className="rounded-full">Nästa stopp</Badge> : null}
                            {!selected && index === 0 && proposals.length > 1 ? (
                              <Badge variant="outline" className="rounded-full">Första förslaget</Badge>
                            ) : null}
                          </div>
                          <Link
                            to="/matstallen/$placeId"
                            params={{ placeId: place.id }}
                            className="mt-1 block font-display text-lg font-semibold leading-tight hover:underline"
                          >
                            {place.name}
                          </Link>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{place.address}, {place.city}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {proposalByLabel(proposal, state)} · {proposalSupportLabel(proposal.supports.length)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!selected && canInteract ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={supported ? "secondary" : "outline"}
                            className="min-h-11"
                            aria-pressed={supported}
                            onClick={() => void toggleSupport(proposal)}
                            disabled={busy !== null}
                          >
                            {busy === `support:${proposal.id}` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ThumbsUp className={supported ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                            )}
                            {supported ? "Gärna!" : "Gärna"}
                          </Button>
                        ) : null}
                        {!selected && canInteract ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-11"
                            onClick={() => setSelecting(proposal)}
                            disabled={busy !== null}
                          >
                            <Flag className="h-4 w-4" /> Välj som nästa stopp
                          </Button>
                        ) : null}
                        {selected && canInteract ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            onClick={() =>
                              void run(
                                "clear-selection",
                                clearSelection,
                                "Valet är öppet igen. Förslagen ligger kvar.",
                              )
                            }
                            disabled={busy !== null}
                          >
                            {busy === "clear-selection" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Öppna valet igen
                          </Button>
                        ) : null}
                        {canRemove && !selected ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-11 text-muted-foreground"
                            onClick={() =>
                              void run(
                                `withdraw:${proposal.id}`,
                                () => withdraw(proposal.id),
                                "Förslaget är borttaget.",
                              )
                            }
                            disabled={busy !== null}
                          >
                            <X className="h-4 w-4" /> Ta bort
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {proposals.length < 5 ? (
                <Button asChild variant="ghost" size="sm" className="min-h-11 px-2 text-primary">
                  <Link to="/matstallen">Föreslå ett annat ställe</Link>
                </Button>
              ) : (
                <span className="px-2 py-2 text-xs text-muted-foreground">
                  Fem ställen är på förslag – ta bort ett innan ni lägger till fler.
                </span>
              )}
            </div>
          </div>

          {selectedPlace && canWrite ? (
            <div className="border-t border-border/60 p-4">
              <Button
                type="button"
                onClick={() => onRegisterVisit(selectedPlace.id)}
                className="h-12 w-full text-base"
                size="lg"
              >
                Registrera besök
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{plannedDate ? "Ändra dag" : "Lägg till dag"}</DialogTitle>
            <DialogDescription>
              Dagen är en del av nästa stopp. Lägg bara till klockslag om ni redan har bestämt det.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="next-stop-v2-date">Dag</Label>
              <Input
                id="next-stop-v2-date"
                type="date"
                min={localDateValue(new Date())}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="next-stop-v2-time">Tid (valfritt)</Label>
              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="next-stop-v2-time"
                  type="time"
                  className="pl-9"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {plannedDate ? (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    "remove-date",
                    async () => {
                      await setSchedule(null, null);
                      setScheduleOpen(false);
                    },
                    "Dagen är borttagen.",
                  )
                }
              >
                Ta bort dag
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void saveSchedule()}>
              {busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selecting)} onOpenChange={(open) => !open && setSelecting(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bestäm nästa stopp</DialogTitle>
            <DialogDescription>
              {selecting
                ? `Ska ${getPlace(selecting.placeId)?.name ?? "det här stället"} bli gruppens nästa stopp?`
                : "Välj ett ställe."}
              {plannedDate ? ` ${formatNextStopDate(plannedDate, plannedTime)} ligger kvar som dag.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelecting(null)}>
              Inte än
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void confirmSelection()}>
              {selecting && busy === `select:${selecting.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Ja, bestäm nästa stopp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function NextStopHeading({
  canInteract,
  onShuffle,
  busy,
}: {
  canInteract: boolean;
  onShuffle: () => void;
  busy: string | null;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Nästa stopp
      </div>
      {canInteract ? (
        <button
          type="button"
          onClick={onShuffle}
          disabled={busy !== null}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mustard/50 px-3 py-1.5 text-xs font-medium text-mustard-foreground disabled:opacity-50"
        >
          {busy === "shuffle" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
          Slumpa förslag
        </button>
      ) : null}
    </div>
  );
}

function VisitChooserDialog({
  open,
  onOpenChange,
  places,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  places: Place[];
  onChoose: (placeId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Vilket ställe blev det?</DialogTitle>
          <DialogDescription>Välj det ställe ni faktiskt besökte.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {places.map((place) => (
            <Button
              key={place.id}
              type="button"
              variant="outline"
              className="min-h-12 justify-between gap-3 whitespace-normal text-left"
              onClick={() => onChoose(place.id)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-xl">{place.photo ?? "🍽️"}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{place.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {CATEGORY_LABEL[place.category]}
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
