# Postcard photograph sources

One freely reusable photograph is retained for each of the 146 answer-eligible countries. The 51 guess-only countries do not have discovery cards or photos.

`data/photos/postcards.v1.json` is the image lock. `sources.v1.json` preserves the consulted Wikimedia Commons metadata (including author, requested attribution, copyright/permission notices, description and individual license), file-page IDs/revisions, and guide context. Retrieval timestamps use UTC. Sources were consulted on 2026-10-25 in America/Chicago, which extends into 2026-10-26 UTC.

Photos were shortlisted from the English Wikivoyage country guides and Commons searches. File descriptions and licenses were consulted individually, and the full collection was reviewed in contact sheets for image quality, subject, and suitability. Maps, flags, charts, political portraits, unclear author records, and known location mismatches were replaced. These are editorial checks against the cited records, not independent geographic, legal, or specialist verification.

Alt text identifies the selected scene, rather than making a claim that a single photograph represents an entire country. Captions were shortened from source-supported subject descriptions. Photo dates and original descriptions are retained in the source snapshots. The photos illustrate places at the time of capture, not current conditions.

## Licensing and transformations

The collection uses individual CC BY, CC BY-SA (including 3.0 IGO), CC0, and explicit public-domain notices. Each photo keeps its own license independently of the application code. Required credit strings are retained; the Ukraine photo uses the author's requested “DiscoverWithDima” credit. Original titles and complete attribution links appear in the generated `public/data/photo-credits.html`, alongside the visible credit on each postcard.

Images wider than 960 pixels were downloaded as Wikimedia-generated thumbnails; smaller originals were retained without upscaling. Real JPEG dimensions were read from the downloaded files and checked by decoding every image in Chromium. Roamfolio makes no crop, color change, or generative transformation. The image lock distinguishes resized from unmodified copies and pins both original upload identifiers and downloaded SHA-256 hashes.

The Commons file page is the licensing reference for public-domain files without a separate license URL. Metadata is evidence of the stated terms, not a Wikimedia warranty. Reuse guidance: [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) and [Creative Commons](https://creativecommons.org/reusing-cc-licensed-content/).

## Reproduce and update

```sh
npm run data:photos
npm run data:discovery
npm test
npm run build
```

The photo command verifies existing files and downloads missing pinned copies. It refuses mismatched bytes and never updates the image lock automatically. Normal builds and gameplay use retained local images without Wikimedia API calls or credentials.

To replace a photo, review the specific file's location, subject, author, requested attribution, license, and permission notices; retain its source metadata and revision, download the selected copy, and update the filename/hash, dimensions, changes notice, and source records together. Remove only the superseded photo, regenerate the country cards and credits, and rerun the coverage/provenance tests. Check the new image and its postcard on desktop and mobile. Never relabel a file under a different license or silently accept changed download bytes.
