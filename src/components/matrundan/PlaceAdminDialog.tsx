import * as React from "react";
import { Archive, ArchiveRestore, Settings2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import {
  CATEGORY_LABEL,
  OCCASION_LABEL,
  type Occasion,
  type Place,
  type PlaceCategory,
} from "@/lib/matrundan/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as PlaceCategory[];
const OCCASIONS = Object.keys(OCCASION_LABEL) as Occasion[];

function splitCuisines(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(
    0,
    20,
  );
}

export function PlaceAdminDialog({ place }: { place: Place }) {
  const { activeGroupRole } = useSession();
  const {
    state,
    submitting,
    archivePlace,
    restorePlace,
    updatePlaceMetadata,
  } = useStore();
  const canAdmin = activeGroupRole === "owner" || activeGroupRole === "admin";
  const groupArchived = state.group.lifecycleStatus === "archived";
  const placeArchived = place.collectionStatus === "archived";
  const [open, setOpen] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [category, setCategory] = React.useState<PlaceCategory | "inherit">(
    place.categoryOverride ?? "inherit",
  );
  const [useCuisineOverride, setUseCuisineOverride] = React.useState(
    place.cuisinesOverride != null,
  );
  const [cuisines, setCuisines] = React.useState(
    (place.cuisinesOverride ?? place.canonicalCuisines ?? place.cuisines).join(", "),
  );
  const [occasions, setOccasions] = React.useState<Occasion[]>(place.occasions);
  const [notes, setNotes] = React.useState(place.notes ?? "");

  React.useEffect(() => {
    if (!open) return;
    setCategory(place.categoryOverride ?? "inherit");
    setUseCuisineOverride(place.cuisinesOverride != null);
    setCuisines(
      (place.cuisinesOverride ?? place.canonicalCuisines ?? place.cuisines).join(
        ", ",
      ),
    );
    setOccasions(place.occasions);
    setNotes(place.notes ?? "");
  }, [open, place]);

  if (!canAdmin || groupArchived) return null;

  function toggleOccasion(occasion: Occasion) {
    setOccasions((current) =>
      current.includes(occasion)
        ? current.filter((item) => item !== occasion)
        : [...current, occasion],
    );
  }

  async function save() {
    try {
      await updatePlaceMetadata(place.id, {
        categoryOverride: category === "inherit" ? null : category,
        cuisinesOverride: useCuisineOverride ? splitCuisines(cuisines) : null,
        occasions,
        notes: notes.trim() || null,
      });
      toast.success("Gruppens uppgifter om stället är uppdaterade.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    }
  }

  async function changeArchiveState(action: "archive" | "restore") {
    try {
      if (action === "archive") await archivePlace(place.id);
      else await restorePlace(place.id);
      toast.success(
        action === "archive"
          ? "Matstället är arkiverat i gruppen."
          : "Matstället är tillbaka i gruppens aktiva samling.",
      );
      setConfirmArchive(false);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte uppdatera stället.",
      );
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="min-h-11 w-full sm:w-auto">
            <Settings2 className="h-4 w-4" /> Hantera ställe
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hantera {place.name}</DialogTitle>
            <DialogDescription>
              Korrigeringarna gäller bara i {state.group.name}. Namn, adress,
              koordinater och extern platsidentitet förblir kanoniska.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Kategori i gruppen</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as PlaceCategory | "inherit")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">
                    Använd kanonisk: {CATEGORY_LABEL[place.canonicalCategory ?? place.category]}
                  </SelectItem>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CATEGORY_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="place-cuisine-override" className="font-normal">
                  Använd gruppspecifika kökstyper
                </Label>
                <Switch
                  id="place-cuisine-override"
                  checked={useCuisineOverride}
                  onCheckedChange={setUseCuisineOverride}
                />
              </div>
              <Input
                value={cuisines}
                onChange={(event) => setCuisines(event.target.value)}
                disabled={!useCuisineOverride}
                placeholder="t.ex. italienskt, pizza, vegetariskt"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Separera med kommatecken. Avstängt använder kanoniska kökstyper:
                {" "}
                {(place.canonicalCuisines ?? place.cuisines).join(", ") || "inga"}.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Passar för</Label>
              <div className="flex flex-wrap gap-2">
                {OCCASIONS.map((occasion) => {
                  const selected = occasions.includes(occasion);
                  return (
                    <button
                      key={occasion}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleOccasion(occasion)}
                    >
                      <Badge
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer rounded-full px-3 py-1"
                      >
                        {OCCASION_LABEL[occasion]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="place-group-note">Gruppens anteckning</Label>
              <Textarea
                id="place-group-note"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="En privat anteckning för gruppen…"
              />
            </div>

            <div className="rounded-2xl border border-border/70 p-3">
              <div className="font-medium">
                {placeArchived ? "Arkiverat matställe" : "Aktiv samling"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {placeArchived
                  ? "Historik och tidigare besök är bevarade. Återställ stället för att planera eller registrera nya besök."
                  : "Arkivering tar bort stället från den aktiva samlingen men bevarar besök, favoriter, betyg och kommentarer."}
              </p>
              {placeArchived ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={submitting}
                  onClick={() => void changeArchiveState("restore")}
                >
                  <ArchiveRestore className="h-4 w-4" /> Återställ stället
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 w-full text-destructive hover:text-destructive"
                  disabled={submitting}
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive className="h-4 w-4" /> Arkivera stället
                </Button>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button disabled={submitting} onClick={() => void save()}>
              Spara ändringar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivera {place.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Stället försvinner från gruppens aktiva samling. Tidigare besök,
              betyg, kommentarer och favoriter bevaras. Om det är nästa stopp
              rensas det samtidigt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void changeArchiveState("archive")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Arkivera stället
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
