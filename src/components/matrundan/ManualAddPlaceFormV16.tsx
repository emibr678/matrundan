import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { OccasionPicker } from "./OccasionPicker";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emptyManualPlace, type ManualPlaceDraft } from "@/lib/matrundan/add-place-v16-utils";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type PlaceCategory } from "@/lib/matrundan/types";

const EMOJIS = ["🍽️", "🍕", "🍣", "🍜", "🍔", "🌮", "☕", "🥐", "🍺", "🍦", "🥗", "🍷", "🥟", "🐟"];

export function ManualAddPlaceFormV16({ onClose }: { onClose: () => void }) {
  const { state, addPlace, submitting } = useStore();
  const [draft, setDraft] = React.useState<ManualPlaceDraft>(() =>
    emptyManualPlace(state.group.city),
  );
  const [busy, setBusy] = React.useState(false);
  const isBusy = busy || submitting;

  const set = <K extends keyof ManualPlaceDraft>(key: K, value: ManualPlaceDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!draft.name.trim()) {
      toast.error("Ge stället ett namn");
      return;
    }
    setBusy(true);
    try {
      const added = await addPlace({
        name: draft.name.trim(),
        category: draft.category,
        cuisines: draft.cuisines,
        occasions: draft.occasions,
        address: draft.address.trim(),
        area: draft.area.trim() || undefined,
        city: draft.city.trim() || state.group.city,
        addedBy: state.currentUserId,
        notes: draft.notes.trim() || undefined,
        photo: draft.photo,
      });
      toast.success(`${added.name} tillagd i gruppen`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte lägga till stället.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="min-w-0 space-y-3">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="manual-name">Namn</Label>
            <Input
              id="manual-name"
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>
          <EmojiPicker value={draft.photo} onChange={(value) => set("photo", value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Kategori</Label>
          <Select
            value={draft.category}
            onValueChange={(value) => set("category", value as PlaceCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FoodTagMultiSelect
          id="manual-food-tags"
          value={draft.cuisines}
          onChange={(value) => set("cuisines", value)}
          description="Välj från Matrundans gemensamma lista för att undvika dubletter."
        />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="manual-address">Adress</Label>
            <Input
              id="manual-address"
              value={draft.address}
              onChange={(event) => set("address", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-city">Stad</Label>
            <Input
              id="manual-city"
              value={draft.city}
              onChange={(event) => set("city", event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual-area">Område (valfritt)</Label>
          <Input
            id="manual-area"
            value={draft.area}
            onChange={(event) => set("area", event.target.value)}
          />
        </div>
        <OccasionPicker
          id="manual-occasions"
          value={draft.occasions}
          onChange={(value) => set("occasions", value)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="manual-notes">Anteckning (frivilligt)</Label>
          <Textarea
            id="manual-notes"
            rows={2}
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="ghost" className="min-h-11" disabled={isBusy} onClick={onClose}>
          Avbryt
        </Button>
        <Button className="min-h-11" disabled={isBusy} onClick={submit}>
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lägg till
        </Button>
      </DialogFooter>
    </>
  );
}

function EmojiPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-2xl"
        aria-label="Välj emoji"
        onClick={() => setOpen((current) => !current)}
      >
        {value}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-20 grid w-56 max-w-[calc(100vw-2rem)] grid-cols-7 gap-1 rounded-xl border border-border bg-popover p-2 shadow-lg">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md p-1 text-xl hover:bg-accent"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
