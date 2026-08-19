(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'landing3') return;

  const root = document.documentElement;
  const header = document.querySelector('.l3-header');
  const strip = document.querySelector('.l3-strip');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopStory = window.matchMedia('(min-width: 1081px)');
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const scenes = [
    {
      label: '01 · Kontrollzentrum',
      title: 'Eine Liga.<br><em>Ein Kontrollzentrum.</em>',
      text: 'Kalender, Fahrer, Teams, Ergebnisse und Meisterschaften greifen in einer Oberfläche ineinander. Keine Tool-Sprünge, keine doppelten Datenstände.',
      metrics: [['Übersicht', 'Zentral'], ['Rollen', 'Getrennt'], ['Daten', 'Synchron']],
      preview: 'assets/previews/landing-admin.html',
      previewTitle: 'RaceVora Admin Center'
    },
    {
      label: '02 · KI-Ergebnis',
      title: 'Screenshot rein.<br><em>Entwurf bereit.</em>',
      text: 'RaceVora übernimmt die Fleißarbeit. Ergebnisbild hochladen, Fahrer zuordnen, Daten prüfen und den fertigen Draft direkt weiterbearbeiten.',
      metrics: [['Input', 'Screenshot'], ['Mapping', 'Automatisch'], ['Draft', 'Editierbar']],
      preview: 'assets/previews/landing-ai-results.html',
      previewTitle: 'RaceVora KI-Ergebnisimport'
    },
    {
      label: '03 · Stewarding',
      title: 'Prüfen.<br><em>Bevor es zählt.</em>',
      text: 'Entscheidungen hängen direkt am Rennen. Strafen, Begründungen und Status bleiben nachvollziehbar, bevor das Ergebnis offiziell wird.',
      metrics: [['Review', 'Stewards'], ['Strafen', 'Im Draft'], ['Historie', 'Nachvollziehbar']],
      preview: 'assets/previews/landing-stewarding.html',
      previewTitle: 'RaceVora Stewarding'
    },
    {
      label: '04 · Veröffentlichung',
      title: 'Ein Klick.<br><em>Alles aktuell.</em>',
      text: 'Mit der Freigabe aktualisieren sich Ergebnis, Fahrer-WM, Team-WM und Race Hub gemeinsam. Erst hier wird aus dem Draft die offizielle Wahrheit der Liga.',
      metrics: [['Race Hub', 'Aktuell'], ['WM', 'Neu berechnet'], ['Geräte', 'Synchron']],
      preview: 'assets/previews/landing-race-hub.html',
      previewTitle: 'RaceVora Race Hub nach Veröffentlichung'
    }
  ];

  function previewFrame(scene, extraClass = '') {
    return `<iframe class="l3-product-preview-frame ${extraClass}" src="${scene.preview}" title="${scene.previewTitle}" loading="eager" tabindex="-1" aria-hidden="true"></iframe>`;
  }

  function mobileVisual(scene) {
    return `<div class="l3-story-mobile-visual l3-story-preview"><div class="l3-story-mobile-shell">${previewFrame(scene, 'l3-product-preview-frame--mobile')}</div></div>`;
  }

  function storyMarkup() {
    return `<section class="l3-scroll-story" id="experience" aria-label="RaceVora Workflow">
      <div class="l3-scroll-story__sticky">
        <div class="l3-shell l3-scroll-story__grid">
          <div class="l3-scroll-story__copy">
            ${scenes.map((scene, index) => `<article class="l3-scroll-story__step${index === 0 ? ' is-active' : ''}" data-story-step="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}"><div class="l3-scroll-story__index">${scene.label}</div><h2>${scene.title}</h2><p>${scene.text}</p><div class="l3-scroll-story__metrics">${scene.metrics.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join('')}</div>${mobileVisual(scene)}</article>`).join('')}
            <div class="l3-scroll-story__rail" aria-hidden="true">${scenes.map((_, index) => `<i data-story-dot="${index}" class="${index === 0 ? 'is-active' : ''}"></i>`).join('')}</div>
          </div>
          <div class="l3-scroll-story__stage" data-story-stage="0" aria-hidden="true">
            <div class="l3-story-halo"></div>
            <div class="l3-story-product"><div class="l3-story-browser"><i></i><i></i><i></i><span>racevora.com</span><b>Race Management Platform</b></div><div class="l3-story-product__screen">${scenes.map((scene, index) => `<div class="l3-product-scene l3-story-preview${index === 0 ? ' is-active' : ''}" data-product-scene="${index}">${previewFrame(scene)}</div>`).join('')}</div></div>
            <div class="l3-story-satellite l3-story-satellite--tablet l3-story-preview">${previewFrame(scenes[3], 'l3-product-preview-frame--tablet')}</div>
            <div class="l3-story-satellite l3-story-satellite--phone l3-story-preview">${previewFrame(scenes[3], 'l3-product-preview-frame--phone')}</div>
            <div class="l3-story-sync"><i></i><span>Eine Veröffentlichung · überall aktuell</span></div>
          </div>
        </div>
      </div>
    </section>`;
  }

  function installHeroPreview() {
    const desktopFrame = document.querySelector('.l3-desktop iframe');
    if (!desktopFrame) return;
    desktopFrame.removeAttribute('srcdoc');
    desktopFrame.src = 'assets/previews/landing-race-hub.html';
    desktopFrame.title = 'RaceVora Produktansicht · Race Hub';
    desktopFrame.loading = 'eager';
    document.querySelectorAll('.l3-tablet iframe,.l3-phone iframe').forEach((frame) => {
      frame.removeAttribute('src');
      frame.removeAttribute('srcdoc');
    });
  }

  function installStory() {
    if (!strip || document.querySelector('.l3-scroll-story')) return;
    strip.insertAdjacentHTML('afterend', storyMarkup());
  }

  installHeroPreview();
  installStory();

  const story = document.querySelector('.l3-scroll-story');
  const steps = [...document.querySelectorAll('[data-story-step]')];
  const productScenes = [...document.querySelectorAll('[data-product-scene]')];
  const dots = [...document.querySelectorAll('[data-story-dot]')];
  const stage = document.querySelector('[data-story-stage]');
  let geometry = { top: 0, travel: 1 };
  let activeScene = -1;
  let rafId = 0;

  function setScene(index) {
    const next = Math.max(0, Math.min(scenes.length - 1, index));
    if (activeScene === next && desktopStory.matches) return;
    activeScene = next;
    stage?.setAttribute('data-story-stage', String(next));

    steps.forEach((step, stepIndex) => {
      const active = stepIndex === next;
      step.classList.toggle('is-active', active || !desktopStory.matches);
      step.classList.toggle('is-before', desktopStory.matches && stepIndex < next);
      step.classList.toggle('is-after', desktopStory.matches && stepIndex > next);
      step.setAttribute('aria-hidden', desktopStory.matches ? String(!active) : 'false');
    });
    productScenes.forEach((scene, sceneIndex) => scene.classList.toggle('is-active', sceneIndex === next));
    dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === next));
  }

  function measure() {
    if (!story) return;
    const rect = story.getBoundingClientRect();
    const viewport = window.visualViewport?.height || window.innerHeight;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    geometry.top = window.scrollY + rect.top;
    geometry.travel = Math.max(1, story.offsetHeight - Math.max(540, viewport - Math.min(headerHeight, 92)));
    story.style.setProperty('--story-header-offset', `${Math.round(headerHeight)}px`);
  }

  function render() {
    rafId = 0;
    const viewport = window.visualViewport?.height || window.innerHeight;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
    root.style.setProperty('--l3-scroll-progress', clamp(window.scrollY / maxScroll).toFixed(5));
    header?.classList.toggle('is-scrolled', window.scrollY > 36);

    if (!story) return;
    if (!desktopStory.matches || reduceMotion.matches) {
      setScene(0);
      return;
    }
    const progress = clamp((window.scrollY - geometry.top) / geometry.travel);
    const thresholds = [0, 0.25, 0.5, 0.75];
    let next = 0;
    thresholds.forEach((threshold, index) => { if (progress >= threshold) next = index; });
    setScene(next);
  }

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(render);
  }

  function remeasure() {
    measure();
    activeScene = -1;
    requestRender();
  }

  function revealSetup() {
    const targets = [
      ...document.querySelectorAll('.l3-section-heading'),
      ...document.querySelectorAll('.l3-platform-card'),
      ...document.querySelectorAll('.l3-feature-row article'),
      ...document.querySelectorAll('.l3-flow-list li'),
      document.querySelector('.l3-cta-inner')
    ].filter(Boolean);

    targets.forEach((node, index) => {
      node.dataset.motionReveal = 'true';
      node.style.setProperty('--motion-delay', `${Math.min(index % 4, 3) * 55}ms`);
    });

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      targets.forEach((node) => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    targets.forEach((node) => observer.observe(node));
  }

  setScene(0);
  revealSetup();
  requestAnimationFrame(() => requestAnimationFrame(remeasure));

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  window.visualViewport?.addEventListener('resize', remeasure, { passive: true });
  desktopStory.addEventListener?.('change', remeasure);
  reduceMotion.addEventListener?.('change', remeasure);
})();
