import { CircleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";

export function PlaceDataReportsSection() {
  return (
    <section aria-labelledby="place-data-reports-info-heading">
      <h3 id="place-data-reports-info-heading" className="mb-2 text-sm font-medium">
        Rapporterade fel
      </h3>
      <Card className="rounded-2xl border-border/70 p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">Ingen separat gruppkö längre</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Medlemmar rapporterar fortfarande fel från matställen och sökträffar. Själva
              handläggningen sker centralt i Platsunderhåll av särskilt behöriga platsunderhållare,
              utan att gruppnamn, medlemskap eller privat rapporttext delas dit.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
