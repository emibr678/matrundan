import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonalJourneyGroup } from "@/lib/matrundan/personal-journey";

export function PersonalJourneyReviewGroupChoices({
  groups,
  onSelect,
  onCancel,
  className = "",
}: {
  groups: PersonalJourneyGroup[];
  onSelect: (group: PersonalJourneyGroup) => void;
  onCancel?: () => void;
  className?: string;
}) {
  const writableGroups = groups.filter((group) => group.isWritable);

  if (writableGroups.length === 0) return null;

  return (
    <div
      className={["rounded-xl border border-border/70 bg-background/55 p-3", className].join(" ")}
    >
      <div>
        <div className="text-sm font-medium">Välj grupp</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Du lämnar omdömet en gång. Betyget följer besöket mellan grupperna. Kommentaren visas
          först i gruppen du väljer.
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {writableGroups.map((group) => (
          <Button
            key={group.groupId}
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-between gap-3 px-3"
            onClick={() => onSelect(group)}
          >
            <span className="min-w-0 truncate">{group.groupName}</span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        ))}
      </div>
      {onCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 min-h-10 w-full text-muted-foreground"
          onClick={onCancel}
        >
          Avbryt
        </Button>
      ) : null}
    </div>
  );
}
