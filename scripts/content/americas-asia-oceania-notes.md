# Americas, Asia, and Oceania discovery research

Reviewed on 2026-10-24 for the 64 approved countries in those three sections of `docs/COUNTRIES.md`.

## Coverage

`data/discovery/americas-asia-oceania.json` contains 64 entries, each with three facts, a cultural note, and a named food with a short description. Every claim has a source title and URL. Coverage and claim-schema validation passed for all 320 claims. Country IDs were compared with the three approved regional tables.

## Method and provenance

Country guides were retrieved from the public English Wikivoyage article or parse API, using an identifying research user agent. The relevant introduction, cities, geography, language, cultural, and food sections were inspected. Facts were rewritten as short original summaries, avoiding population counts, current leaders, prices, travel advice, national-dish superlatives, and disputed territorial assertions. Dishes are suggestions for discovery rather than recipes or exclusive national ownership claims.

Primary pages were also consulted for Qatar's machboos (Qatar Tourism), Philippine adobo (Philippine Consulate General in Vancouver), Emirati harees and sharing practices (UNESCO), Singapore's hawker culture (UNESCO), and Australian meat pies (Tourism Australia). These claims have their own source links.

`scripts/content/americas-asia-oceania-sources.json` records publisher, retrieval date, review status, original guide revision where the API returned it, and an SHA-256 of the extracted article-text snapshot. HTML-fetched guides have a null revision; they are dated source checks, not immutable source locks. No raw article text, photographs, or recipes are included in the repository. The guide hashes identify the reviewed snapshots but do not replace the source links and do not establish an independent editorial review.

## Attribution and licensing

Wikivoyage contributors publish article text under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as confirmed by [Wikivoyage:Copyleft](https://en.wikivoyage.org/wiki/Wikivoyage:Copyleft), inspected during this research pass. Keep the contributor attribution, article links, and a content-license notice alongside distribution of the summaries informed by those guides. Treat those summaries conservatively as adapted discovery content under that license; this does not assert a license for the application code. Primary-source pages remain under their publishers' terms; only original factual summaries are included here, without copied expressive prose or media.

## Editorial limits

Most claims use a community-edited travel guide as their checked source, rather than independent primary verification. Some cultural notes describe language or regional traditions because a single country-wide cultural claim would oversimplify the source material. These cards are concise sourced first-release content, not an exhaustive account of any country's cultures. A later editorial pass should prioritize additional local institutions and primary sources. No empty cards or known unsourced placeholders remain.
