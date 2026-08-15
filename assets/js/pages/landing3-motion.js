(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'landing3') return;

  const root = document.documentElement;
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopStoryQuery = window.matchMedia('(min-width: 1081px)');
  const finePointerQuery = window.matchMedia('(pointer: fine)');

  const header = document.querySelector('.l3-header');
  const hero = document.querySelector('.l3-hero');
  const heroStage = document.querySelector('.l3-device-stage');
  const strip = document.querySelector('.l3-strip');

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => {
    const p = clamp(t);
    return p * p * (3 - 2 * p);
  };

  const scenes = [
    {
      label: '01 · Kontrollzentrum',
      title: 'Deine Liga.<br><em>Ein Kontrollzentrum.</em>',
      text: 'Kalender, Fahrer, Teams, Ergebnisse und Meisterschaften leben nicht in fünf Werkzeugen. RCC bringt den kompletten Rennbetrieb in eine gemeinsame Oberfläche – auf jedem Gerät.',
      metrics: [['Datenbasis', '1 Liga'], ['Geräte', 'Alle'], ['Status', 'Live synchron']]
    },
    {
      label: '02 · KI-Ergebnis',
      title: 'Screenshot rein.<br><em>Draft entsteht.</em>',
      text: 'Nach dem Rennen übernimmt die KI die Fleißarbeit: Screenshot einlesen, Fahrer erkennen, Positionen, Zeiten und Stopps zuordnen. Die Ligaleitung kontrolliert nur noch den fertigen Entwurf.',
      metrics: [['Input', 'Screenshot'], ['Mapping', 'Automatisch'], ['Output', 'Editierbarer Draft']]
    },
    {
      label: '03 · Stewarding',
      title: 'Prüfen.<br><em>Bevor es zählt.</em>',
      text: 'Steward-Fälle hängen direkt am Ergebnisentwurf. Entscheidungen und Strafen verändern zuerst nur die Vorschau – transparent, nachvollziehbar und noch ohne Einfluss auf die offizielle WM.',
      metrics: [['Review', 'Stewards'], ['Strafen', 'Preview'], ['Status', 'Noch nicht live']]
    },
    {
      label: '04 · Veröffentlichung',
      title: 'Ein Klick.<br><em>Alles aktuell.</em>',
      text: 'Mit der Freigabe werden Ergebnis, Fahrer-WM, Team-WM und Race Hub gemeinsam aktualisiert. Eine Aktion – und dieselbe Wahrheit ist auf Desktop, Tablet und Smartphone sichtbar.',
      metrics: [['Race Hub', 'Aktualisiert'], ['Meisterschaft', 'Neu berechnet'], ['Community', 'Sofort live']]
    }
  ];

  const storyMarkup = () => `
    <section class="l3-scroll-story" id="experience" aria-label="Race Control Center Workflow">
      <div class="l3-scroll-story__progress" aria-hidden="true"><i></i></div>
      <div class="l3-scroll-story__sticky">
        <div class="l3-shell l3-scroll-story__grid">
          <div class="l3-scroll-story__copy">
            ${scenes.map((scene, index) => `
              <article class="l3-scroll-story__step${index === 0 ? ' is-active' : ''}" data-story-step="${index}">
                <div class="l3-scroll-story__index">${scene.label}</div>
                <h2>${scene.title}</h2>
                <p>${scene.text}</p>
                <div class="l3-scroll-story__metrics">
                  ${scene.metrics.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join('')}
                </div>
              </article>`).join('')}
          </div>

          <div class="l3-scroll-story__stage" aria-hidden="true">
            <div class="l3-scroll-orbit"><i></i><i></i><i></i></div>

            <div class="l3-story-device l3-story-device--desktop" data-story-device="desktop">
              <div class="l3-story-shell">
                <div class="l3-story-browser"><i></i><i></i><i></i><span>racecontrol.center/admin</span></div>
                <div class="l3-story-screen">
                  <div class="l3-story-screen__top">
                    <span class="l3-story-screen__eyebrow" data-story-eyebrow>ADMIN CENTER</span>
                    <span class="l3-story-live" data-story-live>Synchronisiert</span>
                  </div>

                  <div class="l3-story-ui-stack">
                    <section class="l3-story-ui is-visible" data-ui-scene="0">
                      <div class="l3-ui-heading"><div><small>LIGA · SEASON 14</small><h3>Race Weekend Control</h3></div><span class="l3-ui-chip">LIVE</span></div>
                      <div class="l3-control-grid">
                        <article><b>▣</b><span><small>ERGEBNIS</small><strong>Eintragen</strong></span></article>
                        <article><b>🏁</b><span><small>RENNEN</small><strong>Verwalten</strong></span></article>
                        <article><b>F</b><span><small>FAHRER</small><strong>Teams & Grid</strong></span></article>
                        <article><b>⚑</b><span><small>STEWARDING</small><strong>Fälle prüfen</strong></span></article>
                      </div>
                      <div class="l3-control-status"><span><small>SAISON</small><strong>14</strong></span><span><small>RENNEN</small><strong>11 / 24</strong></span><span><small>STATUS</small><strong>Aktiv</strong></span></div>
                    </section>

                    <section class="l3-story-ui" data-ui-scene="1">
                      <div class="l3-ui-heading"><div><small>KI-ERGEBNISIMPORT</small><h3>São Paulo GP</h3></div><span class="l3-ui-chip l3-ui-chip--ai">AI</span></div>
                      <div class="l3-upload-flow">
                        <div class="l3-upload-shot"><span class="l3-upload-icon">▣</span><strong>race-result.png</strong><small>Screenshot erkannt · 1920 × 1080</small><div class="l3-scan-line"></div></div>
                        <div class="l3-ai-arrow"><span>KI liest</span><b>→</b></div>
                        <div class="l3-ai-draft"><small>DRAFT · 20 FAHRER</small><div class="l3-draft-row"><b>1</b><strong>Nils</strong><span>46:14,072</span></div><div class="l3-draft-row"><b>2</b><strong>Mo</strong><span>+0,378</span></div><div class="l3-draft-row"><b>3</b><strong>Richard</strong><span>+3,847</span></div></div>
                      </div>
                      <div class="l3-ai-confidence"><span>Fahrer erkannt <b>20/20</b></span><span>Teams zugeordnet <b>100%</b></span><span>Entwurf <b>bereit</b></span></div>
                    </section>

                    <section class="l3-story-ui" data-ui-scene="2">
                      <div class="l3-ui-heading"><div><small>STEWARDING · RUNDE 10</small><h3>Vorfall prüfen</h3></div><span class="l3-ui-chip l3-ui-chip--review">REVIEW</span></div>
                      <div class="l3-steward-layout">
                        <div class="l3-steward-case"><span class="l3-steward-dot"></span><div><small>VORFALL</small><strong>Alessandro / Aaron · Kurve 15</strong><p>Schwierige Bedingungen, beschädigter Frontflügel und unterschiedliche Reifen.</p></div></div>
                        <div class="l3-steward-decision"><small>ENTSCHEIDUNG</small><strong>Keine Strafe</strong><span>Ergebnis bleibt unverändert</span></div>
                      </div>
                      <div class="l3-result-preview"><small>ERGEBNISVORSCHAU</small><span><b>1</b>Nils<em>25 P</em></span><span><b>2</b>Mo<em>18 P</em></span><span><b>3</b>Richard<em>15 P</em></span></div>
                    </section>

                    <section class="l3-story-ui" data-ui-scene="3">
                      <div class="l3-publish-success"><div class="l3-publish-check">✓</div><div><small>ERGEBNIS VERÖFFENTLICHT</small><h3>São Paulo ist live.</h3><p>Race Hub und Meisterschaften wurden gemeinsam aktualisiert.</p></div></div>
                      <div class="l3-publish-grid"><article><small>FAHRER-WM</small><strong>Mo · 189 P</strong><span>Nils verkürzt auf 26 Punkte</span></article><article><small>TEAM-WM</small><strong>Understeer · 316 P</strong><span>Vorsprung nur noch 17 Punkte</span></article><article><small>RACE HUB</small><strong>Aktualisiert</strong><span>Ergebnis + Insights live</span></article></div>
                      <div class="l3-sync-line"><i></i><span>Desktop</span><b>→</b><span>Tablet</span><b>→</b><span>Smartphone</span><i></i></div>
                    </section>
                  </div>
                </div>
              </div>
            </div>

            <div class="l3-story-device l3-story-device--tablet" data-story-device="tablet">
              <div class="l3-story-shell"><div class="l3-story-tablet-screen">
                <div class="l3-story-mini-logo"><img src="assets/images/logo.png" alt=""><span>RCC · RACE HUB</span></div>
                <div class="l3-tablet-state" data-tablet-scene="0"><small>NÄCHSTES RENNEN</small><strong>São Paulo GP</strong><span>Round 11 · Interlagos</span><div class="l3-tablet-countdown"><b>02</b><small>Tage</small><b>14</b><small>Std</small></div></div>
                <div class="l3-tablet-state" data-tablet-scene="1"><small>ERGEBNIS-DRAFT</small><strong>Noch nicht öffentlich</strong><span>Ligaleitung prüft den KI-Import.</span><div class="l3-tablet-lock">⌁ Draft geschützt</div></div>
                <div class="l3-tablet-state" data-tablet-scene="2"><small>STEWARDING</small><strong>Review läuft</strong><span>Offizielle Tabellen bleiben unverändert.</span><div class="l3-tablet-lock">⚑ 1 Fall in Prüfung</div></div>
                <div class="l3-tablet-state" data-tablet-scene="3"><small>FAHRER-WM · LIVE</small><div class="l3-story-podium"><span><b>1</b><strong>Mo</strong><small>189 P</small></span><span><b>2</b><strong>Nils</strong><small>163 P</small></span><span><b>3</b><strong>Richard</strong><small>136 P</small></span></div><div class="l3-story-progress"><small>SAISONFORTSCHRITT</small><div class="l3-story-progress-track"><i></i></div></div></div>
              </div></div>
            </div>

            <div class="l3-story-device l3-story-device--phone" data-story-device="phone">
              <div class="l3-story-shell"><div class="l3-story-phone-screen">
                <div class="l3-story-mini-logo"><img src="assets/images/logo.png" alt=""><span>RCC · MOBILE</span></div>
                <div class="l3-phone-state" data-phone-scene="0"><small>QUICK ACTIONS</small><strong>Admin unterwegs</strong><div class="l3-story-phone-actions"><span>＋ Ergebnis eintragen</span><span>⚑ Steward-Fall</span><span>🏁 Rennen verwalten</span></div></div>
                <div class="l3-phone-state" data-phone-scene="1"><small>KI-IMPORT</small><strong>20 Fahrer erkannt</strong><div class="l3-phone-meter"><i></i></div><span class="l3-phone-caption">Draft bereit zur Kontrolle</span></div>
                <div class="l3-phone-state" data-phone-scene="2"><small>STEWARD-FALL</small><strong>Runde 10</strong><div class="l3-phone-case"><span>Alessandro</span><b>↔</b><span>Aaron</span></div><button type="button">Entscheidung öffnen</button></div>
                <div class="l3-phone-state" data-phone-scene="3"><small>RACE HUB · LIVE</small><strong>São Paulo GP</strong><div class="l3-story-podium"><span><b>1</b><strong>Nils</strong><small>25 P</small></span><span><b>2</b><strong>Mo</strong><small>+0,378</small></span><span><b>3</b><strong>Richard</strong><small>P3</small></span></div><div class="l3-phone-live">● Live aktualisiert</div></div>
              </div></div>
            </div>
          </div>
        </div>
      </div>
    </section>`;

  function installStory() {
    if (!strip || document.querySelector('.l3-scroll-story')) return;
    strip.insertAdjacentHTML('afterend', storyMarkup());
  }

  installStory();

  const story = document.querySelector('.l3-scroll-story');
  const storySticky = story?.querySelector('.l3-scroll-story__sticky');
  const storyProgressBar = story?.querySelector('.l3-scroll-story__progress i');
  const storySteps = [...document.querySelectorAll('[data-story-step]')];
  const uiScenes = [...document.querySelectorAll('[data-ui-scene]')];
  const tabletScenes = [...document.querySelectorAll('[data-tablet-scene]')];
  const phoneScenes = [...document.querySelectorAll('[data-phone-scene]')];
  const storyDesktop = document.querySelector('[data-story-device="desktop"]');
  const storyTablet = document.querySelector('[data-story-device="tablet"]');
  const storyPhone = document.querySelector('[data-story-device="phone"]');
  const storyEyebrow = document.querySelector('[data-story-eyebrow]');
  const storyLive = document.querySelector('[data-story-live]');

  const deviceKeyframes = {
    desktop: [
      { x: 34, y: 4, scale: .94, rotate: -3.2, opacity: 1, blur: 0 },
      { x: -8, y: -14, scale: 1.025, rotate: -1.2, opacity: 1, blur: 0 },
      { x: -26, y: -2, scale: 1.02, rotate: 1.1, opacity: 1, blur: 0 },
      { x: 4, y: -8, scale: 1, rotate: 0, opacity: 1, blur: 0 }
    ],
    tablet: [
      { x: -28, y: 58, scale: .82, rotate: -8, opacity: .42, blur: 1.4 },
      { x: -34, y: 40, scale: .86, rotate: -7, opacity: .54, blur: .8 },
      { x: 22, y: -18, scale: .98, rotate: -3, opacity: .88, blur: 0 },
      { x: 42, y: 2, scale: 1.02, rotate: -2, opacity: 1, blur: 0 }
    ],
    phone: [
      { x: 34, y: 72, scale: .86, rotate: 8, opacity: .38, blur: 1.4 },
      { x: 46, y: 54, scale: .9, rotate: 7, opacity: .5, blur: .8 },
      { x: -12, y: -30, scale: 1.08, rotate: 2.5, opacity: 1, blur: 0 },
      { x: -34, y: 2, scale: 1.04, rotate: 1, opacity: 1, blur: 0 }
    ]
  };

  let geometry = { top: 0, travel: 1, viewport: window.innerHeight };
  let rafId = 0;
  let lastDominantScene = -1;

  function sceneWeights(progress) {
    const position = clamp(progress) * (scenes.length - 1);
    return scenes.map((_, index) => {
      const distance = Math.abs(position - index);
      return smooth(clamp(1 - distance));
    });
  }

  function interpolateKeyframes(frames, progress) {
    const scaled = clamp(progress) * (frames.length - 1);
    const fromIndex = Math.min(frames.length - 1, Math.floor(scaled));
    const toIndex = Math.min(frames.length - 1, fromIndex + 1);
    const local = smooth(scaled - fromIndex);
    const from = frames[fromIndex];
    const to = frames[toIndex];
    return Object.fromEntries(Object.keys(from).map(key => [key, lerp(from[key], to[key], local)]));
  }

  function applyDeviceTransform(node, frame, depth) {
    if (!node) return;
    node.style.transform = `translate3d(${frame.x.toFixed(2)}px,${frame.y.toFixed(2)}px,${depth}px) perspective(1400px) rotateY(${frame.rotate.toFixed(2)}deg) scale(${frame.scale.toFixed(4)})`;
    node.style.opacity = frame.opacity.toFixed(3);
    node.style.filter = frame.blur > .05 ? `blur(${frame.blur.toFixed(2)}px) saturate(.92)` : 'none';
  }

  function applySceneVisibility(nodes, weights, translate = 18) {
    nodes.forEach((node, index) => {
      const weight = weights[index] || 0;
      node.style.opacity = weight.toFixed(3);
      node.style.transform = `translate3d(0,${((1 - weight) * translate).toFixed(2)}px,0) scale(${(0.985 + weight * .015).toFixed(4)})`;
      node.style.pointerEvents = weight > .6 ? 'auto' : 'none';
      node.classList.toggle('is-visible', weight > .5);
    });
  }

  function setStoryCopy(weights) {
    const dominant = weights.indexOf(Math.max(...weights));
    storySteps.forEach((step, index) => {
      const weight = weights[index] || 0;
      const direction = index < dominant ? -1 : 1;
      step.style.opacity = weight.toFixed(3);
      step.style.transform = `translate3d(0,calc(-50% + ${((1 - weight) * direction * 28).toFixed(2)}px),0)`;
      step.style.pointerEvents = weight > .66 ? 'auto' : 'none';
      step.classList.toggle('is-active', weight > .5);
    });
  }

  function updateStory(progress) {
    if (!story) return;
    const p = clamp(progress);
    const weights = sceneWeights(p);
    const dominantScene = weights.indexOf(Math.max(...weights));

    setStoryCopy(weights);
    applySceneVisibility(uiScenes, weights, 12);
    applySceneVisibility(tabletScenes, weights, 10);
    applySceneVisibility(phoneScenes, weights, 10);

    applyDeviceTransform(storyDesktop, interpolateKeyframes(deviceKeyframes.desktop, p), 0);
    applyDeviceTransform(storyTablet, interpolateKeyframes(deviceKeyframes.tablet, p), 42);
    applyDeviceTransform(storyPhone, interpolateKeyframes(deviceKeyframes.phone, p), 84);

    root.style.setProperty('--l3-stage-progress', p.toFixed(5));
    root.style.setProperty('--l3-story-scene', String(dominantScene));
    storyProgressBar?.style.setProperty('--progress', p.toFixed(5));

    if (storyEyebrow) storyEyebrow.textContent = ['ADMIN CENTER', 'KI-ERGEBNISIMPORT', 'STEWARDING', 'VERÖFFENTLICHT'][dominantScene];
    if (storyLive) storyLive.textContent = ['Synchronisiert', 'Draft wird erstellt', 'Review aktiv', 'Live veröffentlicht'][dominantScene];

    if (dominantScene !== lastDominantScene) {
      story.classList.toggle('is-published', dominantScene === 3);
      story.classList.toggle('is-ai', dominantScene === 1);
      story.classList.toggle('is-steward', dominantScene === 2);
      lastDominantScene = dominantScene;
    }
  }

  function measure() {
    if (!story) return;
    const rect = story.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const viewport = window.visualViewport?.height || window.innerHeight;
    const stickyHeight = Math.max(520, viewport - Math.min(headerHeight, 90));
    geometry = {
      top,
      viewport,
      travel: Math.max(1, story.offsetHeight - stickyHeight),
      headerHeight
    };
    story.style.setProperty('--story-header-offset', `${Math.round(headerHeight)}px`);
    story.style.setProperty('--story-viewport-height', `${Math.round(viewport)}px`);
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
      node.setAttribute('data-motion-reveal', '');
      node.style.setProperty('--motion-delay', `${Math.min((index % 4) * 60, 180)}ms`);
    });

    if (reduceMotionQuery.matches || !('IntersectionObserver' in window)) {
      targets.forEach(node => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach(node => observer.observe(node));
  }

  function hoverGlowSetup() {
    if (!finePointerQuery.matches) return;
    document.querySelectorAll('.l3-platform-card,.l3-feature-row article').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
  }

  function updateHero() {
    if (!hero || !heroStage || reduceMotionQuery.matches || window.innerWidth <= 980) return;
    const rect = hero.getBoundingClientRect();
    const p = clamp((-rect.top) / Math.max(1, rect.height * .9));
    heroStage.style.setProperty('--desktop-x', `${lerp(0, 28, smooth(p))}px`);
    heroStage.style.setProperty('--desktop-y', `${lerp(0, 18, smooth(p))}px`);
    heroStage.style.setProperty('--desktop-r', `${lerp(-4, -2.2, smooth(p))}deg`);
    heroStage.style.setProperty('--tablet-x', `${lerp(0, -20, smooth(p))}px`);
    heroStage.style.setProperty('--tablet-y', `${lerp(0, 14, smooth(p))}px`);
    heroStage.style.setProperty('--tablet-r', `${lerp(-5, -7, smooth(p))}deg`);
    heroStage.style.setProperty('--phone-x', `${lerp(0, 18, smooth(p))}px`);
    heroStage.style.setProperty('--phone-y', `${lerp(0, 22, smooth(p))}px`);
    heroStage.style.setProperty('--phone-r', `${lerp(5, 7.5, smooth(p))}deg`);
    heroStage.style.setProperty('--device-scale', `${lerp(1, .975, smooth(p))}`);
    heroStage.classList.toggle('is-active', p > .05);
  }

  function render() {
    rafId = 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - (window.visualViewport?.height || window.innerHeight));
    root.style.setProperty('--l3-scroll-progress', clamp(window.scrollY / maxScroll).toFixed(5));
    header?.classList.toggle('is-scrolled', window.scrollY > 36);
    updateHero();

    if (!story) return;
    if (!desktopStoryQuery.matches || reduceMotionQuery.matches) {
      storySteps.forEach(step => {
        step.style.opacity = '1';
        step.style.transform = 'none';
        step.style.pointerEvents = 'auto';
        step.classList.add('is-active');
      });
      const finalWeights = [0, 0, 0, 1];
      applySceneVisibility(uiScenes, finalWeights, 0);
      applySceneVisibility(tabletScenes, finalWeights, 0);
      applySceneVisibility(phoneScenes, finalWeights, 0);
      applyDeviceTransform(storyDesktop, deviceKeyframes.desktop[3], 0);
      applyDeviceTransform(storyTablet, deviceKeyframes.tablet[3], 42);
      applyDeviceTransform(storyPhone, deviceKeyframes.phone[3], 84);
      root.style.setProperty('--l3-stage-progress', '1');
      storyProgressBar?.style.setProperty('--progress', '1');
      story.classList.add('is-published');
      return;
    }

    const progress = clamp((window.scrollY - geometry.top) / geometry.travel);
    updateStory(progress);
  }

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(render);
  }

  function remeasureAndRender() {
    measure();
    requestRender();
  }

  revealSetup();
  hoverGlowSetup();
  measure();
  render();

  addEventListener('scroll', requestRender, { passive: true });
  addEventListener('resize', remeasureAndRender, { passive: true });
  addEventListener('orientationchange', remeasureAndRender, { passive: true });
  window.visualViewport?.addEventListener('resize', remeasureAndRender, { passive: true });
  window.visualViewport?.addEventListener('scroll', requestRender, { passive: true });

  if ('ResizeObserver' in window && storySticky) {
    const resizeObserver = new ResizeObserver(remeasureAndRender);
    resizeObserver.observe(story);
    resizeObserver.observe(storySticky);
  }

  reduceMotionQuery.addEventListener?.('change', remeasureAndRender);
  desktopStoryQuery.addEventListener?.('change', remeasureAndRender);
})();
