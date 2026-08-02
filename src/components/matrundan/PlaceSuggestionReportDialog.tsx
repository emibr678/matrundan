import * as React from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PlaceSuggestionSignalPanel } from "./PlaceSuggestionSignalPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createGroupPlaceSuggestionReport,
  createLocalPlaceSuggestionReport,
  PLACE_DATA_REPORT_CATEGORY_LABEL,
  PLACE_SUGGESTION_REPORT_CATEGORIES,
  type PlaceDataReportCategory,
  type ReportablePlaceSuggestion,
} from "@/lib/matrundan/place-data-reports";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";

interface PlaceSuggestionReportDialogProps {
  suggestion: ReportablePlaceSuggestion;
  canHide?: boolean;
  alreadyHidden?: boolean;
  disabled?: boolean;
  triggerLabel?: string;
  onHide?: () => Promise<void>;
  onHidden?: () => void;
  onReported?: () => void;
}

function shouldSuggestHide(category: PlaceDataReportCategory): boolean {
  return category === "closed_or_replaced" || category === "duplicate";
}

export function PlaceSuggestionReportDialog({
  suggestion,
  canHide = false,
  alreadyHidden = false,
  disabled = false,
  triggerLabel = "Rapportera felaktig träff",
  onHide,
  onHidden,
  onReported,
}: PlaceSuggestionReportDialogProps) {
  const { mode, activeGroupId, exampleMode } = useSession();
  const { state, submitting } = useStore();
  const formId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<PlaceDataReportCategory>("closed_or_replaced");
  const [description, setDescription] = React.useState("");
  const [hideAlso, setHideAlso] = React.useState(canHide && !alreadyHidden);
  const [saving, setSaving] = React.useState(false);
  const groupId = mode === "live" ? activeGroupId : state.group.id;
  const reporter = state.members.find((member) => member.id === state.currentUserId);
  const categories = PLACE_SUGGESTION_REPORT_CATEGORIES.filter(
    (value) => value !== "wrong_website" || Boolean(suggestion.website),
  );

  function reset() {
    setCategory("closed_or_replaced");
    setDescription("");
    setHideAlso(canHide && !alreadyHidden);
  }

  function changeCategory(value: PlaceDataReportCategory) {
    setCategory(value);
    if (canHide && !alreadyHidden) setHideAlso(shouldSuggestHide(value));
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
          ? await createGroupPlaceSuggestionReport(groupId, suggestion, { category, description })
          : createLocalPlaceSuggestionReport(
              groupId,
              suggestion,
              reporter,
              { category, description },
              exampleMode ? "session" : "local",
            );

      let hidden = alreadyHidden;
      let hideFailed = false;
      if (hideAlso && !alreadyHidden && onHide) {
        try {
          await onHide();
          hidden = true;
        } catch {
          hideFailed = true;
        }
      }

      window.dispatchEvent(new Event("matrundan:place-data-reports-changed"));
      onReported?.();
      setOpen(false);
      reset();

      if (hideFailed) {
        toast.warning("Rapporten är skickad, men träffen kunde inte döljas.");
      } else if (!result.created) {
        toast.info(
          hidden
            ? "Du har redan en öppen rapport av den här typen. Träffen är dold för gruppen."
            : "Du har redan en öppen rapport av den här typen.",
        );
      } else {
        toast.success(
          hidden
            ? "Tack! Rapporten går till gruppens admin. Träffen är dold för gruppen."
            : "Tack! Rapporten går till gruppens admin. Träffen visas fortfarande i sökningen.",
        );
      }
      if (hidden && !alreadyHidden && !hideFailed) onHidden?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skicka rapporten.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PlaceSuggestionSignalPanel suggestion={suggestion} disabled={disabled || submitting} />
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
            className="min-h-11 w-full justify-start whitespace-normal px-3 text-left text-muted-foreground"
            disabled={disabled}
          >
            <CircleAlert className="h-4 w-4 shrink-0" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={`${formId}-description`}>
          <DialogHeader>
            <DialogTitle>Rapportera felaktig träff</DialogTitle>
            <DialogDescription id={`${formId}-description`}>
              Rapporten granskas av gruppens admin. Om felet finns i kartdatan kan admin senare
              skicka en anonym anteckning till OpenStreetMap. Gruppens namn, medlemmar och privata
              kommentarer följer aldrig med.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={submit}>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <div className="break-words text-sm font-medium">{suggestion.name}</div>
              <div className="mt-0.5 break-words text-xs text-muted-foreground">
                {[suggestion.address, suggestion.area, suggestion.city].filter(Boolean).join(" · ")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-category`}>Vad verkar vara fel?</Label>
              <select
                id={`${formId}-category`}
                value={category}
                onChange={(event) => changeCategory(event.target.value as PlaceDataReportCategory)}
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
              <Label htmlFor={`${formId}-description-input`}>Vad har du sett?</Label>
              <Textarea
                id={`${formId}-description-input`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                rows={5}
                className="min-h-28 resize-y"
                placeholder="Exempel: Skylten visar att restaurangen har stängt permanent och en ny verksamhet finns på adressen."
              />
              <div className="flex items-start justify-between gap-3 text-[11px] leading-relaxed text-muted-foreground">
                <p>
                  Beskriv en egen observation eller hänvisa till verksamhetens officiella
                  information. Kopiera inte från andra karttjänster.
                </p>
                <span className="shrink-0">{description.length}/1000</span>
              </div>
            </div>

            {canHide && !alreadyHidden && onHide ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={hideAlso}
                    onCheckedChange={(checked) => setHideAlso(checked === true)}
                    disabled={saving}
                    aria-label="Dölj även träffen för gruppen"
                  />
                  <span className="text-sm">
                    Dölj även träffen för gruppen tills det är utrett
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Bara den här gruppen påverkas. Träffen kan återställas när som helst i
                      gruppinställningarna.
                    </span>
                  </span>
                </label>
              </div>
            ) : alreadyHidden ? (
              <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                Träffen är redan dold för den här gruppen. Rapporten ändrar inte andra gruppers
                sökningar.
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={saving || submitting || description.trim().length < 10}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Skicka rapport
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
