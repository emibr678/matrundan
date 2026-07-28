import * as React from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function VisitPhotoField({
  file,
  onFileChange,
  existingUrl,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const shownUrl = previewUrl ?? existingUrl;

  return (
    <div className="space-y-2">
      <div>
        <Label htmlFor={inputId}>Foto från besöket (frivilligt)</Label>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Bilden beskärs inte, men komprimeras och platsmetadata tas bort innan den sparas.
        </p>
      </div>

      {shownUrl ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
          <img
            src={shownUrl}
            alt={file ? "Förhandsvisning av valt besöksfoto" : "Foto från besöket"}
            className="aspect-[4/3] w-full object-cover"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus className="h-6 w-6" />
          Lägg till ett minne från besöket
        </button>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        aria-label="Välj foto från besöket"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {shownUrl ? <RotateCcw className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
          {shownUrl ? "Välj en annan bild" : "Välj foto"}
        </Button>
        {file ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 flex-1 sm:flex-none"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X className="h-4 w-4" /> Ta bort valt foto
          </Button>
        ) : null}
      </div>
    </div>
  );
}
