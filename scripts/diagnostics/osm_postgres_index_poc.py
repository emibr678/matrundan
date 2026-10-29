#!/usr/bin/env python3
"""Issue #512: ephemeral public-OSM PostgreSQL/PostGIS sizing and quality audit.

Prepare streams GeoJSONSeq into local CSV files for import; measure uses a
local PostgreSQL 17 + PostGIS 3.6 CI container. Does not contact Supabase.
No source changes, real DB writes, releases, or private app data.
"""
import argparse
import csv
import json
import math
import os
import statistics
import subprocess
import time
from collections import Counter
from pathlib import Path

FOOD = {"restaurant", "fast_food", "cafe", "bar", "pub",
        "food_court", "biergarten", "ice_cream"}
CATEGORIES = {
    "Pasta": ("pasta",),
    "Falafel": ("falafel",),
    "Ramen": ("ramen",),
    # Illustrative query only, not an approved product category mapping
    "Asiatiskt": ("asian", "chinese", "japanese", "korean", "thai",
                  "vietnamese", "indonesian", "malaysian", "filipino",
                  "taiwanese", "sushi", "ramen"),
}
AREAS = {"Stockholm": (59.3293, 18.0686), "Värnamo": (57.186, 14.041)}
REFERENCE = {318324117, 360935262, 707627932, 712621281, 810044221,
             957961775, 1258633968, 1349576854, 1580839502,
             1717695879, 2238199867, 5079680337, 7117300291,
             9186795630, 11197610953, 11829871768, 11907603210,
             12300183770, 13359851124}


def get_point(geometry):
    coords = geometry.get("coordinates")
    if geometry.get("type") == "Point":
        if not isinstance(coords, list) or len(coords) < 2:
            return None
        lon, lat = coords[:2]
        approx = False
    else:
        def points(value):
            if not isinstance(value, list):
                return
            if len(value) >= 2 and all(isinstance(x, (float, int)) for x in value[:2]):
                yield value[0], value[1]
            else:
                for part in value:
                    yield from points(part)
        pairs = list(points(coords))
        if not pairs:
            return None
        lon = sum(pair[0] for pair in pairs) / len(pairs)
        lat = sum(pair[1] for pair in pairs) / len(pairs)
        approx = True
    if (not isinstance(lon, (int, float))
            or not isinstance(lat, (int, float))
            or not math.isfinite(lon) or not math.isfinite(lat)
            or not (-180 <= lon <= 180 and -90 <= lat <= 90)):
        return None
    return float(lat), float(lon), approx


def normalized_tokens(text):
    return sorted({v.strip().lower().replace(" ", "_") for v in text.split(";") if v.strip()})


def prepare(src, dest):
    dest.mkdir(parents=True, exist_ok=True)
    counts, amenity_counts = Counter(), Counter()
    approx = 0
    no_name = 0
    no_cuisine = 0
    has_address = 0
    has_website = 0
    has_hours = 0
    has_phone = 0
    city_samples = Counter()
    start = time.perf_counter()
    with (dest / "places.csv").open("w", newline="", encoding="utf-8") as places_file, (dest / "tokens.csv").open("w", newline="", encoding="utf-8") as tokens_file, src.open(encoding="utf-8") as features:
        pw, tw = csv.writer(places_file), csv.writer(tokens_file)
        for line in features:
            line = line.lstrip("\x1e").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                tags = obj.get("properties") or {}
                typ, oid = tags.get("@type"), tags.get("@id")
                if typ not in {"node", "way", "relation"} or not isinstance(oid, int):
                    counts["invalid_identity"] += 1
                    continue
                if tags.get("amenity") not in FOOD and tags.get("shop") != "bakery":
                    counts["not_a_food_place"] += 1
                    continue
                loc = get_point(obj.get("geometry") or {})
                if loc is None:
                    counts["missing_geometry"] += 1
                    continue
                lat, lon, approximate = loc
                name = tags.get("name") or ""
                cuisine = tags.get("cuisine") or ""
                website = (tags.get("website") or tags.get("contact:website") or "")
                phone = (tags.get("phone") or tags.get("contact:phone") or "")
                street = tags.get("addr:street") or ""
                house = tags.get("addr:housenumber") or ""
                postcode = tags.get("addr:postcode") or ""
                city = tags.get("addr:city") or ""
                hours = tags.get("opening_hours") or ""
                name, cuisine = str(name), str(cuisine)
                safe_tags = {k: v for k, v in tags.items() if not k.startswith("@")}
                pw.writerow([typ, oid, name, tags.get("amenity") or "", tags.get("shop") or "",
                             cuisine, lat, lon, str(approximate).lower(),
                             street, house, postcode, city, website, hours, phone,
                             json.dumps(safe_tags, ensure_ascii=False)])
                for token in normalized_tokens(cuisine):
                    tw.writerow([token, typ, oid])
                counts[typ] += 1
                amenity_counts[tags.get("amenity") or "shop:" + str(tags.get("shop"))] += 1
                approx += approximate
                no_name += not bool(name.strip())
                no_cuisine += not bool(cuisine.strip())
                has_address += bool(street or postcode)
                has_website += bool(website)
                has_hours += bool(hours)
                has_phone += bool(phone)
                if city:
                    city_samples[str(city)] += 1
            except (ValueError, TypeError, KeyError, json.JSONDecodeError):
                counts["invalid_record"] += 1
    total = sum(counts[x] for x in ("node", "way", "relation"))
    summary = {
        "total_places": total, "by_osm_type": {x: counts[x] for x in ("node", "way", "relation")},
        "by_amenity": dict(amenity_counts),
        "skipped": {k: v for k, v in counts.items() if k not in ("node", "way", "relation")},
        "missing_name": no_name, "missing_cuisine": no_cuisine,
        "has_address_street_or_postcode": has_address,
        "has_website": has_website, "has_opening_hours": has_hours,
        "has_phone": has_phone, "approximate_way_relation_position": approx,
        "top_addr_city_tags": city_samples.most_common(12),
        "csv_places_bytes": (dest / "places.csv").stat().st_size,
        "csv_tokens_bytes": (dest / "tokens.csv").stat().st_size,
        "csv_build_seconds": round(time.perf_counter() - start, 3),
        "limitations": [
            "OSM objects, not verified unique operating businesses; same business can be tagged on a node and a polygon",
            "Only the selected food amenity/shop tags, not every possible food-related OSM feature",
            "Closed/disused venues with removed amenity tag may be excluded before audit",
            "Way/relation point is only the approximate vertex average, not a point-on-surface",
            "Address, website, cuisine and opening hours are voluntary OSM attributes",
        ]
    }
    (dest / "quality.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps({k: v for k, v in summary.items() if k in
                      ("total_places", "missing_name", "missing_cuisine",
                       "has_address_street_or_postcode", "has_website", "has_opening_hours")},
                     ensure_ascii=False, indent=2))


def sql(text):
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", text],
        text=True, capture_output=True, check=True)
    return result.stdout.strip()


def measure(dest):
    result = json.loads((dest / "quality.json").read_text())
    sizes = json.loads(sql("""
    SELECT json_build_object(
      'postgres_version', version(),
      'postgis_version', postgis_version(),
      'places_table_bytes', pg_relation_size('osm_places'),
      'places_indexes_bytes', pg_indexes_size('osm_places'),
      'places_total_bytes', pg_total_relation_size('osm_places'),
      'tokens_total_bytes', pg_total_relation_size('osm_tokens'),
      'combined_bytes', pg_total_relation_size('osm_places') + pg_total_relation_size('osm_tokens'),
      'places_rows', (SELECT count(*) FROM osm_places),
      'token_rows', (SELECT count(*) FROM osm_tokens)
    )::text;
    """))
    measures = {}
    for area, (lat, lon) in AREAS.items():
        measures[area] = {}
        point = f"ST_SetSRID(ST_MakePoint({lon},{lat}),4326)::geography"
        for label, tokens in CATEGORIES.items():
            ts = ",".join("'" + t.replace("'", "''") + "'" for t in tokens)
            common = ("FROM osm_places p WHERE "
                      f"ST_DWithin(p.geom,{point},5000) "
                      "AND EXISTS (SELECT 1 FROM osm_tokens t "
                      "WHERE t.osm_type=p.osm_type AND t.osm_id=p.osm_id "
                      f"AND t.token IN ({ts}))")
            count = int(sql("SELECT count(*) " + common + ";"))
            select = ("SELECT p.osm_type,p.osm_id,p.name "
                      + common + f" ORDER BY ST_Distance(p.geom,{point}) LIMIT 20")
            samples = []
            for _ in range(8):
                plan = json.loads(sql("EXPLAIN (ANALYZE, FORMAT JSON) " + select + ";"))
                samples.append(float(plan[0]["Execution Time"]))
            measures[area][label] = {
                "count":count,
                "server_execution_median_ms":round(statistics.median(samples),3),
                "server_execution_max_ms":round(max(samples),3),
            }
    found = {int(x) for x in sql(
        "SELECT osm_id FROM osm_places WHERE osm_type='node' "
        "AND EXISTS (SELECT 1 FROM osm_tokens t "
        "WHERE t.osm_type=osm_places.osm_type AND t.osm_id=osm_places.osm_id "
        "AND t.token='pasta') "
        "AND ST_DWithin(geom,ST_SetSRID(ST_MakePoint(18.0686,59.3293),4326)::geography,5000);"
    ).splitlines() if x.strip()}
    duplicate_bins = int(sql("""
    SELECT count(*) FROM (
      SELECT lower(trim(name)) AS n, round(lat::numeric,3) AS la,
             round(lon::numeric,3) AS lo, count(*) AS c
      FROM osm_places
      WHERE trim(name) <> ''
      GROUP BY lower(trim(name)),round(lat::numeric,3),round(lon::numeric,3)
      HAVING count(*) > 1
    ) s;
    """))
    result.update({
        "postgresql": sizes,
        "query_results": measures,
        "spatial_and_search_index_note":
            "PostGIS geography GIST, B-tree normalized names, cuisine token PK/index; local in-runner database, no network or app latency included",
        "potential_close_name_coordinate_duplicate_groups_approx_100m": duplicate_bins,
        "reference_pasta_19": {
            "matched":len(found & REFERENCE), "expected":len(REFERENCE),
            "missing":sorted(REFERENCE - found)
        },
        "scope": "Temporary GitHub Actions PostgreSQL/PostGIS container, NOT Supabase",
    })
    (dest / "report-postgres.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(json.dumps({"total_places":result["total_places"],
                      "postgres_bytes":sizes["combined_bytes"],
                      "pasta_reference":result["reference_pasta_19"],
                      "query_results":measures,
                      "potential_duplicates":duplicate_bins},
                     ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "measure"])
    parser.add_argument("--input", type=Path)
    parser.add_argument("--directory", required=True, type=Path)
    a = parser.parse_args()
    if a.mode == "prepare":
        if not a.input:
            parser.error("--input required for prepare")
        prepare(a.input, a.directory)
    else:
        measure(a.directory)


if __name__ == "__main__":
    main()
