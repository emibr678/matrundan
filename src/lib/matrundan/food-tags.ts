export type FoodTagGroup = "cuisine" | "specialty";

export interface FoodTagDefinition {
  id: string;
  label: string;
  group: FoodTagGroup;
  aliases: string[];
}

export const FOOD_TAG_GROUP_LABEL: Record<FoodTagGroup, string> = {
  cuisine: "Kök",
  specialty: "Inriktning",
};

export const FOOD_TAGS: FoodTagDefinition[] = [
  { id: "cuisine:swedish", label: "Svenskt/nordiskt", group: "cuisine", aliases: ["swedish", "scandinavian", "nordic", "svenskt", "nordiskt", "husmanskost"] },
  { id: "cuisine:italian", label: "Italienskt", group: "cuisine", aliases: ["italian", "italienskt"] },
  { id: "cuisine:japanese", label: "Japanskt", group: "cuisine", aliases: ["japanese", "japanskt", "izakaya"] },
  { id: "cuisine:korean", label: "Koreanskt", group: "cuisine", aliases: ["korean", "koreanskt"] },
  { id: "cuisine:chinese", label: "Kinesiskt", group: "cuisine", aliases: ["chinese", "kinesiskt"] },
  { id: "cuisine:thai", label: "Thailändskt", group: "cuisine", aliases: ["thai", "thailändskt"] },
  { id: "cuisine:vietnamese", label: "Vietnamesiskt", group: "cuisine", aliases: ["vietnamese", "vietnamesiskt"] },
  { id: "cuisine:indian", label: "Indiskt", group: "cuisine", aliases: ["indian", "indiskt"] },
  { id: "cuisine:middle-eastern", label: "Mellanöstern", group: "cuisine", aliases: ["middle_eastern", "middle eastern", "lebanese", "arab", "arabic", "turkish", "mellanöstern", "libanesiskt", "turkiskt"] },
  { id: "cuisine:mexican-latin", label: "Mexikanskt/latinamerikanskt", group: "cuisine", aliases: ["mexican", "latin_american", "latin american", "mexikanskt", "latinamerikanskt"] },
  { id: "cuisine:mediterranean", label: "Medelhavsmat", group: "cuisine", aliases: ["mediterranean", "medelhavsmat"] },
  { id: "cuisine:greek", label: "Grekiskt", group: "cuisine", aliases: ["greek", "grekiskt"] },
  { id: "cuisine:french", label: "Franskt", group: "cuisine", aliases: ["french", "franskt"] },
  { id: "cuisine:spanish", label: "Spanskt", group: "cuisine", aliases: ["spanish", "spanskt"] },
  { id: "cuisine:american", label: "Amerikanskt", group: "cuisine", aliases: ["american", "amerikanskt"] },
  { id: "cuisine:persian", label: "Persiskt", group: "cuisine", aliases: ["persian", "persiskt", "iranian"] },
  { id: "cuisine:international", label: "Internationellt", group: "cuisine", aliases: ["international", "internationellt"] },
  { id: "cuisine:vegetarian-vegan", label: "Vegetariskt/veganskt", group: "cuisine", aliases: ["vegetarian", "vegan", "vegetariskt", "veganskt", "vegetariskt/veganskt"] },
  { id: "specialty:sushi", label: "Sushi", group: "specialty", aliases: ["sushi"] },
  { id: "specialty:ramen", label: "Ramen", group: "specialty", aliases: ["ramen"] },
  { id: "specialty:pizza", label: "Pizza", group: "specialty", aliases: ["pizza", "pizzeria"] },
  { id: "specialty:burger", label: "Burgare", group: "specialty", aliases: ["burger", "burgers", "burgare"] },
  { id: "specialty:grill", label: "Grillat", group: "specialty", aliases: ["grill", "grilled", "barbecue", "bbq", "grillat"] },
  { id: "specialty:tapas", label: "Tapas", group: "specialty", aliases: ["tapas"] },
  { id: "specialty:seafood", label: "Fisk och skaldjur", group: "specialty", aliases: ["seafood", "fish", "fisk", "skaldjur", "fisk och skaldjur"] },
  { id: "specialty:bowl", label: "Bowl", group: "specialty", aliases: ["bowl", "poke", "poke_bowl"] },
  { id: "specialty:pasta", label: "Pasta", group: "specialty", aliases: ["pasta"] },
  { id: "specialty:falafel", label: "Falafel", group: "specialty", aliases: ["falafel"] },
  { id: "specialty:street-food", label: "Street food", group: "specialty", aliases: ["street_food", "street food"] },
  { id: "specialty:home-style", label: "Husmanskost", group: "specialty", aliases: ["home_cooking", "home cooking", "husmanskost"] },
  { id: "specialty:small-plates", label: "Smårätter", group: "specialty", aliases: ["small_plates", "small plates", "smårätter", "izakaya"] },
  { id: "specialty:pub-food", label: "Pubmat", group: "specialty", aliases: ["pub_food", "pub food", "pubmat"] },
  { id: "specialty:fika", label: "Fika", group: "specialty", aliases: ["fika"] },
  { id: "specialty:coffee", label: "Kaffe", group: "specialty", aliases: ["coffee", "kaffe"] },
  { id: "specialty:pastries", label: "Bakverk", group: "specialty", aliases: ["pastry", "pastries", "bakverk"] },
  { id: "specialty:sourdough", label: "Surdeg", group: "specialty", aliases: ["sourdough", "surdeg"] },
  { id: "specialty:danish-pastry", label: "Wienerbröd", group: "specialty", aliases: ["danish", "danish_pastry", "wienerbröd"] },
];

function key(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("sv-SE")
    .replace(/[–—-]+/g, "_")
    .replace(/\s+/g, "_");
}

const BY_KEY = new Map<string, FoodTagDefinition>();
for (const tag of FOOD_TAGS) {
  BY_KEY.set(key(tag.id), tag);
  BY_KEY.set(key(tag.label), tag);
  for (const alias of tag.aliases) BY_KEY.set(key(alias), tag);
}

export function findFoodTag(value: string): FoodTagDefinition | undefined {
  return BY_KEY.get(key(value));
}

export function normalizeFoodTags(values: readonly string[], preserveUnknown = true): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const normalized = findFoodTag(trimmed)?.label ?? (preserveUnknown ? trimmed : undefined);
    if (!normalized) continue;
    const normalizedKey = key(normalized);
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    result.push(normalized);
  }
  return result;
}

export function foodTagSearchValue(tag: FoodTagDefinition): string {
  return [tag.label, tag.id, ...tag.aliases].join(" ");
}
