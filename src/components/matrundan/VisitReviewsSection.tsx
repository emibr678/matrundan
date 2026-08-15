import * as React from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setReviewGroupVisibility } from "@/lib/matrundan/live-sharing";
import { useSession } from "@/lib/matrundan/session";
import { useStore } from "@/lib/matrundan/store";
import type { Visit, VisibleReview } from "@/lib/matrundan/types";
import { formatRating } from "@/lib/matrundan/version";
import { getVisitReviewSummary, visitReviewProgressLabel } from "@/lib/matrundan/visit-reviews";
import { AddVisitReviewDialog } from "./AddVisitReviewDialog";
import { DemoAddVisitReviewDialog } from "./DemoAddVisitReviewDialog";
import { EditReviewDialog } from "./EditReviewDialog";
import { RatingStars } from "./Rating";

const INITIAL_VISIBLE_REVIEWS = 4;

export function VisitReviewsSection({
  visit,
  placeName,
  groupArchived,
  demoReadOnly,
  onChanged,
}: {
  visit: Visit;
  placeName: string;
  groupArchived: boolean;
  demoReadOnly: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const { state, memberById } = useStore();
  const { mode, activeGroupId } = useSession();
  const [showAll, setShowAll] = React.useState(false);
  const [savingVisibility, setSavingVisibility] = React.useState(false);
  const currentUserId = state.currentUserId;
  const fallbackParticipant = visit.participantIds.includes(currentUserId);
  const participationStatus =
    visit.currentUserParticipationStatus ?? (fallbackParticipant ? "participant" : "none");
  const summary = React.useMemo(
    () => getVisitReviewSummary(visit, currentUserId),
    [visit, currentUserId],
  );
  const writable =
    !groupArchived && !demoReadOnly && (mode === "live" ? Boolean(activeGroupId) : true);
  const canAddOwnReview = participationStatus === "participant" && !summary.ownReview;
  const visibleReviews = showAll
    ? summary.reviews
    : summary.reviews.slice(0, INITIAL_VISIBLE_REVIEWS);
  const hiddenReviewCount = Math.max(0, summary.reviews.length - visibleReviews.length);

  React.useEffect(() => {
    setShowAll(false);
  }, [visit.id]);

  async function toggleOwnCommentVisibility(review: VisibleReview, next: boolean) {
    if (!activeGroupId || groupArchived) return;
    setSavingVisibility(true);
    try {
      await setReviewGroupVisibility(review.id, activeGroupId, true, next);
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

  return (
    <section aria-labelledby={`visit-reviews-${visit.id}`} className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 id={`visit-reviews-${visit.id}`} className="text-sm font-medium">
            Gängets omdömen
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {visitReviewProgressLabel(summary.reviewCount, summary.participantCount)}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70">
        <div className="space-y-3 p-3">
          {visit.overall > 0 ? (
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
          )}

          {visit.taste != null || visit.value != null || visit.service != null ? (
            <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
              <SummaryDetail label="Smak" value={visit.taste} />
              <SummaryDetail label="Prisvärt" value={visit.value} />
              <SummaryDetail label="Service" value={visit.service} />
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
                currentUserId={currentUserId}
                writable={writable}
                mode={mode}
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
                  placeName={placeName}
                  live={mode === "live"}
                  groupArchived={groupArchived}
                  demoReadOnly={demoReadOnly}
                  savingVisibility={savingVisibility}
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
              Visa alla {summary.reviewCount} omdömen
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
  );
}

function OwnReviewPrompt({
  visit,
  placeName,
  currentUserId,
  writable,
  mode,
  onChanged,
}: {
  visit: Visit;
  placeName: string;
  currentUserId: string;
  writable: boolean;
  mode: "demo" | "live";
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
            <p className="text-sm font-medium">Ditt omdöme</p>
            <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] text-primary">
              Du
            </Badge>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Du var med men har inte lämnat något omdöme ännu.
          </p>
        </div>
      </div>
      <div className="mt-3">
        {mode === "live" ? (
          <AddVisitReviewDialog
            visitId={visit.id}
            placeName={placeName}
            disabled={!writable}
            onSaved={onChanged}
          />
        ) : (
          <DemoAddVisitReviewDialog visitId={visit.id} placeName={placeName} disabled={!writable} />
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
  placeName,
  live,
  groupArchived,
  demoReadOnly,
  savingVisibility,
  onToggleVisibility,
}: {
  review: VisibleReview;
  name: string;
  avatar: string;
  avatarImage?: string | null;
  own: boolean;
  placeName: string;
  live: boolean;
  groupArchived: boolean;
  demoReadOnly: boolean;
  savingVisibility: boolean;
  onToggleVisibility: (next: boolean) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const comment = review.comment?.trim();
  const showComment = Boolean(comment && (own || review.commentVisible));
  const hasDetails = review.taste != null || review.value != null || review.service != null;
  const longComment = Boolean(showComment && (comment?.length ?? 0) > 110);
  const expandable = hasDetails || longComment;

  return (
    <div className="p-3">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2.5">
          <ParticipantAvatar avatar={avatar} avatarImage={avatarImage} name={name} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                className={`mt-1 text-sm leading-relaxed text-muted-foreground ${
                  expanded ? "" : "line-clamp-2"
                }`}
              >
                {comment}
              </p>
            ) : null}
            {own && comment && !review.commentVisible ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Kommentaren är dold i gruppen.
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <RatingStars value={review.overall} size={13} />
            <span className="text-xs font-medium">{formatRating(review.overall)} / 5</span>
            <span className="sr-only">
              {name} gav {formatRating(review.overall)} av 5
            </span>
          </div>
        </div>

        {expandable ? (
          <>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="mt-1 min-h-11 w-full justify-between px-2 text-xs text-muted-foreground"
                aria-label={`${expanded ? "Dölj" : "Visa"} detaljer för ${name}`}
              >
                <span>{expanded ? "Dölj detaljer" : "Visa detaljer"}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {hasDetails ? (
                <div className="mt-1 grid grid-cols-3 gap-2 rounded-xl bg-secondary/40 p-2 text-center">
                  <ReviewDetail label="Smak" value={review.taste} />
                  <ReviewDetail label="Prisvärt" value={review.value} />
                  <ReviewDetail label="Service" value={review.service} />
                </div>
              ) : null}
            </CollapsibleContent>
          </>
        ) : null}
      </Collapsible>

      {own && !groupArchived && !demoReadOnly ? (
        <div className="mt-2 border-t border-border/50 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <EditReviewDialog review={review} placeName={placeName} compact />
            {live && comment ? (
              <div className="flex min-h-11 items-center gap-2">
                <Label
                  htmlFor={`review-comment-visible-${review.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Visa kommentar
                </Label>
                <Switch
                  id={`review-comment-visible-${review.id}`}
                  checked={review.commentVisible}
                  disabled={savingVisibility}
                  onCheckedChange={onToggleVisibility}
                />
              </div>
            ) : null}
          </div>
          {live && comment ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Betyget visas alltid i gruppen. Du kan dölja kommentaren utan att ta bort omdömet.
            </p>
          ) : null}
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
