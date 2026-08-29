(() => {
  if (window.RCCResultsEnhancements) return;

  let gapChartInstance = null;
  let refreshTimer = 0;

  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  function rgba(color, alpha = 1) {
    const probe = document.createElement('span');
    probe.style.position = 'fixed';
    probe.style.opacity = '0';
    probe.style.pointerEvents = 'none';
    probe.style.color = color;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const match = resolved.match(/rgba?\(([^)]+)\)/i);
    if (!match) return color;
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length < 3 || parts.some((value) => !Number.isFinite(value))) return color;
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }

  function theme() {
    const text = css('--text', '#f4f7f8');
    const muted = css('--text-muted', '#aeb7c0');
    const line = css('--line', 'rgba(255,255,255,.1)');
    const surface = css('--surface', '#15181b');
    const primary = css('--primary', '#27f4d2');
    const secondary = css('--secondary', '#0b0d10');
    const accent = css('--accent', '#c5c7c9');
    const accent2 = css('--accent-2', css('--accent-2-color', '#ffffff'));
    const success = css('--success', '#2dc08d');
    const warning = css('--warning', '#f4c14d');
    return {
      text,
      muted,
      line,
      surface,
      palette: [primary, accent, secondary, accent2, success, warning]
    };
  }

  function styleBaseChart(chart) {
    if (!chart?.data?.datasets?.length) return;
    const t = theme();
    const visibleIndexes = chart.data.datasets
      .map((dataset, index) => (dataset.hidden === true ? -1 : index))
      .filter((index) => index >= 0);

    chart.data.datasets.forEach((dataset, index) => {
      const visibleIndex = visibleIndexes.indexOf(index);
      const highlighted = visibleIndex >= 0;
      const color = highlighted ? t.palette[visibleIndex % t.palette.length] : rgba(t.muted, .26);
      dataset.borderColor = color;
      dataset.backgroundColor = rgba(color, .1);
      dataset.pointBackgroundColor = color;
      dataset.pointBorderColor = highlighted ? rgba(t.surface, .9) : 'transparent';
      dataset.pointBorderWidth = highlighted ? 1.5 : 0;
      dataset.pointRadius = highlighted ? 2.4 : 0;
      dataset.pointHoverRadius = highlighted ? 5 : 3;
      dataset.borderWidth = highlighted ? 2.7 : 1.15;
      dataset.tension = .32;
    });

    chart.options.plugins.legend.labels.color = t.text;
    chart.options.plugins.legend.labels.filter = (item, data) => data.datasets[item.datasetIndex]?.hidden !== true;
    chart.options.plugins.legend.labels.boxWidth = 9;
    chart.options.plugins.legend.labels.padding = 16;
    chart.options.plugins.tooltip = {
      ...(chart.options.plugins.tooltip || {}),
      backgroundColor: rgba(t.surface, .96),
      titleColor: t.text,
      bodyColor: t.text,
      borderColor: rgba(t.palette[1], .36),
      borderWidth: 1,
      padding: 11,
      displayColors: true
    };

    ['x', 'y'].forEach((axis) => {
      if (!chart.options.scales?.[axis]) return;
      chart.options.scales[axis].ticks = {
        ...(chart.options.scales[axis].ticks || {}),
        color: t.muted
      };
      chart.options.scales[axis].grid = {
        ...(chart.options.scales[axis].grid || {}),
        color: rgba(t.line, .72),
        drawBorder: false
      };
      chart.options.scales[axis].border = { color: rgba(t.line, .9) };
    });

    chart.update('none');
  }

  function buildGapChart(sourceChart) {
    const canvas = document.getElementById('results-gap-chart');
    if (!canvas || !window.Chart || !sourceChart?.data?.datasets?.length) return;

    gapChartInstance?.destroy();
    const t = theme();
    const labels = [...(sourceChart.data.labels || [])];
    const all = sourceChart.data.datasets;
    const top = all.filter((dataset) => dataset.hidden !== true).slice(0, 6);
    const leaders = labels.map((_, raceIndex) => Math.max(0, ...all.map((dataset) => Number(dataset.data?.[raceIndex] || 0))));

    const datasets = top.map((dataset, index) => ({
      label: dataset.label,
      data: labels.map((_, raceIndex) => Number(dataset.data?.[raceIndex] || 0) - leaders[raceIndex]),
      borderColor: t.palette[index % t.palette.length],
      backgroundColor: rgba(t.palette[index % t.palette.length], .08),
      pointBackgroundColor: t.palette[index % t.palette.length],
      pointBorderColor: rgba(t.surface, .9),
      pointBorderWidth: 1.5,
      pointRadius: 2.6,
      pointHoverRadius: 5,
      borderWidth: 2.7,
      tension: .34,
      fill: false
    }));

    gapChartInstance = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: t.text, boxWidth: 9, usePointStyle: true, padding: 16 }
          },
          tooltip: {
            backgroundColor: rgba(t.surface, .96),
            titleColor: t.text,
            bodyColor: t.text,
            borderColor: rgba(t.palette[1], .36),
            borderWidth: 1,
            padding: 11,
            callbacks: {
              label(context) {
                const value = Number(context.raw || 0);
                return value === 0 ? `${context.dataset.label}: Führung` : `${context.dataset.label}: ${Math.abs(value)} P Rückstand`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: t.muted },
            grid: { color: rgba(t.line, .66), drawBorder: false },
            border: { color: rgba(t.line, .9) }
          },
          y: {
            max: 0,
            grace: '8%',
            ticks: {
              color: t.muted,
              callback(value) {
                const numeric = Number(value || 0);
                return numeric === 0 ? 'Führung' : `${Math.abs(numeric)} P`;
              }
            },
            grid: {
              color(context) {
                return Number(context.tick?.value || 0) === 0 ? rgba(t.palette[0], .48) : rgba(t.line, .66);
              },
              drawBorder: false
            },
            border: { color: rgba(t.line, .9) }
          }
        }
      }
    });
  }

  function refresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      if (typeof trendChartInstance === 'undefined' || !trendChartInstance) return;
      styleBaseChart(trendChartInstance);
      buildGapChart(trendChartInstance);
    }, 30);
  }

  function init() {
    refresh();
    document.addEventListener('rcc:page-content-ready', refresh);
    document.addEventListener('rcc:results-focus-change', refresh);

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'data-theme' || mutation.attributeName === 'style')) refresh();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  }

  window.RCCResultsEnhancements = { init, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
