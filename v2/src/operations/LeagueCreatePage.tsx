import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { createLeague } from './operations';

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function leagueSetupDestination(slug: string): string {
  return `/admin/season/setup?league=${encodeURIComponent(slug)}`;
}

export function activateCreatedLeague(
  slug: string,
  setLeagueSlug: (value: string) => void,
  replaceLocation: (destination: string) => void,
): void {
  setLeagueSlug(slug);
  replaceLocation(leagueSetupDestination(slug));
}

export function LeagueCreatePage() {
  const { client, setLeagueSlug } = useLeague();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const league = await createLeague(client, { name: name.trim(), slug: slug.trim(), isPublic });
      activateCreatedLeague(league.slug, setLeagueSlug, (destination) => window.location.replace(destination));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Die Liga konnte nicht erstellt werden.');
      setSubmitting(false);
    }
  }

  return <main className="operations-page admin-form-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">RaceVora · Liga</p><h1>Liga erstellen</h1><p>Lege eine neue, vollständig von bestehenden Ligen getrennte Liga an. Danach öffnet sich direkt die Einrichtung.</p></div><NavLink className="text-link" to="/profile">Abbrechen</NavLink></header>
    <form className="admin-form league-create-form" onSubmit={(event) => void submit(event)}>
      <label><span>Name der Liga</span><input autoFocus required maxLength={80} value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!slugTouched) setSlug(slugify(next)); }} /></label>
      <details className="form-advanced-settings"><summary><span>Weitere Einstellungen</span><small>URL und Sichtbarkeit</small></summary><div>
        <label><span>Kürzel / URL</span><input required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} /><small>Wird automatisch aus dem Liganamen erstellt.</small></label>
        <label className="admin-check"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><span><strong>Öffentliche Liga</strong><small>Die Liga darf in öffentlichen Übersichten erscheinen.</small></span></label>
      </div></details>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="admin-form-actions"><button className="primary-action" disabled={submitting} type="submit">{submitting ? 'Liga wird erstellt …' : 'Liga erstellen'}</button></div>
    </form>
  </main>;
}
