import * as React from "react";
import { Input } from "@/components/ui/input";
import { geoapifyAutocompleteLocation } from "@/lib/matrundan/geoapify.functions";
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import { isBroadAdministrativeSearchArea } from "@/lib/matrundan/search-areas";

type LocationSuggestion = {
  label: string;
  placeId: string;
  lat: number;
  lng: number;
  resultType?: string;
  blocked: boolean;
};

/**
 * Val-baserat Geoapify-autocomplete-fält för sökområden.
 *
 * Rå fritext utan explicit val räknas aldrig som en verifierad plats. Breda
 * administrativa områden visas för förklaring men kan inte väljas eftersom
 * Matrundans sökning utgår från en punkt och en gemensam radie.
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
  value: string;
  onChange: (text: string) => void;
  onSelect: (value: VerifiedHomeLocation) => void;
  onClearVerified?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
}) {
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
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
      setActiveIx(-1);
      return;
    }
    const reqId = ++reqRef.current;
    setLoading(true);
    setDone(false);
    const timer = window.setTimeout(() => {
      geoapifyAutocompleteLocation({ data: { text, limit: 6 } })
        .then((rows) => {
          if (reqId !== reqRef.current) return;
          const mapped = rows
            .filter((row) => row.lat != null && row.lng != null && row.placeId)
            .map((row) => ({
              label: row.label,
              placeId: row.placeId,
              lat: row.lat as number,
              lng: row.lng as number,
              resultType: row.resultType,
              blocked: isBroadAdministrativeSearchArea(row.resultType),
            }));
          setSuggestions(mapped);
          setActiveIx(-1);
          setLoading(false);
          setDone(true);
        })
        .catch(() => {
          if (reqId !== reqRef.current) return;
          setSuggestions([]);
          setActiveIx(-1);
          setLoading(false);
          setDone(true);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value]);

  function pick(suggestion: LocationSuggestion) {
    if (suggestion.blocked) return;
    onSelect({
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
      provider: "geoapify",
      placeId: suggestion.placeId,
    });
    setOpen(false);
    setActiveIx(-1);
    setSuggestions([]);
    setDone(false);
  }

  function moveActive(direction: 1 | -1) {
    const selectable = suggestions
      .map((suggestion, index) => ({ suggestion, index }))
      .filter(({ suggestion }) => !suggestion.blocked)
      .map(({ index }) => index);
    if (selectable.length === 0) return;

    const currentPosition = selectable.indexOf(activeIx);
    const nextPosition =
      currentPosition < 0
        ? direction === 1
          ? 0
          : selectable.length - 1
        : (currentPosition + direction + selectable.length) % selectable.length;
    setActiveIx(selectable[nextPosition]);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        moveActive(1);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      if (suggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        moveActive(-1);
      }
      return;
    }
    if (event.key === "Enter" && open && activeIx >= 0) {
      const suggestion = suggestions[activeIx];
      if (suggestion && !suggestion.blocked) {
        event.preventDefault();
        pick(suggestion);
      }
      return;
    }
    if (event.key === "Escape") {
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
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setOpen(true);
          if (next.trim() === "" && onClearVerified) onClearVerified();
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Sök ort, stadsdel eller adress"}
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
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {loading && suggestions.length === 0 ? (
            <li className="px-2 py-2 text-muted-foreground">Söker…</li>
          ) : suggestions.length === 0 ? (
            <li className="px-2 py-2 text-muted-foreground">Inga träffar</li>
          ) : (
            suggestions.map((suggestion, index) => (
              <li
                key={suggestion.placeId}
                id={id ? `${id}-opt-${index}` : undefined}
                role="option"
                aria-selected={!suggestion.blocked && index === activeIx}
                aria-disabled={suggestion.blocked}
              >
                <button
                  type="button"
                  disabled={suggestion.blocked}
                  className={[
                    "w-full rounded px-2 py-2 text-left",
                    suggestion.blocked
                      ? "cursor-not-allowed text-muted-foreground opacity-75"
                      : "hover:bg-accent",
                    !suggestion.blocked && index === activeIx ? "bg-accent" : "",
                  ].join(" ")}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(suggestion);
                  }}
                >
                  <span className="block break-words">{suggestion.label}</span>
                  {suggestion.blocked ? (
                    <span className="mt-0.5 block text-xs leading-snug">
                      Välj en ort, stadsdel eller adress i området.
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
