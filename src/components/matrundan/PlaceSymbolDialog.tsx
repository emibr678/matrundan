import * as React from "react";
import { toast } from "sonner";
import { PlaceSymbolPicker } from "./PlaceSymbolPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

export function PlaceSymbolDialog({
  place,
  trigger,
}: {
  place: Place;
  trigger: React.ReactElement;
}) {
  const { updatePlaceMetadata, submitting } = useStore();
  const [open, setOpen] = React.useState(false);
  const [symbolOverride, setSymbolOverride] = React.useState<string | null>(
    place.symbolOverride ?? null,
  );

  React.useEffect(() => {
    if (open) setSymbolOverride(place.symbolOverride ?? null);
  }, [open, place.symbolOverride]);

  async function save() {
    try {
      await updatePlaceMetadata(place.id, {
        categoryOverride: place.categoryOverride ?? null,
        cuisinesOverride: place.cuisinesOverride ?? null,
        symbolOverride,
        occasions: place.occasions,
        notes: place.notes ?? null,
      });
      toast.success(
        symbolOverride ? "Symbolen är uppdaterad för gruppen." : "Automatisk symbol används igen.",
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara symbolen.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Välj symbol</DialogTitle>
          <DialogDescription>
            Valet gäller bara i gruppen. Du kan när som helst gå tillbaka till automatisk symbol.
          </DialogDescription>
        </DialogHeader>

        <PlaceSymbolPicker source={place} value={symbolOverride} onChange={setSymbolOverride} />

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button disabled={submitting} onClick={() => void save()}>
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
