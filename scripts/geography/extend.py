"""Add approved pool-v2 countries without rewriting published v1 geography.

Run after the v1 artifacts exist: .venv/bin/python scripts/geography/extend.py
"""
from pathlib import Path
import hashlib
import json
import math
import time

import numpy as np
import pyproj
import shapely

from generate import DATA, OUTPUT, ROOT, TOLERANCE, VERSION, json_write, load_geometries
from distance import boundary_segments, build_tree, minimum_distance

EXTENDED_VERSION = VERSION + "-pool-2"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    start = time.monotonic()
    base_pool = json.loads((ROOT / 'data/countries/pool.v1.json').read_text())
    pool = json.loads((ROOT / 'data/countries/pool.v2.json').read_text())
    if pool[:len(base_pool)] != base_pool or len({c['id'] for c in pool}) != len(pool):
        raise ValueError('Pool v2 must preserve the original registry and append unique countries')
    ids = [c['id'] for c in pool]
    base = json.loads((DATA / 'distances.v1.json').read_text())
    manifest = json.loads((DATA / 'generation.v1.json').read_text())
    if base['version'] != VERSION or base['ids'] != [c['id'] for c in base_pool]:
        raise ValueError('Unexpected base geography')
    for name, expected in manifest['outputSha256'].items():
        if digest(OUTPUT / name) != expected:
            raise ValueError(f'Published base artifact changed: {name}')
    if digest(DATA / 'distances.v1.json') != manifest['outputSha256']['distances.v1.json']:
        raise ValueError('Source proof matrix differs from the published base')

    source, units = load_geometries()
    geometries = {id_: source[id_][1] for id_ in ids}
    for id_, geometry in geometries.items():
        if not geometry.is_valid or geometry.is_empty:
            raise ValueError(f'Invalid source geometry {id_}')
    trees = {id_: build_tree(boundary_segments(geometry)) for id_, geometry in geometries.items()}
    pairs = dict(base['pairs'])
    for index, a in enumerate(ids):
        for b in ids[index + 1:]:
            key = ':'.join(sorted([a, b]))
            if key in pairs:
                continue
            adjacent = geometries[a].boundary.intersection(geometries[b].boundary).length > 1e-9
            if adjacent:
                upper = lower = 0.0
            else:
                upper, lower, _ = minimum_distance(trees[a], trees[b], TOLERANCE - 0.002)
                if upper < 1e-4:
                    raise ValueError(f'Unexpected nonadjacent zero distance: {key}')
            pairs[key] = {'meters': math.ceil(upper * 1000) / 1000,
                          'lowerMeters': math.floor(lower * 1000) / 1000, 'borders': adjacent}
    if len(pairs) != len(ids) * (len(ids) - 1) // 2:
        raise ValueError('Incomplete extended matrix')
    crosswalk = json.loads((DATA / 'crosswalk.v1.json').read_text())
    for id_ in ids[len(base_pool):]:
        geometry = geometries[id_]
        crosswalk[id_] = {'sourceField': 'ADM0_A3', 'sourceValue': id_,
                          'sourceLabel': source[id_][0]['ADMIN'],
                          'mapUnits': [p['GU_A3'] for p, _ in units if p['ADM0_A3'] == id_],
                          'components': len(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else 1}
    (DATA / 'crosswalk.v2.json').write_text(json.dumps(crosswalk, indent=2) + '\n')
    result = {'version': EXTENDED_VERSION, 'baseVersion': VERSION, 'toleranceMeters': TOLERANCE,
              'ids': ids, 'pairs': pairs}
    packed = {'version': EXTENDED_VERSION, 'ids': ids, 'meters': [], 'borderIndices': []}
    for index, a in enumerate(ids):
        for b in ids[index + 1:]:
            pair = pairs[':'.join(sorted([a, b]))]
            if pair['borders']:
                packed['borderIndices'].append(len(packed['meters']))
            packed['meters'].append(pair['meters'])
    for filename, value in [('distances.v2.json', result), ('feedback.v2.json', packed)]:
        json_write(DATA / filename, value)
        json_write(OUTPUT / filename, value)
    json_write(DATA / 'generation.v2.json', {
        'version': EXTENDED_VERSION, 'baseVersion': VERSION, 'poolVersion': 'pool-v2',
        'baseMatrixSha256': digest(DATA / 'distances.v1.json'),
        'sourceLockSha256': digest(DATA / 'sources.lock.json'),
        'poolSha256': digest(ROOT / 'data/countries/pool.v2.json'),
        'generatorSha256': digest(Path(__file__)), 'geometryLoaderSha256': digest(Path(__file__).with_name('generate.py')),
        'distanceCodeSha256': digest(Path(__file__).with_name('distance.py')),
        'method': manifest['method'], 'pairCount': len(pairs), 'newPairCount': len(pairs) - len(base['pairs']),
        'toleranceMeters': TOLERANCE,
        'maxCertifiedGapMeters': max(p['meters'] - p['lowerMeters'] for p in pairs.values()),
        'dependencies': {'numpy': np.__version__, 'pyproj': pyproj.__version__,
                         'PROJ': pyproj.proj_version_str, 'shapely': shapely.__version__},
        'outputSha256': {name: digest(DATA / name) for name in ['crosswalk.v2.json', 'distances.v2.json', 'feedback.v2.json']},
    })
    print(f'Generated {len(pairs) - len(base["pairs"])} new pairs; retained {len(base["pairs"])} exact published pairs in {time.monotonic() - start:.1f}s.')


if __name__ == '__main__':
    main()
