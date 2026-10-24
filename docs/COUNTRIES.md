# Approved eligible-country pool

## Status

**Approved on 2026-10-24.** The initial 125-country list and its territory policy were approved before implementation. The user subsequently approved adding Chad. Current registry: `data/countries/pool.v2.json`; `pool.v1.json` is retained for the immutable original answer cycles.

The approved pool contains **126 countries**. Each is eligible both as a daily target and as a typed guess. Each appears once per complete cycle for its pool version, with no weighting. All 126 can be guessed immediately; the 126-country answer cycles begin on 2032-11-05, after the already published 125-country cycles ending on 2032-11-04. Existing answers and saved progress identities are preserved. Countries outside this pool remain visible neutrally on the map.

## Selection approach

- Favor recognizable countries across regions rather than automatically enabling every geographic feature.
- Include familiar Caribbean and Oceania countries; do not categorically exclude island countries.
- Keep the initial pool within the documented 100–130 range.
- Treat the grouping below as an editorial aid, not a geopolitical classification or a claim about recognition.
- Country omissions reflect MVP scope, not a judgment about sovereignty, culture, or importance.

The IDs below are stable application identifiers using familiar three-letter country codes. Do not assume they match every Natural Earth field: the geographic pipeline uses the verified source-feature/component crosswalk in `data/geography/crosswalk.v2.json`. An application's country name, source label, and sovereign identifier need not be identical.

## Regional summary

| Group | Count |
|---|---:|
| Europe | 36 |
| Africa | 26 |
| Americas | 26 |
| Asia | 34 |
| Oceania | 4 |
| **Total** | **126** |

## Europe

| ID | Country |
|---|---|
| ALB | Albania |
| AUT | Austria |
| BLR | Belarus |
| BEL | Belgium |
| BIH | Bosnia and Herzegovina |
| BGR | Bulgaria |
| HRV | Croatia |
| CYP | Cyprus |
| CZE | Czechia |
| DNK | Denmark |
| EST | Estonia |
| FIN | Finland |
| FRA | France |
| DEU | Germany |
| GRC | Greece |
| HUN | Hungary |
| ISL | Iceland |
| IRL | Ireland |
| ITA | Italy |
| LVA | Latvia |
| LTU | Lithuania |
| NLD | Netherlands |
| MKD | North Macedonia |
| NOR | Norway |
| POL | Poland |
| PRT | Portugal |
| ROU | Romania |
| RUS | Russia |
| SRB | Serbia |
| SVK | Slovakia |
| SVN | Slovenia |
| ESP | Spain |
| SWE | Sweden |
| CHE | Switzerland |
| UKR | Ukraine |
| GBR | United Kingdom |

## Africa

| ID | Country |
|---|---|
| DZA | Algeria |
| AGO | Angola |
| BWA | Botswana |
| CMR | Cameroon |
| TCD | Chad |
| COD | Democratic Republic of the Congo |
| EGY | Egypt |
| ETH | Ethiopia |
| GHA | Ghana |
| KEN | Kenya |
| MDG | Madagascar |
| MLI | Mali |
| MUS | Mauritius |
| MAR | Morocco |
| MOZ | Mozambique |
| NAM | Namibia |
| NGA | Nigeria |
| RWA | Rwanda |
| SEN | Senegal |
| ZAF | South Africa |
| SDN | Sudan |
| TZA | Tanzania |
| TUN | Tunisia |
| UGA | Uganda |
| ZMB | Zambia |
| ZWE | Zimbabwe |

## Americas

| ID | Country |
|---|---|
| ARG | Argentina |
| BHS | Bahamas |
| BLZ | Belize |
| BOL | Bolivia |
| BRA | Brazil |
| CAN | Canada |
| CHL | Chile |
| COL | Colombia |
| CRI | Costa Rica |
| CUB | Cuba |
| DOM | Dominican Republic |
| ECU | Ecuador |
| SLV | El Salvador |
| GTM | Guatemala |
| HTI | Haiti |
| HND | Honduras |
| JAM | Jamaica |
| MEX | Mexico |
| NIC | Nicaragua |
| PAN | Panama |
| PRY | Paraguay |
| PER | Peru |
| TTO | Trinidad and Tobago |
| USA | United States |
| URY | Uruguay |
| VEN | Venezuela |

## Asia

| ID | Country |
|---|---|
| ARM | Armenia |
| AZE | Azerbaijan |
| BGD | Bangladesh |
| KHM | Cambodia |
| CHN | China |
| GEO | Georgia |
| IND | India |
| IDN | Indonesia |
| IRN | Iran |
| IRQ | Iraq |
| ISR | Israel |
| JPN | Japan |
| JOR | Jordan |
| KAZ | Kazakhstan |
| LAO | Laos |
| LBN | Lebanon |
| MYS | Malaysia |
| MNG | Mongolia |
| MMR | Myanmar |
| NPL | Nepal |
| OMN | Oman |
| PAK | Pakistan |
| PHL | Philippines |
| QAT | Qatar |
| SAU | Saudi Arabia |
| SGP | Singapore |
| KOR | South Korea |
| LKA | Sri Lanka |
| TWN | Taiwan |
| THA | Thailand |
| TUR | Turkey |
| ARE | United Arab Emirates |
| UZB | Uzbekistan |
| VNM | Vietnam |

## Oceania

| ID | Country |
|---|---|
| AUS | Australia |
| FJI | Fiji |
| NZL | New Zealand |
| PNG | Papua New Guinea |

## Typed names and aliases

Canonical names above remain valid typed guesses. The registry will include reviewed common aliases such as USA / US / United States of America, UK / Britain / Great Britain, Czech Republic, Türkiye, UAE, DR Congo / DRC, and Republic of Korea. Chad accepts Republic of Chad, Tchad, and République du Tchad. Aliases identify the game country and do not change its geometry.

Do not guess automatically from ambiguous names such as "Congo" or "Korea"; ask the player to select a specific country name from the typed suggestions. Normalize case and surrounding whitespace. Unknown or ineligible input receives a clear explanation.

## Geographic mapping

The approved treatment of islands, overseas regions, dependencies, and disputed boundaries is in [GEOGRAPHY.md](GEOGRAPHY.md). In particular, an eligible country is not automatically the union of every territory with the same sovereign identifier.

The source-component crosswalk has been verified against checksummed Natural Earth 5.1.1 archives. See `data/geography/crosswalk.v2.json` and the recorded Norway, Finland, and Egypt handling in GEOGRAPHY.md.

## Changes and approval

The current list is recorded as the versioned `pool.v2.json` registry, an additive extension of `pool.v1.json`. Amendments require approval. A future pool change begins at a future cycle boundary beyond already published puzzle assignments; it never rewrites an existing date.
