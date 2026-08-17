import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
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
} from "@/lib/matrundan/next-stop-date";
import { canWithdrawNextStopProposal } from "@/lib/matrundan/next-stop-v2";
import { useStore } from "@/lib/matrundan/store";
import type { NextStopPlaceProposal, Place } from "@/lib/matrundan/types";
import { useNextStopV2 } from "@/lib/matrundan/use-next-stop-v2";

type ProposalItem = {
  proposal: NextStopPlaceProposal;
  place: Place;
};

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
  const { nextStop, backendReady, propose, setSupport, select, withdraw, setSchedule } =
    useNextStopV2();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultNextStopDateValue);
  const [switching, setSwitching] = React.useState<NextStopPlaceProposal | null>(null);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const proposals = React.useMemo<ProposalItem[]>(
    () =>
      (nextStop?.proposals ?? [])
        .map((proposal) => ({ proposal, place: getPlace(proposal.placeId) }))
        .filter((item): item is ProposalItem => Boolean(item.place)),
    [getPlace, nextStop?.proposals],
  );
  const focusedItem =
    proposals.find((item) => item.place.id === nextStop?.selectedPlaceId) ?? proposals[0];
  const focusedPlace = focusedItem?.place;
  const otherProposals = focusedItem
    ? proposals.filter((item) => item.proposal.id !== focusedItem.proposal.id)
    : [];
  const plannedDate = nextStop?.plannedDate ?? null;
  const passed = plannedDate ? isPastDateValue(plannedDate) : false;
  const canInteract = canWrite && backendReady;

  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  React.useEffect(() => {
    setOtherOpen(false);
  }, [focusedPlace?.id]);

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
        await setSchedule(date);
        setScheduleOpen(false);
      },
      "Dagen är sparad.",
    );
  }

  async function removeDate() {
    await run(
      "remove-date",
      async () => {
        await setSchedule(null);
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

    await run(
      "shuffle",
      () => propose(pick.id),
      focusedPlace
        ? `${pick.name} lades till under Andra förslag.`
        : `${pick.name} är gruppens nästa stopp.`,
    );
  }

  async function toggleSupport(proposal: NextStopPlaceProposal) {
    const supported = proposal.supports.some((item) => item.memberId === state.currentUserId);
    await run(
      `support:${proposal.id}`,
      () => setSupport(proposal.id, !supported),
      supported ? "Din markering är borttagen." : "Markerat: Går gärna hit.",
    );
  }

  async function confirmSwitch() {
    if (!switching) return;
    const place = getPlace(switching.placeId);
    await run(
      `select:${switching.id}`,
      async () => {
        await select(switching.id);
        setSwitching(null);
      },
      place ? `${place.name} är gruppens nästa stopp.` : "Nästa stopp är bytt.",
    );
  }

  function withdrawProposal(item: ProposalItem) {
    void run(
      `withdraw:${item.proposal.id}`,
      () => withdraw(item.proposal.id),
      "Förslaget är borttaget.",
    );
  }

  async function clearPassedDate() {
    await run(
      "passed",
      () => setSchedule(null),
      focusedPlace
        ? `Dagen är borttagen. ${focusedPlace.name} ligger kvar som nästa stopp.`
        : "Dagen är borttagen.",
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
                {focusedPlace ? `${focusedPlace.name} var ert nästa stopp.` : "Ni hade tänkt gå ut."}
              </p>
              <p className="mt-2 text-sm font-medium">{formatNextStopDate(plannedDate, null)}</p>
            </div>
          </div>

          {focusedPlace ? <PlaceIdentity place={focusedPlace} className="mt-4" /> : null}

          <div className="mt-5 grid gap-2">
            {focusedPlace ? (
              <Button
                type="button"
                className="min-h-12"
                onClick={() => onRegisterVisit(focusedPlace.id)}
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
      </section>
    );
  }

  if (!focusedItem) {
    return (
      <section>
        <NextStopHeading
          showShuffle={canInteract && proposals.length < 5}
          busy={busy}
          onShuffle={() => void randomProposal()}
        />
        <Card className="rounded-3xl border-dashed border-border bg-card p-5 text-center shadow-sm">
          <div className="text-4xl" aria-hidden="true">
            🎯
          </div>
          <h2 className="mt-3 font-display text-xl">Vart ska rundan gå härnäst?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {plannedDate
              ? `${formatNextStopDate(plannedDate, null)} är satt. Välj ett ställe när ni är redo.`
              : "Föreslå ett ställe. Det första blir nästa stopp och fler idéer sparas som alternativ."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/matstallen">Föreslå ett ställe</Link>
            </Button>
            {canInteract ? (
              <Button type="button" variant="outline" onClick={openSchedule}>
                <CalendarDays className="h-4 w-4" />
                {plannedDate ? "Ändra dag" : "Lägg till dag"}
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
          onRemove={() => void removeDate()}
        />
      </section>
    );
  }

  const canRemoveFocused = canInteract && canWithdrawNextStopProposal(state, focusedItem.proposal);

  return (
    <section>
      <NextStopHeading
        showShuffle={canInteract && proposals.length < 5}
        busy={busy}
        onShuffle={() => void randomProposal()}
      />

      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div data-next-stop-proposal="selected">
            <PlaceIdentity place={focusedItem.place} prominent />
          </div>
          {canRemoveFocused ? (
            <ProposalMenu
              placeName={focusedItem.place.name}
              busy={busy === `withdraw:${focusedItem.proposal.id}`}
              onWithdraw={() => withdrawProposal(focusedItem)}
            />
          ) : null}
        </div>

        <ProposalContext
          proposal={focusedItem.proposal}
          canInteract={canInteract}
          busy={busy}
          onSupport={() => void toggleSupport(focusedItem.proposal)}
        />

        <DateLine
          plannedDate={plannedDate}
          canInteract={canInteract}
          busy={busy}
          onEditDate={openSchedule}
          onRemoveDate={() => void removeDate()}
        />

        {canWrite ? (
          <Button
            type="button"
            onClick={() => onRegisterVisit(focusedItem.place.id)}
            className="mt-4 h-12 w-full text-base"
            size="lg"
          >
            <Check className="h-4 w-4" /> Registrera besök
          </Button>
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
            <div className="mt-1 divide-y divide-border/60 border-t border-border/60 px-2">
              {otherProposals.map((item) => (
                <ProposalRow
                  key={item.proposal.id}
                  item={item}
                  canInteract={canInteract}
                  busy={busy}
                  onSupport={() => void toggleSupport(item.proposal)}
                  onSwitch={() => setSwitching(item.proposal)}
                  onWithdraw={() => withdrawProposal(item)}
                />
              ))}
              {proposals.length < 5 ? (
                <div className="py-2">
                  <Button asChild variant="ghost" size="sm" className="min-h-10 px-2 text-primary">
                    <Link to="/matstallen">Föreslå ett annat ställe</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : proposals.length < 5 ? (
        <div className="mt-1 flex justify-center">
          <Button asChild variant="ghost" size="sm" className="min-h-10 px-2 text-primary">
            <Link to="/matstallen">Föreslå ett annat ställe</Link>
          </Button>
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
      <SwitchDialog
        proposal={switching}
        currentPlace={focusedItem.place}
        getPlace={getPlace}
        busy={busy}
        onClose={() => setSwitching(null)}
        onConfirm={() => void confirmSwitch()}
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
        <span aria-hidden="true">⚑</span> Nästa stopp
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

function proposerLabel(
  proposal: NextStopPlaceProposal,
  state: ReturnType<typeof useStore>["state"],
): string {
  if (!proposal.proposedBy) return "Föreslaget tidigare";
  const member = state.members.find((item) => item.id === proposal.proposedBy);
  return member ? `${member.name} föreslog` : "Föreslaget tidigare";
}

function ProposalContext({
  proposal,
  canInteract,
  busy,
  onSupport,
}: {
  proposal: NextStopPlaceProposal;
  canInteract: boolean;
  busy: string | null;
  onSupport: () => void;
}) {
  const { state } = useStore();
  const supported = proposal.supports.some((support) => support.memberId === state.currentUserId);
  const count = proposal.supports.length;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[4.75rem] text-xs text-muted-foreground">
      <span>{proposerLabel(proposal, state)}</span>
      {canInteract ? (
        <button
          type="button"
          className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          aria-pressed={supported}
          disabled={busy !== null}
          onClick={onSupport}
        >
          {busy === `support:${proposal.id}` ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className={supported ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
          )}
          Går gärna hit{count > 0 ? ` · ${count}` : ""}
        </button>
      ) : count > 0 ? (
        <span>· {count} går gärna hit</span>
      ) : null}
    </div>
  );
}

function DateLine({
  plannedDate,
  canInteract,
  busy,
  onEditDate,
  onRemoveDate,
}: {
  plannedDate: string | null;
  canInteract: boolean;
  busy: string | null;
  onEditDate: () => void;
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
        <span className="min-w-0 truncate">{formatNextStopDate(plannedDate, null)}</span>
      </div>
      {canInteract ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              aria-label="Ändra dag"
              disabled={busy !== null}
            >
              {busy === "schedule" || busy === "remove-date" ? (
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
            prominent ? "text-2xl" : "text-base sm:text-lg",
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

function ProposalRow({
  item,
  canInteract,
  busy,
  onSupport,
  onSwitch,
  onWithdraw,
}: {
  item: ProposalItem;
  canInteract: boolean;
  busy: string | null;
  onSupport: () => void;
  onSwitch: () => void;
  onWithdraw: () => void;
}) {
  const { state } = useStore();
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);

  return (
    <div data-next-stop-proposal="alternative" className="py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <PlaceIdentity place={item.place} />
          <ProposalContext
            proposal={item.proposal}
            canInteract={canInteract}
            busy={busy}
            onSupport={onSupport}
          />
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
        <div className="mt-2 pl-[3.75rem]">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 border-primary/40 text-primary"
            onClick={onSwitch}
            disabled={busy !== null}
          >
            Byt nästa stopp
          </Button>
        </div>
      ) : null}
    </div>
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
        <DropdownMenuItem onSelect={onWithdraw}>Ta bort förslag</DropdownMenuItem>
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
            Lägg till dagen om ni redan vet när nästa stopp blir. Exakt tid och övrig logistik kan ni ta som vanligt i gruppen.
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

function SwitchDialog({
  proposal,
  currentPlace,
  getPlace,
  busy,
  onClose,
  onConfirm,
}: {
  proposal: NextStopPlaceProposal | null;
  currentPlace: Place;
  getPlace: (placeId: string) => Place | undefined;
  busy: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const target = proposal ? getPlace(proposal.placeId) : undefined;
  return (
    <Dialog open={Boolean(proposal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Byt nästa stopp?</DialogTitle>
          <DialogDescription>
            {target
              ? `Ska ${target.name} bli gruppens nästa stopp i stället för ${currentPlace.name}?`
              : "Byt gruppens nästa stopp till det här förslaget?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Avbryt
          </Button>
          <Button type="button" disabled={busy !== null} onClick={onConfirm}>
            {proposal && busy === `select:${proposal.id}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Ja, byt nästa stopp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
