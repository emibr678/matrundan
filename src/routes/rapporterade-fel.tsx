import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/rapporterade-fel")({
  head: () => ({
    meta: [
      { title: "Rapporterade fel · Matrundan" },
      {
        name: "description",
        content: "Information om Matrundans centrala hantering av rapporterade platsfel.",
      },
    ],
  }),
  component: ReportedErrorsRetiredPage,
});

function ReportedErrorsRetiredPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-2 pb-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/gruppen">
          <ArrowLeft className="h-4 w-4" /> Gruppen
        </Link>
      </Button>

      <Card className="rounded-2xl border-border/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold sm:text-2xl">Rapporterade fel</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Den tidigare gruppspecifika arbetskön används inte längre. Medlemmar rapporterar
              fortfarande fel direkt från matställen och sökträffar, men handläggningen sker
              centralt i Platsunderhåll av särskilt behöriga platsunderhållare.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Gruppnamn, medlemskap och historisk privat rapporttext skickas inte till den globala
              arbetsytan. Befintliga rapporter och offentlig OSM-historik raderas inte.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
