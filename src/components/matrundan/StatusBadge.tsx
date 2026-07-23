import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/matrundan/store";

const LABEL = {
  "nytt-for-mig": { text: "Nytt för mig", cls: "bg-mustard/40 text-mustard-foreground border-mustard/50" },
  "nytt-for-gruppen": { text: "Nytt för gruppen", cls: "bg-primary/15 text-primary border-primary/30" },
  "alla-provat": { text: "Alla har provat", cls: "bg-sage/40 text-sage-foreground border-sage/50" },
  delvis: { text: "Några har provat", cls: "bg-muted text-muted-foreground border-border" },
} as const;

export function StatusBadge({ placeId }: { placeId: string }) {
  const { statusOf } = useStore();
  const status = statusOf(placeId);
  const meta = LABEL[status];
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}>
      {meta.text}
    </Badge>
  );
}
