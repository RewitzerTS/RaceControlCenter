# Mobile App Audit (iOS/Android Fokus) – Race Control Center

Datum: 2026-05-09

## Kurzfazit
Das Projekt hat bereits eine solide Basis (PWA-Meta-Tags, responsive Layout, Caching-Ansätze, visuelle Konsistenz). Für ein deutlich „appigeres“ Erlebnis auf iOS/Android sind die größten Hebel:

1. **Perceived Performance verbessern** (Loader-Strategie, Script-Loading, Critical Path).
2. **Mobile Navigation vereinfachen** (Header-Höhe, Touch-Ziele, Informationsdichte).
3. **Accessibility & Robustheit** (Keyboard/Screenreader-Flows, Motion/Contrast).
4. **Asset- und Runtime-Optimierung** (Bilder, Fonts, JS-Aufteilung, Netzwerkanfragen).

---

## 1) Layout & UI (Mobile First)

### Beobachtungen
- Header/Brand wirkt auf kleinen Geräten sehr dominant (großes Logo, hoher Sticky-Header).
- Dashboard enthält viele gleichzeitige „Cards“ und Status-Elemente; auf kleinen Displays kann das visuell überladen wirken.
- CTA-Pfade sind vorhanden, aber teilweise konkurrieren mehrere primäre Aktionen in einer Sichtachse.

### Empfehlungen
- **Kompakter Mobile-Header**:
  - Logo auf Mobile deutlich verkleinern (z. B. 32–40 px), reduzierte vertikale Höhe.
  - Sticky-Header-Höhe auf Mobile minimieren, damit mehr Content „above the fold“ sichtbar ist.
- **Progressive Disclosure**:
  - Auf Smartphones zunächst 1 Haupt-Story (Next Race + Countdown), Podiums/Detailblöcke darunter einklappbar.
- **Klares CTA-Hierarchy-Modell**:
  - Pro Viewport nur **eine** primäre Aktion prominent (z. B. „Kalender öffnen“), sekundäre als Text/Outline.
- **Spacing- und Typo-Skalen**:
  - Mobile spezifisch 4/8/12/16-Spacing-System härter durchziehen; Line-Height bei dichten Cards leicht erhöhen.

---

## 2) UX-Flows

### Beobachtungen
- Start-Splash + zusätzlicher Loader können subjektiv wie „doppelte Wartezeit“ wirken.
- Viele Inhalte laden dynamisch mit „Wird geladen…“-Platzhaltern.

### Empfehlungen
- **Splash reduzieren**:
  - Nur beim **allerersten App-Start** oder bei echter Cold-Start-Latenz zeigen.
  - Bei warmem Cache Splash komplett skippen.
- **Skeleton statt Text-Platzhalter**:
  - Cards mit Skeleton-Shimmer statt mehrfacher „Wird geladen…“-Texte → ruhiger und moderner Eindruck.
- **State-Handling vereinheitlichen**:
  - Für jede Hauptsektion definieren: `loading`, `empty`, `error`, `ready` mit konsistentem UI.
- **Fehlertexte mit Recovery**:
  - Immer Retry-Button + kurzer Grund (offline/timeout/auth).

---

## 3) Ladezeiten & Performance

### Beobachtungen
- Mehrere Skripte sind nicht `defer` geladen; bei Mobile/3G kann das Rendering blockieren.
- Google Font wird per CSS `@import` geladen (langsamer als `<link rel="preconnect"> + <link rel="stylesheet">`).
- Loader wartet unter anderem auf Bilder und Fonts; das kann „First Interaction“ verzögern.

### Empfehlungen (High Impact)
- **Script-Loading modernisieren**:
  - Alle nicht-kritischen Skripte auf `defer`/`type="module"` umstellen.
  - Page-spezifische Bundles nur auf der jeweiligen Seite laden.
- **Font-Optimierung**:
  - `@import` vermeiden, stattdessen `<link rel="preconnect">` + `<link>` im Head.
  - Falls möglich, Self-Hosting + `font-display: swap`.
- **Hero-/Logo-Asset prüfen**:
  - 1024x1024-Logo für Splash ist für viele Geräte unnötig groß; WebP/AVIF oder kleinere Varianten ausliefern.
- **Critical Rendering Path**:
  - Minimal-CSS inline für first viewport, Rest nachladen.
  - Große dekorative Hintergründe optional auf low-end devices reduzieren.
- **Caching / SW-Strategie**:
  - Stale-while-revalidate für statische Assets + API Responses mit sinnvoller TTL.
  - Versioniertes Cache Busting bei Deployments.

---

## 4) iOS-/Android-spezifische Punkte

- **Safe Areas** sind schon bedacht; zusätzlich testen:
  - iOS Dynamic Island Geräte, Android Gesture Navigation, Landscape.
- **Haptik/Feedback** (optional via Capacitor später):
  - Kurzes Feedback bei wichtigen Aktionen (Save, Publish).
- **Installability-Prompt**:
  - Eigenen, unaufdringlichen Install-Hinweis nach 2–3 Sessions.
- **Offline UX**:
  - Klar sichtbarer Offline-Banner + letzte bekannte Daten „Stand: Uhrzeit“.

---

## 5) Accessibility (A11y)

- **Reduced Motion** wird teils berücksichtigt; ausweiten auf alle größeren Animationen.
- **Kontrastprüfung** (Dark/Light Theme) für sekundäre Texte/Badges.
- **Fokuszustände** für Tastatur/Assistive Tech auf allen interaktiven Elementen.
- **Live Regions sparsam** nutzen, damit Screenreader nicht mit Statusupdates überflutet werden.

---

## 6) Priorisierte Roadmap

### Sprint 1 (1–2 Tage)
1. Header auf Mobile komprimieren.
2. Doppelte Loader-Logik entschärfen (Splash nur bei echtem Cold Start).
3. Alle Scripts auf `defer`/seitenbezogenes Laden prüfen.
4. Font-Ladeweg auf `<link>`-Variante umstellen.

### Sprint 2 (2–4 Tage)
1. Skeleton-States für Dashboard-Kernkomponenten.
2. Einheitliche Error/Empty-Komponenten mit Retry.
3. Bild-/Asset-Compression-Pipeline (AVIF/WebP, responsive sizes).

### Sprint 3 (3–5 Tage)
1. Service-Worker Caching-Strategie verfeinern.
2. A11y-Pass (Kontrast, Fokus, Screenreader-Flow).
3. Performance-Budget + CI-Lighthouse (mobile profile).

---

## KPI-Ziele (messbar)

- **LCP Mobile**: < 2.5s (4G, Mid-tier Android)
- **INP**: < 200ms
- **CLS**: < 0.1
- **Time to Interactive**: < 3.0s
- **Error Recovery Success** (Retry): > 95%

