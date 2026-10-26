from pathlib import Path
import hashlib
import json
import sys
import unittest

from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/geography'))
from generate import load_geometries


class GeographicArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source, cls.units = load_geometries()
        cls.pool = json.loads((ROOT / 'data/countries/pool.v3.json').read_text())

    def test_all_approved_countries_resolve_to_valid_source_geometries(self):
        self.assertEqual(len(self.pool), 197)
        for country in self.pool:
            self.assertIn(country['id'], self.source)
            geometry = self.source[country['id']][1]
            self.assertTrue(geometry.is_valid, country['id'])
            self.assertFalse(geometry.is_empty, country['id'])

    def test_overseas_and_dependency_policy(self):
        norway = self.source['NOR'][1]
        self.assertFalse(norway.intersects(Point(3.4, -54.4)))
        self.assertLess(self.source['BVT'][1].distance(Point(3.4, -54.4)), .1)
        france = self.source['FRA'][1]
        self.assertTrue(france.covers(Point(-53, 4)))  # French Guiana.
        self.assertTrue(france.covers(Point(55.5, -21.1)))  # Reunion.
        self.assertFalse(self.source['DNK'][1].covers(Point(-40, 70)))
        aland = next(g for props, g in self.units if props['GU_A3'] == 'ALD')
        self.assertTrue(self.source['FIN'][1].covers(aland))

    def test_browser_artifact_hashes_match_the_generation_manifest(self):
        manifest = json.loads((ROOT / 'data/geography/generation.v1.json').read_text())
        self.assertEqual(manifest['pairCount'], 7750)
        self.assertLessEqual(manifest['maxCertifiedGapMeters'], 100)
        for name, expected in manifest['outputSha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'public/data' / name).read_bytes()).hexdigest(), expected)

    def test_shared_borders_use_topology_not_rounded_distance(self):
        data = json.loads((ROOT / 'data/geography/distances.v1.json').read_text())['pairs']
        for a, b in [('FRA','DEU'), ('USA','CAN'), ('BRA','FRA')]:
            self.assertGreater(self.source[a][1].boundary.intersection(self.source[b][1].boundary).length, 0)
            self.assertEqual(data[':'.join(sorted([a,b]))]['meters'], 0)
            self.assertTrue(data[':'.join(sorted([a,b]))]['borders'])
        self.assertFalse(data['FRA:GBR']['borders'])
        self.assertGreater(data['FRA:GBR']['meters'], 0)

    def test_detailed_display_artifacts_have_source_and_output_checksums(self):
        manifest = json.loads((ROOT / 'data/geography/display.v1.json').read_text())
        self.assertEqual(manifest['sourceVersion'], 'natural-earth-5.1.1-policy-1')
        self.assertEqual(manifest['sourceLockSha256'], hashlib.sha256((ROOT / 'data/geography/sources.lock.json').read_bytes()).hexdigest())
        for name, variant in manifest['variants'].items():
            content = (ROOT / 'public/data' / name).read_bytes()
            self.assertEqual(len(content), variant['bytes'])
            self.assertEqual(hashlib.sha256(content).hexdigest(), variant['sha256'])
        self.assertLess(manifest['variants']['world.detail.v1.geojson']['simplificationDegrees'], manifest['variants']['world.v1.geojson']['simplificationDegrees'])

    def test_extended_artifacts_preserve_all_original_pairs_and_have_provenance(self):
        base = json.loads((ROOT / 'data/geography/distances.v1.json').read_text())
        extended = json.loads((ROOT / 'data/geography/distances.v2.json').read_text())
        manifest = json.loads((ROOT / 'data/geography/generation.v2.json').read_text())
        self.assertEqual(len(extended['pairs']), 7875)
        self.assertEqual(manifest['newPairCount'], 125)
        self.assertEqual(manifest['baseMatrixSha256'], hashlib.sha256((ROOT / 'data/geography/distances.v1.json').read_bytes()).hexdigest())
        self.assertEqual(manifest['poolSha256'], hashlib.sha256((ROOT / 'data/countries/pool.v2.json').read_bytes()).hexdigest())
        self.assertLessEqual(manifest['maxCertifiedGapMeters'], 100)
        for key, pair in base['pairs'].items():
            self.assertEqual(extended['pairs'][key], pair)
        for name, expected in manifest['outputSha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'data/geography' / name).read_bytes()).hexdigest(), expected)
            if name != 'crosswalk.v2.json':
                self.assertEqual((ROOT / 'public/data' / name).read_bytes(), (ROOT / 'data/geography' / name).read_bytes())

    def test_chad_uses_real_source_boundaries_and_reviewed_land_neighbors(self):
        crosswalk = json.loads((ROOT / 'data/geography/crosswalk.v2.json').read_text())
        self.assertEqual(crosswalk['TCD']['sourceValue'], 'TCD')
        self.assertEqual(crosswalk['TCD']['sourceLabel'], 'Chad')
        pairs = json.loads((ROOT / 'data/geography/distances.v2.json').read_text())['pairs']
        for neighbor in ['CMR', 'NGA', 'SDN']:
            self.assertGreater(self.source['TCD'][1].boundary.intersection(self.source[neighbor][1].boundary).length, 0)
            self.assertEqual(pairs[':'.join(sorted(['TCD', neighbor]))]['meters'], 0)
            self.assertTrue(pairs[':'.join(sorted(['TCD', neighbor]))]['borders'])
        self.assertGreater(pairs['EGY:TCD']['lowerMeters'], 0)

    def test_guess_registry_extension_preserves_v2_and_records_provenance(self):
        base = json.loads((ROOT / 'data/geography/distances.v2.json').read_text())
        extended = json.loads((ROOT / 'data/geography/distances.v3.json').read_text())
        manifest = json.loads((ROOT / 'data/geography/generation.v3.json').read_text())
        crosswalk = json.loads((ROOT / 'data/geography/crosswalk.v3.json').read_text())
        self.assertEqual(extended['ids'], [c['id'] for c in self.pool])
        self.assertEqual(set(crosswalk), set(extended['ids']))
        self.assertEqual(len(extended['pairs']), 19306)
        self.assertEqual(manifest['newPairCount'], 11431)
        self.assertEqual(manifest['baseMatrixSha256'], hashlib.sha256((ROOT / 'data/geography/distances.v2.json').read_bytes()).hexdigest())
        self.assertEqual(manifest['poolSha256'], hashlib.sha256((ROOT / 'data/countries/pool.v3.json').read_bytes()).hexdigest())
        self.assertEqual(manifest['sourceLockSha256'], hashlib.sha256((ROOT / 'data/geography/sources.lock.json').read_bytes()).hexdigest())
        self.assertEqual(manifest['generatorSha256'], hashlib.sha256((ROOT / 'scripts/geography/expand.py').read_bytes()).hexdigest())
        self.assertLessEqual(manifest['maxCertifiedGapMeters'], 100)
        for key, value in base['pairs'].items():
            self.assertEqual(extended['pairs'][key], value)
        for name, expected in manifest['outputSha256'].items():
            content = (ROOT / 'data/geography' / name).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), expected)
            if name != 'crosswalk.v3.json':
                self.assertEqual((ROOT / 'public/data' / name).read_bytes(), content)
        for country in self.pool:
            id_ = country['id']
            self.assertEqual(crosswalk[id_]['sourceValue'], id_)
            self.assertEqual(crosswalk[id_]['sourceLabel'], self.source[id_][0]['ADMIN'])

    def test_new_enclaves_source_ids_and_guess_only_borders(self):
        pairs = json.loads((ROOT / 'data/geography/distances.v3.json').read_text())['pairs']
        for a, b in [('ITA', 'VAT'), ('ITA', 'SMR'), ('FRA', 'MCO'), ('BEN', 'BFA'),
                     ('BEN', 'NGA'), ('BDI', 'RWA'), ('SDS', 'SDN'), ('SOM', 'KEN'),
                     ('KOS', 'SRB'), ('PSX', 'ISR'), ('AFG', 'TJK'), ('KWT', 'IRQ'),
                     ('KGZ', 'KAZ'), ('PRK', 'KOR'), ('SYR', 'TUR'), ('TKM', 'IRN'), ('YEM', 'OMN')]:
            self.assertGreater(self.source[a][1].boundary.intersection(self.source[b][1].boundary).length, 0, (a, b))
            self.assertEqual(pairs[':'.join(sorted([a, b]))], {'meters': 0, 'lowerMeters': 0, 'borders': True})
        for a, b in [('MLT', 'ITA'), ('VUT', 'FJI'), ('VAT', 'SMR')]:
            pair = pairs[':'.join(sorted([a, b]))]
            self.assertFalse(pair['borders'])
            self.assertGreater(pair['lowerMeters'], 0)


if __name__ == '__main__': unittest.main()
