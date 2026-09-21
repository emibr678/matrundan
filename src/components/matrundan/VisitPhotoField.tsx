import * as React from "react";
import { ImagePlus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function VisitPhotoField({
  file,
  onFileChange,
  existingUrl,
  disabled = false,
  showLabel = true,
  showHelpText = true,
  compact = false,
  allowRemoveExisting = false,
  removeExisting = false,
  onRemoveExistingChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  existingUrl?: string;
  disabled?: boolean;
  showLabel?: boolean;
  showHelpText?: boolean;
  compact?: boolean;
  allowRemoveExisting?: boolean;
  removeExisting?: boolean;
  onRemoveExistingChange?: (remove: boolean) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const shownUrl = previewUrl ?? (removeExisting ? undefined : existingUrl);

  if (compact) {
    return (
      <div className="space-y-2">
        {showLabel || showHelpText ? (
          <div>
            {showLabel ? <Label htmlFor={inputId}>Bild från besöket (frivilligt)</Label> : null}
            {showHelpText ? (
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Lägg till eller byt din bild från besöket. Bilden komprimeras innan den sparas.
              </p>
            ) : null}
          </div>
        ) : null}

        {removeExisting && existingUrl && !file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Bilden tas bort när du sparar</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Omdömet påverkas inte.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs"
              disabled={disabled}
              onClick={() => onRemoveExistingChange?.(false)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ångra
            </Button>
          </div>
        ) : shownUrl ? (
          <div className="relative flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-2">
            <img
              src={shownUrl}
              alt={file ? "Förhandsvisning av vald bild" : "Din bild från besöket"}
              className="h-16 w-20 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{file ? "Ny bild vald" : "Din nuvarande bild"}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {file
                  ? "Sparas tillsammans med dina övriga ändringar."
                  : "Du kan välja en annan bild."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Byt
            </Button>
            {allowRemoveExisting && existingUrl && !file ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -right-2 -top-2 h-8 w-8 rounded-full border border-border bg-background shadow-sm"
                disabled={disabled}
                aria-label="Ta bort bild"
                onClick={() => onRemoveExistingChange?.(true)}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-dashed"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            Lägg till bild
          </Button>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          aria-label="Välj bild från besöket"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            if (nextFile) onRemoveExistingChange?.(false);
            onFileChange(nextFile);
            event.currentTarget.value = "";
          }}
        />

        {file ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 px-2 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={() => onFileChange(null)}
          >
            <X className="h-3.5 w-3.5" />
            Ångra bildbyte
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showLabel || showHelpText ? (
        <div>
          {showLabel ? <Label htmlFor={inputId}>Foto från besöket (frivilligt)</Label> : null}
          {showHelpText ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Bilden beskärs inte, men komprimeras och platsmetadata tas bort innan den sparas.
            </p>
          ) : null}
        </div>
      ) : null}

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
