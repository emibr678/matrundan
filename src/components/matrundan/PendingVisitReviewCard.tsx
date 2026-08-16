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
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-3 shadow-sm">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-medium text-foreground [overflow-wrap:anywhere]">
              {placeName}
            </span>
            {` · ${formatDate(visitDate)}`}
          </p>
        </div>
      </div>

      <div className="mt-2 pl-10.5">
        <Button asChild size="sm" className="min-h-11">
          <Link to="/besok" search={{ visit: visitId }}>
            Öppna besöket
          </Link>
        </Button>
      </div>
    </Card>
  );
}
