import type { AppState } from "./types";
import { visitHasScore } from "./visit-context";

export type ReviewReactionKey = "heart" | "drool" | "celebrate" | "laugh";

export interface ReviewReactionPerson {
  userId: string;
  name: string;
  avatar?: string | null;
  avatarImage?: string | null;
  status: "active" | "left";
}

export interface ReviewReactionBucket {
  reaction: ReviewReactionKey;
  count: number;
  reactors: ReviewReactionPerson[];
}

export interface ReviewReactionState {
  reviewId: string;
  myReaction: ReviewReactionKey | null;
  reactions: ReviewReactionBucket[];
}

export const REVIEW_REACTION_OPTIONS: ReadonlyArray<{
  key: ReviewReactionKey;
  emoji: string;
  label: string;
}> = [
  { key: "heart", emoji: "❤️", label: "Hjärta" },
  { key: "drool", emoji: "🤤", label: "Ser gott ut" },
  { key: "celebrate", emoji: "🙌", label: "Håller med" },
  { key: "laugh", emoji: "😂", label: "Roligt" },
];

const reactionOrder = new Map(
  REVIEW_REACTION_OPTIONS.map((option, index) => [option.key, index] as const),
);

type AppStateWithReviewReactions = AppState & {
  reviewReactions?: ReviewReactionState[];
};

function memberReactionPerson(state: AppState, userId: string): ReviewReactionPerson {
  const member = state.members.find((item) => item.id === userId);
  return {
    userId,
    name: member?.name ?? "Medlem",
    avatar: member?.avatar ?? null,
    avatarImage: member?.avatarImage ?? null,
    status: "active",
  };
}

function exampleDefaults(state: AppState): ReviewReactionState[] {
  if (state.group.id !== "example-stockholm") return [];
  const visit = state.visits.find((item) => item.id === "v2");
  const review = visit?.visibleReviews?.find((item) => item.id === "review-v2-sam");
  if (!review?.commentVisible || !review.comment?.trim()) return [];

  const alex = state.members.find((item) => item.id === state.currentUserId)?.id;
  const robin = state.members.find((item) => item.id === "m3")?.id;
  const noor = state.members.find((item) => item.id === "m5")?.id;

  const reactions: ReviewReactionBucket[] = [];
  if (robin) {
    reactions.push({
      reaction: "heart",
      count: 1,
      reactors: [memberReactionPerson(state, robin)],
    });
  }
  if (alex) {
    reactions.push({
      reaction: "drool",
      count: 1,
      reactors: [memberReactionPerson(state, alex)],
    });
  }
  if (noor) {
    reactions.push({
      reaction: "celebrate",
      count: 1,
      reactors: [memberReactionPerson(state, noor)],
    });
  }

  return [
    {
      reviewId: review.id,
      myReaction: alex ? "drool" : null,
      reactions,
    },
  ];
}

function allDemoReactionStates(state: AppState): ReviewReactionState[] {
  const stored = (state as AppStateWithReviewReactions).reviewReactions;
  return stored ?? exampleDefaults(state);
}

export function getDemoReviewReactionStates(
  state: AppState,
  visitId: string,
): ReviewReactionState[] {
  const reviewIds = new Set(
    state.visits
      .find((visit) => visit.id === visitId)
      ?.visibleReviews?.map((review) => review.id) ?? [],
  );
  return allDemoReactionStates(state).filter((reaction) => reviewIds.has(reaction.reviewId));
}

export function setOwnDemoReviewReaction(
  state: AppState,
  visitId: string,
  reviewId: string,
  reaction: ReviewReactionKey | null,
): AppState {
  if (state.group.lifecycleStatus === "archived") {
    throw new Error("Gruppen är arkiverad och kan bara läsas.");
  }

  const visit = state.visits.find((item) => item.id === visitId);
  const review = visit?.visibleReviews?.find((item) => item.id === reviewId);
  if (!visit || !review) {
    throw new Error("Omdömet finns inte i besöket.");
  }
  const commentCanBeReactedTo =
    review.commentVisible &&
    Boolean(review.comment?.trim()) &&
    (review.ratingVisible || !visitHasScore(visit));
  if (!commentCanBeReactedTo) {
    throw new Error("Omdömet kan inte reageras på i den här gruppen.");
  }

  const currentUserId = state.currentUserId;
  if (!state.members.some((member) => member.id === currentUserId)) {
    throw new Error("Du är inte aktiv medlem i gruppen.");
  }

  const allStates = allDemoReactionStates(state);
  const previous = allStates.find((item) => item.reviewId === reviewId);
  const buckets = (previous?.reactions ?? [])
    .map((bucket) => {
      const reactors = bucket.reactors.filter((person) => person.userId !== currentUserId);
      return { ...bucket, count: reactors.length, reactors };
    })
    .filter((bucket) => bucket.count > 0);

  if (reaction) {
    const person = memberReactionPerson(state, currentUserId);
    const existing = buckets.find((bucket) => bucket.reaction === reaction);
    if (existing) {
      existing.reactors = [...existing.reactors, person];
      existing.count = existing.reactors.length;
    } else {
      buckets.push({ reaction, count: 1, reactors: [person] });
    }
  }

  buckets.sort(
    (left, right) =>
      (reactionOrder.get(left.reaction) ?? 99) - (reactionOrder.get(right.reaction) ?? 99),
  );

  const nextState: ReviewReactionState = {
    reviewId,
    myReaction: reaction,
    reactions: buckets,
  };
  const nextAll = [...allStates.filter((item) => item.reviewId !== reviewId), nextState];

  return {
    ...state,
    reviewReactions: nextAll,
  } as AppState;
}
