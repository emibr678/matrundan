import { APP_NAME } from "@/lib/matrundan/version";

type BrandVariant = "lockup" | "mark";
type BrandSize = "sm" | "md" | "lg";

const markSize: Record<BrandSize, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-11 w-11",
};

const labelSize: Record<BrandSize, string> = {
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
        src="/icons/matrundan-192.png"
        alt=""
        width={192}
        height={192}
        draggable={false}
        className={`shrink-0 object-contain ${markSize[size]}`}
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
