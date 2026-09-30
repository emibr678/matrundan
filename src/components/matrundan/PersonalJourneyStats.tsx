import * as React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { levelForCount } from "@/lib/matrundan/gamification";
import type {
  PersonalJourneyGlobalStats,
  PersonalJourneyStatsLeaderboardEntry,
  PersonalJourneyStatsMetric,
} from "@/lib/matrundan/personal-journey";

export function PersonalJourneyOwnStats({
  stats,
  compact = false,
}: {
  stats: PersonalJourneyGlobalStats;
  compact?: boolean;
}) {
  return (
    <Card
      className={
        compact ? "rounded-2xl border-border/70 p-3" : "rounded-2xl border-border/70 p-4"
      }
    >
      {!compact ? (
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-xl">
            {stats.avatarEmoji ?? "🙂"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Din samlade statistik</div>
            <div className="truncate text-xs text-muted-foreground">{stats.displayName}</div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5">
        <StatBox label="Besök" value={stats.visits} />
        <StatBox label="Ställen" value={stats.uniquePlaces} />
        <StatBox label="Kök" value={stats.uniqueCuisines} />
        <StatBox label="Grupper" value={stats.groupCount} />
      </div>

      <div className="mt-3">
        <LevelLine visits={stats.visits} />
      </div>    </Card>
  );
}

export function PersonalJourneyPeopleRanking({
  people,
  metric,
  onSelect,
}: {
  people: PersonalJourneyStatsLeaderboardEntry[];
  metric: PersonalJourneyStatsMetric;
  onSelect: (person: PersonalJourneyStatsLeaderboardEntry) => void;
}) {
  const metricDef = PERSONAL_STATS_METRICS.find((item) => item.id === metric)!;

  return (
    <div className="space-y-2">
      {people.map((person, index) => (
        <button
          key={`${person.displayName}-${person.rank}-${index}`}
          type="button"
          onClick={() => onSelect(person)}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/65 px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {person.rank}
          </span>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-lg">
            {person.avatarEmoji ?? person.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{person.displayName}</span>
              {person.isSelf ? (
                <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                  Du
                </Badge>
              ) : null}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {levelForCount(person.visits).name}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-display text-lg font-semibold">{person.value}</span>
            <span className="block text-[11px] text-muted-foreground">
              {metricDef.label.toLowerCase()}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function PersonalJourneyPersonStatsDialog({
  person,
  open,
  onOpenChange,
}: {
  person: PersonalJourneyStatsLeaderboardEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!person) return null;
  const level = levelForCount(person.visits);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="pr-7 text-left">
          <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-2xl">
            {person.avatarEmoji ?? person.displayName.slice(0, 1).toUpperCase()}
          </div>
          <DialogTitle className="font-display text-2xl">{person.displayName}</DialogTitle>
          <DialogDescription>{level.name} · samlad Matrundan-statistik</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Besök" value={person.visits} />
          <StatBox label="Ställen" value={person.uniquePlaces} />
          <StatBox label="Kök" value={person.uniqueCuisines} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
