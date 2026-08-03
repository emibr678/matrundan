import { Star } from "lucide-react";

export function RatingStars({
  value,
  max = 5,
  size = 16,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={["flex items-center gap-0.5", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i + 1 <= Math.round(value);
        return (
          <Star
            key={i}
            width={size}
            height={size}
            className={
              filled
                ? "fill-mustard stroke-mustard-foreground/40"
                : "fill-transparent stroke-muted-foreground/50"
            }
          />
        );
      })}
    </div>
  );
}

export function RatingInput({
  value,
  onChange,
  size = 28,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
  label?: string;
}) {
  const accessibleLabel = label ?? "Betyg";

  return (
    <fieldset className="space-y-1.5">
      <legend className={label ? "text-sm font-medium text-foreground" : "sr-only"}>
        {accessibleLabel}
      </legend>
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const v = i + 1;
          const active = v <= value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(value === v ? 0 : v)}
              className="rounded-md p-1 transition-transform hover:scale-110"
              aria-label={`${accessibleLabel}: ${v} av 5`}
              aria-pressed={value === v}
            >
              <Star
                aria-hidden="true"
                width={size}
                height={size}
                className={
                  active
                    ? "fill-mustard stroke-mustard-foreground/50"
                    : "fill-transparent stroke-muted-foreground/60"
                }
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
