(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'landing3') return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const header = document.querySelector('.l3-header');
  const hero = document.querySelector('.l3-hero');
  const heroStage = document.querySelector('.l3-device-stage');
  const strip = document.querySelector('.l3-strip');

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  function storyMarkup() {
    return `
      <section class="l3-scroll-story" id="experience" aria-label="Race Control Center Workflow">
        <div class="l3-scroll-story__rail" aria-hidden="true"><i class="is-active"></i><i></i><i></i><i></i></div>
        <div class="l3-scroll-story__sticky">
          <div class="l3-shell l3-scroll-story__grid">
            <div class="l3-scroll-story__copy">
              <article class="l3-scroll-story__step is-active" data-story-step="0">
                <div class="l3-scroll-story__index">01 · Eine Plattform</div>
                <h2>Deine Liga.<br><em>Ein Kontrollzentrum.</em></h2>
                <p>Kalender, Fahrer, Teams, Ergebnisse und Meisterschaften leben nicht in fünf Werkzeugen. RCC bringt den kompletten Rennbetrieb in eine gemeinsame Oberfläche – auf jedem Gerät.</p>
                <div class="l3-scroll-story__metrics"><span><small>Datenbasis</small><b>1 Liga</b></span><span><small>Geräte</small><b>Desktop · Tablet · Mobile</b></span><span><small>Status</small><b>Live synchron</b></span></div>
              </article>
              <article class="l3-scroll-story__step" data-story-step="1">
                <div class="l3-scroll-story__index">02 · Ergebnis</div>
                <h2>Screenshot rein.<br><em>Entwurf raus.</em></h2>
                <p>Nach dem Rennen übernimmt die KI die Fleißarbeit: Ergebnisbild lesen, Fahrer erkennen, Positionen und Zeiten erfassen. Die Ligaleitung kontrolliert – RCC baut den Entwurf.</p>
                <div class="l3-scroll-story__metrics"><span><small>Input</small><b>Screenshot</b></span><span><small>Mapping</small><b>Fahrer automatisch</b></span><span><small>Output</small><b>Editierbarer Draft</b></span></div>
              </article>
              <article class="l3-scroll-story__step" data-story-step="2">
                <div class="l3-scroll-story__index">03 · Stewarding</div>
                <h2>Entscheiden.<br><em>Bevor es zählt.</em></h2>
                <p>Steward-Fälle hängen direkt am Ergebnisentwurf. Zeit- und Punktestrafen verändern zuerst nur die Vorschau. Erst wenn alles geklärt ist, wird aus dem Draft ein offizielles Ergebnis.</p>
                <div class="l3-scroll-story__metrics"><span><small>Review</small><b>Stewards</b></span><span><small>Strafen</small><b>Im Draft sichtbar</b></span><span><small>Kontrolle</small><b>Vor Freigabe</b></span></div>
              </article>
              <article class="l3-scroll-story__step" data-story-step="3">
                <div class="l3-scroll-story__index">04 · Veröffentlichen</div>
                <h2>Ein Klick.<br><em>Alles aktuell.</em></h2>
                <p>Das finale Ergebnis aktualisiert Race Hub, Fahrer-WM und Team-WM gemeinsam. Was die Rennleitung veröffentlicht, ist für die Community sofort auf Smartphone, Tablet und Desktop sichtbar.</p>
                <div class="l3-scroll-story__metrics"><span><small>Race Hub</small><b>Aktualisiert</b></span><span><small>Meisterschaft</small><b>Neu berechnet</b></span><span><small>Community</small><b>Sofort live</b></span></div>
              </article>
            </div>

            <div class="l3-scroll-story__stage" aria-hidden="true">
              <div class="l3-scroll-orbit"></div>

              <div class="l3-story-device l3-story-device--desktop" data-story-device="desktop">
                <div class="l3-story-shell">
                  <div class="l3-story-browser"><i></i><i></i><i></i><span>racecontrol.center/admin</span></div>
                  <div class="l3-story-screen">
                    <div class="l3-story-screen__top"><span class="l3-story-screen__eyebrow">ADMIN CENTER · LIVE</span><span class="l3-story-live">Synchronisiert</span></div>
                    <h3>Race Weekend Control</h3>
                    <div class="l3-story-panels">
                      <div class="l3-story-card l3-story-ai"><small>KI-ERGEBNISIMPORT</small><strong>São Paulo GP · Draft</strong><div class="l3-story-ai__line"></div><div class="l3-story-ai__line"></div><div class="l3-story-ai__line"></div><div class="l3-story-ai__line"></div></div>
                      <div class="l3-story-card l3-story-steward"><small>STEWARDING</small><strong>Runde 10 · Review</strong><div class="l3-story-steward__decision">✓ Entscheidung gespeichert</div></div>
                    </div>
                    <div class="l3-story-result"><span><b>1</b><strong>Nils</strong><em>25 P</em></span><span><b>2</b><strong>Mo</strong><em>18 P</em></span><span><b>3</b><strong>Richard</strong><em>15 P</em></span></div>
                  </div>
                </div>
              </div>

              <div class="l3-story-device l3-story-device--tablet" data-story-device="tablet">
                <div class="l3-story-shell"><div class="l3-story-tablet-screen"><div class="l3-story-mini-logo"><img src="assets/images/logo.png" alt=""><span>RCC · RACE HUB</span></div><small>FAHRER-WM</small><div class="l3-story-podium"><span><b>1</b><strong>Mo</strong><small>189 P</small></span><span><b>2</b><strong>Nils</strong><small>163 P</small></span><span><b>3</b><strong>Richard</strong><small>136 P</small></span></div><div class="l3-story-progress"><small>SAISONFORTSCHRITT</small><div class="l3-story-progress-track"><i></i></div></div></div></div>
              </div>

              <div class="l3-story-device l3-story-device--phone" data-story-device="phone">
                <div class="l3-story-shell"><div class="l3-story-phone-screen"><div class="l3-story-mini-logo"><img src="assets/images/logo.png" alt=""><span>RCC · MOBILE</span></div><small>QUICK ACTIONS</small><div class="l3-story-phone-actions"><span>＋ Ergebnis eintragen</span><span>⚑ Steward-Fall</span><span>🏁 Rennen verwalten</span></div><div class="l3-story-podium"><span><b>1</b><strong>Nils</strong><small>São Paulo</small></span><span><b>2</b><strong>Mo</strong><small>+0,378</small></span></div></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function installStory() {
    if (!strip || document.querySelector('.l3-scroll-story')) return;
    strip.insertAdjacentHTML('afterend', storyMarkup());
  }

  installStory();

  const story = document.querySelector('.l3-scroll-story');
  const storySteps = [...document.querySelectorAll('[data-story-step]')];
  const storyRail = [...document.querySelectorAll('.l3-scroll-story__rail i')];
  const storyDesktop = document.querySelector('[data-story-device="desktop"]');
  const storyTablet = document.querySelector('[data-story-device="tablet"]');
  const storyPhone = document.querySelector('[data-story-device="phone"]');

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
      node.style.setProperty('--motion-delay', `${Math.min((index % 4) * 70, 210)}ms`);
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(node => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .14, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(node => observer.observe(node));
  }

  function hoverGlowSetup() {
    if (!window.matchMedia('(pointer:fine)').matches) return;
    document.querySelectorAll('.l3-platform-card,.l3-feature-row article').forEach(card => {
      card.addEventListener('pointermove', event => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
      });
    });
  }

  function setStoryStep(index) {
    storySteps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    storyRail.forEach((rail, i) => rail.classList.toggle('is-active', i <= index));
  }

  function transformStory(progress) {
    if (!storyDesktop || !storyTablet || !storyPhone) return;
    const p = clamp(progress);
    const segment = p * 3;
    const step = Math.min(3, Math.floor(segment + .0001));
    setStoryStep(step);

    const desktopX = lerp(30, -35, p);
    const desktopY = Math.sin(p * Math.PI) * -18;
    const desktopRotate = lerp(-3.5, 1.5, p);
    const desktopScale = lerp(.92, 1.02, Math.sin(p * Math.PI));

    const tabletX = lerp(-24, 42, p);
    const tabletY = lerp(42, -24, p);
    const tabletRotate = lerp(-8, -2, p);
    const tabletScale = lerp(.82, 1.04, clamp((p - .18) / .72));

    const phoneX = lerp(18, -34, p);
    const phoneY = lerp(54, -28, p);
    const phoneRotate = lerp(8, 1.5, p);
    const phoneScale = lerp(.88, 1.08, clamp((p - .34) / .56));

    storyDesktop.style.transform = `translate3d(${desktopX}px,${desktopY}px,0) perspective(1400px) rotateY(${desktopRotate}deg) rotateX(1deg) scale(${desktopScale})`;
    storyTablet.style.transform = `translate3d(${tabletX}px,${tabletY}px,40px) rotate(${tabletRotate}deg) scale(${tabletScale})`;
    storyPhone.style.transform = `translate3d(${phoneX}px,${phoneY}px,80px) rotate(${phoneRotate}deg) scale(${phoneScale})`;

    const desktopOpacity = 1;
    const tabletOpacity = lerp(.42, 1, clamp((p - .04) / .46));
    const phoneOpacity = lerp(.42, 1, clamp((p - .18) / .46));
    storyDesktop.style.opacity = desktopOpacity;
    storyTablet.style.opacity = tabletOpacity;
    storyPhone.style.opacity = phoneOpacity;

    root.style.setProperty('--l3-stage-progress', p.toFixed(4));
  }

  function transformHero() {
    if (!hero || !heroStage || reduceMotion || window.innerWidth <= 980) return;
    const rect = hero.getBoundingClientRect();
    const p = clamp((-rect.top) / Math.max(1, rect.height * .78));
    heroStage.style.setProperty('--desktop-x', `${lerp(0, 40, p)}px`);
    heroStage.style.setProperty('--desktop-y', `${lerp(0, 28, p)}px`);
    heroStage.style.setProperty('--desktop-r', `${lerp(-4, -1.5, p)}deg`);
    heroStage.style.setProperty('--tablet-x', `${lerp(0, -32, p)}px`);
    heroStage.style.setProperty('--tablet-y', `${lerp(0, 22, p)}px`);
    heroStage.style.setProperty('--tablet-r', `${lerp(-5, -9, p)}deg`);
    heroStage.style.setProperty('--phone-x', `${lerp(0, 28, p)}px`);
    heroStage.style.setProperty('--phone-y', `${lerp(0, 40, p)}px`);
    heroStage.style.setProperty('--phone-r', `${lerp(5, 9, p)}deg`);
    heroStage.style.setProperty('--device-scale', `${lerp(1, .96, p)}`);
    heroStage.classList.toggle('is-active', p > .06);
  }

  let ticking = false;
  function update() {
    ticking = false;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--l3-scroll-progress', clamp(window.scrollY / maxScroll).toFixed(4));
    header?.classList.toggle('is-scrolled', window.scrollY > 32);

    transformHero();

    if (story && window.innerWidth > 1080 && !reduceMotion) {
      const rect = story.getBoundingClientRect();
      const travel = Math.max(1, story.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / travel);
      transformStory(progress);
    } else if (story) {
      transformStory(1);
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  revealSetup();
  hoverGlowSetup();
  update();
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate, { passive: true });
})();
