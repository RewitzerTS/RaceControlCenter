(() => {
  'use strict';

  if (document.body?.dataset?.page !== 'test2-landing') return;
  document.documentElement.classList.add('js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const demoDialog = document.getElementById('t2-demo-dialog');
  const demoPanel = document.getElementById('t2-demo-panel');
  const demoTabs = [...document.querySelectorAll('[data-demo-tab]')];
  const teaser = document.getElementById('t2-driver-teaser');
  const year = document.getElementById('landing-year');
  let snapshot = null;
  let snapshotPromise = null;

  function seededRandom(seed = 20260819) {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initConstellation() {
    const canvas = document.getElementById('t2-constellation-canvas');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const random = seededRandom();
    const palette = ['#53d2df', '#199cff', '#8d72ff', '#b292ff', '#f7f9ff'];
    const particles = [];
    const pointer = { x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;

    function makeParticle(x, y, spread = 0.02, alpha = 1, size = 1) {
      return {
        x: x + (random() - 0.5) * spread,
        y: y + (random() - 0.5) * spread,
        depth: 0.4 + random() * 0.9,
        phase: random() * Math.PI * 2,
        speed: 0.18 + random() * 0.45,
        alpha: alpha * (0.35 + random() * 0.65),
        size: size * (0.65 + random() * 1.35),
        color: palette[Math.floor(random() * palette.length)]
      };
    }

    function rebuild() {
      particles.length = 0;
      const detail = width < 520 ? 310 : width < 800 ? 520 : 760;
      const eyeCount = Math.floor(detail * 0.6);
      const irisCount = Math.floor(detail * 0.25);
      const ambientCount = detail - eyeCount - irisCount;

      for (let i = 0; i < eyeCount; i += 1) {
        const u = random() * 2 - 1;
        const edge = Math.pow(Math.max(0, 1 - u * u), 0.63);
        const upper = random() > 0.5;
        const y = (upper ? -1 : 1) * 0.43 * edge;
        particles.push(makeParticle(u * 0.86, y, 0.055, 1, 1.1));
      }

      for (let i = 0; i < irisCount; i += 1) {
        const angle = random() * Math.PI * 2;
        const ring = random() > 0.26 ? 0.30 : 0.12 + random() * 0.11;
        particles.push(makeParticle(Math.cos(angle) * ring, Math.sin(angle) * ring, 0.035, 1, 1.2));
      }

      for (let i = 0; i < ambientCount; i += 1) {
        particles.push(makeParticle(random() * 2.4 - 1.2, random() * 1.5 - 0.75, 0, 0.38, 0.8));
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      rebuild();
      draw(0);
    }

    function draw(time = 0) {
      frame = time * 0.001;
      context.clearRect(0, 0, width, height);
      const cx = width * 0.51;
      const cy = height * 0.51;
      const scale = Math.min(width * 0.47, height * 0.64);
      const motion = reducedMotion.matches ? 0 : 1;

      for (const particle of particles) {
        const drift = Math.sin(frame * particle.speed + particle.phase) * 1.8 * particle.depth * motion;
        const x = cx + particle.x * scale + drift + pointer.x * particle.depth * 10;
        const y = cy + particle.y * scale + Math.cos(frame * particle.speed + particle.phase) * 1.5 * motion + pointer.y * particle.depth * 8;
        const size = Math.max(1.2, particle.size * (1.4 + particle.depth));
        context.save();
        context.translate(x, y);
        context.rotate(particle.phase + frame * 0.08 * motion);
        context.globalAlpha = particle.alpha;
        context.strokeStyle = particle.color;
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(0, -size);
        context.lineTo(size * 0.86, size * 0.62);
        context.lineTo(-size * 0.86, size * 0.62);
        context.closePath();
        context.stroke();
        context.restore();
      }

      context.save();
      context.globalAlpha = 0.16;
      context.strokeStyle = '#53d2df';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(cx, cy, scale * 0.31, scale * 0.31, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    function animate(time) {
      draw(time);
      raf = window.requestAnimationFrame(animate);
    }

    function syncAnimation() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      if (reducedMotion.matches) draw(0);
      else raf = window.requestAnimationFrame(animate);
    }

    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 0.7;
      pointer.y = ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 0.7;
    }, { passive: true });
    canvas.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });
    reducedMotion.addEventListener?.('change', syncAnimation);
    resize();
    syncAnimation();
  }

  async function loadSnapshot() {
    if (snapshot) return snapshot;
    if (!snapshotPromise) {
      snapshotPromise = fetch('assets/data/racevora-demo-snapshot.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Demo snapshot HTTP ${response.status}`);
          return response.json();
        })
        .then((data) => {
          snapshot = data;
          return data;
        })
        .catch((error) => {
          snapshotPromise = null;
          throw error;
        });
    }
    return snapshotPromise;
  }

  function teamForDriver(data, driverName) {
    return data.drivers?.find((driver) => driver.name === driverName)?.team || '—';
  }

  function renderTeaser(data) {
    if (!teaser) return;
    const head = document.createElement('div');
    head.className = 't2-standings-row t2-standings-row--head';
    head.innerHTML = '<span>Pos.</span><span>Fahrer</span><span>Team</span><span>Punkte</span><span></span>';
    teaser.replaceChildren(head);

    (data.driver_standings || []).slice(0, 5).forEach((driver) => {
      const row = document.createElement('div');
      row.className = 't2-standings-row';
      const team = teamForDriver(data, driver.name);
      row.innerHTML = `
        <span class="t2-standings-pos">${String(driver.position).padStart(2, '0')}</span>
        <span class="t2-driver"><strong>${escapeHtml(driver.name)}</strong><small>${escapeHtml(driver.gamertag)}</small></span>
        <span class="t2-team-name">${escapeHtml(team)}</span>
        <span class="t2-points">${driver.points}</span>
        <span class="t2-stat">${driver.wins} Siege</span>`;
      teaser.appendChild(row);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
    } catch (_) {
      return value || '—';
    }
  }

  function renderDriverStandings(data) {
    const rows = (data.driver_standings || []).map((driver) => `
      <tr>
        <td class="pos num">${driver.position}</td>
        <td><strong>${escapeHtml(driver.name)}</strong><br><span class="muted">${escapeHtml(driver.gamertag)}</span></td>
        <td class="hide-mobile">${escapeHtml(teamForDriver(data, driver.name))}</td>
        <td class="num"><strong>${driver.points}</strong></td>
        <td class="num hide-mobile">${driver.wins}</td>
        <td class="num hide-mobile">${driver.podiums}</td>
      </tr>`).join('');
    return `
      <h3>Fahrer-WM</h3>
      <table class="t2-demo-table">
        <thead><tr><th>Pos.</th><th>Fahrer</th><th class="hide-mobile">Team</th><th>Punkte</th><th class="hide-mobile">Siege</th><th class="hide-mobile">Podien</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderTeamStandings(data) {
    const rows = (data.team_standings || []).map((team) => `
      <tr>
        <td class="pos num">${team.position}</td>
        <td><span class="t2-team-dot" style="background:${escapeHtml(team.color || '#53d2df')}"></span><strong>${escapeHtml(team.team)}</strong></td>
        <td class="num"><strong>${team.points}</strong></td>
        <td class="num hide-mobile">${team.wins}</td>
        <td class="num hide-mobile">${team.podiums}</td>
      </tr>`).join('');
    return `
      <h3>Team-WM</h3>
      <table class="t2-demo-table">
        <thead><tr><th>Pos.</th><th>Team</th><th>Punkte</th><th class="hide-mobile">Siege</th><th class="hide-mobile">Podien</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderCalendar(data) {
    const rows = (data.calendar || []).map((race) => `
      <tr>
        <td class="pos num">${String(race.round).padStart(2, '0')}</td>
        <td><strong>${escapeHtml(race.gp)}</strong><br><span class="muted">${escapeHtml(race.circuit)}</span></td>
        <td class="hide-mobile">${formatDate(race.date)}</td>
        <td><span class="t2-status t2-status--${escapeHtml(race.status)}">${race.status === 'completed' ? 'Gefahren' : 'Kommend'}</span></td>
        <td class="hide-mobile">${race.sprint ? 'Sprint' : 'Grand Prix'}</td>
      </tr>`).join('');
    return `
      <h3>Rennkalender</h3>
      <table class="t2-demo-table">
        <thead><tr><th>Rd.</th><th>Rennen</th><th class="hide-mobile">Datum</th><th>Status</th><th class="hide-mobile">Format</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderStewarding(data) {
    const cases = (data.stewarding || []).map((item) => {
      const drivers = [item.driver1, item.driver2].filter(Boolean).join(' · ');
      const statusLabel = item.status === 'open' ? 'Offen' : item.status === 'reviewed' ? 'Geprüft' : 'Geschlossen';
      return `
        <article class="t2-steward-case">
          <div><small>${escapeHtml(item.gp)}</small><div style="margin-top:7px"><span class="t2-status t2-status--${escapeHtml(item.status)}">${statusLabel}</span></div></div>
          <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(drivers || 'Stewarding-Fall')}</p>${item.decision ? `<p>${escapeHtml(item.decision)}</p>` : '<p>Entscheidung steht noch aus.</p>'}</div>
          <aside>${escapeHtml(item.consequence || 'Noch keine Maßnahme')}</aside>
        </article>`;
    }).join('');
    return `<h3>Stewarding</h3><div class="t2-steward-list">${cases}</div>`;
  }

  function renderDemoTab(tab) {
    if (!demoPanel || !snapshot) return;
    demoTabs.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.demoTab === tab)));
    if (tab === 'teams') demoPanel.innerHTML = renderTeamStandings(snapshot);
    else if (tab === 'calendar') demoPanel.innerHTML = renderCalendar(snapshot);
    else if (tab === 'stewarding') demoPanel.innerHTML = renderStewarding(snapshot);
    else demoPanel.innerHTML = renderDriverStandings(snapshot);
    demoPanel.insertAdjacentHTML('beforeend', `<p class="t2-demo-disclaimer">${escapeHtml(snapshot.notice || 'Fiktive Demo-Daten.')}</p>`);
    demoPanel.scrollTop = 0;
  }

  function updateDemoSummary(data) {
    const nextRace = (data.calendar || []).find((race) => race.status === 'upcoming');
    const fields = {
      drivers: `${data.drivers?.length || 0} Fahrer`,
      teams: `${data.team_standings?.length || 0} Teams`,
      races: `${(data.calendar || []).filter((race) => race.status === 'completed').length} / ${data.calendar?.length || 0} Rennen`,
      next: nextRace ? `${nextRace.gp} · ${formatDate(nextRace.date)}` : 'Saison beendet'
    };
    Object.entries(fields).forEach(([key, value]) => {
      const node = document.querySelector(`[data-demo-summary="${key}"]`);
      if (node) node.textContent = value;
    });
  }

  async function openDemo() {
    if (!demoDialog) return;
    try {
      const data = await loadSnapshot();
      renderTeaser(data);
      updateDemoSummary(data);
      renderDemoTab('drivers');
      if (!demoDialog.open) demoDialog.showModal();
      document.body.classList.add('modal-open');
    } catch (error) {
      console.error('RaceVora demo snapshot failed:', error);
      if (demoPanel) demoPanel.innerHTML = '<h3>Demo nicht verfügbar</h3><p class="t2-copy">Die statischen Demo-Daten konnten gerade nicht geladen werden. Bitte versuche es erneut.</p>';
      if (!demoDialog.open) demoDialog.showModal();
    }
  }

  function closeDemo() {
    if (!demoDialog?.open) return;
    demoDialog.close();
    document.body.classList.remove('modal-open');
  }

  function initDemo() {
    loadSnapshot().then((data) => {
      renderTeaser(data);
      updateDemoSummary(data);
    }).catch((error) => console.error('RaceVora demo preload failed:', error));

    document.querySelectorAll('[data-demo-open]').forEach((button) => button.addEventListener('click', openDemo));
    document.querySelectorAll('[data-demo-close]').forEach((button) => button.addEventListener('click', closeDemo));
    demoTabs.forEach((button) => button.addEventListener('click', () => renderDemoTab(button.dataset.demoTab || 'drivers')));
    demoDialog?.addEventListener('close', () => document.body.classList.remove('modal-open'));
    demoDialog?.addEventListener('click', (event) => {
      if (event.target !== demoDialog) return;
      const rect = demoDialog.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeDemo();
    });
  }

  function initReveals() {
    const targets = [...document.querySelectorAll('.t2-reveal')];
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      targets.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((node) => observer.observe(node));
  }

  function init() {
    if (year) year.textContent = String(new Date().getFullYear());
    initConstellation();
    initDemo();
    initReveals();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
