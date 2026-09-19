import type { AppState, ReviewModel, Visit, VisibleReview } from "./types";
import type { OwnVisitReviewInput } from "./live-visit-participation";
import {
  deriveReviewOverall,
  effectiveReviewModel,
  effectiveReviewOverall,
  reviewModelForContext,
  reviewModelIncludesAtmosphere,
  reviewRatingsComplete,
} from "./review-model";
import { normalizeOccasionClassification } from "./occasions";
import { visitHasScore } from "./visit-context";

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateVisit(visit: Visit, preserveInactiveReviews = false): Visit {
  const reviews = preserveInactiveReviews
    ? (visit.visibleReviews ?? [])
    : (visit.visibleReviews ?? []).filter((review) => visit.participantIds.includes(review.userId));
  const rated = reviews.flatMap((review) => {
    const overall = effectiveReviewOverall(review, visit.isTakeaway === true);
    return review.ratingVisible &&
      overall != null &&
      visit.participantIds.includes(review.userId)
      ? [{ review, overall }]
      : [];
  });
  const comment = reviews.find(
    (review) =>
      review.commentVisible &&
      visit.participantIds.includes(review.userId) &&
      Boolean(review.comment?.trim()),
  )?.comment;

  if (rated.length === 0) {
    return {
      ...visit,
      visibleReviews: reviews,
      overall: 0,
      taste: undefined,
      value: undefined,
      service: undefined,
      atmosphere: undefined,
      comment: comment ?? undefined,
    };
  }

  return {
    ...visit,
    visibleReviews: reviews,
    overall: average(rated.map((item) => item.overall)) ?? 0,
    taste: average(
      rated
        .map((item) => item.review.taste)
        .filter((value): value is number => value != null),
    ),
    value: average(
      rated
        .map((item) => item.review.value)
        .filter((value): value is number => value != null),
    ),
    service: average(
      rated
        .map((item) => item.review.service)
        .filter((value): value is number => value != null),
    ),
    atmosphere: average(
      rated
        .filter(({ review }) =>
          reviewModelIncludesAtmosphere(
            effectiveReviewModel(review.reviewModel, visit.isTakeaway === true),
          ),
        )
        .map((item) => item.review.atmosphere)
        .filter((value): value is number => value != null),
    ),
    comment: comment ?? undefined,
  };
}

export function saveOwnDemoReviewForVisit(
  state: AppState,
  visitId: string,
  input: OwnVisitReviewInput,
): AppState {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) throw new Error("Besöket finns inte.");
  if (!visit.participantIds.includes(state.currentUserId)) {
    throw new Error("Endast faktiska deltagare kan lämna ett omdöme.");
  }

  const scored = visitHasScore(visit);
  const existing = visit.visibleReviews?.find((review) => review.userId === state.currentUserId);
  let reviewModel: ReviewModel | null = existing?.reviewModel ?? null;
  let nextOccasions = state.places.find((place) => place.id === visit.placeId)?.occasions ?? [];

  if (scored) {
    if (!reviewModel) {
      if (nextOccasions.length === 0 && input.reviewOccasions?.length) {
        nextOccasions = normalizeOccasionClassification(input.reviewOccasions);
      }
      reviewModel = reviewModelForContext({
        isTakeaway: visit.isTakeaway === true,
        occasions: nextOccasions,
      });
    }
    if (!reviewModel) throw new Error("Välj vad stället passar för först.");
    if (
      !reviewRatingsComplete(reviewModel, {
        taste: input.taste ?? 0,
        value: input.value ?? 0,
        service: input.service ?? 0,
        atmosphere: input.atmosphere ?? 0,
      })
    ) {
      throw new Error("Sätt alla relevanta betyg.");
    }
  } else {
    if (
      input.overall != null ||
      input.taste != null ||
      input.value != null ||
      input.service != null ||
      input.atmosphere != null
    ) {
      throw new Error("Något att dricka ska inte ha stjärnbetyg.");
    }
    if (!input.comment?.trim()) {
      throw new Error("Skriv en kommentar först.");
    }
  }

  const overall = scored
    ? deriveReviewOverall(reviewModel, {
        taste: input.taste ?? 0,
        value: input.value ?? 0,
        service: input.service ?? 0,
        atmosphere: input.atmosphere ?? 0,
      })
    : null;
  const review: VisibleReview = {
    id: existing?.id ?? `demo-review-${visitId}-${state.currentUserId}`,
    userId: state.currentUserId,
    overall,
    taste: scored ? input.taste : null,
    value: scored ? input.value : null,
    service: scored ? input.service : null,
    atmosphere: scored ? (input.atmosphere ?? null) : null,
    reviewModel: scored ? reviewModel : null,
    comment: input.comment,
    ratingVisible: scored,
    commentVisible: existing?.commentVisible ?? true,
  };

  return {
    ...state,
    places:
      scored && nextOccasions.length > 0
        ? state.places.map((place) =>
            place.id === visit.placeId && place.occasions.length === 0
              ? { ...place, occasions: nextOccasions }
              : place,
          )
        : state.places,
    visits: state.visits.map((item) => {
      if (item.id !== visitId) return item;
      const reviews = [
        ...(item.visibleReviews ?? []).filter(
          (candidate) => candidate.userId !== state.currentUserId,
        ),
        review,
      ];
      return aggregateVisit({
        ...item,
        currentUserParticipationStatus: "participant",
        visibleReviews: reviews,
      });
    }),
  };
}

export function setOwnDemoVisitParticipation(
  state: AppState,
  visitId: string,
  participating: boolean,
): AppState {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) throw new Error("Besöket finns inte.");

  if (!participating && visit.createdBy === state.currentUserId) {
    throw new Error("Den som registrerade besöket måste vara deltagare.");
  }

  const isParticipant = visit.participantIds.includes(state.currentUserId);
  if (participating) {
    if (visit.currentUserParticipationStatus !== "declined") {
      throw new Error("Deltagandet kan bara återställas efter en egen korrigering.");
    }
    const member = state.members.find((candidate) => candidate.id === state.currentUserId);
    if (!member) throw new Error("Din medlem kunde inte hittas.");

    return {
      ...state,
      visits: state.visits.map((item) =>
        item.id === visitId
          ? aggregateVisit({
              ...item,
              participantIds: item.participantIds.includes(state.currentUserId)
                ? item.participantIds
                : [...item.participantIds, state.currentUserId],
              participants: [
                ...(item.participants ?? []).filter(
                  (participant) => participant.id !== state.currentUserId,
                ),
                {
                  id: member.id,
                  name: member.name,
                  avatar: member.avatar ?? null,
                  avatarImage: member.avatarImage ?? null,
                  status: "active",
                },
              ],
              currentUserParticipationStatus: "participant",
              visibleReviews: (item.visibleReviews ?? []).map((review) =>
                review.userId === state.currentUserId
                  ? { ...review, ratingVisible: visitHasScore(item) }
                  : review,
              ),
            })
          : item,
      ),
    };
  }

  if (!isParticipant) {
    if (visit.currentUserParticipationStatus === "declined") return state;
    throw new Error("Du är inte registrerad som deltagare på besöket.");
  }

  return {
    ...state,
    visits: state.visits.map((item) =>
      item.id === visitId
        ? aggregateVisit(
            {
              ...item,
              participantIds: item.participantIds.filter((id) => id !== state.currentUserId),
              participants: item.participants?.filter(
                (participant) => participant.id !== state.currentUserId,
              ),
              currentUserParticipationStatus: "declined",
              visibleReviews: (item.visibleReviews ?? []).map((review) =>
                review.userId === state.currentUserId
                  ? { ...review, ratingVisible: false }
                  : review,
              ),
            },
            true,
          )
        : item,
    ),
  };
}

/**
 * Exempelgruppens lokala motsvarighet till ett accepterat #214-förslag.
 * Den simulerar bara produktutfallet: samma användare blir faktisk deltagare
 * och en anonym extern person ersätts i den aktuella gruppens presentation.
 */
export function acceptOwnDemoGuestParticipation(state: AppState, visitId: string): AppState {
  const visit = state.visits.find((item) => item.id === visitId);
  if (!visit) throw new Error("Besöket finns inte.");
  if (visit.participantIds.includes(state.currentUserId)) return state;
  if ((visit.externalParticipantCount ?? 0) < 1) {
    throw new Error("Det finns ingen extern deltagare att koppla till dig.");
  }

  const member = state.members.find((candidate) => candidate.id === state.currentUserId);
  if (!member) throw new Error("Din medlem kunde inte hittas.");

  return {
    ...state,
    visits: state.visits.map((item) =>
      item.id === visitId
        ? aggregateVisit({
            ...item,
            participantIds: [...item.participantIds, state.currentUserId],
            participants: [
              ...(item.participants ?? []).filter(
                (participant) => participant.id !== state.currentUserId,
              ),
              {
                id: member.id,
                name: member.name,
                avatar: member.avatar ?? null,
                avatarImage: member.avatarImage ?? null,
                status: "active",
              },
            ],
            currentUserParticipationStatus: "participant",
            externalParticipantCount: Math.max(0, (item.externalParticipantCount ?? 0) - 1),
          })
        : item,
    ),
  };
}
