(() => {
  if (window.RCCSeasonCalendarWizard) return;

  const PANEL_ID = 'rcc-season-calendar-wizard-panel';
  const STYLE_ID = 'rcc-season-calendar-wizard-style';
  const DEFAULT_GAME_KEY = 'f1_25';
  const GAME_LABELS = { f1_25: 'F1 25', f1_26: 'F1 26' };
  const DEFAULT_START_TIME = '20:00';
  const SHORT_SEASON_RACES = 6;
  const REVERSE_TRACK_KEYS = new Set(['great-britain', 'netherlands', 'austria']);
  const WEEKDAYS = [
    { value: 1, label: 'Montag' },
    { value: 2, label: 'Dienstag' },
    { value: 3, label: 'Mittwoch' },
    { value: 4, label: 'Donnerstag' },
    { value: 5, label: 'Freitag' },
    { value: 6, label: 'Samstag' },
    { value: 0, label: 'Sonntag' }
  ];

  const state = {
    initialized: false,
    step: 1,
    context: null,
    activeSeason: null,
    existingRaceCount: 0,
    seasonIndex: 1,
    createSeason: true,
    seasonName: 'Season 1',
    gameKey: DEFAULT_GAME_KEY,
    calendarPreset: 'full',
    raceCount: 0,
    weatherMode: 'random',
    allowReverse: false,
    weekdays: [0],
    startTime: DEFAULT_START_TIME,
    startDate: '',
    generationMode: 'auto',
    manualRows: [],
    saving: false
  };

  let panel = null;

  function ensureStylesheet() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-season-calendar-wizard.css';
    document.head.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function getTracks() {
    const tracks = window.getTracksForSeasonGame?.(state.gameKey) || window.RCC_TRACKS || [];
    return Array.isArray(tracks) ? tracks : [];
  }

  function presetRaceCount(preset = state.calendarPreset) {
    const total = getTracks().length;
    if (!total) return 0;
    if (preset === 'half') return Math.max(1, Math.ceil(total / 2));
    if (preset === 'short') return Math.min(SHORT_SEASON_RACES, total);
    if (preset === 'custom') return Math.max(1, Math.min(total, Number(state.raceCount) || 1));
    return total;
  }

  function setPreset(preset) {
    state.calendarPreset = preset;
    if (preset !== 'custom') state.raceCount = presetRaceCount(preset);
    else state.raceCount = Math.max(1, Math.min(getTracks().length || 1, Number(state.raceCount) || SHORT_SEASON_RACES));
  }

  function selectedWeekdayLabels() {
    return WEEKDAYS
      .filter((item) => state.weekdays.includes(item.value))
      .map((item) => item.label);
  }

  function weatherLabel(value = state.weatherMode) {
    return ({ random: 'Zufällig', dry: 'Trocken', rain: 'Regen' })[value] || value;
  }

  function modeLabel(value = state.generationMode) {
    return value === 'manual' ? 'Rennkalender manuell erstellen' : 'Saison automatisch generieren';
  }

  function showFeedback(message = '', isError = false) {
    const el = panel?.querySelector('[data-season-wizard-feedback]');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message;
    el.classList.toggle('notice-error', Boolean(isError));
  }

  function setBusy(busy) {
    state.saving = Boolean(busy);
    panel?.querySelectorAll('[data-season-wizard-back], [data-season-wizard-next]').forEach((button) => {
      button.disabled = state.saving;
    });
  }

  async function loadContext() {
    const context = await window.RCCData?.getLeagueContext?.({ forceRefresh: true });
    if (!context?.leagueId || !['owner', 'admin'].includes(context.role)) {
      throw new Error('Owner- oder Ligaleitungs-Rechte erforderlich.');
    }

    const activeSeason = await window.RCCData?.fetchCurrentSeason?.({
      forceRefresh: true,
      backgroundRefresh: false
    }).catch(() => null);

    const { data: seasons, error: seasonsError } = await window.supabaseClient
      .from('seasons')
      .select('id,name,slug,game_key,game_label,is_active,created_at')
      .order('created_at', { ascending: true });
    if (seasonsError) throw seasonsError;

    let existingRaceCount = 0;
    if (activeSeason?.id) {
      const { count, error } = await window.supabaseClient
        .from('races')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', activeSeason.id);
      if (error) throw error;
      existingRaceCount = Number(count || 0);
    }

    state.context = context;
    state.activeSeason = activeSeason || null;
    state.existingRaceCount = existingRaceCount;
    state.seasonIndex = Math.max(1, (seasons || []).length + (activeSeason ? 0 : 1));
    state.createSeason = !activeSeason;
    state.seasonName = String(activeSeason?.name || `Season ${state.seasonIndex}`).trim();
    state.gameKey = String(
      activeSeason?.game_key
      || document.getElementById('season-game-select-new')?.value
      || DEFAULT_GAME_KEY
    );
    if (!GAME_LABELS[state.gameKey]) state.gameKey = DEFAULT_GAME_KEY;
    state.calendarPreset = 'full';
    state.raceCount = presetRaceCount('full');
    state.weatherMode = 'random';
    state.allowReverse = false;
    state.weekdays = [0];
    state.startTime = String(document.getElementById('race-time')?.value || DEFAULT_START_TIME);
    if (!/^\d{2}:\d{2}$/.test(state.startTime)) state.startTime = DEFAULT_START_TIME;
    state.startDate = String(document.getElementById('race-date')?.value || todayIso());
    state.generationMode = 'auto';
    state.manualRows = [];
    state.step = 1;
  }

  function buildShellPanel() {
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'rcc-season-calendar-wizard';
    panel.innerHTML = `
      <div class="rcc-season-wizard__progress" data-season-wizard-progress></div>
      <div data-season-wizard-body></div>
      <div class="notice section-spacer-top" data-season-wizard-feedback hidden></div>
      <div class="rcc-season-wizard__footer">
        <button type="button" class="button-secondary" data-season-wizard-back>Zurück</button>
        <button type="button" class="button-primary" data-season-wizard-next>Weiter</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('[data-season-wizard-back]')?.addEventListener('click', previousStep);
    panel.querySelector('[data-season-wizard-next]')?.addEventListener('click', nextStep);
    return panel;
  }

  function renderProgress() {
    const progress = panel?.querySelector('[data-season-wizard-progress]');
    if (!progress) return;
    const steps = state.generationMode === 'manual' && state.step === 7 ? 7 : 6;
    const current = Math.min(state.step, steps);
    progress.innerHTML = `
      <div>
        <strong>Schritt ${current} von ${steps}</strong>
        <span>${state.activeSeason ? `Aktive Season: ${escapeHtml(state.activeSeason.name)}` : `Neue Season: ${escapeHtml(state.seasonName)}`}</span>
      </div>
      <div class="rcc-season-wizard__progress-track" aria-hidden="true">
        <span style="width:${Math.round((current / steps) * 100)}%"></span>
      </div>`;
  }

  function renderStepOne() {
    const active = state.activeSeason;
    const newLeagueText = !active && state.seasonIndex === 1
      ? 'Bei einer neuen Liga beginnt RCC standardmäßig mit Season 1. Den Namen kannst du direkt ändern.'
      : 'Der Season-Name kann vor dem Start frei geändert werden.';

    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Season</div>
        <h3>${active ? 'Aktive Season verwenden' : 'Soll eine neue Season gestartet werden?'}</h3>
        ${active
          ? `<div class="notice">In dieser Liga läuft bereits <strong>${escapeHtml(active.name)}</strong>.
               ${state.existingRaceCount ? `Der Rennkalender enthält bereits ${state.existingRaceCount} Rennen. Neue Kalender werden hier nicht darübergelegt.` : 'Es sind noch keine Rennen angelegt.'}</div>`
          : `<p class="muted">${newLeagueText}</p>
             <div class="rcc-season-wizard__choice-grid">
               <label class="rcc-season-wizard__choice ${state.createSeason ? 'is-selected' : ''}">
                 <input type="radio" name="season-create-choice" value="yes" ${state.createSeason ? 'checked' : ''}>
                 <strong>Ja, neue Season starten</strong>
                 <span>Season anlegen und anschließend den Rennkalender einrichten.</span>
               </label>
               <label class="rcc-season-wizard__choice ${!state.createSeason ? 'is-selected' : ''}">
                 <input type="radio" name="season-create-choice" value="no" ${!state.createSeason ? 'checked' : ''}>
                 <strong>Nein, später</strong>
                 <span>Die Liga bleibt ohne aktive Season. Der Wizard kann später erneut geöffnet werden.</span>
               </label>
             </div>`}

        <div class="form-grid section-spacer-top" data-season-fields ${!active && !state.createSeason ? 'hidden' : ''}>
          <div class="field">
            <label for="season-wizard-name">Season-Name</label>
            <input id="season-wizard-name" maxlength="80" value="${escapeHtml(state.seasonName)}" placeholder="Season 1">
          </div>
          <div class="field">
            <label for="season-wizard-game">Spiel / Streckenbasis</label>
            <select id="season-wizard-game" ${active && state.existingRaceCount ? 'disabled' : ''}>
              ${Object.entries(GAME_LABELS).map(([key, label]) => `<option value="${key}" ${state.gameKey === key ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            ${active && state.existingRaceCount ? '<small>Bei einem bestehenden Rennkalender kann die Streckenbasis nicht mehr geändert werden.</small>' : ''}
          </div>
        </div>
      </div>`;
  }

  function renderStepTwo() {
    const total = getTracks().length;
    const full = total;
    const half = Math.max(1, Math.ceil(total / 2));
    const short = Math.min(SHORT_SEASON_RACES, total);
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Rennkalender</div>
        <h3>Wie umfangreich soll die Season sein?</h3>
        <p class="muted">Die Anzahl kann später über den Kalender angepasst werden.</p>
        <div class="rcc-season-wizard__choice-grid rcc-season-wizard__choice-grid--calendar">
          ${[
            ['full', 'Gesamte Season', `${full} Rennen · alle verfügbaren Strecken`],
            ['half', 'Halbe Season', `${half} Rennen`],
            ['short', 'Kurze Season', `${short} Rennen`],
            ['custom', 'Eigene Anzahl', 'Rennanzahl selbst festlegen']
          ].map(([value, title, desc]) => `
            <label class="rcc-season-wizard__choice ${state.calendarPreset === value ? 'is-selected' : ''}">
              <input type="radio" name="season-calendar-preset" value="${value}" ${state.calendarPreset === value ? 'checked' : ''}>
              <strong>${title}</strong>
              <span>${desc}</span>
            </label>`).join('')}
        </div>
        <div class="field section-spacer-top" data-custom-race-count ${state.calendarPreset === 'custom' ? '' : 'hidden'}>
          <label for="season-wizard-race-count">Anzahl Rennen</label>
          <input id="season-wizard-race-count" type="number" min="1" max="${total}" value="${state.raceCount || short}">
          <small>Maximal ${total} unterschiedliche Standardstrecken stehen für ${escapeHtml(GAME_LABELS[state.gameKey] || state.gameKey)} zur Verfügung.</small>
        </div>
      </div>`;
  }

  function renderStepThree() {
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Wetter</div>
        <h3>Welche Wettervorgabe soll gelten?</h3>
        <div class="rcc-season-wizard__choice-grid">
          ${[
            ['random', 'Zufällig', 'RCC verteilt Trocken- und Regenrennen automatisch.'],
            ['dry', 'Trocken', 'Alle automatisch erzeugten Rennen starten mit Trocken als Vorgabe.'],
            ['rain', 'Regen', 'Alle automatisch erzeugten Rennen starten mit Regen als Vorgabe.']
          ].map(([value, title, desc]) => `
            <label class="rcc-season-wizard__choice ${state.weatherMode === value ? 'is-selected' : ''}">
              <input type="radio" name="season-weather-mode" value="${value}" ${state.weatherMode === value ? 'checked' : ''}>
              <strong>${title}</strong>
              <span>${desc}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }

  function renderStepFour() {
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Strecken</div>
        <h3>Rückwärts-Tracks zulassen?</h3>
        <p class="muted">Wenn aktiviert, kann RCC bei dafür vorgesehenen Strecken ein Rückwärts-Layout in den automatisch erzeugten Kalender aufnehmen.</p>
        <div class="rcc-season-wizard__choice-grid">
          ${[
            ['no', 'Nein', 'Nur normale Streckenlayouts verwenden.'],
            ['yes', 'Ja', 'Rückwärts-Layouts dürfen im Kalender vorkommen.']
          ].map(([value, title, desc]) => {
            const selected = (value === 'yes') === state.allowReverse;
            return `
              <label class="rcc-season-wizard__choice ${selected ? 'is-selected' : ''}">
                <input type="radio" name="season-reverse-mode" value="${value}" ${selected ? 'checked' : ''}>
                <strong>${title}</strong>
                <span>${desc}</span>
              </label>`;
          }).join('')}
        </div>
      </div>`;
  }

  function renderStepFive() {
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Termine</div>
        <h3>Renntage und Startzeit</h3>
        <p class="muted">Diese Angaben dienen der ersten Kalendererstellung. Einzelne Rennen können danach weiterhin verschoben oder angepasst werden.</p>

        <div class="field">
          <label>Renntage</label>
          <div class="rcc-season-wizard__weekday-grid">
            ${WEEKDAYS.map((item) => `
              <label class="rcc-season-wizard__weekday ${state.weekdays.includes(item.value) ? 'is-selected' : ''}">
                <input type="checkbox" name="season-weekday" value="${item.value}" ${state.weekdays.includes(item.value) ? 'checked' : ''}>
                <span>${item.label}</span>
              </label>`).join('')}
          </div>
        </div>

        <div class="form-grid section-spacer-top">
          <div class="field">
            <label for="season-wizard-start-time">Startzeit</label>
            <input id="season-wizard-start-time" type="time" step="60" value="${escapeHtml(state.startTime)}">
          </div>
          <div class="field">
            <label for="season-wizard-start-date">Erster möglicher Renntag</label>
            <input id="season-wizard-start-date" type="date" value="${escapeHtml(state.startDate)}">
            <small>RCC nimmt ab diesem Datum den nächsten ausgewählten Renntag.</small>
          </div>
        </div>
      </div>`;
  }

  function renderStepSix() {
    const tracks = getTracks().length;
    const raceCount = Math.min(state.raceCount || presetRaceCount(), tracks);
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Erstellung</div>
        <h3>Wie soll der Rennkalender erstellt werden?</h3>
        <div class="rcc-season-wizard__choice-grid">
          ${[
            ['auto', 'Saison automatisch generieren', 'RCC wählt Strecken und Reihenfolge automatisch anhand deiner Vorgaben.'],
            ['manual', 'Rennkalender manuell erstellen', 'Du legst jedes Rennen, Datum, Wetter und Rückwärts-Layout selbst fest.']
          ].map(([value, title, desc]) => `
            <label class="rcc-season-wizard__choice ${state.generationMode === value ? 'is-selected' : ''}">
              <input type="radio" name="season-generation-mode" value="${value}" ${state.generationMode === value ? 'checked' : ''}>
              <strong>${title}</strong>
              <span>${desc}</span>
            </label>`).join('')}
        </div>

        <div class="rcc-season-wizard__summary section-spacer-top">
          <strong>Zusammenfassung</strong>
          <dl>
            <div><dt>Season</dt><dd>${escapeHtml(state.seasonName)}</dd></div>
            <div><dt>Rennen</dt><dd>${raceCount}</dd></div>
            <div><dt>Wetter</dt><dd>${escapeHtml(weatherLabel())}</dd></div>
            <div><dt>Rückwärts-Tracks</dt><dd>${state.allowReverse ? 'Ja' : 'Nein'}</dd></div>
            <div><dt>Renntage</dt><dd>${escapeHtml(selectedWeekdayLabels().join(', '))}</dd></div>
            <div><dt>Startzeit</dt><dd>${escapeHtml(state.startTime)}</dd></div>
            <div><dt>Erstellung</dt><dd>${escapeHtml(modeLabel())}</dd></div>
          </dl>
        </div>
      </div>`;
  }

  function manualWeatherDefault() {
    if (state.weatherMode === 'dry') return 'klar';
    if (state.weatherMode === 'rain') return 'regen';
    return Math.random() < 0.5 ? 'klar' : 'regen';
  }

  function generateDates(count) {
    const weekdays = [...new Set(state.weekdays.map(Number))];
    const start = /^\d{4}-\d{2}-\d{2}$/.test(state.startDate) ? state.startDate : todayIso();
    const cursor = new Date(`${start}T00:00:00`);
    const dates = [];
    let guard = 0;
    while (dates.length < count && guard < 3700) {
      if (weekdays.includes(cursor.getDay())) {
        dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
      }
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return dates;
  }

  function initializeManualRows() {
    const count = Math.max(1, Math.min(getTracks().length || 1, Number(state.raceCount) || 1));
    const dates = generateDates(count);
    state.manualRows = Array.from({ length: count }, (_, index) => ({
      trackKey: '',
      date: dates[index] || '',
      time: state.startTime,
      weather: manualWeatherDefault(),
      reverse: false
    }));
  }

  function trackOptions(selectedKey = '') {
    return getTracks()
      .map((track) => `<option value="${escapeHtml(track.key)}" ${track.key === selectedKey ? 'selected' : ''}>${escapeHtml(track.grandPrixName)} · ${escapeHtml(track.circuitName)}</option>`)
      .join('');
  }

  function renderStepSeven() {
    if (!state.manualRows.length) initializeManualRows();
    return `
      <div class="rcc-season-wizard__step">
        <div class="eyebrow">Manueller Rennkalender</div>
        <h3>${state.manualRows.length} Rennen festlegen</h3>
        <p class="muted">Alle Werte bleiben vor dem Speichern vollständig editierbar.</p>
        <div class="table-wrap rcc-season-wizard__manual-wrap">
          <table class="rcc-season-wizard__manual-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Strecke</th>
                <th>Datum</th>
                <th>Start</th>
                <th>Wetter</th>
                <th>Rückwärts</th>
              </tr>
            </thead>
            <tbody>
              ${state.manualRows.map((row, index) => {
                const eligible = REVERSE_TRACK_KEYS.has(row.trackKey);
                return `
                  <tr data-manual-race-row="${index}">
                    <td><strong>${index + 1}</strong></td>
                    <td>
                      <select data-manual-field="trackKey">
                        <option value="">Strecke wählen</option>
                        ${trackOptions(row.trackKey)}
                      </select>
                    </td>
                    <td><input data-manual-field="date" type="date" value="${escapeHtml(row.date)}"></td>
                    <td><input data-manual-field="time" type="time" step="60" value="${escapeHtml(row.time)}"></td>
                    <td>
                      <select data-manual-field="weather">
                        <option value="klar" ${row.weather === 'klar' ? 'selected' : ''}>Trocken</option>
                        <option value="regen" ${row.weather === 'regen' ? 'selected' : ''}>Regen</option>
                        <option value="dynamisch" ${row.weather === 'dynamisch' ? 'selected' : ''}>Dynamisch</option>
                      </select>
                    </td>
                    <td>
                      <label class="checkbox-inline">
                        <input data-manual-field="reverse" type="checkbox" ${row.reverse ? 'checked' : ''} ${!state.allowReverse || !eligible ? 'disabled' : ''}>
                        Ja
                      </label>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${state.allowReverse ? '<div class="notice section-spacer-top">Die Rückwärts-Option wird nur bei dafür vorgesehenen Strecken freigeschaltet.</div>' : ''}
      </div>`;
  }

  function render() {
    buildShellPanel();
    renderProgress();
    const body = panel.querySelector('[data-season-wizard-body]');
    if (!body) return;

    const renderers = {
      1: renderStepOne,
      2: renderStepTwo,
      3: renderStepThree,
      4: renderStepFour,
      5: renderStepFive,
      6: renderStepSix,
      7: renderStepSeven
    };
    body.innerHTML = (renderers[state.step] || renderStepOne)();
    showFeedback('');

    bindStepInputs();

    const back = panel.querySelector('[data-season-wizard-back]');
    const next = panel.querySelector('[data-season-wizard-next]');
    if (back) back.hidden = state.step === 1;
    if (next) {
      if (state.step === 6) next.textContent = state.generationMode === 'manual' ? 'Manuell erstellen' : 'Saison generieren';
      else if (state.step === 7) next.textContent = 'Rennkalender speichern';
      else next.textContent = 'Weiter';
    }
  }

  function syncChoiceStyles(name) {
    panel?.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.closest('.rcc-season-wizard__choice, .rcc-season-wizard__weekday')?.classList.toggle('is-selected', input.checked);
    });
  }

  function bindStepInputs() {
    if (!panel) return;

    if (state.step === 1) {
      panel.querySelectorAll('input[name="season-create-choice"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.createSeason = input.value === 'yes';
          panel.querySelector('[data-season-fields]')?.toggleAttribute('hidden', !state.createSeason);
          syncChoiceStyles('season-create-choice');
        });
      });
      panel.querySelector('#season-wizard-name')?.addEventListener('input', (event) => {
        state.seasonName = String(event.target.value || '');
      });
      panel.querySelector('#season-wizard-game')?.addEventListener('change', (event) => {
        state.gameKey = String(event.target.value || DEFAULT_GAME_KEY);
        setPreset(state.calendarPreset === 'custom' ? 'custom' : state.calendarPreset);
      });
    }

    if (state.step === 2) {
      panel.querySelectorAll('input[name="season-calendar-preset"]').forEach((input) => {
        input.addEventListener('change', () => {
          setPreset(input.value);
          syncChoiceStyles('season-calendar-preset');
          const field = panel.querySelector('[data-custom-race-count]');
          if (field) field.hidden = state.calendarPreset !== 'custom';
          const countInput = panel.querySelector('#season-wizard-race-count');
          if (countInput) countInput.value = String(state.raceCount);
        });
      });
      panel.querySelector('#season-wizard-race-count')?.addEventListener('input', (event) => {
        const max = getTracks().length || 1;
        state.raceCount = Math.max(1, Math.min(max, Number(event.target.value) || 1));
      });
    }

    if (state.step === 3) {
      panel.querySelectorAll('input[name="season-weather-mode"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.weatherMode = input.value;
          syncChoiceStyles('season-weather-mode');
        });
      });
    }

    if (state.step === 4) {
      panel.querySelectorAll('input[name="season-reverse-mode"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.allowReverse = input.value === 'yes';
          syncChoiceStyles('season-reverse-mode');
        });
      });
    }

    if (state.step === 5) {
      panel.querySelectorAll('input[name="season-weekday"]').forEach((input) => {
        input.addEventListener('change', () => {
          const values = [...panel.querySelectorAll('input[name="season-weekday"]:checked')].map((el) => Number(el.value));
          state.weekdays = values;
          syncChoiceStyles('season-weekday');
        });
      });
      panel.querySelector('#season-wizard-start-time')?.addEventListener('change', (event) => {
        state.startTime = String(event.target.value || DEFAULT_START_TIME);
      });
      panel.querySelector('#season-wizard-start-date')?.addEventListener('change', (event) => {
        state.startDate = String(event.target.value || todayIso());
      });
    }

    if (state.step === 6) {
      panel.querySelectorAll('input[name="season-generation-mode"]').forEach((input) => {
        input.addEventListener('change', () => {
          state.generationMode = input.value;
          syncChoiceStyles('season-generation-mode');
          const next = panel.querySelector('[data-season-wizard-next]');
          if (next) next.textContent = state.generationMode === 'manual' ? 'Manuell erstellen' : 'Saison generieren';
        });
      });
    }

    if (state.step === 7) {
      panel.querySelectorAll('[data-manual-race-row]').forEach((rowElement) => {
        const index = Number(rowElement.dataset.manualRaceRow);
        const row = state.manualRows[index];
        if (!row) return;

        rowElement.querySelectorAll('[data-manual-field]').forEach((input) => {
          input.addEventListener('change', () => {
            const field = input.dataset.manualField;
            if (field === 'reverse') row.reverse = Boolean(input.checked);
            else row[field] = String(input.value || '');

            if (field === 'trackKey') {
              const reverseInput = rowElement.querySelector('[data-manual-field="reverse"]');
              const eligible = REVERSE_TRACK_KEYS.has(row.trackKey);
              if (!eligible || !state.allowReverse) {
                row.reverse = false;
                if (reverseInput) reverseInput.checked = false;
              }
              if (reverseInput) reverseInput.disabled = !state.allowReverse || !eligible;
            }
          });
        });
      });
    }
  }

  function syncCurrentStepValues() {
    if (!panel) return;
    if (state.step === 1) {
      const name = panel.querySelector('#season-wizard-name');
      if (name) state.seasonName = String(name.value || '').trim();
      const game = panel.querySelector('#season-wizard-game');
      if (game) state.gameKey = String(game.value || DEFAULT_GAME_KEY);
    } else if (state.step === 2 && state.calendarPreset === 'custom') {
      const input = panel.querySelector('#season-wizard-race-count');
      if (input) state.raceCount = Math.max(1, Math.min(getTracks().length || 1, Number(input.value) || 1));
    } else if (state.step === 5) {
      state.weekdays = [...panel.querySelectorAll('input[name="season-weekday"]:checked')].map((el) => Number(el.value));
      state.startTime = String(panel.querySelector('#season-wizard-start-time')?.value || DEFAULT_START_TIME);
      state.startDate = String(panel.querySelector('#season-wizard-start-date')?.value || todayIso());
    }
  }

  function validateStep() {
    syncCurrentStepValues();

    if (state.step === 1) {
      if (!state.activeSeason && !state.createSeason) return '';
      if (state.seasonName.length < 2) return 'Bitte einen Season-Namen eintragen.';
      if (!GAME_LABELS[state.gameKey]) return 'Bitte eine gültige Streckenbasis auswählen.';
      if (state.activeSeason && state.existingRaceCount > 0) {
        return 'Für diese aktive Season existiert bereits ein Rennkalender. Nutze für nachträgliche Änderungen die Rennverwaltung im Kalenderbereich.';
      }
    }
    if (state.step === 2) {
      const max = getTracks().length;
      if (!max) return 'Für die gewählte Streckenbasis sind keine Strecken verfügbar.';
      if (!state.raceCount || state.raceCount < 1 || state.raceCount > max) return `Bitte zwischen 1 und ${max} Rennen wählen.`;
    }
    if (state.step === 5) {
      if (!state.weekdays.length) return 'Bitte mindestens einen Renntag auswählen.';
      if (!/^\d{2}:\d{2}$/.test(state.startTime)) return 'Bitte eine gültige Startzeit auswählen.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(state.startDate)) return 'Bitte ein gültiges Startdatum auswählen.';
    }
    return '';
  }

  function previousStep() {
    if (state.saving || state.step <= 1) return;
    state.step = Math.max(1, state.step - 1);
    render();
  }

  async function nextStep() {
    if (state.saving) return;
    const error = validateStep();
    if (error) {
      showFeedback(error, true);
      return;
    }

    if (state.step === 1 && !state.activeSeason && !state.createSeason) {
      close();
      return;
    }

    if (state.step < 6) {
      state.step += 1;
      render();
      return;
    }

    if (state.step === 6) {
      if (state.generationMode === 'manual') {
        initializeManualRows();
        state.step = 7;
        render();
        return;
      }
      await saveAutomaticCalendar();
      return;
    }

    if (state.step === 7) {
      await saveManualCalendar();
    }
  }

  async function ensureSeason() {
    const context = state.context || await window.RCCData.getLeagueContext({ forceRefresh: true });
    let season = state.activeSeason;

    if (!season?.id) {
      if (!state.createSeason) throw new Error('Es wurde keine neue Season ausgewählt.');
      const gameLabel = GAME_LABELS[state.gameKey] || state.gameKey;
      const { data, error } = await window.supabaseClient.rpc('create_next_league_season', {
        p_league_id: context.leagueId,
        p_game_key: state.gameKey,
        p_game_label: gameLabel
      });
      if (error) throw error;
      if (!data?.id) throw new Error('Die neue Season konnte nicht angelegt werden.');
      season = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        game_key: data.game_key || state.gameKey,
        game_label: data.game_label || gameLabel
      };
      state.activeSeason = season;
    }

    const updates = {
      name: state.seasonName.trim(),
      game_key: state.gameKey,
      game_label: GAME_LABELS[state.gameKey] || state.gameKey
    };
    const { error: updateError } = await window.supabaseClient
      .from('seasons')
      .update(updates)
      .eq('id', season.id);
    if (updateError) throw updateError;

    season = { ...season, ...updates };
    state.activeSeason = season;
    return season;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function automaticWeather() {
    if (state.weatherMode === 'dry') return 'klar';
    if (state.weatherMode === 'rain') return 'regen';
    return Math.random() < 0.5 ? 'klar' : 'regen';
  }

  function applyReverseChoices(selectedTracks) {
    const rows = selectedTracks.map((track) => ({
      track,
      reverse: Boolean(state.allowReverse && REVERSE_TRACK_KEYS.has(track.key) && Math.random() < 0.5)
    }));

    if (state.allowReverse && !rows.some((row) => row.reverse)) {
      const eligible = rows.filter((row) => REVERSE_TRACK_KEYS.has(row.track.key));
      if (eligible.length) eligible[Math.floor(Math.random() * eligible.length)].reverse = true;
    }
    return rows;
  }

  function buildRacePayload(seasonId, entries, dates) {
    return entries.map((entry, index) => {
      const track = entry.track;
      const reverse = Boolean(entry.reverse);
      return {
        season_id: seasonId,
        round_number: index + 1,
        race_order: index + 1,
        grand_prix_name: track.grandPrixName,
        circuit_name: reverse ? `${track.circuitName} · Rückwärts` : track.circuitName,
        country_code: track.countryCode || null,
        race_date: dates[index],
        race_time: state.startTime,
        status: 'upcoming',
        weather: automaticWeather(),
        notes: `Saison-Wizard · ${reverse ? 'Rückwärts-Layout · ' : ''}Renntage: ${selectedWeekdayLabels().join(', ')} · Rennstart: ${state.startTime}`
      };
    });
  }

  async function assertSeasonHasNoRaces(seasonId) {
    const { count, error } = await window.supabaseClient
      .from('races')
      .select('id', { count: 'exact', head: true })
      .eq('season_id', seasonId);
    if (error) throw error;
    if (Number(count || 0) > 0) {
      throw new Error('Diese Season enthält bereits Rennen. Der Wizard überschreibt einen bestehenden Rennkalender nicht.');
    }
  }

  async function updateSeasonDates(seasonId, raceRows) {
    const dates = raceRows.map((row) => row.race_date).filter(Boolean).sort();
    if (!dates.length) return;
    const { error } = await window.supabaseClient
      .from('seasons')
      .update({ start_date: dates[0], end_date: dates[dates.length - 1] })
      .eq('id', seasonId);
    if (error) throw error;
  }

  async function finishSave(message) {
    showFeedback(message);
    await window.RCCData?.fetchCurrentSeason?.({ forceRefresh: true, backgroundRefresh: false }).catch(() => null);
    window.setTimeout(() => window.location.reload(), 700);
  }

  async function saveAutomaticCalendar() {
    setBusy(true);
    showFeedback('Season und Rennkalender werden erstellt …');

    try {
      const season = await ensureSeason();
      await assertSeasonHasNoRaces(season.id);

      const tracks = getTracks();
      const count = Math.max(1, Math.min(tracks.length, Number(state.raceCount) || presetRaceCount()));
      const selected = shuffle(tracks).slice(0, count);
      const withReverse = applyReverseChoices(selected);
      const dates = generateDates(count);
      if (dates.length !== count) throw new Error('Die Renndaten konnten nicht vollständig erzeugt werden.');

      const rows = buildRacePayload(season.id, withReverse, dates);
      const { error } = await window.supabaseClient.from('races').insert(rows);
      if (error) throw error;
      await updateSeasonDates(season.id, rows);

      await finishSave(`${state.seasonName} wurde mit ${rows.length} Rennen angelegt.`);
    } catch (error) {
      console.error(error);
      showFeedback(error.message || 'Season konnte nicht erstellt werden.', true);
      setBusy(false);
    }
  }

  function validateManualRows() {
    const seenTracks = new Set();
    for (let index = 0; index < state.manualRows.length; index += 1) {
      const row = state.manualRows[index];
      if (!row.trackKey) return `Bitte für Rennen ${index + 1} eine Strecke auswählen.`;
      if (seenTracks.has(row.trackKey)) return `Die Strecke in Rennen ${index + 1} wurde bereits verwendet. Bitte jede Strecke nur einmal auswählen.`;
      seenTracks.add(row.trackKey);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return `Bitte für Rennen ${index + 1} ein gültiges Datum auswählen.`;
      if (!/^\d{2}:\d{2}$/.test(row.time)) return `Bitte für Rennen ${index + 1} eine gültige Startzeit auswählen.`;
      if (!['klar', 'regen', 'dynamisch'].includes(row.weather)) return `Bitte für Rennen ${index + 1} ein Wetter auswählen.`;
      if (row.reverse && !REVERSE_TRACK_KEYS.has(row.trackKey)) return `Rennen ${index + 1} unterstützt kein Rückwärts-Layout.`;
    }
    return '';
  }

  function syncManualRowsFromDom() {
    panel?.querySelectorAll('[data-manual-race-row]').forEach((rowElement) => {
      const index = Number(rowElement.dataset.manualRaceRow);
      const row = state.manualRows[index];
      if (!row) return;
      row.trackKey = String(rowElement.querySelector('[data-manual-field="trackKey"]')?.value || '');
      row.date = String(rowElement.querySelector('[data-manual-field="date"]')?.value || '');
      row.time = String(rowElement.querySelector('[data-manual-field="time"]')?.value || '');
      row.weather = String(rowElement.querySelector('[data-manual-field="weather"]')?.value || 'klar');
      row.reverse = Boolean(rowElement.querySelector('[data-manual-field="reverse"]')?.checked);
    });
  }

  async function saveManualCalendar() {
    syncManualRowsFromDom();
    const validationError = validateManualRows();
    if (validationError) {
      showFeedback(validationError, true);
      return;
    }

    setBusy(true);
    showFeedback('Season und manueller Rennkalender werden gespeichert …');

    try {
      const season = await ensureSeason();
      await assertSeasonHasNoRaces(season.id);
      const trackByKey = new Map(getTracks().map((track) => [track.key, track]));
      const rows = state.manualRows.map((row, index) => {
        const track = trackByKey.get(row.trackKey);
        if (!track) throw new Error(`Strecke für Rennen ${index + 1} wurde nicht gefunden.`);
        return {
          season_id: season.id,
          round_number: index + 1,
          race_order: index + 1,
          grand_prix_name: track.grandPrixName,
          circuit_name: row.reverse ? `${track.circuitName} · Rückwärts` : track.circuitName,
          country_code: track.countryCode || null,
          race_date: row.date,
          race_time: row.time,
          status: 'upcoming',
          weather: row.weather,
          notes: `Saison-Wizard · Manuell erstellt${row.reverse ? ' · Rückwärts-Layout' : ''}`
        };
      });

      const { error } = await window.supabaseClient.from('races').insert(rows);
      if (error) throw error;
      await updateSeasonDates(season.id, rows);

      await finishSave(`${state.seasonName} und ${rows.length} manuell geplante Rennen wurden gespeichert.`);
    } catch (error) {
      console.error(error);
      showFeedback(error.message || 'Der manuelle Rennkalender konnte nicht gespeichert werden.', true);
      setBusy(false);
    }
  }

  function close() {
    window.RCCWizardDialog?.close?.();
  }

  async function open(options = {}) {
    ensureStylesheet();
    buildShellPanel();
    try {
      await loadContext();
      render();
      if (!window.RCCWizardDialog?.open) {
        panel.hidden = false;
        return true;
      }
      return window.RCCWizardDialog.open(panel, {
        title: options.title || 'Season & Rennkalender einrichten',
        headerActionLabel: 'Später einrichten',
        onHeaderAction: close
      });
    } catch (error) {
      console.error(error);
      window.alert?.(error.message || 'Season-Wizard konnte nicht geöffnet werden.');
      return false;
    }
  }

  function init() {
    if (state.initialized) return;
    ensureStylesheet();
    state.initialized = true;
  }

  window.RCCSeasonCalendarWizard = {
    init,
    open,
    close,
    getState: () => ({ ...state, weekdays: [...state.weekdays], manualRows: state.manualRows.map((row) => ({ ...row })) })
  };
})();