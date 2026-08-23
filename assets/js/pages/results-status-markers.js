(() => {
  if (window.__raceVoraResultMarkersApplied) return;

  function addMarker(valueEl, kind, text, label, title) {
      const stack = valueEl.closest('.results-cell-stack');
      if (!stack || stack.querySelector(`[data-result-marker="${kind}"]`)) return;

      const marker = document.createElement('span');
      marker.className = `results-status-marker results-status-marker--${kind}`;
      marker.dataset.resultMarker = kind;
      marker.textContent = text;
      marker.setAttribute('aria-label', label);
      marker.title = title;
      stack.appendChild(marker);
      stack.classList.add('results-cell-stack--has-markers');
  }

  function decorateResultCells(root = document) {
    root.querySelectorAll?.('.results-points-value--fl-chip').forEach((valueEl) => {
      addMarker(valueEl, 'fl', 'FL', 'Schnellste Runde in diesem Rennen', 'Fastest Lap');
    });
    root.querySelectorAll?.('.results-points-value--bot').forEach((valueEl) => {
      addMarker(valueEl, 'bot', 'BOT', 'Dieses Ergebnis wurde von einem Bot gefahren', 'BOT gefahren');
    });
  }

  function start() {
    const wrap = document.getElementById('results-matrix-wrap');
    if (!wrap) return;

    decorateResultCells(wrap);

    const observer = new MutationObserver(() => decorateResultCells(wrap));
    observer.observe(wrap, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.__raceVoraResultMarkersApplied = true;
})();
