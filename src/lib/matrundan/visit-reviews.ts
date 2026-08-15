import type { Visit, VisibleReview } from "./types";

export interface VisitReviewSummary {
  reviews: VisibleReview[];
  ownReview?: VisibleReview;
  participantCount: number;
  reviewCount: number;
  legacyComment?: string;
}

function uniqueParticipantIds(visit: Visit): string[] {
  return [...new Set(visit.participantIds)];
}

/**
 * Underlag för den gemensamma omdömesytan.
 *
 * `visibleReviews` kan innehålla historiskt eller gruppfiltrerat material. UI:t
 * ska bara räkna aktiva, synliga omdömen från personer som fortfarande finns i
 * besökets kanoniska deltagarlista. Detta speglar samma deltagarsanning som
 * progressionen och undviker att registreraren får ett eget reviewkort bara för
 * att hen skapade besöket.
 */
export function getVisitReviewSummary(visit: Visit, currentUserId: string): VisitReviewSummary {
  const participantIds = uniqueParticipantIds(visit);
  const participantSet = new Set(participantIds);
  const seenAuthors = new Set<string>();

  const reviews = (visit.visibleReviews ?? []).filter((review) => {
    if (!review.ratingVisible || !participantSet.has(review.userId)) return false;
    if (seenAuthors.has(review.userId)) return false;
    seenAuthors.add(review.userId);
    return true;
  });

  const ownReview = reviews.find((review) => review.userId === currentUserId);
  const orderedReviews = ownReview
    ? [ownReview, ...reviews.filter((review) => review.id !== ownReview.id)]
    : reviews;

  const visitComment = visit.comment?.trim();
  const commentAlreadyRepresented = Boolean(
    visitComment &&
      reviews.some(
        (review) =>
          review.commentVisible && review.comment?.trim() && review.comment.trim() === visitComment,
      ),
  );

  return {
    reviews: orderedReviews,
    ownReview,
    participantCount: participantIds.length,
    reviewCount: reviews.length,
    legacyComment: visitComment && !commentAlreadyRepresented ? visitComment : undefined,
  };
}

export function visitReviewProgressLabel(reviewCount: number, participantCount: number): string {
  if (participantCount <= 0) {
    if (reviewCount === 0) return "Inga omdömen ännu";
    return reviewCount === 1 ? "1 omdöme" : `${reviewCount} omdömen`;
  }

  return `${reviewCount} av ${participantCount} deltagare har lämnat omdöme`;
}
