(() => {
  let initialized = false;
  let season = null;
  let races = [];
  let drivers = [];
  let teams = [];
  let assignments = [];

  const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const opt = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;

  function feedback(message, isError = false) {
    const el = document.getElementById('season-roster-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function latestAssignment(driverId) {
    return assignments
      .filter((row) => String(row.driver_id) === String(driverId))
      .sort((a,b) => Number(b.effective_round_number || 0) - Number(a.effective_round_number || 0) || new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
  }

  async function loadData() {
    season = await window.RCCData.fetchCurrentSeason({ forceRefresh: true, backgroundRefresh: false });
    if (!season?.id) return;
    const context = await window.RCCData.getLeagueContext({ forceRefresh: true });
    [races, drivers] = await Promise.all([
      window.RCCData.fetchRaces({ seasonId: season.id, forceRefresh: true, backgroundRefresh: false }),
      window.RCCData.fetchDrivers({ forceRefresh: true, backgroundRefresh: false })
    ]);
    const [{ data: teamRows, error: teamError }, { data: assignmentRows, error: assignmentError }] = await Promise.all([
      window.supabaseClient.from('teams').select('id, display_name').eq('league_id', context.leagueId).order('display_name'),
      window.supabaseClient.from('driver_season_assignments').select('id, driver_id, team_id, league_team, is_primary, effective_from_race_id, effective_round_number, created_at').eq('season_id', season.id).order('created_at')
    ]);
    if (teamError) throw teamError;
    if (assignmentError) throw assignmentError;
    teams = teamRows || [];
    assignments = assignmentRows || [];
  }

  function renderForm() {
    const driverSelect = document.getElementById('season-roster-driver');
    const teamSelect = document.getElementById('season-roster-team');
    const raceSelect = document.getElementById('season-roster-race');
    if (driverSelect) driverSelect.innerHTML = '<option value="">Fahrer auswählen</option>' + drivers.map(d => opt(d.id, d.display_name)).join('');
    if (teamSelect) teamSelect.innerHTML = '<option value="">Kein Team</option>' + teams.map(t => opt(t.id, t.display_name)).join('');
    if (raceSelect) raceSelect.innerHTML = '<option value="">Ab nächstem Lauf</option>' + races.slice().sort((a,b)=>Number(a.round_number||0)-Number(b.round_number||0)).map(r => opt(r.id, `R${r.round_number || '?'} · ${r.grand_prix_name || 'Rennen'}`)).join('');
  }

  function renderList() {
    const list = document.getElementById('season-roster-list');
    if (!list) return;
    const rows = drivers.map(driver => ({ driver, assignment: latestAssignment(driver.id) })).filter(row => row.assignment);
    if (!rows.length) {
      list.innerHTML = '<div class="notice">Für die aktive Saison sind noch keine Fahrerzuordnungen vorhanden.</div>';
      return;
    }
    list.innerHTML = rows.map(({driver, assignment}) => {
      const role = assignment.is_primary ? 'Stammfahrer' : (assignment.team_id || assignment.league_team ? 'Ersatzfahrer' : 'Inaktiv');
      const from = assignment.effective_round_number ? `ab R${assignment.effective_round_number}` : 'seit Saisonstart';
      return `<article class="panel section-spacer-top"><strong>${esc(driver.display_name)}</strong><div class="muted">${esc(role)} · ${esc(assignment.league_team || 'ohne Team')} · ${esc(from)}</div></article>`;
    }).join('');
  }

  async function refresh() {
    feedback('');
    try {
      await loadData();
      const empty = document.getElementById('season-roster-empty');
      const form = document.getElementById('season-roster-form');
      if (empty) { empty.hidden = Boolean(season?.id); empty.textContent = season?.id ? '' : 'Es gibt noch keine aktive Saison.'; }
      if (form) form.hidden = !season?.id;
      renderForm();
      renderList();
    } catch (error) {
      console.error(error);
      feedback(`Saisonkader konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`, true);
    }
  }

  async function save() {
    const driverId = document.getElementById('season-roster-driver')?.value || '';
    const role = document.getElementById('season-roster-role')?.value || 'reserve';
    const teamId = document.getElementById('season-roster-team')?.value || null;
    const raceId = document.getElementById('season-roster-race')?.value || null;
    if (!season?.id || !driverId) return feedback('Bitte einen Fahrer auswählen.', true);
    if (role === 'primary' && !teamId) return feedback('Ein Stammfahrer benötigt ein Team.', true);
    const button = document.getElementById('season-roster-save');
    if (button) button.disabled = true;
    feedback('Änderung wird gespeichert...');
    try {
      const { data, error } = await window.supabaseClient.rpc('set_season_driver_status', {
        p_season_id: season.id,
        p_driver_id: driverId,
        p_role: role,
        p_team_id: role === 'inactive' ? null : teamId,
        p_effective_from_race_id: raceId
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Änderung konnte nicht gespeichert werden.');
      feedback(`Fahrerstatus gespeichert – wirksam ab Runde ${data.effective_round_number}.`);
      await refresh();
      await window.RCCRaceSubstitutions?.refresh?.();
    } catch (error) {
      console.error(error);
      feedback(`Speichern fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function buildPanel() {
    if (document.getElementById('admin-section-season-roster')) return;
    const layout = document.querySelector('.admin-layout');
    if (!layout) return;
    const panel = document.createElement('details');
    panel.className = 'panel admin-panel-wide';
    panel.id = 'admin-section-season-roster';
    panel.innerHTML = `<summary><strong>👥 Saisonkader verwalten</strong></summary><section class="panel admin-panel-wide admin-panel-accent">
      <h3>Fahrerstatus & Teamwechsel</h3>
      <div class="notice">Änderungen gelten ab dem ausgewählten Rennen. Frühere Rennen und Punkte bleiben historisch unverändert. Du kannst Fahrer zu Stammfahrern machen, als Ersatzfahrer führen, das Team wechseln oder abmelden.</div>
      <div id="season-roster-empty" class="notice section-spacer-top" hidden></div>
      <div id="season-roster-form" class="section-spacer-top" hidden><div class="form-grid">
        <div class="field"><label for="season-roster-driver">Fahrer</label><select id="season-roster-driver"></select></div>
        <div class="field"><label for="season-roster-role">Status</label><select id="season-roster-role"><option value="primary">Stammfahrer</option><option value="reserve">Ersatzfahrer</option><option value="inactive">Abmelden / inaktiv</option></select></div>
        <div class="field"><label for="season-roster-team">Team</label><select id="season-roster-team"></select></div>
        <div class="field"><label for="season-roster-race">Wirksam ab</label><select id="season-roster-race"></select></div>
      </div><div class="card-actions"><button type="button" class="button-primary" id="season-roster-save">Änderung speichern</button></div></div>
      <div id="season-roster-feedback" class="notice section-spacer-top" hidden></div><div id="season-roster-list" class="section-spacer-top"></div>
    </section>`;
    layout.appendChild(panel);
    panel.querySelector('#season-roster-save')?.addEventListener('click', save);
    panel.querySelector('#season-roster-role')?.addEventListener('change', (event) => {
      const team = panel.querySelector('#season-roster-team');
      if (team) team.disabled = event.target.value === 'inactive';
    });
    panel.addEventListener('toggle', () => { if (panel.open) refresh(); });
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    if (!context?.leagueId || !['owner','admin'].includes(context.role)) return;
    buildPanel();
    initialized = true;
  }

  window.RCCSeasonRoster = { init, refresh };
})();
