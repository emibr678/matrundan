#!/usr/bin/env python3
"""ONE-TIME Issue #516 public OSM-only staging import.

Runs exclusively on an approved GitHub Actions staging job with its scoped
Management API token. NEVER writes canonical places or any private group data.
Data ingestion is idempotent by (generation_id, osm_type, osm_id). A failure
before activation leaves an inactive, non-queryable generation, not partial
search results. API endpoint is experimental; fail closed on changed response.
"""
from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_REF = "wpihfmwbubvdiaavtpia"
BATCH_SIZE = 175
EXPECTED_RANGE = (18_000, 40_000)
KNOWN_PASTA = (
    318324117, 360935262, 707627932, 712621281, 810044221,
    957961775, 1258633968, 1349576854, 1580839502, 1717695879,
    2238199867, 5079680337, 7117300291, 9186795630,
    11197610953, 11829871768, 11907603210, 12300183770, 13359851124,
)


def records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("result"), list):
        return payload["result"]
    raise RuntimeError("Unexpected Supabase SQL API response shape (fail closed)")


class Database:
    def __init__(self, token: str):
        if not token:
            raise RuntimeError("Missing dedicated staging Management API token")
        self.url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
        self.token = token
        self.calls = 0

    def query(self, sql: str):
        body = json.dumps({"query": sql}, separators=(",", ":")).encode("utf-8")
        for attempt in range(5):
            request = urllib.request.Request(
                self.url,
                data=body,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(request, timeout=100) as response:
                    if response.status not in (200, 201):
                        raise RuntimeError(f"Unexpected SQL API status {response.status}")
                    data = response.read(1_000_000)
                self.calls += 1
                return records(json.loads(data))
            except urllib.error.HTTPError as error:
                if error.code in (429, 502, 503, 504) and attempt < 4:
                    # Avoid tight request bursts against Supabase Management API.
                    time.sleep(min(35, 3 * (2 ** attempt)))
                    continue
                raise RuntimeError(f"Supabase SQL API refused query: HTTP {error.code}") from None
            except (TimeoutError, urllib.error.URLError) as error:
                if attempt < 4:
                    time.sleep(min(35, 3 * (2 ** attempt)))
                    continue
                raise RuntimeError(f"Supabase SQL API unavailable: {type(error).__name__}") from None
        raise RuntimeError("Supabase SQL API retries exhausted")

    def single(self, sql: str):
        result = self.query(sql)
        if len(result) != 1 or not isinstance(result[0], dict):
            raise RuntimeError("Unexpected SQL API result count")
        return result[0]


def validate_environment():
    expected = {
        "STAGING_SUPABASE_PROJECT_ID": PROJECT_REF,
        "GITHUB_REF": "refs/heads/feature/osm-staging-comparison-516",
        "GITHUB_REPOSITORY": "emibr678/matrundan",
        "OSM_IMPORT_CONFIRMATION": "IMPORT_OSM_STAGING_ONLY_516",
    }
    for key, value in expected.items():
        if os.environ.get(key) != value:
            raise RuntimeError(f"Safety guard failed: {key}")


def parse_csv(path: Path):
    rows = []
    seen = set()
    with path.open("r", encoding="utf-8", newline="") as stream:
        for row in csv.reader(stream):
            if len(row) != 8:
                raise RuntimeError("Unexpected CSV schema; no import attempted")
            typ, oid_str, name, amenity, shop, cuisine, raw, geometry = row
            oid = int(oid_str)
            key = (typ, oid)
            if typ not in ("node", "way", "relation") or oid <= 0 or key in seen:
                raise RuntimeError("Invalid or duplicate OSM identity in source")
            seen.add(key)
            tags, geo = json.loads(raw), json.loads(geometry)
            if not isinstance(tags, dict) or not isinstance(geo, dict):
                raise RuntimeError("Malformed OSM attributes or geometry")
            if geo.get("type") not in ("Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"):
                raise RuntimeError("Unsupported geometry unexpectedly emitted")
            rows.append({
                "osm_type": typ, "osm_id": oid, "name": name, "amenity": amenity,
                "shop": shop, "cuisine_raw": cuisine, "source_tags": tags,
                "geometry_json": geo,
            })
    if not EXPECTED_RANGE[0] <= len(rows) <= EXPECTED_RANGE[1]:
        raise RuntimeError(f"OSM import source count outside approved bounds: {len(rows)}")
    return rows


def insert_sql(generation: int, batch):
    # Raw user/provider text is NEVER interpolated into SQL. The only SQL-embedded
    # payload is a base64-encoded UTF-8 JSON constant.
    b64 = base64.b64encode(
        json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")
    return f"""
    WITH source AS (
      SELECT * FROM jsonb_to_recordset(
        convert_from(decode('{b64}','base64'),'UTF8')::jsonb
      ) AS t (
        osm_type text, osm_id bigint, name text, amenity text, shop text,
        cuisine_raw text, source_tags jsonb, geometry_json jsonb
      )
    ), shapes AS (
      SELECT source.*, extensions.ST_GeomFromGeoJSON(geometry_json::text) AS geom
      FROM source
    ), valid AS (
      SELECT *,
        extensions.ST_PointOnSurface(geom)::extensions.geography AS geo_point
      FROM shapes
      WHERE geom IS NOT NULL AND NOT extensions.ST_IsEmpty(geom)
        AND extensions.ST_IsValid(geom)
    )
    INSERT INTO osm_staging.places (
      generation_id, osm_type, osm_id, name, amenity, shop, cuisine_raw,
      cuisine_tokens, source_tags, geometry_approximate, location
    )
    SELECT {generation}, osm_type, osm_id, name, amenity, shop, cuisine_raw,
      ARRAY(
        SELECT DISTINCT replace(trim(lower(token)), ' ', '_')
        FROM unnest(string_to_array(coalesce(cuisine_raw,''),';')) AS token
        WHERE trim(token) <> ''
      ),
      source_tags, (geometry_json->>'type') NOT IN
        ('Point','Polygon','MultiPolygon'), geo_point
    FROM valid
    ON CONFLICT (generation_id,osm_type,osm_id) DO NOTHING
    RETURNING osm_id;
    """


def finish_report(path: Path, report: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def run(args):
    validate_environment()
    source_hash = os.environ.get("OSM_SHA256", "").lower()
    timestamp = os.environ.get("OSM_TIMESTAMP", "")
    if not re.fullmatch(r"[0-9a-f]{64}", source_hash):
        raise RuntimeError("Invalid source SHA-256")
    if not re.fullmatch(r"20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:]+Z", timestamp):
        raise RuntimeError("Unexpected OSM replication timestamp")
    if hashlib.sha256(args.pbf.read_bytes()).hexdigest() != source_hash:
        raise RuntimeError("PBF download checksum does not match source")
    source_rows = parse_csv(args.csv)
    source_count = len(source_rows)
    db = Database(os.environ.get("STAGING_SUPABASE_ACCESS_TOKEN", ""))
    health = db.single("""
      SELECT current_database() AS database,
        (SELECT extversion FROM pg_extension WHERE extname='postgis') AS postgis,
        (to_regclass('osm_staging.places') IS NOT NULL) AS schema_ready,
        (SELECT count(*) FROM osm_staging.current_generation) AS active_pointers;
    """)
    if health.get("database") != "postgres" or health.get("postgis") != "3.3.7" or health.get("schema_ready") is not True:
        raise RuntimeError("Staging DB schema/version check failed")
    generations = db.query("""
      SELECT g.id, g.source_sha256, g.status, g.expected_count
      FROM osm_staging.generations g ORDER BY g.id;
    """)
    if len(generations) > 2:
        raise RuntimeError("Unexpected existing OSM generation count; manual review needed")
    different = [g for g in generations if g["source_sha256"] != source_hash]
    if different:
        raise RuntimeError("Existing snapshot uses a different OSM source; manual review required")
    if generations:
        current = generations[-1]
        if current["status"] == "active":
            raise RuntimeError("OSM snapshot already active: refuse repeated import")
        if current["status"] != "building":
            raise RuntimeError("Existing generation requires manual review")
        generation = int(current["id"])
    else:
        # Controlled fixed-string/hex/timestamp values only.
        row = db.single(
            "INSERT INTO osm_staging.generations "
            "(source_timestamp,source_sha256,importer_version,status,expected_count) "
            f"VALUES ('{timestamp}'::timestamptz,'{source_hash}','github-actions-516-v1',"
            f"'building',{source_count}) RETURNING id;"
        )
        generation = int(row["id"])
    report = {
        "project": PROJECT_REF, "source_sha256": source_hash,
        "source_timestamp": timestamp, "total_source_rows": source_count,
        "generation": generation, "started_at_epoch": int(time.time()),
    }
    finish_report(args.report, report)
    # Fixed batch count; do not print per-row source data.
    for start in range(0, source_count, BATCH_SIZE):
        db.query(insert_sql(generation, source_rows[start:start+BATCH_SIZE]))
        done = min(source_count, start+BATCH_SIZE)
        if done % 1750 == 0 or done == source_count:
            print(f"Imported/verified staging batch through source item {done}/{source_count}", flush=True)
    counts = db.single(
        "SELECT count(*)::int AS count, "
        "count(*) FILTER (WHERE cuisine_tokens @> ARRAY['pasta'])::int AS with_pasta, "
        "count(*) FILTER (WHERE osm_type='node' AND osm_id=ANY(ARRAY[" +
        ",".join(str(i) for i in KNOWN_PASTA) +
        "]))::int AS reference_nodes "
        f"FROM osm_staging.places WHERE generation_id={generation};"
    )
    if int(counts["count"]) != source_count or int(counts["reference_nodes"]) < 15:
        raise RuntimeError("Staging count or known OSM identities failed validation; generation not activated")
    if not 10 <= int(counts["with_pasta"]) <= 2000:
        raise RuntimeError("Staging cuisine tag validation failed")
    # Cross-check source SHA and expected count before switching active generation.
    check = db.single(
        "UPDATE osm_staging.generations SET status='validated', validated_at=now() "
        f"WHERE id={generation} AND status='building' AND source_sha256='{source_hash}' "
        f"AND expected_count={source_count} RETURNING id;"
    )
    if int(check["id"]) != generation:
        raise RuntimeError("Could not validate staging generation")
    activated = db.single(
        f"WITH activation AS (SELECT osm_staging.activate_validated_generation({generation})) "
        "SELECT c.generation_id AS active_id FROM osm_staging.current_generation c;"
    )
    if int(activated["active_id"]) != generation:
        raise RuntimeError("OSM staging generation activation not confirmed")
    summary = db.single(
        "SELECT (SELECT count(*)::int FROM osm_staging.places "
        f"WHERE generation_id={generation}) AS places, "
        "(SELECT pg_total_relation_size('osm_staging.places')::bigint) AS bytes, "
        "(SELECT pg_database_size(current_database())::bigint) AS db_bytes;"
    )
    report.update({
        "status": "active", "actual_imported": counts["count"],
        "known_reference_count": counts["reference_nodes"],
        "pasta_tagged_national_count": counts["with_pasta"],
        "places_total_bytes": summary["bytes"], "database_bytes": summary["db_bytes"],
        "sql_requests": db.calls, "finished_at_epoch": int(time.time()),
    })
    finish_report(args.report, report)
    print(json.dumps(report, indent=2, ensure_ascii=False), flush=True)


def self_test():
    sample = [{
        "osm_type":"node","osm_id":1,"name":"Bageri 'O' $foo$",
        "amenity":"cafe","shop":"","cuisine_raw":"pasta",
        "source_tags":{"name":"a'b","cuisine":"pasta"},
        "geometry_json":{"type":"Point","coordinates":[18.06,59.3]},
    }]
    sql = insert_sql(1, sample)
    assert "Bageri" not in sql and "a'b" not in sql
    assert "ON CONFLICT" in sql and "ST_PointOnSurface" in sql
    encoded = re.search(r"decode\('([^']+)','base64'\)",sql).group(1)
    assert json.loads(base64.b64decode(encoded))[0]["name"] == sample[0]["name"]
    print("Synthetic payload encoding and idempotent SQL smoke passed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path)
    parser.add_argument("--pbf", type=Path)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.csv or not args.pbf or not args.report:
        parser.error("--csv, --pbf and --report are required")
    run(args)


if __name__ == "__main__":
    main()
