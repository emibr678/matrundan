import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, MessageCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/matrundan/store";

export interface PendingVisitReviewItem {
  visitId: string;
  placeName: string;
  visitDate: string;
}

export function PendingVisitReviewCard({ visits }: { visits: PendingVisitReviewItem[] }) {
  const [open, setOpen] = React.useState(false);
  const firstVisit = visits[0];

  if (!firstVisit) return null;

  const title =
    visits.length === 1
      ? "Du har ett besök att tycka till om"
      : `Du har ${visits.length} besök att tycka till om`;
  const summary =
    visits.length === 1
      ? `${firstVisit.placeName} · ${formatDate(firstVisit.visitDate)}`
      : `Senast: ${firstVisit.placeName} · ${formatDate(firstVisit.visitDate)}`;

  const card = (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-3 shadow-sm transition-colors hover:bg-primary/[0.07]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{summary}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  );

  if (visits.length === 1) {
    return (
      <Link
        to="/besok"
        search={{ visit: firstVisit.visitId }}
        aria-label={`Öppna ${firstVisit.placeName} och lämna omdöme`}
        className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {card}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Välj besök att lämna omdöme på"
        onClick={() => setOpen(true)}
        className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {card}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0">
          <DialogHeader className="px-5 pb-2 pt-5 text-left">
            <DialogTitle>Besök att tycka till om</DialogTitle>
            <DialogDescription>Välj vilket besök du vill börja med.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-2 overflow-y-auto px-5 pb-5">
            {visits.map((visit) => (
              <Link
                key={visit.visitId}
                to="/besok"
                search={{ visit: visit.visitId }}
                onClick={() => setOpen(false)}
                className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-border/70 px-3 py-3 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{visit.placeName}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {formatDate(visit.visitDate)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
