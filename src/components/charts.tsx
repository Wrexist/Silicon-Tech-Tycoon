import { useId, useState } from "react";
import { STAT_KEYS, type Stats } from "../engine/types.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import "./charts.css";

// Compact stat labels derive from the single source (glossary STAT_INFO) so they can't drift.
const STAT_LABEL: Record<string, string> = Object.fromEntries(STAT_KEYS.map((k) => [k, STAT_INFO[k].abbr]));

/** Horizontal stat bars 0..100 with optional demand-weight tint and trend arrows.
 *  trendDeltas: per-stat delta (targetWeight − currentWeight); positive = rising. */
export function StatBars({
  stats,
  weights,
  trendDeltas,
}: {
  stats: Stats;
  weights?: Stats;
  trendDeltas?: Partial<Record<keyof Stats, number>>;
}) {
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((k) => {
        const hot = weights ? weights[k] > 0.24 : false;
        const delta = trendDeltas?.[k] ?? 0;
        const rising = delta > 0.03;
        const falling = delta < -0.03;
        return (
          <div className="stat-row" key={k}>
            <span className="stat-row__label">
              {STAT_LABEL[k]}
              {/* A dot that shows ONLY when in demand — a presence signal, so "hot" reads without
                  relying on the bar's green-vs-blue tint alone (colour-blind safe). */}
              {hot && <span className="stat-row__hot" aria-label="in demand" title="In demand" />}
              {rising && <span className="stat-row__arrow stat-row__arrow--up" aria-label="rising" />}
              {falling && <span className="stat-row__arrow stat-row__arrow--down" aria-label="falling" />}
            </span>
            <div className="stat-row__track">
              <div
                className="stat-row__fill"
                style={{ width: `${stats[k]}%`, background: hot ? "var(--positive)" : "var(--accent)" }}
              />
            </div>
            <span className="stat-row__val tnum">{stats[k]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Tiny sparkline (cash over time). */
export function Sparkline({
  data,
  width = 280,
  height = 64,
  stroke = "var(--accent)",
  label,
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  /** VoiceOver summary, e.g. "Cash over time". Charts are otherwise silent to assistive tech. */
  label?: string;
}) {
  // Unique per instance: a shared id ("spark-fill") made every sparkline on a screen take the
  // FIRST chart's fill colour (duplicate DOM ids resolve to the first match — a falling red
  // stock showed a green area fill on the Market list).
  const gradientId = useId();
  if (data.length < 2)
    return (
      <div className="spark-empty" style={{ height }}>
        <span className="spark-empty__hint">Chart fills in as weeks pass</span>
      </div>
    );
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((d, i) => [i * stepX, height - ((d - min) / span) * height]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const zeroY = height - ((0 - min) / span) * height;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? "Trend chart"}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="var(--hairline)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** A launched product's weekly-units curve with progress marker. */
export function SalesCurveChart({
  weekly,
  elapsed,
  width = 280,
  height = 56,
}: {
  weekly: number[];
  elapsed: number;
  width?: number;
  height?: number;
}) {
  if (weekly.length === 0) return null; // no curve to draw — guards barW = width/0 → Infinity/blank SVG
  const max = Math.max(...weekly, 1);
  const barW = width / weekly.length;
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Weekly sales, week ${Math.min(elapsed, weekly.length)} of ${weekly.length}`}
    >
      {weekly.map((u, i) => {
        const h = (u / max) * (height - 4);
        const sold = i < elapsed;
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={height - h}
            width={barW - 2}
            height={h}
            rx={1.5}
            fill={sold ? "var(--accent)" : "var(--hairline)"}
          />
        );
      })}
    </svg>
  );
}

const CHART_RANGES = [
  { id: "4w", label: "4W", weeks: 4 },
  { id: "8w", label: "8W", weeks: 8 },
  { id: "26w", label: "26W", weeks: 26 },
  { id: "all", label: "All", weeks: Number.POSITIVE_INFINITY },
] as const;
type ChartRangeId = (typeof CHART_RANGES)[number]["id"];

const CHART_W = 560;
const CHART_H = 200;

/** Maps a value to the SVG y axis. Returns the mid-line for a zero-height domain so a flat series
 *  still draws a line instead of an unexpected baseline. */
function scaleY(value: number, min: number, span: number, height: number): number {
  if (span === 0) return height / 2;
  return height - ((value - min) / span) * height;
}

/** Multi-series line chart. The caller owns the semantic colours (this never hardcodes
 *  `--positive` / `--negative`); the component owns only geometry, the legend and the 4W/8W/26W/All
 *  range control (a local view preference, not route state). Zero-safe: a flat, single-point or
 *  all-zero series still draws an axis and a line, never a NaN path or a blank SVG. */
export function DataChart({
  series,
  weeks,
  xLabel = "Week",
  formatValue = (n) => String(n),
}: {
  series: readonly { id: string; label: string; colour: string; points: readonly number[] }[];
  /** One x tick label per point, aligned with every series' `points`. Sliced with the range. */
  weeks: readonly (string | number)[];
  xLabel?: string;
  formatValue?: (n: number) => string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [range, setRange] = useState<ChartRangeId>("8w");
  const rangeWeeks = CHART_RANGES.find((r) => r.id === range)?.weeks ?? 8;

  const total = Math.max(series[0]?.points.length ?? 0, weeks.length);
  const windowLen = Number.isFinite(rangeWeeks) ? Math.min(rangeWeeks, total) : total;
  const start = Math.max(0, total - windowLen);
  const visibleLen = Math.max(0, total - start);

  const visible = series.map((s) => ({
    ...s,
    points: s.points.slice(start, total),
  }));

  const allValues = visible.flatMap((s) => s.points);
  const min = Math.min(0, ...allValues);
  const max = Math.max(0, ...allValues, 1);
  const span = max - min || 1;

  // Up to 5 evenly-spaced ticks including the first and last, so labels never collide on 390px.
  const tickCount = Math.max(1, Math.min(5, visibleLen));
  const ticks =
    visibleLen <= 1
      ? [0]
      : Array.from({ length: tickCount }, (_, i) =>
          Math.round((i * (visibleLen - 1)) / (tickCount - 1)),
        );
  const labelAt = (i: number) => weeks[start + i] ?? start + i + 1;

  const x = (i: number) =>
    visibleLen <= 1 ? CHART_W / 2 : (i / (visibleLen - 1)) * CHART_W;

  const selectedIndex = Math.min(total - 1, Math.max(start, selected ?? total - 1));
  const selectedOffset = selectedIndex - start;
  const seriesNames = series.map((s) => s.label).join(", ");
  const ariaLabel = `Growth chart, ${range === "all" ? "all weeks" : CHART_RANGES.find((r) => r.id === range)?.label}: ${seriesNames}`;

  return (
    <div className="ds-chart">
      <div className="ds-chart__top">
        <div className="ds-chart__legend">
          {series.map((s) => (
            <span className="ds-chart__legend-item" key={s.id}>
              <span className="ds-chart__swatch" style={{ background: s.colour }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
        <div className="ds-chart__ranges" role="group" aria-label="Chart range">
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`ds-chart__range${r.id === range ? " ds-chart__range--active" : ""}`}
              aria-pressed={r.id === range}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ds-chart__plot">
        <span className="ds-chart__ymax tnum">{formatValue(max)}</span>
        <span
          className="ds-chart__yzero tnum"
          style={{ top: `${(scaleY(0, min, span, CHART_H) / CHART_H) * 100}%` }}
        >
          0
        </span>
        <svg
          className="ds-chart__svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
          onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); setSelected(start + Math.round(fraction * Math.max(0, visibleLen - 1))); }}
        >
          <line
            x1={0}
            y1={scaleY(0, min, span, CHART_H)}
            x2={CHART_W}
            y2={scaleY(0, min, span, CHART_H)}
            stroke="var(--hairline)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {visibleLen > 0 && <line x1={x(selectedOffset)} x2={x(selectedOffset)} y1={0} y2={CHART_H} stroke="var(--ink-3)" strokeDasharray="3 3" />}
          {visible.map((s) => {
            if (s.points.length === 0) return null;
            const path =
              s.points.length === 1
                ? `M 0 ${scaleY(s.points[0], min, span, CHART_H)} L ${CHART_W} ${scaleY(s.points[0], min, span, CHART_H)}`
                : s.points
                    .map(
                      (p, i) =>
                        `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${scaleY(p, min, span, CHART_H).toFixed(1)}`,
                    )
                    .join(" ");
            return (
              <path
                key={s.id}
                d={path}
                fill="none"
                stroke={s.colour}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </div>

      <div className="ds-chart__xaxis">
        {ticks.map((i) => (
          <span className="ds-chart__xtick tnum" key={i}>
            {labelAt(i)}
          </span>
        ))}
      </div>
      <span className="ds-chart__xlabel">{xLabel}</span>
      {visibleLen > 0 && <div className="ds-chart__inspect">
        <label>{xLabel} {labelAt(selectedOffset)}<input type="range" aria-label="Inspect chart period" min={0} max={Math.max(0, visibleLen - 1)} value={selectedOffset} disabled={visibleLen < 2} onChange={e => setSelected(start + Number(e.target.value))} /></label>
        <p aria-live="polite">{visible.map(s => `${s.label}: ${s.points[selectedOffset] == null ? "No data" : formatValue(s.points[selectedOffset])}`).join(" / ")}</p>
        <details className="mg-disclosure"><summary>View recorded values</summary><div className="mg-table-scroll" tabIndex={0} role="region" aria-label="Recorded chart values"><table><caption>{ariaLabel}</caption><thead><tr><th scope="col">{xLabel}</th>{visible.map(s => <th scope="col" key={s.id}>{s.label}</th>)}</tr></thead><tbody>{Array.from({ length: visibleLen }, (_, i) => <tr key={i}><th scope="row">{labelAt(i)}</th>{visible.map(s => <td key={s.id}>{s.points[i] == null ? "No data" : formatValue(s.points[i])}</td>)}</tr>)}</tbody></table></div></details>
      </div>}

    </div>
  );
}
