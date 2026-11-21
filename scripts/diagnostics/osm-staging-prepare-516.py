#!/usr/bin/env python3
"""Issue #516: prepare public OSM-only food POIs for an *isolated* PostGIS import.

This offline parser never connects to Matrundan/Supabase. Data is restricted to
the Geofabrik OpenStreetMap snapshot and can be published separately under ODbL.
Input: osmium export --output-format=geojsonseq --attributes=type,id.
Output: CSV and public OSM-only quality report. Spatial validation and
point-on-surface are intentionally deferred to PostGIS, not vertex averaging.
"""
import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path

FOOD_AMENITIES = {
    "restaurant", "fast_food", "cafe", "pub", "bar", "food_court",
    "biergarten", "ice_cream",
}
GEOMETRY_PRIORITY = {
    "Point": 1, "LineString": 2, "MultiLineString": 2,
    "Polygon": 3, "MultiPolygon": 3,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    selected = {}
    observations = Counter()
    category_counts = Counter()
    missing_cuisine_by_amenity = Counter()
    total_by_amenity = Counter()
    closure_signals = Counter()

    with args.input.open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            try:
                feature = json.loads(line.lstrip("\x1e"))
                props = feature.get("properties") or {}
                osm_type, osm_id = props.get("@type"), props.get("@id")
                if osm_type not in ("node", "way", "relation") or not isinstance(osm_id, int) or osm_id <= 0:
                    observations["invalid_osm_identity"] += 1
                    continue
                amenity, shop = props.get("amenity"), props.get("shop")
                if amenity not in FOOD_AMENITIES and shop != "bakery":
                    observations["not_in_food_filter"] += 1
                    continue
                geometry = feature.get("geometry")
                if not isinstance(geometry, dict):
                    observations["no_geometry"] += 1
                    continue
                typ = geometry.get("type")
                priority = GEOMETRY_PRIORITY.get(typ, 0)
                if not priority or not isinstance(geometry.get("coordinates"), list):
                    observations["unsupported_geometry"] += 1
                    continue
                # Osmium can export a closed way as both polygon and linestring.
                # Preserve the polygon where available, one identity per OSM key.
                key = (osm_type, osm_id)
                current = selected.get(key)
                if current is not None:
                    observations["alternate_geometry"] += 1
                    if priority <= current[0]:
                        continue
                raw_tags = {k: v for k, v in props.items() if not k.startswith("@")}
                selected[key] = (
                    priority,
                    [
                        osm_type, osm_id, str(props.get("name") or ""),
                        str(amenity or ""), str(shop or ""), str(props.get("cuisine") or ""),
                        json.dumps(raw_tags, ensure_ascii=False, separators=(",", ":")),
                        json.dumps(geometry, ensure_ascii=False, separators=(",", ":")),
                    ],
                    str(amenity) if amenity else "shop:bakery",
                    raw_tags,
                )
            except (TypeError, ValueError, json.JSONDecodeError):
                observations["malformed_feature"] += 1

    with args.out.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        for key in sorted(selected):
            _rank, record, category, tags = selected[key]
            writer.writerow(record)
            category_counts[category] += 1
            total_by_amenity[category] += 1
            if not tags.get("name"):
                observations["no_name"] += 1
            if not tags.get("cuisine"):
                missing_cuisine_by_amenity[category] += 1
            if not (tags.get("addr:street") or tags.get("addr:postcode")):
                observations["missing_address"] += 1
            for tag in ("disused", "abandoned", "closed", "was:amenity", "disused:amenity", "abandoned:amenity"):
                if tag in tags:
                    closure_signals[tag] += 1

    report = {
        "source": "Geofabrik Sweden OpenStreetMap (ODbL 1.0)",
        "scope": "public OSM-only, offline; never imported into Matrundan canonical/group tables",
        "unique_osm_features": len(selected),
        "by_amenity": dict(category_counts),
        "missing_cuisine_by_amenity": dict(missing_cuisine_by_amenity),
        "total_by_amenity": dict(total_by_amenity),
        "observations": dict(observations),
        "closure_signal_tags": dict(closure_signals),
        "csv_bytes": args.out.stat().st_size,
        "geometry_policy": "retain exact OSM GeoJSON; PostGIS geometry validity and ST_PointOnSurface/line midpoint later; no vertex-mean shortcut",
        "note": "Missing cuisine or an old OSM timestamp does not imply a closed venue.",
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if len(selected) < 15000:
        raise SystemExit(f"Safety guard: only {len(selected)} OSM objects exported")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
