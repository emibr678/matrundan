import { demoBoundaryForPlaceId } from "./demo-location-suggestions";
import { buildExampleState as buildBaseExampleState, EXAMPLE_IDS } from "./example-scenarios";
import type { AppState } from "./types";

/**
 * Fast referensfixture för enhets- och domäntester som behöver stabila datum.
 * Den publika exempelgruppen använder createExampleState() vid sessionsstart.
 */
export const EXAMPLE_FIXTURE_REFERENCE_TIME = "2026-08-06T07:00:00.000Z";

function withBoundarySearchScenario(state: AppState): AppState {
  const varmdoBoundary = demoBoundaryForPlaceId("demo-location-varmdo-kommun");
  if (!varmdoBoundary) throw new Error("Exempelgruppens Värmdö-boundary saknas.");

  return {
    ...state,
    group: {
      ...state.group,
      searchAreas: [
        {
          id: "example-search-area-varmdo-boundary",
          label: "Värmdö kommun, Stockholms län",
          lat: 59.316,
          lng: 18.52,
          provider: "demo",
          placeId: "demo-location-varmdo-kommun",
          searchMode: "boundary",
          resultType: "municipality",
          boundary: varmdoBoundary,
        },
        {
          id: "example-search-area-skargardsvagen-point",
          label: "Skärgårdsvägen 8, Gustavsberg",
          lat: 59.3264,
          lng: 18.3895,
          provider: "demo",
          placeId: "demo-location-skargardsvagen-8",
          searchMode: "point",
          resultType: "building",
        },
      ],
      defaultSearchRadiusKm: 2,
    },
  };
}

export function buildExampleState(now = new Date()) {
  return withBoundarySearchScenario(buildBaseExampleState(now));
}

export const EXAMPLE_STATE = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));

export function createExampleState(now = new Date()) {
  return buildExampleState(now);
}

export { EXAMPLE_IDS };
