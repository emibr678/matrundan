import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function GettingStartedCard({
  placeCount,
  visitCount,
  canWrite,
  onAddPlace,
}: {
  placeCount: number;
  visitCount: number;
  canWrite: boolean;
  onAddPlace: () => void;
}) {
  if (visitCount > 0 || !canWrite) return null;

  const empty = placeCount === 0;

  return (
    <Card className="rounded-2xl border-primary/15 bg-primary/[0.035] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{empty ? "Börja med ett ställe" : "Nästa steg: välj ert nästa stopp"}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {empty
              ? "Lägg till något ni vill prova. Det blir startpunkten för gruppens gemensamma lista."
              : "Ni har ställen på listan. Välj vad ni vill prova härnäst och registrera det verkliga besöket när ni varit där."}
          </p>
          {empty && canWrite ? (
            <Button type="button" size="sm" className="mt-3" onClick={onAddPlace}>
              Lägg till första stället
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
