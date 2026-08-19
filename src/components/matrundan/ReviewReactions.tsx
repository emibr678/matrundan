import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { persistDemoState } from "@/lib/matrundan/demo-state";
import {
  loadVisitReviewReactions,
  setOwnReviewReaction,
} from "@/lib/matrundan/live-review-reactions";
import {
  getDemoReviewReactionStates,
  REVIEW_REACTION_OPTIONS,
  setOwnDemoReviewReaction,
  type ReviewReactionBucket,
  type ReviewReactionKey,
  type ReviewReactionState,
} from "@/lib/matrundan/review-reactions";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Visit } from "@/lib/matrundan/types";

interface ReactionContextValue {
  byReview: ReadonlyMap<string, ReviewReactionState>;
  writable: boolean;
  loading: boolean;
  savingReviewId: string | null;
  saveReaction: (reviewId: string, reaction: ReviewReactionKey | null) => Promise<void>;
}

const ReactionContext = React.createContext<ReactionContextValue | null>(null);

function toReactionMap(states: ReviewReactionState[]): Map<string, ReviewReactionState> {
  return new Map(states.map((state) => [state.reviewId, state]));
}

export function VisitReviewReactionsProvider({
  visit,
  groupArchived,
  demoReadOnly,
  children,
}: {
  visit: Visit;
  groupArchived: boolean;
  demoReadOnly: boolean;
  children: React.ReactNode;
}) {
  const { state } = useStore();
  const { mode, activeGroupId, exampleMode } = useSession();
  const [byReview, setByReview] = React.useState<Map<string, ReviewReactionState>>(
    () =>
      mode === "demo"
        ? toReactionMap(getDemoReviewReactionStates(state, visit.id))
        : new Map(),
  );
  const [loading, setLoading] = React.useState(mode === "live");
  const [error, setError] = React.useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = React.useState<string | null>(null);
  const writable =
    !groupArchived && !demoReadOnly && (mode === "demo" || Boolean(activeGroupId));

  const loadLive = React.useCallback(async () => {
    if (mode !== "live" || !activeGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const reactions = await loadVisitReviewReactions(activeGroupId, visit.id);
      setByReview(toReactionMap(reactions));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Kunde inte läsa reaktionerna.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeGroupId, mode, visit.id]);

  React.useEffect(() => {
    if (mode === "live") {
      void loadLive();
      return;
    }
    setByReview(toReactionMap(getDemoReviewReactionStates(state, visit.id)));
    setLoading(false);
    setError(null);
  }, [loadLive, mode, state, visit.id, visit.visibleReviews]);

  const saveReaction = React.useCallback(
    async (reviewId: string, reaction: ReviewReactionKey | null) => {
      if (!writable) return;
      setSavingReviewId(reviewId);
      try {
        if (mode === "live") {
          if (!activeGroupId) throw new Error("Ingen aktiv grupp.");
          await setOwnReviewReaction(activeGroupId, visit.id, reviewId, reaction);
          const reactions = await loadVisitReviewReactions(activeGroupId, visit.id);
          setByReview(toReactionMap(reactions));
        } else {
          const nextState = setOwnDemoReviewReaction(state, visit.id, reviewId, reaction);
          setByReview(toReactionMap(getDemoReviewReactionStates(nextState, visit.id)));
          persistDemoState(nextState, exampleMode);
        }
      } catch (saveError) {
        toast.error(
          saveError instanceof Error ? saveError.message : "Kunde inte spara reaktionen.",
        );
      } finally {
        setSavingReviewId(null);
      }
    },
    [activeGroupId, exampleMode, mode, state, visit.id, writable],
  );

  const contextValue = React.useMemo<ReactionContextValue>(
    () => ({ byReview, writable, loading, savingReviewId, saveReaction }),
    [byReview, loading, saveReaction, savingReviewId, writable],
  );

  return (
    <ReactionContext.Provider value={contextValue}>
      {children}
      {error ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={loadLive}
          >
            Försök igen
          </Button>
        </div>
      ) : null}
    </ReactionContext.Provider>
  );
}

export function ReviewReactionBar({
  reviewId,
  authorName,
}: {
  reviewId: string;
  authorName: string;
}) {
  const context = React.useContext(ReactionContext);
  if (!context) {
    throw new Error("ReviewReactionBar måste användas inuti VisitReviewReactionsProvider.");
  }

  const reactionState = context.byReview.get(reviewId);
  const buckets = (reactionState?.reactions ?? []).filter((bucket) => bucket.count > 0);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const saving = context.savingReviewId === reviewId;

  if (context.loading && !reactionState) return null;
  if (buckets.length === 0 && !context.writable) return null;

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border/40 pt-1.5">
      {buckets.map((bucket) => (
        <ReactionCountChip
          key={bucket.reaction}
          bucket={bucket}
          selected={reactionState?.myReaction === bucket.reaction}
        />
      ))}

      {context.writable ? (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 rounded-full px-2.5 text-xs text-muted-foreground"
              disabled={saving}
              aria-label={`Reagera på ${authorName}s omdöme`}
            >
              Reagera
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto max-w-[calc(100vw-2rem)] rounded-2xl p-2"
            aria-label={`Välj reaktion på ${authorName}s omdöme`}
          >
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Välj reaktion"
            >
              {REVIEW_REACTION_OPTIONS.map((option) => {
                const selected = reactionState?.myReaction === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`grid min-h-11 min-w-11 place-items-center rounded-full text-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-secondary"
                    }`}
                    aria-label={`${option.label}${selected ? ", vald – tryck igen för att ta bort" : ""}`}
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => {
                      setPickerOpen(false);
                      void context.saveReaction(reviewId, selected ? null : option.key);
                    }}
                  >
                    <span aria-hidden="true">{option.emoji}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function ReactionCountChip({
  bucket,
  selected,
}: {
  bucket: ReviewReactionBucket;
  selected: boolean;
}) {
  const option = REVIEW_REACTION_OPTIONS.find((item) => item.key === bucket.reaction);
  if (!option || bucket.count <= 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
            selected
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border/70 bg-secondary/50 text-foreground hover:bg-secondary"
          }`}
          aria-label={`${option.label}: ${bucket.count} ${bucket.count === 1 ? "reaktion" : "reaktioner"}. Visa vilka som reagerat.`}
        >
          <span className="text-base" aria-hidden="true">
            {option.emoji}
          </span>
          <span>{bucket.count}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-3"
      >
        <div className="text-sm font-medium">
          {option.emoji} {option.label}
        </div>
        <div className="mt-2 space-y-2">
          {bucket.reactors.map((person) => (
            <div key={person.userId} className="flex min-w-0 items-center gap-2">
              {person.avatarImage ? (
                <img
                  src={person.avatarImage}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-sm"
                  aria-hidden="true"
                >
                  {person.avatar ?? "🙂"}
                </span>
              )}
              <div className="min-w-0 text-xs">
                <div className="truncate font-medium">{person.name}</div>
                {person.status === "left" ? (
                  <div className="text-[11px] text-muted-foreground">Tidigare medlem</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
