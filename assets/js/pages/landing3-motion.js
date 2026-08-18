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

  const scenes = [
    {
      label: '01 · Kontrollzentrum',
      title: 'Deine Liga.<br><em>Ein Kontrollzentrum.</em>',
      text: 'Kalender, Fahrer, Teams, Ergebnisse und Meisterschaften leben nicht in fünf Werkzeugen. RaceVora bringt den kompletten Rennbetrieb in eine gemeinsame Oberfläche – auf jedem Gerät.',
      metrics: [['Datenbasis', '1 Liga'], ['Geräte', 'Alle'], ['Status', 'Synchron']]
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
      text: 'Steward-Fälle hängen direkt am Ergebnisentwurf. Entscheidungen und Strafen bleiben nachvollziehbar, bevor das Ergebnis offiziell veröffentlicht wird.',
      metrics: [['Review', 'Stewards'], ['Strafen', 'Nachvollziehbar'], ['Status', 'Prüfung']]
    },
    {
      label: '04 · Veröffentlichung',
      title: 'Ein Klick.<br><em>Alles aktuell.</em>',
      text: 'Mit der Freigabe werden Ergebnis, Fahrer-WM, Team-WM und Race Hub gemeinsam aktualisiert. Eine Aktion – und dieselbe Wahrheit ist auf Desktop, Tablet und Smartphone sichtbar.',
      metrics: [['Race Hub', 'Aktualisiert'], ['Meisterschaft', 'Neu berechnet'], ['Community', 'Aktuell']]
    }
  ];

  function previewDocument(type) {
    const content = {
      hub: `
        <div class="top"><b>RACEVORA</b><span>Race Hub</span></div>
        <div class="hero"><small>NÄCHSTES RENNEN</small><h1>Monaco Grand Prix</h1><p>Runde 8 · Sonntag · 20:00</p></div>
        <div class="cards"><article><small>Fahrer-WM</small><b>1. A. Vega</b><span>142 Punkte</span></article><article><small>Team-WM</small><b>1. Apex GP</b><span>248 Punkte</span></article></div>`,
      standings: `
        <div class="top"><b>RACEVORA</b><span>Fahrer-WM</span></div>
        <h2>Gesamtstand</h2>
        <ol class="standings"><li><b>1</b><span>A. Vega</span><strong>142</strong></li><li><b>2</b><span>M. Stone</span><strong>131</strong></li><li><b>3</b><span>L. Hart</span><strong>119</strong></li><li><b>4</b><span>N. Cross</span><strong>96</strong></li></ol>`,
      results: `
        <div class="top"><b>RACEVORA</b><span>WM-Dynamik</span></div>
        <h2>Punkteverlauf</h2>
        <div class="chart"><i style="--y:68%;--w:94%"></i><i style="--y:54%;--w:82%"></i><i style="--y:39%;--w:70%"></i><i style="--y:27%;--w:56%"></i><i style="--y:16%;--w:42%"></i></div>
        <div class="legend"><span>Vega</span><span>Stone</span><span>Hart</span></div>`
    }[type] || '';

    return `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,system-ui,sans-serif;background:#07111f;color:#eef5fb}body{padding:22px;background:radial-gradient(circle at 80% 0,#1c5570 0,transparent 34%),linear-gradient(160deg,#07111f,#0d2032)}
      .top{display:flex;justify-content:space-between;gap:12px;align-items:center;color:#94a9bb;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.top b{color:#74ead5}.hero{margin-top:26px;padding:24px;border:1px solid #294157;border-radius:18px;background:#0d1d2c}.hero small,article small{color:#7e94a8;letter-spacing:.09em}.hero h1{font-size:clamp(20px,4vw,34px);margin:7px 0}.hero p{margin:0;color:#a9bac8}.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.cards article{display:grid;gap:5px;padding:14px;border:1px solid #294157;border-radius:14px;background:#0b1a28}.cards span{color:#9aafc0;font-size:12px}h2{margin:24px 0 14px;font-size:22px}.standings{list-style:none;padding:0;margin:0;display:grid;gap:8px}.standings li{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:9px;padding:10px 12px;border:1px solid #294157;border-radius:12px;background:#0b1a28}.standings li b{color:#74ead5}.chart{position:relative;height:170px;margin-top:16px;border-left:1px solid #385069;border-bottom:1px solid #385069;background:linear-gradient(#ffffff08 1px,transparent 1px);background-size:100% 34px;overflow:hidden}.chart i{position:absolute;left:4%;bottom:var(--y);width:var(--w);height:3px;border-radius:4px;background:linear-gradient(90deg,#7457ff,#74ead5);transform:rotate(-6deg);transform-origin:left center;box-shadow:0 0 14px #74ead566}.legend{display:flex;gap:12px;margin-top:12px;color:#9db1c1;font-size:11px}
    </style></head><body>${content}</body></html>`;
  }

  function installStaticPreviews() {
    const heroFrames = [...document.querySelectorAll('.l3-device-stage iframe')];
    const types = ['hub', 'standings', 'results'];
    heroFrames.forEach((frame, index) => {
      frame.removeAttribute('src');
      frame.srcdoc = previewDocument(types[index % types.length]);
      frame.title = `RaceVora Beispielansicht · ${types[index % types.length]}`;
      frame.dataset.staticPreview = 'true';
    });

    document.querySelectorAll('[data-static-preview]').forEach((frame) => {
      frame.removeAttribute('src');
      frame.srcdoc = previewDocument(frame.dataset.staticPreview);
    });
  }

  const storyMarkup = () => `
    <section class="l3-scroll-story" id="experience" aria-label="RaceVora Workflow">
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
            <div class="l3-story-device l3-story-device--desktop" data-story-device="desktop"><div class="l3-story-shell"><div class="l3-story-browser"><i></i><i></i><i></i><span>racevora.com</span></div><div class="l3-story-preview l3-story-preview--desktop"><iframe data-static-preview="hub" title="RaceVora Beispielansicht · Race Hub" tabindex="-1"></iframe></div></div></div>
            <div class="l3-story-device l3-story-device--tablet" data-story-device="tablet"><div class="l3-story-shell"><div class="l3-story-preview l3-story-preview--tablet"><iframe data-static-preview="standings" title="RaceVora Beispielansicht · Fahrer-WM" tabindex="-1"></iframe></div></div></div>
            <div class="l3-story-device l3-story-device--phone" data-story-device="phone"><div class="l3-story-shell"><div class="l3-story-preview l3-story-preview--phone"><iframe data-static-preview="results" title="RaceVora Beispielansicht · Ergebnisse" tabindex="-1"></iframe></div></div></div>
          </div>
        </div>
      </div>
    </section>`;

  function installStory() {
    if (!strip || document.querySelector('.l3-scroll-story')) return;
    strip.insertAdjacentHTML('afterend', storyMarkup());
  }

  installStory();
  installStaticPreviews();

  const story = document.querySelector('.l3-scroll-story');
  const storySticky = story?.querySelector('.l3-scroll-story__sticky');
  const progressBar = story?.querySelector('.l3-scroll-story__progress i');
  const storySteps = [...document.querySelectorAll('[data-story-step]')];
  const storyDesktop = document.querySelector('[data-story-device="desktop"]');
  const storyTablet = document.querySelector('[data-story-device="tablet"]');
  const storyPhone = document.querySelector('[data-story-device="phone"]');
  let geometry = { top: 0, travel: 1 };
  let rafId = 0;
  let activeScene = -1;

  function setActiveScene(index) {
    const next = Math.max(0, Math.min(scenes.length - 1, index));
    if (activeScene === next && desktopStoryQuery.matches) return;
    activeScene = next;

    storySteps.forEach((step, stepIndex) => {
      const active = stepIndex === next;
      if (desktopStoryQuery.matches && !reduceMotionQuery.matches) {
        step.hidden = !active;
        step.style.opacity = active ? '1' : '0';
        step.style.transform = 'translate3d(0,-50%,0)';
        step.style.pointerEvents = active ? 'auto' : 'none';
      } else {
        step.hidden = false;
        step.style.opacity = '1';
        step.style.transform = 'none';
        step.style.pointerEvents = 'auto';
      }
      step.classList.toggle('is-active', active || !desktopStoryQuery.matches);
    });

    const offsets = [
      [[8, -4, 1], [-22, 40, .84], [28, 54, .86]],
      [[-8, -10, 1.02], [-26, 30, .88], [32, 42, .9]],
      [[-18, -4, 1.01], [16, -12, .96], [-12, -22, 1.04]],
      [[0, -6, 1], [30, 0, 1], [-28, 0, 1.02]]
    ][next];
    [storyDesktop, storyTablet, storyPhone].forEach((node, deviceIndex) => {
      if (!node) return;
      const [x, y, scale] = offsets[deviceIndex];
      node.style.transform = `translate3d(${x}px,${y}px,${deviceIndex * 38}px) scale(${scale})`;
      node.style.opacity = '1';
      node.style.filter = 'none';
    });
  }

  function measure() {
    if (!story) return;
    const rect = story.getBoundingClientRect();
    const viewport = window.visualViewport?.height || window.innerHeight;
    const headerHeight = header?.getBoundingClientRect().height || 0;
    geometry.top = window.scrollY + rect.top;
    geometry.travel = Math.max(1, story.offsetHeight - Math.max(520, viewport - Math.min(headerHeight, 90)));
    story.style.setProperty('--story-header-offset', `${Math.round(headerHeight)}px`);
    story.style.setProperty('--story-viewport-height', `${Math.round(viewport)}px`);
  }

  function updateHero() {
    if (!hero || !heroStage || reduceMotionQuery.matches || window.innerWidth <= 980) return;
    const rect = hero.getBoundingClientRect();
    const p = clamp((-rect.top) / Math.max(1, rect.height));
    heroStage.style.setProperty('--desktop-y', `${Math.round(p * 10)}px`);
    heroStage.style.setProperty('--tablet-y', `${Math.round(p * 8)}px`);
    heroStage.style.setProperty('--phone-y', `${Math.round(p * 12)}px`);
    heroStage.style.setProperty('--device-scale', `${1 - p * .012}`);
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
      setActiveScene(0);
      progressBar?.style.setProperty('--progress', '1');
      return;
    }

    const progress = clamp((window.scrollY - geometry.top) / geometry.travel);
    const sceneIndex = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
    setActiveScene(sceneIndex);
    progressBar?.style.setProperty('--progress', progress.toFixed(5));
  }

  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(render);
  }

  function remeasureAndRender() {
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
    if (reduceMotionQuery.matches || !('IntersectionObserver' in window)) {
      targets.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((node) => observer.observe(node));
  }

  function hoverGlowSetup() {
    if (!finePointerQuery.matches) return;
    document.querySelectorAll('.l3-platform-card,.l3-feature-row article').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
  }

  revealSetup();
  hoverGlowSetup();
  measure();
  setActiveScene(0);
  render();

  addEventListener('scroll', requestRender, { passive: true });
  addEventListener('resize', remeasureAndRender, { passive: true });
  addEventListener('orientationchange', remeasureAndRender, { passive: true });
  window.visualViewport?.addEventListener('resize', remeasureAndRender, { passive: true });
  window.visualViewport?.addEventListener('scroll', requestRender, { passive: true });
  reduceMotionQuery.addEventListener?.('change', remeasureAndRender);
  desktopStoryQuery.addEventListener?.('change', remeasureAndRender);

  if ('ResizeObserver' in window && storySticky) {
    const resizeObserver = new ResizeObserver(remeasureAndRender);
    resizeObserver.observe(story);
    resizeObserver.observe(storySticky);
  }
})();