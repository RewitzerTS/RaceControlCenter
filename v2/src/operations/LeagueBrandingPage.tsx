import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from '../league/LeagueProvider';
import { THEME_PRESETS } from '../league/leagueBranding';
import { useRole } from '../roles/RoleProvider';
import { loadLeagueBranding, updateLeagueBranding, uploadLeagueLogo, type LeagueBranding } from './operations';

const EMPTY: LeagueBranding = { id: '', name: '', slug: '', logoUrl: '', subtitle: '', description: '', websiteUrl: '', discordUrl: '', themePreset: 1 };
const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

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

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    setError('');
    void loadLeagueBranding(client, leagueSlug).then((data) => { if (active) { setBranding(data); setLoading(false); } }).catch((reason) => { if (active) { setError(reason instanceof Error ? reason.message : 'Branding konnte nicht geladen werden.'); setLoading(false); } });
    return () => { active = false; };
  }, [allowed, client, leagueSlug]);

  function patch<K extends keyof LeagueBranding>(key: K, value: LeagueBranding[K]) { setBranding((current) => ({ ...current, [key]: value })); setSaved(false); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(''); setSaved(false); setSaving(true);
    try {
      let logoUrl = branding.logoUrl;
      if (logoFile) {
        if (!ALLOWED_LOGO_TYPES.has(logoFile.type) || logoFile.size > 2 * 1024 * 1024) throw new Error('Logo bitte als PNG, JPG, WEBP oder SVG bis maximal 2 MB wählen.');
        logoUrl = await uploadLeagueLogo(client, leagueSlug, logoFile);
      }
      const updated = await updateLeagueBranding(client, { ...branding, logoUrl });
      setBranding(updated); setLogoFile(null); await refreshBranding(); setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Das Branding konnte nicht gespeichert werden.'); }
    finally { setSaving(false); }
  }

  if (!allowed) return <main className="driver-state" id="main-content"><span className="state-mark">17</span><div><h1>Zugriff verweigert</h1></div></main>;
  if (loading) return <main className="driver-state" id="main-content"><span className="state-mark">B</span><div><h1>Branding wird geladen …</h1></div></main>;
  const theme = THEME_PRESETS.find((item) => item.id === branding.themePreset) ?? THEME_PRESETS[1];

  return <main className="operations-page admin-form-page" id="main-content">
    <header className="operations-header"><div><p className="section-label">V1 Admin · {leagueSlug}</p><h1>Branding</h1><p>Name, Logo, Links und Farbstimmung der ausgewählten Liga verwalten. Änderungen gelten ausschließlich für <strong>{leagueSlug}</strong>.</p></div><NavLink className="text-link" to="/admin">Zum Admin-Menü</NavLink></header>
    <div className="branding-layout">
      <form className="admin-form" onSubmit={(event) => void submit(event)}>
        <label><span>Liganame</span><input required maxLength={80} value={branding.name} onChange={(event) => patch('name', event.target.value)} /></label>
        <label><span>Untertitel</span><input maxLength={120} value={branding.subtitle} onChange={(event) => patch('subtitle', event.target.value)} /></label>
        <label><span>Beschreibung</span><textarea maxLength={500} rows={4} value={branding.description} onChange={(event) => patch('description', event.target.value)} /></label>
        <div className="admin-form-columns"><label><span>Website</span><input type="url" placeholder="https://" value={branding.websiteUrl} onChange={(event) => patch('websiteUrl', event.target.value)} /></label><label><span>Discord</span><input type="url" placeholder="https://discord.gg/…" value={branding.discordUrl} onChange={(event) => patch('discordUrl', event.target.value)} /></label></div>
        <label><span>Logo</span><input accept="image/png,image/jpeg,image/webp,image/svg+xml" type="file" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} /><small>PNG, JPG, WEBP oder SVG, maximal 2 MB.</small></label>
        <fieldset className="theme-picker"><legend>Farbthema</legend>{THEME_PRESETS.map((item) => <label key={item.id} className={branding.themePreset === item.id ? 'theme-option theme-option--active' : 'theme-option'}><input type="radio" name="theme" checked={branding.themePreset === item.id} onChange={() => patch('themePreset', item.id)} /><span className="theme-swatches" aria-hidden="true">{[item.primary, item.accent, item.accent2].map((color) => <i key={color} style={{ background: color }} />)}</span><span><strong>{item.name}</strong><small>{item.subtitle}</small></span></label>)}</fieldset>
        {error && <p className="inline-error" role="alert">{error}</p>}{saved && <p className="inline-success" role="status">Branding wurde gespeichert.</p>}
        <div className="admin-form-actions"><button className="primary-action" disabled={saving} type="submit">{saving ? 'Speichern …' : 'Branding speichern'}</button></div>
      </form>
      <aside className="branding-preview" style={{ '--preview-primary': theme.primary, '--preview-secondary': theme.surface, '--preview-accent': theme.accent } as React.CSSProperties}>
        <p>Live-Vorschau</p>{branding.logoUrl ? <img src={branding.logoUrl} alt="" /> : <span className="preview-mark">RV</span>}<h2>{branding.name || 'Deine Liga'}</h2><small>{branding.subtitle || 'Race Management Platform'}</small><button type="button">Beispiel-Button</button>
      </aside>
    </div>
  </main>;
}
