import { AddPlaceDialogContent } from "./AddPlaceDialogContent";

export function AddPlaceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!props.open) return null;
  return <AddPlaceDialogContent {...props} />;
}
