// Front-on robot portrait for the roster — the team are friendly mascot robots, never humans.
// Same identity (Appearance + mood) as the isometric office figure and the 3D robots, drawn larger
// so personality reads: a rounded chassis head, dark face-screen visor with glowing eyes whose
// shape tracks mood, an antenna with a mood-coloured tip, and bolt-on modules from `accessory`.
// Pure SVG (zero image assets).
import { MOOD_COLOR, moodBand } from "../engine/staff.ts";
import type { Appearance } from "../engine/types.ts";
import { eyeShapeFor, robotLook, shade } from "./robotKit.ts";

export function Avatar({ appearance, mood, size = 44 }: { appearance: Appearance; mood: number; size?: number }) {
  const look = robotLook(appearance);
  const band = moodBand(mood);
  const moodCol = MOOD_COLOR[band];
  const eyes = eyeShapeFor(band);
  const id = `rb${look.body.slice(1)}${look.headStyle}${look.accessory}`;

  const cx = 22;
  const headCy = 18;
  // face-screen (visor) geometry
  const visorX = 12.5;
  const visorY = 13.5;
  const visorW = 19;
  const visorH = 10;
  const eyeY = visorY + visorH / 2;
  const eyeDX = 4.4;
  const eyeGlow = "#eaf6ff";

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label="Team robot">
      <defs>
        <clipPath id={id}>
          <circle cx={22} cy={22} r={21} />
        </clipPath>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(look.body, 0.16)} />
          <stop offset="1" stopColor={look.body} />
        </linearGradient>
      </defs>
      <circle cx={22} cy={22} r={21} fill="var(--bg-elevated)" />
      <g clipPath={`url(#${id})`}>
        {/* shoulders / chassis body */}
        <rect x={cx - 13} y={headCy + 12} width={26} height={20} rx={10} fill={look.body} />
        <rect x={cx - 9} y={headCy + 13} width={18} height={11} rx={7} fill={look.belly} />
        {/* glowing chest core */}
        <circle cx={cx} cy={headCy + 19.5} r={2.1} fill={moodCol} opacity={0.9} />
        {/* metallic neck ring */}
        <rect x={cx - 5} y={headCy + 9} width={10} height={4} rx={2} fill={look.metal} />

        {/* crest / antenna behind the head (mood-lit tip) */}
        <RobotCrest style={look.headStyle} cx={cx} topY={headCy - 11.5} metal={look.metal} tip={moodCol} trim={look.trim} />

        {/* head chassis (rounded squircle) */}
        <rect x={cx - 12} y={headCy - 11} width={24} height={23} rx={9} fill={`url(#${id}b)`} />
        {/* side bolt lights */}
        <circle cx={cx - 12.5} cy={headCy} r={1.6} fill={look.metal} />
        <circle cx={cx + 12.5} cy={headCy} r={1.6} fill={look.metal} />

        {/* face-screen visor */}
        <rect x={visorX} y={visorY} width={visorW} height={visorH} rx={5} fill={look.dark} />
        <rect x={visorX + 1} y={visorY + 1} width={visorW - 2} height={2.4} rx={1.2} fill="#ffffff" opacity={0.08} />
        {/* glowing eyes by mood */}
        <RobotEyes shape={eyes} cx={cx} eyeY={eyeY} dx={eyeDX} glow={eyeGlow} accent={moodCol} />

        {/* bolt-on modules */}
        <RobotModule
          accessory={look.accessory}
          cx={cx}
          headCy={headCy}
          visorY={visorY}
          visorH={visorH}
          metal={look.metal}
          trim={look.trim}
        />
      </g>
      {/* mood ring */}
      <circle cx={22} cy={22} r={21} fill="none" stroke={moodCol} strokeWidth={2.5} />
    </svg>
  );
}

/** Crest variants keyed by headStyle (derived from the stored hairstyle field). */
function RobotCrest({ style, cx, topY, metal, tip, trim }: { style: number; cx: number; topY: number; metal: string; tip: string; trim: string }) {
  if (style === 5) {
    // flat top — a low sensor strip, no antenna
    return <rect x={cx - 5} y={topY + 8} width={10} height={2.4} rx={1.2} fill={metal} />;
  }
  if (style === 2) {
    // dome knob
    return (
      <g>
        <rect x={cx - 1.4} y={topY + 4} width={2.8} height={5} rx={1.4} fill={metal} />
        <circle cx={cx} cy={topY + 3} r={3} fill={trim} stroke={metal} strokeWidth={0.8} />
      </g>
    );
  }
  if (style === 3) {
    // dual side antennae
    return (
      <g>
        {[-6, 6].map((dx) => (
          <g key={dx}>
            <rect x={cx + dx - 0.9} y={topY + 2} width={1.8} height={8} rx={0.9} fill={metal} />
            <circle cx={cx + dx} cy={topY + 1.5} r={2.2} fill={tip} />
          </g>
        ))}
      </g>
    );
  }
  if (style === 4) {
    // three-bar sensor crest
    return (
      <g>
        {[-4, 0, 4].map((dx, i) => (
          <rect key={dx} x={cx + dx - 1} y={topY + 3 + (i === 1 ? -1.5 : 0)} width={2} height={7} rx={1} fill={i === 1 ? tip : metal} />
        ))}
      </g>
    );
  }
  // 0 single antenna · 1 short stub
  const stalkH = style === 1 ? 4 : 8;
  return (
    <g>
      <rect x={cx - 0.9} y={topY + 10 - stalkH} width={1.8} height={stalkH} rx={0.9} fill={metal} />
      <circle cx={cx} cy={topY + 9 - stalkH} r={2.4} fill={tip} />
      <circle cx={cx} cy={topY + 9 - stalkH} r={1.1} fill="#ffffff" opacity={0.7} />
    </g>
  );
}

/** Glowing eyes whose shape conveys mood. */
function RobotEyes({ shape, cx, eyeY, dx, glow, accent }: { shape: ReturnType<typeof eyeShapeFor>; cx: number; eyeY: number; dx: number; glow: string; accent: string }) {
  if (shape === "happy") {
    // upward arcs — content
    const arc = (ex: number) => `M ${ex - 2.2} ${eyeY + 0.8} Q ${ex} ${eyeY - 2.4} ${ex + 2.2} ${eyeY + 0.8}`;
    return (
      <g stroke={glow} strokeWidth={1.7} strokeLinecap="round" fill="none">
        <path d={arc(cx - dx)} />
        <path d={arc(cx + dx)} />
      </g>
    );
  }
  if (shape === "tired" || shape === "off") {
    // narrowed dashes — low energy (dimmer when burned out)
    const op = shape === "off" ? 0.55 : 0.9;
    return (
      <g stroke={shape === "off" ? accent : glow} strokeWidth={1.8} strokeLinecap="round" opacity={op}>
        <line x1={cx - dx - 1.7} y1={eyeY + 0.6} x2={cx - dx + 1.7} y2={eyeY + 0.6} />
        <line x1={cx + dx - 1.7} y1={eyeY + 0.6} x2={cx + dx + 1.7} y2={eyeY + 0.6} />
      </g>
    );
  }
  // wide (tall ovals) or neutral (round dots)
  const ry = shape === "wide" ? 2.6 : 1.8;
  return (
    <g fill={glow}>
      <ellipse cx={cx - dx} cy={eyeY} rx={1.8} ry={ry} />
      <ellipse cx={cx + dx} cy={eyeY} rx={1.8} ry={ry} />
    </g>
  );
}

/** Bolt-on modules, reinterpreting the stored accessory as robot hardware. */
function RobotModule({
  accessory, cx, headCy, visorY, visorH, metal, trim,
}: {
  accessory: Appearance["accessory"];
  cx: number; headCy: number; visorY: number; visorH: number; metal: string; trim: string;
}) {
  if (accessory === "glasses") {
    // goggle rings framing the eyes
    const eyeY = visorY + visorH / 2;
    return (
      <g stroke={trim} strokeWidth={1} fill="none" opacity={0.9}>
        <circle cx={cx - 4.4} cy={eyeY} r={3.2} />
        <circle cx={cx + 4.4} cy={eyeY} r={3.2} />
        <line x1={cx - 1.2} y1={eyeY} x2={cx + 1.2} y2={eyeY} />
      </g>
    );
  }
  if (accessory === "headphones") {
    // side audio cans + headband
    return (
      <g>
        <path d={`M ${cx - 12.5} ${headCy} Q ${cx} ${headCy - 16} ${cx + 12.5} ${headCy}`} stroke={metal} strokeWidth={2.4} fill="none" />
        <rect x={cx - 15.5} y={headCy - 3} width={5} height={9} rx={2.4} fill={metal} />
        <rect x={cx + 10.5} y={headCy - 3} width={5} height={9} rx={2.4} fill={metal} />
        <circle cx={cx - 13} cy={headCy + 1.5} r={1} fill={trim} />
        <circle cx={cx + 13} cy={headCy + 1.5} r={1} fill={trim} />
      </g>
    );
  }
  if (accessory === "cap") {
    // top plate visor
    return <rect x={cx - 12} y={headCy - 11} width={24} height={5} rx={4} fill={metal} opacity={0.9} />;
  }
  if (accessory === "beanie") {
    // dome cap
    return (
      <g>
        <path d={`M ${cx - 12} ${headCy - 6} Q ${cx} ${headCy - 18} ${cx + 12} ${headCy - 6} Z`} fill={metal} opacity={0.9} />
        <rect x={cx - 12} y={headCy - 7.5} width={24} height={2.6} rx={1.3} fill="#ffffff" opacity={0.16} />
      </g>
    );
  }
  if (accessory === "earrings") {
    // stud bolts low on the head sides
    return (
      <g fill={trim}>
        <circle cx={cx - 11.5} cy={headCy + 6} r={1.4} />
        <circle cx={cx + 11.5} cy={headCy + 6} r={1.4} />
      </g>
    );
  }
  return null;
}
