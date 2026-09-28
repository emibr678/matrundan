import * as React from "react";

export interface GroupSymbolOption {
  symbol: string;
  label: string;
}

export const GROUP_SYMBOL_OPTIONS = [
  { symbol: "🍽️", label: "Tallrik och bestick" },
  { symbol: "🍝", label: "Pasta" },
  { symbol: "🍕", label: "Pizza" },
  { symbol: "🍔", label: "Hamburgare" },
  { symbol: "🌮", label: "Taco" },
  { symbol: "🍣", label: "Sushi" },
  { symbol: "🍜", label: "Nudlar" },
  { symbol: "🥟", label: "Dumplings" },
  { symbol: "🥙", label: "Wrap" },
  { symbol: "🍛", label: "Curry" },
  { symbol: "🥘", label: "Gryta" },
  { symbol: "🥗", label: "Sallad" },
  { symbol: "🥐", label: "Croissant" },
  { symbol: "🥖", label: "Bröd" },
  { symbol: "🍰", label: "Tårta" },
  { symbol: "🧁", label: "Cupcake" },
  { symbol: "🍩", label: "Munk" },
  { symbol: "☕", label: "Kaffe" },
  { symbol: "🫖", label: "Te" },
  { symbol: "🥤", label: "Dryck" },
  { symbol: "🍦", label: "Glass" },
  { symbol: "🌶️", label: "Chili" },
  { symbol: "🏡", label: "Hemma" },
  { symbol: "🌆", label: "Stad" },
  { symbol: "⛵", label: "Skärgård" },
  { symbol: "✨", label: "Något extra" },
] as const satisfies readonly GroupSymbolOption[];

function groupSymbolOptionsWithLegacy(
  legacySymbol: string | null | undefined,
): readonly GroupSymbolOption[] {
  const normalizedLegacy = legacySymbol?.trim();
  if (
    !normalizedLegacy ||
    GROUP_SYMBOL_OPTIONS.some((option) => option.symbol === normalizedLegacy)
  ) {
    return GROUP_SYMBOL_OPTIONS;
  }

  return [{ symbol: normalizedLegacy, label: "Nuvarande symbol" }, ...GROUP_SYMBOL_OPTIONS];
}

export function GroupSymbolPicker({
  value,
  onChange,
  legacySymbol,
  legend = "Symbol",
}: {
  value: string;
  onChange: (symbol: string) => void;
  legacySymbol?: string | null;
  legend?: string;
}) {
  const radioName = React.useId();
  const options = groupSymbolOptionsWithLegacy(legacySymbol);

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium leading-none">{legend}</legend>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {options.map((option, index) => {
          const selected = value === option.symbol;
          const inputId = `${radioName}-${index}`;
          const isLegacy =
            !!legacySymbol?.trim() &&
            option.symbol === legacySymbol.trim() &&
            !GROUP_SYMBOL_OPTIONS.some((candidate) => candidate.symbol === option.symbol);

          return (
            <label
              key={option.symbol}
              htmlFor={inputId}
              title={isLegacy ? "Nuvarande symbol" : option.label}
              className={[
                "grid h-10 w-10 cursor-pointer place-items-center rounded-xl border text-xl transition",
                "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                selected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/70 hover:bg-muted",
              ].join(" ")}
            >
              <input
                id={inputId}
                name={radioName}
                type="radio"
                value={option.symbol}
                checked={selected}
                onChange={() => onChange(option.symbol)}
                className="sr-only"
                aria-label={isLegacy ? `Behåll nuvarande symbol ${option.symbol}` : option.label}
              />
              <span aria-hidden="true">{option.symbol}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
