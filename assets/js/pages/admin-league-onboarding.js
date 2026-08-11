(() => {
  const GAME_OPTIONS = {
    f1_25: { label: 'F1 25' },
    f1_26: { label: 'F1 26' },
    other: { label: 'Anderes Rennspiel' }
  };
  const DEFAULT_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  let initialized = false;
  let currentStep = 1;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || '')
      .trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'liga';
  }

  function parsePoints(value) {
    return String(value || '')
      .split(/[,;\s]+/)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 0)
      .map((item) => Math.round(item));
  }

  function parseTeams(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, shortName] = line.split('|').map((part) => part.trim());
        return { name, short_name: shortName || '' };
      })
      .filter((team) => team.name);
  }

  function parseDrivers(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, gamertag, team, number] = line.split('|').map((part) => part.trim());
        return { name, gamertag: gamertag || '', team: team || '', number: number || '' };
      })
      .filter((driver) => driver.name);
  }

  function parseRaces(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, circuit, date, time] = line.split('|').map((part) => part.trim());
        return { name, circuit: circuit || '', date: date || '', time: time || '' };
      })
      .filter((race) => race.name);
  }

  function getValue(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function showFeedback(message, isError = false) {
    const el = document.getElementById('league-onboarding-feedback');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function payloadFromForm() {
    const gameKey = getValue('onboarding-game') || 'f1_25';
    const customGame = getValue('onboarding-game-custom');
    const gameLabel = gameKey === 'other' ? customGame : (GAME_OPTIONS[gameKey]?.label || gameKey);
    const points = parsePoints(getValue('onboarding-points'));

    return {
      game_key: gameKey === 'other' ? slugify(gameLabel) : gameKey,
      game_label: gameLabel,
      season: {
        name: getValue('onboarding-season-name'),
        start_date: getValue('onboarding-season-start')
      },
      scoring: {
        points,
        fastest_lap_bonus: Number(getValue('onboarding-fastest-lap-bonus') || 0),
        fastest_lap_top_n: Number(getValue('onboarding-fastest-lap-top-n') || 0)
      },
      teams: parseTeams(getValue('onboarding-teams')),
      drivers: parseDrivers(getValue('onboarding-drivers')),
      races: parseRaces(getValue('onboarding-races')),
      publish: document.getElementById('onboarding-publish')?.checked === true
    };
  }

  function validateStep(step) {
    const payload = payloadFromForm();
    if (step === 1 && (!payload.game_label || payload.game_label.length < 2)) return 'Bitte ein Rennspiel auswählen oder eintragen.';
    if (step === 2 && payload.season.name.length < 2) return 'Bitte einen Namen für die erste Saison eintragen.';
    if (step === 3 && !payload.scoring.points.length) return 'Bitte mindestens einen Punktewert eintragen.';
    if (step === 4 && !payload.drivers.length) return 'Bitte mindestens einen Fahrer eintragen.';
    if (step === 5 && !payload.races.length) return 'Bitte mindestens ein Rennen eintragen.';
    return '';
  }

  function renderReview() {
    const target = document.getElementById('onboarding-review');
    if (!target) return;
    const payload = payloadFromForm();
    const teamNames = payload.teams.map((team) => team.name).join(', ') || 'Keine Teams';
    target.innerHTML = `
      <div class="notice">
        <strong>${escapeHtml(payload.game_label)}</strong><br>
        Saison: ${escapeHtml(payload.season.name)}${payload.season.start_date ? ` · Start ${escapeHtml(payload.season.start_date)}` : ''}<br>
        Punkte: ${escapeHtml(payload.scoring.points.join(' / '))}<br>
        Schnellste Runde: +${escapeHtml(payload.scoring.fastest_lap_bonus)}${payload.scoring.fastest_lap_top_n ? ` bis Platz ${escapeHtml(payload.scoring.fastest_lap_top_n)}` : ''}<br>
        Teams (${payload.teams.length}): ${escapeHtml(teamNames)}<br>
        Fahrer: ${payload.drivers.length} · Rennen: ${payload.races.length}<br>
        Veröffentlichung: ${payload.publish ? 'direkt veröffentlichen' : 'vorerst nicht veröffentlichen'}
      </div>`;
  }

  function showStep(step) {
    currentStep = Math.max(1, Math.min(6, step));
    document.querySelectorAll('[data-onboarding-step]').forEach((section) => {
      section.hidden = Number(section.dataset.onboardingStep) !== currentStep;
    });
    document.querySelectorAll('[data-onboarding-progress]').forEach((item) => {
      item.setAttribute('aria-current', Number(item.dataset.onboardingProgress) === currentStep ? 'step' : 'false');
    });
    const back = document.getElementById('onboarding-back');
    const next = document.getElementById('onboarding-next');
    const finish = document.getElementById('onboarding-finish');
    if (back) back.hidden = currentStep === 1;
    if (next) next.hidden = currentStep === 6;
    if (finish) finish.hidden = currentStep !== 6;
    if (currentStep === 6) renderReview();
    showFeedback('');
  }

  async function finishOnboarding() {
    const payload = payloadFromForm();
    for (let step = 1; step <= 5; step += 1) {
      const error = validateStep(step);
      if (error) {
        showStep(step);
        showFeedback(error, true);
        return;
      }
    }

    const leagueId = window.RCCLeagueContext?.getLeagueId?.();
    if (!leagueId) {
      showFeedback('Keine aktive Liga gefunden.', true);
      return;
    }

    const button = document.getElementById('onboarding-finish');
    if (button) button.disabled = true;
    showFeedback('Liga wird eingerichtet...');

    try {
      const { data, error } = await window.supabaseClient.rpc('complete_league_onboarding', {
        p_league_id: leagueId,
        p_payload: payload
      });
      if (error) throw error;
      if (!data?.ok) throw new Error('Die Einrichtung konnte nicht abgeschlossen werden.');

      try {
        Object.keys(window.localStorage || {}).forEach((key) => {
          if (key.startsWith('rcc_query_cache_v2')) window.localStorage.removeItem(key);
        });
      } catch {}

      showFeedback(`Einrichtung abgeschlossen: ${data.drivers_created || 0} Fahrer und ${data.races_created || 0} Rennen angelegt.`);
      const url = new URL(window.location.href);
      url.searchParams.delete('onboarding');
      window.setTimeout(() => window.location.assign(url.toString()), 500);
    } catch (error) {
      console.error(error);
      showFeedback(`Einrichtung fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
      if (button) button.disabled = false;
    }
  }

  function buildPanel(context) {
    if (document.getElementById('admin-section-league-onboarding')) return;
    const layout = document.querySelector('.admin-layout');
    if (!layout) return;

    const panel = document.createElement('section');
    panel.className = 'panel admin-panel-wide admin-panel-accent';
    panel.id = 'admin-section-league-onboarding';
    panel.innerHTML = `
      <h2>🏁 Liga einrichten</h2>
      <div class="notice">Deine Liga <strong>${escapeHtml(context.league?.name || '')}</strong> ist angelegt. In sechs Schritten machen wir sie startklar.</div>
      <div class="card-actions section-spacer-top" aria-label="Einrichtungsfortschritt">
        ${[1,2,3,4,5,6].map((step) => `<span class="button-secondary" data-onboarding-progress="${step}">${step}</span>`).join('')}
      </div>

      <div data-onboarding-step="1">
        <h3>1. Rennspiel auswählen</h3>
        <div class="field"><label for="onboarding-game">Spiel</label><select id="onboarding-game">
          <option value="f1_25">F1 25</option><option value="f1_26">F1 26</option><option value="other">Anderes Rennspiel</option>
        </select></div>
        <div class="field" id="onboarding-custom-game-field" hidden><label for="onboarding-game-custom">Name des Spiels</label><input id="onboarding-game-custom" maxlength="80" placeholder="z. B. Assetto Corsa Competizione"></div>
      </div>

      <div data-onboarding-step="2" hidden>
        <h3>2. Erste Saison anlegen</h3>
        <div class="form-grid"><div class="field"><label for="onboarding-season-name">Saisonname</label><input id="onboarding-season-name" maxlength="80" value="Saison 1"></div>
        <div class="field"><label for="onboarding-season-start">Startdatum</label><input id="onboarding-season-start" type="date"></div></div>
      </div>

      <div data-onboarding-step="3" hidden>
        <h3>3. Punktesystem festlegen</h3>
        <div class="notice">Standard ist das klassische F1-System. Du kannst die Werte einfach überschreiben.</div>
        <div class="field"><label for="onboarding-points">Punkte ab Platz 1</label><input id="onboarding-points" value="${DEFAULT_POINTS.join(', ')}"></div>
        <div class="form-grid"><div class="field"><label for="onboarding-fastest-lap-bonus">Bonus schnellste Runde</label><input id="onboarding-fastest-lap-bonus" type="number" min="0" max="20" value="1"></div>
        <div class="field"><label for="onboarding-fastest-lap-top-n">Bonus nur bis Platz</label><input id="onboarding-fastest-lap-top-n" type="number" min="0" max="99" value="10"><small>0 = unabhängig von der Platzierung</small></div></div>
      </div>

      <div data-onboarding-step="4" hidden>
        <h3>4. Fahrer und Teams anlegen</h3>
        <div class="field"><label for="onboarding-teams">Teams · eine Zeile je Team</label><textarea id="onboarding-teams" rows="6" placeholder="McLaren | MCL\nFerrari | FER"></textarea><small>Format: Teamname | Kürzel. Teams sind optional.</small></div>
        <div class="field"><label for="onboarding-drivers">Fahrer · eine Zeile je Fahrer</label><textarea id="onboarding-drivers" rows="10" placeholder="Max Mustermann | MaxRacing | McLaren | 7\nErika Beispiel | SpeedErika | Ferrari | 23"></textarea><small>Format: Anzeigename | Gamertag | Team | Startnummer</small></div>
      </div>

      <div data-onboarding-step="5" hidden>
        <h3>5. Rennkalender erstellen</h3>
        <div class="field"><label for="onboarding-races">Rennen · eine Zeile je Lauf</label><textarea id="onboarding-races" rows="12" placeholder="Großer Preis von Bahrain | Bahrain International Circuit | 2026-09-06 | 20:00\nGroßer Preis von Saudi-Arabien | Jeddah Corniche Circuit | 2026-09-13 | 20:00"></textarea><small>Format: Rennname | Strecke | YYYY-MM-DD | HH:MM. Die Reihenfolge der Zeilen wird zur Rundennummer.</small></div>
      </div>

      <div data-onboarding-step="6" hidden>
        <h3>6. Prüfen und veröffentlichen</h3>
        <div id="onboarding-review"></div>
        <label><input id="onboarding-publish" type="checkbox" checked> Liga nach erfolgreicher Einrichtung veröffentlichen</label>
        <div class="notice section-spacer-top">Mit „Einrichtung abschließen“ werden alle Daten in einer gemeinsamen Datenbank-Transaktion angelegt.</div>
      </div>

      <div id="league-onboarding-feedback" class="notice section-spacer-top" hidden></div>
      <div class="card-actions section-spacer-top">
        <button type="button" class="button-secondary" id="onboarding-back" hidden>Zurück</button>
        <button type="button" class="button-primary" id="onboarding-next">Weiter</button>
        <button type="button" class="button-primary" id="onboarding-finish" hidden>Einrichtung abschließen</button>
      </div>`;

    layout.insertBefore(panel, layout.firstChild);

    panel.querySelector('#onboarding-game')?.addEventListener('change', (event) => {
      const customField = panel.querySelector('#onboarding-custom-game-field');
      if (customField) customField.hidden = event.target.value !== 'other';
    });
    panel.querySelector('#onboarding-next')?.addEventListener('click', () => {
      const error = validateStep(currentStep);
      if (error) return showFeedback(error, true);
      showStep(currentStep + 1);
    });
    panel.querySelector('#onboarding-back')?.addEventListener('click', () => showStep(currentStep - 1));
    panel.querySelector('#onboarding-finish')?.addEventListener('click', finishOnboarding);
    panel.querySelector('#onboarding-publish')?.addEventListener('change', renderReview);
    showStep(1);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function init() {
    if (initialized) return;
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true }).catch(() => null);
    if (!context?.leagueId || !['owner', 'admin'].includes(context.role)) return;

    const onboardingComplete = context.league?.settings?.onboarding_complete === true;
    const requested = new URLSearchParams(window.location.search).get('onboarding') === '1';
    const seasons = await window.RCCData.fetchSeasons({ forceRefresh: true, backgroundRefresh: false }).catch(() => []);
    if (onboardingComplete && seasons.length) return;
    if (!requested && seasons.length) return;

    buildPanel(context);
    initialized = true;
  }

  window.RCCLeagueOnboarding = { init, payloadFromForm, parseTeams, parseDrivers, parseRaces };
})();
