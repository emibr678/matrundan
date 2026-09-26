import * as React from "react";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Heart, ChevronRight, UserPlus } from "lucide-react";
import { z } from "zod";

import { ActivityRow } from "@/components/matrundan/ActivityRow";
import { GroupHighlights } from "@/components/matrundan/GroupHighlights";
import { GroupInviteDialog } from "@/components/matrundan/GroupInviteDialog";
import { GroupSettingsSheet } from "@/components/matrundan/GroupSettingsSheet";
import { MemberAvatar } from "@/components/matrundan/MemberAvatar";
import { MemberProfileSheet } from "@/components/matrundan/MemberProfileSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { appPageTitle } from "@/lib/app-environment";
import { computeMemberProgression } from "@/lib/matrundan/gamification";
import { useSession } from "@/lib/matrundan/session";
import { formatDate, useStore } from "@/lib/matrundan/store";
import { formatRating } from "@/lib/matrundan/version";

const GROUP_SEARCH_DEFAULTS = { member: "" };
const groupSearchSchema = z.object({
  member: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/gruppen")({
  validateSearch: zodValidator(groupSearchSchema),
  search: { middlewares: [stripSearchParams(GROUP_SEARCH_DEFAULTS)] },
  head: () => ({
    meta: [
      { title: appPageTitle("Gruppen") },
      {
        name: "description",
        content: "Se gruppens medlemmar, höjdpunkter, favoriter och senaste aktivitet.",
      },
      { property: "og:title", content: appPageTitle("Gruppen") },
      { property: "og:description", content: "Gänget, aktivitet och favoriter." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { state, getPlace, avgRating } = useStore();
  const { mode, activeGroupId, activeGroupLifecycleStatus, userGroups } = useSession();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const canInvite =
    mode === "live" && Boolean(activeGroupId) && activeGroupLifecycleStatus === "active";
  const groupDescription =
    mode === "live"
      ? userGroups.find((group) => group.id === activeGroupId)?.description?.trim()
      : null;
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gruppen" });
  const activeMember = React.useMemo(
    () =>
      search.member ? (state.members.find((member) => member.id === search.member) ?? null) : null,
    [search.member, state.members],
  );

  const closeMember = () => navigate({ search: { member: "" } });
  const activity = state.activity.slice(0, 10);

  const memberActivity = state.members.map((member) => {
    const lastVisit = state.visits
      .filter((visit) => visit.participantIds.includes(member.id))
      .sort((left, right) => (left.date < right.date ? 1 : -1))[0];
    const favCount = state.favorites.filter((favorite) => favorite.memberId === member.id).length;
    const progression = computeMemberProgression(state, member.id);
    return { member, lastVisit, favCount, progression };
  });

  const favByPlace = new Map<string, number>();
  state.favorites.forEach((favorite) => {
    favByPlace.set(favorite.placeId, (favByPlace.get(favorite.placeId) ?? 0) + 1);
  });
  const sharedFavs = [...favByPlace.entries()]
    .map(([placeId, count]) => ({ place: getPlace(placeId), count }))
    .filter((entry) => entry.place && entry.count >= 2)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4 pt-2 md:max-w-4xl">
      <section>
        <Card className="overflow-hidden rounded-3xl border-border/70 p-0">
          <div className="flex items-center gap-3 bg-gradient-to-br from-sage/50 to-secondary p-4 sm:gap-4 sm:p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-background text-3xl shadow-sm sm:h-16 sm:w-16 sm:text-4xl">
              {state.group.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
                {state.group.name}
              </h1>
              <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                {state.members.length} medlemmar
              </div>
              {groupDescription ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm [overflow-wrap:anywhere]">
                  {groupDescription}
                </p>
              ) : null}
            </div>
            <div className="shrink-0">
              <GroupSettingsSheet />
            </div>
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
          <h2 className="font-display text-lg">Medlemmar</h2>
          {canInvite ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 shrink-0 rounded-full px-3"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus className="h-4 w-4" /> Bjud in
            </Button>
          ) : null}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {memberActivity.map(({ member, lastVisit, favCount, progression }) => {
            const place = lastVisit ? getPlace(lastVisit.placeId) : undefined;
            return (
              <Card
                key={member.id}
                className="min-w-0 rounded-2xl border-border/70 p-0 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent/40"
              >
                <button
                  type="button"
                  onClick={() => navigate({ search: { member: member.id } })}
                  className="flex w-full items-center gap-2.5 rounded-2xl p-3 text-left outline-none sm:gap-3"
                  aria-label={`Öppna profil för ${member.name}`}
                >
                  <MemberAvatar member={member} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 max-w-full truncate font-medium">{member.name}</span>
                      {member.role !== "medlem" ? (
                        <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                          {member.role}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {progression.level.name} · {progression.visits} besök
                    </div>
                    {place ? (
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                        Senast på {place.name} · {formatDate(lastVisit!.date)}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                    <div className="flex items-center justify-end gap-1">
                      <Heart className="h-3 w-3" /> {favCount}
                    </div>
                  </div>
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                </button>
              </Card>
            );
          })}
        </div>
      </section>

      {canInvite && activeGroupId ? (
        <GroupInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          groupId={activeGroupId}
          groupName={state.group.name}
        />
      ) : null}

      <GroupHighlights />

      <MemberProfileSheet
        member={activeMember}
        open={Boolean(activeMember)}
        onOpenChange={(nextOpen) => !nextOpen && closeMember()}
      />

      {sharedFavs.length > 0 ? (
        <section>
          <h2 className="mb-2 font-display text-lg">Gänget gillar</h2>
          <div className="space-y-2">
            {sharedFavs.map(({ place, count }) =>
              place ? (
                <Link
                  key={place.id}
                  to="/matstallen/$placeId"
                  params={{ placeId: place.id }}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mustard/30 text-2xl">
                    {place.photo ?? "🍽️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{place.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Favorit hos {count} i gänget
                      {avgRating(place.id).count > 0
                        ? ` · ${formatRating(avgRating(place.id).overall)} snitt`
                        : ""}
                    </div>
                  </div>
                  <Heart className="h-4 w-4 fill-primary stroke-primary" />
                </Link>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
          <h2 className="font-display text-lg">Aktivitet</h2>
          <Link
            to="/besok"
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-medium text-primary hover:underline"
          >
            Besökshistorik <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {activity.map((entry) => (
            <ActivityRow key={entry.id} activity={entry} />
          ))}
        </Card>
      </section>
    </div>
  );
}
