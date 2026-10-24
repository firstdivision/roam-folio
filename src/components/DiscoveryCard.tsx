import { useEffect, useState } from 'react';
import { assetUrl, countries } from '../game';
import type { Discovery } from '../game';

export function DiscoveryCard({ countryId }: { countryId: string }) {
  const [content, setContent] = useState<Discovery | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setContent(null); setFailed(false);
    fetch(assetUrl(`data/discovery/${countryId}.json`), { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Postcard unavailable'); return response.json() as Promise<Discovery>; })
      .then(setContent).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [countryId, attempt]);
  return <section className="postcard" aria-labelledby="postcard-heading">
    <div className="postcard-top"><span className="eyebrow">A POSTCARD FROM</span><span className="postmark" aria-hidden="true">ARRIVED<br/>ROAMFOLIO</span></div>
    <h2 id="postcard-heading">{countries.find(country => country.id === countryId)?.name}</h2>
    <p className="postcard-intro">You found the place. Now discover its story.</p>
    {!content && !failed && <p role="status">Opening your postcard…</p>}
    {failed && <p>The postcard couldn’t load. <button className="text-button" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p>}
    {content && <div className="postcard-content">
      <div><h3>A few things to take with you</h3><ul className="country-facts">{content.facts.map((fact, index) => <li key={index}>{fact.text} <Source {...fact}/></li>)}</ul></div>
      <div className="postcard-notes"><div><h3>A little culture</h3><p>{content.culture.text} <Source {...content.culture}/></p></div><div><h3>A taste of the country</h3><h4>{content.food.name}</h4><p>{content.food.text} <Source {...content.food}/></p></div></div>
    </div>}
    {content && <p className="content-credit">Original summaries of cited sources. Travel-guide material by Wikivoyage contributors, adapted under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. <a href={assetUrl('data/attribution.html')} target="_blank" rel="noreferrer">Content credits and licenses ↗</a></p>}
  </section>;
}

function Source({ sourceUrl, sourceTitle }: { sourceUrl: string; sourceTitle: string }) {
  return <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">{sourceTitle}<span className="sr-only"> (opens in a new tab)</span> ↗</a>;
}
