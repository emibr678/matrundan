import type { PlaceSymbolSource } from "@/lib/matrundan/place-symbol";
import { resolveAutomaticPlaceSymbol } from "@/lib/matrundan/place-symbol";
import { PLACE_SYMBOL_OPTIONS } from "@/lib/matrundan/place-symbol-options";

export function PlaceSymbolPicker({
  source,
  value,
  onChange,
  disabled = false,
}: {
  source: PlaceSymbolSource;
  value: string | null;
  onChange: (symbol: string | null) => void;
  disabled?: boolean;
}) {
  const automaticSymbol = resolveAutomaticPlaceSymbol(source);

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="sr-only">Symbol för stället</legend>
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value == null}
        className={[
          "flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          value == null ? "border-primary bg-primary/10" : "border-border/70 hover:bg-muted",
        ].join(" ")}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
          {automaticSymbol}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">Automatisk</span>
          <span className="block text-xs text-muted-foreground">
            Utifrån typ, kök och inriktning
          </span>
        </span>
      </button>

      <div className="flex min-w-0 flex-wrap gap-2">
        {PLACE_SYMBOL_OPTIONS.map((option) => {
          const selected = value === option.symbol;
          return (
            <button
              key={option.symbol}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={selected}
              onClick={() => onChange(option.symbol)}
              className={[
                "grid h-11 w-11 place-items-center rounded-xl border text-2xl transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/70 hover:bg-muted",
              ].join(" ")}
            >
              <span aria-hidden="true">{option.symbol}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
