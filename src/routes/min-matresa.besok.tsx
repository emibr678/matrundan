import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  stripSearchParams,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { CalendarDays, MessageSquarePlus, RotateCcw, UserRoundCheck } from "lucide-react";
import { z } from "zod";
import { PersonalJourneyVisitCard } from "@/components/matrundan/PersonalJourneyCards";
import { RatingStars } from "@/components/matrundan/Rating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { appPageTitle } from "@/lib/app-environment";
import {
  loadPersonalJourneyVisit,
  loadPersonalJourneyVisits,
} from "@/lib/matrundan/personal-journey";
import {
  demoPersonalJourneyVisit,
  demoPersonalJourneyVisits,
} from "@/lib/matrundan/personal-journey-demo";
import { getPersonalJourneyNavigationState } from "@/lib/matrundan/personal-journey-routes";
import { useSession } from "@/lib/matrundan/session";
import { formatOwnVisitDate } from "@/lib/matrundan/sharing-selection";
import { visitMealLabel } from "@/lib/matrundan/visit-context";
import { formatRating } from "@/lib/matrundan/version";

const defaults = { participated: false };
const searchSchema = z.object({
  participated: fallback(z.boolean(), false).default(false),
  visit: z.string().uuid().optional(),
});

export const Route = createFileRoute("/min-matresa/besok")({
  validateSearch: zodValidator(searchSchema),
  search: { middlewares: [stripSearchParams(defaults)] },
  head: () => ({
    meta: [
      { title: appPageTitle("Mina besök") },
      {
        name: "description",
        content: "Besök som är synliga för dig genom dina grupper, utan dubbletter.",
      },
    ],
  }),
  component: PersonalJourneyVisits,
});

function PersonalJourneyVisits() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/min-matresa/besok" });
  const location = useRouterState({ select: (state) => state.location });
  const navigationState = getPersonalJourneyNavigationState(location.state);
  const { mode, activeGroupId, selectGroup } = useSession();
  const visits = useInfiniteQuery({
    queryKey: ["personal-journey", "visits", mode, search.participated],
    retry: false,
    initialPageParam: null as { visitedOn: string; id: string } | null,
    queryFn: ({ pageParam }) =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyVisits(search.participated))
        : loadPersonalJourneyVisits({ participatedOnly: search.participated, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = visits.data?.pages.flatMap((page) => page.items) ?? [];
  const detail = useQuery({
    queryKey: ["personal-journey", "visit", mode, search.visit],
    retry: false,
    queryFn: () =>
      mode === "demo"
        ? Promise.resolve(demoPersonalJourneyVisit(search.visit!))
        : loadPersonalJourneyVisit(search.visit!),
    enabled: Boolean(search.visit),
  });

  function openInGroup(visitId: string, groupId: string, reviewFlow = false) {
    const sourceGroupId = activeGroupId;
    selectGroup(groupId);
    void navigate({
      to: "/besok",
      search: {
        visit: visitId,
        group: groupId,
        from: reviewFlow ? "min-matresa" : undefined,
      },
      state: reviewFlow
        ? (previous) => ({
            ...previous,
            personalJourney: {
              returnContext: navigationState.returnContext,
              resumeHref: location.href,
              sourceGroupId,
            },
          })
        : (previous) => ({ ...previous, personalJourney: undefined }),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6 pt-3">
      <header>
        <h2 className="font-display text-2xl font-semibold md:text-3xl">Mina besök</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Samma besök visas bara en gång, även när det delas mellan flera grupper.
        </p>
      </header>

      <Card className="rounded-2xl border-border/70 p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="flex items-center gap-2 text-sm font-medium">
              <UserRoundCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Jag var med
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Visa bara besök där du står som deltagare.
            </span>
          </span>
          <Switch
            checked={search.participated}
            onCheckedChange={(checked) =>
              void navigate({
                search: { participated: checked, visit: undefined },
                state: (previous) => previous,
              })
            }
            aria-label="Visa bara besök jag deltog i"
          />
        </label>
      </Card>

      {visits.isPending ? (
        <Card className="animate-pulse rounded-2xl p-6 text-sm text-muted-foreground">
          Hämtar besök…
        </Card>
      ) : visits.isError ? (
        <Card className="rounded-2xl border-destructive/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">Besöken kunde inte hämtas.</p>
          <Button className="mt-3" variant="outline" onClick={() => void visits.refetch()}>
            <RotateCcw className="h-4 w-4" /> Försök igen
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-7 text-center">
          <CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-2 font-medium">Inga besök att visa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {search.participated
              ? "Inga synliga besök är markerade med dig som deltagare."
              : "Besök från dina grupper visas här när de finns."}
          </p>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {items.length} {items.length === 1 ? "besök visat" : "besök visade"}
          </p>
          <div className="space-y-3">
            {items.map((visit) => (
              <PersonalJourneyVisitCard
                key={visit.id}
                visit={visit}
                onOpen={() =>
                  void navigate({
                    search: { ...search, visit: visit.id },
                    state: (previous) => previous,
                  })
                }
              />
            ))}
          </div>
          {visits.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={visits.isFetchingNextPage}
                onClick={() => void visits.fetchNextPage()}
              >
                {visits.isFetchingNextPage ? "Hämtar…" : "Visa fler"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={Boolean(search.visit)}
        onOpenChange={(open) => {
          if (!open) {
            void navigate({
              search: { ...search, visit: undefined },
              state: (previous) => previous,
            });
          }
        }}
      >
        <DialogContent>
          {detail.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Hämtar besöket…</p>
          ) : detail.data ? (
            <>
              <DialogHeader className="pr-7 text-left">
                <DialogTitle className="font-display text-2xl">{detail.data.placeName}</DialogTitle>
                <DialogDescription>
                  {formatOwnVisitDate(detail.data.visitedOn)} ·{" "}
                  {visitMealLabel(detail.data.mealType)}
                  {detail.data.isTakeaway ? " · Hämtmat" : ""}
                </DialogDescription>
              </DialogHeader>

              {detail.data.reviewPending ? (
                <Card className="flex flex-col gap-3 rounded-xl border-primary/20 bg-primary/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden="true" />
                      Ditt omdöme saknas
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Omdömet skrivs i en av grupperna som kan ändras.
                    </p>
                  </div>
                  {detail.data.groups.find((group) => group.isWritable) ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const group = detail.data!.groups.find((item) => item.isWritable)!;
                        openInGroup(detail.data!.id, group.groupId, true);
                      }}
                    >
                      Skriv omdöme
                    </Button>
                  ) : null}
                </Card>
              ) : null}

              <div>
                <h3 className="text-sm font-medium">Omdömen du kan se</h3>
                {detail.data.reviews.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {detail.data.reviews.map((review) => (
                      <Card key={review.id} className="rounded-xl border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{review.authorName}</span>
                          {review.overall != null ? (
                            <span className="flex items-center gap-1.5">
                              <RatingStars value={review.overall} size={12} />
                              <span className="text-xs font-medium">
                                {formatRating(review.overall)}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        {review.comment ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {review.comment}
                          </p>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Inga synliga omdömen ännu.</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium">Synligt genom</h3>
                <div className="mt-2 space-y-2">
                  {detail.data.groups.map((group) => (
                    <div
                      key={group.groupId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{group.groupName}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.isArchived ? "Arkiverad grupp" : "Aktiv grupp"}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openInGroup(detail.data!.id, group.groupId)}
                      >
                        Öppna
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Besöket är inte längre tillgängligt.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
