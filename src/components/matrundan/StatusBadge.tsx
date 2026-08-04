import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/matrundan/store";

export function StatusBadge({ placeId }: { placeId: string }) {
  const { statusOf, visitedCounts } = useStore();
  const status = statusOf(placeId);
  const { visited, total } = visitedCounts(placeId);

  const meta =
    status === "nytt-for-gruppen"
      ? {
          text: "Nytt för gruppen",
          cls: "bg-primary/15 text-primary border-primary/30",
        }
      : status === "alla-provat"
        ? {
            text: "Alla har provat",
            cls: "bg-sage/40 text-sage-foreground border-sage/50",
          }
        : status === "nytt-for-mig"
          ? {
              text: "Nytt för dig",
              cls: "bg-mustard/40 text-mustard-foreground border-mustard/50",
            }
          : {
              text: `${visited} av ${total} har provat`,
              cls: "bg-muted text-muted-foreground border-border",
            };

  return (
    <Badge
      variant="outline"
      className={`max-w-full whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-[11px] font-medium ${meta.cls}`}
    >
      {meta.text}
    </Badge>
  );
}
