import * as React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/matrundan/store";
import type { Visit } from "@/lib/matrundan/types";
import { VisitPhotoField } from "./VisitPhotoField";

export function VisitPhotoManager({ visit, canManage }: { visit: Visit; canManage: boolean }) {
  const { saveVisitPhoto, deleteVisitPhoto, submitting } = useStore();
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const disabled = busy || submitting;

  if (!canManage && !visit.photo?.url) return null;

  async function save() {
    if (!file || disabled) return;
    setBusy(true);
    try {
      await saveVisitPhoto(visit.id, file);
      setFile(null);
      toast.success(visit.photo ? "Fotot är ersatt." : "Fotot är sparat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara fotot.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (disabled) return;
    setBusy(true);
    try {
      await deleteVisitPhoto(visit.id);
      setFile(null);
      toast.success("Fotot är borttaget.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ta bort fotot.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-medium">Foto från besöket</h3>
      {canManage ? (
        <div className="space-y-3">
          <VisitPhotoField
            file={file}
            onFileChange={setFile}
            existingUrl={visit.photo?.url}
            disabled={disabled}
          />
          {file ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                disabled={disabled}
                onClick={() => setFile(null)}
              >
                Avbryt byte
              </Button>
              <Button type="button" className="min-h-11" disabled={disabled} onClick={save}>
                {disabled ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Spara foto
              </Button>
            </div>
          ) : visit.photo ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={remove}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Ta bort foto
            </Button>
          ) : null}
        </div>
      ) : visit.photo?.url ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
          <img
            src={visit.photo.url}
            alt="Foto från besöket"
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Fotot är privat för den här gruppen och följer inte med om besöket delas vidare.
      </p>
    </section>
  );
}
