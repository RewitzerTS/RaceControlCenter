import { useId, type CSSProperties, type ReactNode } from 'react';

const ACHIEVEMENT_GROUPS = {
  starts: [1, 5, 10, 25, 50, 100, 200, 300, 500, 1000],
  wins: [1, 3, 5, 10, 25, 50, 100, 200],
  podiums: [1, 5, 10, 25, 50, 100, 200, 500],
  poles: [1, 5, 10, 25, 50, 100, 250],
  fastest_laps: [1, 5, 10, 25, 50, 100, 250],
  classified_finishes: [1, 10, 25, 50, 100, 250, 500],
  leagues_competed: [2, 3, 5],
  podiums_after_dnf: [1],
  wins_after_dnf: [1],
  wins_after_two_dnfs: [1],
  perfect_weekends: [1],
  wins_from_grid_10: [1],
  podiums_from_grid_15: [1],
  win_streak: [3],
  classified_streak: [5],
  pole_streak: [3],
  fastest_lap_streak: [3],
  first_race_wins: [1],
} as const;

export const ACHIEVEMENT_BADGE_CODES = Object.entries(ACHIEVEMENT_GROUPS).flatMap(([metric, thresholds]) =>
  thresholds.map((threshold) => `${metric}_${threshold}`),
);

const METRIC_LABELS: Record<string, string> = {
  starts: 'START',
  wins: 'WIN',
  podiums: 'PODIUM',
  poles: 'POLE',
  fastest_laps: 'FAST',
  classified_finishes: 'FINISH',
  leagues_competed: 'LEAGUE',
  podiums_after_dnf: 'RISE',
  wins_after_dnf: 'BACK',
  wins_after_two_dnfs: 'PHX',
  perfect_weekends: 'TRIPLE',
  wins_from_grid_10: 'CHARGE',
  podiums_from_grid_15: 'SAVE',
  win_streak: 'STREAK',
  classified_streak: 'CONSIST',
  pole_streak: 'POLES',
  fastest_lap_streak: 'FAST',
  first_race_wins: 'DEBUT',
};

const METRIC_HUES: Record<string, string> = {
  starts: 'var(--brand-accent)',
  wins: 'var(--brand-primary)',
  podiums: 'var(--brand-secondary)',
  poles: 'var(--brand-accent-2)',
  fastest_laps: 'var(--brand-accent)',
  classified_finishes: 'var(--brand-primary)',
  leagues_competed: 'var(--brand-secondary)',
  podiums_after_dnf: 'var(--brand-accent-2)',
  wins_after_dnf: 'var(--brand-primary)',
  wins_after_two_dnfs: 'var(--brand-secondary)',
  perfect_weekends: 'var(--brand-accent)',
  wins_from_grid_10: 'var(--brand-primary)',
  podiums_from_grid_15: 'var(--brand-secondary)',
  win_streak: 'var(--brand-primary)',
  classified_streak: 'var(--brand-accent)',
  pole_streak: 'var(--brand-accent-2)',
  fastest_lap_streak: 'var(--brand-secondary)',
  first_race_wins: 'var(--brand-primary)',
};

function MetricIcon({ metric }: { metric: string }): ReactNode {
  switch (metric) {
    case 'starts':
      return <><path d="M28 42V22" /><path d="M29 23h20l-4 6 4 6H29" /><path d="M34 23v12M40 23v12M46 23v12M29 29h18" /></>;
    case 'wins':
    case 'wins_after_dnf':
    case 'wins_after_two_dnfs':
    case 'win_streak':
    case 'first_race_wins':
      return <><path d="M31 23h16v7c0 7-3 11-8 13-5-2-8-6-8-13z" /><path d="M31 26h-5c0 6 2 9 7 10M47 26h5c0 6-2 9-7 10M39 43v5M32 48h14" /></>;
    case 'podiums':
    case 'podiums_after_dnf':
    case 'podiums_from_grid_15':
      return <><path d="M25 39h9v9h-9zM34 28h10v20H34zM44 35h9v13h-9z" /><path d="M38 33h2M28 43h2M47 40h2" /></>;
    case 'poles':
    case 'pole_streak':
      return <><circle cx="39" cy="34" r="13" /><circle cx="39" cy="34" r="4" /><path d="M39 21v9M27 30l8 3M51 30l-8 3M31 44l5-7M47 44l-5-7" /></>;
    case 'fastest_laps':
    case 'fastest_lap_streak':
      return <path d="M42 19 28 38h10l-3 13 15-21H40z" />;
    case 'classified_finishes':
    case 'classified_streak':
      return <><circle cx="39" cy="34" r="14" /><path d="m31 34 5 5 11-12" /></>;
    case 'leagues_competed':
      return <><circle cx="39" cy="34" r="14" /><path d="M25 34h28M39 20c5 5 7 9 7 14s-2 10-7 14c-5-4-7-9-7-14s2-9 7-14z" /></>;
    case 'perfect_weekends':
      return <><path d="m39 20 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" /><circle cx="39" cy="34" r="15" /></>;
    case 'wins_from_grid_10':
      return <><path d="M25 45 50 20M37 20h13v13" /><path d="M25 38v7h7" /></>;
    default:
      return <circle cx="39" cy="34" r="12" />;
  }
}

interface AchievementBadgeProps {
  code: string;
  metric: string;
  threshold: number;
  title: string;
}

export function AchievementBadge({ code, metric, threshold, title }: AchievementBadgeProps) {
  const rawId = useId();
  const clipId = `achievement-badge-${rawId.replaceAll(':', '')}`;
  const thresholds = ACHIEVEMENT_GROUPS[metric as keyof typeof ACHIEVEMENT_GROUPS] as readonly number[] | undefined;
  const tierIndex = Math.max(0, thresholds?.indexOf(threshold) ?? 0);
  const tierProgress = thresholds && thresholds.length > 1 ? tierIndex / (thresholds.length - 1) : 0;
  const badgeStyle = {
    '--badge-hue': METRIC_HUES[metric] ?? 'var(--brand-accent)',
    '--badge-tier': tierProgress,
  } as CSSProperties;

  return (
    <svg
      aria-label={`${title}: ${threshold}`}
      className="achievement-badge"
      data-achievement-code={code}
      role="img"
      style={badgeStyle}
      viewBox="0 0 78 92"
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <path d="M39 2 70 14v42c0 17-12 27-31 34C20 83 8 73 8 56V14z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path className="achievement-badge__field" d="M39 2 70 14v42c0 17-12 27-31 34C20 83 8 73 8 56V14z" />
        <path className="achievement-badge__flare" d="M-4 74 73 6h20L8 94z" />
        <path className="achievement-badge__tier" d={`M8 ${86 - tierProgress * 22}h62v28H8z`} />
      </g>
      <path className="achievement-badge__frame" d="M39 2 70 14v42c0 17-12 27-31 34C20 83 8 73 8 56V14z" />
      <g className="achievement-badge__icon" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3">
        <MetricIcon metric={metric} />
      </g>
      <text className="achievement-badge__number" x="39" y="67" textAnchor="middle">{threshold}</text>
      <text className="achievement-badge__label" x="39" y="78" textAnchor="middle">{METRIC_LABELS[metric] ?? 'CORE'}</text>
      <g className="achievement-badge__rank" aria-hidden="true">
        {Array.from({ length: Math.min(5, tierIndex + 1) }, (_, index) => <circle cx={31 + index * 4} cy="84" key={index} r="1.15" />)}
      </g>
    </svg>
  );
}
