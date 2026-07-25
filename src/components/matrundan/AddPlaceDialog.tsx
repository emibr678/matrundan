import { AddPlaceDialog as AddPlaceDialogImpl } from "./AddPlaceDialogImpl";

export function AddPlaceDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!props.open) return null;
  return <AddPlaceDialogImpl {...props} />;
}
