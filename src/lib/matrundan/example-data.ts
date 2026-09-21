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
  const { members, places, visits } = EXAMPLE_IDS;
  return {
    ...state,
    places: state.places.map((place) =>
      place.id === places.longLayout
        ? {
            ...place,
            // Ett avsiktligt #307-fall: första besöksregistreringen ska börja
            // med den separata Passar för-grinden innan själva besöksdialogen.
            occasions: [],
          }
        : place,
    ),
    visits: state.visits.map((visit) => {
      if (visit.id === visits.repeatCafeLatest) {
        return {
          ...visit,
          currentUserParticipationStatus: "participant",
          // Nya besök följer #169-invarianten: registreraren är faktisk deltagare
          // och har redan lämnat sitt eget omdöme i registreringsflödet.
          // Det framträdande återbesöket använder den aktuella fyrdimensionella
          // modellen eftersom stället även passar för Avslappnat. Äldre
          // specialfall ska inte vara det första användaren möter i exempelgruppen.
          overall: 4.75,
          taste: 5,
          value: 4.5,
          service: 5,
          atmosphere: 4.5,
          visibleReviews: [
            {
              id: "review-v1-alex",
              userId: members.alex,
              overall: 5,
              taste: 5,
              value: 5,
              service: 5,
              atmosphere: 5,
              reviewModel: "food_v1_atmosphere",
              comment: "En lugn fredagsfika och en riktigt bra kardemummabulle.",
              ratingVisible: true,
              commentVisible: true,
            },
            {
              id: "review-v1-robin",
              userId: members.robin,
              overall: 4.5,
              taste: 5,
              value: 4,
              service: 5,
              atmosphere: 4,
              reviewModel: "food_v1_atmosphere",
              comment: "Kardemummabullen var värd omvägen – fortfarande varm när vi fick den.",
              ratingVisible: true,
              commentVisible: true,
            },
          ],
          // Besöket har en bild från Robin och en från Alex. Alex är inloggad
          // owner men äger bara sin egen bild; Robins kan endast modereras.
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
          // Den historiska tredimensionella modellen ger 3,67, 4,00 och 4,67.
          // Aggregatet är snittet av reviewernas egna härledda helhetsbetyg.
          overall: (3.67 + 4 + 4.67) / 3,
          taste: 13 / 3,
          value: 4,
          service: 4,
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
              atmosphere: null,
              reviewModel: "food_v0_3d",
              comment: "Bra kväll för ett gemensamt stopp och lätt att dela maten.",
              ratingVisible: true,
              commentVisible: true,
            },
            {
              id: "review-v2-noor",
              userId: members.noor,
              overall: 4.67,
              taste: 5,
              value: 4,
              service: 5,
              atmosphere: null,
              reviewModel: "food_v0_3d",
              // Kommentaren finns kanoniskt men är dold i den här gruppkontexten.
              // Exempelvyn ska därför visa Noors betyg, aldrig den här texten.
              comment: "Den här dolda kommentaren får inte visas i exempelgruppen.",
              ratingVisible: true,
              commentVisible: false,
            },
          ],
        };
      }

      if (visit.id === visits.providerBistroLunch) {
        const historicalAlexReview = {
          id: "review-v10-alex",
          userId: members.alex,
          overall: 4.67,
          taste: 4,
          value: 5,
          service: 5,
          atmosphere: null,
          reviewModel: "food_v0_3d" as const,
          comment: "Lunchen var värd en omväg och servicen höll samma höga nivå.",
          ratingVisible: true,
          commentVisible: true,
        };

        return {
          ...visit,
          participantIds: [...new Set([...visit.participantIds, members.alex])],
          currentUserParticipationStatus: "participant",
          overall: (5 + historicalAlexReview.overall) / 2,
          taste: 4.5,
          value: 5,
          service: 5,
          visibleReviews: [...(visit.visibleReviews ?? []), historicalAlexReview],
        };
      }

      if (visit.id === visits.limitedInfo) {
        return {
          ...visit,
          isTakeaway: true,
          overall: 13 / 3,
          taste: 4,
          value: 5,
          service: 4,
          atmosphere: undefined,
          visibleReviews: [
            {
              id: "review-v7-noor",
              userId: members.noor,
              overall: 13 / 3,
              taste: 4,
              value: 5,
              service: 4,
              atmosphere: null,
              reviewModel: "food_v1_takeaway",
              comment: "Prisvärd hämtlunch som höll sig bra hela vägen hem.",
              ratingVisible: true,
              commentVisible: true,
            },
          ],
        };
      }

      if (visit.id === visits.providerBistroReturn) {
        return {
          ...visit,
          atmosphere: 4,
          currentUserParticipationStatus: "participant",
          // Återbesöket är ett explicit fyrdimensionellt #307-fall.
          visibleReviews: [
            {
              id: "review-v8-alex",
              userId: members.alex,
              overall: 4,
              taste: 5,
              value: 3,
              service: 4,
              atmosphere: 4,
              reviewModel: "food_v1_atmosphere",
              comment: "Återbesöket bekräftade att bistron fungerar för en större middag.",
              ratingVisible: true,
              commentVisible: true,
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
              atmosphere: null,
              reviewModel: "food_v0_3d",
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
          overall: 4.33,
          visibleReviews: [
            {
              id: "review-v5-sam",
              userId: visit.createdBy,
              overall: 4.33,
              taste: 5,
              value: 4,
              service: 4,
              atmosphere: null,
              reviewModel: "food_v0_3d",
              comment: "Tidigt, varmt bröd och nästan ingen kö.",
              ratingVisible: true,
              commentVisible: true,
            },
            {
              id: "review-v5-kim",
              userId: members.kim,
              overall: 4.33,
              taste: 5,
              value: 4,
              service: 4,
              atmosphere: null,
              reviewModel: "food_v0_3d",
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
