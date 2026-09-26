import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function HomeAttentionCard({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-3 shadow-sm">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{title}</p>
          <div className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</div>
          <div className="mt-2.5 flex min-h-9 flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
    </Card>
  );
}
