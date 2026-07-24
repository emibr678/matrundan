import * as React from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, googleMapsUrl, useStore } from "@/lib/matrundan/store";
import { RatingStars } from "./Rating";

const MEAL_LABEL: Record<string, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  kväll: "Kväll",
};

/**
 * Detaljvy för ett besök. Visas som sheet både när aktivitet öppnar
 * ett besök (?visit=…) och när ett besökskort under Besök klickas.
 */
export function VisitDetailSheet({
  visitId,
  open,
  onOpenChange,
}: {
  visitId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, getPlace, memberById } = useStore();
  const visit = React.useMemo(
    () => (visitId ? state.visits.find((v) => v.id === visitId) : undefined),
    [visitId, state.visits],
  );
  const place = visit ? getPlace(visit.placeId) : undefined;
  const author = visit ? memberById(visit.createdBy) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">
        {visit && place ? (
          <div className="flex flex-col">
            <SheetHeader className="space-y-0 border-b border-border/60 bg-gradient-to-br from-sage/40 to-secondary p-5 text-left">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground">
                Besök
              </div>
              <SheetTitle className="font-display text-2xl leading-tight">
                <Link
                  to="/matstallen/$placeId"
                  params={{ placeId: place.id }}
                  onClick={() => onOpenChange(false)}
                  className="hover:underline"
                >
                  {place.name}
                </Link>
              </SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {place.address}, {place.city}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 p-5">
              <Card className="rounded-2xl border-border/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-2xl">
                    {author?.avatar ?? "🙂"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{author?.name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        registrerade
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {MEAL_LABEL[visit.meal] ?? visit.meal} ·{" "}
                      {formatDate(visit.date)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <RatingStars value={visit.overall} size={18} />
                  <span className="text-sm font-medium">
                    {visit.overall.toFixed(1)} / 5
                  </span>
                </div>
              </Card>

              <section>
                <h3 className="mb-2 text-sm font-medium">Deltagare</h3>
                <div className="flex flex-wrap gap-1.5">
                  {visit.participantIds.map((pid) => {
                    const m = memberById(pid);
                    return (
                      <Badge
                        key={pid}
                        variant="outline"
                        className="rounded-full border-border/70 bg-secondary/60 px-2.5 py-1 text-xs font-normal"
                      >
                        <span className="mr-1">{m?.avatar}</span>
                        {m?.name ?? "Okänd"}
                      </Badge>
                    );
                  })}
                </div>
              </section>

              {(visit.taste || visit.value || visit.service) && (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Detaljbetyg</h3>
                  <Card className="grid grid-cols-3 gap-3 rounded-2xl border-border/70 p-3 text-center">
                    <Detail label="Smak" value={visit.taste} />
                    <Detail label="Prisvärd" value={visit.value} />
                    <Detail label="Service" value={visit.service} />
                  </Card>
                </section>
              )}

              {visit.comment ? (
                <section>
                  <h3 className="mb-2 text-sm font-medium">Kommentar</h3>
                  <Card className="flex items-start gap-2 rounded-2xl border-border/70 p-3 text-sm text-muted-foreground">
                    <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{visit.comment}</span>
                  </Card>
                </section>
              ) : null}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button asChild variant="outline">
                  <Link
                    to="/matstallen/$placeId"
                    params={{ placeId: place.id }}
                    onClick={() => onOpenChange(false)}
                  >
                    Till stället
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Maps
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold">
        {value ? value.toFixed(1) : "–"}
      </div>
    </div>
  );
}
