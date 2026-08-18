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
      metrics: [['Übersicht', 'Zentral'], ['Rollen', 'Getrennt'], ['Daten', 'Synchron']]
    },
    {
      label: '02 · KI-Ergebnis',
      title: 'Screenshot rein.<br><em>Entwurf bereit.</em>',
      text: 'RaceVora übernimmt die Fleißarbeit. Ergebnisbild hochladen, Fahrer zuordnen, Daten prüfen und den fertigen Draft direkt weiterbearbeiten.',
      metrics: [['Input', 'Screenshot'], ['Mapping', 'Automatisch'], ['Draft', 'Editierbar']]
    },
    {
      label: '03 · Stewarding',
      title: 'Prüfen.<br><em>Bevor es zählt.</em>',
      text: 'Entscheidungen hängen direkt am Rennen. Strafen, Begründungen und Status bleiben nachvollziehbar, bevor das Ergebnis offiziell wird.',
      metrics: [['Review', 'Stewards'], ['Strafen', 'Im Draft'], ['Historie', 'Nachvollziehbar']]
    },
    {
      label: '04 · Veröffentlichung',
      title: 'Ein Klick.<br><em>Alles aktuell.</em>',
      text: 'Mit der Freigabe aktualisieren sich Ergebnis, Fahrer-WM, Team-WM und Race Hub gemeinsam. Erst hier wird aus dem Draft die offizielle Wahrheit der Liga.',
      metrics: [['Race Hub', 'Aktuell'], ['WM', 'Neu berechnet'], ['Geräte', 'Synchron']]
    }
  ];

  function heroPreviewDocument() {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#06111d;color:#edf4fb}body{background:radial-gradient(circle at 82% 2%,#123d55 0,transparent 31%),linear-gradient(145deg,#07121f,#091827 55%,#06111c)}
      .app{display:grid;grid-template-columns:78px 1fr;min-height:100vh}.rail{padding:25px 16px;border-right:1px solid #ffffff0b;background:#07111b;display:flex;flex-direction:column;align-items:center;gap:17px}.logo{width:34px;height:20px;border-radius:100% 0 100% 0;border:3px solid #52d5df;border-left-color:#8469ff;transform:skewX(-16deg);margin-bottom:8px}.rail i{display:block;width:34px;height:34px;border-radius:11px;background:#102238}.rail i.on{background:linear-gradient(135deg,#7359e8,#246f95);box-shadow:0 8px 22px #3e68b733}.main{padding:28px 34px 34px}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;color:#74899d;font-size:12px;text-transform:uppercase;letter-spacing:.1em}.top b{color:#79dfe5}.live{padding:7px 11px;border:1px solid #61d4ac35;border-radius:999px;color:#a0d9c2;background:#61d4ac0b}.hero{margin-top:26px;display:grid;grid-template-columns:1.3fr .7fr;gap:16px}.race,.mini,.panel{border:1px solid #ffffff10;background:#0b1b2a;border-radius:18px;box-shadow:inset 0 1px #ffffff08}.race{padding:24px}.eyebrow{color:#6fd6df;font-size:10px;font-weight:900;letter-spacing:.14em}.race h1{margin:8px 0 5px;font-size:32px;letter-spacing:-.04em}.race p{margin:0;color:#8297aa;font-size:13px}.count{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:22px}.count span{padding:12px;border-radius:12px;background:#0e2337}.count small{display:block;color:#677d92;font-size:9px}.count b{display:block;margin-top:3px;font-size:15px}.mini{padding:20px;background:linear-gradient(145deg,#0c1d2e,#0c2333)}.mini h3{margin:7px 0 16px;font-size:17px}.rank{display:grid;gap:8px}.rank span{display:grid;grid-template-columns:28px 1fr auto;gap:8px;align-items:center;padding:8px 9px;border-radius:10px;background:#0b1927;color:#b9c9d6;font-size:11px}.rank b{color:#72dce4}.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;margin-top:16px}.panel{padding:18px}.panel-head{display:flex;align-items:center;justify-content:space-between}.panel-head strong{font-size:14px}.panel-head small{color:#6f8599}.bars{display:grid;gap:10px;margin-top:18px}.bars i{display:block;height:6px;border-radius:99px;background:linear-gradient(90deg,#7861f0,#57d0dd);box-shadow:0 0 12px #57d0dd22}.bars i:nth-child(2){width:87%}.bars i:nth-child(3){width:73%}.bars i:nth-child(4){width:61%}.events{display:grid;gap:8px;margin-top:14px}.events span{display:flex;justify-content:space-between;padding:9px 10px;border-radius:10px;background:#0c1f31;color:#9eb0bf;font-size:11px}.events b{color:#e4edf4}
    </style></head><body><div class="app"><aside class="rail"><div class="logo"></div><i class="on"></i><i></i><i></i><i></i><i></i></aside><main class="main"><div class="top"><b>RACEVORA · RACE HUB</b><span class="live">LIVE · Liga synchron</span></div><div class="hero"><section class="race"><div class="eyebrow">NÄCHSTES RENNEN</div><h1>Monaco Grand Prix</h1><p>Runde 8 · Sonntag · 20:00</p><div class="count"><span><small>START IN</small><b>03 Tage</b></span><span><small>SAISON</small><b>8 / 18</b></span><span><small>STATUS</small><b>Bereit</b></span></div></section><section class="mini"><div class="eyebrow">FAHRER-WM</div><h3>Gesamtstand</h3><div class="rank"><span><b>1</b><em>A. Vega</em><strong>142</strong></span><span><b>2</b><em>M. Stone</em><strong>131</strong></span><span><b>3</b><em>L. Hart</em><strong>119</strong></span></div></section></div><div class="grid"><section class="panel"><div class="panel-head"><strong>WM-Dynamik</strong><small>letzte 5 Rennen</small></div><div class="bars"><i></i><i></i><i></i><i></i></div></section><section class="panel"><div class="panel-head"><strong>Letzte Events</strong><small>aktuell</small></div><div class="events"><span><b>Silverstone</b><em>Veröffentlicht</em></span><span><b>Montreal</b><em>Veröffentlicht</em></span><span><b>Monaco</b><em>Nächstes Rennen</em></span></div></section></div></main></div></body></html>`;
  }

  function sceneMarkup(index) {
    if (index === 0) {
      return `<div class="rv-ui rv-ui--control"><div class="rv-ui__top"><span>ADMIN CENTER</span><b>Race Control Liga</b><i>LIVE</i></div><div class="rv-control-grid"><article><small>SAISON</small><strong>2026 Championship</strong><span>8 von 18 Rennen</span></article><article><small>FAHRER</small><strong>20 aktiv</strong><span>4 Teams · 2 Reserven</span></article><article><small>ERGEBNISSE</small><strong>7 veröffentlicht</strong><span>1 Draft in Prüfung</span></article><article><small>STEWARDING</small><strong>2 offene Fälle</strong><span>Priorität normal</span></article></div><div class="rv-ui__footer"><span><b>Race Hub</b> synchron</span><span><b>Datenbasis</b> aktuell</span><span><b>Rollen</b> geschützt</span></div></div>`;
    }
    if (index === 1) {
      return `<div class="rv-ui rv-ui--ai"><div class="rv-ui__top"><span>ERGEBNISIMPORT</span><b>Monaco GP</b><i>KI</i></div><div class="rv-ai-flow"><div class="rv-shot"><div class="rv-shot__flag"></div><strong>race-result.png</strong><small>Screenshot erkannt</small><span>20 Fahrer gefunden</span></div><div class="rv-ai-arrow">→</div><div class="rv-result-table"><div><small>POS</small><small>FAHRER</small><small>ZEIT</small></div><span><b>1</b><em>A. Vega</em><strong>1:32:14</strong></span><span><b>2</b><em>M. Stone</em><strong>+4.208</strong></span><span><b>3</b><em>L. Hart</em><strong>+8.416</strong></span><span><b>4</b><em>N. Cross</em><strong>+12.909</strong></span><button>Entwurf prüfen</button></div></div></div>`;
    }
    if (index === 2) {
      return `<div class="rv-ui rv-ui--steward"><div class="rv-ui__top"><span>STEWARDING</span><b>Monaco GP · Fall #27</b><i>REVIEW</i></div><div class="rv-steward-grid"><div class="rv-case-list"><span class="active"><b>#27</b><em>Unsafe Rejoin</em><small>Offen</small></span><span><b>#26</b><em>Track Limits</em><small>Entschieden</small></span><span><b>#25</b><em>Kontakt T1</em><small>Entschieden</small></span></div><div class="rv-decision"><small>ENTSCHEIDUNG</small><h3>5 Sekunden Zeitstrafe</h3><p>Der Fahrer kehrt außerhalb der sicheren Linie auf die Strecke zurück und behindert ein nachfolgendes Fahrzeug.</p><div><span>Begründung gespeichert</span><span>Wirkt auf Ergebnis-Draft</span></div><button>Entscheidung übernehmen</button></div></div></div>`;
    }
    return `<div class="rv-ui rv-ui--publish"><div class="rv-ui__top"><span>RACE HUB</span><b>Monaco Grand Prix</b><i>AKTUELL</i></div><div class="rv-publish-hero"><small>OFFIZIELLES ERGEBNIS</small><h3>Monaco Grand Prix</h3><p>Runde 8 · veröffentlicht</p></div><div class="rv-publish-grid"><article><small>FAHRER-WM</small><strong>1. A. Vega</strong><span>167 Punkte</span></article><article><small>TEAM-WM</small><strong>1. Apex GP</strong><span>286 Punkte</span></article><article class="chart"><small>WM-DYNAMIK</small><i></i><i></i><i></i><i></i></article></div></div>`;
  }

  function mobileVisual(index) {
    return `<div class="l3-story-mobile-visual"><div class="l3-story-mobile-shell">${sceneMarkup(index)}</div></div>`;
  }

  function storyMarkup() {
    return `<section class="l3-scroll-story" id="experience" aria-label="RaceVora Workflow">
      <div class="l3-scroll-story__sticky">
        <div class="l3-shell l3-scroll-story__grid">
          <div class="l3-scroll-story__copy">
            ${scenes.map((scene, index) => `<article class="l3-scroll-story__step${index === 0 ? ' is-active' : ''}" data-story-step="${index}" aria-hidden="${index === 0 ? 'false' : 'true'}"><div class="l3-scroll-story__index">${scene.label}</div><h2>${scene.title}</h2><p>${scene.text}</p><div class="l3-scroll-story__metrics">${scene.metrics.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join('')}</div>${mobileVisual(index)}</article>`).join('')}
            <div class="l3-scroll-story__rail" aria-hidden="true">${scenes.map((_, index) => `<i data-story-dot="${index}" class="${index === 0 ? 'is-active' : ''}"></i>`).join('')}</div>
          </div>
          <div class="l3-scroll-story__stage" data-story-stage="0" aria-hidden="true">
            <div class="l3-story-halo"></div>
            <div class="l3-story-product"><div class="l3-story-browser"><i></i><i></i><i></i><span>racevora.com</span><b>Race Management Platform</b></div><div class="l3-story-product__screen">${scenes.map((_, index) => `<div class="l3-product-scene${index === 0 ? ' is-active' : ''}" data-product-scene="${index}">${sceneMarkup(index)}</div>`).join('')}</div></div>
            <div class="l3-story-satellite l3-story-satellite--tablet"><div class="l3-satellite-screen"><small>FAHRER-WM</small><strong>Gesamtstand</strong><span>1 · A. Vega <b>167</b></span><span>2 · M. Stone <b>153</b></span><span>3 · L. Hart <b>141</b></span></div></div>
            <div class="l3-story-satellite l3-story-satellite--phone"><div class="l3-satellite-screen"><small>RACE HUB</small><strong>Monaco GP</strong><div class="l3-satellite-status"><i></i> veröffentlicht</div><span>Nächstes Rennen</span><b>Silverstone</b></div></div>
            <div class="l3-story-sync"><i></i><span>Eine Veröffentlichung · überall aktuell</span></div>
          </div>
        </div>
      </div>
    </section>`;
  }

  function installHeroPreview() {
    const desktopFrame = document.querySelector('.l3-desktop iframe');
    if (!desktopFrame) return;
    desktopFrame.removeAttribute('src');
    desktopFrame.srcdoc = heroPreviewDocument();
    desktopFrame.title = 'RaceVora Produktansicht · Race Hub und Ligastatus';
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
