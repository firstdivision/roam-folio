# Sources and license tracking

## Status

The approved boundary archives, geographic derivatives, and all 125 country postcards are included. No images or recipes have been imported. This register links the artifact locks and claim-level research records.

## Geographic and technical references

| Reference | Role | License / tracking status |
|---|---|---|
| [Natural Earth Admin 0 countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) | MVP dataset pinned at release 5.1.1 | [Public domain](https://www.naturalearthdata.com/about/terms-of-use/). Checksums in `data/geography/sources.lock.json`; verified component mapping in `crosswalk.v1.json`. |
| [Natural Earth map units](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/) | Verified overseas and Norway component mapping | Natural Earth public-domain terms; retained release 5.1.1 archive. |
| [geoBoundaries API](https://www.geoboundaries.org/api.html) | Alternative dataset reference | gbOpen is CC BY 4.0 compliant; no artifact selected. Review specific source metadata and required attribution before use. |
| [GeographicLib Python interface](https://geographiclib.sourceforge.io/html/python/interface.html) | WGS84 geodesic calculation reference | GeographicLib 2.1, MIT; used for reference tests. pyproj/PROJ incorporates GeographicLib C routines for generation. Pinned pipeline requirements and generated tool versions are recorded. |

Natural Earth credit is optional under its terms; Roamfolio will still acknowledge it and document transformations. Verify any additional dataset independently.

## Required geographic artifact metadata

For every imported source or generated derivative, record:

- Publisher, dataset/layer name, release, download URL, retrieval date, and SHA-256.
- License URL or included license, required attribution, and modification notices.
- Coordinate reference system, boundary interpretation, component inclusion/exclusion rules, and country-ID crosswalk.
- Processing tool versions, transformations, documented geometry repairs, and output checksums.
- Computational method, tolerance, validation results, and IDs of dependent map, distance, and schedule versions.

Never describe an artifact as pinned, validated, or downloaded until those steps have actually occurred.

## Discovery content

Every eligible country needs three sourced facts, one cultural note, and at least one signature food before MVP release. Track each claim's source URL, publisher, retrieval date, and review status. Write original summaries; attribution alone does not grant permission to reproduce text or media.

Prefer identifiable authoritative sources such as cultural institutions, museums, heritage organizations, and official tourism bodies, and assess each source's suitability for the specific claim. Do not fabricate facts or present a disputed cultural claim as universal.

Images are optional; any image used needs an explicit license and attribution record. Recipes are later scope and require their own provenance and reproduction-permission review.

## Discovery research and distribution

- `data/discovery/europe-africa.json`: 61 cards. `scripts/content/europe-africa/` records the pinned mledoze/countries reference source, original claim summaries, institutional references, source hashes, and the complete ODbL 1.0 notice.
- `data/discovery/americas-asia-oceania.json`: 64 cards. `scripts/content/americas-asia-oceania-sources.json` records consulted guides, available article revisions, source hashes, primary-source overrides, and retrieval dates.
- Both sets contain three facts, one culture note, and one food per country, with source links on every claim. Build validation checks exact pool coverage and claim fields.
- Wikivoyage contributor summaries carry CC BY-SA 4.0 attribution and modification notices. The mledoze/countries extraction retains ODbL 1.0 attribution and is distributed separately. UNESCO World Heritage reference notices are tracked in the research records.
- Public attribution, a complete ODbL notice, and the reference extraction ship under `public/data/`. Every solved postcard links these credits and the CC BY-SA license.

Most cultural/food claims were checked against community-edited travel guides; selected claims use primary institutional sources. The research records identify this limitation. Sources were consulted, but the content does not claim independent specialist verification. Later editorial work can add more local primary sources and richer stories without changing game rules.

## Validation records

Geographic metadata is in `data/geography/sources.lock.json`, `crosswalk.v1.json`, and `generation.v1.json`. Geographic tests exercise continuous segment minima, islands, enclave rings, antimeridian seams, geodesic reference agreement, and source policy. App/browser tests cover eligibility, deterministic UTC schedules, persistence, typed-only guessing, discovery visibility, and accessibility.
