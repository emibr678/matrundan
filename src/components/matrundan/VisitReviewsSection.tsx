import * as React from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setReviewGroupVisibility } from "@/lib/matrundan/live-sharing";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Visit, VisibleReview } from "@/lib/matrundan/types";
import { formatRating } from "@/lib/matrundan/version";
import { visitHasScore } from "@/lib/matrundan/visit-context";
import { getVisitReviewSummary, visitReviewProgressLabel } from "@/lib/matrundan/visit-reviews";
import { AddVisitReviewDialog } from "./AddVisitReviewDialog";
import { DemoAddVisitReviewDialog } from "./DemoAddVisitReviewDialog";
import { EditReviewDialog } from "./EditReviewDialog";
import { RatingStars } from "./Rating";
import { ReviewReactionBar, VisitReviewReactionsProvider } from "./ReviewReactions";

const INITIAL_VISIBLE_REVIEWS = 4;
const FOCUS_HIGHLIGHT_MS = 7000;

export function VisitReviewsSection({
  visit,
  placeName,
  groupArchived,
  demoReadOnly,
  focusReviewId = null,
  onChanged,
}: {
  visit: Visit;
  placeName: string;
  groupArchived: boolean;
  demoReadOnly: boolean;
  focusReviewId?: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const { state, memberById } = useStore();
  const { mode, activeGroupId } = useSession();
  const [showAll, setShowAll] = React.useState(false);
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const [highlightedReviewId, setHighlightedReviewId] = React.useState<string | null>(null);
  const handledFocusKeyRef = React.useRef<string | null>(null);
  const focusHighlightTimeoutRef = React.useRef<number | null>(null);
  const currentUserId = state.currentUserId;
  const place = state.places.find((item) => item.id === visit.placeId);
  const scored = visitHasScore(visit);
  const fallbackParticipant = visit.participantIds.includes(currentUserId);
  const participationStatus =
    visit.currentUserParticipationStatus ?? (fallbackParticipant ? "participant" : "none");
  const summary = React.useMemo(
    () => getVisitReviewSummary(visit, currentUserId),
    [visit, currentUserId],
  );
  const writable =
    !groupArchived && !demoReadOnly && (mode === "live" ? Boolean(activeGroupId) : true);
  const canAddOwnReview =
    participationStatus === "participant" &&
    (scored ? !summary.ownReview || summary.ownReview.overall == null : !summary.ownReview);
  const visibleReviews = showAll
    ? summary.reviews
    : summary.reviews.slice(0, INITIAL_VISIBLE_REVIEWS);
  const hiddenReviewCount = Math.max(0, summary.reviews.length - visibleReviews.length);
  const focusedReviewIndex = focusReviewId
    ? summary.reviews.findIndex((review) => review.id === focusReviewId)
    : -1;

  React.useEffect(() => {
    setShowAll(false);
    setHighlightedReviewId(null);
    handledFocusKeyRef.current = null;
  }, [visit.id]);

  React.useEffect(
    () => () => {
      if (focusHighlightTimeoutRef.current != null) {
        window.clearTimeout(focusHighlightTimeoutRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!focusReviewId || focusedReviewIndex < 0) return;
    const focusKey = `${visit.id}:${focusReviewId}`;
    if (handledFocusKeyRef.current === focusKey) return;

    if (focusedReviewIndex >= INITIAL_VISIBLE_REVIEWS && !showAll) {
      setShowAll(true);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`visit-review-${focusReviewId}`);
      if (!element) return;

      handledFocusKeyRef.current = focusKey;
      setHighlightedReviewId(focusReviewId);
      element.scrollIntoView({ block: "start", behavior: "smooth" });

      if (focusHighlightTimeoutRef.current != null) {
        window.clearTimeout(focusHighlightTimeoutRef.current);
      }
      focusHighlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedReviewId((current) => (current === focusReviewId ? null : current));
        focusHighlightTimeoutRef.current = null;
      }, FOCUS_HIGHLIGHT_MS);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusReviewId, focusedReviewIndex, showAll, visit.id]);

  function clearReviewHighlight(reviewId: string) {
    if (highlightedReviewId !== reviewId) return;
    if (focusHighlightTimeoutRef.current != null) {
      window.clearTimeout(focusHighlightTimeoutRef.current);
      focusHighlightTimeoutRef.current = null;
    }
    setHighlightedReviewId(null);
  }

  async function toggleOwnCommentVisibility(review: VisibleReview, next: boolean) {
    if (!activeGroupId || groupArchived) return;
    setSavingVisibility(true);
    try {
      await setReviewGroupVisibility(review.id, activeGroupId, review.ratingVisible, next);
      toast.success(
        next ? "Din kommentar är synlig i gruppen." : "Din kommentar är dold i gruppen.",
      );
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara.");
    } finally {
      setSavingVisibility(false);
    }
  }

  const summaryDetails = [
    { label: "Smak", value: visit.taste },
    { label: "Service", value: visit.service },
    { label: "Prisvärt", value: visit.value },
    ...(visit.atmosphere != null ? [{ label: "Atmosfär", value: visit.atmosphere }] : []),
  ];

  return (
    <VisitReviewReactionsProvider
      visit={visit}
      groupArchived={groupArchived}
      demoReadOnly={demoReadOnly}
    >
      <section aria-labelledby={`visit-reviews-${visit.id}`} className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id={`visit-reviews-${visit.id}`} className="text-sm font-medium">
              {scored ? "Gängets omdömen" : "Gängets kommentarer"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {scored
                ? visitReviewProgressLabel(summary.reviewCount, summary.participantCount)
                : "Något att dricka · påverkar inte ställets betyg"}
            </p>
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/70">
          <div className="space-y-3 p-3">
            {scored ? (
              visit.overall > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RatingStars value={visit.overall} size={18} />
                    <span className="font-display text-xl font-semibold">
                      {formatRating(visit.overall)} / 5
                    </span>
                  </div>
                  <span className="sr-only">
                    Gruppens helhetsbetyg {formatRating(visit.overall)} av 5
                  </span>
                </div>
              ) : (
                <p className="text-sm font-medium">Inget omdöme ännu</p>
              )
            ) : (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Det här besöket är scorelöst. Kommentarer sparas som minnen utan stjärnbetyg.</p>
              </div>
            )}

            {scored && summaryDetails.some((detail) => detail.value != null) ? (
              <div
                className={`grid gap-2 border-t border-border/60 pt-3 text-center ${
                  summaryDetails.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
                }`}
              >
                {summaryDetails.map((detail) => (
                  <SummaryDetail key={detail.label} label={detail.label} value={detail.value} />
                ))}
              </div>
            ) : null}

            {summary.legacyComment ? (
              <div className="flex items-start gap-2 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-foreground">Minnesnotering från besöket: </span>
                  <span>{summary.legacyComment}</span>
                </div>
              </div>
            ) : null}
          </div>

          {canAddOwnReview || visibleReviews.length > 0 ? (
            <div className="divide-y divide-border/60 border-t border-border/60">
              {canAddOwnReview ? (
                <OwnReviewPrompt
                  visit={visit}
                  placeName={placeName}
                  placeOccasions={place?.occasions ?? []}
                  currentUserId={currentUserId}
                  writable={writable}
                  mode={mode === "live" ? "live" : "demo"}
                  scoreless={!scored}
                  onChanged={onChanged}
                />
              ) : null}

              {visibleReviews.map((review) => {
                const participant = visit.participants?.find((item) => item.id === review.userId);
                const member = memberById(review.userId);
                return (
                  <ReviewRow
                    key={review.id}
                    review={review}
                    name={participant?.name ?? member?.name ?? "Deltagare"}
                    avatar={participant?.avatar ?? member?.avatar ?? "🙂"}
                    avatarImage={participant?.avatarImage ?? member?.avatarImage ?? null}
                    own={review.userId === currentUserId}
                    focused={review.id === focusReviewId}
                    highlighted={review.id === highlightedReviewId}
                    placeName={placeName}
                    live={mode === "live"}
                    groupArchived={groupArchived}
                    demoReadOnly={demoReadOnly}
                    savingVisibility={savingVisibility}
                    scoreless={!scored}
                    onInteract={() => clearReviewHighlight(review.id)}
                    onToggleVisibility={(next) => void toggleOwnCommentVisibility(review, next)}
                  />
                );
              })}
            </div>
          ) : null}

          {hiddenReviewCount > 0 ? (
            <div className="border-t border-border/60 p-2 text-center">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-sm text-primary"
                onClick={() => setShowAll(true)}
              >
                Visa alla {summary.reviewCount} {scored ? "omdömen" : "kommentarer"}
              </Button>
            </div>
          ) : showAll && summary.reviews.length > INITIAL_VISIBLE_REVIEWS ? (
            <div className="border-t border-border/60 p-2 text-center">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-sm text-muted-foreground"
                onClick={() => setShowAll(false)}
              >
                Visa färre
              </Button>
            </div>
          ) : null}
        </Card>
      </section>
    </VisitReviewReactionsProvider>
  );
}

function OwnReviewPrompt({
  visit,
  placeName,
  placeOccasions,
  currentUserId,
  writable,
  mode,
  scoreless,
  onChanged,
}: {
  visit: Visit;
  placeName: string;
  placeOccasions: Visit extends never ? never : import("@/lib/matrundan/types").Occasion[];
  currentUserId: string;
  writable: boolean;
  mode: "demo" | "live";
  scoreless: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const participant = visit.participants?.find((item) => item.id === currentUserId);
  const { memberById } = useStore();
  const member = memberById(currentUserId);
  const avatar = participant?.avatar ?? member?.avatar ?? "🙂";
  const avatarImage = participant?.avatarImage ?? member?.avatarImage ?? null;

  return (
    <div className="bg-primary/[0.04] p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <ParticipantAvatar avatar={avatar} avatarImage={avatarImage} name="Du" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-medium">{scoreless ? "Din kommentar" : "Ditt omdöme"}</p>
            <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] text-primary">
              Du
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {scoreless
              ? "Du var med. Lägg till en minnesnotering om du vill."
              : "Du var med men har inte lämnat något omdöme ännu."}
          </p>
        </div>
      </div>
      <div className="mt-3">
        {mode === "live" ? (
          <AddVisitReviewDialog
            visitId={visit.id}
            placeName={placeName}
            scoreless={scoreless}
            isTakeaway={visit.isTakeaway === true}
            placeOccasions={placeOccasions}
            disabled={!writable}
            onSaved={onChanged}
          />
        ) : (
          <DemoAddVisitReviewDialog
            visitId={visit.id}
            placeName={placeName}
            scoreless={scoreless}
            isTakeaway={visit.isTakeaway === true}
            placeOccasions={placeOccasions}
            disabled={!writable}
          />
        )}
      </div>
    </div>
  );
}

function ReviewRow({
  review,
  name,
  avatar,
  avatarImage,
  own,
  focused,
  highlighted,
  placeName,
  live,
  groupArchived,
  demoReadOnly,
  savingVisibility,
  scoreless,
  onInteract,
  onToggleVisibility,
}: {
  review: VisibleReview;
  name: string;
  avatar: string;
  avatarImage?: string | null;
  own: boolean;
  focused: boolean;
  highlighted: boolean;
  placeName: string;
  live: boolean;
  groupArchived: boolean;
  demoReadOnly: boolean;
  savingVisibility: boolean;
  scoreless: boolean;
  onInteract: () => void;
  onToggleVisibility: (next: boolean) => void;
}) {
  const [commentExpanded, setCommentExpanded] = React.useState(false);
  const comment = review.comment?.trim();
  const showComment = Boolean(comment && (own || review.commentVisible));
  const reactableComment = Boolean(comment && review.commentVisible);
  const hasRating = !scoreless && review.ratingVisible && review.overall != null;
  const detailItems = hasRating
    ? [
        { label: "Smak", value: review.taste },
        { label: "Service", value: review.service },
        { label: "Prisvärt", value: review.value },
        ...(review.atmosphere != null ? [{ label: "Atmosfär", value: review.atmosphere }] : []),
      ].filter((detail) => detail.value != null)
    : [];
  const longComment = Boolean(showComment && (comment?.length ?? 0) > 110);
  const canEditOwn =
    own &&
    !groupArchived &&
    !demoReadOnly &&
    (scoreless || review.overall != null || review.reviewModel != null);
  const canToggleComment = canEditOwn && live && Boolean(comment);
  const showFullComment = commentExpanded || focused;
  const editAction = canEditOwn ? (
    <EditReviewDialog review={review} placeName={placeName} compact scoreless={scoreless} />
  ) : null;

  return (
    <div
      id={`visit-review-${review.id}`}
      data-review-id={review.id}
      data-review-highlighted={highlighted ? "true" : undefined}
      className={`scroll-mt-16 p-3 transition-[background-color,box-shadow] duration-700 ${
        highlighted ? "bg-primary/[0.08] ring-1 ring-inset ring-primary/20" : ""
      }`}
      onClickCapture={highlighted ? onInteract : undefined}
      onKeyDownCapture={
        highlighted
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") onInteract();
            }
          : undefined
      }
    >
      <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2.5">
        <ParticipantAvatar avatar={avatar} avatarImage={avatarImage} name={name} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <p className="max-w-full truncate text-sm font-medium">{name}</p>
            {own ? (
              <Badge
                variant="outline"
                className="shrink-0 rounded-full px-1.5 py-0 text-[10px] text-primary"
              >
                Du
              </Badge>
            ) : null}
          </div>
          {showComment ? (
            <p
              className={`mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] ${
                showFullComment ? "" : "line-clamp-3"
              }`}
            >
              {comment}
            </p>
          ) : null}
          {own && comment && !review.commentVisible ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Kommentaren är dold i gruppen.</p>
          ) : null}
        </div>
        {hasRating ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <RatingStars value={review.overall as number} size={13} />
            <span className="text-xs font-medium">
              {formatRating(review.overall as number)} / 5
            </span>
            <span className="sr-only">
              {name} gav {formatRating(review.overall as number)} av 5
            </span>
          </div>
        ) : null}
      </div>

      {longComment && !focused ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-0.5 min-h-10 w-auto px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-expanded={commentExpanded}
          onClick={() => setCommentExpanded((expanded) => !expanded)}
        >
          {commentExpanded ? "Visa mindre" : "Visa mer"}
        </Button>
      ) : null}

      {detailItems.length > 0 ? (
        <div
          className={`mt-2 grid gap-2 rounded-xl bg-secondary/35 p-2 text-center ${
            detailItems.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
          }`}
        >
          {detailItems.map((detail) => (
            <ReviewDetail key={detail.label} label={detail.label} value={detail.value} />
          ))}
        </div>
      ) : null}

      {reactableComment ? (
        <ReviewReactionBar reviewId={review.id} authorName={name} trailingAction={editAction} />
      ) : editAction ? (
        <div className="mt-2 flex justify-end">{editAction}</div>
      ) : null}

      {canToggleComment ? (
        <div className="mt-1 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            className="min-h-10 w-auto px-2 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            disabled={savingVisibility}
            aria-label={`${review.commentVisible ? "Dölj" : "Visa"} din kommentar i gruppen`}
            onClick={() => onToggleVisibility(!review.commentVisible)}
          >
            {savingVisibility
              ? "Sparar…"
              : review.commentVisible
                ? "Dölj kommentar"
                : "Visa kommentar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ParticipantAvatar({
  avatar,
  avatarImage,
  name,
}: {
  avatar: string;
  avatarImage?: string | null;
  name: string;
}) {
  return avatarImage ? (
    <img src={avatarImage} alt="" className="h-8 w-8 rounded-full object-cover" title={name} />
  ) : (
    <div
      className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-base"
      aria-hidden="true"
      title={name}
    >
      {avatar}
    </div>
  );
}

function SummaryDetail({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">
        {value != null ? formatRating(value) : "–"}
      </div>
    </div>
  );
}

function ReviewDetail({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium">{value != null ? formatRating(value) : "–"}</div>
    </div>
  );
}
