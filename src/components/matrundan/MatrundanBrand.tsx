import { APP_NAME } from "@/lib/matrundan/version";

type BrandVariant = "lockup" | "mark";
type BrandSize = "xs" | "sm" | "md" | "lg";

const MARK_SRC = "/brand/matrundan-mark.png";

const markSize: Record<BrandSize, string> = {
  xs: "h-4 w-4",
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-11 w-11",
};

const labelSize: Record<BrandSize, string> = {
  xs: "text-base",
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export function MatrundanBrand({
  variant = "lockup",
  size = "md",
}: {
  variant?: BrandVariant;
  size?: BrandSize;
}) {
  return (
    <span data-matrundan-brand={variant} className="inline-flex min-w-0 items-center gap-2">
      <img
        src={MARK_SRC}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        data-matrundan-brand-mark="image"
        className={`shrink-0 select-none bg-transparent object-contain ${markSize[size]}`}
      />
      {variant === "lockup" ? (
        <span
          className={`font-display font-semibold leading-tight tracking-tight ${labelSize[size]}`}
        >
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
