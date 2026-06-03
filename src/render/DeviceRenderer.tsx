// Parametric device renderer — realistic phone/tablet drawn live from design choices.
// Front + back faces with a 3D flip. Premium camera module + concentric-ring lenses.
// Pure SVG, zero image assets, resolution-independent.
import { useId } from "react";
import type { CategoryId, Product } from "../engine/types.ts";
import { deviceVisual, describeDevice, type DeviceVisual } from "./deviceStyle.ts";
import { squircle } from "./squircle.ts";
import "./device.css";

const ASPECT: Partial<Record<CategoryId, number>> = {
  phone: 100 / 206,
  tablet: 100 / 138,
  monitor: 100 / 64,
  laptop: 100 / 68,
  desktop: 100 / 150,
  console: 100 / 58,
  wearable: 100 / 116,
  experimental: 100 / 60,
};

type Face = "front" | "back";

export function DeviceRenderer({
  product,
  size = 220,
  idle = false,
  shimmer = false,
  face = "front",
  flip = false,
}: {
  product: Product;
  size?: number;
  idle?: boolean;
  shimmer?: boolean;
  face?: Face;
  /** when true, renders a 3D flip card and animates between front/back as `face` changes */
  flip?: boolean;
}) {
  const visual = deviceVisual(product);
  const aspect = ASPECT[product.category] ?? 100 / 206;

  // Only phones & tablets are flat "slabs" with a front/back flip. Everything else has a
  // distinct silhouette rendered as a single coherent view.
  const slab = product.category === "phone" || product.category === "tablet";
  if (!slab) {
    return <CategorySilhouette product={product} visual={visual} aspect={aspect} size={size} idle={idle} shimmer={shimmer} />;
  }

  if (!flip) {
    return face === "back" ? (
      <Back product={product} visual={visual} aspect={aspect} size={size} idle={idle} />
    ) : (
      <Front product={product} visual={visual} aspect={aspect} size={size} idle={idle} shimmer={shimmer} />
    );
  }

  // Reuse the exact width the static faces render at so toggling flip never jumps the layout.
  const { renderW } = useGeom(aspect, size);
  return (
    <div className={`device3d${idle ? " device-float" : ""}`} style={{ width: renderW }}>
      <div className={`device3d__inner${face === "back" ? " device3d__inner--back" : ""}`}>
        <div className="device3d__face device3d__face--front">
          <Front product={product} visual={visual} aspect={aspect} size={size} idle={false} shimmer={shimmer} />
        </div>
        <div className="device3d__face device3d__face--back">
          <Back product={product} visual={visual} aspect={aspect} size={size} idle={false} />
        </div>
      </div>
    </div>
  );
}

// ---------- shared geometry ----------
function useGeom(aspect: number, size: number) {
  const W = 100;
  const H = W / aspect;
  const pad = 16;
  return {
    W,
    H,
    pad,
    vbW: W + pad * 2,
    vbH: H + pad * 2,
    x: pad,
    y: pad,
    renderW: size * aspect + (pad / H) * size * aspect,
    renderH: size + (pad / H) * size,
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ---------- FRONT ----------
function Front({
  product,
  visual,
  aspect,
  size,
  idle,
  shimmer,
}: {
  product: Product;
  visual: DeviceVisual;
  aspect: number;
  size: number;
  idle: boolean;
  shimmer: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const g = useGeom(aspect, size);

  const r = visual.cornerRadius * g.W;
  // Thin, uniform premium bezel that gets thinner at higher display tiers.
  const bezel = lerp(0.058, 0.026, 1 - visual.bezel * 6) * g.W;
  const bz = Math.max(2.2, Math.min(6.5, bezel));
  const screenR = Math.max(3, r - bz);

  const body = squircle(g.x, g.y, g.W, g.H, r, visual.smoothing);
  const screen = squircle(g.x + bz, g.y + bz, g.W - bz * 2, g.H - bz * 2, screenR, visual.smoothing);

  return (
    <div
      className={`device-wrap${idle ? " device-float" : ""}`}
      role="img"
      aria-label={describeDevice(product, visual)}
    >
      <svg width={g.renderW} height={g.renderH} viewBox={`0 0 ${g.vbW} ${g.vbH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`fbody-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={visual.swatch.bodyLight} />
            <stop offset="0.5" stopColor={visual.swatch.body} />
            <stop offset="1" stopColor={visual.swatch.bodyDark} />
          </linearGradient>
          <radialGradient id={`fglow-${uid}`} cx="0.5" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#22305a" stopOpacity={visual.screenGlow} />
            <stop offset="0.5" stopColor="#0c1320" stopOpacity={visual.screenGlow * 0.55} />
            <stop offset="1" stopColor="#05070c" stopOpacity="1" />
          </radialGradient>
          <linearGradient id={`fsheen-${uid}`} x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={visual.sheen} />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`frim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={visual.edgeHighlight} />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity={visual.edgeHighlight * 0.6} />
          </linearGradient>
          <filter id={`fsh-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy={g.H * 0.025} stdDeviation={g.W * 0.05} floodColor="#0c1018" floodOpacity="0.3" />
          </filter>
        </defs>

        <path d={body} fill={`url(#fbody-${uid})`} filter={`url(#fsh-${uid})`} />
        <path d={body} fill="none" stroke={`url(#frim-${uid})`} strokeWidth={Math.max(0.6, bz * 0.22)} />

        <path d={screen} fill="#05070c" />
        <path d={screen} fill={`url(#fglow-${uid})`} />
        <path d={screen} fill={`url(#fsheen-${uid})`} className={shimmer ? "device-screen-shimmer" : undefined} />

        <SelfieCamera x={g.x} y={g.y} W={g.W} bz={bz} notch={visual.notch} accent={visual.swatch.accent} />

        {/* side buttons */}
        {visual.buttons && (
          <>
            <rect x={g.x + g.W - 0.6} y={g.y + g.H * 0.2} width={1.8} height={g.H * 0.09} rx={0.9} fill={visual.swatch.bodyDark} />
            <rect x={g.x + g.W - 0.6} y={g.y + g.H * 0.33} width={1.8} height={g.H * 0.06} rx={0.9} fill={visual.swatch.bodyDark} />
            <rect x={g.x - 1.2} y={g.y + g.H * 0.24} width={1.8} height={g.H * 0.12} rx={0.9} fill={visual.swatch.bodyDark} />
          </>
        )}
      </svg>
    </div>
  );
}

function SelfieCamera({
  x,
  y,
  W,
  bz,
  notch,
  accent,
}: {
  x: number;
  y: number;
  W: number;
  bz: number;
  notch: DeviceVisual["notch"];
  accent: string;
}) {
  const cx = x + W / 2;
  const top = y + bz + 2.2;
  if (notch === "none") return null;
  if (notch === "punch") {
    return (
      <g>
        <circle cx={cx} cy={top + 1.5} r={1.7} fill="#04060a" />
        <circle cx={cx} cy={top + 1.5} r={0.8} fill={accent} opacity={0.5} />
      </g>
    );
  }
  if (notch === "island") {
    const w = 16;
    return (
      <g>
        <rect x={cx - w / 2} y={top} width={w} height={5} rx={2.5} fill="#04060a" />
        <circle cx={cx + w / 2 - 3} cy={top + 2.5} r={1.4} fill="#0a0e16" />
        <circle cx={cx + w / 2 - 3} cy={top + 2.5} r={0.7} fill={accent} opacity={0.5} />
      </g>
    );
  }
  // notch
  const w = 22;
  return (
    <g transform={`translate(${cx - w / 2}, ${y + bz})`}>
      <path d={`M0 0 H${w} V3 Q${w} 5.5 ${w - 3} 5.5 H3 Q0 5.5 0 3 Z`} fill="#04060a" />
      <circle cx={w / 2 + 4} cy={2.6} r={1.3} fill="#0a0e16" />
      <rect x={w / 2 - 6} y={1.8} width={6} height={1.6} rx={0.8} fill="#0a0e16" />
    </g>
  );
}

// ---------- BACK ----------
function Back({
  product,
  visual,
  aspect,
  size,
  idle,
}: {
  product: Product;
  visual: DeviceVisual;
  aspect: number;
  size: number;
  idle: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const g = useGeom(aspect, size);
  const r = visual.cornerRadius * g.W;
  const body = squircle(g.x, g.y, g.W, g.H, r, visual.smoothing);

  // Camera module placement
  const moduleSize = (0.26 + visual.cameraCount * 0.04) * g.W;
  const margin = g.W * 0.12;
  let mx = g.x + margin;
  let my = g.y + margin;
  if (visual.cameraPosition === "topCenter") {
    mx = g.x + g.W / 2 - moduleSize / 2;
    my = g.y + margin;
  } else if (visual.cameraPosition === "center") {
    mx = g.x + g.W / 2 - moduleSize / 2;
    my = g.y + g.H / 2 - moduleSize / 2;
  }

  return (
    <div className={`device-wrap${idle ? " device-float" : ""}`} role="img" aria-label={describeDevice(product, visual)}>
      <svg width={g.renderW} height={g.renderH} viewBox={`0 0 ${g.vbW} ${g.vbH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`bbody-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={visual.swatch.bodyLight} />
            <stop offset="0.5" stopColor={visual.swatch.body} />
            <stop offset="1" stopColor={visual.swatch.bodyDark} />
          </linearGradient>
          <linearGradient id={`bsheen-${uid}`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={visual.sheen * 0.7} />
            <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity={visual.metallic ? 0.08 : 0} />
          </linearGradient>
          <linearGradient id={`brim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={visual.edgeHighlight} />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity={visual.edgeHighlight * 0.6} />
          </linearGradient>
          <filter id={`bsh-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy={g.H * 0.025} stdDeviation={g.W * 0.05} floodColor="#0c1018" floodOpacity="0.3" />
          </filter>
        </defs>

        <path d={body} fill={`url(#bbody-${uid})`} filter={`url(#bsh-${uid})`} />
        <path d={body} fill={`url(#bsheen-${uid})`} />
        <path d={body} fill="none" stroke={`url(#brim-${uid})`} strokeWidth={Math.max(0.6, g.W * 0.012)} />

        {/* brand mark (center) */}
        <BrandMark cx={g.x + g.W / 2} cy={g.y + g.H * 0.52} r={g.W * 0.07} color={visual.swatch.bodyDark} />

        {/* camera module — skipped entirely when the design has no cameras */}
        {visual.cameraCount > 0 && (
          <CameraModule
            uid={uid}
            mx={mx}
            my={my}
            size={moduleSize}
            visual={visual}
          />
        )}
      </svg>
    </div>
  );
}

function BrandMark({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  // A simple abstract "Silicon" diamond mark — no real brand.
  return (
    <g opacity={0.28}>
      <path
        d={`M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z`}
        fill="none"
        stroke={color}
        strokeWidth={r * 0.18}
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r={r * 0.28} fill={color} />
    </g>
  );
}

function lensCenters(count: number, layout: DeviceVisual["cameraLayout"], s: number): [number, number][] {
  // returns centers in module-local coords (0..s) for `count` lenses
  const c = Math.max(1, Math.min(4, count));
  const m = s * 0.5;
  const off = s * 0.24;
  if (c === 1) return [[m, m]];
  if (layout === "horizontal") {
    if (c === 2) return [[m - off, m], [m + off, m]];
    if (c === 3) return [[m - off, m], [m, m], [m + off, m]];
    return [[m - off, m], [m - off * 0.33, m], [m + off * 0.33, m], [m + off, m]];
  }
  if (layout === "square") {
    if (c === 2) return [[m - off, m - off], [m + off, m + off]];
    if (c === 3) return [[m - off, m - off], [m + off, m - off], [m - off, m + off]];
    return [[m - off, m - off], [m + off, m - off], [m - off, m + off], [m + off, m + off]];
  }
  if (layout === "triangle") {
    if (c === 2) return [[m - off, m - off], [m + off, m + off]];
    if (c === 3) return [[m, m - off], [m - off, m + off * 0.6], [m + off, m + off * 0.6]];
    return [[m, m - off], [m - off, m], [m + off, m], [m, m + off]];
  }
  // vertical (default)
  if (c === 2) return [[m, m - off], [m, m + off]];
  if (c === 3) return [[m, m - off], [m, m], [m, m + off]];
  return [[m, m - off], [m, m - off * 0.33], [m, m + off * 0.33], [m, m + off]];
}

function CameraModule({
  uid,
  mx,
  my,
  size,
  visual,
}: {
  uid: string;
  mx: number;
  my: number;
  size: number;
  visual: DeviceVisual;
}) {
  const count = Math.max(1, visual.cameraCount);
  const lensR = (count <= 1 ? 0.2 : count === 2 ? 0.17 : 0.14) * size;
  const centers = lensCenters(count, visual.cameraLayout, size);

  // module plate shape
  let plate;
  if (visual.cameraModule === "circle") {
    plate = <circle cx={mx + size / 2} cy={my + size / 2} r={size / 2} fill={`url(#plate-${uid})`} stroke="#00000022" strokeWidth={0.5} />;
  } else if (visual.cameraModule === "pill") {
    const h = size * 0.62;
    plate = <rect x={mx + size * 0.19} y={my} width={size * 0.62} height={size} rx={h / 2} fill={`url(#plate-${uid})`} stroke="#00000022" strokeWidth={0.5} />;
  } else {
    plate = <path d={squircle(mx, my, size, size, size * 0.28, 0.6)} fill={`url(#plate-${uid})`} stroke="#00000022" strokeWidth={0.5} />;
  }

  return (
    <g>
      <defs>
        <linearGradient id={`plate-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={shade(visual.swatch.bodyLight, -8)} />
          <stop offset="1" stopColor={shade(visual.swatch.bodyDark, -10)} />
        </linearGradient>
        <radialGradient id={`glass-${uid}`} cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#2b3550" />
          <stop offset="0.5" stopColor="#0c111c" />
          <stop offset="1" stopColor="#05070c" />
        </radialGradient>
      </defs>
      {/* soft module shadow */}
      <ellipse cx={mx + size / 2} cy={my + size + 1} rx={size * 0.5} ry={size * 0.12} fill="#00000018" />
      {plate}
      {centers.map(([lx, ly], i) => (
        <Lens key={i} cx={mx + lx} cy={my + ly} r={lensR} uid={uid} quality={visual.lensQuality} accent={visual.swatch.accent} />
      ))}
      {/* flash + LiDAR cluster in a free corner */}
      {visual.cameraFlash && (
        <>
          <circle cx={mx + size * 0.78} cy={my + size * 0.2} r={lensR * 0.42} fill="#fff4d6" stroke="#0000001a" strokeWidth={0.3} />
          <circle cx={mx + size * 0.2} cy={my + size * 0.8} r={lensR * 0.3} fill="#1a1f2a" />
        </>
      )}
    </g>
  );
}

function Lens({
  cx,
  cy,
  r,
  uid,
  quality,
  accent,
}: {
  cx: number;
  cy: number;
  r: number;
  uid: string;
  quality: number;
  accent: string;
}) {
  const rimTint = quality > 0.66 ? "#4dd0c0" : quality > 0.33 ? "#6aa8ff" : "#8893a6";
  return (
    <g>
      {/* outer metal ring */}
      <circle cx={cx} cy={cy} r={r} fill="#2a2f3a" />
      <circle cx={cx} cy={cy} r={r * 0.92} fill="#0c0f16" />
      {/* coating rim */}
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={rimTint} strokeWidth={r * 0.08} opacity={0.5 + quality * 0.4} />
      {/* glass */}
      <circle cx={cx} cy={cy} r={r * 0.66} fill={`url(#glass-${uid})`} />
      {/* aperture */}
      <circle cx={cx} cy={cy} r={r * 0.28} fill="#04060a" />
      <circle cx={cx} cy={cy} r={r * 0.12} fill={accent} opacity={0.35} />
      {/* specular highlight */}
      <ellipse cx={cx - r * 0.28} cy={cy - r * 0.3} rx={r * 0.22} ry={r * 0.14} fill="#ffffff" opacity={0.55} transform={`rotate(-30 ${cx - r * 0.28} ${cy - r * 0.3})`} />
    </g>
  );
}

// ---------- distinct category silhouettes ----------
type Geom = ReturnType<typeof useGeom>;

function DeviceDefs({ uid, visual, g }: { uid: string; visual: DeviceVisual; g: Geom }) {
  return (
    <>
      <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={visual.swatch.bodyLight} />
        <stop offset="0.5" stopColor={visual.swatch.body} />
        <stop offset="1" stopColor={visual.swatch.bodyDark} />
      </linearGradient>
      <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.32" r="0.85">
        <stop offset="0" stopColor="#22305a" stopOpacity={visual.screenGlow} />
        <stop offset="0.55" stopColor="#0c1320" stopOpacity={visual.screenGlow * 0.5} />
        <stop offset="1" stopColor="#05070c" stopOpacity="1" />
      </radialGradient>
      <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="0.5" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={visual.sheen} />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={visual.edgeHighlight} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity={visual.edgeHighlight * 0.6} />
      </linearGradient>
      <filter id={`shadow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy={g.H * 0.03} stdDeviation={g.W * 0.05} floodColor="#0c1018" floodOpacity="0.28" />
      </filter>
    </>
  );
}

function CategorySilhouette({
  product, visual, aspect, size, idle, shimmer,
}: { product: Product; visual: DeviceVisual; aspect: number; size: number; idle: boolean; shimmer: boolean }) {
  const uid = useId().replace(/:/g, "");
  const g = useGeom(aspect, size);
  return (
    <div className={`device-wrap${idle ? " device-float" : ""}`} role="img" aria-label={describeDevice(product, visual)}>
      <svg width={g.renderW} height={g.renderH} viewBox={`0 0 ${g.vbW} ${g.vbH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <DeviceDefs uid={uid} visual={visual} g={g} />
        </defs>
        <Shape category={product.category} uid={uid} g={g} visual={visual} shimmer={shimmer} />
      </svg>
    </div>
  );
}

function Shape({ category, uid, g, visual, shimmer }: { category: CategoryId; uid: string; g: Geom; visual: DeviceVisual; shimmer: boolean }) {
  const body = `url(#body-${uid})`;
  const glow = `url(#glow-${uid})`;
  const sheen = `url(#sheen-${uid})`;
  const rim = `url(#rim-${uid})`;
  const shadow = `url(#shadow-${uid})`;
  const sm = visual.smoothing;
  const acc = visual.swatch.accent;
  const dark = visual.swatch.bodyDark;
  const { x, y, W, H } = g;

  // a glowing screen helper
  const screen = (sx: number, sy: number, sw: number, sh: number, r: number, shim = false) => (
    <g>
      <path d={squircle(sx, sy, sw, sh, r, sm)} fill="#06080c" />
      <path d={squircle(sx, sy, sw, sh, r, sm)} fill={glow} />
      <path d={squircle(sx, sy, sw, sh, r, sm)} fill={sheen} className={shim ? "device-screen-shimmer" : undefined} />
    </g>
  );

  switch (category) {
    case "laptop": {
      const lidH = H * 0.78;
      const lid = squircle(x + W * 0.06, y, W * 0.88, lidH, 6, sm);
      const bez = W * 0.06;
      return (
        <g>
          {/* keyboard base (trapezoid deck) */}
          <path
            d={`M ${x - W * 0.02} ${y + H} L ${x + W * 1.02} ${y + H} L ${x + W * 0.9} ${y + lidH} L ${x + W * 0.1} ${y + lidH} Z`}
            fill={body}
            filter={shadow}
          />
          <line x1={x + W * 0.1} y1={y + lidH} x2={x + W * 0.9} y2={y + lidH} stroke={dark} strokeWidth={1} />
          {/* trackpad hint */}
          <rect x={x + W * 0.42} y={y + lidH + (H - lidH) * 0.25} width={W * 0.16} height={(H - lidH) * 0.4} rx={1.5} fill={dark} opacity={0.5} />
          {/* lid + screen */}
          <path d={lid} fill={body} />
          <path d={lid} fill="none" stroke={rim} strokeWidth={0.8} />
          {screen(x + W * 0.06 + bez, y + bez, W * 0.88 - bez * 2, lidH - bez * 2, 4, shimmer)}
        </g>
      );
    }
    case "monitor": {
      const scH = H * 0.74;
      const bez = W * 0.04;
      return (
        <g>
          {/* stand */}
          <rect x={x + W * 0.45} y={y + scH} width={W * 0.1} height={H * 0.16} fill={dark} />
          <path d={`M ${x + W * 0.3} ${y + H} L ${x + W * 0.7} ${y + H} L ${x + W * 0.62} ${y + H * 0.92} L ${x + W * 0.38} ${y + H * 0.92} Z`} fill={body} />
          {/* screen body */}
          <path d={squircle(x, y, W, scH, 5, sm)} fill={body} filter={shadow} />
          <path d={squircle(x, y, W, scH, 5, sm)} fill="none" stroke={rim} strokeWidth={0.8} />
          {screen(x + bez, y + bez, W - bez * 2, scH - bez * 2, 3, shimmer)}
        </g>
      );
    }
    case "desktop": {
      // tower case
      const tw = W * 0.62;
      const tx = x + (W - tw) / 2;
      return (
        <g>
          <path d={squircle(tx, y, tw, H, 7, sm)} fill={body} filter={shadow} />
          <path d={squircle(tx, y, tw, H, 7, sm)} fill="none" stroke={rim} strokeWidth={0.9} />
          {/* front accent seam */}
          <line x1={tx + tw * 0.5} y1={y + 6} x2={tx + tw * 0.5} y2={y + H - 6} stroke={dark} strokeWidth={0.8} opacity={0.5} />
          {/* vents */}
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={tx + tw * 0.12} y1={y + H * 0.12 + i * 5} x2={tx + tw * 0.42} y2={y + H * 0.12 + i * 5} stroke={dark} strokeWidth={1} opacity={0.4} />
          ))}
          {/* drive slot */}
          <rect x={tx + tw * 0.55} y={y + H * 0.14} width={tw * 0.34} height={H * 0.02 + 2} rx={1} fill={dark} opacity={0.6} />
          {/* power LED */}
          <circle cx={tx + tw * 0.72} cy={y + H * 0.26} r={2.2} fill={acc} opacity={visual.screenGlow + 0.3} />
        </g>
      );
    }
    case "console": {
      const ch = H * 0.82;
      const cy = y + (H - ch) / 2;
      return (
        <g>
          <path d={squircle(x, cy, W, ch, 8, sm)} fill={body} filter={shadow} />
          <path d={squircle(x, cy, W, ch, 8, sm)} fill="none" stroke={rim} strokeWidth={0.9} />
          {/* glowing accent strip */}
          <rect x={x + W * 0.1} y={cy + ch * 0.5 - 1.5} width={W * 0.8} height={3} rx={1.5} fill={acc} opacity={visual.screenGlow + 0.35} />
          {/* disc slot */}
          <rect x={x + W * 0.18} y={cy + ch * 0.22} width={W * 0.64} height={2.4} rx={1.2} fill={dark} opacity={0.6} />
          {/* power dot */}
          <circle cx={x + W * 0.85} cy={cy + ch * 0.78} r={2.2} fill={acc} opacity={visual.screenGlow + 0.3} />
        </g>
      );
    }
    case "wearable": {
      const bw = W * 0.86;
      const bx = x + (W - bw) / 2;
      const bodyH = bw * 1.12;
      const by = y + (H - bodyH) / 2;
      const strapW = bw * 0.46;
      const bez = bw * 0.09;
      return (
        <g>
          {/* straps */}
          <path d={`M ${bx + (bw - strapW) / 2} ${by + 4} L ${bx + (bw + strapW) / 2} ${by + 4} L ${x + (W - strapW * 0.7) / 2 + strapW * 0.7} ${y} L ${x + (W - strapW * 0.7) / 2} ${y} Z`} fill={dark} />
          <path d={`M ${bx + (bw - strapW) / 2} ${by + bodyH - 4} L ${bx + (bw + strapW) / 2} ${by + bodyH - 4} L ${x + (W - strapW * 0.7) / 2 + strapW * 0.7} ${y + H} L ${x + (W - strapW * 0.7) / 2} ${y + H} Z`} fill={dark} />
          {/* body */}
          <path d={squircle(bx, by, bw, bodyH, bw * 0.28, sm)} fill={body} filter={shadow} />
          <path d={squircle(bx, by, bw, bodyH, bw * 0.28, sm)} fill="none" stroke={rim} strokeWidth={0.9} />
          {/* crown */}
          <rect x={bx + bw - 1} y={by + bodyH * 0.42} width={2.4} height={bodyH * 0.16} rx={1.2} fill={dark} />
          {screen(bx + bez, by + bez, bw - bez * 2, bodyH - bez * 2, bw * 0.2, shimmer)}
        </g>
      );
    }
    case "experimental": {
      // AR glasses
      const lensW = W * 0.36;
      const lensH = H * 0.62;
      const ly = y + (H - lensH) / 2;
      const lx1 = x + W * 0.05;
      const lx2 = x + W - W * 0.05 - lensW;
      const lens = (lxx: number) => (
        <g>
          <path d={squircle(lxx, ly, lensW, lensH, lensH * 0.38, sm)} fill={body} />
          <path d={squircle(lxx + 2, ly + 2, lensW - 4, lensH - 4, lensH * 0.34, sm)} fill={glow} />
          <path d={squircle(lxx + 2, ly + 2, lensW - 4, lensH - 4, lensH * 0.34, sm)} fill={sheen} />
          <path d={squircle(lxx, ly, lensW, lensH, lensH * 0.38, sm)} fill="none" stroke={rim} strokeWidth={1} />
        </g>
      );
      return (
        <g filter={shadow}>
          {/* temple arms */}
          <rect x={x} y={ly + lensH * 0.18} width={W} height={lensH * 0.14} rx={lensH * 0.07} fill={body} />
          {/* bridge */}
          <rect x={lx1 + lensW - 1} y={ly + lensH * 0.32} width={lx2 - (lx1 + lensW) + 2} height={lensH * 0.14} rx={2} fill={body} />
          {lens(lx1)}
          {lens(lx2)}
          <circle cx={lx2 + lensW * 0.8} cy={ly + lensH * 0.2} r={1.6} fill={acc} opacity={0.8} />
        </g>
      );
    }
    default: {
      // Generic rounded-rect device silhouette — guarantees a coherent shape (never a blank
      // <svg>) for any category that lacks a bespoke case. Honours the no-blank mandate.
      const bez = W * 0.06;
      const scH = H * 0.92;
      const sy = y + (H - scH) / 2;
      return (
        <g>
          <path d={squircle(x, sy, W, scH, 8, sm)} fill={body} filter={shadow} />
          <path d={squircle(x, sy, W, scH, 8, sm)} fill="none" stroke={rim} strokeWidth={0.9} />
          {screen(x + bez, sy + bez, W - bez * 2, scH - bez * 2, 4, shimmer)}
        </g>
      );
    }
  }
}

// ---------- helpers ----------
function shade(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (num >> 16) + amt;
  let gg = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  gg = Math.max(0, Math.min(255, gg));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, "0")}`;
}
