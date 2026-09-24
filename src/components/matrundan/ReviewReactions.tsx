import * as React from "react";
import { SmilePlus } from "lucide-react";
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
  currentUserId: string;
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
  const [byReview, setByReview] = React.useState<Map<string, ReviewReactionState>>(() =>
    mode === "demo" ? toReactionMap(getDemoReviewReactionStates(state, visit.id)) : new Map(),
  );
  const [loading, setLoading] = React.useState(mode === "live");
  const [error, setError] = React.useState<string | null>(null);
  const [savingReviewId, setSavingReviewId] = React.useState<string | null>(null);
  const writable = !groupArchived && !demoReadOnly && (mode === "demo" || Boolean(activeGroupId));

  const loadLive = React.useCallback(async () => {
    if (mode !== "live" || !activeGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const reactions = await loadVisitReviewReactions(activeGroupId, visit.id);
      setByReview(toReactionMap(reactions));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kunde inte läsa reaktionerna.");
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
          persistDemoState(nextState, exampleMode, { preserveView: true });
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
    () => ({
      byReview,
      currentUserId: state.currentUserId,
      writable,
      loading,
      savingReviewId,
      saveReaction,
    }),
    [byReview, loading, saveReaction, savingReviewId, state.currentUserId, writable],
  );

  return (
    <ReactionContext.Provider value={contextValue}>
      {children}
      {error ? (
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={loadLive}>
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
  emphasized = false,
  canReact = true,
  trailingAction,
  content,
}: {
  reviewId: string;
  authorName: string;
  emphasized?: boolean;
  canReact?: boolean;
  trailingAction?: React.ReactNode;
  content?: React.ReactNode;
}) {
  const context = React.useContext(ReactionContext);
  if (!context) {
    throw new Error("ReviewReactionBar måste användas inuti VisitReviewReactionsProvider.");
  }

  const reactionState = context.byReview.get(reviewId);
  const buckets = (reactionState?.reactions ?? []).filter((bucket) => bucket.count > 0);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const saving = context.savingReviewId === reviewId;
  const reactionReady = !context.loading || Boolean(reactionState);
  const allowReaction = context.writable && canReact;

  if (!reactionReady) {
    if (!content && !trailingAction) return null;
    return content ? (
      <div
        className="flex min-w-0 items-end gap-1"
        data-review-reactions={reviewId}
        data-review-action-row={reviewId}
      >
        <div className="min-w-0 flex-1">{content}</div>
        {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
      </div>
    ) : (
      <div
        className="mt-2 flex min-w-0 justify-end"
        data-review-reactions={reviewId}
        data-review-action-row={reviewId}
      >
        {trailingAction}
      </div>
    );
  }
  if (buckets.length === 0 && !allowReaction && !trailingAction && !content) return null;

  const reactionChips = buckets.map((bucket) => (
    <ReactionCountChip
      key={bucket.reaction}
      bucket={bucket}
      currentUserId={context.currentUserId}
      selected={reactionState?.myReaction === bucket.reaction}
      saving={saving}
      onRemove={() => void context.saveReaction(reviewId, null)}
    />
  ));

  const reactionPicker = allowReaction ? (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
            pickerOpen || emphasized ? "bg-primary/10 text-primary" : ""
          }`}
          disabled={saving}
          aria-label={`Lägg till reaktion på ${authorName}s omdöme`}
          aria-expanded={pickerOpen}
          data-emphasized={emphasized ? "true" : undefined}
        >
          <SmilePlus className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={12}
        className="w-auto max-w-[calc(100vw-1.5rem)] rounded-full p-1"
        role="group"
        aria-label="Välj reaktion"
        data-reaction-picker="popover"
      >
        <div className="flex items-center gap-0.5">
          {REVIEW_REACTION_OPTIONS.map((option) => {
            const selected = reactionState?.myReaction === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`grid h-10 w-10 place-items-center rounded-full text-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  selected ? "bg-primary/12 ring-1 ring-primary/25" : "hover:bg-secondary/60"
                }`}
                aria-label={`${option.label}${
                  selected ? ", vald – tryck igen för att ta bort" : ""
                }`}
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
  ) : null;

  return (
    <div className={content ? "min-w-0" : "mt-1 min-w-0"} data-review-reactions={reviewId}>
      {content ? (
        <>
          <div className="flex min-w-0 items-end gap-1" data-review-action-row={reviewId}>
            <div className="min-w-0 flex-1">{content}</div>
            {reactionPicker}
            {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
          </div>

          {buckets.length > 0 ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">{reactionChips}</div>
          ) : null}
        </>
      ) : (
        <div
          className="flex min-w-0 items-center justify-between gap-2"
          data-review-action-row={reviewId}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {reactionChips}
            {reactionPicker}
          </div>

          {trailingAction ? <div className="shrink-0">{trailingAction}</div> : null}
        </div>
      )}
    </div>
  );
}

function ReactionCountChip({
  bucket,
  currentUserId,
  selected,
  saving,
  onRemove,
}: {
  bucket: ReviewReactionBucket;
  currentUserId: string;
  selected: boolean;
  saving: boolean;
  onRemove: () => void;
}) {
  const option = REVIEW_REACTION_OPTIONS.find((item) => item.key === bucket.reaction);
  const firstReactor = bucket.reactors[0];
  if (!option || bucket.count <= 0 || !firstReactor) return null;

  const additionalCount = Math.max(0, bucket.count - 1);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex min-h-10 min-w-0 max-w-full items-center gap-1 rounded-full px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
            selected
              ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
              : "bg-secondary/30 text-foreground hover:bg-secondary/55"
          }`}
          aria-label={`${option.label}: ${bucket.count} ${
            bucket.count === 1 ? "reaktion" : "reaktioner"
          }. Visa vilka som reagerat.`}
        >
          <span className="shrink-0 text-sm" aria-hidden="true">
            {option.emoji}
          </span>
          <span className="min-w-0 truncate">{firstReactor.name}</span>
          {additionalCount > 0 ? <span className="shrink-0">+{additionalCount}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] rounded-2xl p-3">
        <div className="text-sm font-medium">
          {option.emoji} {option.label}
        </div>
        <div className="mt-2 space-y-2">
          {bucket.reactors.map((person) => {
            const ownReaction = selected && person.userId === currentUserId;
            return (
              <div key={person.userId} className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
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
                    <div className="truncate font-medium">
                      {person.name}
                      {ownReaction ? (
                        <span className="font-normal text-muted-foreground"> (Du)</span>
                      ) : null}
                    </div>
                    {person.status === "left" ? (
                      <div className="text-[11px] text-muted-foreground">Tidigare medlem</div>
                    ) : null}
                  </div>
                </div>
                {ownReaction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-9 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={saving}
                    aria-label={`Ta bort din ${option.label.toLowerCase()}-reaktion`}
                    onClick={onRemove}
                  >
                    Ta bort
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
