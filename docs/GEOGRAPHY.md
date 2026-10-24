# Geographic data and distance policy

## Status

The exact 125-country pool and territory policy were approved on 2026-10-24. Natural Earth 5.1.1 country and map-unit archives have been downloaded, verified, and retained. The pipeline has generated 7,750 pairwise distance records with upper/lower bounds; `data/geography/generation.v1.json` records the method, tool versions, checksums, and largest certified computational gap.

## Source dataset

Use the Natural Earth Admin 0 countries layer, version **5.1.1**, with map-unit verification for component choices. Both source archives and their version/checksum locks are retained under `data/geography/`; the generator refuses mismatched archives.

Natural Earth is public domain and uses de facto control by default, with other point-of-view variants available. Its country layer does not simply merge every dependency into its sovereign state. Separate map-unit data can help distinguish overseas components. The dataset's label "10m" means **1:10 million map scale**, not ten-meter boundary precision.

Sources: [country dataset](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/), [terms](https://www.naturalearthdata.com/about/terms-of-use/).

Maintain the same geographic interpretation for the display map and distance matrix. A simplified display derivative may remove detail for performance, but must preserve country identity and relevant components; never calculate distances from that simplified derivative.

## Approved territory and component mapping

Default: include all integral land components, islands, and exclaves of an approved game country. Exclude separately administered dependencies unless explicitly included in the country registry. Do not merge features solely because they share a sovereign code.

The source-feature crosswalk is recorded for every eligible ID in `data/geography/crosswalk.v1.json`. Use `ADM0_A3` rather than assuming `ISO_A3` is populated; France and Norway have `-99` ISO fields in this release.

| Game country / case | Approved mapping |
|---|---|
| United States (USA) | Include the contiguous states, Alaska, and Hawaii. Keep separately administered territories, including Puerto Rico and Guam, outside USA's game geometry. |
| France (FRA) | Include metropolitan France and integral overseas regions, including French Guiana, Guadeloupe, Martinique, Mayotte, and Réunion. Keep separately administered overseas collectivities separate. |
| Denmark (DNK) | Use Denmark's country components; do not merge Greenland or the Faroe Islands into DNK. |
| Netherlands (NLD) | Include European Netherlands and the Caribbean Netherlands components where represented. Keep Aruba, Curaçao, and Sint Maarten separate. |
| United Kingdom (GBR) | Use UK components including Northern Ireland. Exclude Crown Dependencies and separately administered overseas territories. |
| Norway (NOR) | Include map units NOW (Norway), NSV (Svalbard), and NJM (Jan Mayen). Exclude BVT (Bouvet), which is included in the source country feature; display Bouvet separately and neutrally. |
| Finland (FIN) | Include the country feature plus ALD (Åland), an integral autonomous region represented separately in the source. |
| Australia (AUS) | Include mainland Australia, Tasmania, and integral islands. Keep separately coded external territories separate. |
| New Zealand (NZL) | Include New Zealand's country components. Keep Cook Islands, Niue, and Tokelau separate. |
| China (CHN) and Taiwan (TWN) | Keep separate IDs and source country geometries. Hong Kong (HKG) and Macao (MAC) remain separate neutral features. Preserve the source release's other components rather than unioning claims. |
| Other archipelagos and exclaves | Preserve all approved components, even if a closest point lies far from the mainland. Eligibility and map visibility are separate from component inclusion. |
| Enclaves and inland boundaries | Preserve valid inner boundary rings. Shared land borders remain zero, including international borders defined along rivers. Do not erase adjacency through lake clipping or display simplification. |

France's FXX/GUF/MTQ/GLP/REU/MYT components, the Caribbean Netherlands NLY component, and Norway's selected units were inspected in the map-unit layer. Other eligible countries retain their source country geometry. No supplemental or invented polygons are used. Tiny island detail remains limited by the source scale.

The source Egypt geometry has a self-touching ring at longitude 35.621087106, latitude 23.139292914. Shapely `make_valid` splits that touch into valid polygons without moving source vertices; the area difference is below 1e-9 square degrees. The generator records the repair and rejects a different geometry type or a larger area change. Source archives remain untouched.

## Disputed boundaries

Use a single pinned Natural Earth default de facto interpretation consistently across map and distances. Do not silently select country-specific point-of-view variants or union overlapping claims. Eligibility is not a statement about international recognition.

The component crosswalk retains the selected release's separate administrative features and default disputed-area treatment. No country-specific POV substitutions or overlapping claim unions are applied. These are the boundaries of this pinned cartographic release, not an independent claim about current control. Any different boundary policy is a game-rule/data decision requiring review.

## Nearest-boundary calculation

1. Validate source geometries and normalize coordinate handling. Retain multipolygons and valid inner rings. Document antimeridian cuts, source gaps, overlaps, and any repairs; do not create artificial boundaries at longitude wrapping seams.
2. Derive and review actual shared-border adjacency separately from numeric distance. A shared land-boundary segment returns exactly zero. Mere point contact does not automatically qualify for the bordering message.
3. For nonbordering pairs, search the complete boundaries of all approved components, not centroids, capitals, or vertices alone. Define interpolation between source vertices consistently for the geodesic model.
4. Use WGS84 ellipsoidal geodesics through PROJ's incorporated GeographicLib C routines, accessed through pyproj, for vectorized point distances and positions. The pipeline supplies the continuous minimum search; tests compare geodesic primitives to Python GeographicLib.
5. Use spatial indexing and conservative lower bounds to prune comparisons. Adaptively subdivide candidate segments until a global lower/upper distance bound meets the approved **100-meter computational tolerance**. A fixed set of sampled vertices alone is insufficient.
6. Record each unordered pair's minimum distance in meters, adjacency flag, and generation metadata. Mirror values consistently for browser lookup. Reject missing, negative, or nonfinite results.

With the approved pool of 125 countries, there are **7,750 distinct unordered pairs** excluding self-pairs. The browser looks up these precomputed values; it does not download detailed source boundaries to calculate every guess.

The implemented search uses geodesic metric balls centered on actual boundary points. By the triangle inequality, center distance minus the two radii is a conservative lower bound; center distance is an upper bound. A priority queue refines the smallest global bound until the gap is within tolerance. Source edges are shortest WGS84 geodesics between vertices. Artificial polygon closures at the antimeridian are excluded. Bounds are rounded outward to millimeters, with internal tolerance reduced to keep the recorded gap below 100 meters. Source generalization can exceed that computational tolerance.

Generation takes about one minute on the development machine. The full proof matrix remains in `data/geography/distances.v1.json`; `feedback.v1.json` packs browser lookup values into an upper triangular matrix. The overview display geometry is simplified with topology preservation at 0.035 degrees and rounded to four decimal places. A detailed derivative uses a 0.005-degree tolerance and five decimal places, retaining 282,385 boundary coordinates versus 81,152 in the overview. Both are wound clockwise after rounding for D3; if rounding invalidates a tiny feature, its display coordinates retain their original precision. Display changes never affect distance calculations.

The overview is 1,560,175 bytes; the detailed asset is 5,863,307 bytes before HTTP compression. The app loads the detailed file only at 3× zoom or above and supports navigation to 32×. This restores source detail that the overview discards; it does not add new geography or improve the underlying Natural Earth source accuracy. Names are not shown on hover. Display hashes, tolerances, precision, and source provenance are recorded in `data/geography/display.v1.json`.

Run `.venv/bin/python scripts/geography/generate.py --display-only` for display-only regeneration. This leaves country crosswalks, distance matrices, schedules, and their original generation record untouched; full regeneration still creates both display variants.

References: [GeographicLib Python interface](https://geographiclib.sourceforge.io/html/python/interface.html), [PROJ geodesic implementation](https://proj.org/en/stable/geodesic.html).

## Display and adjacency

- Default to approximate whole miles using 1 mile = 1,609.344 meters.
- Display a positive distance below one mile as **"<1 mile"**, never zero.
- Use the bordering message only for reviewed land adjacency, never because of rounding or a numeric tolerance.
- Investigate unexpected zero distances, overlaps, and point contacts explicitly rather than inventing adjacency.
- A correct guess produces success.
- Apply proximity thresholds to unrounded distance and use the approved white-to-yellow-to-orange-to-red progression in [ARCHITECTURE.md](ARCHITECTURE.md).

## Validation before publication

Test symmetry, nonnegativity, complete pool coverage, border adjacency, separated coastlines, near-touching countries, islands, enclaves, antimeridian handling, and display rounding. Compare representative segment minima with an independent method or reference calculation. Include cases where the nearest points lie between vertices or on remote components.

Pin the same country registry, geometry interpretation, and distance version to each published puzzle. Geography updates affect future unassigned puzzles; they do not silently rewrite current or historical feedback.

## Alternative dataset

[geoBoundaries gbOpen ADM0](https://www.geoboundaries.org/api.html) is the alternative identified during planning. Its gbOpen collection is CC BY 4.0 compliant and provides source and version metadata. Coverage, boundary consistency, and licensing must be checked for any proposed supplement. Do not substitute its other collections automatically; their restrictions differ.
