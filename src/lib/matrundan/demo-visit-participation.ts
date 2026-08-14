import type { AppState, Visit, VisibleReview } from "./types";
import type { OwnVisitReviewInput } from "./live-visit-participation";

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function aggregateVisit(visit: Visit, preserveInactiveReviews = false): Visit {
  const reviews = preserveInactiveReviews
    ? (visit.visibleReviews ?? [])
    : (visit.visibleReviews ?? []).filter((review) => visit.participantIds.includes(review.userId));
  const rated = reviews.filter(
    (review) => review.ratingVisible && visit.participantIds.includes(review.userId),
  );
  if (rated.length === 0) {
    return {
      ...visit,
      visibleReviews: reviews,
      overall: 0,
      taste: undefined,
      value: undefined,
      service: undefined,
      comment: undefined,
    };
  }

  const comment = rated.find((review) => review.commentVisible && review.comment?.trim())?.comment;
  return {
    ...visit,
    visibleReviews: reviews,
    overall: average(rated.map((review) => review.overall)) ?? 0,
    taste: average(
      rated.map((review) => review.taste).filter((value): value is number => value != null),
    ),
    value: average(
      rated.map((review) => review.value).filter((value): value is number => value != null),
    ),
    service: average(
      rated.map((review) => review.service).filter((value): value is number => value != null),
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

  const existing = visit.visibleReviews?.find((review) => review.userId === state.currentUserId);
  const review: VisibleReview = {
    id: existing?.id ?? `demo-review-${visitId}-${state.currentUserId}`,
    userId: state.currentUserId,
    overall: input.overall,
    taste: input.taste,
    value: input.value,
    service: input.service,
    comment: input.comment,
    ratingVisible: true,
    commentVisible: existing?.commentVisible ?? true,
  };

  return {
    ...state,
    visits: state.visits.map((item) => {
      if (item.id !== visitId) return item;
      const reviews = [
        ...(item.visibleReviews ?? []).filter((candidate) => candidate.userId !== state.currentUserId),
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
                review.userId === state.currentUserId ? { ...review, ratingVisible: true } : review,
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
                review.userId === state.currentUserId ? { ...review, ratingVisible: false } : review,
              ),
            },
            true,
          )
        : item,
    ),
  };
}
