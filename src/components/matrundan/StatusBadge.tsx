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
            text: `Provat av alla ${total} medlemmar`,
            cls: "bg-sage/40 text-sage-foreground border-sage/50",
          }
        : status === "nytt-for-mig"
          ? {
              text: `Nytt för dig · ${visited} av ${total} medlemmar har varit här`,
              cls: "bg-mustard/40 text-mustard-foreground border-mustard/50",
            }
          : {
              text: `Provat i gänget · ${visited} av ${total} medlemmar`,
              cls: "bg-muted text-muted-foreground border-border",
            };

  return (
    <Badge
      variant="outline"
      className={`max-w-full whitespace-normal rounded-full px-2.5 py-0.5 text-right text-[11px] font-medium ${meta.cls}`}
    >
      {meta.text}
    </Badge>
  );
}
