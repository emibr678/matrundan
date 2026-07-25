import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "./MemberAvatar";
import { useStore, formatDate } from "@/lib/matrundan/store";
import {
  computeLeaderboard,
  computeGroupMilestones,
  type LeaderboardCategory,
  type LeaderboardPeriod,
} from "@/lib/matrundan/gamification";

const CATEGORIES: { id: LeaderboardCategory; label: string; suffix: string }[] = [
  { id: "visits", label: "Besök", suffix: "besök" },
  { id: "newPlaces", label: "Nya ställen", suffix: "st" },
  { id: "breadth", label: "Köksbredd", suffix: "kök" },
];

/**
 * Diskret sammanställning av gruppens gamification: en kompakt topplista
 * med tre kategorier × två perioder samt en chip-lista med milstolpar.
 */
export function GroupHighlights() {
  const { state } = useStore();
  const [category, setCategory] = React.useState<LeaderboardCategory>("visits");
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("year");

  const rows = React.useMemo(
    () => computeLeaderboard(state, category, period),
    [state, category, period],
  );
  const milestones = React.useMemo(() => computeGroupMilestones(state), [state]);

  const memberById = React.useMemo(
    () => new Map(state.members.map((m) => [m.id, m])),
    [state.members],
  );

  const top = rows.filter((r) => r.value > 0).slice(0, 3);
  const meRow = rows.find((r) => r.memberId === state.currentUserId);
  const meInTop = meRow ? top.some((r) => r.memberId === meRow.memberId) : true;
  const suffix = CATEGORIES.find((c) => c.id === category)!.suffix;

  const hasAny = top.length > 0 || milestones.length > 0;
  if (!hasAny) return null;

  return (
    <section>
      <h2 className="mb-2 font-display text-lg">Gruppens höjdpunkter</h2>
      <Card className="rounded-2xl border-border/70 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-0.5 text-xs">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={
                  "min-h-8 rounded-full px-2.5 transition " +
                  (category === c.id
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground")
                }
                aria-pressed={category === c.id}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full border border-border/70 bg-muted/40 p-0.5 text-xs">
            {(["year", "all"] as const).map((pp) => (
              <button
                key={pp}
                type="button"
                onClick={() => setPeriod(pp)}
                className={
                  "min-h-8 rounded-full px-2.5 transition " +
                  (period === pp
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground")
                }
                aria-pressed={period === pp}
              >
                {pp === "year" ? "I år" : "Totalt"}
              </button>
            ))}
          </div>
        </div>

        {top.length > 0 ? (
          <ol className="space-y-1.5">
            {top.map((r) => {
              const m = memberById.get(r.memberId);
              if (!m) return null;
              return (
                <li
                  key={r.memberId}
                  className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-2.5 py-1.5"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {r.rank}.
                  </span>
                  <MemberAvatar member={m} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {r.value} {suffix}
                  </span>
                </li>
              );
            })}
            {!meInTop && meRow && meRow.value > 0 ? (
              <li className="flex items-center gap-2.5 rounded-xl border border-dashed border-border/70 px-2.5 py-1.5">
                <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                  {meRow.rank}.
                </span>
                <MemberAvatar member={memberById.get(meRow.memberId)!} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm">Du</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {meRow.value} {suffix}
                </span>
              </li>
            ) : null}
          </ol>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-3 text-xs italic text-muted-foreground">
            Inget att visa än – registrera fler besök så fylls listan på.
          </div>
        )}

        {milestones.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {milestones.slice(0, 6).map((ms) => (
              <Badge
                key={ms.id}
                variant="outline"
                className="rounded-full border-border/70 bg-secondary/60 text-[11px] font-normal"
                title={formatDate(ms.at)}
              >
                {ms.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
