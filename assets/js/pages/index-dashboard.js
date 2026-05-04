    (function () {
      const escapeHtml = window.escapeHtml || ((value) => String(value ?? ''));
      const ACCENT_COLORS = ['#36d4c7', '#b78cff', '#f5c451', '#ff7a7a', '#7dc5ff'];
      const REAL_WORLD_F1_NEWS_FEEDS = [
        'https://www.motorsport-total.com/formel-1/rss',
        'https://www.motorsport-magazin.com/formel1/news.xml',
        'https://news.google.com/rss/search?q=site:motorsport-total.com+Formel+1&hl=de&gl=DE&ceid=DE:de',
        'https://news.google.com/rss/search?q=site:motorsport-magazin.com+Formel+1&hl=de&gl=DE&ceid=DE:de',
        'https://news.google.com/rss/search?q=Formel+1+News&hl=de&gl=DE&ceid=DE:de',
        'https://news.google.com/rss/search?q=Formula+1+latest+news&hl=en-US&gl=US&ceid=US:en'
      ];
      const LIVE_NEWS_CACHE_KEY = 'rcc.liveF1News.v1';
      const LIVE_NEWS_CACHE_TTL_MS = 1000 * 60 * 5;
      const LIVE_NEWS_REQUEST_TIMEOUT_MS = 6500;
      const F1_ON_THIS_DAY_MOMENTS = [
        { monthDay: '05-25', year: 2008, text: 'Lewis Hamilton gewann in Monaco seinen ersten Grand Prix.' },
        { monthDay: '05-14', year: 2006, text: 'Fernando Alonso gewann den Europa Grand Prix am Nürburgring.' },
        { monthDay: '06-13', year: 1993, text: 'Alain Prost gewann den Kanada GP und zog in der WM davon.' },
        { monthDay: '07-18', year: 1965, text: 'Jim Clark gewann in Zandvoort und dominierte die Saison.' },
        { monthDay: '08-30', year: 2020, text: 'Pierre Gasly holte in Monza seinen ersten F1-Sieg.' },
        { monthDay: '09-27', year: 1970, text: 'Jochen Rindt wurde posthum Formel-1-Weltmeister.' },
        { monthDay: '11-14', year: 2010, text: 'Sebastian Vettel wurde in Abu Dhabi erstmals Weltmeister.' }
      ];
      let countdownTimer = null;
      let countdownRefreshTriggered = false;
      let storylineRefreshTimer = null;
      const WEEKLY_STORYLINE_TEMPLATES = [
        ({ lead, chase }) => `${lead.driverName} verteidigt die Spitze mit ${lead.points} Punkten, aber ${chase.driverName} bleibt direkt in Schlagdistanz.`,
        ({ lead, latestRace }) => `${latestRace?.grand_prix_name || 'Das letzte Rennen'} hat das Momentum verschoben – ${lead.driverName} reist als Gejagter weiter.`,
        ({ lead, topTeam }) => `${lead.driverName} punktet konstant, während ${topTeam?.teamName || 'die Teamwertung'} im Hintergrund immer mehr Druck aufbaut.`,
        ({ lead, chase }) => `Zwischen ${lead.driverName} und ${chase.driverName} entscheidet aktuell jede schnellste Runde über das Kräfteverhältnis.`,
        ({ latestRace, lead }) => `Nach ${latestRace?.grand_prix_name || 'dem letzten Lauf'} steht ${lead.driverName} im Zentrum der Titelgeschichte dieser Woche.`,
        ({ chase, topTeam }) => `${chase.driverName} braucht nur ein starkes Wochenende, um ${topTeam?.teamName || 'die Spitze'} ernsthaft unter Druck zu setzen.`,
        ({ lead }) => `${lead.driverName} sammelt Rennen für Rennen und zwingt die Konkurrenz zum Reagieren.`,
        ({ chase }) => `${chase.driverName} bleibt der gefährlichste Herausforderer, weil der Rückstand jederzeit schrumpfen kann.`,
        ({ lead, chase, currentSeason }) => `In ${currentSeason?.name || 'dieser Saison'} läuft alles auf ein direktes Duell ${lead.driverName} gegen ${chase.driverName} hinaus.`,
        ({ topTeam }) => `${topTeam?.teamName || 'Das Spitzenteam'} profitiert davon, dass beide Cockpits regelmäßig stark punkten.`,
        ({ lead, latestRace }) => `${lead.driverName} hat seit ${latestRace?.grand_prix_name || 'dem letzten Grand Prix'} die Rolle des Taktgebers übernommen.`,
        ({ chase }) => `${chase.driverName} lauert darauf, dass ein kleines Ergebnisloch die Tür im Titelkampf wieder öffnet.`,
        ({ lead }) => `Der Fokus dieser Woche liegt auf ${lead.driverName}: kontrolliert, effizient und aktuell das Maß der Dinge.`,
        ({ topTeam, chase }) => `${topTeam?.teamName || 'Die Konstrukteurswertung'} und der Angriff von ${chase.driverName} sorgen gleichzeitig für Spannung an zwei Fronten.`,
        ({ latestRace }) => `${latestRace?.grand_prix_name || 'Der letzte Lauf'} hat gezeigt, wie schnell sich die Kräfteverhältnisse im Feld verschieben können.`,
        ({ lead, chase }) => `${lead.driverName} führt, doch ${chase.driverName} hält den Druck hoch und lässt keinen Spielraum für Fehler.`,
        ({ lead }) => `Die Saisongeschichte der Woche: ${lead.driverName} baut Führung über Konstanz statt über Einzelergebnisse auf.`,
        ({ chase, latestRace }) => `${chase.driverName} nimmt aus ${latestRace?.grand_prix_name || 'dem letzten Rennen'} genau das Momentum mit, das für die Aufholjagd nötig ist.`,
        ({ topTeam }) => `${topTeam?.teamName || 'Ein Spitzenteam'} setzt den Standard in der Teamwertung und prägt damit auch den Titelkampf.`,
        ({ lead, chase }) => `Jeder Punkt zählt: ${lead.driverName} gegen ${chase.driverName} ist inzwischen ein echtes Wochenend-Duell.`,
        ({ lead }) => `${lead.driverName} bleibt die Referenz, weil selbst durchschnittliche Wochenenden kaum Punkte kosten.`,
        ({ chase }) => `${chase.driverName} braucht nur ein perfektes Rennen, damit aus Spannung sofort echter Druck wird.`,
        ({ latestRace, topTeam }) => `${latestRace?.grand_prix_name || 'Der letzte Grand Prix'} hat die Diskussion um ${topTeam?.teamName || 'die Teamspitze'} neu entfacht.`,
        ({ lead, currentSeason }) => `${currentSeason?.name || 'Die Saison'} bekommt ihr Gesicht gerade durch ${lead.driverName} an der Spitze.`,
        ({ chase, topTeam }) => `${chase.driverName} und ${topTeam?.teamName || 'die Verfolger'} sind nah genug dran, um jede kleine Schwäche sofort zu bestrafen.`,
        ({ lead, latestRace }) => `${lead.driverName} nutzt ${latestRace?.grand_prix_name || 'jedes Wochenende'}, um die Rivalen unter Zugzwang zu setzen.`,
        ({ topTeam }) => `Die Konstrukteurswertung bleibt ein Schlüsselthema, weil ${topTeam?.teamName || 'das Spitzenteam'} kaum schwache Ergebnisse zulässt.`,
        ({ lead, chase }) => `Zwischen ${lead.driverName} und ${chase.driverName} trennt momentan nur ein kurzer Fehlerlauf die gesamte Geschichte der Saison.`,
        ({ latestRace }) => `Die Nachwirkung von ${latestRace?.grand_prix_name || 'dem letzten Lauf'} prägt noch immer die Diskussion rund um WM und Teamwertung.`,
        ({ lead }) => `${lead.driverName} liefert Woche für Woche die ruhigste und damit vielleicht gefährlichste Form im Feld.`,
        ({ chase }) => `${chase.driverName} bleibt in Lauerstellung und braucht nicht viel, um das Narrativ sofort zu drehen.`,
        ({ topTeam, lead }) => `${topTeam?.teamName || 'Das führende Team'} und ${lead.driverName} setzen aktuell gemeinsam die Benchmark.`,
        ({ lead, chase }) => `Die Story dieser Woche ist klar: ${lead.driverName} führt, ${chase.driverName} antwortet – und der Vorsprung bleibt lebendig.`,
        ({ latestRace, chase }) => `${latestRace?.grand_prix_name || 'Das letzte Rennen'} hat ${chase.driverName} genug Stoff für eine neue Angriffswelle geliefert.`,
        ({ lead }) => `${lead.driverName} wirkt im Moment wie der stabilste Pfeiler der gesamten Meisterschaft.`,
        ({ topTeam }) => `${topTeam?.teamName || 'Die Teamspitze'} punktet so gleichmäßig, dass jeder Ausfall der Konkurrenz doppelt weh tut.`,
        ({ lead, chase, latestRace }) => `Seit ${latestRace?.grand_prix_name || 'dem letzten Lauf'} geht es vor allem darum, ob ${chase.driverName} ${lead.driverName} noch rechtzeitig stellen kann.`,
        ({ currentSeason }) => `${currentSeason?.name || 'Diese Saison'} lebt aktuell von vielen kleinen Punktedifferenzen statt von einem einzigen dominanten Trend.`,
        ({ lead, topTeam }) => `${lead.driverName} führt die Schlagzeilen an, doch ${topTeam?.teamName || 'die Teamwertung'} erzählt parallel eine zweite große Geschichte.`,
        ({ chase }) => `Alles bleibt offen, solange ${chase.driverName} weiter konstant im vorderen Bereich anschreibt.`
      ];


      function repositionSeasonSummaryForMobile() {
        const heroSection = document.querySelector('.dashboard-hero');
        const seasonSummary = heroSection?.querySelector('.hero-side');
        const mobileAnchor = document.getElementById('mobile-season-summary-anchor');
        if (!heroSection || !seasonSummary || !mobileAnchor) return;

        if (window.innerWidth <= 760) {
          if (seasonSummary.parentElement !== mobileAnchor.parentElement || seasonSummary.previousElementSibling !== mobileAnchor) {
            mobileAnchor.after(seasonSummary);
          }
        } else if (seasonSummary.parentElement !== heroSection) {
          heroSection.appendChild(seasonSummary);
        }
      }

      function getWeeklyStoryline(context) {
        if (!context?.lead || !context?.chase) {
          return 'Sobald Ergebnisse importiert sind, erscheint hier die wichtigste Storyline der Saison.';
        }
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const week = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
        const template = WEEKLY_STORYLINE_TEMPLATES[week % WEEKLY_STORYLINE_TEMPLATES.length];
        return template(context);
      }

      function normalizeStorylineText(value) {
        return String(value || '')
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function shuffle(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      }

      function getTodayHistoricMessages() {
        const now = new Date();
        const monthDay = `${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
        return F1_ON_THIS_DAY_MOMENTS
          .filter((entry) => entry.monthDay === monthDay)
          .map((entry) => `Heute vor ${now.getUTCFullYear() - entry.year} Jahren: ${entry.text}`);
      }


      function readCachedLiveNews() {
        try {
          const raw = window.localStorage?.getItem(LIVE_NEWS_CACHE_KEY);
          if (!raw) return [];
          const payload = JSON.parse(raw);
          if (!payload?.updatedAt || !Array.isArray(payload?.items)) return [];
          if ((Date.now() - payload.updatedAt) > LIVE_NEWS_CACHE_TTL_MS) return [];
          return payload.items.filter(Boolean);
        } catch (error) {
          return [];
        }
      }

      function writeCachedLiveNews(items) {
        if (!Array.isArray(items) || !items.length) return;
        try {
          window.localStorage?.setItem(LIVE_NEWS_CACHE_KEY, JSON.stringify({
            updatedAt: Date.now(),
            items
          }));
        } catch (error) {
          // Ignore storage errors silently to keep dashboard resilient.
        }
      }

      async function fetchWithTimeout(url, options = {}, timeoutMs = LIVE_NEWS_REQUEST_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetch(url, { ...options, signal: controller.signal });
        } finally {
          window.clearTimeout(timeoutId);
        }
      }
      async function fetchRssViaJsonGateway(feedUrl) {
        const gateways = [
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=8`,
          `https://api.rss2json.io/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}&count=8`
        ];

        for (const url of gateways) {
          try {
            const response = await fetchWithTimeout(url);
            if (!response.ok) continue;
            const payload = await response.json();
            const feedItems = Array.isArray(payload?.items) ? payload.items : [];
            if (!feedItems.length) continue;
            return feedItems.map((entry) => ({
              headline: normalizeStorylineText(entry?.title),
              link: normalizeStorylineText(entry?.link),
              timestamp: entry?.pubDate ? new Date(entry.pubDate).getTime() : 0
            }));
          } catch (error) {
            console.debug('JSON-RSS Gateway nicht erreichbar', url, error);
          }
        }

        return [];
      }

      async function fetchRssViaXmlProxy(feedUrl) {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
        try {
          const response = await fetchWithTimeout(proxyUrl);
          if (!response.ok) return [];
          const xmlText = await response.text();
          const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
          if (xml.querySelector('parsererror')) return [];
          return Array.from(xml.querySelectorAll('item')).slice(0, 8).map((entry) => ({
            headline: normalizeStorylineText(entry.querySelector('title')?.textContent),
            link: normalizeStorylineText(entry.querySelector('link')?.textContent),
            timestamp: entry.querySelector('pubDate')?.textContent ? new Date(entry.querySelector('pubDate').textContent).getTime() : 0
          }));
        } catch (error) {
          console.debug('XML-Proxy für F1-News nicht erreichbar', feedUrl, error);
          return [];
        }
      }

      function toStorylineExternalMessage(entry = {}) {
        const headline = normalizeStorylineText(entry.headline);
        const link = String(entry.link || '').trim();
        return headline ? { text: headline, href: /^https?:\/\//i.test(link) ? link : '' } : null;
      }

      async function fetchRealWorldF1News(limit = 5) {
        const cachedItems = readCachedLiveNews();
        if (cachedItems.length >= limit) return cachedItems.slice(0, limit);

        const feedResults = await Promise.all(
          REAL_WORLD_F1_NEWS_FEEDS.map(async (feedUrl) => {
            const feedItems = await fetchRssViaJsonGateway(feedUrl);
            if (feedItems.length) return feedItems;
            return fetchRssViaXmlProxy(feedUrl);
          })
        );

        const items = feedResults.flat().filter((entry) => entry?.headline);
        const seenHeadlines = new Set();
        const messages = items
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .filter((entry) => {
            const normalizedHeadline = entry.headline.toLowerCase();
            if (seenHeadlines.has(normalizedHeadline)) return false;
            seenHeadlines.add(normalizedHeadline);
            return true;
          })
          .slice(0, limit)
          .map(toStorylineExternalMessage)
          .filter(Boolean);

        if (messages.length) writeCachedLiveNews(messages);
        return messages.length ? messages : cachedItems.slice(0, limit);
      }

      function buildSeasonMessages(context) {
        const messages = [];
        if (context?.lead && context?.chase) {
          messages.push(getWeeklyStoryline(context));
          messages.push(`WM-Update: ${context.lead.driverName} führt mit ${context.lead.points} Punkten vor ${context.chase.driverName} (${context.chase.points}).`);
        }
        if (context?.topTeam) {
          messages.push(`Team-Entwicklung: ${context.topTeam.teamName} setzt mit ${context.topTeam.points} Punkten den Maßstab in der Konstrukteurswertung.`);
        }
        return messages.map(normalizeStorylineText).filter(Boolean);
      }

      function buildLeagueNewsMessages(context) {
        const messages = [];

        if (context?.lead && context?.chase) {
          const gap = Number(context.lead.points || 0) - Number(context.chase.points || 0);
          messages.push(`Liga News · Titelduell: ${context.lead.driverName} vs. ${context.chase.driverName} – Abstand ${gap} Punkte.`);
        }

        if (context?.topTeam) {
          messages.push(`Liga News · Konstrukteurswertung: ${context.topTeam.teamName} führt mit ${context.topTeam.points} Punkten.`);
        }

        return messages.map(normalizeStorylineText).filter(Boolean);
      }

      async function buildStorylineTickerMessages(context, options = {}) {
        const seasonMessages = buildSeasonMessages(context);
        const leagueNewsMessages = buildLeagueNewsMessages(context);
        const historicMessages = getTodayHistoricMessages();
        const useCachedOnly = options.cachedOnly === true;
        const liveNews = useCachedOnly ? readCachedLiveNews().slice(0, 6) : await fetchRealWorldF1News(6);
        const externalLead = liveNews.slice(0, 3);
        const remainingLiveNews = liveNews.slice(3);

        const mixed = liveNews.length
          ? [...externalLead, ...leagueNewsMessages, ...shuffle([...remainingLiveNews, ...seasonMessages.slice(0, 2), ...historicMessages.slice(0, 1)])]
          : shuffle([...leagueNewsMessages, ...seasonMessages, ...historicMessages]);
        return mixed.length ? mixed : ['Storyline wird vorbereitet – sobald neue Ergebnisse und News verfügbar sind, startet die Laufschrift automatisch.'];
      }

      function renderStorylineTicker(messages) {
        const container = document.getElementById('hero-storyline');
        const a11yAnnouncer = document.getElementById('hero-storyline-a11y');
        if (!container) return;
        const unique = [];
        const seenText = new Set();
        messages.forEach((entry) => {
          if (!entry) return;
          const normalized = typeof entry === 'string'
            ? { text: normalizeStorylineText(entry), href: '' }
            : { text: normalizeStorylineText(entry.text), href: String(entry.href || '').trim() };
          if (!normalized.text || seenText.has(normalized.text)) return;
          seenText.add(normalized.text);
          unique.push(normalized);
        });
        const visibleMessages = unique.slice(0, 16);
        const loopMessages = [...visibleMessages, ...visibleMessages];
        const itemHtml = loopMessages.map((entry) => {
          const safeText = escapeHtml(entry.text);
          if (!entry.href) return `<span class="storyline-item">${safeText}</span>`;
          return `<a class="storyline-item storyline-item-link" href="${escapeHtml(entry.href)}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
        }).join('');
        const duration = Math.max(50, visibleMessages.length * 8);
        container.innerHTML = `<div class="storyline-ticker"><div class="storyline-ticker-track" style="--ticker-duration:${duration}s;">${itemHtml}</div></div>`;
        if (a11yAnnouncer && visibleMessages[0]) {
          a11yAnnouncer.textContent = `Aktuelle Storyline: ${visibleMessages[0].text}`;
        }
      }

      function initScrollAnimations() {
        const animateTargets = Array.from(document.querySelectorAll('[data-animate]:not(.is-visible)'));
        if (!animateTargets.length) return;
        if (!('IntersectionObserver' in window)) {
          animateTargets.forEach((element) => element.classList.add('is-visible'));
          return;
        }
        const observer = new IntersectionObserver((entries, currentObserver) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            currentObserver.unobserve(entry.target);
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        animateTargets.forEach((element) => observer.observe(element));
      }

      function getCountdownTarget(race) {
        if (!race) return null;
        if (race.race_start_at) {
          const explicit = new Date(race.race_start_at);
          if (!Number.isNaN(explicit.getTime())) return explicit;
        }
        if (!race.race_date) return null;
        const fallback = new Date(`${race.race_date}T20:00:00`);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
      }

      function formatCountdownDateTime(race) {
        const target = getCountdownTarget(race);
        if (!target) return 'Termin folgt';
        return new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(target);
      }

      function formatDateLong(value) {
        if (!value) return 'Termin folgt';
        const date = new Date(`${value}T20:00:00`);
        if (Number.isNaN(date.getTime())) return 'Termin folgt';
        return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(date);
      }

      function getFastestLapDriverId(rows) {
        let bestId = null;
        let bestMs = null;
        rows.forEach((row) => {
          const ms = window.RCCData.parseLapTimeToMs(row.fastest_lap_time);
          if (ms === null) return;
          if (bestMs === null || ms < bestMs) {
            bestMs = ms;
            bestId = row.driver_id;
          }
        });
        return bestId;
      }

      function getRaceHref(race) {
        if (!race) return 'ergebnisse.html';
        return `rennen-detail.html?round=${encodeURIComponent(race.round_number)}${race.season_id ? `&season=${encodeURIComponent(race.season_id)}` : ''}`;
      }

      function getDriverRecentPoints(driverId, completedRaces, resultsByRace) {
        return completedRaces.slice(-3).map((race) => {
          const row = (resultsByRace.get(race.id) || []).find((entry) => entry.driver_id === driverId);
          return Number(row?.awarded_points || 0);
        });
      }

      function createDuelMarkup(left, right, leftSubtitle, rightSubtitle, leftForm, rightForm) {
        return `
          <div class="duel-row">
            <article class="duel-entry accent-outline">
              <small>P1</small>
              <h3>${escapeHtml(left.title)}</h3>
              <div class="duel-points">${left.points} P</div>
              <div class="champion-detail">${escapeHtml(leftSubtitle)}</div>
              <div class="form-strip">${leftForm.map((value) => `<span class="form-chip">${value}</span>`).join('')}</div>
            </article>
            <div class="vs-core">
              <span>vs</span>
              <span>${Math.abs(Number(left.points || 0) - Number(right.points || 0))} P</span>
            </div>
            <article class="duel-entry violet-outline">
              <small>P2</small>
              <h3>${escapeHtml(right.title)}</h3>
              <div class="duel-points">${right.points} P</div>
              <div class="champion-detail">${escapeHtml(rightSubtitle)}</div>
              <div class="form-strip">${rightForm.map((value) => `<span class="form-chip">${value}</span>`).join('')}</div>
            </article>
          </div>
        `;
      }

      function createPodiumMarkup(entries, type) {
        if (!entries.length) return '<div class="empty-state">Noch keine Daten vorhanden.</div>';
        const [p1, p2, p3] = [entries[0], entries[1], entries[2]];
        const order = [p2, p1, p3];
        const classes = ['p2', 'p1', 'p3'];
        return order.map((entry, index) => {
          if (!entry) return '<div></div>';
          const isTeam = type === 'team';
          const title = isTeam ? entry.teamName : entry.driverName;
          const subtitle = isTeam
            ? `${entry.driver1 || '—'} / ${entry.driver2 || '—'}`
            : `${entry.leagueTeam || 'Ohne Team'} · ${entry.carName || '—'}`;
          const rank = classes[index] === 'p1' ? 1 : classes[index] === 'p2' ? 2 : 3;
          return `
            <article class="podium-column ${classes[index]}">
              <div class="podium-rank">${rank}</div>
              <h3>${escapeHtml(title)}</h3>
              <p>${escapeHtml(subtitle)}</p>
              <div class="podium-points">${entry.points} P</div>
            </article>
          `;
        }).join('');
      }

      function createRankRows(entries, type) {
        return entries.map((entry, index) => {
          const isTeam = type === 'team';
          const title = isTeam ? entry.teamName : entry.driverName;
          const subtitle = isTeam
            ? `${entry.driver1 || '—'} / ${entry.driver2 || '—'}`
            : `${entry.leagueTeam || 'Ohne Team'}`;
          return `
            <div class="driver-link-row">
              <span class="small-rank">${index + 4}</span>
              <div>
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(subtitle)}</span>
              </div>
              <strong>${entry.points} P</strong>
            </div>
          `;
        }).join('');
      }

      function renderTimeline(races) {
        const timelineEl = document.getElementById('season-timeline');
        if (!timelineEl) return;
        if (!races.length) {
          timelineEl.innerHTML = '<div class="empty-state">Noch keine Rennen angelegt.</div>';
          return;
        }
        const nextRaceId = races.find((race) => race.status === 'upcoming')?.id;
        timelineEl.innerHTML = races.map((race) => {
          const classes = [race.status === 'completed' ? 'done' : '', race.id === nextRaceId ? 'active' : ''].filter(Boolean).join(' ');
          return `
            <a class="timeline-race ${classes}" href="${getRaceHref(race)}">
              <small>Runde ${escapeHtml(race.round_number)}</small>
              <strong>${escapeHtml(race.grand_prix_name || 'Grand Prix')}</strong>
              <span>${formatDateLong(race.race_date)}<br>${escapeHtml(window.formatStatusLabel(race.status))}</span>
            </a>
          `;
        }).join('');
      }

      function renderChart(topDrivers, completedRaces, resultsByRace, driversById) {
        const container = document.getElementById('points-chart-container');
        const legend = document.getElementById('points-chart-legend');
        if (!container || !legend) return;

        if (!topDrivers.length || !completedRaces.length) {
          container.innerHTML = '<div class="empty-state">Für das Diagramm werden gefahrene Rennen benötigt.</div>';
          legend.innerHTML = '';
          return;
        }

        const width = 960;
        const height = 320;
        const pad = { top: 20, right: 20, bottom: 38, left: 42 };
        const innerW = width - pad.left - pad.right;
        const innerH = height - pad.top - pad.bottom;

        const series = topDrivers.map((entry, index) => {
          let total = 0;
          const points = completedRaces.map((race) => {
            const row = (resultsByRace.get(race.id) || []).find((item) => item.driver_id === entry.driverId);
            total += Number(row?.awarded_points || 0);
            return { xLabel: `R${race.round_number}`, value: total };
          });
          return {
            name: entry.driverName,
            color: ACCENT_COLORS[index % ACCENT_COLORS.length],
            points
          };
        });

        const maxValue = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.value)));
        const xStep = completedRaces.length > 1 ? innerW / (completedRaces.length - 1) : innerW / 2;

        const gridLines = [0, .25, .5, .75, 1].map((ratio) => {
          const y = pad.top + innerH - innerH * ratio;
          const value = Math.round(maxValue * ratio);
          return `<g><line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="rgba(255,255,255,0.12)" stroke-width="1" /><text x="10" y="${y + 4}" fill="rgba(255,255,255,0.6)" font-size="12">${value}</text></g>`;
        }).join('');

        const paths = series.map((line) => {
          const path = line.points.map((point, idx) => {
            const x = pad.left + xStep * idx;
            const y = pad.top + innerH - (point.value / maxValue) * innerH;
            return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ');

          const dots = line.points.map((point, idx) => {
            const x = pad.left + xStep * idx;
            const y = pad.top + innerH - (point.value / maxValue) * innerH;
            return `<circle cx="${x}" cy="${y}" r="4" fill="${line.color}" />`;
          }).join('');

          return `<path d="${path}" fill="none" stroke="${line.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />${dots}`;
        }).join('');

        const xLabels = completedRaces.map((race, idx) => {
          const x = pad.left + xStep * idx;
          return `<text x="${x}" y="${height - 10}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="12">R${race.round_number}</text>`;
        }).join('');

        container.innerHTML = `
          <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Punkteverlauf Top 5 Fahrer">
            ${gridLines}
            <line x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
            ${paths}
            ${xLabels}
          </svg>
        `;

        legend.innerHTML = series.map((item) => `
          <span class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span>${escapeHtml(item.name)}</span>
        `).join('');
      }

      function startCountdown(race) {
        const grid = document.getElementById('hero-countdown-grid');
        const copy = document.getElementById('hero-countdown-copy');
        if (!grid || !copy) return;

        if (countdownTimer) clearInterval(countdownTimer);
        if (!race?.race_date) {
          copy.textContent = 'Kein kommendes Rennen terminiert.';
          return;
        }

        const target = getCountdownTarget(race) || new Date();
        const render = () => {
          const diff = target.getTime() - Date.now();
          if (diff <= 0) {
            copy.textContent = `${race.grand_prix_name} läuft oder ist gestartet.`;
            grid.innerHTML = `
              <div class="countdown-item"><strong>00</strong><span>Tage</span></div>
              <div class="countdown-item"><strong>00</strong><span>Std</span></div>
              <div class="countdown-item"><strong>00</strong><span>Min</span></div>
              <div class="countdown-item"><strong>00</strong><span>Sek</span></div>
            `;
            if (countdownTimer) {
              clearInterval(countdownTimer);
              countdownTimer = null;
            }
            if (!countdownRefreshTriggered) {
              countdownRefreshTriggered = true;
              window.setTimeout(() => {
                loadDashboard();
              }, 500);
            }
            return;
          }

          const totalSeconds = Math.floor(diff / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          copy.textContent = `${race.grand_prix_name} · ${formatCountdownDateTime(race)}`;
          grid.innerHTML = `
            <div class="countdown-item"><strong>${String(days).padStart(2, '0')}</strong><span>Tage</span></div>
            <div class="countdown-item"><strong>${String(hours).padStart(2, '0')}</strong><span>Std</span></div>
            <div class="countdown-item"><strong>${String(minutes).padStart(2, '0')}</strong><span>Min</span></div>
            <div class="countdown-item"><strong>${String(seconds).padStart(2, '0')}</strong><span>Sek</span></div>
          `;
        };
        render();
        countdownTimer = window.setInterval(render, 1000);
      }

      async function loadStewardCount() {
        try {
          const { count, error } = await window.supabaseClient
            .from('steward_cases')
            .select('*', { count: 'exact', head: true });
          if (error) throw error;
          document.getElementById('status-stewards').textContent = count ? `${count} Fälle protokolliert` : 'Keine Fälle hinterlegt';
        } catch (error) {
          console.error(error);
          document.getElementById('status-stewards').textContent = 'Status nicht verfügbar';
        }
      }

      async function loadAdminSession() {
        const adminStatusEl = document.getElementById('status-admin');
        const adminStatusDotEl = document.getElementById('status-admin-dot');
        try {
          const { data, error } = await window.supabaseClient.auth.getSession();
          if (error) throw error;
          const isAdminSessionActive = Boolean(data.session?.user?.email);
          if (adminStatusEl) {
            adminStatusEl.textContent = isAdminSessionActive ? 'aktiv' : 'inaktiv';
          }
          if (adminStatusDotEl) {
            adminStatusDotEl.classList.toggle('inactive', !isAdminSessionActive);
          }
        } catch (error) {
          console.error(error);
          if (adminStatusEl) {
            adminStatusEl.textContent = 'inaktiv';
          }
          if (adminStatusDotEl) {
            adminStatusDotEl.classList.add('inactive');
          }
        }
      }

      async function loadDashboard() {
        countdownRefreshTriggered = false;
        try {
          const currentSeason = await window.RCCData.fetchCurrentSeason();
          const [drivers, races, raceResults, assignments] = await Promise.all([
            window.RCCData.fetchDrivers(),
            window.RCCData.fetchRaces({ seasonId: currentSeason?.id }),
            window.RCCData.fetchRaceResults(),
            window.RCCDriverContext.fetchDriverSeasonAssignments({ seasonId: currentSeason?.id })
          ]);
          const racesWithLifecycle = races.map((race) => ({
            ...race,
            status: window.getRaceLifecycleStatus ? window.getRaceLifecycleStatus(race) : race.status
          }));

          const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
          const resultsByRace = raceResults.reduce((map, row) => {
            if (!map.has(row.race_id)) map.set(row.race_id, []);
            map.get(row.race_id).push(row);
            return map;
          }, new Map());

          const completedRaces = racesWithLifecycle.filter((race) => race.status === 'completed');
          const upcomingRaces = racesWithLifecycle.filter((race) => race.status === 'upcoming');
          const nextRace = upcomingRaces[0] || null;
          const latestRace = completedRaces.slice().sort((a, b) => Number(b.round_number) - Number(a.round_number))[0] || null;
          const resolver = window.RCCDriverContext.createAssignmentResolver({ drivers, races: racesWithLifecycle, assignments });
          const standings = window.RCCData.buildStandings({ drivers, races: racesWithLifecycle, raceResults, resolver });
          const driverStandings = standings.driverStandings;
          const teamStandings = standings.teamStandings;

          document.getElementById('status-season').textContent = currentSeason?.name ? `${currentSeason.name} aktiv` : 'Saison aktiv';
          const nextTwoRaces = upcomingRaces.slice(0, 2);
          const statusNextEventEl = document.getElementById('status-next-event');
          if (statusNextEventEl) {
            statusNextEventEl.textContent = nextTwoRaces.length
              ? nextTwoRaces.map((race) => race.grand_prix_name || `Runde ${race.round_number}`).join(', ')
              : 'Keine kommenden Rennen';
          }

          const heroNextRaceEl = document.getElementById('hero-next-race');
          if (heroNextRaceEl) {
            heroNextRaceEl.innerHTML = nextTwoRaces.length ? nextTwoRaces.map((race, index) => {
              const meta = window.getRaceTrackMeta ? window.getRaceTrackMeta(race) : { track: null };
              const calendarHref = `kalender.html?season=${encodeURIComponent(race.season_id || currentSeason?.id || '')}&round=${encodeURIComponent(race.round_number || '')}`;
              return `
                <a class="next-race-link" href="${calendarHref}">
                  <article class="next-race-item ${index > 0 ? 'next-race-item-stacked' : ''}">
                  <div class="showcase-meta">
                    ${window.createFlagBadge ? window.createFlagBadge(meta.track?.countryCode, race.grand_prix_name) : '<span class="flag-badge flag-badge-fallback">🏁</span>'}
                  </div>
                  <div class="card-label">Runde ${escapeHtml(race.round_number)}</div>
                  <h2 style="margin:0;font-size:${index === 0 ? '2rem' : '1.45rem'};">${escapeHtml(race.grand_prix_name || 'Grand Prix')}</h2>
                  <div class="champion-detail" style="margin-top:8px;">
                    ${escapeHtml(race.circuit_name || meta.track?.circuitName || 'Strecke offen')}<br>
                    ${formatDateLong(race.race_date)}
                  </div>
                </article>
                </a>
              `;

            }).join('') : '<div class="empty-state">Aktuell sind keine kommenden Rennen im Kalender eingetragen.</div>';
          }

          startCountdown(nextRace);

          document.getElementById('side-kpis').innerHTML = `
            <div class="side-kpi"><span>Rennen</span><strong>${racesWithLifecycle.length}</strong></div>
            <div class="side-kpi"><span>Gefahren</span><strong>${completedRaces.length}</strong></div>
            <div class="side-kpi"><span>Offen</span><strong>${upcomingRaces.length}</strong></div>
            <div class="side-kpi"><span>Fahrer</span><strong>${drivers.length}</strong></div>
            <div class="side-kpi"><span>Teams</span><strong>${teamStandings.length}</strong></div>
            <div class="side-kpi"><span>Saisonrunde</span><strong>${nextRace?.round_number || racesWithLifecycle.length || '-'}</strong></div>
          `;

          const storylineContext = {
            lead: driverStandings[0],
            chase: driverStandings[1],
            currentSeason,
            latestRace,
            nextRace,
            topTeam: teamStandings[0],
            completedRaces
          };
          renderStorylineTicker(await buildStorylineTickerMessages(storylineContext, { cachedOnly: true }));
          renderStorylineTicker(await buildStorylineTickerMessages(storylineContext));
          if (storylineRefreshTimer) window.clearInterval(storylineRefreshTimer);
          storylineRefreshTimer = window.setInterval(async () => {
            renderStorylineTicker(await buildStorylineTickerMessages(storylineContext));
          }, 120000);

          if (latestRace) {
            const latestRows = (resultsByRace.get(latestRace.id) || []).slice().sort((a, b) => Number(a.finish_position || 999) - Number(b.finish_position || 999));
            const latestFastestDriverId = getFastestLapDriverId(latestRows);
            const winner = driversById.get(latestRows[0]?.driver_id);
            const fastestDriver = driversById.get(latestFastestDriverId);
            const p2 = driversById.get(latestRows[1]?.driver_id);
            const p3 = driversById.get(latestRows[2]?.driver_id);
            (document.getElementById('latest-race-winner')).textContent = winner?.display_name || latestRace.grand_prix_name;
            (document.getElementById('latest-race-highlight')).innerHTML = `${escapeHtml(latestRace.grand_prix_name)} ist das letzte gewertete Rennen. <strong>FL:</strong> ${escapeHtml(fastestDriver?.display_name || '—')}.`;
            (document.getElementById('latest-race-title')).textContent = latestRace.grand_prix_name;
            (document.getElementById('latest-race-link')).href = getRaceHref(latestRace);
            (document.getElementById('latest-race-summary')).innerHTML = `
              <strong>${escapeHtml(latestRace.grand_prix_name)}</strong> wurde am ${formatDateLong(latestRace.race_date)} gefahren. Sieger war <strong>${escapeHtml(winner?.display_name || 'Unbekannt')}</strong>, die schnellste Runde holte <strong>${escapeHtml(fastestDriver?.display_name || '—')}</strong>.
            `;
            (document.getElementById('latest-race-podium')).innerHTML = `
              <article class="podium-card-lite silver"><div class="place">2</div><strong>${escapeHtml(p2?.display_name || '—')}</strong><span>${latestRows[1] ? window.RCCData.getAwardedRacePoints(latestRows[1], latestFastestDriverId) : 0} Punkte</span></article>
              <article class="podium-card-lite gold"><div class="place">1</div><strong>${escapeHtml(winner?.display_name || '—')}</strong><span>${latestRows[0] ? window.RCCData.getAwardedRacePoints(latestRows[0], latestFastestDriverId) : 0} Punkte</span></article>
              <article class="podium-card-lite bronze"><div class="place">3</div><strong>${escapeHtml(p3?.display_name || '—')}</strong><span>${latestRows[2] ? window.RCCData.getAwardedRacePoints(latestRows[2], latestFastestDriverId) : 0} Punkte</span></article>
            `;
            (document.getElementById('latest-race-facts')).innerHTML = `
              <div class="fact-card"><span>Sieger</span><strong>${escapeHtml(winner?.display_name || '—')}</strong></div>
              <div class="fact-card"><span>FL</span><strong>${escapeHtml(fastestDriver?.display_name || '—')}</strong></div>
              <div class="fact-card"><span>Pole / P1</span><strong>${escapeHtml(winner?.display_name || '—')}</strong></div>
              <div class="fact-card"><span>Gewertet</span><strong>${latestRows.length}</strong></div>
            `;
          } else {
            (document.getElementById('latest-race-winner')).textContent = 'Noch kein Sieger';
            (document.getElementById('latest-race-highlight')).textContent = 'Sobald ein Rennen abgeschlossen ist, erscheinen hier die Highlights.';
          }

          if (driverStandings.length >= 2) {
            const lead = driverStandings[0];
            const chase = driverStandings[1];
            (document.getElementById('driver-gap-badge')).textContent = `Gap · ${lead.points - chase.points} Punkte`;
            (document.getElementById('driver-battle')).innerHTML = createDuelMarkup(
              { title: lead.driverName, points: lead.points },
              { title: chase.driverName, points: chase.points },
              `${lead.leagueTeam || 'Ohne Team'} · ${lead.wins} Siege · ${lead.fastestLaps} FL`,
              `${chase.leagueTeam || 'Ohne Team'} · ${chase.wins} Siege · ${chase.fastestLaps} FL`,
              getDriverRecentPoints(lead.driverId, completedRaces, resultsByRace),
              getDriverRecentPoints(chase.driverId, completedRaces, resultsByRace)
            );
          }

          if (teamStandings.length >= 2) {
            const leadTeam = teamStandings[0];
            const chaseTeam = teamStandings[1];
            (document.getElementById('team-gap-badge')).textContent = `Gap · ${leadTeam.points - chaseTeam.points} Punkte`;
            const teamDriverIds = new Map(driverStandings.map((driver) => [driver.driverName, driver.driverId]));
            const leadRecent = [leadTeam.driver1, leadTeam.driver2].flatMap((name) => teamDriverIds.has(name) ? [getDriverRecentPoints(teamDriverIds.get(name), completedRaces, resultsByRace)] : []).flat();
            const chaseRecent = [chaseTeam.driver1, chaseTeam.driver2].flatMap((name) => teamDriverIds.has(name) ? [getDriverRecentPoints(teamDriverIds.get(name), completedRaces, resultsByRace)] : []).flat();
            const summarize = (values) => {
              const groups = values.length ? Array.from({ length: Math.ceil(values.length / 2) }, (_, i) => values[i * 2] + (values[i * 2 + 1] || 0)) : [0, 0, 0];
              return groups.slice(-3);
            };
            (document.getElementById('team-battle')).innerHTML = createDuelMarkup(
              { title: leadTeam.teamName, points: leadTeam.points },
              { title: chaseTeam.teamName, points: chaseTeam.points },
              `${leadTeam.driver1 || '—'} / ${leadTeam.driver2 || '—'}`,
              `${chaseTeam.driver1 || '—'} / ${chaseTeam.driver2 || '—'}`,
              summarize(leadRecent),
              summarize(chaseRecent)
            );
          }

          document.getElementById('driver-podium').innerHTML = createPodiumMarkup(driverStandings.slice(0, 3), 'driver');
          document.getElementById('driver-podium-list').innerHTML = createRankRows(driverStandings.slice(3, 8), 'driver');
          document.getElementById('team-podium').innerHTML = createPodiumMarkup(teamStandings.slice(0, 3), 'team');
          document.getElementById('team-podium-list').innerHTML = createRankRows(teamStandings.slice(3, 8), 'team');

          renderTimeline(racesWithLifecycle);
          renderChart(driverStandings.slice(0, 5), completedRaces, resultsByRace, driversById);
          initScrollAnimations();
        } catch (error) {
          console.error(error);
          document.getElementById('hero-next-race').innerHTML = '<div class="empty-state">Fehler beim Laden der Startseite.</div>';
          renderStorylineTicker(['Dashboard konnte nicht geladen werden. Bitte Seite aktualisieren.']);
          initScrollAnimations();
        } finally {
          document.dispatchEvent(new CustomEvent('dashboard:content-ready'));
        }
      }

      document.addEventListener('DOMContentLoaded', () => {
        initScrollAnimations();
        loadDashboard();
        loadStewardCount();
        loadAdminSession();
      });
    })();
  
