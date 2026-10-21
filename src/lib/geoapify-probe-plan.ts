// TEMPORARY RESEARCH ONLY. Fixed matrix from the approved read-only plan.
const areas = [{"id": "sodermalm", "label": "Södermalm – punktcentrum", "lat": 59.3143, "lon": 18.0732, "radius": 2000}, {"id": "enskede", "label": "Enskede – punktcentrum", "lat": 59.284, "lon": 18.087, "radius": 2000}, {"id": "varnamo", "label": "Värnamo – punktcentrum", "lat": 57.186, "lon": 14.041, "radius": 2000}] as const;
const strategies = [
  {"strategy": "asian", "categories": ["catering.restaurant.asian"], "conditions": []},
  {"strategy": "asian_east_southeast", "categories": ["catering.restaurant.asian", "catering.restaurant.chinese", "catering.restaurant.japanese", "catering.restaurant.korean", "catering.restaurant.thai", "catering.restaurant.vietnamese", "catering.restaurant.taiwanese", "catering.restaurant.indonesian", "catering.restaurant.malaysian", "catering.restaurant.malay", "catering.restaurant.filipino"], "conditions": []},
  {"strategy": "middle_east_provisional", "categories": ["catering.restaurant.arab", "catering.restaurant.lebanese", "catering.restaurant.syrian", "catering.restaurant.turkish", "catering.restaurant.persian"], "conditions": []},
  {"strategy": "restaurant", "categories": ["catering.restaurant"], "conditions": []},
  {"strategy": "italian", "categories": ["catering.restaurant.italian"], "conditions": []},
  {"strategy": "swedish", "categories": ["catering.restaurant.swedish"], "conditions": []},
  {"strategy": "regional", "categories": ["catering.restaurant.regional"], "conditions": []},
  {"strategy": "cafe", "categories": ["catering.cafe"], "conditions": []},
  {"strategy": "cafe_bakery", "categories": ["catering.cafe", "commercial.food_and_drink.bakery"], "conditions": []},
  {"strategy": "kebab", "categories": ["catering.restaurant.kebab", "catering.fast_food.kebab"], "conditions": []},
  {"strategy": "dumplings", "categories": ["catering.restaurant.dumpling"], "conditions": []},
  {"strategy": "vegetarian", "categories": ["catering.restaurant", "catering.fast_food", "catering.cafe"], "conditions": ["vegetarian"]},
  {"strategy": "vegan", "categories": ["catering.restaurant", "catering.fast_food", "catering.cafe"], "conditions": ["vegan"]},
  {"strategy": "arab", "categories": ["catering.restaurant.arab"], "conditions": []},
  {"strategy": "bakery", "categories": ["commercial.food_and_drink.bakery"], "conditions": []},
  {"strategy": "restaurant_plus_italian", "categories": ["catering.restaurant", "catering.restaurant.italian"], "conditions": []}
] as const;
export const PROBE_JOBS = [
  ...areas.flatMap((area) => strategies.map((strategy) => ({ ...strategy, area, id: `${area.id}/${strategy.strategy}` }))),
  { area: areas[0], id: "sodermalm/japanese", strategy: "japanese", categories: ["catering.restaurant.japanese"], conditions: [] },
  { area: areas[0], id: "sodermalm/thai", strategy: "thai", categories: ["catering.restaurant.thai"], conditions: [] },
] as const;
