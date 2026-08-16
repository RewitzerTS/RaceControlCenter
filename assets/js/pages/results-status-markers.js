(() => {
  if (window.__raceVoraResultMarkersApplied) return;

  function decorateBotCells(root = document) {
    root.querySelectorAll?.('.results-points-value--bot').forEach((valueEl) => {
      const stack = valueEl.closest('.results-cell-stack');
      if (!stack || stack.querySelector('[data-result-marker="bot"]')) return;

      const marker = document.createElement('span');
      marker.className = 'results-status-marker results-status-marker--bot';
      marker.dataset.resultMarker = 'bot';
      marker.textContent = 'BOT';
      marker.setAttribute('aria-label', 'Dieses Ergebnis wurde von einem Bot gefahren');
      marker.title = 'BOT gefahren';
      stack.appendChild(marker);
      stack.classList.add('results-cell-stack--has-bot');
    });
  }

  function start() {
    const wrap = document.getElementById('results-matrix-wrap');
    if (!wrap) return;

    decorateBotCells(wrap);

    const observer = new MutationObserver(() => decorateBotCells(wrap));
    observer.observe(wrap, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.__raceVoraResultMarkersApplied = true;
})();
