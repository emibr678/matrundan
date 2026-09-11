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
 * Underlag för den gemensamma omdömes-/kommentarsytan.
 *
 * `visibleReviews` kan innehålla historiskt eller gruppfiltrerat material. UI:t
 * ska bara räkna bidrag från personer som fortfarande finns i besökets
 * kanoniska deltagarlista. Ett bidrag får vara ett synligt betyg eller en synlig
 * scorelös kommentar. Den egna raden behålls även när den är dold i gruppen så
 * att användaren kan redigera sitt eget bidrag.
 */
export function getVisitReviewSummary(visit: Visit, currentUserId: string): VisitReviewSummary {
  const participantIds = uniqueParticipantIds(visit);
  const participantSet = new Set(participantIds);
  const seenAuthors = new Set<string>();

  const reviews = (visit.visibleReviews ?? []).filter((review) => {
    if (!participantSet.has(review.userId)) return false;
    if (!review.ratingVisible && !review.commentVisible && review.userId !== currentUserId) {
      return false;
    }
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

  // Nämnaren är identifierade faktiska gruppmedlemmar på besöket. Gäster och
  // anonyma externa deltagare kan synas i deltagarlistan men har inget eget
  // medlemskonto att koppla ett deltagaromdöme till i den här leveransen.
  return `${reviewCount} av ${participantCount} deltagare i gruppen har lämnat omdöme`;
}
