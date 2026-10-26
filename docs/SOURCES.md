# Sources and license tracking

## Status

The approved boundary archives, geographic derivatives, all 146 answer-country postcards, and one licensed photo per postcard are included (197 countries have geographic feedback). No recipes have been imported. This register links the artifact locks and claim-level research records.

## Geographic and technical references

| Reference | Role | License / tracking status |
|---|---|---|
| [Natural Earth Admin 0 countries](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) | MVP dataset pinned at release 5.1.1 | [Public domain](https://www.naturalearthdata.com/about/terms-of-use/). Checksums in `data/geography/sources.lock.json`; verified component mapping in `crosswalk.v3.json` (v1 and v2 mappings retained). |
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

## Link preview artwork

`public/social-preview.v1.png` combines original Roamfolio typography/layout with the existing public-domain Natural Earth overview geometry. The map source and its transformations remain tracked by `sources.lock.json` and `display.v1.json`; the artwork includes a Natural Earth credit. The generation source is `scripts/social/generate.mjs`, using the existing D3 projection and Playwright Chromium dependencies. No third-party photo, icon pack, or daily puzzle content is included.

## Discovery content

Every answer-eligible country needs three sourced facts, one cultural note, and at least one signature food before MVP release. Track each claim's source URL, publisher, retrieval date, and review status. Write original summaries; attribution alone does not grant permission to reproduce text or media.

Prefer identifiable authoritative sources such as cultural institutions, museums, heritage organizations, and official tourism bodies, and assess each source's suitability for the specific claim. Do not fabricate facts or present a disputed cultural claim as universal.

Each answer-country postcard now includes a freely reusable photo with an explicit license and attribution record. Recipes are later scope and require their own provenance and reproduction-permission review.

## Postcard photographs

The 146 photos are retained from Wikimedia Commons, selected using country-guide captions and file descriptions, then visually reviewed for subject and suitability. Commons licenses vary by file: the collection uses CC BY, CC BY-SA (including 3.0 IGO), CC0, and explicit public-domain notices. [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) and [Creative Commons attribution guidance](https://creativecommons.org/reusing-cc-licensed-content/) informed the credit layout. Commons metadata is a source record, not independent legal or specialist verification.

- `data/photos/postcards.v1.json` records exact answer-country coverage, author/required attribution, original title, source and license URLs, alt text, original upload identifiers, download URLs, retrieval timestamps, dimensions, bytes, SHA-256, and resizing notices.
- `scripts/content/photos/sources.v1.json` retains the consulted author, attribution, description, permission and license metadata, source-page revisions, and relevant guide context. See its accompanying README for selection and verification notes.
- `public/data/postcards/` holds local JPEGs at up to 960 pixels wide, roughly 26 MB in total. Only the solved country's image is requested. Files retain their original aspect ratio; Wikimedia-generated thumbnails are resized, with no Roamfolio crop, color changes, or generated image content.
- Every postcard includes the photographer's credit, a Commons source link, its particular license link, and a resize notice. `public/data/photo-credits.html` lists the original titles and all credits. Each photo retains its own terms independently of the application code; ShareAlike terms continue to apply to the photo copies.
- Some photos are historical. A photograph illustrates a place when it was taken and does not establish current conditions. Source descriptions and dates remain available through the file records.
- The downloader refuses changed bytes; replacing a source requires reviewing the country/subject, author, license, changes, and checksums together. No live image search, API key, paid image service, or random image selection is used during play.

## Discovery research and distribution

- `data/discovery/europe-africa.json`: 61 cards. `scripts/content/europe-africa/` records the pinned mledoze/countries reference source, original claim summaries, institutional references, source hashes, and the complete ODbL 1.0 notice.
- `data/discovery/americas-asia-oceania.json`: 64 cards. `scripts/content/americas-asia-oceania-sources.json` records consulted guides, available article revisions, source hashes, primary-source overrides, and retrieval dates.
- `data/discovery/chad.json`: one additional card. `scripts/content/chad-sources.json` records the consulted Wikivoyage guide, its permanent revision link, UNESCO World Heritage references, claim fields, retrieval date, and license notices.
- `data/discovery/expansion.v3.json`: 20 additional answer cards. `scripts/content/expansion-v3-sources.json` records claim URLs, consulted structured reference fields, retrieval date, source hash, licenses and editorial limitations. Basic geography uses the same pinned mledoze/countries release; culture/food uses consulted Wikivoyage excerpts and selected institutional sources. Palestine uses geographic/language facts rather than a disputed capital field, and Moldova avoids an obsolete language label. Vatican pizza is described as shared Italian food, not a distinct national dish. The 51 guess-only countries need geographic data but no postcards.
- All cards contain three facts, one culture note, and one food per country, with source links on every claim. Build validation checks exact answer-pool coverage and claim fields.
- Wikivoyage contributor summaries carry CC BY-SA 4.0 attribution and modification notices. The mledoze/countries extraction retains ODbL 1.0 attribution and is distributed separately. UNESCO World Heritage reference notices are tracked in the research records.
- Public attribution, a complete ODbL notice, and the reference extraction ship under `public/data/`. Every solved postcard links these credits and the CC BY-SA license.

Most cultural/food claims were checked against community-edited travel guides; selected claims use primary institutional sources. The research records identify this limitation. Sources were consulted, but the content does not claim independent specialist verification. Later editorial work can add more local primary sources and richer stories without changing game rules.

## Validation records

Geographic metadata is in `data/geography/sources.lock.json`, `crosswalk.v1.json`, and `generation.v1.json`. The additive pool-v2 extension has separate `crosswalk.v2.json`, `distances.v2.json`, `feedback.v2.json`, and `generation.v2.json` records while preserving all original pair values. The v3 extension adds separate `crosswalk.v3.json`, `distances.v3.json`, `feedback.v3.json` and `generation.v3.json` records for all 197 guesses, preserving all v2 pairs. The overview and on-demand detailed display assets have independent provenance, processing settings, and checksums in `data/geography/display.v1.json`; both derive from the same approved source archives. Geographic tests exercise continuous segment minima, islands, enclave rings, antimeridian seams, geodesic reference agreement, and source policy. App/browser tests cover eligibility, deterministic calendar-date schedules, persistence, typed-only guessing, discovery visibility, and accessibility.
