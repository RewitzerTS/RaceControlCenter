(() => {
  if (window.RCCResultPublishReceipt) return;

  const state = {
    initialized: false,
    pending: null,
    observer: null
  };

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(String(value ?? '')) : String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStylesheet() {
    if (document.querySelector('link[data-rcc-result-publish-receipt="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/css/components/rcc-result-publish-receipt.css';
    link.dataset.rccResultPublishReceipt = 'true';
    document.head.appendChild(link);
  }

  function contextualHref(href) {
    return window.withLeagueContextHref ? window.withLeagueContextHref(href) : href;
  }

  function sourceMeta(item) {
    return window.RCCResultReviewHardening?.explicitSource?.(item)
      || { key: 'import', label: 'Import', icon: '⇧', display: item?.source_filename || 'Import' };
  }

  async function capture(importId, raceId) {
    if (!window.supabaseClient || !importId) return null;
    const { data: item, error } = await window.supabaseClient
      .from('race_result_imports')
      .select(`
        id,
        race_id,
        source_filename,
        races:race_id ( grand_prix_name, round_number, season_id ),
        race_result_import_rows (
          id,
          participation_status,
          raw_payload
        )
      `)
      .eq('id', importId)
      .eq('race_id', raceId)
      .maybeSingle();
    if (error || !item) return null;

    const { data: penalties } = await window.supabaseClient
      .from('race_penalties')
      .select('id, time_delta_ms, points_delta')
      .eq('race_id', raceId);

    const rows = item.race_result_import_rows || [];
    return {
      importId: String(item.id || importId),
      raceId: String(item.race_id || raceId),
      raceLabel: String(item.races?.grand_prix_name || 'Rennen'),
      round: Number(item.races?.round_number || 0),
      seasonId: String(item.races?.season_id || ''),
      source: sourceMeta(item),
      rowCount: rows.length,
      botCount: rows.filter((row) => String(row.participation_status || '').toUpperCase() === 'BOT').length,
      penaltyCount: (penalties || []).length
    };
  }

  function raceHref(context) {
    if (!context?.round) return contextualHref('ergebnisse.html');
    const params = new URLSearchParams();
    params.set('round', String(context.round));
    if (context.seasonId) params.set('season', context.seasonId);
    return contextualHref(`rennen-detail.html?${params.toString()}`);
  }

  function receiptRoot() {
    const feedback = document.getElementById('publish-feedback');
    if (!feedback?.parentNode) return null;
    let root = document.getElementById('rcc-result-publish-receipt');
    if (!root) {
      root = document.createElement('section');
      root.id = 'rcc-result-publish-receipt';
      root.className = 'rcc-result-publish-receipt';
      root.hidden = true;
      feedback.insertAdjacentElement('afterend', root);
    }
    return root;
  }

  function renderPublishReceipt(context) {
    if (!context) return false;
    const root = receiptRoot();
    if (!root) return false;
    root.hidden = false;
    root.innerHTML = `
      <div class="rcc-result-publish-receipt__head">
        <div class="rcc-result-publish-receipt__check" aria-hidden="true">✓</div>
        <div>
          <span class="eyebrow">Veröffentlichung abgeschlossen</span>
          <h4>${escape(context.raceLabel)} ist öffentlich</h4>
          <p>Das Rennergebnis und die darauf basierenden Wertungen wurden aktualisiert.</p>
        </div>
      </div>
      <div class="rcc-result-publish-receipt__metrics">
        <div><span>Quelle</span><strong>${escape(context.source.label)}</strong></div>
        <div><span>Fahrer</span><strong>${context.rowCount}</strong></div>
        <div><span>KI/BOT</span><strong>${context.botCount}</strong></div>
        <div><span>Steward-Korrekturen</span><strong>${context.penaltyCount}</strong></div>
      </div>
      <div class="rcc-result-publish-receipt__actions">
        <a class="button-primary" href="${escape(raceHref(context))}">Öffentliches Rennen öffnen</a>
        <a class="button-secondary" href="${escape(contextualHref('fahrer-wm.html'))}">Fahrer-WM öffnen</a>
        <a class="button-secondary" href="${escape(contextualHref('team-wm.html'))}">Team-WM öffnen</a>
      </div>`;
    root.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    return true;
  }

  function feedbackShowsSuccess() {
    const feedback = document.getElementById('publish-feedback');
    const text = String(feedback?.textContent || '');
    return /wurde final veröffentlicht/i.test(text) || /final veröffentlicht/i.test(text);
  }

  async function renderPendingOnSuccess() {
    if (!feedbackShowsSuccess() || !state.pending) return;
    const pending = state.pending;
    state.pending = null;
    const context = await pending.catch(() => null);
    if (context) renderPublishReceipt(context);
  }

  function installCapture() {
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.publish-results-btn');
      if (!button || button.disabled) return;
      const importId = String(button.dataset.importId || '').trim();
      const raceId = String(button.dataset.raceId || '').trim();
      if (!importId || !raceId) return;
      state.pending = capture(importId, raceId);
      const root = document.getElementById('rcc-result-publish-receipt');
      if (root) root.hidden = true;
    }, true);
  }

  function observeFeedback() {
    if (state.observer) return;
    const feedback = document.getElementById('publish-feedback');
    if (!feedback || typeof MutationObserver !== 'function') return;
    state.observer = new MutationObserver(() => renderPendingOnSuccess());
    state.observer.observe(feedback, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  function init() {
    if (state.initialized) return true;
    ensureStylesheet();
    receiptRoot();
    installCapture();
    observeFeedback();
    state.initialized = true;
    return true;
  }

  window.RCCResultPublishReceipt = { init, capture, renderPublishReceipt, raceHref };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
