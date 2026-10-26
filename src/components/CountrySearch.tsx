import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { countries, resolveCountry } from '../game';

const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('en-US').replace(/[.’']/g, '').replace(/\s+/g, ' ');

export function CountrySearch({ onGuess }: { onGuess: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const suggestions = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return [];
    return countries.map(country => {
      const names = [country.id, country.name, ...country.aliases].map(normalize);
      return { country, rank: names.some(name => name.startsWith(normalized)) ? 0 : 1, matches: names.some(name => name.includes(normalized)) };
    }).filter(item => item.matches).sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name, 'en')).slice(0, 7).map(item => item.country);
  }, [query]);
  const expanded = open && suggestions.length > 0;

  function select(name: string) {
    setQuery(name);
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { setOpen(false); setActive(-1); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return;
      event.preventDefault();
      setOpen(true);
      setActive(previous => event.key === 'ArrowDown' ? (previous + 1) % suggestions.length : (previous <= 0 ? suggestions.length - 1 : previous - 1));
    }
    if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      select(suggestions[active].name);
    }
  }

  return <form className="guess-form" onSubmit={event => {
    event.preventDefault();
    const country = resolveCountry(query);
    if (!country) { setError(`Choose a country from the suggestions. There are ${countries.length} countries available to guess.`); return; }
    onGuess(country.id);
    setQuery(''); setError(''); setOpen(false); setActive(-1);
    // Release the software keyboard so touch players can see the map result.
    if (window.matchMedia('(pointer: coarse)').matches) input.current?.blur();
    else input.current?.focus();
  }}>
    <label htmlFor={id}>Where shall we go?</label>
    <div className="input-row">
      <div className="search-field">
        <span className="search-symbol" aria-hidden="true">⌕</span>
        <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={`${id}-options`} aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} autoComplete="off" spellCheck={false} placeholder="Type a country name…" value={query} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); setError(''); }} onKeyDown={onKeyDown} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }}/>
        {expanded && <ul id={`${id}-options`} role="listbox" aria-label="Country suggestions" className="suggestions">
          {suggestions.map((country, index) => <li key={country.id} id={`${id}-option-${index}`} role="option" aria-selected={index === active} className={index === active ? 'active' : ''} onMouseDown={event => event.preventDefault()} onClick={() => select(country.name)}>{country.name}<span aria-hidden="true">↖</span></li>)}
        </ul>}
      </div>
      <button className="primary-button" type="submit" disabled={!query.trim()}>Guess <span aria-hidden="true">↗</span></button>
    </div>
    {error && <p id={`${id}-error`} className="form-error" role="alert">{error}</p>}
  </form>;
}
