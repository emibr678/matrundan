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

function defineFoodTag(
  id: string,
  label: string,
  group: FoodTagGroup,
  aliases: string[],
): FoodTagDefinition {
  return { id, label, group, aliases };
}

export const FOOD_TAGS: FoodTagDefinition[] = [
  defineFoodTag("cuisine:swedish", "Svenskt/nordiskt", "cuisine", [
    "swedish",
    "scandinavian",
    "nordic",
    "svenskt",
    "nordiskt",
    "husmanskost",
  ]),
  defineFoodTag("cuisine:italian", "Italienskt", "cuisine", ["italian", "italienskt"]),
  defineFoodTag("cuisine:japanese", "Japanskt", "cuisine", [
    "japanese",
    "japanskt",
    "izakaya",
  ]),
  defineFoodTag("cuisine:korean", "Koreanskt", "cuisine", ["korean", "koreanskt"]),
  defineFoodTag("cuisine:chinese", "Kinesiskt", "cuisine", ["chinese", "kinesiskt"]),
  defineFoodTag("cuisine:thai", "Thailändskt", "cuisine", ["thai", "thailändskt"]),
  defineFoodTag("cuisine:vietnamese", "Vietnamesiskt", "cuisine", [
    "vietnamese",
    "vietnamesiskt",
  ]),
  defineFoodTag("cuisine:indian", "Indiskt", "cuisine", ["indian", "indiskt"]),
  defineFoodTag("cuisine:middle-eastern", "Mellanöstern", "cuisine", [
    "middle_eastern",
    "middle eastern",
    "lebanese",
    "arab",
    "arabic",
    "turkish",
    "mellanöstern",
    "libanesiskt",
    "turkiskt",
  ]),
  defineFoodTag("cuisine:mexican-latin", "Mexikanskt/latinamerikanskt", "cuisine", [
    "mexican",
    "latin_american",
    "latin american",
    "mexikanskt",
    "latinamerikanskt",
  ]),
  defineFoodTag("cuisine:mediterranean", "Medelhavsmat", "cuisine", [
    "mediterranean",
    "medelhavsmat",
  ]),
  defineFoodTag("cuisine:greek", "Grekiskt", "cuisine", ["greek", "grekiskt"]),
  defineFoodTag("cuisine:french", "Franskt", "cuisine", ["french", "franskt"]),
  defineFoodTag("cuisine:spanish", "Spanskt", "cuisine", ["spanish", "spanskt"]),
  defineFoodTag("cuisine:american", "Amerikanskt", "cuisine", [
    "american",
    "amerikanskt",
  ]),
  defineFoodTag("cuisine:persian", "Persiskt", "cuisine", [
    "persian",
    "persiskt",
    "iranian",
  ]),
  defineFoodTag("cuisine:international", "Internationellt", "cuisine", [
    "international",
    "internationellt",
  ]),
  defineFoodTag("cuisine:vegetarian-vegan", "Vegetariskt/veganskt", "cuisine", [
    "vegetarian",
    "vegan",
    "vegetariskt",
    "veganskt",
    "vegetariskt/veganskt",
  ]),
  defineFoodTag("specialty:sushi", "Sushi", "specialty", ["sushi"]),
  defineFoodTag("specialty:ramen", "Ramen", "specialty", ["ramen"]),
  defineFoodTag("specialty:pizza", "Pizza", "specialty", ["pizza", "pizzeria"]),
  defineFoodTag("specialty:burger", "Burgare", "specialty", [
    "burger",
    "burgers",
    "burgare",
  ]),
  defineFoodTag("specialty:grill", "Grillat", "specialty", [
    "grill",
    "grilled",
    "barbecue",
    "bbq",
    "grillat",
  ]),
  defineFoodTag("specialty:tapas", "Tapas", "specialty", ["tapas"]),
  defineFoodTag("specialty:seafood", "Fisk och skaldjur", "specialty", [
    "seafood",
    "fish",
    "fisk",
    "skaldjur",
    "fisk och skaldjur",
  ]),
  defineFoodTag("specialty:bowl", "Bowl", "specialty", ["bowl", "poke", "poke_bowl"]),
  defineFoodTag("specialty:pasta", "Pasta", "specialty", ["pasta"]),
  defineFoodTag("specialty:falafel", "Falafel", "specialty", ["falafel"]),
  defineFoodTag("specialty:street-food", "Street food", "specialty", [
    "street_food",
    "street food",
  ]),
  defineFoodTag("specialty:home-style", "Husmanskost", "specialty", [
    "home_cooking",
    "home cooking",
    "husmanskost",
  ]),
  defineFoodTag("specialty:small-plates", "Smårätter", "specialty", [
    "small_plates",
    "small plates",
    "smårätter",
    "izakaya",
  ]),
  defineFoodTag("specialty:pub-food", "Pubmat", "specialty", [
    "pub_food",
    "pub food",
    "pubmat",
  ]),
  defineFoodTag("specialty:fika", "Fika", "specialty", ["fika"]),
  defineFoodTag("specialty:coffee", "Kaffe", "specialty", ["coffee", "kaffe"]),
  defineFoodTag("specialty:pastries", "Bakverk", "specialty", [
    "pastry",
    "pastries",
    "bakverk",
  ]),
  defineFoodTag("specialty:sourdough", "Surdeg", "specialty", ["sourdough", "surdeg"]),
  defineFoodTag("specialty:danish-pastry", "Wienerbröd", "specialty", [
    "danish",
    "danish_pastry",
    "wienerbröd",
  ]),
];

function key(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("sv-SE")
    .replace(/[–—-]+/g, "_")
    .replace(/\s+/g, "_");
}

const BY_KEY = new Map<string, FoodTagDefinition[]>();

function register(value: string, tag: FoodTagDefinition) {
  const normalizedKey = key(value);
  const current = BY_KEY.get(normalizedKey) ?? [];
  if (!current.some((candidate) => candidate.id === tag.id)) {
    BY_KEY.set(normalizedKey, [...current, tag]);
  }
}

for (const tag of FOOD_TAGS) {
  register(tag.id, tag);
  register(tag.label, tag);
  for (const alias of tag.aliases) register(alias, tag);
}

export function findFoodTags(value: string): FoodTagDefinition[] {
  return BY_KEY.get(key(value)) ?? [];
}

export function findFoodTag(value: string): FoodTagDefinition | undefined {
  return findFoodTags(value)[0];
}

export function normalizeFoodTags(values: readonly string[], preserveUnknown = true): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  function add(label: string) {
    const normalizedKey = key(label);
    if (seen.has(normalizedKey)) return;
    seen.add(normalizedKey);
    result.push(label);
  }

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const matches = findFoodTags(trimmed);
    if (matches.length > 0) {
      for (const match of matches) add(match.label);
    } else if (preserveUnknown) {
      add(trimmed);
    }
  }

  return result;
}

export function foodTagSearchValue(tag: FoodTagDefinition): string {
  return [tag.label, tag.id, ...tag.aliases].join(" ");
}
