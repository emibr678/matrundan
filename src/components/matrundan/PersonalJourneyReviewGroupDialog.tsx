import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonalJourneyGroup } from "@/lib/matrundan/personal-journey";

export function PersonalJourneyReviewGroupDialog({
  open,
  onOpenChange,
  groups,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PersonalJourneyGroup[];
  onSelect: (group: PersonalJourneyGroup) => void;
}) {
  const writableGroups = groups.filter((group) => group.isWritable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Välj grupp</DialogTitle>
          <DialogDescription>
            Besöket finns i flera grupper där du kan skriva omdömet. Välj vilken grupp du vill
            öppna.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
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
      </DialogContent>
    </Dialog>
  );
}
