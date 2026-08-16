(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'landing3') return;

  const applyStoryPhonePreview = () => {
    const iframe = document.querySelector('.l3-story-preview--phone iframe');
    if (!iframe) return false;
    iframe.src = 'ergebnisse.html?league=rcc#wm-dynamics';
    iframe.title = 'Race Control Center WM-Dynamik';
    return true;
  };

  if (applyStoryPhonePreview()) return;

  const observer = new MutationObserver(() => {
    if (!applyStoryPhonePreview()) return;
    observer.disconnect();
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
