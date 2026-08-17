import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Flag,
  Loader2,
  MapPin,
  MoreHorizontal,
  Shuffle,
  X,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  defaultNextStopDateValue,
  formatNextStopDate,
  isPastDateValue,
  localDateValue,
} from "@/lib/matrundan/next-stop-date";
import {
  canWithdrawNextStopProposal,
  type NextStopDayResponseValue,
} from "@/lib/matrundan/next-stop-v2";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type NextStopPlaceProposal, type Place } from "@/lib/matrundan/types";
import { useNextStopV2 } from "@/lib/matrundan/use-next-stop-v2";

type ProposalItem = {
  proposal: NextStopPlaceProposal;
  place: Place;
};

type DayResponse = {
  memberId: string;
  response: NextStopDayResponseValue;
  updatedAt: string;
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
  const { nextStop, dayResponses, backendReady, propose, select, withdraw, setSchedule, setDayResponse } =
    useNextStopV2();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [planningOpen, setPlanningOpen] = React.useState(false);
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
  const plannedDate = focusedItem ? (nextStop?.plannedDate ?? null) : null;
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

  function editScheduleFromSheet() {
    setPlanningOpen(false);
    openSchedule();
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
        setPlanningOpen(false);
      },
      "Dagen är borttagen.",
    );
  }

  async function respondToDay(response: NextStopDayResponseValue) {
    const own = dayResponses.find((item) => item.memberId === state.currentUserId)?.response;
    await run(
      `day-response:${response}`,
      () => setDayResponse(own === response ? null : response),
      own === response ? "Ditt svar är borttaget." : response === "can" ? "Du kan den dagen." : "Du kan inte den dagen.",
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

  if (passed && plannedDate && focusedItem) {
    return (
      <section>
        <NextStopHeading showShuffle={false} />
        <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-sm">
          <FocusedPlaceHero item={focusedItem} />
          <div className="border-t border-border/60 p-4">
            <h2 className="font-display text-xl font-semibold">Blev det av?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatNextStopDate(plannedDate, null)} var dagen ni hade tänkt gå hit.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                className="min-h-12"
                onClick={() => onRegisterVisit(focusedItem.place.id)}
                disabled={!canWrite}
              >
                <Check className="h-4 w-4" /> Registrera besöket
              </Button>
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
        <Card className="rounded-3xl border-dashed border-border bg-card p-6 text-center shadow-sm">
          <div className="text-5xl" aria-hidden="true">
            🎯
          </div>
          <h2 className="mt-3 font-display text-xl">Vart går rundan härnäst?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Föreslå ett ställe. Det första blir nästa stopp och fler idéer sparas som alternativ.
          </p>
          <div className="mt-4 flex justify-center">
            <Button asChild>
              <Link to="/matstallen">Föreslå ett ställe</Link>
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  const canRemoveFocused = canInteract && canWithdrawNextStopProposal(state, focusedItem.proposal);
  const showFocusedActions = canInteract && (Boolean(plannedDate) || canRemoveFocused);

  return (
    <section>
      <NextStopHeading
        showShuffle={canInteract && proposals.length < 5}
        busy={busy}
        onShuffle={() => void randomProposal()}
      />

      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-sm">
        <div className="relative">
          <FocusedPlaceHero item={focusedItem} />
          {showFocusedActions ? (
            <div className="absolute right-3 top-3">
              <FocusedActionsMenu
                plannedDate={plannedDate}
                canRemove={canRemoveFocused}
                busy={busy}
                onEditDate={openSchedule}
                onRemoveDate={() => void removeDate()}
                onWithdraw={() => withdrawProposal(focusedItem)}
              />
            </div>
          ) : null}
        </div>

        <DayRow
          plannedDate={plannedDate}
          dayResponses={dayResponses}
          currentUserId={state.currentUserId}
          canInteract={canInteract}
          onOpenPlanning={() => setPlanningOpen(true)}
          onAddDate={openSchedule}
        />

        {canWrite ? (
          <div className="border-t border-border/60 p-4">
            <Button
              type="button"
              onClick={() => onRegisterVisit(focusedItem.place.id)}
              className="h-12 w-full text-base"
              size="lg"
            >
              <Check className="h-4 w-4" /> Registrera besök
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
            <div className="mt-1 divide-y divide-border/60 border-t border-border/60 px-2">
              {otherProposals.map((item) => (
                <ProposalRow
                  key={item.proposal.id}
                  item={item}
                  canInteract={canInteract}
                  busy={busy}
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

      <DayPlanningSheet
        open={planningOpen && Boolean(plannedDate)}
        onOpenChange={setPlanningOpen}
        plannedDate={plannedDate}
        responses={dayResponses}
        currentUserId={state.currentUserId}
        members={state.members}
        canInteract={canInteract}
        busy={busy}
        onRespond={(response) => void respondToDay(response)}
        onEditDate={editScheduleFromSheet}
        onRemoveDate={() => void removeDate()}
      />
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
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Nästa stopp
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
  return member
    ? `${member.avatar ? `${member.avatar} ` : ""}${member.name} föreslog`
    : "Föreslaget tidigare";
}

function FocusedPlaceHero({ item }: { item: ProposalItem }) {
  const { state } = useStore();
  return (
    <Link
      to="/matstallen/$placeId"
      params={{ placeId: item.place.id }}
      data-next-stop-proposal="selected"
      className="block bg-gradient-to-br from-primary/85 to-primary p-6 pr-14 text-primary-foreground transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`Öppna ${item.place.name}`}
    >
      <div className="text-6xl" aria-hidden="true">
        {item.place.photo ?? "🍽️"}
      </div>
      <div className="mt-3 min-w-0">
        <div className="text-xs tracking-wide opacity-80">{CATEGORY_LABEL[item.place.category]}</div>
        <h2 className="font-display text-3xl font-semibold leading-tight [overflow-wrap:anywhere]">
          {item.place.name}
        </h2>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-sm opacity-90">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {item.place.address}, {item.place.city}
          </span>
        </div>
        <div className="mt-2 text-xs opacity-85">{proposerLabel(item.proposal, state)}</div>
      </div>
    </Link>
  );
}

function responseCounts(responses: DayResponse[]) {
  return responses.reduce(
    (counts, response) => {
      counts[response.response] += 1;
      return counts;
    },
    { can: 0, cannot: 0 },
  );
}

function dayResponseSummary(responses: DayResponse[]): string {
  const counts = responseCounts(responses);
  if (counts.can === 0 && counts.cannot === 0) return "Ingen har svarat än";
  return [counts.can > 0 ? `${counts.can} kan` : null, counts.cannot > 0 ? `${counts.cannot} kan inte` : null]
    .filter(Boolean)
    .join(" · ");
}

function ownDayResponseSummary(
  responses: DayResponse[],
  currentUserId: string,
): { text: string; answered: boolean } {
  const response = responses.find((item) => item.memberId === currentUserId)?.response;
  if (response === "can") return { text: "Du kan", answered: true };
  if (response === "cannot") return { text: "Du kan inte", answered: true };
  return { text: "Du har inte svarat än", answered: false };
}

function DayRow({
  plannedDate,
  dayResponses,
  currentUserId,
  canInteract,
  onOpenPlanning,
  onAddDate,
}: {
  plannedDate: string | null;
  dayResponses: DayResponse[];
  currentUserId: string;
  canInteract: boolean;
  onOpenPlanning: () => void;
  onAddDate: () => void;
}) {
  if (!plannedDate) {
    if (!canInteract) return null;
    return (
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 border-t border-border/60 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
        onClick={onAddDate}
      >
        <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">Ingen dag planerad</span>
        <span className="text-sm font-medium text-primary">Lägg till dag</span>
      </button>
    );
  }

  const own = ownDayResponseSummary(dayResponses, currentUserId);
  return (
    <button
      type="button"
      className="flex min-h-20 w-full items-center gap-3 border-t border-border/60 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
      onClick={onOpenPlanning}
      aria-label={`Öppna dagsvaren för ${formatNextStopDate(plannedDate, null)}. ${own.text}`}
    >
      <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{formatNextStopDate(plannedDate, null)}</span>
        <span
          className={`mt-0.5 block text-xs ${own.answered ? "text-muted-foreground" : "font-medium text-primary"}`}
        >
          {own.text}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {dayResponseSummary(dayResponses)}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ProposalRow({
  item,
  canInteract,
  busy,
  onSwitch,
  onWithdraw,
}: {
  item: ProposalItem;
  canInteract: boolean;
  busy: string | null;
  onSwitch: () => void;
  onWithdraw: () => void;
}) {
  const { state } = useStore();
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);

  return (
    <div data-next-stop-proposal="alternative" className="py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <PlaceIdentity place={item.place} />
        {canRemove ? (
          <ProposalMenu
            placeName={item.place.name}
            busy={busy === `withdraw:${item.proposal.id}`}
            onWithdraw={onWithdraw}
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex min-h-9 items-center justify-between gap-2 pl-[3.75rem]">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {proposerLabel(item.proposal, state)}
        </span>
        {canInteract ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 min-h-9 shrink-0 rounded-full border-primary/40 px-3 text-xs text-primary"
            onClick={onSwitch}
            disabled={busy !== null}
          >
            Välj ställe
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PlaceIdentity({ place }: { place: Place }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Link
        to="/matstallen/$placeId"
        params={{ placeId: place.id }}
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Öppna ${place.name}`}
      >
        {place.photo ?? "🍽️"}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/matstallen/$placeId"
          params={{ placeId: place.id }}
          className="block font-display text-base font-semibold leading-tight hover:underline sm:text-lg"
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

function DayPlanningSheet({
  open,
  onOpenChange,
  plannedDate,
  responses,
  currentUserId,
  members,
  canInteract,
  busy,
  onRespond,
  onEditDate,
  onRemoveDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plannedDate: string | null;
  responses: DayResponse[];
  currentUserId: string;
  members: ReturnType<typeof useStore>["state"]["members"];
  canInteract: boolean;
  busy: string | null;
  onRespond: (response: NextStopDayResponseValue) => void;
  onEditDate: () => void;
  onRemoveDate: () => void;
}) {
  if (!plannedDate) return null;
  const ownResponse = responses.find((item) => item.memberId === currentUserId)?.response;
  const canMembers = responses
    .filter((item) => item.response === "can")
    .map((item) => members.find((member) => member.id === item.memberId))
    .filter((member): member is NonNullable<typeof member> => Boolean(member));
  const cannotMembers = responses
    .filter((item) => item.response === "cannot")
    .map((item) => members.find((member) => member.id === item.memberId))
    .filter((member): member is NonNullable<typeof member> => Boolean(member));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-display text-2xl">{formatNextStopDate(plannedDate, null)}</SheetTitle>
          <SheetDescription>Svara om dagen fungerar för dig och se gruppens svar.</SheetDescription>
        </SheetHeader>

        {canInteract ? (
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-medium">Kan du den dagen?</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={ownResponse === "can" ? "secondary" : "outline"}
                className="min-h-16 flex-col gap-1"
                aria-pressed={ownResponse === "can"}
                disabled={busy !== null}
                onClick={() => onRespond("can")}
              >
                {busy === "day-response:can" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Jag kan
              </Button>
              <Button
                type="button"
                variant="outline"
                className={[
                  "min-h-16 flex-col gap-1",
                  ownResponse === "cannot" ? "border-destructive/60 bg-destructive/10" : "",
                ].join(" ")}
                aria-pressed={ownResponse === "cannot"}
                disabled={busy !== null}
                onClick={() => onRespond("cannot")}
              >
                {busy === "day-response:cannot" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Jag kan inte
              </Button>
            </div>
          </section>
        ) : null}

        <section className="mt-5">
          <h3 className="text-sm font-medium">Gruppens svar</h3>
          {canMembers.length > 0 || cannotMembers.length > 0 ? (
            <div className="mt-2 space-y-2 rounded-2xl bg-muted/35 p-3">
              {canMembers.length > 0 ? (
                <div className="text-sm leading-relaxed">
                  <span className="font-medium">Kan:</span>{" "}
                  <span className="text-muted-foreground">
                    {canMembers.map((member) => `${member.avatar ?? ""} ${member.name}`.trim()).join(", ")}
                  </span>
                </div>
              ) : null}
              {cannotMembers.length > 0 ? (
                <div className="text-sm leading-relaxed">
                  <span className="font-medium">Kan inte:</span>{" "}
                  <span className="text-muted-foreground">
                    {cannotMembers
                      .map((member) => `${member.avatar ?? ""} ${member.name}`.trim())
                      .join(", ")}
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Ingen har svarat än.</p>
          )}
        </section>

        {canInteract ? (
          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy !== null}
              onClick={onRemoveDate}
            >
              Ta bort dag
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={onEditDate}>
              <CalendarDays className="h-4 w-4" /> Ändra dag
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FocusedActionsMenu({
  plannedDate,
  canRemove,
  busy,
  onEditDate,
  onRemoveDate,
  onWithdraw,
}: {
  plannedDate: string | null;
  canRemove: boolean;
  busy: string | null;
  onEditDate: () => void;
  onRemoveDate: () => void;
  onWithdraw: () => void;
}) {
  const isBusy =
    busy === "schedule" || busy === "remove-date" || Boolean(busy?.startsWith("withdraw:"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full bg-black/10 text-primary-foreground hover:bg-black/20 hover:text-primary-foreground"
          aria-label="Fler val för nästa stopp"
          disabled={busy !== null}
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {plannedDate ? (
          <>
            <DropdownMenuItem onSelect={onEditDate}>
              <CalendarDays className="h-4 w-4" /> Ändra dag
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRemoveDate}>Ta bort dag</DropdownMenuItem>
          </>
        ) : null}
        {canRemove ? <DropdownMenuItem onSelect={onWithdraw}>Ta bort förslag</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
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
          <DialogDescription>Välj den dag gruppen tänker göra nästa stopp.</DialogDescription>
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
          <DialogTitle>Välj det här stället?</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.name} blir gruppens nästa stopp i stället för ${currentPlace.name}. Dagen och gruppens dagsvar ligger kvar.`
              : "Det här förslaget blir gruppens nästa stopp."}
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
            Välj ställe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
