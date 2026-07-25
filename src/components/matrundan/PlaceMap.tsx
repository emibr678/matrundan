import * as React from "react";
import { ArrowRight, LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PlaceMapItem {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  eyebrow?: string;
  description?: string;
  markerLabel?: string;
}

interface PlaceMapProps {
  items: PlaceMapItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onAction?: (item: PlaceMapItem) => void;
  actionLabel?: string;
  center?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
  className?: string;
  emptyText?: string;
  ariaLabel?: string;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

type Point = { x: number; y: number };

type MapFrame = {
  center: Point;
  centerLatLng: { lat: number; lng: number };
  zoom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function project(lat: number, lng: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject(point: Point, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (point.x / scale) * 360 - 180;
  const y = 0.5 - point.y / scale;
  const lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
  return { lat, lng };
}

function fitFrame(
  points: { lat: number; lng: number }[],
  width: number,
  height: number,
  zoomOffset: number,
): MapFrame {
  const fallback = points[0] ?? { lat: 57.7089, lng: 11.9746 };
  const usableWidth = Math.max(180, width - 96);
  const usableHeight = Math.max(160, height - 150);
  let fittedZoom = 13;

  if (points.length > 1) {
    for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
      const projected = points.map((point) => project(point.lat, point.lng, zoom));
      const xs = projected.map((point) => point.x);
      const ys = projected.map((point) => point.y);
      if (
        Math.max(...xs) - Math.min(...xs) <= usableWidth &&
        Math.max(...ys) - Math.min(...ys) <= usableHeight
      ) {
        fittedZoom = zoom;
        break;
      }
    }
  }

  const zoom = clamp(fittedZoom + zoomOffset, MIN_ZOOM, MAX_ZOOM);
  const projected = points.map((point) => project(point.lat, point.lng, zoom));
  const center = projected.length
    ? {
        x:
          (Math.min(...projected.map((point) => point.x)) +
            Math.max(...projected.map((point) => point.x))) /
          2,
        y:
          (Math.min(...projected.map((point) => point.y)) +
            Math.max(...projected.map((point) => point.y))) /
          2,
      }
    : project(fallback.lat, fallback.lng, zoom);

  return { center, centerLatLng: unproject(center, zoom), zoom };
}

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

export function PlaceMap({
  items,
  selectedId,
  onSelect,
  onAction,
  actionLabel = "Öppna",
  center,
  radiusKm,
  className,
  emptyText = "Inga platser med kartposition i den här vyn.",
  ariaLabel = "Karta över matställen",
}: PlaceMapProps) {
  const mappedItems = React.useMemo(
    () => items.filter((item) => item.lat != null && item.lng != null),
    [items],
  );
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 720, height: 420 });
  const [zoomOffset, setZoomOffset] = React.useState(0);

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => setZoomOffset(0), [items]);

  const fitPoints = React.useMemo(() => {
    const points = mappedItems.map((item) => ({ lat: item.lat!, lng: item.lng! }));
    if (center) points.push(center);
    return points;
  }, [mappedItems, center]);

  const frame = React.useMemo(
    () => fitFrame(fitPoints, size.width, size.height, zoomOffset),
    [fitPoints, size.width, size.height, zoomOffset],
  );

  const selected = mappedItems.find((item) => item.id === selectedId) ?? mappedItems[0] ?? null;
  const geoapifyKey = (import.meta as ImportMeta & { env?: { VITE_GEOAPIFY_MAPS_KEY?: string } })
    .env?.VITE_GEOAPIFY_MAPS_KEY;
  const tileCount = 2 ** frame.zoom;
  const minTileX = Math.floor((frame.center.x - size.width / 2) / TILE_SIZE) - 1;
  const maxTileX = Math.floor((frame.center.x + size.width / 2) / TILE_SIZE) + 1;
  const minTileY = Math.max(0, Math.floor((frame.center.y - size.height / 2) / TILE_SIZE) - 1);
  const maxTileY = Math.min(
    tileCount - 1,
    Math.floor((frame.center.y + size.height / 2) / TILE_SIZE) + 1,
  );
  const tiles: { x: number; y: number; displayX: number; key: string }[] = [];
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({ x: wrappedX, y, displayX: x, key: `${x}:${y}` });
    }
  }

  const radiusPixels =
    center && radiusKm
      ? Math.min(
          Math.max((radiusKm * 1000) / metersPerPixel(center.lat, frame.zoom), 8),
          Math.max(size.width, size.height) * 1.5,
        )
      : 0;

  if (mappedItems.length === 0 && !center) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground ${className ?? ""}`}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative min-h-[320px] overflow-hidden rounded-2xl border border-border/70 bg-muted ${className ?? ""}`}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {geoapifyKey ? (
          tiles.map((tile) => {
            const left = tile.displayX * TILE_SIZE - frame.center.x + size.width / 2;
            const top = tile.y * TILE_SIZE - frame.center.y + size.height / 2;
            const src = `https://maps.geoapify.com/v1/tile/osm-bright/${frame.zoom}/${tile.x}/${tile.y}.png?apiKey=${encodeURIComponent(geoapifyKey)}`;
            return (
              <img
                key={tile.key}
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
                style={{ left, top }}
              />
            );
          })
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[size:24px_24px] opacity-70" />
        )}
      </div>

      {!geoapifyKey ? (
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-5.5rem)] rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
          Kartbakgrunden visas när en domänbegränsad Geoapify-nyckel är konfigurerad.
        </div>
      ) : null}

      {center && radiusPixels > 0 ? (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-primary/60 bg-primary/10"
          style={{
            width: radiusPixels * 2,
            height: radiusPixels * 2,
            left:
              project(center.lat, center.lng, frame.zoom).x -
              frame.center.x +
              size.width / 2 -
              radiusPixels,
            top:
              project(center.lat, center.lng, frame.zoom).y -
              frame.center.y +
              size.height / 2 -
              radiusPixels,
          }}
          aria-hidden="true"
        />
      ) : null}

      {center ? (
        <div
          className="pointer-events-none absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow"
          style={{
            left: project(center.lat, center.lng, frame.zoom).x - frame.center.x + size.width / 2,
            top: project(center.lat, center.lng, frame.zoom).y - frame.center.y + size.height / 2,
          }}
          title="Sökcentrum"
        >
          <LocateFixed className="h-4 w-4" />
        </div>
      ) : null}

      {mappedItems.map((item, index) => {
        const point = project(item.lat!, item.lng!, frame.zoom);
        const active = selected?.id === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            className={[
              "absolute grid h-9 min-w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full border-2 px-2 text-xs font-semibold shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "z-20 scale-110 border-background bg-primary text-primary-foreground"
                : "z-10 border-background bg-card text-foreground hover:scale-105",
            ].join(" ")}
            style={{
              left: point.x - frame.center.x + size.width / 2,
              top: point.y - frame.center.y + size.height / 2,
            }}
            aria-label={`Visa ${item.name}`}
            aria-pressed={active}
          >
            {item.markerLabel ?? index + 1}
          </button>
        );
      })}

      <div className="absolute right-3 top-3 z-30 flex flex-col gap-1 rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => setZoomOffset((value) => clamp(value + 1, -4, 4))}
          aria-label="Zooma in kartan"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => setZoomOffset((value) => clamp(value - 1, -4, 4))}
          aria-label="Zooma ut kartan"
        >
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      {selected ? (
        <div className="absolute inset-x-3 bottom-8 z-30 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              {selected.eyebrow ? (
                <div className="truncate text-[11px] font-medium text-primary">
                  {selected.eyebrow}
                </div>
              ) : null}
              <div className="truncate font-medium">{selected.name}</div>
              {selected.description ? (
                <div className="truncate text-xs text-muted-foreground">{selected.description}</div>
              ) : null}
            </div>
            {onAction ? (
              <Button
                type="button"
                size="sm"
                className="min-h-11 shrink-0"
                onClick={() => onAction(selected)}
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-background/85 px-2 py-1 text-center text-[10px] text-muted-foreground backdrop-blur-sm">
        {geoapifyKey
          ? "Kartbilder © Geoapify · Kartdata © OpenStreetMap-bidragsgivare"
          : "Kartpositioner visas utan extern kartbakgrund"}
      </div>
    </div>
  );
}
