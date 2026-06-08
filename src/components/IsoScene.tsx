// The HQ garage — a detailed isometric vector scene. Pure SVG (zero image assets).
// Each employee is a distinct mascot robot (chassis colour, crest, module, mood) seated at a
// laptop that faces THEM. Ambient life: typing, sways, a 3D printer that runs while products
// sell, a swaying pendant lamp. The workspace grows with staff + facility tier.
//
// Drop in your own artwork? Put an SVG/PNG in `public/hq/` and set HQ_CUSTOM_ASSET below.
import { useId, type ReactNode } from "react";
import { MOOD_COLOR, moodBand } from "../engine/staff.ts";
import type { Staff } from "../engine/types.ts";
import { eyeShapeFor, robotLook, ROBOT_BODY, type EyeShape } from "./robotKit.ts";
import "./garage.css";

const HQ_CUSTOM_ASSET: string | null = null;

const OX = 170;
const OY = 116;
const HW = 32;
const TH = 16;
const WH = 92;
const G = 4;

type P = [number, number];
const iso = (c: number, r: number): P => [OX + (c - r) * HW, OY + (c + r) * TH];
const pts = (...ps: P[]) => ps.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

const A = iso(0, 0);
const B = iso(G, 0);
const C = iso(0, G);
const D = iso(G, G);
const ATOP: P = [A[0], A[1] - WH];
const rw = (t: number, u: number): P => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - u * WH];
const lw = (t: number, u: number): P => [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t - u * WH];

function hashNum(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function IsoBox({
  c, r, sc, sr, h, top, left, right,
}: { c: number; r: number; sc: number; sr: number; h: number; top: string; left: string; right: string }) {
  const p1 = iso(c - sc, r - sr);
  const p2 = iso(c + sc, r - sr);
  const p3 = iso(c + sc, r + sr);
  const p4 = iso(c - sc, r + sr);
  const up = (p: P): P => [p[0], p[1] - h];
  return (
    <g>
      <polygon points={pts(p4, p3, up(p3), up(p4))} fill={left} />
      <polygon points={pts(p2, p3, up(p3), up(p2))} fill={right} />
      <polygon points={pts(up(p1), up(p2), up(p3), up(p4))} fill={top} />
    </g>
  );
}

// ---- Workspace pod ----
const DESK_DC = 0.56; // wide but…
const DESK_DR = 0.3; // …shallow + low, so seated people stay visible
const DESK_H = 6;
const SIT = 6;
const DESKS: { c: number; r: number }[] = [
  { c: 1.45, r: 1.2 }, // founder
  { c: 3.0, r: 1.2 },
  { c: 1.45, r: 2.65 },
  { c: 3.0, r: 2.65 },
];

function Chair({ c, r, hue }: { c: number; r: number; hue: string }) {
  const [x, y] = iso(c, r);
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={5.4} ry={2.2} fill="rgba(0,0,0,0.1)" />
      {/* back (kept below head height so it frames the shoulders, not the head) */}
      <rect x={x - 5} y={y - 18} width={10} height={11} rx={3} fill="var(--g-chair-d)" />
      <rect x={x - 5} y={y - 12} width={10} height={3} rx={1.5} fill={hue} opacity={0.4} />
      <rect x={x - 5.4} y={y - 8} width={10.8} height={4.5} rx={2} fill="var(--g-chair)" />
    </g>
  );
}

// A distinct seated robot, facing the viewer, drawn from their appearance + mood. The team are
// mascot robots (never humans): a chassis torso with a glowing core, a metal neck ring, a rounded
// head with a dark face-screen visor + glowing eyes that track mood, and a mood-lit antenna.
function Person({ s, c, r }: { s: Staff; c: number; r: number }) {
  const [x, y] = iso(c, r);
  const look = robotLook(s.appearance);
  const band = moodBand(s.mood);
  const moodCol = MOOD_COLOR[band];
  const eyes = eyeShapeFor(band);
  const hn = hashNum(s.id);
  const dSway = `${(hn % 7) * 0.3}s`;
  const dArm = `${(hn % 5) * 0.22 + 0.1}s`;
  const dHead = `${(hn % 9) * 0.5}s`;

  const shoulderY = y - SIT - 14;
  const hr = 5; // head half-size
  const hcy = shoulderY - hr - 1.5; // head center y
  const eyeY = hcy + 0.4;

  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={7} ry={2.6} fill="rgba(0,0,0,0.16)" />
      <g className="g-person-sway" style={{ animationDelay: dSway }}>
        {/* arms (behind torso, reaching toward the desk) */}
        <g className="g-person-arms" style={{ animationDelay: dArm }}>
          <rect x={x - 8.4} y={shoulderY + 1} width={3.4} height={9} rx={1.7} fill={look.body} transform={`rotate(13 ${x - 6.7} ${shoulderY + 1})`} />
          <rect x={x + 5} y={shoulderY + 1} width={3.4} height={9} rx={1.7} fill={look.body} transform={`rotate(-13 ${x + 6.7} ${shoulderY + 1})`} />
        </g>
        {/* torso chassis + belly panel + glowing core */}
        <rect x={x - 6.6} y={shoulderY} width={13.2} height={14} rx={5} fill={look.body} />
        <rect x={x - 4.2} y={shoulderY + 2} width={8.4} height={8} rx={3} fill={look.belly} />
        <circle cx={x} cy={shoulderY + 6} r={1.5} fill={moodCol} opacity={0.9} />
        {/* metal neck ring */}
        <rect x={x - 2.4} y={shoulderY - 2.6} width={4.8} height={2.6} rx={1.3} fill={look.metal} />
        {/* head */}
        <g className="g-person-head" style={{ animationDelay: dHead }}>
          <RobotCrestMini style={look.headStyle} x={x} topY={hcy - hr} metal={look.metal} tip={moodCol} />
          <rect x={x - hr} y={hcy - hr + 0.5} width={hr * 2} height={hr * 2 - 0.5} rx={2.6} fill={look.body} />
          <rect x={x - hr + 0.6} y={hcy - hr + 1} width={hr * 2 - 1.2} height={1.4} rx={0.7} fill="#ffffff" opacity={0.14} />
          {/* face-screen visor */}
          <rect x={x - 3.8} y={eyeY - 1.9} width={7.6} height={4} rx={1.8} fill={look.dark} />
          <RobotSeatEyes shape={eyes} x={x} eyeY={eyeY} glow="#eaf6ff" accent={moodCol} />
          <RobotSeatModule accessory={look.accessory} x={x} cy={hcy} hr={hr} eyeY={eyeY} metal={look.metal} trim={look.trim} />
        </g>
      </g>
      {/* mood status dot */}
      <circle cx={x + hr - 0.5} cy={hcy - hr + 0.5} r={2} fill={moodCol} stroke="var(--surface)" strokeWidth={0.8} />
    </g>
  );
}

/** Antenna / crest variants for the seated robot, keyed by head style. */
function RobotCrestMini({ style, x, topY, metal, tip }: { style: number; x: number; topY: number; metal: string; tip: string }) {
  if (style === 5) return <rect x={x - 2.5} y={topY + 0.4} width={5} height={1.4} rx={0.7} fill={metal} />; // flat sensor strip
  if (style === 3) {
    return (
      <g>
        {[-2.6, 2.6].map((dx) => (
          <g key={dx}>
            <rect x={x + dx - 0.5} y={topY - 2.4} width={1} height={3.4} rx={0.5} fill={metal} />
            <circle cx={x + dx} cy={topY - 2.8} r={1.2} fill={tip} />
          </g>
        ))}
      </g>
    );
  }
  const stalkH = style === 1 ? 1.8 : 3.2;
  return (
    <g>
      <rect x={x - 0.5} y={topY - stalkH} width={1} height={stalkH} rx={0.5} fill={metal} />
      <circle cx={x} cy={topY - stalkH} r={1.4} fill={tip} />
    </g>
  );
}

/** Glowing eyes on the visor, shaped by mood. */
function RobotSeatEyes({ shape, x, eyeY, glow, accent }: { shape: EyeShape; x: number; eyeY: number; glow: string; accent: string }) {
  const dx = 1.9;
  if (shape === "happy") {
    const arc = (ex: number) => `M ${ex - 1} ${eyeY + 0.4} Q ${ex} ${eyeY - 1.1} ${ex + 1} ${eyeY + 0.4}`;
    return (
      <g stroke={glow} strokeWidth={0.9} strokeLinecap="round" fill="none">
        <path d={arc(x - dx)} />
        <path d={arc(x + dx)} />
      </g>
    );
  }
  if (shape === "tired" || shape === "off") {
    const op = shape === "off" ? 0.5 : 0.85;
    return (
      <g stroke={shape === "off" ? accent : glow} strokeWidth={0.9} strokeLinecap="round" opacity={op}>
        <line x1={x - dx - 0.8} y1={eyeY + 0.3} x2={x - dx + 0.8} y2={eyeY + 0.3} />
        <line x1={x + dx - 0.8} y1={eyeY + 0.3} x2={x + dx + 0.8} y2={eyeY + 0.3} />
      </g>
    );
  }
  const ry = shape === "wide" ? 1.3 : 0.95;
  return (
    <g fill={glow}>
      <ellipse cx={x - dx} cy={eyeY} rx={0.9} ry={ry} />
      <ellipse cx={x + dx} cy={eyeY} rx={0.9} ry={ry} />
    </g>
  );
}

/** Bolt-on modules for the seated robot, reinterpreting the stored accessory as hardware. */
function RobotSeatModule({ accessory, x, cy, hr, eyeY, metal, trim }: { accessory: Staff["appearance"]["accessory"]; x: number; cy: number; hr: number; eyeY: number; metal: string; trim: string }) {
  if (accessory === "glasses")
    return (
      <g stroke={trim} strokeWidth={0.4} fill="none" opacity={0.9}>
        <circle cx={x - 1.9} cy={eyeY} r={1.5} />
        <circle cx={x + 1.9} cy={eyeY} r={1.5} />
      </g>
    );
  if (accessory === "headphones")
    return (
      <g>
        <path d={`M ${x - hr - 0.6} ${cy} Q ${x} ${cy - hr - 3} ${x + hr + 0.6} ${cy}`} stroke={metal} strokeWidth={1.2} fill="none" />
        <rect x={x - hr - 1.8} y={cy - 1.3} width={2.2} height={3.8} rx={1} fill={metal} />
        <rect x={x + hr - 0.4} y={cy - 1.3} width={2.2} height={3.8} rx={1} fill={metal} />
      </g>
    );
  if (accessory === "cap")
    return <rect x={x - hr} y={cy - hr + 0.5} width={hr * 2} height={2} rx={1} fill={metal} opacity={0.9} />;
  if (accessory === "beanie")
    return <path d={`M ${x - hr} ${cy - hr + 2.5} Q ${x} ${cy - hr - 2.5} ${x + hr} ${cy - hr + 2.5} Z`} fill={metal} opacity={0.9} />;
  if (accessory === "earrings")
    return (
      <g fill={trim}>
        <circle cx={x - hr + 0.2} cy={eyeY + 1.6} r={0.7} />
        <circle cx={x + hr - 0.2} cy={eyeY + 1.6} r={0.7} />
      </g>
    );
  return null;
}

// A laptop that faces the seated person (we see the lid's back + a glow spill when on).
function Laptop({ x, topY, on }: { x: number; topY: number; on: boolean }) {
  const baseW = 17;
  const baseH = 2.6;
  const lidW = 16;
  const lidH = 9;
  return (
    <g>
      {on && <ellipse cx={x} cy={topY - lidH - baseH - 1} rx={12} ry={6} fill="var(--g-screen)" opacity={0.16} />}
      <rect x={x - baseW / 2} y={topY - baseH} width={baseW} height={baseH} rx={1} fill="var(--g-monitor-stand)" />
      <path
        d={`M ${x - lidW / 2} ${topY - baseH} L ${x + lidW / 2} ${topY - baseH} L ${x + lidW / 2 - 1.8} ${topY - baseH - lidH} L ${x - lidW / 2 + 1.8} ${topY - baseH - lidH} Z`}
        fill="var(--g-monitor)"
      />
      {on && <circle className="g-screen" cx={x} cy={topY - baseH - lidH / 2} r={1.7} fill="var(--g-screen)" />}
    </g>
  );
}

function Desk({ c, r }: { c: number; r: number }) {
  return <IsoBox c={c} r={r} sc={DESK_DC} sr={DESK_DR} h={DESK_H} top="var(--g-bench-top)" left="var(--g-bench-side)" right="var(--g-bench)" />;
}

interface Ent {
  d: number;
  k: string;
  n: ReactNode;
}

export function IsoScene({
  staff,
  staffCount,
  facilityTier,
  hasProduction,
  height = 250,
}: {
  staff?: Staff[];
  staffCount: number;
  facilityTier: number;
  hasProduction: boolean;
  height?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const team = staff ?? [];

  if (HQ_CUSTOM_ASSET) {
    return <img src={HQ_CUSTOM_ASSET} alt="Company headquarters" style={{ display: "block", width: "100%", height, objectFit: "contain" }} />;
  }

  // Garage sectional door (right-back wall)
  const doorPanels = [];
  const dT0 = 0.07;
  const dT1 = 0.96;
  for (let k = 0; k < 5; k++) {
    const u0 = 0.05 + k * 0.176;
    const u1 = u0 + 0.158;
    doorPanels.push(
      <polygon key={`dp${k}`} points={pts(rw(dT0, u0), rw(dT1, u0), rw(dT1, u1), rw(dT0, u1))} fill={k % 2 === 0 ? "var(--g-door)" : "var(--g-door-2)"} stroke="var(--g-door-line)" strokeWidth={0.6} />,
    );
  }
  const doorWindows = [0.18, 0.42, 0.66].map((t, i) => (
    <polygon key={`dw${i}`} points={pts(rw(t, 0.74), rw(t + 0.14, 0.74), rw(t + 0.14, 0.86), rw(t, 0.86))} fill={`url(#sky-${uid})`} stroke="var(--g-door-line)" strokeWidth={0.6} />
  ));

  // Pegboard (left-back wall)
  const pegDots = [];
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 4; j++) {
      const [px, py] = lw(0.17 + i * 0.07, 0.5 + j * 0.08);
      pegDots.push(<circle key={`pd${i}-${j}`} cx={px} cy={py} r={0.7} fill="var(--g-peg-hole)" />);
    }

  const occupants = Math.max(1, Math.min(DESKS.length, staffCount));
  const ents: Ent[] = [];

  // Boxes (back-left)
  ents.push({
    d: 0.6 + 0.6,
    k: "boxes",
    n: (
      <>
        <IsoBox c={0.6} r={0.6} sc={0.4} sr={0.4} h={18} top="var(--g-box-top)" left="var(--g-box-side)" right="var(--g-box)" />
        <IsoBox c={0.6} r={0.6} sc={0.32} sr={0.32} h={33} top="var(--g-box-top)" left="var(--g-box-side)" right="var(--g-box)" />
      </>
    ),
  });

  // Tool chest (back-right, storage)
  ents.push({
    d: 3.6 + 0.55,
    k: "chest",
    n: <IsoBox c={3.6} r={0.55} sc={0.4} sr={0.4} h={28} top="var(--g-chest-top)" left="var(--g-chest-side)" right="var(--g-chest)" />,
  });

  // 3D printer (front-left)
  {
    const [pcx, pcy] = iso(0.6, 3.5);
    ents.push({
      d: 0.6 + 3.5,
      k: "printer",
      n: (
        <>
          <IsoBox c={0.6} r={3.5} sc={0.34} sr={0.34} h={25} top="var(--g-metal)" left="var(--g-metal-d)" right="var(--g-metal)" />
          {hasProduction && (
            <>
              <rect className="g-print-head" x={pcx - 10} y={pcy - 21} width={6} height={3} rx={1} fill="var(--accent)" />
              <circle className="g-spark" cx={pcx} cy={pcy - 25} r={1.6} fill="var(--positive)" />
            </>
          )}
        </>
      ),
    });
  }

  // Plant (front-right)
  {
    const [plx, ply] = iso(3.5, 3.6);
    ents.push({
      d: 3.5 + 3.6,
      k: "plant",
      n: (
        <>
          <IsoBox c={3.5} r={3.6} sc={0.18} sr={0.18} h={9} top="var(--g-box-top)" left="var(--g-box-side)" right="var(--g-box)" />
          <circle cx={plx} cy={ply - 16} r={7} fill="var(--g-plant)" />
          <circle cx={plx - 5} cy={ply - 12} r={5} fill="var(--g-plant)" />
          <circle cx={plx + 5} cy={ply - 12} r={5} fill="var(--g-plant)" />
        </>
      ),
    });
  }

  // Desks: chair (back) → person (back) → desk → laptop (front)
  DESKS.forEach((dk, i) => {
    const occupied = i < occupants;
    const member = team[i];
    const personR = dk.r - DESK_DR + 0.12;
    const chairR = dk.r - DESK_DR - 0.18;
    const hue = member ? ROBOT_BODY[member.appearance.shirt % ROBOT_BODY.length] : "var(--g-chair-d)";
    ents.push({ d: dk.c + chairR, k: `chair${i}`, n: <Chair c={dk.c} r={chairR} hue={hue} /> });
    if (occupied && member) ents.push({ d: dk.c + personR, k: `person${i}`, n: <Person s={member} c={dk.c} r={personR} /> });
    ents.push({ d: dk.c + dk.r, k: `desk${i}`, n: <Desk c={dk.c} r={dk.r} /> });
    const [lx, lyBase] = iso(dk.c, dk.r + DESK_DR * 0.42);
    ents.push({ d: dk.c + dk.r + DESK_DR, k: `laptop${i}`, n: <Laptop x={lx} topY={lyBase - DESK_H} on={occupied} /> });
  });

  ents.sort((a, b) => a.d - b.d);

  return (
    <svg className="garage" viewBox="0 0 340 300" height={height} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Company workspace with ${staffCount} ${staffCount === 1 ? "robot" : "robots"}`}>
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe0ff" />
          <stop offset="1" stopColor="#7fb6f0" />
        </linearGradient>
        <radialGradient id={`pool-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--g-glow)" />
          <stop offset="1" stopColor="var(--g-glow)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`lamp-${uid}`} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0" stopColor="#fff6df" />
          <stop offset="1" stopColor="#ffd98a" />
        </radialGradient>
      </defs>

      {/* Floor */}
      <polygon points={pts(A, B, D, C)} fill="var(--g-floor)" />
      <polygon points={pts(iso(0, 0), iso(2, 0), iso(2, 2), iso(0, 2))} fill="var(--g-floor-2)" opacity="0.5" />
      {[1, 2, 3].map((i) => (
        <g key={`fl${i}`}>
          <line x1={iso(i, 0)[0]} y1={iso(i, 0)[1]} x2={iso(i, G)[0]} y2={iso(i, G)[1]} stroke="var(--g-floor-line)" strokeWidth={0.6} />
          <line x1={iso(0, i)[0]} y1={iso(0, i)[1]} x2={iso(G, i)[0]} y2={iso(G, i)[1]} stroke="var(--g-floor-line)" strokeWidth={0.6} />
        </g>
      ))}

      {/* Walls */}
      <polygon points={pts(A, B, [B[0], B[1] - WH], ATOP)} fill="var(--g-wall-r)" />
      <polygon points={pts(A, C, [C[0], C[1] - WH], ATOP)} fill="var(--g-wall-l)" />
      <polygon points={pts(ATOP, [B[0], B[1] - WH], [B[0], B[1] - WH - 4], [ATOP[0], ATOP[1] - 4])} fill="var(--g-wall-trim)" />
      <polygon points={pts(ATOP, [C[0], C[1] - WH], [C[0], C[1] - WH - 4], [ATOP[0], ATOP[1] - 4])} fill="var(--g-wall-trim)" />

      {/* Garage door (right wall) */}
      <polygon points={pts(rw(dT0, 0.04), rw(dT1, 0.04), rw(dT1, 0.94), rw(dT0, 0.94))} fill="var(--g-door-2)" stroke="var(--g-door-line)" strokeWidth={1} />
      {doorPanels}
      {doorWindows}

      {/* Window (left wall) */}
      <polygon points={pts(lw(0.64, 0.5), lw(0.9, 0.5), lw(0.9, 0.86), lw(0.64, 0.86))} fill={`url(#sky-${uid})`} stroke="var(--g-wall-trim)" strokeWidth={1.4} />
      <line x1={lw(0.77, 0.5)[0]} y1={lw(0.77, 0.5)[1]} x2={lw(0.77, 0.86)[0]} y2={lw(0.77, 0.86)[1]} stroke="var(--g-wall-trim)" strokeWidth={1} />
      <line x1={lw(0.64, 0.68)[0]} y1={lw(0.64, 0.68)[1]} x2={lw(0.9, 0.68)[0]} y2={lw(0.9, 0.68)[1]} stroke="var(--g-wall-trim)" strokeWidth={1} />

      {/* Pegboard (left wall) */}
      <polygon points={pts(lw(0.14, 0.46), lw(0.5, 0.46), lw(0.5, 0.86), lw(0.14, 0.86))} fill="var(--g-peg)" />
      {pegDots}
      <line x1={lw(0.2, 0.82)[0]} y1={lw(0.2, 0.82)[1]} x2={lw(0.2, 0.62)[0]} y2={lw(0.2, 0.62)[1]} stroke="var(--g-tool)" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={lw(0.2, 0.62)[0]} cy={lw(0.2, 0.62)[1]} r={2} fill="var(--g-tool)" />
      <rect x={lw(0.31, 0.8)[0] - 1.4} y={lw(0.31, 0.8)[1] - 14} width={2.8} height={14} rx={1} fill="var(--g-tool)" />
      <rect x={lw(0.31, 0.82)[0] - 4} y={lw(0.31, 0.82)[1] - 16} width={8} height={3} rx={1} fill="var(--g-tool)" />

      {/* Warm light pool */}
      <ellipse cx={150} cy={188} rx={88} ry={44} fill={`url(#pool-${uid})`} />

      {/* Pod rug (Studio+) */}
      {facilityTier > 1 && <ellipse cx={iso(2.2, 1.9)[0]} cy={iso(2.2, 1.9)[1] + 2} rx={72} ry={36} fill="var(--accent)" opacity="0.09" />}

      {/* Depth-sorted floor objects */}
      {ents.map((e) => (
        <g key={e.k}>{e.n}</g>
      ))}

      {/* Pendant lamp (ceiling) */}
      <line x1={170} y1={6} x2={158} y2={52} stroke="var(--g-metal-d)" strokeWidth={1.4} />
      <g className="g-lamp">
        <path d={`M148 52 L168 52 L164 64 L152 64 Z`} fill={`url(#lamp-${uid})`} />
        <ellipse cx={158} cy={64} rx={6} ry={2} fill="#fff6df" opacity="0.9" />
      </g>
    </svg>
  );
}
