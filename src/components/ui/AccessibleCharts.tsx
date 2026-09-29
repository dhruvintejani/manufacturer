import React from 'react';

/**
 * Native HTML/CSS chart alternatives for narrow screens and Safari/WebKit.
 * SVG/Recharts can sometimes fail to paint or measure when mounted inside
 * scrolling, animated dashboard grids on mobile Safari. These visualisations
 * always show meaningful values without depending on SVG or ResizeObserver.
 */
export const prefersHtmlCharts =
  typeof navigator !== 'undefined' &&
  /Safari|iPad|iPhone|iPod|CriOS|FxiOS/i.test(navigator.userAgent) &&
  !/Android|Chrome\/|Chromium|Edg\//i.test(navigator.userAgent);

export interface ChartSeries { key: string; label: string; color: string; }
export interface ChartRow { label: string; [key: string]: number | string; }

const countFormat = (value: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: Math.abs(value) >= 10000 ? 'compact' : 'standard',
}).format(value);

export const ChartAlternative: React.FC<{
  title: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, fallback, children }) => (
  <>
    <div data-html-chart={title} className={prefersHtmlCharts ? 'chart-appear block' : 'chart-appear block lg:hidden'}>
      {fallback}
    </div>
    {!prefersHtmlCharts && (
      <div data-svg-chart={title} className="hidden min-w-0 lg:block">
        {children}
      </div>
    )}
  </>
);

export const AccessibleBars: React.FC<{
  title: string;
  data: ChartRow[];
  series: ChartSeries[];
  valueLabel?: (value: number) => string;
  minColumnWidth?: number;
}> = ({ title, data, series, valueLabel = countFormat, minColumnWidth = 34 }) => {
  const max = Math.max(0, ...data.flatMap(row => series.map(item => Number(row[item.key]) || 0)));
  if (!data.length || max === 0) return (
    <p data-chart-empty className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
      No recorded activity for this period.
    </p>
  );
  const wide = data.length * minColumnWidth > 260;
  return (
    <div role="group" aria-label={title} className="min-w-0">
      <div role="region" aria-label={title + ' bars'} tabIndex={0}
        className="max-w-full overflow-x-auto overscroll-x-contain pb-2"
        style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative flex h-44 items-stretch border-b border-slate-200 pt-3"
          style={{ minWidth: wide ? data.length * minColumnWidth : '100%' }}>
          <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-dashed border-slate-100" />
          <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-dashed border-slate-100" />
          {data.map((row, index) => (
            <div key={row.label + index} className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-0.5">
              <div className="flex h-[136px] w-full items-end justify-center gap-0.5">
                {series.map(item => {
                  const value = Math.max(0, Number(row[item.key]) || 0);
                  return <div
                    key={item.key}
                    role="img"
                    aria-label={row.label + ': ' + item.label + ' ' + valueLabel(value)}
                    title={row.label + ' — ' + item.label + ': ' + valueLabel(value)}
                    data-chart-value={value}
                    className="chart-bar max-w-6 min-w-1 flex-1 rounded-t-[3px] transition-[filter] duration-200 hover:brightness-90"
                    style={{ height: value ? Math.max(6, value / max * 126) : 2, background: value ? item.color : '#e2e8f0' }}
                  />;
                })}
              </div>
              <span className="w-full truncate text-center text-[10px] font-medium text-slate-500">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
      {wide && <p className="mt-1 text-[11px] text-slate-500">Swipe inside the chart to see all months.</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {series.map(item => <div key={item.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />{item.label}
        </div>)}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Highest {series.length === 1 ? series[0].label.toLowerCase() : 'recorded value'}: {valueLabel(max)}
      </p>
    </div>
  );
};

export const AccessibleDonut: React.FC<{
  title: string;
  data: { name: string; value: number; fill: string }[];
}> = ({ title, data }) => {
  const positive = data.filter(item => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <p data-chart-empty className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">No records available yet.</p>;
  let offset = 0;
  const segments = positive.map(item => {
    const start = offset;
    offset += item.value / total * 100;
    return `${item.fill} ${start}% ${offset}%`;
  });
  return (
    <div role="group" aria-label={title} className="flex min-w-0 flex-col items-center gap-4 py-2">
      <div role="img" aria-label={title + ': ' + positive.map(item => item.name + ' ' + item.value).join(', ')}
        data-chart-total={total} className="chart-donut relative h-40 w-40 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}>
        <div className="absolute inset-[29px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-[11px] text-slate-500">Total records</span>
        </div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[350px]:grid-cols-2">
        {data.map(item => <div key={item.name} className="flex min-w-0 items-start gap-2 text-xs text-slate-700">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: item.fill }} />
          <span className="min-w-0 flex-1 break-words">{item.name}</span>
          <span className="shrink-0 font-semibold text-slate-900">{item.value}</span>
        </div>)}
      </div>
    </div>
  );
};

export const AccessibleHorizontalBars: React.FC<{
  title: string;
  data: { label: string; value: number }[];
  color?: string;
  valueLabel?: (value: number) => string;
}> = ({ title, data, color = '#2563eb', valueLabel = countFormat }) => {
  const max = Math.max(0, ...data.map(item => item.value));
  if (!max) return <p data-chart-empty className="rounded-lg bg-slate-50 p-5 text-center text-sm text-slate-500">No recorded values yet.</p>;
  return (
    <div role="group" aria-label={title} className="min-w-0 space-y-3">
      {data.map(item => <div key={item.label} className="min-w-0">
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 break-words font-medium text-slate-700">{item.label}</span>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">{valueLabel(item.value)}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div role="img" aria-label={item.label + ': ' + valueLabel(item.value)}
            data-chart-value={item.value} className="chart-bar h-full rounded-full"
            style={{ width: (item.value / max * 100) + '%', background: color }} />
        </div>
      </div>)}
    </div>
  );
};
