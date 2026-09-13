import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  demoAutocompleteLocations,
  demoBoundaryForPlaceId,
} from "@/lib/matrundan/demo-location-suggestions";
import { geoapifyResolveSearchAreaBoundary } from "@/lib/matrundan/geoapify-boundaries.functions";
import { geoapifyAutocompleteLocation } from "@/lib/matrundan/geoapify.functions";
import type { NormalizedLocationSuggestion } from "@/lib/matrundan/geoapify-normalize";
import type { VerifiedHomeLocation } from "@/lib/matrundan/live-admin";
import {
  isBoundaryEligibleResultType,
  isBroadAdministrativeSearchArea,
} from "@/lib/matrundan/search-areas";
import type { SearchAreaBoundaryGeometry, SearchAreaMode } from "@/lib/matrundan/types";

export type VerifiedLocationSelection = VerifiedHomeLocation & {
  city: string;
  area?: string;
  resultType?: string;
  searchMode?: SearchAreaMode;
  boundary?: SearchAreaBoundaryGeometry;
};

type LocationSuggestion = {
  label: string;
  primaryLabel: string;
  secondaryLabel: string;
  placeId: string;
  lat: number;
  lng: number;
  city: string;
  area?: string;
  resultType?: string;
  blocked: boolean;
};

function toLocationSuggestion(
  row: NormalizedLocationSuggestion,
  allowBoundaryAreas: boolean,
): LocationSuggestion {
  const broad = isBroadAdministrativeSearchArea(row.resultType, row.label);
  const boundaryCandidate = isBoundaryEligibleResultType(row.resultType);
  return {
    label: row.label,
    primaryLabel: row.primaryLabel || row.label,
    secondaryLabel: row.secondaryLabel || "Plats",
    placeId: row.placeId,
    lat: row.lat,
    lng: row.lng,
    city: row.city,
    area: row.area,
    resultType: row.resultType,
    blocked: broad && (!allowBoundaryAreas || !boundaryCandidate),
  };
}

function matchesDemoInputExactly(suggestion: LocationSuggestion, value: string): boolean {
  const query = value.trim().toLocaleLowerCase("sv-SE");
  return [suggestion.primaryLabel, suggestion.label].some(
    (candidate) => candidate.trim().toLocaleLowerCase("sv-SE") === query,
  );
}

/**
 * Val-baserat autocomplete-fält för verifierade sökområden och platsval.
 *
 * När allowBoundaryAreas=true verifieras en boundary-kandidat server-side mot
 * Geoapify innan den lämnas vidare. Breda administrativa träffar får aldrig
 * falla tillbaka till en godtycklig punkt om providergränsen saknas.
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
  demoMode = false,
  demoFallbackCity = "Göteborg",
  allowBoundaryAreas = false,
}: {
  id?: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (value: VerifiedLocationSelection) => void;
  onClearVerified?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  demoMode?: boolean;
  demoFallbackCity?: string;
  allowBoundaryAreas?: boolean;
}) {
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeIx, setActiveIx] = React.useState(-1);
  const [loading, setLoading] = React.useState(false);
  const [resolving, setResolving] = React.useState(false);
  const [selectionError, setSelectionError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const reqRef = React.useRef(0);
  const blurTimerRef = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current);
      }
    },
    [],
  );

  React.useEffect(() => {
    const text = value.trim();
    setSelectionError(null);
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
      const request = demoMode
        ? Promise.resolve(demoAutocompleteLocations(text, demoFallbackCity, 6))
        : geoapifyAutocompleteLocation({ data: { text, limit: 6 } });

      request
        .then((rows) => {
          if (reqId !== reqRef.current) return;
          const mapped = rows.map((row) => toLocationSuggestion(row, allowBoundaryAreas));
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
  }, [allowBoundaryAreas, demoFallbackCity, demoMode, value]);

  async function pick(suggestion: LocationSuggestion) {
    if (suggestion.blocked || resolving) return;
    setSelectionError(null);

    let searchMode: SearchAreaMode = "point";
    let boundary: SearchAreaBoundaryGeometry | undefined;
    let selectedPlaceId = suggestion.placeId;
    const boundaryCandidate =
      allowBoundaryAreas && isBoundaryEligibleResultType(suggestion.resultType);

    if (boundaryCandidate) {
      setResolving(true);
      try {
        if (demoMode) {
          const demoBoundary = demoBoundaryForPlaceId(suggestion.placeId);
          if (demoBoundary) {
            searchMode = "boundary";
            boundary = demoBoundary;
          }
        } else {
          const resolved = await geoapifyResolveSearchAreaBoundary({
            data: {
              placeId: suggestion.placeId,
              label: suggestion.primaryLabel,
              resultType: suggestion.resultType,
            },
          });
          searchMode = resolved.searchMode;
          boundary = resolved.boundary ?? undefined;
          if (resolved.searchMode === "boundary" && resolved.boundaryPlaceId) {
            selectedPlaceId = resolved.boundaryPlaceId;
          }
        }
      } catch {
        setSelectionError("Kunde inte verifiera områdets gräns. Försök igen.");
        return;
      } finally {
        setResolving(false);
      }
    }

    if (
      isBroadAdministrativeSearchArea(suggestion.resultType, suggestion.label) &&
      searchMode !== "boundary"
    ) {
      setSelectionError(
        "Det här området saknar en verifierad gräns. Välj en ort, stadsdel eller adress i området.",
      );
      return;
    }

    onSelect({
      label: suggestion.label,
      lat: suggestion.lat,
      lng: suggestion.lng,
      provider: "geoapify",
      placeId: selectedPlaceId,
      city: suggestion.city,
      area: suggestion.area,
      resultType: suggestion.resultType,
      searchMode,
      boundary,
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
    if (event.key === "Enter" && open) {
      const activeSuggestion = activeIx >= 0 ? suggestions[activeIx] : undefined;
      const demoSuggestion = demoMode
        ? demoAutocompleteLocations(value, demoFallbackCity, 6)
            .map((row) => toLocationSuggestion(row, allowBoundaryAreas))
            .find((suggestion) => !suggestion.blocked && matchesDemoInputExactly(suggestion, value))
        : undefined;
      const suggestion = activeSuggestion ?? demoSuggestion;
      if (suggestion && !suggestion.blocked) {
        event.preventDefault();
        void pick(suggestion);
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
    <div className="relative min-w-0">
      <Input
        id={id}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setOpen(true);
          if (next.trim() === "" && onClearVerified) onClearVerified();
        }}
        onFocus={() => {
          if (blurTimerRef.current != null) {
            window.clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
          }
          setOpen(true);
        }}
        onBlur={() => {
          if (blurTimerRef.current != null) {
            window.clearTimeout(blurTimerRef.current);
          }
          blurTimerRef.current = window.setTimeout(() => {
            setOpen(false);
            blurTimerRef.current = null;
          }, 150);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Sök ort, stadsdel eller adress"}
        autoComplete="off"
        disabled={disabled || resolving}
        aria-invalid={ariaInvalid || !!selectionError}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-activedescendant={activeIx >= 0 && id ? `${id}-opt-${activeIx}` : undefined}
      />
      {selectionError ? (
        <p className="mt-1 text-xs leading-snug text-destructive" role="alert">
          {selectionError}
        </p>
      ) : resolving ? (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          Kontrollerar områdets gräns…
        </p>
      ) : null}
      {showList ? (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="relative z-30 mt-1 max-h-[min(38dvh,18rem)] w-full min-w-0 overflow-auto overscroll-contain rounded-md border bg-popover p-1 text-sm shadow-md sm:absolute sm:max-h-72"
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
                  disabled={suggestion.blocked || resolving}
                  aria-label={`${suggestion.primaryLabel}. ${suggestion.secondaryLabel}`}
                  className={[
                    "w-full min-w-0 rounded px-2 py-2 text-left",
                    suggestion.blocked
                      ? "cursor-not-allowed text-muted-foreground opacity-75"
                      : "hover:bg-accent",
                    !suggestion.blocked && index === activeIx ? "bg-accent" : "",
                  ].join(" ")}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void pick(suggestion);
                  }}
                >
                  <span className="block min-w-0 break-words font-medium text-foreground">
                    {suggestion.primaryLabel}
                  </span>
                  <span className="mt-0.5 block min-w-0 break-words text-xs leading-snug text-muted-foreground">
                    {suggestion.secondaryLabel}
                  </span>
                  {suggestion.blocked ? (
                    <span className="mt-1 block text-xs leading-snug">
                      Välj en kommun, ort, stadsdel eller adress som kan avgränsas säkert.
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
