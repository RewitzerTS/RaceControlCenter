import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart } from 'chart.js';
import { useI18n } from '../i18n/I18nProvider';
import { resultSeries, type ResultsMatrix } from './resultsData';
import type { ResultsCopy } from './resultsMessages';

export function ResultsCharts({ matrix, visible, copy }: { matrix: ResultsMatrix; visible: string[]; copy: ResultsCopy }) {
  const { language, formatNumber } = useI18n();
  const data = useMemo(() => resultSeries(matrix), [matrix]);
  const selected = useMemo(() => data.series.filter((row) => visible.includes(row.driver.id)), [data, visible]);
  const trend = useRef<HTMLCanvasElement>(null);
  const gap = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const charts: Chart[] = [];
    setError(false);
    setReady(false);
    void import('chart.js/auto').then(({ default: ChartJS }) => {
      if (!active || !trend.current || !gap.current) return;
      const styles = getComputedStyle(trend.current);
      const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const palette = [styles.color, color('--brand-accent', '#a38cff'), '#50ba8c', '#efbb55', '#e47da5', '#73a8f2'];
      const muted = color('--muted', '#b9c5d1');
      const text = color('--text', '#ffffff');
      const line = color('--line', '#35424f');
      for (const [canvas, isGap] of [[trend.current, false], [gap.current, true]] as const) {
        charts.push(new ChartJS(canvas, {
          type: 'line',
          data: { labels: data.races.map((race) => `R${race.round_number}`), datasets: selected.slice(0, isGap ? 6 : selected.length).map((row, index) => ({
            label: row.driver.display_name,
            data: row.values.map((value, i) => isGap ? value - data.leaders[i] : value),
            borderColor: palette[index % palette.length], backgroundColor: palette[index % palette.length],
            borderDash: index > 2 ? [6, 3] : [], borderWidth: 2.7, pointRadius: 2.4, pointHoverRadius: 5, tension: .32,
          })) },
          options: { responsive: true, maintainAspectRatio: false, animation: false, locale: language,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { color: text, boxWidth: 9, usePointStyle: true, padding: 16 } } },
            scales: { x: { ticks: { color: muted }, grid: { color: line } }, y: { ...(isGap ? { max: 0 } : {}), ticks: { color: muted }, grid: { color: line } } },
          },
        }));
      }
      setReady(true);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; charts.forEach((chart) => chart.destroy()); };
  }, [data, selected, language, retry]);
  return <>
    {error && <p role="alert">{copy.chartError} <button type="button" onClick={() => setRetry((value) => value + 1)}>{copy.chartRetry}</button></p>}
    {([false, true] as const).map((isGap) => <section className="results-chart-panel" key={String(isGap)} aria-labelledby={isGap ? 'results-gap-title' : 'results-trend-title'}>
      <h2 id={isGap ? 'results-gap-title' : 'results-trend-title'}>{isGap ? copy.gap : copy.trend}</h2>
      <p>{isGap ? copy.gapCopy : copy.trendCopy}</p>
      <div className="results-chart-frame" hidden={error} aria-busy={!ready} data-chart-ready={ready}><canvas ref={isGap ? gap : trend} id={isGap ? 'results-gap-chart' : 'results-trend-chart'} role="img" aria-label={isGap ? copy.gapCopy : copy.trendCopy} /></div>
      {isGap && <p>{copy.gapNote}</p>}
      <details className="results-values"><summary>{copy.values}</summary><div className="results-scroll" tabIndex={0} role="region" aria-label={`${isGap ? copy.gap : copy.trend}: ${copy.values}`}><table>
        <thead><tr><th scope="col">{copy.drivers}</th>{data.races.map((race) => <th scope="col" key={race.id}>{race.grand_prix_name}</th>)}</tr></thead>
        <tbody>{selected.slice(0, isGap ? 6 : selected.length).map((row) => <tr key={row.driver.id}><th scope="row">{row.driver.display_name}</th>{row.values.map((value, i) => <td key={data.races[i].id}>{formatNumber(isGap ? value - data.leaders[i] : value)}</td>)}</tr>)}</tbody>
      </table></div></details>
    </section>)}
  </>;
}
