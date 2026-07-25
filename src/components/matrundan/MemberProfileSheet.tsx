import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MapPin, Sparkles, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useStore, formatDate } from "@/lib/matrundan/store";
import type { Member, Place, Visit } from "@/lib/matrundan/types";
import { RatingStars } from "./Rating";
import { ActivityRow } from "./ActivityRow";
import {
  BADGES,
  computeMemberProgression,
  type MemberProgression,
} from "@/lib/matrundan/gamification";

interface MemberProfileData {
  visitCount: number;
  triedPlaces: Place[];
  proposedCount: number;
  lastVisit: (Visit & { place?: Place }) | null;
  currentFavorite: Place | null;
  otherFavorites: Place[];
  topCuisines: string[];
  recentActivity: ReturnType<typeof useStore>["state"]["activity"];
  progression: MemberProgression;
}

function useMemberProfile(memberId: string | null): MemberProfileData | null {
  const { state, getPlace } = useStore();
  return React.useMemo(() => {
    if (!memberId) return null;
    const visits = state.visits
      .filter((v) => v.participantIds.includes(memberId))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const triedPlaceIds = Array.from(new Set(visits.map((v) => v.placeId)));
    const triedPlaces = triedPlaceIds
      .map((id) => getPlace(id))
      .filter((p): p is Place => !!p);

    const proposedCount = state.places.filter((p) => p.addedBy === memberId).length;

    const lastVisitRaw = visits[0] ?? null;
    const lastVisit = lastVisitRaw
      ? { ...lastVisitRaw, place: getPlace(lastVisitRaw.placeId) }
      : null;

    const favoriteIds = state.favorites
      .filter((f) => f.memberId === memberId)
      .map((f) => f.placeId);
    const favoritePlaces = favoriteIds
      .map((id) => getPlace(id))
      .filter((p): p is Place => !!p);

    let currentFavorite: Place | null = null;
    if (favoritePlaces.length > 0) {
      const withLastVisit = favoritePlaces
        .map((p) => {
          const lv = visits.find((v) => v.placeId === p.id);
          return { p, date: lv?.date };
        })
        .sort((a, b) => (a.date && b.date ? (a.date < b.date ? 1 : -1) : b.date ? 1 : -1));
      currentFavorite = withLastVisit[0].date
        ? withLastVisit[0].p
        : favoritePlaces[0];
    }
    const otherFavorites = favoritePlaces.filter(
      (p) => p.id !== currentFavorite?.id,
    );

    const cuisineCounts = new Map<string, number>();
    triedPlaces.forEach((p) =>
      p.cuisines.forEach((c) =>
        cuisineCounts.set(c, (cuisineCounts.get(c) ?? 0) + 1),
      ),
    );
    const topCuisines = [...cuisineCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);

    const recentActivity = state.activity
      .filter((a) => a.memberId === memberId)
      .slice(0, 4);

    return {
      visitCount: visits.length,
      triedPlaces,
      proposedCount,
      lastVisit,
      currentFavorite,
      otherFavorites,
      topCuisines,
      recentActivity,
    };
  }, [memberId, state, getPlace]);
}

export function MemberProfileSheet({
  member,
  open,
  onOpenChange,
}: {
  member: Member | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state } = useStore();
  const profile = useMemberProfile(member?.id ?? null);

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-md"
      >
        {member && profile ? (
          <div className="flex flex-col">
            <SheetHeader className="space-y-0 border-b border-border/60 bg-gradient-to-br from-sage/40 to-secondary p-5 text-left">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-background text-4xl shadow-sm">
                  {member.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-display text-2xl leading-tight">
                    {member.name}
                    {member.id === state.currentUserId ? (
                      <Badge
                        variant="secondary"
                        className="ml-2 rounded-full align-middle text-[10px]"
                      >
                        Du
                      </Badge>
                    ) : null}
                  </SheetTitle>
                  <SheetDescription className="mt-0.5 capitalize">
                    {member.role}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 p-5">
              {/* Nyckeltal */}
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Besök" value={profile.visitCount} />
                <Stat label="Provade" value={profile.triedPlaces.length} />
                <Stat label="Föreslagna" value={profile.proposedCount} />
              </div>

              {/* Senaste besök */}
              <section>
                <h3 className="mb-2 text-sm font-medium">Senaste besök</h3>
                {profile.lastVisit && profile.lastVisit.place ? (
                  <Link
                    to="/matstallen/$placeId"
                    params={{ placeId: profile.lastVisit.place.id }}
                    onClick={close}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mustard/30 text-2xl">
                      {profile.lastVisit.place.photo ?? "🍽️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {profile.lastVisit.place.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">
                          {profile.lastVisit.meal}
                        </span>
                        <span>· {formatDate(profile.lastVisit.date)}</span>
                      </div>
                    </div>
                    <RatingStars value={profile.lastVisit.overall} size={13} />
                  </Link>
                ) : (
                  <EmptyLine text="Inga besök än." />
                )}
              </section>

              {/* Favorit just nu */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Heart className="h-3.5 w-3.5 fill-primary stroke-primary" />
                  Favorit just nu
                </h3>
                {profile.currentFavorite ? (
                  <Link
                    to="/matstallen/$placeId"
                    params={{ placeId: profile.currentFavorite.id }}
                    onClick={close}
                    className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 transition-colors hover:bg-accent"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">
                      {profile.currentFavorite.photo ?? "🍽️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {profile.currentFavorite.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {profile.currentFavorite.address}
                        </span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <EmptyLine text="Har inga favoriter än." />
                )}
              </section>

              {/* Smakprofil */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                  Smakprofil
                </h3>
                {profile.topCuisines.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.topCuisines.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="rounded-full border-border/70 bg-secondary/60 text-xs font-normal"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <EmptyLine text="Behöver fler besök för att visa smaker." />
                )}
              </section>

              {/* Fler favoriter */}
              {profile.otherFavorites.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Fler favoriter</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.otherFavorites.map((p) => (
                      <Link
                        key={p.id}
                        to="/matstallen/$placeId"
                        params={{ placeId: p.id }}
                        onClick={close}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        <span>{p.photo ?? "🍽️"}</span>
                        <span className="truncate max-w-[10rem]">{p.name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Aktivitet */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  Senaste aktivitet
                </h3>
                {profile.recentActivity.length > 0 ? (
                  <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
                    {profile.recentActivity.map((a) => (
                      <ActivityRow key={a.id} activity={a} />
                    ))}
                  </Card>
                ) : (
                  <EmptyLine text="Ingen aktivitet än." />
                )}
              </section>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3 text-center">
      <div className="font-display text-2xl leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-3 text-xs italic text-muted-foreground">
      {text}
    </div>
  );
}
