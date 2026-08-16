import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Flag,
  Loader2,
  MapPin,
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    setScheduleOpen(true);
  }

  function openTime() {
    setTime(plannedTime ?? "");
    setTimeOpen(true);
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

    await run(
      "schedule",
      async () => {
        await setSchedule(date, plannedTime);
        setScheduleOpen(false);
      },
      "Dagen är sparad.",
    );
  }

  async function saveTime() {
    if (!plannedDate) {
      toast.error("Lägg till en dag först.");
      return;
    }

    let normalizedTime: string | null;
    try {
      normalizedTime = normalizeNextStopTime(time);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kontrollera tiden.");
      return;
    }
    if (!normalizedTime) {
      toast.error("Ange ett klockslag.");
      return;
    }

    await run(
      "time",
      async () => {
        await setSchedule(plannedDate, normalizedTime);
        setTimeOpen(false);
      },
      "Tiden är sparad.",
    );
  }

  async function removeTime() {
    if (!plannedDate) return;
    await run(
      "remove-time",
      async () => {
        await setSchedule(plannedDate, null);
        setTimeOpen(false);
      },
      "Tiden är borttagen.",
    );
  }

  async function removeDate() {
    await run(
      "remove-date",
      async () => {
        await setSchedule(null, null);
        setScheduleOpen(false);
      },
      "Dagen är borttagen.",
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

  function withdrawProposal(item: ProposalItem) {
    void run(
      `withdraw:${item.proposal.id}`,
      () => withdraw(item.proposal.id),
      "Förslaget är borttaget.",
    );
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
          date={date}
          onDateChange={setDate}
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
        <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div data-next-stop-proposal="selected">
            <PlaceIdentity place={selectedPlace} prominent />
          </div>

          <DateLine
            plannedDate={plannedDate}
            plannedTime={plannedTime}
            canInteract={canInteract}
            canManageTime
            busy={busy}
            onEditDate={openSchedule}
            onEditTime={openTime}
            onRemoveTime={() => void removeTime()}
            onRemoveDate={() => void removeDate()}
          />

          {canWrite ? (
            <Button
              type="button"
              onClick={() => onRegisterVisit(selectedPlace.id)}
              className="mt-4 h-12 w-full text-base"
              size="lg"
            >
              <Check className="h-4 w-4" /> Registrera besök
            </Button>
          ) : null}

          {canInteract ? (
            <div className="mt-1 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 px-2 text-xs font-normal text-muted-foreground"
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Ändra nästa stopp
              </Button>
            </div>
          ) : null}
        </Card>

        {otherProposals.length > 0 ? (
          <div className="mt-2">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={otherOpen}
              onClick={() => setOtherOpen((current) => !current)}
            >
              <span>Andra förslag ({otherProposals.length})</span>
              {otherOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
            </button>
            {otherOpen ? (
              <div className="mt-1 divide-y divide-border/60 border-t border-border/60">
                {otherProposals.map((item) => (
                  <ProposalRow
                    key={item.proposal.id}
                    selectLabel="Byt till"
                    item={item}
                    state={state}
                    canInteract={canInteract}
                    busy={busy}
                    onSupport={() => void toggleSupport(item.proposal)}
                    onSelect={() => setSelecting(item.proposal)}
                    onWithdraw={() => withdrawProposal(item)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          plannedDate={plannedDate}
          date={date}
          onDateChange={setDate}
          busy={busy}
          onSave={() => void saveSchedule()}
          onRemove={() => void removeDate()}
        />
        <TimeDialog
          open={timeOpen}
          onOpenChange={setTimeOpen}
          plannedDate={plannedDate}
          plannedTime={plannedTime}
          time={time}
          onTimeChange={setTime}
          busy={busy}
          onSave={() => void saveTime()}
          onRemove={() => void removeTime()}
        />
        <SelectionDialog
          selecting={selecting}
          getPlace={getPlace}
          plannedDate={plannedDate}
          plannedTime={plannedTime}
          isSwitch
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
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-4 shadow-sm sm:p-5">
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
            busy={busy}
            onSupport={() => void toggleSupport(proposals[0].proposal)}
            onSelect={() => setSelecting(proposals[0].proposal)}
            onWithdraw={() => withdrawProposal(proposals[0])}
          />
        ) : (
          <div>
            <h2 className="font-display text-lg font-semibold">Vart ska rundan gå härnäst?</h2>
            <div className="mt-2 divide-y divide-border/60 border-t border-border/60">
              {proposals.map((item) => (
                <ProposalRow
                  key={item.proposal.id}
                  selectLabel="Bestäm"
                  item={item}
                  state={state}
                  canInteract={canInteract}
                  busy={busy}
                  onSupport={() => void toggleSupport(item.proposal)}
                  onSelect={() => setSelecting(item.proposal)}
                  onWithdraw={() => withdrawProposal(item)}
                />
              ))}
            </div>
          </div>
        )}

        <DateLine
          plannedDate={plannedDate}
          plannedTime={plannedTime}
          canInteract={canInteract}
          canManageTime={false}
          busy={busy}
          onEditDate={openSchedule}
          onEditTime={openTime}
          onRemoveTime={() => void removeTime()}
          onRemoveDate={() => void removeDate()}
        />

        {proposals.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0">
            {proposals.length < 5 ? (
              <Button asChild variant="ghost" size="sm" className="min-h-10 px-2 text-primary">
                <Link to="/matstallen">Föreslå ett annat ställe</Link>
              </Button>
            ) : (
              <p className="px-2 text-xs text-muted-foreground">
                Fem ställen är på förslag – ta bort ett innan ni lägger till fler.
              </p>
            )}
            {canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10 px-2 text-xs font-normal text-muted-foreground"
                onClick={openRegisterVisit}
              >
                Registrera ett spontant besök
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        plannedDate={plannedDate}
        date={date}
        onDateChange={setDate}
        busy={busy}
        onSave={() => void saveSchedule()}
        onRemove={() => void removeDate()}
      />
      <SelectionDialog
        selecting={selecting}
        getPlace={getPlace}
        plannedDate={plannedDate}
        plannedTime={plannedTime}
        isSwitch={false}
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

function DateLine({
  plannedDate,
  plannedTime,
  canInteract,
  canManageTime,
  busy,
  onEditDate,
  onEditTime,
  onRemoveTime,
  onRemoveDate,
}: {
  plannedDate: string | null;
  plannedTime: string | null;
  canInteract: boolean;
  canManageTime: boolean;
  busy: string | null;
  onEditDate: () => void;
  onEditTime: () => void;
  onRemoveTime: () => void;
  onRemoveDate: () => void;
}) {
  if (!plannedDate) {
    if (!canInteract) return null;
    return (
      <div className="mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-2 text-xs font-normal text-muted-foreground"
          onClick={onEditDate}
        >
          <CalendarDays className="h-4 w-4" /> Lägg till dag
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">
          {formatNextStopDate(plannedDate, null)}
          {plannedTime ? ` · ${plannedTime}` : ""}
        </span>
      </div>
      {canInteract ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              aria-label="Ändra dag eller tid"
              disabled={busy !== null}
            >
              {busy === "schedule" || busy === "time" || busy === "remove-time" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditDate}>
              <CalendarDays className="h-4 w-4" /> Ändra dag
            </DropdownMenuItem>
            {canManageTime ? (
              <DropdownMenuItem onSelect={onEditTime}>
                <Clock3 className="h-4 w-4" /> {plannedTime ? "Ändra tid" : "Lägg till tid"}
              </DropdownMenuItem>
            ) : null}
            {canManageTime && plannedTime ? (
              <DropdownMenuItem onSelect={onRemoveTime}>Ta bort tid</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onRemoveDate}>Ta bort dag</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  const supportLabel = proposalSupportLabel(item.proposal.supports.length);

  return (
    <div data-next-stop-proposal="open">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <PlaceIdentity place={item.place} prominent />
        {canRemove ? (
          <ProposalMenu
            placeName={item.place.name}
            busy={busy === `withdraw:${item.proposal.id}`}
            onWithdraw={onWithdraw}
          />
        ) : null}
      </div>

      {supportLabel ? (
        <p className="mt-2 text-xs text-muted-foreground">{supportLabel}</p>
      ) : null}

      {canInteract ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SupportButton
            supported={supported}
            busy={busy === `support:${item.proposal.id}`}
            onClick={onSupport}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 border-primary/40 text-primary"
            onClick={onSelect}
            disabled={busy !== null}
          >
            <Flag className="h-4 w-4" /> Välj som nästa stopp
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ProposalRow({
  item,
  state,
  canInteract,
  busy,
  selectLabel,
  onSupport,
  onSelect,
  onWithdraw,
}: {
  item: ProposalItem;
  state: ReturnType<typeof useStore>["state"];
  canInteract: boolean;
  busy: string | null;
  selectLabel: string;
  onSupport: () => void;
  onSelect: () => void;
  onWithdraw: () => void;
}) {
  const supported = item.proposal.supports.some(
    (support) => support.memberId === state.currentUserId,
  );
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);
  const supportLabel = proposalSupportLabel(item.proposal.supports.length);

  return (
    <div data-next-stop-proposal="open" className="py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <PlaceIdentity place={item.place} />
          {supportLabel ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{supportLabel}</p>
          ) : null}
        </div>
        {canRemove ? (
          <ProposalMenu
            placeName={item.place.name}
            busy={busy === `withdraw:${item.proposal.id}`}
            onWithdraw={onWithdraw}
          />
        ) : null}
      </div>
      {canInteract ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <SupportButton
            supported={supported}
            busy={busy === `support:${item.proposal.id}`}
            onClick={onSupport}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 border-primary/40 text-primary"
            onClick={onSelect}
            disabled={busy !== null}
          >
            {selectLabel}
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

function ProposalMenu({
  placeName,
  busy,
  onWithdraw,
}: {
  placeName: string;
  busy: boolean;
  onWithdraw: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground"
          aria-label={`Fler val för ${placeName}`}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onWithdraw}>Ta bort</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  plannedDate,
  date,
  onDateChange,
  busy,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedDate: string | null;
  date: string;
  onDateChange: (date: string) => void;
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
            Dagen är kärnan i nästa stopp. Klockslag lägger ni till när stället är bestämt.
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

function TimeDialog({
  open,
  onOpenChange,
  plannedDate,
  plannedTime,
  time,
  onTimeChange,
  busy,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedDate: string | null;
  plannedTime: string | null;
  time: string;
  onTimeChange: (time: string) => void;
  busy: string | null;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{plannedTime ? "Ändra tid" : "Lägg till tid"}</DialogTitle>
          <DialogDescription>
            {plannedDate
              ? `Klockslaget är praktisk information för ${formatNextStopDate(plannedDate, null)}.`
              : "Klockslaget är praktisk information."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="next-stop-v2-time">Tid</Label>
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
        <DialogFooter className="gap-2 sm:gap-0">
          {plannedTime ? (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              disabled={busy !== null}
              onClick={onRemove}
            >
              Ta bort tid
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={busy !== null} onClick={onSave}>
            {busy === "time" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
  isSwitch,
  busy,
  onClose,
  onConfirm,
}: {
  selecting: NextStopPlaceProposal | null;
  getPlace: (placeId: string) => Place | undefined;
  plannedDate: string | null;
  plannedTime: string | null;
  isSwitch: boolean;
  busy: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(selecting)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isSwitch ? "Byt nästa stopp" : "Välj nästa stopp"}</DialogTitle>
          <DialogDescription>
            {selecting
              ? isSwitch
                ? `Ska ${getPlace(selecting.placeId)?.name ?? "det här stället"} bli gruppens nästa stopp i stället?`
                : `Ska ${getPlace(selecting.placeId)?.name ?? "det här stället"} bli gruppens nästa stopp?`
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
            {isSwitch ? "Ja, byt nästa stopp" : "Ja, välj nästa stopp"}
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
