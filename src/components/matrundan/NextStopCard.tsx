import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  CornerDownRight,
  ChevronRight,
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
  nextStopProposalRevealStorageKey,
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
  const {
    nextStop,
    dayResponses,
    backendReady,
    propose,
    select,
    withdraw,
    setSchedule,
    setDayResponse,
  } = useNextStopV2();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [planningOpen, setPlanningOpen] = React.useState(false);
  const [date, setDate] = React.useState(defaultNextStopDateValue);
  const [switching, setSwitching] = React.useState<NextStopPlaceProposal | null>(null);
  const [activeCarouselIndex, setActiveCarouselIndex] = React.useState(0);
  const carouselViewportRef = React.useRef<HTMLDivElement | null>(null);
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
  const focusedProposalId = focusedItem?.proposal.id ?? null;
  const otherProposals = React.useMemo(
    () =>
      focusedProposalId
        ? proposals
            .filter((item) => item.proposal.id !== focusedProposalId)
            .sort(
              (left, right) =>
                new Date(left.proposal.createdAt).getTime() -
                new Date(right.proposal.createdAt).getTime(),
            )
        : [],
    [focusedProposalId, proposals],
  );
  const carouselItems = React.useMemo(
    () => (focusedItem ? [focusedItem, ...otherProposals] : []),
    [focusedItem, otherProposals],
  );
  const plannedDate = focusedItem ? (nextStop?.plannedDate ?? null) : null;
  const passed = plannedDate ? isPastDateValue(plannedDate) : false;
  const canInteract = canWrite && backendReady;
  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  React.useEffect(() => {
    setActiveCarouselIndex(0);
    const resetFrame = window.requestAnimationFrame(() => {
      const viewport = carouselViewportRef.current;
      if (viewport) viewport.scrollLeft = 0;
    });
    return () => window.cancelAnimationFrame(resetFrame);
  }, [focusedPlace?.id]);

  React.useEffect(() => {
    const maxIndex = Math.max(0, carouselItems.length - 1);
    setActiveCarouselIndex((current) => {
      const nextIndex = Math.min(current, maxIndex);
      if (nextIndex !== current) {
        const viewport = carouselViewportRef.current;
        if (viewport) viewport.scrollLeft = viewport.clientWidth * nextIndex;
      }
      return nextIndex;
    });
  }, [carouselItems.length]);

  React.useEffect(() => {
    if (typeof window === "undefined" || carouselItems.length < 2) return;
    const storageKey = nextStopProposalRevealStorageKey();
    const revealPlaceId = window.sessionStorage.getItem(storageKey);
    if (!revealPlaceId) return;
    const revealIndex = carouselItems.findIndex((item) => item.place.id === revealPlaceId);
    if (revealIndex < 0) return;

    setActiveCarouselIndex(revealIndex);
    const revealFrame = window.requestAnimationFrame(() => {
      const viewport = carouselViewportRef.current;
      if (viewport) viewport.scrollLeft = viewport.clientWidth * revealIndex;
    });
    const consumeTimer = window.setTimeout(() => {
      if (window.sessionStorage.getItem(storageKey) === revealPlaceId) {
        window.sessionStorage.removeItem(storageKey);
      }
    }, 300);

    return () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(consumeTimer);
    };
  }, [carouselItems]);

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
      plannedDate ? "Den nya dagen är föreslagen." : "Dagen är föreslagen.",
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
      own === response
        ? "Ditt svar är borttaget."
        : response === "can"
          ? "Du kan den dagen."
          : "Du kan inte den dagen.",
    );
  }

  async function randomProposal() {
    if (proposals.length >= 5) {
      toast.info("Fem ställen är redan i kön.");
      return;
    }

    const alreadyProposed = new Set(proposals.map((item) => item.place.id));
    const preferredPool = untried.filter((place) => !alreadyProposed.has(place.id));
    const fallbackPool = activePlaces.filter((place) => !alreadyProposed.has(place.id));
    const pool = preferredPool.length > 0 ? preferredPool : fallbackPool;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) {
      toast.info("Alla aktiva ställen finns redan i kön.");
      return;
    }

    await run(
      "shuffle",
      async () => {
        const storageKey = nextStopProposalRevealStorageKey();
        if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, pick.id);
        try {
          await propose(pick.id);
        } catch (error) {
          if (typeof window !== "undefined") window.sessionStorage.removeItem(storageKey);
          throw error;
        }
      },
      focusedPlace ? `${pick.name} lades sist på tur.` : `${pick.name} är gruppens nästa stopp.`,
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

  function changeCarouselIndex(index: number) {
    const nextIndex = Math.min(Math.max(index, 0), Math.max(0, carouselItems.length - 1));
    const viewport = carouselViewportRef.current;
    if (!viewport) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      left: viewport.clientWidth * nextIndex,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function handleCarouselScroll(event: React.UIEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    if (viewport.clientWidth === 0) return;
    const nextIndex = Math.min(
      Math.max(Math.round(viewport.scrollLeft / viewport.clientWidth), 0),
      Math.max(0, carouselItems.length - 1),
    );
    setActiveCarouselIndex((current) => (current === nextIndex ? current : nextIndex));
  }

  if (passed && plannedDate && focusedItem) {
    return (
      <section>
        <NextStopHeading showShuffle={false} queuedCount={otherProposals.length} />
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
            Föreslå ett ställe. Det första blir nästa stopp och fler idéer läggs på tur.
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
        queuedCount={otherProposals.length}
        busy={busy}
        onShuffle={() => void randomProposal()}
      />

      <div
        className="relative"
        role="region"
        aria-roledescription="karusell"
        aria-label="Nästa stopp och ställen på tur"
      >
        <div
          ref={carouselViewportRef}
          data-testid="next-stop-carousel-viewport"
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={handleCarouselScroll}
        >
          {carouselItems.map((item, index) => {
            const selected = item.proposal.id === focusedItem.proposal.id;
            const active = index === activeCarouselIndex;
            return (
              <div
                key={item.proposal.id}
                className="w-full shrink-0 snap-center"
                aria-hidden={!active}
                inert={!active}
              >
                {selected ? (
                  <Card className="h-full min-h-[18rem] overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-sm">
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
                ) : (
                  <AlternativeProposalCard
                    item={item}
                    previousPlaceName={carouselItems[index - 1]?.place.name ?? focusedItem.place.name}
                    canInteract={canInteract}
                    busy={busy}
                    onSwitch={() => setSwitching(item.proposal)}
                    onWithdraw={() => withdrawProposal(item)}
                  />
                )}
              </div>
            );
          })}
        </div>

        {activeCarouselIndex > 0 ? (
          <CarouselArrow
            direction="previous"
            placeName={carouselItems[activeCarouselIndex - 1]?.place.name}
            onClick={() => changeCarouselIndex(activeCarouselIndex - 1)}
          />
        ) : null}
        {activeCarouselIndex < carouselItems.length - 1 ? (
          <CarouselArrow
            direction="next"
            placeName={carouselItems[activeCarouselIndex + 1]?.place.name}
            onClick={() => changeCarouselIndex(activeCarouselIndex + 1)}
          />
        ) : null}

        {carouselItems.length > 1 ? (
          <NextStopCarouselControls
            items={carouselItems}
            activeIndex={activeCarouselIndex}
            onSelect={changeCarouselIndex}
          />
        ) : null}
      </div>

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
        plannedDate={plannedDate}
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
  queuedCount = 0,
  onShuffle,
  busy = null,
}: {
  showShuffle: boolean;
  queuedCount?: number;
  onShuffle?: () => void;
  busy?: string | null;
}) {
  return (
    <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
          <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Nästa stopp
        </div>
        {queuedCount > 0 ? (
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {queuedCount} på tur
          </span>
        ) : null}
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
    <div
      data-next-stop-proposal="selected"
      className="bg-gradient-to-br from-primary/85 to-primary px-5 py-4 text-primary-foreground"
    >
      <div className="pr-9">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full bg-primary-foreground/15 px-2 py-1 font-medium">
            Nästa stopp
          </span>
          <span className="opacity-80">{CATEGORY_LABEL[item.place.category]}</span>
        </div>
        <Link
          to="/matstallen/$placeId"
          params={{ placeId: item.place.id }}
          className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3 rounded-xl transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/40"
          aria-label={`Öppna ${item.place.name}`}
        >
          <div className="pt-0.5 text-[2.75rem] leading-none" aria-hidden="true">
            {item.place.photo ?? "🍽️"}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1">
              <h2 className="min-w-0 font-display text-2xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
                {item.place.name}
              </h2>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1 text-sm opacity-90">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {item.place.address}, {item.place.city}
              </span>
            </div>
          </div>
        </Link>
        <div className="mt-2 pl-[3.5rem] text-xs opacity-85">
          {proposerLabel(item.proposal, state)}
        </div>
      </div>
    </div>
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
  return [
    counts.can > 0 ? `${counts.can} kan` : null,
    counts.cannot > 0 ? `${counts.cannot} kan inte` : null,
  ]
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
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">Ingen dag föreslagen</span>
        <span className="text-sm font-medium text-primary">Föreslå dag</span>
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
        <span className="block truncate text-sm font-medium">
          {formatNextStopDate(plannedDate, null)}
        </span>
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

function AlternativeProposalCard({
  item,
  previousPlaceName,
  canInteract,
  busy,
  onSwitch,
  onWithdraw,
}: {
  item: ProposalItem;
  previousPlaceName: string;
  canInteract: boolean;
  busy: string | null;
  onSwitch: () => void;
  onWithdraw: () => void;
}) {
  const { state } = useStore();
  const canRemove = canInteract && canWithdrawNextStopProposal(state, item.proposal);

  return (
    <Card
      data-next-stop-proposal="alternative"
      className="flex h-full min-h-[18rem] flex-col overflow-hidden rounded-3xl border-primary/15 bg-card p-0 shadow-sm"
    >
      <div className="relative bg-gradient-to-br from-primary/20 via-secondary/55 to-card px-5 py-4">
        <div className="pr-9">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-primary/12 px-2 py-1 font-medium text-primary">
              På tur
            </span>
            <span className="text-muted-foreground">{CATEGORY_LABEL[item.place.category]}</span>
          </div>
          <Link
            to="/matstallen/$placeId"
            params={{ placeId: item.place.id }}
            className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3 rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Öppna ${item.place.name}`}
          >
            <div className="pt-0.5 text-[2.75rem] leading-none" aria-hidden="true">
              {item.place.photo ?? "🍽️"}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1">
                <h2 className="min-w-0 font-display text-2xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
                  {item.place.name}
                </h2>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {item.place.address}, {item.place.city}
                </span>
              </div>
            </div>
          </Link>
          <div className="mt-2 pl-[3.5rem] text-xs text-muted-foreground">
            {proposerLabel(item.proposal, state)}
          </div>
        </div>
        {canRemove ? (
          <div className="absolute right-3 top-3">
            <ProposalMenu
              placeName={item.place.name}
              busy={busy === `withdraw:${item.proposal.id}`}
              onWithdraw={onWithdraw}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-20 flex-1 items-center gap-3 border-t border-primary/10 bg-primary/[0.045] px-5 py-3.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <CornerDownRight className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">På tur efter {previousPlaceName}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            Kön flyttas fram när nästa stopp är avklarat.
          </span>
        </span>
      </div>

      {canInteract ? (
        <div className="border-t border-border/60 p-4">
          <Button
            type="button"
            className="h-12 w-full text-base"
            size="lg"
            onClick={onSwitch}
            disabled={busy !== null}
          >
            Gör till nästa stopp
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function CarouselArrow({
  direction,
  placeName,
  onClick,
}: {
  direction: "previous" | "next";
  placeName?: string;
  onClick: () => void;
}) {
  const previous = direction === "previous";
  return (
    <button
      type="button"
      className={[
        "absolute top-[7.25rem] z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border/60 bg-background/65 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        previous ? "left-2" : "right-2",
      ].join(" ")}
      aria-label={
        previous
          ? `Föregående ställe i kön${placeName ? `: ${placeName}` : ""}`
          : `Nästa ställe i kön${placeName ? `: ${placeName}` : ""}`
      }
      onClick={onClick}
    >
      {previous ? (
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

function NextStopCarouselControls({
  items,
  activeIndex,
  onSelect,
}: {
  items: ProposalItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="mt-2 flex min-h-9 items-center justify-center gap-2.5">
      <div className="flex items-center" aria-label="Välj ställe i kön">
        {items.map((item, index) => {
          const active = index === activeIndex;
          const label =
            index === 0
              ? `Visa nästa stopp: ${item.place.name}`
              : `Visa ställe på tur: ${item.place.name}`;
          return (
            <button
              key={item.proposal.id}
              type="button"
              className="grid h-8 w-7 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={label}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(index)}
            >
              <span
                className={[
                  "block h-1.5 rounded-full transition-all",
                  active ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/35",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <span
        data-testid="next-stop-carousel-position"
        className="text-[11px] tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {activeIndex + 1} av {items.length}
      </span>
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
          <SheetTitle className="font-display text-2xl">
            {formatNextStopDate(plannedDate, null)}
          </SheetTitle>
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
                    {canMembers
                      .map((member) => `${member.avatar ?? ""} ${member.name}`.trim())
                      .join(", ")}
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
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy !== null}
              onClick={onEditDate}
            >
              <CalendarDays className="h-4 w-4" /> Föreslå annan dag
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
              <CalendarDays className="h-4 w-4" /> Föreslå annan dag
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onRemoveDate}>Ta bort dag</DropdownMenuItem>
          </>
        ) : null}
        {canRemove ? (
          <DropdownMenuItem onSelect={onWithdraw}>Ta bort förslag</DropdownMenuItem>
        ) : null}
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
          className="h-9 w-9 shrink-0 rounded-full bg-background/55 text-muted-foreground hover:bg-background/80"
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
          <DialogTitle>{plannedDate ? "Föreslå annan dag" : "Föreslå dag"}</DialogTitle>
          <DialogDescription>
            {plannedDate
              ? "Välj en annan dag för gruppens nästa stopp. Gruppens dagsvar börjar då om."
              : "Välj den dag gruppen tänker göra nästa stopp."}
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
  plannedDate,
  getPlace,
  busy,
  onClose,
  onConfirm,
}: {
  proposal: NextStopPlaceProposal | null;
  currentPlace: Place;
  plannedDate: string | null;
  getPlace: (placeId: string) => Place | undefined;
  busy: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const target = proposal ? getPlace(proposal.placeId) : undefined;
  const day = plannedDate ? formatNextStopDate(plannedDate, null) : null;
  return (
    <Dialog open={Boolean(proposal)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {target ? `Göra ${target.name} till nästa stopp?` : "Göra det här till nästa stopp?"}
          </DialogTitle>
          <DialogDescription>
            {target
              ? `${target.name} flyttas fram. ${currentPlace.name} ligger kvar på tur.${day ? ` ${day} och gruppens svar följer med.` : ""}`
              : "Stället flyttas fram som nästa stopp."}
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
            Gör till nästa stopp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
