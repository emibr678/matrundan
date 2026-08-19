import * as React from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ArrowLeft, CalendarDays, MessageCircle, Users2 } from "lucide-react";
import { z } from "zod";

import { RatingStars } from "@/components/matrundan/Rating";
import { VisitDetailSheet } from "@/components/matrundan/VisitDetailSheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAttentionPendingVisitReviews } from "@/lib/matrundan/pending-visit-reviews";
import { useSession } from "@/lib/matrundan/session";
import { formatDate, useStore } from "@/lib/matrundan/store";
import { formatRating } from "@/lib/matrundan/version";

const MEAL_LABEL: Record<string, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

const VISIT_SEARCH_DEFAULTS = { visit: "" };
const visitSearchSchema = z.object({
  visit: fallback(z.string(), "").default(""),
  group: z.string().optional(),
  review: z.string().optional(),
});

export const Route = createFileRoute("/besok")({
  validateSearch: zodValidator(visitSearchSchema),
  search: { middlewares: [stripSearchParams(VISIT_SEARCH_DEFAULTS)] },
  head: () => ({
    meta: [
      { title: "Alla besök · Matrundan" },
      {
        name: "description",
        content: "Bläddra i gruppens gemensamma besökshistorik.",
      },
    ],
  }),
  component: VisitHistory,
});

function VisitHistory() {
  const { state, getPlace, memberById } = useStore();
  const { exampleMode, mode, activeGroupId, userGroups, selectGroup } = useSession();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/besok" });
  const groupArchived = state.group.lifecycleStatus === "archived";
  const requestedGroupAllowed =
    !search.group || userGroups.some((group) => group.id === search.group);
  const requestedGroupReady = mode !== "live" || !search.group || search.group === activeGroupId;
  const visits = React.useMemo(
    () => [...state.visits].sort((left, right) => right.date.localeCompare(left.date)),
    [state.visits],
  );
  const pendingVisitIds = React.useMemo(
    () =>
      new Set(
        (groupArchived
          ? []
          : getAttentionPendingVisitReviews(state.visits, state.currentUserId, new Date())
        ).map((visit) => visit.id),
      ),
    [groupArchived, state.currentUserId, state.visits],
  );

  React.useEffect(() => {
    if (
      mode !== "live" ||
      !search.group ||
      search.group === activeGroupId ||
      !requestedGroupAllowed
    ) {
      return;
    }
    selectGroup(search.group);
  }, [activeGroupId, mode, requestedGroupAllowed, search.group, selectGroup]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4 pt-2 md:max-w-3xl">
      <header>
        <Button asChild variant="ghost" className="-ml-2 min-h-11 rounded-full px-3">
          <Link to={exampleMode ? "/exempel" : "/"}>
            <ArrowLeft className="h-4 w-4" /> Hem
          </Link>
        </Button>
        <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">Alla besök</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gruppens gemensamma måltider och minnen, med det senaste först.
        </p>
      </header>

      {visits.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-6 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Gruppen har inga registrerade besök än.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => {
            const place = getPlace(visit.placeId);
            if (!place) return null;
            const ownReviewPending = pendingVisitIds.has(visit.id);
            const participants =
              visit.participants && visit.participants.length > 0
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
                  });

            return (
              <button
                key={visit.id}
                type="button"
                onClick={() => navigate({ search: { visit: visit.id } })}
                className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Öppna besöket på ${place.name} ${formatDate(visit.date)}`}
              >
                <Card className="overflow-hidden rounded-2xl border-border/70 p-0 transition-colors hover:bg-accent/35">
                  <div className="flex min-w-0 gap-3 p-3 sm:p-4">
                    {visit.photo?.url ? (
                      <img
                        src={visit.photo.url}
                        alt=""
                        className="h-20 w-24 shrink-0 rounded-xl border border-border/70 object-cover"
                      />
                    ) : (
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary text-3xl">
                        {place.photo ?? "🍽️"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="truncate font-display text-lg font-semibold">
                            {place.name}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(visit.date)} · {MEAL_LABEL[visit.meal] ?? visit.meal}
                          </p>
                          {ownReviewPending ? (
                            <span className="mt-1 inline-flex max-w-full rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Ditt omdöme saknas
                            </span>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          {visit.overall > 0 ? (
                            <>
                              <RatingStars value={visit.overall} size={12} />
                              <span className="text-[11px] font-medium">
                                {formatRating(visit.overall)} av 5
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              Inget omdöme ännu
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {participants.map((participant) => (
                          <span
                            key={participant.id}
                            className="max-w-full truncate rounded-full bg-secondary px-2 py-0.5 text-[11px]"
                          >
                            {participant.avatar ?? "🙂"} {participant.name}
                            {participant.status === "guest" ? " · Gäst" : ""}
                          </span>
                        ))}
                        {(visit.externalParticipantCount ?? 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            <Users2 className="mr-1 h-3 w-3" />+{visit.externalParticipantCount}{" "}
                            utanför gruppen
                          </span>
                        ) : null}
                      </div>

                      {visit.comment ? (
                        <p className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-muted-foreground">
                          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2 [overflow-wrap:anywhere]">
                            {visit.comment}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <VisitDetailSheet
        visitId={search.visit || null}
        focusReviewId={search.review ?? null}
        open={Boolean(search.visit) && requestedGroupAllowed && requestedGroupReady}
        onOpenChange={(open) =>
          !open && navigate({ search: { visit: "", group: undefined, review: undefined } })
        }
      />
    </div>
  );
}
