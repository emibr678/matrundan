export interface PlaceSymbolOption {
  symbol: string;
  label: string;
}

export const PLACE_SYMBOL_OPTIONS = [
  { symbol: "🍽️", label: "Tallrik och bestick" },
  { symbol: "🍕", label: "Pizza" },
  { symbol: "🍣", label: "Sushi" },
  { symbol: "🍜", label: "Nudlar" },
  { symbol: "🍛", label: "Curry" },
  { symbol: "🍝", label: "Pasta" },
  { symbol: "🍔", label: "Hamburgare" },
  { symbol: "🌮", label: "Taco" },
  { symbol: "🥙", label: "Wrap" },
  { symbol: "🧆", label: "Falafel" },
  { symbol: "🥟", label: "Dumplings" },
  { symbol: "🥗", label: "Sallad" },
  { symbol: "🥘", label: "Gryta" },
  { symbol: "🍲", label: "Soppa" },
  { symbol: "🍤", label: "Skaldjur" },
  { symbol: "🐟", label: "Fisk" },
  { symbol: "🥩", label: "Kött" },
  { symbol: "🌭", label: "Korv" },
  { symbol: "🥐", label: "Bakverk" },
  { symbol: "🍞", label: "Bröd" },
  { symbol: "☕", label: "Kaffe" },
  { symbol: "🍰", label: "Tårta" },
  { symbol: "🍦", label: "Glass" },
  { symbol: "🌿", label: "Vegetariskt" },
  { symbol: "🔥", label: "Grill" },
  { symbol: "🫒", label: "Smårätter" },
] as const satisfies readonly PlaceSymbolOption[];

export function isPlaceSymbolOption(value: string): boolean {
  return PLACE_SYMBOL_OPTIONS.some((option) => option.symbol === value);
}
