import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import {
  loadSeasonSetupWorkspace,
  startLeagueSeason,
  type SeasonPlayerAssignment,
  type SeasonSetupWorkspace,
} from './operations';

type AssignmentDraft = { enabled: boolean; playerName: string; gamertag: string };

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function SeasonSetupPage() {
  const { client } = useLeague();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<SeasonSetupWorkspace | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState(() => `Saison ${new Date().getFullYear()}`);
  const [slug, setSlug] = useState(() => `saison-${new Date().getFullYear()}`);
  const [slugTouched, setSlugTouched] = useState(false);
  const [gameKey, setGameKey] = useState('f1_25');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assignments, setAssignments] = useState<Record<string, AssignmentDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadSeasonSetupWorkspace(client)
      .then((data) => {
        if (!active) return;
        setWorkspace(data);
        setGameKey(data.games[0]?.key ?? 'f1_25');
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Die Saison-Einrichtung konnte nicht geladen werden.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [client]);

  const game = useMemo(() => workspace?.games.find((item) => item.key === gameKey) ?? workspace?.games[0], [gameKey, workspace]);
  const playerAssignments = useMemo<SeasonPlayerAssignment[]>(() => (game?.roster ?? []).flatMap((seat) => {
    const draft = assignments[seat.seat_code];
    return draft?.enabled ? [{ seat_code: seat.seat_code, player_name: draft.playerName.trim(), gamertag: draft.gamertag.trim() }] : [];
  }), [assignments, game]);
  const invalidAssignment = playerAssignments.some((item) => item.player_name.length < 2 || item.gamertag.length < 2);

  function updateAssignment(seatCode: string, update: Partial<AssignmentDraft>) {
    setAssignments((current) => {
      const existing = current[seatCode] ?? { enabled: false, playerName: '', gamertag: '' };
      return { ...current, [seatCode]: { ...existing, ...update } };
    });
  }

  function continueFromSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 3 || slug.trim().length < 3 || (startDate && endDate && endDate < startDate)) {
      setError('Prüfe Saisonname, Kürzel und Zeitraum.');
      return;
    }
    setStep(2);
  }

  function continueFromGrid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (invalidAssignment) {
      setError('Jeder zugeordnete Spieler benötigt einen Namen und einen Gamertag mit mindestens zwei Zeichen.');
      return;
    }
    setStep(3);
  }

  async function startSeason() {
    if (!game || invalidAssignment) return;
    setBusy(true);
    setError('');
    try {
      await startLeagueSeason(client, {
        name: name.trim(), slug: slug.trim(), gameKey: game.key,
        startDate, endDate, assignments: playerAssignments,
      });
      navigate('/admin?seasonStarted=1', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Saison konnte nicht gestartet werden.');
      setBusy(false);
    }
  }

  if (loading) return <main className="driver-state" id="main-content"><span className="state-mark">S</span><div><h1>Saison wird vorbereitet</h1></div></main>;
  if (!workspace || !game) return <main className="driver-state" id="main-content"><span className="state-mark">!</span><div><h1>Saison-Einrichtung nicht verfügbar</h1><p>{error}</p></div></main>;

  return <main className="onboarding-page season-setup-page" id="main-content">
    <section className="onboarding-card season-setup-card" aria-labelledby="season-setup-title">
      <header className="onboarding-header">
        <div><p className="section-label">{workspace.league.name} · Saison</p><h1 id="season-setup-title">Saison startklar machen</h1><p>RaceVora übernimmt das komplette Starterfeld des Spiels. Du ordnest nur die echten Spieler den passenden Sitzen zu.</p></div>
        <span className="onboarding-progress" aria-label={`Schritt ${step} von 3`}>{step}/3</span>
      </header>
      <ol className="onboarding-steps season-setup-steps" aria-label="Schritte der Saison-Einrichtung">
        <li className={step >= 1 ? 'is-active' : ''} aria-current={step === 1 ? 'step' : undefined}><span>1</span>Saison</li>
        <li className={step >= 2 ? 'is-active' : ''} aria-current={step === 2 ? 'step' : undefined}><span>2</span>Starterfeld</li>
        <li className={step >= 3 ? 'is-active' : ''} aria-current={step === 3 ? 'step' : undefined}><span>3</span>Start</li>
      </ol>

      {step === 1 && <form className="onboarding-form" onSubmit={continueFromSeason}>
        <div className="onboarding-section-heading"><h2>Saison festlegen</h2><p>Das Starterfeld wird passend zum ausgewählten Spiel vorbereitet.</p></div>
        {workspace.active_season && <aside className="season-active-note"><strong>Aktuell aktiv: {workspace.active_season.name}</strong><p>Beim Start der neuen Saison wird die bisherige Saison automatisch beendet.</p></aside>}
        <div className="onboarding-fields season-setup-fields">
          <label><span>Saisonname</span><input autoFocus required minLength={3} maxLength={80} value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!slugTouched) setSlug(slugify(next)); }} /></label>
          <label><span>Saison-Kürzel</span><input required minLength={3} maxLength={50} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} /></label>
          <label><span>Spiel</span><select value={gameKey} onChange={(event) => { setGameKey(event.target.value); setAssignments({}); }}>{workspace.games.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></label>
          <label><span>Startdatum</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label><span>Enddatum</span><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="onboarding-actions"><button className="primary-action" type="submit">Starterfeld einrichten</button></div>
      </form>}

      {step === 2 && <form className="onboarding-form season-grid-form" onSubmit={continueFromGrid}>
        <div className="onboarding-section-heading"><h2>Spieler den Sitzen zuordnen</h2><p>Ohne Zuordnung startet der offizielle KI-Fahrer. Aktiviere nur die Sitze, die von echten Spielern gefahren werden.</p></div>
        <div className="season-grid-summary"><strong>{playerAssignments.length} Spieler</strong><span>{game.roster.length - playerAssignments.length} KI-Fahrer</span></div>
        <ol className="season-roster-list">
          {game.roster.map((seat) => {
            const draft = assignments[seat.seat_code] ?? { enabled: false, playerName: '', gamertag: '' };
            return <li className={draft.enabled ? 'is-player' : ''} key={seat.seat_code}>
              <div className="season-seat-number">#{seat.number}</div>
              <div className="season-seat-copy"><strong>{seat.ai_driver_name}</strong><span>{seat.team_name} · {seat.car_name}</span></div>
              <label className="season-player-toggle"><input checked={draft.enabled} type="checkbox" onChange={(event) => updateAssignment(seat.seat_code, { enabled: event.target.checked })} /><span>Spieler zuordnen</span></label>
              {draft.enabled && <div className="season-player-fields">
                <label><span>Spielername</span><input required minLength={2} maxLength={80} value={draft.playerName} onChange={(event) => updateAssignment(seat.seat_code, { playerName: event.target.value })} /></label>
                <label><span>Gamertag</span><input required minLength={2} maxLength={80} value={draft.gamertag} onChange={(event) => updateAssignment(seat.seat_code, { gamertag: event.target.value })} /></label>
              </div>}
            </li>;
          })}
        </ol>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="onboarding-actions onboarding-actions--split"><button className="text-action" type="button" onClick={() => { setError(''); setStep(1); }}>Zurück</button><button className="primary-action" type="submit">Saison prüfen</button></div>
      </form>}

      {step === 3 && <section className="onboarding-form season-review">
        <div className="onboarding-section-heading"><h2>Prüfen und Saison starten</h2><p>Erst mit der Bestätigung wird die Saison aktiv und das Starterfeld gespeichert.</p></div>
        <dl className="season-review-facts">
          <div><dt>Liga</dt><dd>{workspace.league.name}</dd></div>
          <div><dt>Saison</dt><dd>{name}</dd></div>
          <div><dt>Spiel</dt><dd>{game.label}</dd></div>
          <div><dt>Starterfeld</dt><dd>{playerAssignments.length} Spieler · {game.roster.length - playerAssignments.length} KI-Fahrer</dd></div>
          {(startDate || endDate) && <div><dt>Zeitraum</dt><dd>{startDate || 'offen'} bis {endDate || 'offen'}</dd></div>}
        </dl>
        <aside className="season-start-note"><strong>Start ist verbindlich</strong><p>Eine bereits aktive Saison wird beendet. Fahrer, Fahrzeuge und alle Sitzzuordnungen werden als Saisonstand gespeichert.</p></aside>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="onboarding-actions onboarding-actions--split"><button className="text-action" disabled={busy} type="button" onClick={() => { setError(''); setStep(2); }}>Zurück</button><button className="primary-action" disabled={busy} type="button" onClick={() => void startSeason()}>{busy ? 'Saison wird gestartet …' : 'Saison starten'}</button></div>
      </section>}
    </section>
  </main>;
}

