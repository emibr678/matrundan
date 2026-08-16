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
      if (visit.id === visits.repeatCafeLatest && visit.photo) {
        return {
          ...visit,
          // Robin har lagt upp bilden. Alex är inloggad owner och ska därför
          // kunna se och moderera den, men inte ersätta den som sin egen.
          photo: { ...visit.photo, uploadedBy: members.robin },
        };
      }

      if (visit.id === visits.guestReviews) {
        const existing = (visit.visibleReviews ?? []).filter(
          (review) => review.userId !== members.alex,
        );
        const participants = [...(visit.participants ?? [])];
        if (!participants.some((participant) => participant.id === members.noor)) {
          participants.splice(Math.max(0, participants.length - 1), 0, {
            id: members.noor,
            name: "Noor",
            avatar: "🐿️",
            avatarImage: null,
            status: "active",
          });
        }

        return {
          ...visit,
          participantIds: [...new Set([...visit.participantIds, members.noor])],
          participants,
          currentUserParticipationStatus: "participant",
          // Alex deltog men har ännu inte lämnat eget omdöme. Sam, Kim och Noor
          // gör 3-av-4-läget explicit så den kompakta flerpersons-UX:en kan granskas.
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
            {
              id: "review-v2-noor",
              userId: members.noor,
              overall: 5,
              taste: 5,
              value: 4,
              service: 5,
              // Kommentaren finns kanoniskt men är dold i den här gruppkontexten.
              // Exempelvyn ska därför visa Noors betyg, aldrig den här texten.
              comment: "Den här dolda kommentaren får inte visas i exempelgruppen.",
              ratingVisible: true,
              commentVisible: false,
            },
          ],
        };
      }

      if (visit.id === visits.providerBistroFirst) {
        return {
          ...visit,
          // Ett explicit nolläge: ett kanoniskt omdöme finns men är inte synligt
          // i gruppen. Demo-normaliseringen fabricerar då inget registreraromdöme.
          visibleReviews: [
            {
              id: "review-v4-robin-hidden",
              userId: members.robin,
              overall: 4,
              taste: 4,
              value: 4,
              service: 4,
              comment: "Dold fixturetext som inte ska visas i gruppen.",
              ratingVisible: false,
              commentVisible: false,
            },
          ],
        };
      }

      if (visit.id === visits.archivedHistory) {
        return {
          ...visit,
          participantIds: [
            ...new Set([
              ...visit.participantIds.filter((id) => id !== members.alex),
              visit.createdBy,
            ]),
          ],
          participants: visit.participants
            ? [
                ...visit.participants.filter((participant) => participant.id !== members.alex),
                ...(visit.participants.some((participant) => participant.id === visit.createdBy)
                  ? []
                  : [
                      {
                        id: visit.createdBy,
                        name: "Sam",
                        avatar: "🐻",
                        avatarImage: null,
                        status: "active" as const,
                      },
                    ]),
              ]
            : undefined,
          currentUserParticipationStatus: "declined",
          // Sam registrerade och deltog. Alex är den separata deltagare som senare
          // självkorrigerat sin närvaro; registreraren ligger kvar som deltagare.
          visibleReviews: [
            {
              id: "review-v5-sam",
              userId: visit.createdBy,
              overall: 5,
              taste: 5,
              value: 4,
              service: 4,
              comment: "Tidigt, varmt bröd och nästan ingen kö.",
              ratingVisible: true,
              commentVisible: true,
            },
            {
              id: "review-v5-kim",
              userId: members.kim,
              overall: 5,
              taste: 5,
              value: 4,
              service: 4,
              comment: "Bra frukoststopp för gänget.",
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
