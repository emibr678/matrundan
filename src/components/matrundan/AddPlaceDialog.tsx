import { AddPlaceDialogContent } from "./AddPlaceDialogContent";

export function AddPlaceDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}) {
  if (!props.open) return null;
  return <AddPlaceDialogContent {...props} />;
}
