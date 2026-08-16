import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/matrundan/store";

export function PendingVisitReviewCard({
  visitId,
  placeName,
  visitDate,
  pendingCount,
}: {
  visitId: string;
  placeName: string;
  visitDate: string;
  pendingCount: number;
}) {
  const title =
    pendingCount === 1 ? "Ditt omdöme väntar" : `${pendingCount} besök väntar på ditt omdöme`;

  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-4 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground [overflow-wrap:anywhere]">
              {placeName}
            </span>
            {` · ${formatDate(visitDate)}`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Du var med men har inte lämnat ditt omdöme ännu.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 sm:gap-2">
        <Button asChild size="sm" className="min-h-11">
          <Link to="/besok" search={{ visit: visitId }}>
            Öppna besöket
          </Link>
        </Button>
        {pendingCount > 1 ? (
          <Button asChild variant="ghost" size="sm" className="min-h-11">
            <Link to="/besok">Se alla besök</Link>
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
