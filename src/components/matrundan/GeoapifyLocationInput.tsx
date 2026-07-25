import * as React from "react";
import { Input } from "@/components/ui/input";
import { geoapifyAutocompleteLocation } from "@/lib/matrundan/geoapify.functions";
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";

/**
 * Val-baserat Geoapify-autocomplete-fält för sökområden.
 *
 * Rå fritext utan explicit val räknas aldrig som en verifierad plats.
 * Anroparen får bara ett strukturerat värde via `onSelect` när användaren
 * väljer ett förslag från listan (klick eller Enter).
 */
export function GeoapifyLocationInput({
  id,
  value,
  onChange,
  onSelect,
  onClearVerified,
  placeholder,
  disabled,
  ariaInvalid,
}: {
  id?: string;
  /** Aktuell text i fältet. */
  value: string;
  /** Kallas vid varje tangenttryck så anroparen kan invalidera tidigare val. */
  onChange: (text: string) => void;
  /** Kallas när användaren väljer ett förslag. */
  onSelect: (value: VerifiedHomeLocation) => void;
  /** Anropas när användaren har tömt fältet (för explicit rensning). */
  onClearVerified?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
}) {
  const [suggestions, setSuggestions] = React.useState<
    { label: string; placeId: string; lat: number; lng: number }[]
  >([]);
  const [open, setOpen] = React.useState(false);
  const [activeIx, setActiveIx] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const reqRef = React.useRef(0);

  React.useEffect(() => {
    const text = value.trim();
    if (text.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setDone(false);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setDone(false);
    const t = setTimeout(() => {
      geoapifyAutocompleteLocation({ data: { text, limit: 6 } })
        .then((rows) => {
          if (reqId !== reqRef.current) return;
          const mapped = rows
            .filter((r) => r.lat != null && r.lng != null && r.placeId)
            .map((r) => ({
              label: r.label,
              placeId: r.placeId,
              lat: r.lat as number,
              lng: r.lng as number,
            }));
          setSuggestions(mapped);
          setActiveIx(-1);
          setLoading(false);
          setDone(true);
        })
        .catch(() => {
          if (reqId !== reqRef.current) return;
          setSuggestions([]);
          setLoading(false);
          setDone(true);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  function pick(s: (typeof suggestions)[number]) {
    onSelect({
      label: s.label,
      lat: s.lat,
      lng: s.lng,
      provider: "geoapify",
      placeId: s.placeId,
    });
    setOpen(false);
    setActiveIx(-1);
    setSuggestions([]);
    setDone(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        setActiveIx(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIx((ix) => (ix + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIx((ix) => (ix <= 0 ? suggestions.length - 1 : ix - 1));
    } else if (e.key === "Enter") {
      if (activeIx >= 0) {
        e.preventDefault();
        pick(suggestions[activeIx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIx(-1);
    }
  }

  const showList = open && value.trim().length >= 2 && (loading || suggestions.length > 0 || done);

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          setOpen(true);
          if (next.trim() === "" && onClearVerified) onClearVerified();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Sök stad eller område"}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={ariaInvalid}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={activeIx >= 0 && id ? `${id}-opt-${activeIx}` : undefined}
      />
      {showList ? (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-2 py-2 text-muted-foreground">Söker…</li>
          ) : suggestions.length === 0 ? (
            <li className="px-2 py-2 text-muted-foreground">Inga träffar</li>
          ) : (
            suggestions.map((s, i) => (
              <li
                key={s.placeId}
                id={id ? `${id}-opt-${i}` : undefined}
                role="option"
                aria-selected={i === activeIx}
              >
                <button
                  type="button"
                  className={[
                    "w-full rounded px-2 py-1.5 text-left hover:bg-accent",
                    i === activeIx ? "bg-accent" : "",
                  ].join(" ")}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
