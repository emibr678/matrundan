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

function withVisitParticipationScenarios(state: AppState): AppState {
  const { members, visits } = EXAMPLE_IDS;
  return {
    ...state,
    visits: state.visits.map((visit) => {
      if (visit.id === visits.guestReviews) {
        const existing = (visit.visibleReviews ?? []).filter(
          (review) => review.userId !== members.alex,
        );
        return {
          ...visit,
          currentUserParticipationStatus: "participant",
          // Alex deltog men har ännu inte lämnat ett eget omdöme. Sam och Kim
          // håller kvar scenariot med flera synliga omdömen utan att Alex får en review.
          visibleReviews: [
            ...existing,
            {
              id: "review-v2-kim",
              userId: members.kim,
              overall: 4,
              taste: 4,
              value: 4,
              service: 4,
              comment: "Bra kväll för ett gemensamt stopp och lätt att dela maten.",
              ratingVisible: true,
              commentVisible: true,
            },
          ],
        };
      }

      if (visit.id === visits.archivedHistory) {
        return {
          ...visit,
          participantIds: visit.participantIds.filter((id) => id !== members.alex),
          participants: visit.participants?.filter(
            (participant) => participant.id !== members.alex,
          ),
          currentUserParticipationStatus: "declined",
          // Besöket registrerades av Sam, som inte själv deltog. Kims omdöme
          // gör scenariot explicit och förhindrar äldre demo-normalisering från
          // att fabricera ett registreraromdöme.
          visibleReviews: [
            {
              id: "review-v5-kim",
              userId: members.kim,
              overall: 5,
              taste: 5,
              value: 4,
              service: 4,
              comment: "Tidigt, varmt bröd och nästan ingen kö.",
              ratingVisible: true,
              commentVisible: true,
            },
          ],
        };
      }

      return visit;
    }),
  };
}

export function buildExampleState(now = new Date()) {
  return withVisitParticipationScenarios(withBoundarySearchScenario(buildBaseExampleState(now)));
}

export const EXAMPLE_STATE = buildExampleState(new Date(EXAMPLE_FIXTURE_REFERENCE_TIME));

export function createExampleState(now = new Date()) {
  return buildExampleState(now);
}

export { EXAMPLE_IDS };
