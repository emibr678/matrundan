import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "./FoodTagMultiSelect";
import { GeoapifyLocationInput } from "./GeoapifyLocationInput";
import { OccasionPicker } from "./OccasionPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import { createGroupPlaceDataReport } from "@/lib/matrundan/place-data-reports";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import { CATEGORY_LABEL, type PlaceCategory } from "@/lib/matrundan/types";

const EMOJIS = ["🍽️", "🍕", "🍣", "🍜", "🍔", "🌮", "☕", "🥐", "🍺", "🍦", "🥗", "🍷", "🥟", "🐟"];

export function ManualAddPlaceFormV16({ onClose }: { onClose: () => void }) {
  const { state, addPlace, submitting } = useStore();
  const { mode, activeGroupId } = useSession();
  const [draft, setDraft] = React.useState<ManualPlaceDraft>(() =>
    emptyManualPlace(state.group.city),
  );
  const [verifiedLocation, setVerifiedLocation] = React.useState<VerifiedHomeLocation | null>(null);
  const [reportMissingInOsm, setReportMissingInOsm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const isBusy = busy || submitting;
  const isLive = mode === "live";

  const set = <K extends keyof ManualPlaceDraft>(key: K, value: ManualPlaceDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function changeAddress(value: string) {
    set("address", value);
    if (verifiedLocation && value !== verifiedLocation.label) {
      setVerifiedLocation(null);
      setReportMissingInOsm(false);
    }
  }

  async function submit() {
    if (!draft.name.trim()) {
      toast.error("Ge stället ett namn");
      return;
    }
    if (reportMissingInOsm && !verifiedLocation) {
      toast.error("Välj först en verifierad adress och kartposition.");
      return;
    }
    if (reportMissingInOsm && isLive && !activeGroupId) {
      toast.error("Ingen aktiv grupp kunde hittas.");
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
        lat: verifiedLocation?.lat,
        lng: verifiedLocation?.lng,
        addedBy: state.currentUserId,
        notes: draft.notes.trim() || undefined,
        photo: draft.photo,
        origin: "manual",
      });

      let reportError: string | null = null;
      if (reportMissingInOsm && activeGroupId) {
        try {
          await createGroupPlaceDataReport(activeGroupId, added.id, {
            category: "missing_in_osm",
            description:
              "Verksamheten finns på den verifierade platsen men saknades i OpenStreetMap när stället lades till i Matrundan.",
          });
          window.dispatchEvent(new Event("matrundan:place-data-reports-changed"));
        } catch (error) {
          reportError =
            error instanceof Error
              ? error.message
              : "Det privata OSM-underlaget kunde inte skapas.";
        }
      }

      if (reportError) {
        toast.warning(`${added.name} är tillagd i gruppen`, {
          description: `Platsdatarapporten kunde inte skapas: ${reportError}`,
        });
      } else {
        toast.success(`${added.name} tillagd i gruppen`, {
          description: reportMissingInOsm
            ? "Ett privat underlag väntar nu på gruppens granskning. Inget har publicerats till OpenStreetMap."
            : undefined,
        });
      }
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
          label="Kök och inriktning (valfritt)"
          value={draft.cuisines}
          onChange={(value) => set("cuisines", value)}
        />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="manual-address">Adress</Label>
            {isLive ? (
              <GeoapifyLocationInput
                id="manual-address"
                value={draft.address}
                onChange={changeAddress}
                onSelect={(location) => {
                  set("address", location.label);
                  setVerifiedLocation(location);
                }}
                onClearVerified={() => {
                  setVerifiedLocation(null);
                  setReportMissingInOsm(false);
                }}
                placeholder="Sök och välj adress"
                disabled={isBusy}
              />
            ) : (
              <Input
                id="manual-address"
                value={draft.address}
                onChange={(event) => set("address", event.target.value)}
              />
            )}
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
        {isLive ? (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              {verifiedLocation ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : null}
              <p>
                {verifiedLocation
                  ? "Kartpositionen är verifierad från den valda adressen."
                  : "Välj en adress i söklistan om stället ska kunna rapporteras som saknat i OpenStreetMap."}
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-1 py-2">
              <Checkbox
                checked={reportMissingInOsm}
                onCheckedChange={(checked) => setReportMissingInOsm(checked === true)}
                disabled={!verifiedLocation || isBusy}
                aria-label="Skapa privat underlag om att stället saknas i OpenStreetMap"
              />
              <span className="min-w-0 text-sm leading-snug">
                <span className="block font-medium">Saknas i OpenStreetMap</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Jag har kontrollerat detta. Skapa ett privat underlag för gruppens admin – inget
                  publiceras automatiskt.
                </span>
              </span>
            </label>
          </div>
        ) : null}
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
          description="Valfritt – kan fyllas i efter ett besök."
        />
        <div className="space-y-1.5">
          <Label htmlFor="manual-notes">Anteckning (valfritt)</Label>
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
