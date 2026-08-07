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

const CATEGORY_SYMBOL: Record<PlaceCategory, string> = {
  restaurang: "🍽️",
  café: "☕",
  bageri: "🥐",
  snabbmat: "🍔",
  pub: "🍺",
  matvagn: "🌭",
};

const SIZE_CLASS = {
  sm: "h-11 w-11 text-2xl",
  md: "h-14 w-14 text-3xl",
  lg: "h-20 w-20 text-4xl",
  detail:
    "-top-0.5 h-16 w-16 text-3xl min-[390px]:h-20 min-[390px]:w-20 min-[390px]:text-4xl",
} as const;

export type PlaceIdentityMarkSize = keyof typeof SIZE_CLASS;

export function PlaceIdentityMark({
  category,
  symbol,
  size = "md",
  className,
}: {
  category: PlaceCategory;
  symbol?: string | null;
  size?: PlaceIdentityMarkSize;
  className?: string;
}) {
  const visibleSymbol = symbol?.trim() || CATEGORY_SYMBOL[category];

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
    </div>
  );
}
