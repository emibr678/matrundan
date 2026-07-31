import { AddPlaceDialogV16 } from "./AddPlaceDialogImplV16";

export function AddPlaceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!props.open) return null;
  return <AddPlaceDialogV16 {...props} />;
}
