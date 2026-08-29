import { useId, type CSSProperties } from 'react';
import { useI18n } from '../i18n/I18nProvider';

type LevelGaugeProps = {
  balance: number;
  level: number;
  lifetimeXp: number;
  progress: number;
  rank: string;
  xpIntoLevel: number;
  xpToNextLevel: number;
};

function gaugePoint(radius: number, degrees: number) {
  const angle = degrees * Math.PI / 180;
  return {
    x: 300 + radius * Math.cos(angle),
    y: 294 + radius * Math.sin(angle),
  };
}

export function LevelGauge({
  balance,
  level,
  lifetimeXp,
  progress,
  rank,
  xpIntoLevel,
  xpToNextLevel,
}: LevelGaugeProps) {
  const { formatNumber, t } = useI18n();
  const rawId = useId().replaceAll(':', '');
  const arcGradientId = `level-gauge-arc-${rawId}`;
  const needleGradientId = `level-gauge-needle-${rawId}`;
  const safeProgress = Math.max(0, Math.min(100, progress));
  const roundedProgress = Math.round(safeProgress);
  const isMaxLevel = level >= 100;
  const nextLevel = isMaxLevel ? level : level + 1;
  const levelTarget = Math.max(0, xpIntoLevel) + Math.max(0, xpToNextLevel);
  const needleStyle = {
    '--level-gauge-angle': `${-180 + safeProgress * 1.8}deg`,
  } as CSSProperties;
  const arcStyle = {
    '--level-gauge-progress': safeProgress,
  } as CSSProperties;

  const ticks = Array.from({ length: 41 }, (_, index) => {
    const angle = 180 + index * 4.5;
    const value = index * 2.5;
    const major = index % 10 === 0;
    const medium = !major && index % 5 === 0;
    const inner = gaugePoint(major ? 238 : medium ? 244 : 250, angle);
    const outer = gaugePoint(major ? 265 : medium ? 262 : 258, angle);
    const className = [
      'level-gauge-tick',
      major && 'level-gauge-tick--major',
      medium && 'level-gauge-tick--medium',
      value <= safeProgress && 'level-gauge-tick--active',
    ].filter(Boolean).join(' ');
    return <line className={className} key={index} x1={inner.x} x2={outer.x} y1={inner.y} y2={outer.y} />;
  });

  const scaleLabels = [0, 25, 50, 75, 100].map((value) => {
    const position = gaugePoint(213, 180 + value * 1.8);
    return <text className="level-gauge-scale-label" key={value} x={position.x} y={position.y}>{value}</text>;
  });

  return (
    <article className="dashboard-card level-gauge-card" aria-labelledby={`level-gauge-title-${rawId}`}>
      <header className="level-gauge-header">
        <span className="level-gauge-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 16a8 8 0 0 1 16 0" /><path d="m12 15 4-5" /><circle cx="12" cy="16" r="1.5" /></svg>
        </span>
        <div>
          <h2 id={`level-gauge-title-${rawId}`}>{t('home.levelGaugeTitle')}</h2>
          <p>{t('home.levelRank', { level, rank })}</p>
        </div>
        <div className="level-gauge-meta">
          <span className="level-gauge-pill level-gauge-pill--progress"><i aria-hidden="true" />{roundedProgress}%</span>
          <span className="level-gauge-pill level-gauge-pill--balance">{formatNumber(balance)} VC</span>
        </div>
      </header>

      <div className="level-gauge-instrument">
        <div className="level-gauge-topline">
          <span><i className="level-gauge-dot" aria-hidden="true" />{t('home.levelShort', { level })}</span>
          <b>{t('home.levelCollected', { xp: formatNumber(xpIntoLevel) })}</b>
          <span>{t('home.levelShort', { level: nextLevel })}<i className="level-gauge-dot level-gauge-dot--target" aria-hidden="true" /></span>
        </div>
        <progress aria-label={t('home.xpProgress')} className="visually-hidden" max={100} value={safeProgress}>{roundedProgress}%</progress>
        <svg
          aria-label={t('home.levelGaugeAria', { level, nextLevel, progress: roundedProgress })}
          className="level-gauge"
          role="img"
          viewBox="0 0 600 372"
        >
          <title>{t('home.levelGaugeAria', { level, nextLevel, progress: roundedProgress })}</title>
          <defs>
            <linearGradient id={arcGradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--brand-accent)" />
              <stop offset=".5" stopColor="var(--brand-accent-2)" />
              <stop offset="1" stopColor="var(--brand-primary)" />
            </linearGradient>
            <linearGradient id={needleGradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="var(--brand-text)" />
              <stop offset=".65" stopColor="var(--brand-accent)" />
              <stop offset="1" stopColor="var(--brand-primary)" />
            </linearGradient>
          </defs>
          <path className="level-gauge-outer" d="M 60 294 A 240 240 0 0 1 540 294" />
          <path className="level-gauge-track" d="M 60 294 A 240 240 0 0 1 540 294" pathLength="100" />
          <path
            className="level-gauge-arc"
            d="M 60 294 A 240 240 0 0 1 540 294"
            pathLength="100"
            stroke={`url(#${arcGradientId})`}
            style={arcStyle}
          />
          <g>{ticks}</g>
          <g>{scaleLabels}</g>
          <text className="level-gauge-level-label" x="300" y="165">LEVEL</text>
          <text className="level-gauge-level-number" x="300" y="230">{level}</text>
          <path
            className="level-gauge-needle"
            d="M 286 289 L 486 294 L 286 299 Z"
            fill={`url(#${needleGradientId})`}
            style={needleStyle}
          />
          <circle className="level-gauge-hub-ring" cx="300" cy="294" r="22" />
          <circle className="level-gauge-hub-core" cx="300" cy="294" r="9" />
          <circle className="level-gauge-hub-highlight" cx="297" cy="291" r="3" />
          <text className="level-gauge-percentage" x="300" y="345">{roundedProgress}%</text>
        </svg>
      </div>

      <footer className="level-gauge-stats">
        <div><span>{t('home.currentXp')}</span><strong>{formatNumber(xpIntoLevel)}</strong><small>{t('home.currentLevel', { level })}</small></div>
        <i aria-hidden="true" />
        <div><span>{t('home.requiredXp')}</span><strong>{formatNumber(xpToNextLevel)}</strong><small>{isMaxLevel ? t('immortal') : t('home.untilPromotion')}</small></div>
        <i aria-hidden="true" />
        <div><span>{t('home.levelTarget')}</span><strong>{formatNumber(levelTarget)}</strong><small>{t('home.totalXp')}</small></div>
      </footer>
      <p className="level-gauge-lifetime">{formatNumber(lifetimeXp)} {t('home.lifetimeXp')}</p>
    </article>
  );
}
