import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AppState } from '../components/AppState';
import { useLeague } from '../league/LeagueProvider';
import { useRole } from '../roles/RoleProvider';
import { loadLeagueBranding, updateLeagueBranding, uploadLeagueLogo, type LeagueBranding } from './operations';

const EMPTY: LeagueBranding = { id: '', name: '', slug: '', logoUrl: '', subtitle: '', description: '', websiteUrl: '', discordUrl: '', themePreset: 1 };
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export function normalizeBrandingUrl(value: string, label = 'Link'): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/\s/.test(trimmed)) throw new Error(`${label}: Entferne Leerzeichen aus der Adresse.`);
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) throw new Error(`${label}: Verwende eine Webadresse mit http:// oder https://.`);
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost')) throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label}: Gib eine gültige Adresse ein, zum Beispiel ${label === 'Discord' ? 'discord.gg/deine-liga' : 'racevora.com'}.`);
  }
}

export function LeagueBrandingPage() {
  const { client, leagueSlug, refreshBranding } = useLeague();
  const { role } = useRole();
  const [branding, setBranding] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const allowed = role === 'league_admin' || role === 'platform_owner';

  const loadBranding = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBranding(await loadLeagueBranding(client, leagueSlug));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Branding konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [client, leagueSlug]);

  useEffect(() => {
    if (!allowed) return;
    void loadBranding();
  }, [allowed, loadBranding]);

  function patch<K extends keyof LeagueBranding>(key: K, value: LeagueBranding[K]) { setBranding((current) => ({ ...current, [key]: value })); setSaved(false); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setSaved(false); setSaving(true);
    try {
      const normalizedBranding = {
        ...branding,
        websiteUrl: normalizeBrandingUrl(branding.websiteUrl, 'Website'),
        discordUrl: normalizeBrandingUrl(branding.discordUrl, 'Discord'),
      };
      let logoUrl = normalizedBranding.logoUrl;
      if (logoFile) {
        if (!ALLOWED_LOGO_TYPES.has(logoFile.type) || logoFile.size > 2 * 1024 * 1024) throw new Error('Logo bitte als PNG, JPG, WEBP oder SVG bis maximal 2 MB wählen.');
        logoUrl = await uploadLeagueLogo(client, leagueSlug, logoFile);
      }
      const updated = await updateLeagueBranding(client, { ...normalizedBranding, logoUrl });
      setBranding(updated); setLogoFile(null); await refreshBranding(); setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Das Branding konnte nicht gespeichert werden.'); }
    finally { setSaving(false); }
  }

  if (!allowed) return <AppState copy="Du benötigst die Rolle Ligaleitung, um das Erscheinungsbild der Liga zu bearbeiten." title="Zugriff verweigert" tone="denied" />;
  if (loading) return <AppState copy="Name, Logo, Links und Darstellung der Liga werden geladen." title="Branding wird geladen" tone="loading" />;
  if (error && !branding.id) return <AppState action={<button className="text-action" onClick={() => void loadBranding()} type="button">Erneut versuchen</button>} copy={error} title="Branding konnte nicht geladen werden" tone="error" />;
  return <main className="operations-page admin-form-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">Ligaleitung · {leagueSlug}</p><h1>Branding</h1><p>Name, Logo und Links der ausgewählten Liga verwalten. Dein persönliches Farbthema stellst du im Profil ein.</p></div><NavLink className="text-link" to="/admin">Zur Ligaleitung</NavLink></header>
    <div className="branding-layout branding-layout--identity">
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label><span>Liganame</span><input required maxLength={80} value={branding.name} onChange={(event) => patch('name', event.target.value)} /></label>
        <label><span>Untertitel</span><input maxLength={120} value={branding.subtitle} onChange={(event) => patch('subtitle', event.target.value)} /></label>
        <label><span>Beschreibung</span><textarea maxLength={500} rows={4} value={branding.description} onChange={(event) => patch('description', event.target.value)} /></label>
        <div className="admin-form-columns"><label><span>Website</span><input autoCapitalize="none" autoCorrect="off" inputMode="url" placeholder="racevora.com" spellCheck={false} type="text" value={branding.websiteUrl} onChange={(event) => patch('websiteUrl', event.target.value)} /><small>Mit oder ohne https://</small></label><label><span>Discord</span><input autoCapitalize="none" autoCorrect="off" inputMode="url" placeholder="discord.gg/deine-liga" spellCheck={false} type="text" value={branding.discordUrl} onChange={(event) => patch('discordUrl', event.target.value)} /><small>Mit oder ohne https://</small></label></div>
        <label><span>Logo</span><input accept="image/png,image/jpeg,image/webp,image/svg+xml" type="file" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} /><small>PNG, JPG, WEBP oder SVG, maximal 2 MB.</small></label>
        {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">Branding wurde gespeichert.</p>}
        <div className="admin-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? 'Speichern …' : 'Branding speichern'}</button></div>
      </form>
    </div>
  </main>;
}
