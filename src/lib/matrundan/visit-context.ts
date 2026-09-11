import type { Visit, VisitMeal } from "./types";

/** Nya besök kan bara använda dessa tillfällen. `kväll` är legacy och visas bara historiskt. */
export const VISIT_MEALS = [
  "frukost",
  "lunch",
  "fika",
  "middag",
  "dryck",
] as const satisfies readonly VisitMeal[];

export const VISIT_MEAL_LABEL: Record<VisitMeal, string> = {
  frukost: "Frukost",
  lunch: "Lunch",
  fika: "Fika",
  middag: "Middag",
  dryck: "Något att dricka",
  kväll: "Kväll",
};

export function visitMealLabel(meal: VisitMeal | string): string {
  return VISIT_MEAL_LABEL[meal as VisitMeal] ?? meal;
}

/**
 * På plats är implicit normalfall. Hämtmat läggs därför bara till när markeringen
 * faktiskt finns på det kanoniska besöket.
 */
export function formatVisitContext(visit: Pick<Visit, "meal" | "isTakeaway">): string {
  const meal = visitMealLabel(visit.meal);
  return visit.isTakeaway ? `${meal} · Hämtmat` : meal;
}
