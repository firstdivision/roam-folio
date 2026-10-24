"""Build browser geography assets from the approved, checksummed source archives.

Run from repository root: .venv/bin/python scripts/geography/generate.py
The full matrix is checkpointed so interrupted generation can resume safely.
"""

from pathlib import Path
import argparse
import hashlib
import io
import json
import math
import time
import zipfile

import numpy as np
import pyproj
import shapefile
import shapely
from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely import orient_polygons

from distance import boundary_segments, build_tree, minimum_distance

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/geography"
OUTPUT = ROOT / "public/data"
VERSION = "natural-earth-5.1.1-policy-1"
TOLERANCE = 100.0


def read_source(source):
    path = DATA / "source" / (source["name"] + ".zip")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != source["sha256"]:
        raise ValueError(f"Source checksum mismatch: {path}")
    with zipfile.ZipFile(path) as archive:
        base = source["name"]
        if archive.read(base + ".VERSION.txt").decode().strip() != source["version"]:
            raise ValueError("Unexpected geographic release")
        reader = shapefile.Reader(
            shp=io.BytesIO(archive.read(base + ".shp")),
            shx=io.BytesIO(archive.read(base + ".shx")),
            dbf=io.BytesIO(archive.read(base + ".dbf")),
        )
        return [(record.record.as_dict(), shape(record.shape.__geo_interface__))
                for record in reader.iterShapeRecords()]


def load_geometries():
    lock = json.loads((DATA / "sources.lock.json").read_text())
    sources = [read_source(source) for source in lock["sources"]]
    countries = {props["ADM0_A3"]: (props, geometry) for props, geometry in sources[0]}
    # Documented source defect: Egypt has a self-touching ring. make_valid splits
    # the touch into valid polygons without moving vertices or inventing land.
    props, egypt = countries["EGY"]
    if not egypt.is_valid:
        repaired = shapely.make_valid(egypt)
        if repaired.geom_type not in {"Polygon", "MultiPolygon"} or abs(repaired.area - egypt.area) > 1e-9:
            raise ValueError("Egypt topology repair changed area; manual review required")
        countries["EGY"] = (props, repaired)
    units = sources[1]
    # Norway's country feature includes Bouvet. Explicitly use only approved units.
    nor_units = [(p, g) for p, g in units if p["GU_A3"] in {"NOW", "NJM", "NSV"}]
    assert {p["GU_A3"] for p, _ in nor_units} == {"NOW", "NJM", "NSV"}
    countries["NOR"] = (countries["NOR"][0], unary_union([g for _, g in nor_units]))
    bouvet = [(p, g) for p, g in units if p["GU_A3"] == "BVT"]
    assert len(bouvet) == 1
    countries["BVT"] = ({**bouvet[0][0], "ADMIN": "Bouvet Island"}, bouvet[0][1])
    # Aland is an integral autonomous region of Finland, a separate source feature.
    assert "ALD" in countries
    countries["FIN"] = (countries["FIN"][0], unary_union([countries["FIN"][1], countries["ALD"][1]]))
    del countries["ALD"]
    return countries, units


def json_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def display_coordinates(value, decimals):
    """Round display derivatives only; original distance geometry stays intact."""
    if isinstance(value, (float, int)):
        return round(value, decimals)
    return [display_coordinates(item, decimals) for item in value]


def write_display(source, pool, filename, tolerance, decimals):
    ids = {country["id"] for country in pool}
    features = []
    for id_, (props, geometry) in source.items():
        if not geometry.is_valid:
            raise ValueError(f"Invalid display geometry {id_}")
        # Shapefile/D3 winding is clockwise exterior; keep tiny components.
        display = orient_polygons(geometry.simplify(tolerance, preserve_topology=True), exterior_cw=True)
        display_geometry = mapping(display)
        display_geometry["coordinates"] = display_coordinates(display_geometry["coordinates"], decimals)
        rounded = shape(display_geometry)
        if rounded.is_valid and not rounded.is_empty:
            # Rounding can reverse a very thin island triangle. Reassert winding
            # AFTER rounding so D3 never interprets it as the rest of the globe.
            display_geometry = mapping(orient_polygons(rounded, exterior_cw=True))
        else:
            # Tiny features that collapse under rounding retain source precision.
            display_geometry = mapping(display)
        features.append({"type": "Feature", "properties": {
            "id": id_, "name": next((c["name"] for c in pool if c["id"] == id_), props["ADMIN"]),
            "eligible": id_ in ids,
        }, "geometry": display_geometry})
    json_write(OUTPUT / filename, {"type": "FeatureCollection", "features": features})


    path = OUTPUT / filename
    return {"simplificationDegrees": tolerance, "coordinateDecimals": decimals,
            "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def write_display_assets(source, pool):
    variants = {
        "world.v1.geojson": write_display(source, pool, "world.v1.geojson", 0.035, 4),
        "world.detail.v1.geojson": write_display(source, pool, "world.detail.v1.geojson", 0.005, 5),
    }
    json_write(DATA / "display.v1.json", {
        "sourceVersion": VERSION,
        "sourceLockSha256": hashlib.sha256((DATA / "sources.lock.json").read_bytes()).hexdigest(),
        "poolSha256": hashlib.sha256((ROOT / "data/countries/pool.v1.json").read_bytes()).hexdigest(),
        "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "variants": variants,
    })


def main(display_only=False):
    start = time.monotonic()
    pool = json.loads((ROOT / "data/countries/pool.v1.json").read_text())
    ids = [country["id"] for country in pool]
    source, units = load_geometries()
    assert len(ids) == len(set(ids)) == 125
    assert set(ids) <= set(source), set(ids) - set(source)
    geometries = {i: source[i][1] for i in ids}
    for id_, geometry in geometries.items():
        if not geometry.is_valid or geometry.is_empty:
            raise ValueError(f"Invalid source geometry {id_}")

    if display_only:
        write_display_assets(source, pool)
        print("Regenerated overview and detailed display maps; distance/schedule artifacts untouched.", flush=True)
        return

    # Use source ID, never ISO_A3 or sovereign code. Record full per-country crosswalk.
    crosswalk = {
        i: {
            "sourceField": "ADM0_A3", "sourceValue": i,
            "sourceLabel": source[i][0]["ADMIN"],
            "mapUnits": [p["GU_A3"] for p, _ in units if p["ADM0_A3"] == i and p["GU_A3"] != "BVT"],
            "components": len(geometries[i].geoms) if geometries[i].geom_type == "MultiPolygon" else 1,
        } for i in ids
    }
    crosswalk["FIN"]["additionalSourceValues"] = ["ALD"]
    crosswalk["NOR"]["excludedMapUnits"] = ["BVT"]
    crosswalk["CHN"]["excludedSourceValues"] = ["HKG", "MAC"]
    crosswalk["EGY"]["repair"] = "Shapely make_valid splits source self-touch at (35.621087106,23.139292914); no vertex movement, area change <1e-9 square degrees."
    (DATA / "crosswalk.v1.json").write_text(json.dumps(crosswalk, indent=2) + "\n")

    write_display_assets(source, pool)

    print("Building continuous boundary trees", flush=True)
    trees = {i: build_tree(boundary_segments(geometry)) for i, geometry in geometries.items()}
    print(f"Trees ready in {time.monotonic()-start:.1f}s", flush=True)
    checkpoint = DATA / "distances.checkpoint.json"
    source_fingerprint = hashlib.sha256((DATA / "crosswalk.v1.json").read_bytes()
        + (DATA / "sources.lock.json").read_bytes()
        + Path(__file__).read_bytes()
        + (Path(__file__).parent / "distance.py").read_bytes()).hexdigest()
    saved = json.loads(checkpoint.read_text()) if checkpoint.exists() else {}
    if saved.get("fingerprint") != source_fingerprint:
        saved = {"fingerprint": source_fingerprint, "pairs": {}}
    pairs = saved["pairs"]
    computed = 0
    for a_index, a in enumerate(ids):
        for b in ids[a_index + 1:]:
            key = ":".join(sorted([a, b]))
            if key in pairs:
                continue
            intersection = geometries[a].boundary.intersection(geometries[b].boundary)
            adjacent = intersection.length > 1e-9
            if adjacent:
                upper, lower, steps = 0.0, 0.0, 0
            else:
                upper, lower, steps = minimum_distance(trees[a], trees[b], TOLERANCE - 0.002)
                if upper < 1e-4:
                    raise ValueError(f"Unexpected nonadjacent zero distance {key}; review contact topology")
            pairs[key] = {"meters": math.ceil(upper * 1000) / 1000, "lowerMeters": math.floor(lower * 1000) / 1000, "borders": adjacent}
            computed += 1
            if computed % 100 == 0:
                json_write(checkpoint, saved)
                print(f"{len(pairs)}/7750 pairs; {time.monotonic()-start:.1f}s", flush=True)
        json_write(checkpoint, saved)

    if len(pairs) != 7750:
        raise ValueError("Incomplete matrix")
    result = {"version": VERSION, "toleranceMeters": TOLERANCE, "ids": ids, "pairs": pairs}
    json_write(OUTPUT / "distances.v1.json", result)
    json_write(DATA / "distances.v1.json", result)
    # Browser feedback omits proof metadata and repeated country keys. Pack the
    # upper triangular matrix in pool order; keep full proof bounds in source.
    packed = {"version": VERSION, "ids": ids, "meters": [], "borderIndices": []}
    for index, a in enumerate(ids):
        for b in ids[index + 1:]:
            pair = pairs[":".join(sorted([a, b]))]
            if pair["borders"]:
                packed["borderIndices"].append(len(packed["meters"]))
            packed["meters"].append(pair["meters"])
    json_write(DATA / "feedback.v1.json", packed)
    json_write(OUTPUT / "feedback.v1.json", packed)
    json_write(DATA / "generation.v1.json", {
        "version": VERSION, "fingerprint": source_fingerprint, "pairCount": len(pairs),
        "method": "WGS84 geodesic metric-ball branch and bound on continuous boundary segments",
        "toleranceMeters": TOLERANCE, "maxCertifiedGapMeters": max(p["meters"]-p["lowerMeters"] for p in pairs.values()),
        "dependencies": {"numpy": np.__version__, "pyproj": pyproj.__version__, "PROJ": pyproj.proj_version_str,
                         "shapely": shapely.__version__, "pyshp": shapefile.__version__},
        "outputSha256": {name: hashlib.sha256((OUTPUT/name).read_bytes()).hexdigest()
                         for name in ["world.v1.geojson", "distances.v1.json", "feedback.v1.json"]},
    })
    print(f"Generated {len(pairs)} certified pairs in {time.monotonic()-start:.1f}s", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--display-only", action="store_true", help="Regenerate map derivatives without rewriting country, distance, or schedule artifacts")
    main(display_only=parser.parse_args().display_only)
