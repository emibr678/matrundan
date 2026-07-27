import * as React from "react";
import { RotateCcw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FoodTagMultiSelect } from "@/components/matrundan/FoodTagMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

export function PlaceAdminDialog({ place }: { place: Place }) {
  const { activeGroupRole } = useSession();
  const {
    state,
    submitting,
    archivePlace,
    restorePlace,
    updatePlaceMetadata,
    visitsFor,
  } = useStore();
  const canAdmin = activeGroupRole === "owner" || activeGroupRole === "admin";
  const groupArchived = state.group.lifecycleStatus === "archived";
  const placeRemoved = place.collectionStatus === "archived";
  const hasVisits = visitsFor(place.id).length > 0;
  const baseCuisines = place.canonicalCuisines ?? place.cuisines;
  const [open, setOpen] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [category, setCategory] = React.useState<PlaceCategory | "inherit">(
    place.categoryOverride ?? "inherit",
  );
  const [useCuisineOverride, setUseCuisineOverride] = React.useState(
    place.cuisinesOverride != null,
  );
  const [cuisines, setCuisines] = React.useState<string[]>(
    place.cuisinesOverride ?? baseCuisines,
  );
  const [occasions, setOccasions] = React.useState<Occasion[]>(place.occasions);
  const [notes, setNotes] = React.useState(place.notes ?? "");

  React.useEffect(() => {
    if (!open) return;
    setCategory(place.categoryOverride ?? "inherit");
    setUseCuisineOverride(place.cuisinesOverride != null);
    setCuisines(
      place.cuisinesOverride ?? place.canonicalCuisines ?? place.cuisines,
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
        cuisinesOverride: useCuisineOverride ? cuisines : null,
        occasions,
        notes: notes.trim() || null,
      });
      toast.success("Gruppens uppgifter om stället är uppdaterade.");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    }
  }

  async function changeCollectionState(action: "remove" | "restore") {
    try {
      if (action === "remove") await archivePlace(place.id);
      else await restorePlace(place.id);
      toast.success(
        action === "remove"
          ? "Matstället är borttaget från gruppens lista."
          : "Matstället är tillbaka i gruppens lista.",
      );
      setConfirmRemove(false);
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
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Hantera {place.name}</DialogTitle>
            <DialogDescription>
              Ändringarna gäller bara i {state.group.name}. Namn och adress påverkas inte.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-5">
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
                    Återställ till grundkategorin:{" "}
                    {CATEGORY_LABEL[place.canonicalCategory ?? place.category]}
                  </SelectItem>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CATEGORY_LABEL[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-3 rounded-2xl border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="place-cuisine-override"
                  className="min-w-0 font-normal"
                >
                  Anpassa kök och inriktning för {state.group.name}
                </Label>
                <Switch
                  id="place-cuisine-override"
                  checked={useCuisineOverride}
                  onCheckedChange={(checked) => {
                    setUseCuisineOverride(checked);
                    if (checked && cuisines.length === 0) setCuisines(baseCuisines);
                  }}
                />
              </div>
              <FoodTagMultiSelect
                id="place-food-tags"
                value={cuisines}
                onChange={setCuisines}
                disabled={!useCuisineOverride}
                label="Kök och inriktning"
                description={
                  useCuisineOverride
                    ? "Valen gäller bara för den här gruppen."
                    : `Grunduppgifterna används: ${baseCuisines.join(", ") || "inga val"}.`
                }
              />
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
                {placeRemoved ? "Inte längre i gruppens lista" : "I gruppens lista"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {placeRemoved
                  ? "Tidigare besök och omdömen finns kvar i historiken. Lägg tillbaka stället för nya besök och planering."
                  : "Du kan ta bort stället från gruppens lista utan att radera tidigare besök eller omdömen."}
              </p>
              {placeRemoved ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={submitting}
                  onClick={() => void changeCollectionState("restore")}
                >
                  <RotateCcw className="h-4 w-4" /> Lägg tillbaka i gruppen
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 w-full text-destructive hover:text-destructive"
                  disabled={submitting}
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 className="h-4 w-4" /> Ta bort från gruppen
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

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {place.name} från gruppen?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasVisits
                ? "Stället tas bort från gruppens lista. Tidigare besök och omdömen finns kvar i historiken, och du kan lägga till stället igen senare."
                : "Stället tas bort från gruppens lista. Du kan lägga till det igen senare."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void changeCollectionState("remove")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ta bort från gruppen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
