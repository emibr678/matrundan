import { useStore } from "@/lib/matrundan/store";
import { VisitDialog as VisitDialogCore } from "./VisitDialogCore";
import { VisitPlaceOccasionDialog } from "./VisitPlaceOccasionDialog";

export function VisitDialog({
  open,
  onOpenChange,
  placeId,
  completeNextStopOnSave = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  placeId: string | null;
  completeNextStopOnSave?: boolean;
}) {
  const { getPlace } = useStore();
  const place = placeId ? getPlace(placeId) : undefined;
  const needsOccasionClassification = Boolean(open && place && place.occasions.length === 0);

  return (
    <>
      {place ? (
        <VisitPlaceOccasionDialog
          open={needsOccasionClassification}
          place={place}
          onCancel={() => onOpenChange(false)}
        />
      ) : null}

      <VisitDialogCore
        open={open && !needsOccasionClassification}
        onOpenChange={onOpenChange}
        placeId={placeId}
        completeNextStopOnSave={completeNextStopOnSave}
      />
    </>
  );
}
