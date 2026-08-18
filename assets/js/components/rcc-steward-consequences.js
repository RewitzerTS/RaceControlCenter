(() => {
  'use strict';

  if (window.RCCStewardConsequences) return;

  const DSQ_SORT_DELTA_MS = 2147480000;
  let busy = false;
  let resultReleasePromise = null;

  function pageConfig() {
    const page = document.body?.dataset?.page;
    if (page === 'admin') {
      return {
        page,
        button: document.getElementById('save-incident-btn') || document.getElementById('save-steward-consequence-btn'),
        caseId: 'incident-edit-id',
        raceId: 'incident-race',
        title: 'incident-title',
        description: 'incident-description',
        decision: 'incident-decision',
        consequence: 'incident-consequence',
        driver1: 'incident-driver-1',
        driver2: 'incident-driver-2',
        feedback: 'incident-feedback',
        editSelector: '.edit-incident-btn'
      };
    }
    if (page === 'stewards') {
      return {
        page,
        button: document.getElementById('save-steward-edit-btn') || document.getElementById('save-steward-consequence-edit-btn'),
        caseId: 'steward-edit-id',
        raceText: 'steward-edit-race',
        title: 'steward-edit-title',
        description: 'steward-edit-description',
        decision: 'steward-edit-decision',
        consequence: 'steward-edit-consequence',
        driver1: 'steward-edit-driver-1',
        driver2: 'steward-edit-driver-2',
        feedback: 'steward-edit-feedback',
        editSelector: '.edit-steward-btn'
      };
    }
    return null;
  }

  function value(id) {
    return String(document.getElementById(id)?.value || '').trim();
  }

  function feedback(config, message = '', isError = false) {
    const node = document.getElementById(config.feedback);
    if (!node) return;
    node.hidden = !message;
    node.textContent = message;
    node.classList.toggle('notice-error', Boolean(isError));
    node.dataset.level = isError ? 'error' : 'success';
  }

  function setBusy(config, active) {
    busy = active;
    if (!config.button) return;
    config.button.disabled = active;
    config.button.textContent = active ? 'Speichert …' : (config.page === 'admin' ? 'Steward-Eintrag speichern' : 'Änderungen speichern');
  }

  function detailIds(config) {
    const prefix = config.page === 'admin' ? 'incident' : 'steward-edit';
    return {
      host: `${prefix}-consequence-details`,
      type: `${prefix}-consequence-type`,
      amount: `${prefix}-consequence-amount`,
      amountField: `${prefix}-consequence-amount-field`,
      amountLabel: `${prefix}-consequence-amount-label`,
      target: `${prefix}-consequence-target`
    };
  }

  function configureConsequenceSelect(config) {
    const select = document.getElementById(config.consequence);
    if (!select || select.dataset.structuredConsequence === 'true') return;
    select.dataset.structuredConsequence = 'true';
    select.innerHTML = `
      <option value="Keine" selected>Keine</option>
      <option value="Ja">Ja</option>
      <option value="Nein">Nein</option>`;

    const field = select.closest('.field') || select.parentElement;
    const ids = detailIds(config);
    const details = document.createElement('div');
    details.id = ids.host;
    details.className = 'rcc-steward-consequence-details field full';
    details.hidden = true;
    details.innerHTML = `
      <div class="rcc-steward-consequence-grid">
        <label><span>Art der Konsequenz</span>
          <select id="${ids.type}">
            <option value="time_penalty">Zeitstrafe</option>
            <option value="time_credit">Gutschrift</option>
            <option value="grid_penalty">Grid-Strafe</option>
            <option value="dsq">DSQ</option>
          </select>
        </label>
        <label id="${ids.amountField}"><span id="${ids.amountLabel}">Sekunden</span><input id="${ids.amount}" type="number" min="1" max="120" step="1" value="5" inputmode="numeric"></label>
      </div>
      <div id="${ids.target}" class="notice rcc-steward-consequence-target">Zeitstrafe/Gutschrift/DSQ wirken auf das ausgewählte Rennen. Eine Grid-Strafe wird automatisch dem nächsten noch offenen Rennen zugeordnet.</div>`;
    field?.insertAdjacentElement('afterend', details);

    select.addEventListener('change', () => renderDetailState(config));
    document.getElementById(ids.type)?.addEventListener('change', () => renderDetailState(config));
    renderDetailState(config);
  }

  function renderDetailState(config) {
    const ids = detailIds(config);
    const choice = value(config.consequence);
    const type = value(ids.type) || 'time_penalty';
    const host = document.getElementById(ids.host);
    const amountField = document.getElementById(ids.amountField);
    const amountLabel = document.getElementById(ids.amountLabel);
    const amount = document.getElementById(ids.amount);
    const target = document.getElementById(ids.target);
    if (!host) return;

    host.hidden = choice !== 'Ja';
    if (choice !== 'Ja') return;
    if (amountField) amountField.hidden = type === 'dsq';
    if (amountLabel) amountLabel.textContent = type === 'grid_penalty' ? 'Startplätze' : 'Sekunden';
    if (amount) {
      amount.max = type === 'grid_penalty' ? '20' : '120';
      amount.value = String(Math.max(1, Number(amount.value || (type === 'grid_penalty' ? 3 : 5))));
    }
    if (target) {
      target.textContent = type === 'grid_penalty'
        ? 'Diese Grid-Strafe wird dem nächsten noch nicht abgeschlossenen Rennen dieser Saison zugeordnet und dort als Hinweis angezeigt.'
        : type === 'dsq'
          ? 'DSQ wird auf das ausgewählte Rennen angewandt. Der Fahrer wird ans Ende gesetzt und erhält 0 Punkte.'
          : `${type === 'time_credit' ? 'Die Gutschrift' : 'Die Zeitstrafe'} wird auf das ausgewählte Rennen angewandt.`;
    }
  }

  function consequenceSummary(config) {
    const choice = value(config.consequence) || 'Keine';
    if (choice !== 'Ja') return choice;
    const ids = detailIds(config);
    const type = value(ids.type);
    const amount = Math.max(1, Number(value(ids.amount) || 0));
    if (type === 'time_penalty') return `Zeitstrafe +${amount} Sekunden`;
    if (type === 'time_credit') return `Gutschrift -${amount} Sekunden`;
    if (type === 'grid_penalty') return `Grid-Strafe ${amount} ${amount === 1 ? 'Platz' : 'Plätze'}`;
    if (type === 'dsq') return 'DSQ';
    return 'Keine';
  }

  async function resolveSourceRace(config, existingCaseId = '') {
    if (config.raceId) {
      const raceId = value(config.raceId);
      if (raceId) return raceId;
    }
    if (!existingCaseId) return '';
    const { data, error } = await window.supabaseClient
      .from('steward_cases')
      .select('race_id')
      .eq('id', existingCaseId)
      .maybeSingle();
    if (error) throw error;
    return String(data?.race_id || '');
  }

  async function nextOpenRace(sourceRaceId) {
    const { data: source, error: sourceError } = await window.supabaseClient
      .from('races')
      .select('id, season_id, round_number, grand_prix_name')
      .eq('id', sourceRaceId)
      .single();
    if (sourceError) throw sourceError;

    const { data, error } = await window.supabaseClient
      .from('races')
      .select('id, round_number, grand_prix_name, status, race_date')
      .eq('season_id', source.season_id)
      .gt('round_number', source.round_number)
      .neq('status', 'completed')
      .order('round_number', { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function buildPenalty(config, caseId, sourceRaceId, driverId, summary, title, decision) {
    const choice = value(config.consequence) || 'Keine';
    if (choice !== 'Ja' || !driverId) return null;
    const ids = detailIds(config);
    const type = value(ids.type);
    const amount = Math.max(1, Number(value(ids.amount) || 0));
    let effectiveRaceId = sourceRaceId;
    let gridPositions = 0;
    let timeDelta = 0;
    let targetLabel = '';

    if (type === 'time_penalty') timeDelta = Math.round(amount * 1000);
    else if (type === 'time_credit') timeDelta = -Math.round(amount * 1000);
    else if (type === 'dsq') timeDelta = DSQ_SORT_DELTA_MS;
    else if (type === 'grid_penalty') {
      const target = await nextOpenRace(sourceRaceId);
      if (!target?.id) throw new Error('Für diese Grid-Strafe wurde kein kommendes Rennen gefunden.');
      effectiveRaceId = target.id;
      gridPositions = Math.round(amount);
      targetLabel = target.grand_prix_name || `Runde ${target.round_number}`;
    }

    return {
      row: {
        race_id: effectiveRaceId,
        driver_id: driverId,
        steward_case_id: caseId,
        penalty_type: type,
        time_delta_ms: timeDelta,
        points_delta: 0,
        grid_positions: gridPositions,
        reason: [summary, targetLabel && `Zielrennen: ${targetLabel}`, title, decision].filter(Boolean).join(' · ')
      },
      targetLabel
    };
  }

  async function ensureResultRelease() {
    if (window.RCCResultRelease?.rebuildPublishedRace) return window.RCCResultRelease;
    if (resultReleasePromise) return resultReleasePromise;
    const load = (globalName, src) => new Promise((resolve, reject) => {
      if (window[globalName]) return resolve(window[globalName]);
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(window[globalName]);
      script.onerror = () => reject(new Error(`${src} konnte nicht geladen werden.`));
      document.head.appendChild(script);
    });
    resultReleasePromise = (async () => {
      await load('RCCResultTimeFormat', 'assets/js/components/rcc-result-time-format.js');
      const release = await load('RCCResultRelease', 'assets/js/components/rcc-result-release.js');
      release?.init?.();
      return release;
    })().finally(() => { resultReleasePromise = null; });
    return resultReleasePromise;
  }

  async function rebuildPublishedIfSafe(raceId) {
    if (!raceId) return false;

    const [{ data: canManage, error: roleError }, { data: open, error: openError }] = await Promise.all([
      window.supabaseClient.rpc('can_manage_race_workflow', { p_race_id: raceId }),
      window.supabaseClient
        .from('race_result_imports')
        .select('id')
        .eq('race_id', raceId)
        .in('status', ['draft', 'under_review'])
        .limit(1)
    ]);
    if (roleError) throw roleError;
    if (openError) throw openError;
    if (canManage !== true || open?.length) return false;

    const release = await ensureResultRelease();
    const rebuilt = await release?.rebuildPublishedRace?.(raceId);
    return rebuilt === true;
  }

  async function save(config) {
    if (busy) return;
    setBusy(config, true);
    feedback(config, '');
    try {
      const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session?.user) throw new Error('Bitte zuerst einloggen.');

      const existingId = value(config.caseId);
      const sourceRaceId = await resolveSourceRace(config, existingId);
      const title = value(config.title);
      const description = value(config.description);
      const decision = value(config.decision);
      const driver1 = value(config.driver1) || null;
      const driver2 = value(config.driver2) || null;
      const choice = value(config.consequence) || 'Keine';
      const summary = consequenceSummary(config);
      if (!sourceRaceId || !title) throw new Error('Bitte Rennen und Vorfall ausfüllen.');
      if (choice === 'Ja' && !driver2) throw new Error('Für eine Konsequenz bitte den betroffenen Fahrer auswählen.');

      const payload = {
        race_id: sourceRaceId,
        title,
        description,
        driver_1_id: driver1,
        driver_2_id: driver2,
        decision_text: decision,
        consequence: summary,
        status: 'closed'
      };

      let caseId = existingId;
      if (caseId) {
        const { error } = await window.supabaseClient.from('steward_cases').update(payload).eq('id', caseId);
        if (error) throw error;
      } else {
        const { data, error } = await window.supabaseClient.from('steward_cases').insert([payload]).select('id').single();
        if (error) throw error;
        caseId = String(data.id);
      }

      const penalty = await buildPenalty(config, caseId, sourceRaceId, driver2, summary, title, decision);
      const { error: deletePenaltyError } = await window.supabaseClient.from('race_penalties').delete().eq('steward_case_id', caseId);
      if (deletePenaltyError) throw deletePenaltyError;
      if (penalty?.row) {
        const { error: insertPenaltyError } = await window.supabaseClient.from('race_penalties').insert([penalty.row]);
        if (insertPenaltyError) throw insertPenaltyError;
      }

      const rebuilt = await rebuildPublishedIfSafe(sourceRaceId);
      window.resetStewardIncidentForm?.();
      if (config.page === 'stewards') {
        const caseIdInput = document.getElementById(config.caseId);
        if (caseIdInput) caseIdInput.value = '';
        window.loadStewardCases?.();
      } else {
        await Promise.allSettled([
          Promise.resolve(window.loadStewardCasesForAdmin?.()),
          Promise.resolve(window.renderPublishWorkflow?.()),
          Promise.resolve(window.loadSeasonSummary?.())
        ]);
      }

      if (config.page === 'admin') configureConsequenceSelect(config);
      const consequenceSelect = document.getElementById(config.consequence);
      if (consequenceSelect) consequenceSelect.value = 'Keine';
      renderDetailState(config);
      const targetSuffix = penalty?.targetLabel ? ` Zielrennen: ${penalty.targetLabel}.` : '';
      feedback(config, rebuilt
        ? `Steward-Fall gespeichert und veröffentlichtes Ergebnis neu berechnet.${targetSuffix}`
        : `Steward-Fall gespeichert. Die Konsequenz ist hinterlegt und wird bei einem offenen Entwurf bzw. durch die Ligaleitung mit der nächsten sicheren Ergebnisfreigabe übernommen.${targetSuffix}`);
    } catch (error) {
      console.error('RaceVora Steward consequence save:', error);
      feedback(config, `Speichern fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`, true);
    } finally {
      setBusy(config, false);
    }
  }

  async function loadCaseIntoEditor(config, caseId) {
    if (!caseId) return;
    try {
      const [{ data: entry, error: entryError }, { data: penalties, error: penaltyError }] = await Promise.all([
        window.supabaseClient.from('steward_cases').select('id, consequence').eq('id', caseId).maybeSingle(),
        window.supabaseClient.from('race_penalties').select('penalty_type, time_delta_ms, grid_positions, race_id').eq('steward_case_id', caseId).limit(1)
      ]);
      if (entryError) throw entryError;
      if (penaltyError) throw penaltyError;
      const penalty = penalties?.[0] || null;
      const select = document.getElementById(config.consequence);
      const ids = detailIds(config);
      if (!select) return;

      if (!penalty) {
        select.value = /^nein$/i.test(String(entry?.consequence || '')) ? 'Nein' : 'Keine';
        renderDetailState(config);
        return;
      }

      select.value = 'Ja';
      const typeSelect = document.getElementById(ids.type);
      const amountInput = document.getElementById(ids.amount);
      if (typeSelect) typeSelect.value = penalty.penalty_type || 'time_penalty';
      const amount = penalty.penalty_type === 'grid_penalty'
        ? Number(penalty.grid_positions || 1)
        : Math.max(1, Math.round(Math.abs(Number(penalty.time_delta_ms || 0)) / 1000));
      if (amountInput) amountInput.value = String(amount);
      renderDetailState(config);
    } catch (error) {
      console.warn('Steward-Konsequenz konnte nicht geladen werden.', error);
    }
  }

  function bind(config) {
    configureConsequenceSelect(config);
    if (!config.button || config.button.dataset.structuredStewardBound === 'true') return;
    config.button.dataset.structuredStewardBound = 'true';
    config.button.id = config.page === 'admin' ? 'save-steward-consequence-btn' : 'save-steward-consequence-edit-btn';
    config.button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      save(config);
    }, true);

    document.addEventListener('click', (event) => {
      const edit = event.target.closest(config.editSelector);
      if (!edit) return;
      window.setTimeout(() => loadCaseIntoEditor(config, edit.dataset.id || ''), 0);
    });
  }

  function init() {
    const config = pageConfig();
    if (!config || !window.supabaseClient) return false;
    bind(config);
    return true;
  }

  window.RCCStewardConsequences = { init, save };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();