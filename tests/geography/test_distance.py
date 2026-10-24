"""Analytic/synthetic fixtures test continuous geometry, not just implementation output."""
from pathlib import Path
import sys
import unittest

from geographiclib.geodesic import Geodesic
from shapely.geometry import Polygon, MultiPolygon

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts/geography'))
from distance import GEOD, Node, boundary_segments, build_tree, minimum_distance


class BoundaryMinimumTests(unittest.TestCase):
    def test_between_vertices(self):
        # Shortest distance from the equatorial segment to a point directly north
        # occurs at the segment interior, not either of its endpoints.
        segment = Node(0, 0, 100_000, 90)
        point = Node(0, 1, 0, 0)
        upper, lower, _ = minimum_distance(segment, point, 1)
        expected = Geodesic.WGS84.Inverse(0, 0, 1, 0)['s12']
        self.assertLessEqual(lower, expected + 1e-5)
        self.assertGreaterEqual(upper, expected - 1e-5)
        self.assertLessEqual(upper-lower, 1)
        self.assertAlmostEqual(upper, expected, places=5)

    def test_narrow_gap(self):
        a, b = Node(0, 0, 100, 90), Node(0, .0005, 100, 90)
        upper, lower, _ = minimum_distance(a, b, .1)
        expected = Geodesic.WGS84.Inverse(0, 0, .0005, 0)['s12']
        self.assertGreater(upper, 0)
        self.assertLessEqual(lower, expected + 1e-5)
        self.assertLessEqual(upper-lower, .1)

    def test_antimeridian_uses_short_geodesic(self):
        upper, lower, _ = minimum_distance(Node(179.9, 0, 0), Node(-179.9, 0, 0), 1)
        expected = Geodesic.WGS84.Inverse(0, 179.9, 0, -179.9)['s12']
        self.assertAlmostEqual(upper, expected, places=5)
        self.assertLess(upper, 23_000)
        self.assertLessEqual(upper-lower, 1)

    def test_artificial_antimeridian_seam_removed(self):
        geometry = Polygon([(179, 0), (180, 0), (180, 1), (179, 1), (179, 0)])
        segments = boundary_segments(geometry)
        self.assertEqual(len(segments), 3)
        self.assertFalse(any(abs(segment[0]-180) < 1e-10 and abs(segment[1]-.5) < .01 for segment in segments))

    def test_enclave_rings_and_islands_are_preserved(self):
        enclave = Polygon([(-2,-2),(2,-2),(2,2),(-2,2),(-2,-2)], [[(-1,-1),(-1,1),(1,1),(1,-1),(-1,-1)]])
        self.assertEqual(len(boundary_segments(enclave)), 8)
        far = Polygon([(30,30),(31,30),(31,31),(30,31),(30,30)])
        near = Polygon([(0,0),(1,0),(1,1),(0,1),(0,0)])
        tree = build_tree(boundary_segments(MultiPolygon([far,near])))
        upper, lower, _ = minimum_distance(tree, Node(1.01,.5,0), 1)
        self.assertLess(upper, 1200)
        self.assertGreater(upper, 1000)
        self.assertLessEqual(upper-lower, 1)

    def test_segment_split_stays_on_geodesic(self):
        segment = Node(173,68,100_000,45)
        for child in segment.split():
            distance = Geodesic.WGS84.Inverse(segment.lat, segment.lon, child.lat, child.lon)['s12']
            self.assertAlmostEqual(distance, 50_000, places=5)
            self.assertAlmostEqual(child.radius, 50_000)

    def test_geographiclib_reference_agrees_with_vectorized_proj(self):
        for lon1,lat1,lon2,lat2 in [(0,0,179.99,.01),(179,70,-179,71),(45,-12,-61,16),(10,89,100,89)]:
            expected = Geodesic.WGS84.Inverse(lat1,lon1,lat2,lon2)['s12']
            self.assertAlmostEqual(GEOD.inv(lon1,lat1,lon2,lat2)[2], expected, places=5)

    def test_symmetry(self):
        a, b = Node(10,20,50_000,35), Node(15,23,70_000,80)
        upper1, lower1, _ = minimum_distance(a,b,1)
        upper2, lower2, _ = minimum_distance(b,a,1)
        self.assertLessEqual(abs(upper1-upper2), 1)
        self.assertLessEqual(upper1-lower1, 1)
        self.assertLessEqual(upper2-lower2, 1)

    def test_rejects_invalid_tolerance(self):
        for invalid in [0,-1,float('nan'),float('inf')]:
            with self.assertRaises(ValueError): minimum_distance(Node(0,0,0),Node(1,1,0),invalid)


if __name__ == '__main__': unittest.main()
