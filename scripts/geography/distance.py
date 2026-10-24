"""Certified continuous boundary minima on WGS84, relative to source vertices.

Edges are shortest WGS84 geodesics. Every tree node is a geodesic metric ball
centred ON the boundary. The triangle inequality supplies a conservative lower
bound; centre-to-centre distance is an upper bound. Refining the smallest lower
bound until the global gap <= tolerance certifies the result without relying on
nearest vertices. pyproj uses PROJ's GeographicLib-derived Karney geodesics.
"""

from dataclasses import dataclass
import heapq
import itertools
import math

import numpy as np
from pyproj import Geod

GEOD = Geod(ellps="WGS84")


@dataclass(slots=True)
class Node:
    lon: float
    lat: float
    radius: float
    # Leaves have a forward geodesic azimuth; internal nodes have children.
    azimuth: float = 0.0
    children: tuple | None = None

    def split(self):
        if self.children is not None:
            return self.children
        half = self.radius / 2
        result = []
        for offset in (-half, half):
            lon, lat, az = GEOD.fwd(
                self.lon, self.lat, self.azimuth, offset,
                return_back_azimuth=False,
            )
            result.append(Node(lon, lat, half, az))
        return tuple(result)


def rings(geometry):
    polygons = geometry.geoms if geometry.geom_type == "MultiPolygon" else [geometry]
    for polygon in polygons:
        yield polygon.exterior.coords
        for ring in polygon.interiors:
            yield ring.coords


def boundary_segments(geometry):
    """Return geodesic segment midpoints, half-lengths and forward azimuths.

    Source polygons are cut at +/-180. Their artificial meridian closures are
    excluded; the actual coastlines on either side remain in the search.
    """
    starts, ends = [], []
    for ring in rings(geometry):
        coords = list(ring)
        for a, b in zip(coords, coords[1:]):
            if a == b:
                continue
            if abs(abs(a[0]) - 180) < 1e-8 and abs(abs(b[0]) - 180) < 1e-8:
                continue
            starts.append(a[:2])
            ends.append(b[:2])
    if not starts:
        raise ValueError("Geometry contains no real boundary segments")
    a, b = np.asarray(starts), np.asarray(ends)
    az, _, length = GEOD.inv(a[:, 0], a[:, 1], b[:, 0], b[:, 1])
    lon, lat, midaz = GEOD.fwd(a[:, 0], a[:, 1], az, length / 2, return_back_azimuth=False)
    return np.column_stack((lon, lat, length / 2, midaz))


def build_tree(segments):
    """Spatially balanced metric balls; centres always lie on a source edge."""
    lon = np.radians(segments[:, 0])
    lat = np.radians(segments[:, 1])
    xyz = np.column_stack((np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)))

    def build(indices):
        if len(indices) == 1:
            x = segments[indices[0]]
            return Node(*map(float, x))
        points = xyz[indices]
        representative = indices[np.argmin(np.sum((points - points.mean(axis=0)) ** 2, axis=1))]
        x = segments[representative]
        _, _, distance = GEOD.inv(
            np.full(len(indices), x[0]), np.full(len(indices), x[1]),
            segments[indices, 0], segments[indices, 1],
        )
        radius = float(np.max(distance + segments[indices, 2]))
        axis = int(np.argmax(np.ptp(points, axis=0)))
        order = np.argsort(points[:, axis], kind="stable")
        ordered = indices[order]
        middle = len(ordered) // 2
        return Node(float(x[0]), float(x[1]), radius,
                    children=(build(ordered[:middle]), build(ordered[middle:])))

    return build(np.arange(len(segments)))


def minimum_distance(first, second, tolerance=100.0):
    """Return (upper_bound_m, lower_bound_m, refinements).

    Floating-point padding keeps lower bounds conservative. No iteration cap or
    approximate candidate filter may silently terminate the global search.
    """
    if not math.isfinite(tolerance) or tolerance <= 0:
        raise ValueError("Tolerance must be positive and finite")
    counter = itertools.count()
    queue = []
    best = math.inf
    refinements = 0

    def push(a, b):
        nonlocal best
        _, _, d = GEOD.inv(a.lon, a.lat, b.lon, b.lat)
        best = min(best, d)
        lower = max(0.0, d - a.radius - b.radius - 1e-5)
        if lower < best:
            heapq.heappush(queue, (lower, next(counter), a, b))

    push(first, second)
    while queue:
        lower, _, a, b = heapq.heappop(queue)
        if best - lower <= tolerance:
            return best, min(best, lower), refinements
        refinements += 1
        if a.radius >= b.radius:
            for child in a.split():
                push(child, b)
        else:
            for child in b.split():
                push(a, child)
    return best, best, refinements
