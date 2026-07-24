import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shuffle, Plus, MapPin, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/matrundan/store";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { ActivityRow } from "@/components/matrundan/ActivityRow";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hem · Matrundan" },
      {
        name: "description",
        content:
          "Se gruppens nästa stopp, snabba framsteg och senaste aktivitet på ett ställe.",
      },
      { property: "og:title", content: "Hem · Matrundan" },
      { property: "og:description", content: "Nästa stopp och senaste aktivitet." },
    ],
  }),
  component: Home,
});

function Home() {
  const { state, getPlace, setNext, memberById, proposerOfNext } = useStore();
  const [addOpen, setAddOpen] = React.useState(false);
  const [visitPlace, setVisitPlace] = React.useState<string | null>(null);

  const next = state.nextPlaceId ? getPlace(state.nextPlaceId) : undefined;
  const proposerId = proposerOfNext();
  const proposer = proposerId ? memberById(proposerId) : undefined;

  const untried = React.useMemo(
    () =>
      state.places.filter(
        (p) => !state.visits.some((v) => v.placeId === p.id),
      ),
    [state.places, state.visits],
  );

  const totalPlaces = state.places.length;
  const tried = totalPlaces - untried.length;
  const progressPct = totalPlaces === 0 ? 0 : Math.round((tried / totalPlaces) * 100);

  const shuffle = () => {
    const pool = untried.length ? untried : state.places;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setNext(pick.id);
  };

  const latest = state.activity.slice(0, 5);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2 md:max-w-3xl">
      {/* Hero: Nästa stopp */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Nästa stopp
          </div>
          <button
            onClick={shuffle}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mustard/50 px-3 py-1.5 text-xs font-medium text-mustard-foreground"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Slumpa
          </button>
        </div>

        {next ? (
          <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-sm">
            <div className="relative bg-gradient-to-br from-primary/85 to-primary p-6 text-primary-foreground">
              <div className="text-6xl">{next.photo ?? "🍽️"}</div>
              <div className="mt-3">
                <div className="text-xs tracking-wide opacity-80">
                  {CATEGORY_LABEL[next.category]}
                </div>
                <h1 className="font-display text-3xl font-semibold leading-tight">
                  {next.name}
                </h1>
                <div className="mt-1 flex items-center gap-1 text-sm opacity-90">
                  <MapPin className="h-3.5 w-3.5" />
                  {next.address}, {next.city}
                </div>
                {proposer ? (
                  <div className="mt-2 text-xs opacity-85">
                    Föreslaget av {proposer.avatar} {proposer.name}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 p-4 sm:flex-row">
              <Button
                onClick={() => setVisitPlace(next.id)}
                className="flex-1"
                size="lg"
              >
                Registrera besök
              </Button>
              <Button asChild variant="outline" size="lg" className="flex-1">
                <Link to="/matstallen/$placeId" params={{ placeId: next.id }}>
                  Visa detaljer
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="rounded-3xl border-dashed border-border bg-card p-6 text-center shadow-sm">
            <div className="text-5xl">🎯</div>
            <h2 className="mt-3 font-display text-xl">Inget nästa stopp valt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Slumpa fram ett ställe eller välj ett från listan.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={shuffle}>
                <Shuffle className="h-4 w-4" /> Slumpa
              </Button>
              <Button asChild variant="outline">
                <Link to="/matstallen">Bläddra</Link>
              </Button>
            </div>
          </Card>
        )}
      </section>

      {/* Framsteg + snabbstats */}
      <section>
        <Card className="rounded-2xl border-border/70 p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              Du och gruppen har provat {tried} av {totalPlaces} tillagda ställen
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Ställen" value={totalPlaces} />
            <StatTile label="Besök" value={state.visits.length} />
            <StatTile label="Kvar att prova" value={untried.length} tone="mustard" />
          </div>
        </Card>
      </section>

      {/* Snabbknappar */}
      <section className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" /> Lägg till ställe
        </Button>
        <Button asChild variant="outline" size="lg" className="h-14 rounded-2xl">
          <Link to="/matstallen">
            <Star className="h-4 w-4" /> Bläddra listan
          </Link>
        </Button>
      </section>

      {/* Aktivitet */}
      <section className="pb-4">
        <h2 className="mb-2 font-display text-lg">Senaste aktivitet</h2>
        <Card className="divide-y divide-border/60 rounded-2xl border-border/70 p-0">
          {latest.map((a) => {
            const member = state.members.find((m) => m.id === a.memberId);
            return (
              <div key={a.id} className="flex items-start gap-3 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                  {member?.avatar ?? "🙂"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm leading-snug">{a.text}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(a.at)}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </section>

      <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} />
      <VisitDialog
        open={visitPlace !== null}
        onOpenChange={(v) => !v && setVisitPlace(null)}
        placeId={visitPlace}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "mustard";
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border/70 p-3 text-center",
        tone === "mustard" ? "bg-mustard/25" : "bg-card",
      ].join(" ")}
    >
      <div className="font-display text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
