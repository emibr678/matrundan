import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarX2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Flag,
  Loader2,
  MapPin,
  Shuffle,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
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
import { useStore } from "@/lib/matrundan/store";
import type { NextStopPlaceProposal, Place } from "@/lib/matrundan/types";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";
import { useNextStopV2 } from "@/lib/matrundan/use-next-stop-v2";

type ProposalItem = {
  proposal: NextStopPlaceProposal;
  place: Place;
};

function proposalSupportLabel(count: number): string | null {
  if (count === 0) return null;
  if (count === 1) return "1 går gärna dit";
  return `${count} går gärna dit`;
}

function proposalByLabel(
  proposal: NextStopPlaceProposal,
  state: ReturnType<typeof useStore>["state"],
): string {
  if (!proposal.proposedBy) return "På förslag";
  const member = state.members.find((item) => item.id === proposal.proposedBy);
  return member ? `Föreslaget av ${member.name}` : "Föreslaget tidigare";
}

function proposalMeta(
  proposal: NextStopPlaceProposal,
  state: ReturnType<typeof useStore>["state"],
): string {
  return [proposalByLabel(proposal, state), proposalSupportLabel(proposal.supports.length)]
    .filter(Boolean)
    .join(" · ");
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
    dayUnavailableMemberIds,
    propose,
    setSupport,
    select,
    clearSelection,
    withdraw,
    setSchedule,
    setDayUnavailable,
  } = useNextStopV2();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [timeOpen, setTimeOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultNextStopDateValue);
  const [time, setTime] = React.useState("");

  const [selecting, setSelecting] = React.useState<NextStopPlaceProposal | null>(null);
  const [visitChooserOpen, setVisitChooserOpen] = React.useState(false);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const proposals = React.useMemo<ProposalItem[]>(
    () =>
      (nextStop?.proposals ?? [])
        .map((proposal) => ({ proposal, place: getPlace(proposal.placeId) }))
        .filter((item): item is ProposalItem => Boolean(item.place)),
    [getPlace, nextStop?.proposals],
  );
  const selectedPlace = nextStop?.selectedPlaceId ? getPlace(nextStop.selectedPlaceId) : undefined;
  const otherProposals = selectedPlace
    ? proposals.filter((item) => item.place.id !== selectedPlace.id)
    : [];
  const plannedDate = nextStop?.plannedDate ?? null;
  const plannedTime = nextStop?.plannedTime ?? null;
  const passed = plannedDate ? isPastDateValue(plannedDate) : false;
  const canInteract = canWrite && backendReady;
  const currentUserUnavailable = dayUnavailableMemberIds.includes(state.currentUserId);

  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  React.useEffect(() => {
    setOtherOpen(false);
  }, [selectedPlace?.id]);

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
    if (proposals.length >= 5) {
      toast.info("Fem ställen är redan på förslag.");
      return;
    }

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
      supported ? "Din markering är borttagen." : "Markerat: Går gärna dit.",
    );
  }

  async function toggleDayUnavailable() {
    if (!plannedDate) return;
    await run(
      "day-unavailable",
      () => setDayUnavailable(!currentUserUnavailable),
      currentUserUnavailable ? "Din markering är borttagen." : "Markerat: Kan inte då.",
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
      place ? `${place.name} är gruppens nästa stopp.` : "Nästa stopp är valt.",
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

  const registerCandidates = selectedPlace ? [selectedPlace] : proposals.map((item) => item.place);

  function openRegisterVisit() {
    if (registerCandidates.length === 1) {
      onRegisterVisit(registerCandidates[0].id);
      return;
    }
    if (registerCandidates.length > 1) {
      setVisitChooserOpen(true);
    }
  }

  if (passed && plannedDate) {
    return (
      <section>
        <NextStopHeading showShuffle={false} />
        <Card className="rounded-3xl border-mustard/60 bg-mustard/10 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mustard/30">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">Blev det av?</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {selectedPlace
                  ? `${selectedPlace.name} var ert nästa stopp.`
                  : proposals.length === 1
                    ? `${proposals[0].place.name} var på förslag.`
                    : proposals.length > 1
                      ? "Ni hade nästa stopp på gång."
                      : "Ni hade tänkt gå ut."}
              </p>
              <p className="mt-2 text-sm font-medium">
                {formatNextStopDate(plannedDate, plannedTime)}
              </p>
            </div>
          </div>

          {registerCandidates.length === 1 ? (
            <PlaceIdentity place={registerCandidates[0]} className="mt-4" />
          ) : null}

          <div className="mt-5 grid gap-2">
            {registerCandidates.length > 0 ? (
              <Button
                type="button"
                className="min-h-12"
                onClick={openRegisterVisit}
                disabled={!canWrite}
              >
                <Check className="h-4 w-4" /> Registrera besöket
              </Button>
            ) : (
              <Button asChild className="min-h-12">
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
              {busy === "passed" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Det blev inte av
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

  if (!hasState) {
    return (
      <section>
        <NextStopHeading
          showShuffle={canInteract}
          busy={busy}
          onShuffle={() => void randomProposal()}
        />
        <Card className="rounded-3xl border-dashed border-border bg-card p-5 text-center shadow-sm">
          <div className="text-4xl" aria-hidden="true">
            🎯
          </div>
          <h2 className="mt-3 font-display text-xl">Vart ska rundan gå härnäst?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
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
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          plannedDate={plannedDate}
          unavailableCount={dayUnavailableMemberIds.length}
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          busy={busy}
          onSave={() => void saveSchedule()}
          onRemove={() => undefined}
        />
      </section>
    );
  }

  if (selectedPlace) {
    return (
      <section>
        <NextStopHeading showShuffle={false} />
        <Card className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-sm">
          <ScheduleRow
            plannedDate={plannedDate}
            plannedTime={plannedTime}
            unavailableCount={dayUnavailableMemberIds.length}
            currentUserUnavailable={currentUserUnavailable}
            canInteract={canInteract}
            busy={busy}
            onEdit={openSchedule}
            onToggleUnavailable={() => void toggleDayUnavailable()}
          />
          <div className="p-4 sm:p-5">
            <div data-next-stop-proposal="selected">
              <PlaceIdentity place={selectedPlace} prominent />
            </div>

            {canWrite ? (
              <Button
                type="button"
                onClick={() => onRegisterVisit(selectedPlace.id)}
                className="mt-5 h-12 w-full text-base"
                size="lg"
              >
                <Check className="h-4 w-4" /> Registrera besök
              </Button>
            ) : null}

            {canInteract ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-1 min-h-11 w-full text-primary"
                onClick={() =>
                  void run(
                    "clear-selection",
                    clearSelection,
                    "Nästa stopp är öppet för förslag igen.",
                  )
                }
                disabled={busy !== null}
              >
                {busy === "clear-selection" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Flag className="h-4 w-4" />
                )}
                Ändra nästa stopp
              </Button>
            ) : null}
          </div>
        </Card>

        {otherProposals.length > 0 ? (
          <Card className="mt-2 overflow-hidden rounded-2xl border-border/70 bg-card shadow-sm">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
              aria-expanded={otherOpen}
              onClick={() => setOtherOpen((current) => !current)}
            >
              <span className="font-medium">Andra förslag ({otherProposals.length})</span>
              {otherOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {otherOpen ? (
              <div className="border-t border-border/60 p-3 sm:p-4">
                <div className="space-y-2">
                  {otherProposals.map((item) => (
                    <ProposalRow
                      key={item.proposal.id}
                      item={item}
                      state={state}
                      canInteract={canInteract}
                      busy={busy}
                      onSupport={() => void toggleSupport(item.proposal)}
                      onSelect={() => setSelecting(item.proposal)}
                      onWithdraw={() =>
                        void run(
                          `withdraw:${item.proposal.id}`,
                          () => withdraw(item.proposal.id),
                          "Förslaget är borttaget.",
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          plannedDate={plannedDate}
          unavailableCount={dayUnavailableMemberIds.length}
          date={date}
          time={time}
          onDateChange={setDate}
          onTimeChange={setTime}
          busy={busy}
          onSave={() => void saveSchedule()}
          onRemove={() =>
            void run(
              "remove-date",
              async () => {
                await setSchedule(null, null);
                setScheduleOpen(false);
              },
              "Dagen är borttagen.",
            )
          }
        />
        <SelectionDialog
          selecting={selecting}
          getPlace={getPlace}
          plannedDate={plannedDate}
          plannedTime={plannedTime}
          busy={busy}
          onClose={() => setSelecting(null)}
          onConfirm={() => void confirmSelection()}
        />
      </section>
    );
  }

  return (
    <section>
      <NextStopHeading
        showShuffle={canInteract}
        busy={busy}
        onShuffle={() => void randomProposal()}
      />
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card shadow-sm">
        <ScheduleRow
          plannedDate={plannedDate}
          plannedTime={plannedTime}
          unavailableCount={dayUnavailableMemberIds.length}
          currentUserUnavailable={currentUserUnavailable}
          canInteract={canInteract}
          busy={busy}
          onEdit={openSchedule}
          onToggleUnavailable={() => void toggleDayUnavailable()}
        />
        <div className="p-4 sm:p-5">
          {proposals.length === 0 ? (
            <div className="py-2 text-center">
              <h2 className="font-display text-lg font-semibold">Vart ska rundan gå härnäst?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {plannedDate
                  ? "Dagen är satt. Nu återstår bara att hitta nästa ställe."
                  : "Inget ställe är på förslag ännu."}
              </p>
              <Button asChild variant="outline" className="mt-4 min-h-11">
                <Link to="/matstallen">Föreslå ett ställe</Link>
              </Button>
            </div>
          ) : proposals.length === 1 ? (
            <SingleProposal
              item={proposals[0]}
              state={state}
              canInteract={canInteract}
              canWrite={canWrite}
              busy={busy}
              onSupport={() => void toggleSupport(proposals[0].proposal)}
              onSelect={() => setSelecting(proposals[0].proposal)}
              onWithdraw={() =>
                void run(
                  `withdraw:${proposals[0].proposal.id}`,
                  () => withdraw(proposals[0].proposal.id),
                  "Förslaget är borttaget.",
                )
              }
              onRegister={() => onRegisterVisit(proposals[0].place.id)}
            />
          ) : (
            <div>
              <h2 className="font-display text-lg font-semibold">Vart ska rundan gå härnäst?</h2>
              <div className="mt-3 space-y-2">
                {proposals.map((item) => (
                  <ProposalRow
                    key={item.proposal.id}
                    item={item}
                    state={state}
                    canInteract={canInteract}
                    busy={busy}
                    onSupport={() => void toggleSupport(item.proposal)}
                    onSelect={() => setSelecting(item.proposal)}
                    onWithdraw={() =>
                      void run(
                        `withdraw:${item.proposal.id}`,
                        () => withdraw(item.proposal.id),
                        "Förslaget är borttaget.",
                      )
                    }
                  />
                ))}
              </div>
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 min-h-11 w-full text-muted-foreground"
                  onClick={openRegisterVisit}
                >
                  Registrera ett spontant besök
                </Button>
              ) : null}
            </div>
          )}

          {proposals.length > 0 && proposals.length < 5 ? (
            <Button asChild variant="ghost" size="sm" className="mt-3 min-h-11 px-2 text-primary">
              <Link to="/matstallen">Föreslå ett annat ställe</Link>
            </Button>
          ) : proposals.length >= 5 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Fem ställen är på förslag – ta bort ett innan ni lägger till fler.
            </p>
          ) : null}
        </div>
      </Card>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        plannedDate={plannedDate}
        unavailableCount={dayUnavailableMemberIds.length}
        date={date}
        time={time}
        onDateChange={setDate}
        onTimeChange={setTime}
        busy={busy}
        onSave={() => void saveSchedule()}
        onRemove={() =>
          void run(
            "remove-date",
            async () => {
              await setSchedule(null, null);
              setScheduleOpen(false);
            },
            "Dagen är borttagen.",
          )
        }
      />
      <SelectionDialog
        selecting={selecting}
        getPlace={getPlace}
        plannedDate={plannedDate}
        plannedTime={plannedTime}
        busy={busy}
        onClose={() => setSelecting(null)}
        onConfirm={() => void confirmSelection()}
      />
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

function NextStopHeading({
  showShuffle,
  onShuffle,
  busy = null,
}: {
  showShuffle: boolean;
  onShuffle?: () => void;
  busy?: string | null;
}) {
  return (
    <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Nästa stopp
      </div>
      {showShuffle && onShuffle ? (
        <button
          type="button"
          onClick={onShuffle}
          disabled={busy !== null}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mustard/50 px-3 py-1.5 text-xs font-medium text-mustard-foreground disabled:opacity-50"
        >
          {busy === "shuffle" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shuffle className="h-3.5 w-3.5" />
          )}
          Slumpa förslag
        </button>
      ) : null}
    </div>
  );
}

function ScheduleRow({
  plannedDate,
  plannedTime,
  unavailableCount,
  currentUserUnavailable,
  canInteract,
  busy,
  onEdit,
  onToggleUnavailable,
}: {
  plannedDate: string | null;
  plannedTime: string | null;
  unavailableCount: number;
  currentUserUnavailable: boolean;
  canInteract: boolean;
  busy: string | null;
  onEdit: () => void;
  onToggleUnavailable: () => void;
}) {
  return (
    <div className="border-b border-border/60 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              När?
            </span>
            {canInteract ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2 text-xs text-primary"
                onClick={onEdit}
              >
                {plannedDate ? "Ändra dag" : "Lägg till dag"}
              </Button>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-sm font-medium">
            {plannedDate ? (
              <>
                <span className="whitespace-nowrap">{formatNextStopDate(plannedDate, null)}</span>
                {plannedTime ? (
                  <span className="whitespace-nowrap text-muted-foreground">· {plannedTime}</span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Ingen dag bestämd ännu</span>
            )}
          </div>
        </div>
      </div>

      {plannedDate ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 pl-7">
          <span className="text-xs text-muted-foreground">
            {unavailableCount > 0
              ? unavailableCount === 1
                ? "1 kan inte då"
                : `${unavailableCount} kan inte då`
              : "\u00A0"}
          </span>
          {canInteract ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              aria-pressed={currentUserUnavailable}
              onClick={onToggleUnavailable}
              disabled={busy !== null}
            >
              {busy === "day-unavailable" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarX2 className="h-3.5 w-3.5" />
              )}
              Kan inte då
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PlaceIdentity({
  place,
  prominent = false,
  className = "",
}: {
  place: Place;
  prominent?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-3 ${className}`}>
      <Link
        to="/matstallen/$placeId"
        params={{ placeId: place.id }}
        className={[
          "grid shrink-0 place-items-center rounded-2xl bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring",
          prominent ? "h-16 w-16 text-3xl" : "h-12 w-12 text-2xl",
        ].join(" ")}
        aria-label={`Öppna ${place.name}`}
      >
        {place.photo ?? "🍽️"}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/matstallen/$placeId"
          params={{ placeId: place.id }}
          className={[
            "block font-display font-semibold leading-tight hover:underline",
            prominent ? "text-2xl" : "text-lg",
          ].join(" ")}
        >
          {place.name}
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {place.address}, {place.city}
          </span>
        </div>
      </div>
    </div>
  );
}

function SingleProposal({
  item,
  state,
  canInteract,
  canWrite,
  busy,
  onSupport,
  onSelect,
  onWithdraw,
  onRegister,
}: {
  item: ProposalItem;
  state: ReturnType<typeof useStore>["state"];
  canInteract: boolean;
  canWrite: boolean;
  busy: string | null;
  onSupport: () => void;
  onSelect: () => void;
  onWithdraw: () => void;
  onRegister: () => void;
}) {
  const supported = item.proposal.supports.some(
    (support) => support.memberId === state.currentUserId,
  );
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);

  return (
    <div data-next-stop-proposal="open">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">{item.place.name} är på förslag</h2>
        {canRemove ? (
          <RemoveProposalButton
            placeName={item.place.name}
            busy={busy === `withdraw:${item.proposal.id}`}
            onClick={onWithdraw}
          />
        ) : null}
      </div>
      <PlaceIdentity place={item.place} className="mt-3" />
      <p className="mt-2 text-sm text-muted-foreground">{proposalMeta(item.proposal, state)}</p>

      {canInteract ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <SupportButton
            supported={supported}
            busy={busy === `support:${item.proposal.id}`}
            onClick={onSupport}
          />
          <Button type="button" className="min-h-11" onClick={onSelect} disabled={busy !== null}>
            <Flag className="h-4 w-4" /> Välj som nästa stopp
          </Button>
        </div>
      ) : null}

      {canWrite ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 min-h-11 w-full text-muted-foreground"
          onClick={onRegister}
        >
          Registrera ett spontant besök
        </Button>
      ) : null}
    </div>
  );
}

function ProposalRow({
  item,
  state,
  canInteract,
  busy,
  onSupport,
  onSelect,
  onWithdraw,
}: {
  item: ProposalItem;
  state: ReturnType<typeof useStore>["state"];
  canInteract: boolean;
  busy: string | null;
  onSupport: () => void;
  onSelect: () => void;
  onWithdraw: () => void;
}) {
  const supported = item.proposal.supports.some(
    (support) => support.memberId === state.currentUserId,
  );
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);

  return (
    <div
      data-next-stop-proposal="open"
      className="rounded-2xl border border-border/70 bg-background/45 p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <PlaceIdentity place={item.place} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {proposalMeta(item.proposal, state)}
          </p>
        </div>
        {canRemove ? (
          <RemoveProposalButton
            placeName={item.place.name}
            busy={busy === `withdraw:${item.proposal.id}`}
            onClick={onWithdraw}
          />
        ) : null}
      </div>
      {canInteract ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <SupportButton
            supported={supported}
            busy={busy === `support:${item.proposal.id}`}
            onClick={onSupport}
          />
          <Button
            type="button"
            size="sm"
            className="min-h-10"
            onClick={onSelect}
            disabled={busy !== null}
          >
            <Flag className="h-4 w-4" /> Välj
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SupportButton({
  supported,
  busy,
  onClick,
}: {
  supported: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={supported ? "secondary" : "outline"}
      className="min-h-10"
      aria-pressed={supported}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ThumbsUp className={supported ? "h-4 w-4 fill-current" : "h-4 w-4"} />
      )}
      Går gärna dit
    </Button>
  );
}

function RemoveProposalButton({
  placeName,
  busy,
  onClick,
}: {
  placeName: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
      aria-label={`Ta bort ${placeName} från förslagen`}
      onClick={onClick}
    >
      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
      Ta bort
    </Button>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  plannedDate,
  unavailableCount,
  date,
  time,
  onDateChange,
  onTimeChange,
  busy,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedDate: string | null;
  unavailableCount: number;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  busy: string | null;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{plannedDate ? "Ändra dag" : "Lägg till dag"}</DialogTitle>
          <DialogDescription>
            Dagen är en del av nästa stopp. Lägg bara till klockslag om ni redan har bestämt det.
            {plannedDate && unavailableCount > 0
              ? " Om ni byter dag nollställs gruppens Kan inte då-markeringar."
              : ""}
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
              onChange={(event) => onDateChange(event.target.value)}
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
                onChange={(event) => onTimeChange(event.target.value)}
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
              onClick={onRemove}
            >
              Ta bort dag
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={busy !== null} onClick={onSave}>
            {busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectionDialog({
  selecting,
  getPlace,
  plannedDate,
  plannedTime,
  busy,
  onClose,
  onConfirm,
}: {
  selecting: NextStopPlaceProposal | null;
  getPlace: (placeId: string) => Place | undefined;
  plannedDate: string | null;
  plannedTime: string | null;
  busy: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(selecting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Välj nästa stopp</DialogTitle>
          <DialogDescription>
            {selecting
              ? `Ska ${getPlace(selecting.placeId)?.name ?? "det här stället"} bli gruppens nästa stopp?`
              : "Välj ett ställe."}
            {plannedDate ? ` ${formatNextStopDate(plannedDate, plannedTime)} ligger kvar.` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Inte än
          </Button>
          <Button type="button" disabled={busy !== null} onClick={onConfirm}>
            {selecting && busy === `select:${selecting.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Ja, välj nästa stopp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
