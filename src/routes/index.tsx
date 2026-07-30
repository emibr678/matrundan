import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flag, Shuffle, Plus, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/matrundan/store";
import { AddPlaceDialog } from "@/components/matrundan/AddPlaceDialog";
import { VisitDialog } from "@/components/matrundan/VisitDialog";
import { NextStopDateCard } from "@/components/matrundan/NextStopDateCard";
import { AppNudges } from "@/components/matrundan/AppNudges";
import { CATEGORY_LABEL } from "@/lib/matrundan/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hem · Matrundan" },
      {
        name: "description",
        content: "Se gruppens nästa stopp och gemensamma framsteg på ett ställe.",
      },
      { property: "og:title", content: "Hem · Matrundan" },
      {
        property: "og:description",
        content: "Nästa stopp och gruppens gemensamma matresa.",
      },
    ],
  }),
  component: Home,
});

export function Home() {
  const { state, demoReadOnly, getPlace, setNext, memberById, proposerOfNext } = useStore();
  const [addOpen, setAddOpen] = React.useState(false);
  const [visitPlace, setVisitPlace] = React.useState<string | null>(null);
  const groupArchived = state.group.lifecycleStatus === "archived";
  const canWrite = !groupArchived && !demoReadOnly;
  const activePlaces = React.useMemo(
    () => state.places.filter((place) => place.collectionStatus !== "archived"),
    [state.places],
  );

  const next = state.nextPlaceId ? getPlace(state.nextPlaceId) : undefined;
  const proposerId = proposerOfNext();
  const proposer = proposerId ? memberById(proposerId) : undefined;

  const untried = React.useMemo(
    () => activePlaces.filter((place) => !state.visits.some((visit) => visit.placeId === place.id)),
    [activePlaces, state.visits],
  );

  const totalPlaces = activePlaces.length;
  const tried = totalPlaces - untried.length;
  const progressPct = totalPlaces === 0 ? 0 : Math.round((tried / totalPlaces) * 100);

  const shuffle = () => {
    if (!canWrite) return;
    const pool = untried.length ? untried : activePlaces;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) void setNext(pick.id);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-2 md:max-w-3xl">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            <Flag className="h-3.5 w-3.5" />
            Nästa stopp
          </div>
          {canWrite && activePlaces.length > 0 ? (
            <button
              type="button"
              onClick={shuffle}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mustard/50 px-3 py-1.5 text-xs font-medium text-mustard-foreground"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Slumpa
            </button>
          ) : null}
        </div>

        {next ? (
          <Card className="overflow-hidden rounded-3xl border-border/70 bg-card p-0 shadow-sm">
            <Link
              to="/matstallen/$placeId"
              params={{ placeId: next.id }}
              className="block bg-gradient-to-br from-primary/85 to-primary p-6 text-primary-foreground transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Öppna ${next.name}`}
            >
              <div className="text-6xl">{next.photo ?? "🍽️"}</div>
              <div className="mt-3">
                <div className="text-xs tracking-wide opacity-80">
                  {CATEGORY_LABEL[next.category]}
                </div>
                <h1 className="font-display text-3xl font-semibold leading-tight">{next.name}</h1>
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
            </Link>
            <NextStopDateCard
              placeId={next.id}
              canWrite={canWrite && next.collectionStatus !== "archived"}
            />
            {canWrite && next.collectionStatus !== "archived" ? (
              <div className="border-t border-border/60 p-4">
                <Button
                  onClick={() => setVisitPlace(next.id)}
                  className="h-12 w-full text-base"
                  size="lg"
                >
                  Registrera besök
                </Button>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="rounded-3xl border-dashed border-border bg-card p-6 text-center shadow-sm">
            <div className="text-5xl">🎯</div>
            <h2 className="mt-3 font-display text-xl">Inget nästa stopp valt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {groupArchived
                ? "Gruppen är arkiverad. Historiken finns kvar att utforska."
                : demoReadOnly
                  ? "Exempelgruppen visar hur ett nästa stopp ser ut när gruppen har valt ett."
                  : activePlaces.length > 0
                    ? "Slumpa fram ett ställe eller välj ett från listan."
                    : "Lägg till ett ställe för att börja planera nästa stopp."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {canWrite && activePlaces.length > 0 ? (
                <Button onClick={shuffle}>
                  <Shuffle className="h-4 w-4" /> Slumpa
                </Button>
              ) : null}
              <Button asChild variant="outline">
                <Link to="/matstallen">Bläddra</Link>
              </Button>
            </div>
          </Card>
        )}
      </section>

      <section>
        <Card className="rounded-2xl border-border/70 p-4">
          <div className="mb-2 text-sm font-medium">
            Ni har provat {tried} av {totalPlaces} ställen
          </div>
          <Progress value={progressPct} className="h-2" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatTile label="Ställen" value={totalPlaces} />
            <StatTile label="Besök" value={state.visits.length} />
            <StatTile label="Kvar att prova" value={untried.length} tone="mustard" />
          </div>
        </Card>
      </section>

      <section className={canWrite ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
        {canWrite ? (
          <Button
            variant="outline"
            size="lg"
            className="h-14 rounded-2xl"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Lägg till ställe
          </Button>
        ) : null}
        <Button asChild variant="outline" size="lg" className="h-14 rounded-2xl">
          <Link to="/matstallen">
            <Star className="h-4 w-4" /> Bläddra listan
          </Link>
        </Button>
      </section>

      {canWrite ? (
        <>
          <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} />
          <VisitDialog
            open={visitPlace !== null}
            onOpenChange={(open) => !open && setVisitPlace(null)}
            placeId={visitPlace}
          />
        </>
      ) : null}
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
