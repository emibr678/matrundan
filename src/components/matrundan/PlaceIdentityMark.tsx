import { Sparkles } from "lucide-react";
import type { PlaceCategory } from "@/lib/matrundan/types";
import { cn } from "@/lib/utils";

const CATEGORY_GRADIENT: Record<PlaceCategory, string> = {
  restaurang: "from-primary/25 to-mustard/30",
  café: "from-mustard/35 to-secondary",
  bageri: "from-mustard/45 to-primary/15",
  snabbmat: "from-primary/20 to-sage/30",
  pub: "from-sage/40 to-secondary",
  matvagn: "from-sage/30 to-mustard/30",
};

const SIZE_CLASS = {
  sm: "h-11 w-11 text-2xl",
  md: "h-14 w-14 text-3xl",
  lg: "h-20 w-20 text-4xl",
  detail: "-top-0.5 h-16 w-16 text-3xl min-[390px]:h-20 min-[390px]:w-20 min-[390px]:text-4xl",
} as const;

const SOMETHING_EXTRA_CLASS: Record<keyof typeof SIZE_CLASS, string> = {
  sm: "-bottom-0.5 -right-0.5 h-3.5 w-3.5 [&_svg]:h-2 [&_svg]:w-2",
  md: "-bottom-0.5 -right-0.5 h-4 w-4 [&_svg]:h-2.5 [&_svg]:w-2.5",
  lg: "-bottom-1 -right-1 h-5 w-5 [&_svg]:h-3 [&_svg]:w-3",
  detail:
    "-bottom-0.5 -right-0.5 h-4 w-4 min-[390px]:-bottom-1 min-[390px]:-right-1 min-[390px]:h-5 min-[390px]:w-5 [&_svg]:h-2.5 [&_svg]:w-2.5 min-[390px]:[&_svg]:h-3 min-[390px]:[&_svg]:w-3",
};

export type PlaceIdentityMarkSize = keyof typeof SIZE_CLASS;

export function PlaceIdentityMark({
  category,
  symbol,
  size = "md",
  showSomethingExtra = false,
  className,
}: {
  category: PlaceCategory;
  symbol?: string | null;
  size?: PlaceIdentityMarkSize;
  showSomethingExtra?: boolean;
  className?: string;
}) {
  const visibleSymbol = symbol?.trim() || "🍽️";
  return (
    <div
      data-slot="place-identity-mark"
      data-size={size}
      className={cn("relative shrink-0", SIZE_CLASS[size], className)}
      aria-hidden="true"
    >
      <div
        data-slot="place-identity-mark-visual"
        className={cn(
          "grid h-full w-full place-items-center overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br",
          CATEGORY_GRADIENT[category],
        )}
      >
        <span className="drop-shadow-sm">{visibleSymbol}</span>
      </div>
      {showSomethingExtra ? (
        <span
          data-slot="place-identity-something-extra"
          className={cn(
            "absolute z-10 grid place-items-center rounded-full border border-mustard/35 bg-background/55 text-mustard-foreground/90 shadow-sm backdrop-blur-sm",
            SOMETHING_EXTRA_CLASS[size],
          )}
        >
          <Sparkles strokeWidth={2.25} />
        </span>
      ) : null}
    </div>
  );
}
