import * as React from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createGroupPlaceDataReport,
  createLocalPlaceDataReport,
  PLACE_DATA_REPORT_CATEGORIES,
  PLACE_DATA_REPORT_CATEGORY_LABEL,
  type PlaceDataReportCategory,
} from "@/lib/matrundan/place-data-reports";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Place } from "@/lib/matrundan/types";

interface PlaceDataReportDialogProps {
  place: Place;
  disabled?: boolean;
  compact?: boolean;
}

function canReportMissingInOsm(place: Place): boolean {
  return (
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lng) &&
    !(place.sources ?? []).some(
      (source) => source.provider === "openstreetmap" && source.status === "active",
    )
  );
}

function defaultCategory(place: Place): PlaceDataReportCategory {
  return place.origin === "manual" && canReportMissingInOsm(place)
    ? "missing_in_osm"
    : "closed_or_replaced";
}

export function PlaceDataReportDialog({
  place,
  disabled = false,
  compact = false,
}: PlaceDataReportDialogProps) {
  const { mode, activeGroupId, exampleMode } = useSession();
  const { state, submitting } = useStore();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<PlaceDataReportCategory>(() =>
    defaultCategory(place),
  );
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const reporter = state.members.find((member) => member.id === state.currentUserId);
  const categories = PLACE_DATA_REPORT_CATEGORIES.filter(
    (value) => value !== "missing_in_osm" || canReportMissingInOsm(place),
  );

  function reset() {
    setCategory(defaultCategory(place));
    setDescription("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId || !reporter) {
      toast.error("Rapporten kunde inte kopplas till gruppen.");
      return;
    }

    setSaving(true);
    try {
      const result =
        mode === "live"
          ? await createGroupPlaceDataReport(groupId, place.id, { category, description })
          : createLocalPlaceDataReport(
              groupId,
              place,
              reporter,
              { category, description },
              exampleMode ? "session" : "local",
            );
      window.dispatchEvent(new Event("matrundan:place-data-reports-changed"));
      toast.success(
        result.created
          ? "Rapporten har skickats till gruppens ägare och administratörer."
          : "Du har redan en öppen rapport av den här typen för stället.",
      );
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka rapporten.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "sm" : "default"}
          className={
            compact
              ? "min-h-11 shrink-0 rounded-full px-3 text-muted-foreground hover:text-foreground"
              : "min-h-11 w-full justify-start whitespace-normal px-3 text-left text-muted-foreground"
          }
          disabled={disabled}
        >
          <CircleAlert className="h-4 w-4 shrink-0" />
          {compact ? "Något stämmer inte" : "Rapportera felaktig uppgift"}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="place-data-report-description">
        <DialogHeader>
          <DialogTitle>Rapportera felaktig uppgift</DialogTitle>
          <DialogDescription id="place-data-report-description">
            Rapporten går till gruppens ägare och administratörer. Inget publiceras automatiskt.
            Gruppens namn, medlemmar och privata kommentarer skickas inte vidare.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="place-data-report-category">Vad verkar vara fel?</Label>
            <select
              id="place-data-report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as PlaceDataReportCategory)}
              className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {PLACE_DATA_REPORT_CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="place-data-report-description-input">Vad har du sett?</Label>
            <Textarea
              id="place-data-report-description-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={10}
              maxLength={1000}
              required
              rows={5}
              className="min-h-28 resize-y"
              placeholder={
                category === "missing_in_osm"
                  ? "Exempel: Jag kontrollerade platsen och verksamhetens officiella information men hittade inget motsvarande objekt i OpenStreetMap."
                  : "Exempel: Skylten visar att restaurangen har stängt permanent och en ny verksamhet finns på adressen."
              }
            />
            <div className="flex items-start justify-between gap-3 text-[11px] leading-relaxed text-muted-foreground">
              <p>
                Beskriv en egen observation eller hänvisa till verksamhetens officiella information.
                Kopiera inte från andra karttjänster.
              </p>
              <span className="shrink-0">{description.length}/1000</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button type="submit" disabled={saving || submitting || description.trim().length < 10}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Skicka rapport
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
