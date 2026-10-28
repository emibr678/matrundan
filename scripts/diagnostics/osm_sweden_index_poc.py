#!/usr/bin/env python3
"""Isolated, read-only OSM Sweden food-place indexing PoC for Issue #512.

Input: GeoJSON Sequence produced by osmium export from a Geofabrik extract.
Outputs: local ephemeral SQLite index and public-data-only JSON metrics.
Never connects to Matrundan, Supabase, Cloudflare, or a user account.
"""
import argparse
import json
import math
import sqlite3
import time
from collections import Counter
from pathlib import Path

FOOD = {"restaurant", "fast_food", "cafe", "bar", "pub", "food_court", "biergarten", "ice_cream"}
AREAS = {"Stockholm": (59.3293, 18.0686), "Värnamo": (57.186, 14.041)}
SEARCHES = {
    "Pasta": ("pasta",),
    "Falafel": ("falafel",),
    "Ramen": ("ramen",),
    # Illustrative only, not an approved product taxonomy:
    "Asiatiskt": ("asian", "japanese", "chinese", "korean", "thai",
                  "vietnamese", "taiwanese", "indonesian", "malaysian",
                  "filipino", "sushi", "ramen"),
}
PASTA_REFERENCE = {
    318324117, 360935262, 707627932, 712621281, 810044221,
    957961775, 1258633968, 1349576854, 1580839502, 1717695879,
    2238199867, 5079680337, 7117300291, 9186795630,
    11197610953, 11829871768, 11907603210, 12300183770, 13359851124,
}


def location(geometry):
    coords = geometry.get("coordinates")
    if geometry.get("type") == "Point" and isinstance(coords, list) and len(coords) >= 2:
        lon, lat = coords[:2]
        approx = False
    else:
        def pairs(x):
            if not isinstance(x, list):
                return
            if len(x) >= 2 and all(isinstance(y, (int, float)) for y in x[:2]):
                yield x[0], x[1]
            else:
                for y in x:
                    yield from pairs(y)
        points = list(pairs(coords))
        if not points:
            return None
        lon = sum(x for x, _ in points) / len(points)
        lat = sum(y for _, y in points) / len(points)
        approx = True
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    if not math.isfinite(lat) or not math.isfinite(lon):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return float(lat), float(lon), approx


def distance(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 12742.0176 * math.asin(min(1.0, math.sqrt(h)))


def build(src, db_path):
    db = sqlite3.connect(db_path)
    db.executescript("""
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        CREATE TABLE places (
          osm_type TEXT NOT NULL, osm_id INTEGER NOT NULL, name TEXT NOT NULL,
          amenity TEXT, shop TEXT, cuisine TEXT, lat REAL NOT NULL, lon REAL NOT NULL,
          approximate INTEGER NOT NULL,
          PRIMARY KEY (osm_type, osm_id)
        );
        CREATE TABLE cuisine_tokens (
          token TEXT NOT NULL, osm_type TEXT NOT NULL, osm_id INTEGER NOT NULL,
          PRIMARY KEY (token, osm_type, osm_id)
        );
    """)
    counts, skipped = Counter(), Counter()
    start = time.perf_counter()
    for i, line in enumerate(src.open(encoding="utf-8"), 1):
        line = line.lstrip("\x1e").strip()
        if not line:
            continue
        try:
            f = json.loads(line)
            tags = f.get("properties") or {}
            typ, oid = tags.get("@type"), tags.get("@id")
            if typ not in ("node", "way", "relation") or not isinstance(oid, int):
                skipped["identity"] += 1
                continue
            if tags.get("amenity") not in FOOD and tags.get("shop") != "bakery":
                skipped["not_food"] += 1
                continue
            point = location(f.get("geometry") or {})
            if point is None:
                skipped["geometry"] += 1
                continue
            lat, lon, approx = point
            cuisine = tags.get("cuisine") or ""
            c = db.execute(
                "INSERT OR IGNORE INTO places VALUES (?,?,?,?,?,?,?,?,?)",
                (typ, oid, tags.get("name") or "", tags.get("amenity"),
                 tags.get("shop"), cuisine, lat, lon, int(approx)),
            )
            if c.rowcount == 0:
                skipped["duplicate_geometry"] += 1
                continue
            counts[typ] += 1
            for token in {x.strip().lower().replace(" ", "_")
                          for x in cuisine.split(";") if x.strip()}:
                db.execute("INSERT OR IGNORE INTO cuisine_tokens VALUES (?,?,?)", (token, typ, oid))
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            skipped["invalid_feature"] += 1
        if i % 10000 == 0:
            db.commit()
    db.commit()
    db.executescript("""
        CREATE INDEX places_lat_lon ON places(lat, lon);
        CREATE INDEX cuisine_osm ON cuisine_tokens(osm_type, osm_id);
    """)
    db.execute("VACUUM")
    db.commit()
    return db, {
        "places": sum(counts.values()),
        "by_osm_type": dict(counts),
        "skipped": dict(skipped),
        "geometry_approximate": db.execute(
            "SELECT count(*) FROM places WHERE approximate=1").fetchone()[0],
        "with_cuisine": db.execute(
            "SELECT count(*) FROM places WHERE cuisine != ''").fetchone()[0],
        "distinct_cuisine_tokens": db.execute(
            "SELECT count(DISTINCT token) FROM cuisine_tokens").fetchone()[0],
        "build_seconds": round(time.perf_counter() - start, 2),
    }


def search(db, lat, lon, tokens):
    lat_d = 5.0 / 111.32
    lon_d = 5.0 / max(0.1, 111.32 * math.cos(math.radians(lat)))
    keys = ",".join("?" * len(tokens))
    candidates = db.execute(
        "SELECT DISTINCT p.osm_type,p.osm_id,p.name,p.cuisine,p.lat,p.lon,p.approximate "
        "FROM cuisine_tokens c JOIN places p USING (osm_type,osm_id) "
        f"WHERE c.token IN ({keys}) AND p.lat BETWEEN ? AND ? AND p.lon BETWEEN ? AND ?",
        (*tokens, lat-lat_d, lat+lat_d, lon-lon_d, lon+lon_d),
    ).fetchall()
    found = []
    for typ, oid, name, cuisine, plat, plon, approx in candidates:
        km = distance(lat, lon, plat, plon)
        if km <= 5:
            found.append({
                "osm_type":typ,"osm_id":oid,"name":name,
                "cuisine":cuisine,"km":round(km, 3),
                "approximate_geometry":bool(approx),
            })
    return sorted(found, key=lambda x: (x["km"],x["osm_type"],x["osm_id"]))


def main():
    arg = argparse.ArgumentParser()
    for name in ("input", "db", "report", "source_pbf", "filtered_pbf"):
        arg.add_argument("--"+name.replace("_","-"), type=Path, required=True)
    a = arg.parse_args()
    db, metrics = build(a.input, a.db)
    if not metrics["places"]:
        raise SystemExit("No places indexed: invalid Osmium extraction, not a success.")
    measurements = {}
    for area, (lat, lon) in AREAS.items():
        measurements[area] = {}
        for label, tokens in SEARCHES.items():
            search(db, lat, lon, tokens)
            samples = []
            for _ in range(10):
                start = time.perf_counter()
                items = search(db, lat, lon, tokens)
                samples.append((time.perf_counter()-start)*1000)
            measurements[area][label] = {
                "count":len(items), "warm_median_ms":round(sorted(samples)[5],3),
                "warm_max_ms":round(max(samples),3), "first_15":items[:15],
            }
    found_ids = {x["osm_id"] for x in search(db, *AREAS["Stockholm"], ("pasta",))
                 if x["osm_type"] == "node"}
    report = {
        "scope":"one-off read-only public OSM PoC, no Matrundan integration",
        "data_source":"Geofabrik Sweden .osm.pbf",
        "geo_caveat":"way/relation coordinates use approximate vertex average, not point-on-surface",
        "source_pbf_bytes":a.source_pbf.stat().st_size,
        "filtered_pbf_bytes":a.filtered_pbf.stat().st_size,
        "geojsonseq_bytes":a.input.stat().st_size,
        "sqlite_bytes":a.db.stat().st_size,
        **metrics, "queries":measurements,
        "stockholm_5km_pasta_oct28_overpass_reference":{
            "total_expected":len(PASTA_REFERENCE),
            "matched":len(found_ids & PASTA_REFERENCE),
            "matched_node_ids":sorted(found_ids & PASTA_REFERENCE),
            "missing_node_ids":sorted(PASTA_REFERENCE - found_ids),
            "note":"Missing IDs may reflect Geofabrik snapshot lag or changed OSM source.",
        },
    }
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({
      "places":metrics["places"],"by_type":metrics["by_osm_type"],
      "sqlite_megabytes":round(report["sqlite_bytes"]/1048576,2),
      "pasta_stockholm":measurements["Stockholm"]["Pasta"]["count"],
      "overpass_reference_found":len(found_ids & PASTA_REFERENCE),
      "overpass_reference_expected":len(PASTA_REFERENCE),
      "report_path":str(a.report),
    },ensure_ascii=False,indent=2))
    db.close()


if __name__ == "__main__":
    main()
