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
  if (value <= 0) return null;

  return (
    <div
      className={["flex items-center gap-0.5", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: max }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative block shrink-0" style={{ width: size, height: size }}>
            <Star
              width={size}
              height={size}
              className="absolute inset-0 fill-transparent stroke-muted-foreground/50"
            />
            {fill > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  width={size}
                  height={size}
                  className="max-w-none fill-mustard stroke-mustard-foreground/40"
                />
              </span>
            ) : null}
          </span>
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
