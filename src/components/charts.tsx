import { STAT_KEYS, type Stats } from "../engine/types.ts";
import "./charts.css";

const STAT_LABEL: Record<string, string> = {
  performance: "Perf",
  quality: "Quality",
  battery: "Battery",
  design: "Design",
  ecosystem: "Ecosys",
};

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

/** Consumer-trend demand weights as bars (what the market wants right now). */
export function TrendBars({ weights }: { weights: Stats }) {
  const max = Math.max(...STAT_KEYS.map((k) => weights[k]));
  return (
    <div className="stat-bars">
      {STAT_KEYS.map((k) => {
        const pct = (weights[k] / (max || 1)) * 100;
        const hot = weights[k] === max;
        return (
          <div className="stat-row" key={k}>
            <span className="stat-row__label">{STAT_LABEL[k]}</span>
            <div className="stat-row__track">
              <div
                className="stat-row__fill"
                style={{ width: `${pct}%`, background: hot ? "var(--positive)" : "var(--accent)" }}
              />
            </div>
            <span className="stat-row__val tnum">{Math.round(weights[k] * 100)}%</span>
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
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
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
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="var(--hairline)" strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill="url(#spark-fill)" />
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
  const max = Math.max(...weekly, 1);
  const barW = width / weekly.length;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} height={height} preserveAspectRatio="none">
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
