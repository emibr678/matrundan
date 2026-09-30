import type * as React from "react";
import { RatingStars } from "./Rating";
import { formatRating } from "@/lib/matrundan/version";

export function PlaceSummary({
  name,
  meta,
  rating,
  reviewCount,
  leading,
  trailing,
  footer,
}: {
  name: React.ReactNode;
  meta?: React.ReactNode;
  rating: number | null;
  reviewCount: number;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold leading-tight">{name}</h3>
            {meta ? <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div> : null}
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>

        <div className="mt-2 flex min-h-5 min-w-0 items-center gap-2">
          {rating != null && reviewCount > 0 ? (
            <>
              <RatingStars value={rating} size={13} />
              <span className="shrink-0 text-xs font-medium">{formatRating(rating)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {reviewCount} {reviewCount === 1 ? "omdöme" : "omdömen"}
              </span>
            </>
          ) : (
            <span className="text-xs italic text-muted-foreground">Inga omdömen än</span>
          )}
        </div>

        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function VisitSummary({
  placeName,
  meta,
  rating,
  reviewCount,
  leading,
  trailing,
  footer,
}: {
  placeName: string;
  meta: React.ReactNode;
  rating: number | null;
  reviewCount: number;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold leading-tight">
              {placeName}
            </h3>
            <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>

        <div className="mt-2 flex min-h-5 min-w-0 items-center gap-2">
          {rating != null && reviewCount > 0 ? (
            <>
              <RatingStars value={rating} size={13} />
              <span className="shrink-0 text-xs font-medium">{formatRating(rating)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {reviewCount} {reviewCount === 1 ? "omdöme" : "omdömen"}
              </span>
            </>
          ) : (
            <span className="text-xs italic text-muted-foreground">Inga omdömen än</span>
          )}
        </div>

        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  );
}
