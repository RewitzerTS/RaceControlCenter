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
  const smooth = value => {
    const p = clamp(value);
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
                <div class="l3-story-browser"><i></i><i></i><i></i><span>racecontrol.center</span></div>
                <div class="l3-story-preview l3-story-preview--desktop">
                  <iframe src="index.html?league=rcc" title="Race Control Center Race Hub" loading="lazy" tabindex="-1"></iframe>
                </div>
              </div>
            </div>

            <div class="l3-story-device l3-story-device--tablet" data-story-device="tablet">
              <div class="l3-story-shell">
                <div class="l3-story-preview l3-story-preview--tablet">
                  <iframe src="fahrer-wm.html?league=rcc" title="Race Control Center Fahrer-WM" loading="lazy" tabindex="-1"></iframe>
                </div>
              </div>
            </div>

            <div class="l3-story-device l3-story-device--phone" data-story-device="phone">
              <div class="l3-story-shell">
                <div class="l3-story-preview l3-story-preview--phone">
                  <iframe src="ergebnisse.html?league=rcc" title="Race Control Center Ergebnisse" loading="lazy" tabindex="-1"></iframe>
                </div>
              </div>
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
  const storyDesktop = document.querySelector('[data-story-device="desktop"]');
  const storyTablet = document.querySelector('[data-story-device="tablet"]');
  const storyPhone = document.querySelector('[data-story-device="phone"]');

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

  function sceneWeights(progress) {
    const position = clamp(progress) * (scenes.length - 1);
    return scenes.map((_, index) => smooth(clamp(1 - Math.abs(position - index))));
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
    setStoryCopy(weights);
    applyDeviceTransform(storyDesktop, interpolateKeyframes(deviceKeyframes.desktop, p), 0);
    applyDeviceTransform(storyTablet, interpolateKeyframes(deviceKeyframes.tablet, p), 42);
    applyDeviceTransform(storyPhone, interpolateKeyframes(deviceKeyframes.phone, p), 84);
    root.style.setProperty('--l3-stage-progress', p.toFixed(5));
    storyProgressBar?.style.setProperty('--progress', p.toFixed(5));
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
    const viewport = window.visualViewport?.height || window.innerHeight;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);
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
      applyDeviceTransform(storyDesktop, deviceKeyframes.desktop[3], 0);
      applyDeviceTransform(storyTablet, deviceKeyframes.tablet[3], 42);
      applyDeviceTransform(storyPhone, deviceKeyframes.phone[3], 84);
      root.style.setProperty('--l3-stage-progress', '1');
      storyProgressBar?.style.setProperty('--progress', '1');
      return;
    }

    updateStory(clamp((window.scrollY - geometry.top) / geometry.travel));
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