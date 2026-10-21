// TEMPORARY RESEARCH ONLY. Second, comparative Geoapify study; never merge.
// 6 independent 2 km circles × 18 strategies = 108 initial comparisons.
// Maximum 150 NEW requests (including a one-result smoke) and 750 reserved credits;
// up to 41 paginated continuations. No external request on page load or build.
const areas = [
  {
    "id": "sodermalm",
    "label": "Södermalm – punktcentrum",
    "lat": 59.3143,
    "lon": 18.0732,
    "radius": 2000
  },
  {
    "id": "enskede",
    "label": "Enskede – punktcentrum",
    "lat": 59.284,
    "lon": 18.087,
    "radius": 2000
  },
  {
    "id": "goteborg",
    "label": "Göteborg – Järntorget",
    "lat": 57.6998,
    "lon": 11.9523,
    "radius": 2000
  },
  {
    "id": "malmo",
    "label": "Malmö – Triangeln",
    "lat": 55.5955,
    "lon": 13.0014,
    "radius": 2000
  },
  {
    "id": "uppsala",
    "label": "Uppsala – Stora torget",
    "lat": 59.8581,
    "lon": 17.6386,
    "radius": 2000
  },
  {
    "id": "varnamo",
    "label": "Värnamo – centrum",
    "lat": 57.186,
    "lon": 14.041,
    "radius": 2000
  }
] as const;
const strategies = [
  {
    "strategy": "asian",
    "categories": [
      "catering.restaurant.asian"
    ],
    "conditions": []
  },
  {
    "strategy": "asian_east_southeast",
    "categories": [
      "catering.restaurant.asian",
      "catering.restaurant.chinese",
      "catering.restaurant.japanese",
      "catering.restaurant.korean",
      "catering.restaurant.thai",
      "catering.restaurant.vietnamese",
      "catering.restaurant.taiwanese",
      "catering.restaurant.indonesian",
      "catering.restaurant.malaysian",
      "catering.restaurant.malay",
      "catering.restaurant.filipino"
    ],
    "conditions": []
  },
  {
    "strategy": "middle_east_provisional",
    "categories": [
      "catering.restaurant.arab",
      "catering.restaurant.lebanese",
      "catering.restaurant.syrian",
      "catering.restaurant.turkish",
      "catering.restaurant.persian"
    ],
    "conditions": []
  },
  {
    "strategy": "restaurant",
    "categories": [
      "catering.restaurant"
    ],
    "conditions": []
  },
  {
    "strategy": "italian",
    "categories": [
      "catering.restaurant.italian"
    ],
    "conditions": []
  },
  {
    "strategy": "swedish",
    "categories": [
      "catering.restaurant.swedish"
    ],
    "conditions": []
  },
  {
    "strategy": "regional",
    "categories": [
      "catering.restaurant.regional"
    ],
    "conditions": []
  },
  {
    "strategy": "cafe",
    "categories": [
      "catering.cafe"
    ],
    "conditions": []
  },
  {
    "strategy": "cafe_bakery",
    "categories": [
      "catering.cafe",
      "commercial.food_and_drink.bakery"
    ],
    "conditions": []
  },
  {
    "strategy": "bakery",
    "categories": [
      "commercial.food_and_drink.bakery"
    ],
    "conditions": []
  },
  {
    "strategy": "kebab",
    "categories": [
      "catering.restaurant.kebab",
      "catering.fast_food.kebab"
    ],
    "conditions": []
  },
  {
    "strategy": "dumplings",
    "categories": [
      "catering.restaurant.dumpling"
    ],
    "conditions": []
  },
  {
    "strategy": "vegetarian",
    "categories": [
      "catering.restaurant",
      "catering.fast_food",
      "catering.cafe"
    ],
    "conditions": [
      "vegetarian"
    ]
  },
  {
    "strategy": "vegan",
    "categories": [
      "catering.restaurant",
      "catering.fast_food",
      "catering.cafe"
    ],
    "conditions": [
      "vegan"
    ]
  },
  {
    "strategy": "japanese",
    "categories": [
      "catering.restaurant.japanese"
    ],
    "conditions": []
  },
  {
    "strategy": "thai",
    "categories": [
      "catering.restaurant.thai"
    ],
    "conditions": []
  },
  {
    "strategy": "indian",
    "categories": [
      "catering.restaurant.indian"
    ],
    "conditions": []
  },
  {
    "strategy": "lebanese",
    "categories": [
      "catering.restaurant.lebanese"
    ],
    "conditions": []
  }
] as const;
export const PROBE_JOBS = areas.flatMap((area) =>
  strategies.map((strategy) => ({ ...strategy, area, id: `${area.id}/${strategy.strategy}` })),
);
