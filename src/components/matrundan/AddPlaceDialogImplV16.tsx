import * as React from "react";
import { AddPlaceResultDialogsV16 } from "./AddPlaceResultDialogsV16";
import { ManualAddPlaceFormV16 } from "./ManualAddPlaceFormV16";
import { PlaceDiscoveryV16 } from "./PlaceDiscoveryV16";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlaceSuggestion } from "@/lib/matrundan/places-provider";

type Tab = "sok" | "manuell";

export function AddPlaceDialogV16({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = React.useState<Tab>("sok");
  const [pending, setPending] = React.useState<PlaceSuggestion | null>(null);
  const [addedResultIds, setAddedResultIds] = React.useState<Set<string>>(() => new Set());

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Lägg till matställe</DialogTitle>
            <DialogDescription>
              Utforska gruppens vanliga områden eller välj en annan plats för den här sökningen.
            </DialogDescription>
          </DialogHeader>
          <TabToggle value={tab} onChange={setTab} />
          {tab === "sok" ? (
            <PlaceDiscoveryV16
              addedResultIds={addedResultIds}
              onBeginAdd={setPending}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <ManualAddPlaceFormV16 onClose={() => onOpenChange(false)} />
          )}
        </DialogContent>
      </Dialog>
      <AddPlaceResultDialogsV16
        parentOpen={open}
        pending={pending}
        onPendingChange={setPending}
        onAdded={(externalId) =>
          setAddedResultIds((current) => new Set(current).add(externalId))
        }
      />
    </>
  );
}

function TabToggle({ value, onChange }: { value: Tab; onChange: (value: Tab) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
      {(["sok", "manuell"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`min-h-11 rounded-full px-2 text-sm font-medium ${
            value === tab ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
        >
          {tab === "sok" ? "Sök & utforska" : "Lägg till manuellt"}
        </button>
      ))}
    </div>
  );
}
