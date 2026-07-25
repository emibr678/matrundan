import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, UserPlus, Sparkles, Heart, Star, MapPin } from "lucide-react";
import { formatDate, useStore } from "@/lib/matrundan/store";
import { resolveActivityTarget, type Activity } from "@/lib/matrundan/types";

const KIND_ICON = {
  added: MapPin,
  visited: Star,
  favorited: Heart,
  "next-picked": Sparkles,
  "member-joined": UserPlus,
} as const;

/**
 * Återanvändbar aktivitetsrad. Bygger rätt länk från
 * `resolveActivityTarget` så att navigation inte dupliceras i vyerna.
 * Okända/ofullständiga aktiviteter renderas som icke-klickbar rad.
 */
export function ActivityRow({ activity }: { activity: Activity }) {
  const { memberById } = useStore();
  const member = memberById(activity.memberId);
  const target = resolveActivityTarget(activity);
  const Icon = KIND_ICON[activity.kind] ?? Sparkles;

  const inner = (
    <div className="flex w-full items-center gap-3 p-3">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
        <span>{member?.avatar ?? "🙂"}</span>
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-snug">{activity.text}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {formatDate(activity.at)}
        </div>
      </div>
      {target ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : null}
    </div>
  );

  if (!target) return <div>{inner}</div>;

  if (target.kind === "visit") {
    return (
      <Link
        to="/matstallen/$placeId"
        params={{ placeId: target.placeId }}
        search={{ visit: target.visitId }}
        className="block min-h-11 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
      >
        {inner}
      </Link>
    );
  }

  if (target.kind === "place") {
    return (
      <Link
        to="/matstallen/$placeId"
        params={{ placeId: target.placeId }}
        className="block min-h-11 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
      >
        {inner}
      </Link>
    );
  }

  // member
  return (
    <Link
      to="/gruppen"
      search={{ member: target.memberId }}
      className="block min-h-11 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
    >
      {inner}
    </Link>
  );
}
