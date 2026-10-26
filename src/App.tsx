import { useCallback, useEffect, useRef, useState } from 'react';
import { countries, evaluateGuess, formatMiles, getPuzzle, getUtcDate, loadProgress, nextReset, proximity, refreshSchedule, saveProgress, shareResult } from './game';
import type { Guess, Puzzle } from './game';
import { CountrySearch } from './components/CountrySearch';
import { DiscoveryCard } from './components/DiscoveryCard';
import { WorldMap } from './map/WorldMap';

const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP as string;
const buildLabel = buildTimestamp.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

type Session = { puzzle: Puzzle; guesses: Guess[]; storageAvailable: boolean };
function restore(date: string): Session | null {
  try {
    const puzzle = getPuzzle(date);
    const progress = loadProgress(puzzle);
    return { puzzle, guesses: progress.guesses.map(id => evaluateGuess(puzzle, id)), storageAvailable: progress.storageAvailable };
  } catch { return null; }
}
const nameFor = (id: string) => countries.find(country => country.id === id)?.name ?? id;

export default function App() {
  const [session, setSession] = useState<Session | null>(() => restore(getUtcDate()));
  const [date, setDate] = useState(getUtcDate);
  const dateRef = useRef(date);
  const [now, setNow] = useState(() => new Date());
  const [message, setMessage] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissedCompletion, setDismissedCompletion] = useState<string | null>(null);
  const completionDialog = useRef<HTMLDialogElement>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const postcardButton = useRef<HTMLButtonElement>(null);
  const scheduleRequest = useRef<Promise<void> | null>(null);
  const solved = Boolean(session?.guesses.some(guess => guess.correct));
  const completionOpen = solved && dismissedCompletion !== session?.puzzle.identity;
  const rankedGuesses = session?.guesses.map((result, index) => ({ result, number: index + 1 }))
    .sort((a, b) => a.result.meters - b.result.meters || Number(b.result.correct) - Number(a.result.correct) || a.number - b.number) ?? [];
  const latest = session?.guesses.at(-1);
  const feedback = message || (latest ? `${nameFor(latest.countryId)}. ${describe(latest, session?.guesses.slice(0, -1))}` : '');

  const reloadSchedule = useCallback(() => {
    if (scheduleRequest.current) return scheduleRequest.current;
    const request = refreshSchedule().then(() => {
      const today = getUtcDate();
      setSession(previous => previous?.puzzle.date === today ? previous : restore(today));
    }).catch(() => {
      // The bundled immutable assignments remain usable when revalidation fails.
    }).finally(() => { scheduleRequest.current = null; });
    scheduleRequest.current = request;
    return request;
  }, []);

  const refreshDate = useCallback(() => {
    const currentDate = getUtcDate();
    if (dateRef.current !== currentDate) {
      dateRef.current = currentDate;
      setDate(currentDate);
      setSession(restore(currentDate)); setMessage('A new UTC day, a new destination.'); setShowShare(false); setShareMessage('');
      void reloadSchedule();
    }
    setNow(new Date());
  }, [reloadSchedule]);
  useEffect(() => {
    void reloadSchedule();
    const wake = () => { if (document.visibilityState === 'hidden') return; refreshDate(); void reloadSchedule(); };
    const timer = window.setInterval(refreshDate, 1000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); };
  }, [refreshDate, reloadSchedule]);

  useEffect(() => {
    if (!completionOpen) return;
    const dialog = completionDialog.current;
    if (!dialog) return;
    const previousOverflow = document.documentElement.style.overflow;
    dialog.showModal();
    completionHeading.current?.focus({ preventScroll: true });
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      (postcardButton.current ?? document.getElementById('guess-section'))?.focus({ preventScroll: true });
    };
  }, [completionOpen]);

  function guess(countryId: string) {
    if (getUtcDate() !== date) { refreshDate(); return; }
    if (!session || solved) return;
    const existing = session.guesses.find(item => item.countryId === countryId);
    if (existing) { setMessage(`You already guessed ${nameFor(countryId)}. ${describe(existing, session.guesses.length > 1 ? session.guesses : [])} Your guess count stays the same.`); return; }
    const result = evaluateGuess(session.puzzle, countryId);
    const guesses = [...session.guesses, result];
    const storageAvailable = saveProgress(session.puzzle, guesses.map(item => item.countryId));
    setSession({ ...session, guesses, storageAvailable });
    setMessage(result.correct ? `You found ${nameFor(countryId)} in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}! Your postcard is ready.` : `${nameFor(countryId)}. ${describe(result, session.guesses)}`);
  }

  async function share() {
    if (!session) return;
    const text = shareResult(session.puzzle, session.guesses);
    setShowShare(true); setShareMessage('');
    if (navigator.share) {
      try { await navigator.share({ title: 'Roamfolio', text }); setShareMessage('Your journey was shared.'); return; }
      catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); setShareMessage('Result copied. No destination spoilers.'); }
    catch { setShareMessage('Select and copy your result below.'); }
  }

  const utcDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const remaining = Math.max(0, Math.ceil((nextReset(now).getTime() - now.getTime()) / 1000));
  const countdown = [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60].map(part => String(part).padStart(2, '0')).join(':');

  return <>
    <a href="#guess-section" className="skip-link">Skip to the game</a>
    <header className="site-header"><a className="wordmark" href="./" aria-label="Roamfolio home"><span className="brand-globe" aria-hidden="true">◎</span>roamfolio<span className="brand-dot">.</span></a><button className="help-button" aria-expanded={helpOpen} aria-controls="how-to-play" onClick={() => setHelpOpen(value => !value)}><span aria-hidden="true">?</span> How to play</button></header>
    <main>
      <div className="game-heading"><h1>Daily destination</h1><p className="daily-label"><time dateTime={date}>{utcDate}</time><span>UTC</span></p></div>
      {helpOpen && <section className="how-to-play" id="how-to-play" aria-labelledby="help-heading"><h2 id="help-heading">A small journey, one guess at a time</h2><ol><li>Type a country name, choose a suggestion, then press Guess. The map displays your guesses.</li><li>Follow the shortest distance between country borders. Land neighbors return 0 miles.</li><li>White is very far away; yellow, orange, and red bring you closer. Keep guessing until you find the country.</li><li>Solve to open your country postcard. Everyone gets the same puzzle, changing at midnight UTC.</li></ol><p>Some countries can be guessed for clues but never appear as daily destinations.</p><p>Your progress stays in this browser. No account, no guess limit.</p></section>}
      {!session ? <section className="unavailable" role="status"><h2>Today’s journey isn’t available yet.</h2><p>There is no published puzzle for {date}. Please check back when the schedule has been updated.</p></section> : <>
        <div className="play-area" id="guess-section" tabIndex={-1}>
          <div className="map-column">
            <WorldMap guesses={session.guesses}>
              {!solved && <section className="guess-panel" aria-label="Guess a country"><CountrySearch key={date} onGuess={guess}/>{feedback && <p className="latest-feedback">{feedback}</p>}</section>}
            </WorldMap>
            <section className="feedback-panel" aria-label={solved ? 'Journey complete' : 'Journey status'}>
              {solved && <div className="completed-journey"><p>You found <strong>{nameFor(session.puzzle.target)}</strong> in {session.guesses.length} {session.guesses.length === 1 ? 'guess' : 'guesses'}.</p><button ref={postcardButton} className="primary-button" type="button" aria-haspopup="dialog" onClick={() => setDismissedCompletion(null)}>View your postcard <span aria-hidden="true">↗</span></button></div>}
              {!session.storageAvailable && <p className="storage-warning" role="status">Browser storage is unavailable. You can play, but your guesses may not survive a refresh.</p>}
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
            </section>
          </div>
          <section className="history-panel" aria-labelledby="history-heading"><div className="section-title"><h2 id="history-heading">Your travel log</h2><span>{session.guesses.length} {session.guesses.length === 1 ? 'GUESS' : 'GUESSES'}</span></div><p className="history-order">Closest guesses first</p>{!session.guesses.length ? <div className="empty-history"><span aria-hidden="true">⌁</span><p>Every journey starts somewhere.</p><span>Make your first guess to get your bearings.</span></div> : <ol className="guess-list">{rankedGuesses.map(({ result, number }) => <li key={result.countryId} value={number}><span className="guess-number" aria-label={`Guess ${number}`}>{String(number).padStart(2, '0')}</span><span className="guess-swatch" style={{ background: result.correct ? '#c74332' : proximity(result.meters).color }} aria-hidden="true">{result.correct ? '✓' : ''}</span><div className="guess-country"><strong>{nameFor(result.countryId)}</strong><span>{result.correct ? 'Destination found' : result.borders ? 'It borders this country!' : proximity(result.meters).label}</span></div><span className="guess-distance">{result.correct ? 'Found!' : formatMiles(result.meters)}</span></li>)}</ol>}</section>
        </div>
        {completionOpen && <dialog ref={completionDialog} className="completion-dialog" aria-modal="true" aria-labelledby="completion-heading" aria-describedby="completion-summary" onCancel={event => { event.preventDefault(); setDismissedCompletion(session.puzzle.identity); }}>
          <div className="completion-toolbar"><button className="dialog-close" type="button" onClick={() => setDismissedCompletion(session.puzzle.identity)}>Close <span aria-hidden="true">×</span></button></div>
          <div className="completion-content">
            <div className="success-panel"><p className="eyebrow">DESTINATION DISCOVERED</p><h2 ref={completionHeading} id="completion-heading" tabIndex={-1}>You’ve arrived in<br/>{nameFor(session.puzzle.target)}<span>!</span></h2><p id="completion-summary">{session.guesses.length} {session.guesses.length === 1 ? 'guess' : 'guesses'}, a world of discovery. Explore your postcard below.</p><button className="primary-button" type="button" onClick={share}>Share your journey <span aria-hidden="true">↗</span></button><p className="next-puzzle">Next destination in <strong>{countdown}</strong><span>Resets at midnight UTC</span></p>{showShare && <div className="share-fallback"><label htmlFor="share-result">Your spoiler-free result</label><textarea id="share-result" readOnly value={shareResult(session.puzzle, session.guesses)} rows={4} onFocus={event => event.target.select()}/><p role="status">{shareMessage}</p></div>}</div>
            <DiscoveryCard key={`${date}-${session.puzzle.target}`} countryId={session.puzzle.target}/>
          </div>
        </dialog>}
      </>}
    </main>
    <footer className="site-footer"><p>Discover a country. Collect its story.</p><div><span>One world. One daily destination.</span><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Map data: Natural Earth · public domain</a><span>Built <time dateTime={buildTimestamp}>{buildLabel}</time></span></div></footer>
  </>;
}

function describe(guess: Guess, previous: Guess[] = []) {
  if (guess.correct) return 'Destination found!';
  const closest = Math.min(...previous.map(item => item.meters));
  const comparison = !previous.length ? '' : guess.meters < closest ? ' Closer than your previous closest guess.'
    : guess.meters > closest ? ' Farther away than your closest guess so far.' : ' Matches your closest guess so far.';
  return `${formatMiles(guess.meters)} away. ${guess.borders ? 'It borders this country!' : proximity(guess.meters).label + '.'}${comparison}`;
}
