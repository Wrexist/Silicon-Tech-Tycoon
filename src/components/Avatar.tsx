// Front-on character avatar for the roster — same identity (appearance + mood) as the
// isometric figure, drawn larger so personality reads. Pure SVG.
import { DEFAULT_APPEARANCE, HAIR_COLORS, MOOD_COLOR, moodBand, SHIRT_COLORS, SKIN_TONES } from "../engine/staff.ts";
import type { Appearance } from "../engine/types.ts";

export function Avatar({ appearance, mood, size = 44 }: { appearance: Appearance; mood: number; size?: number }) {
  const a = appearance ?? DEFAULT_APPEARANCE;
  const skin = SKIN_TONES[a.skin % SKIN_TONES.length];
  const hair = HAIR_COLORS[a.hairColor % HAIR_COLORS.length];
  const shirt = SHIRT_COLORS[a.shirt % SHIRT_COLORS.length];
  const band = moodBand(mood);
  const id = `av${a.skin}${a.hair}${a.hairColor}${a.shirt}${a.accessory}`;
  const cx = 22;
  const headCy = 19;
  const hr = 11;
  const eyeY = headCy + 1;
  const dark = "#2a2623";

  let mouth: string;
  if (band === "thriving" || band === "happy") mouth = `M ${cx - 4} ${headCy + 6} Q ${cx} ${headCy + 10} ${cx + 4} ${headCy + 6}`;
  else if (band === "neutral") mouth = `M ${cx - 3.2} ${headCy + 7} L ${cx + 3.2} ${headCy + 7}`;
  else if (band === "tired") mouth = `M ${cx - 3.2} ${headCy + 7.6} Q ${cx} ${headCy + 6} ${cx + 3.2} ${headCy + 7.6}`;
  else mouth = `M ${cx - 4} ${headCy + 8.5} Q ${cx} ${headCy + 4.5} ${cx + 4} ${headCy + 8.5}`;

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" role="img" aria-label="Avatar">
      <defs>
        <clipPath id={id}>
          <circle cx={22} cy={22} r={21} />
        </clipPath>
      </defs>
      <circle cx={22} cy={22} r={21} fill="var(--bg-elevated)" />
      <g clipPath={`url(#${id})`}>
        {/* shoulders / shirt */}
        <rect x={cx - 13} y={headCy + 11} width={26} height={20} rx={9} fill={shirt} />
        <rect x={cx - 13} y={headCy + 11} width={26} height={6} rx={3} fill="#ffffff" opacity={0.12} />
        {/* hair back */}
        {a.hair !== 5 && <circle cx={cx} cy={headCy - 1.5} r={hr + (a.hair === 1 ? 0.8 : 1.8)} fill={hair} />}
        {/* head */}
        <circle cx={cx} cy={headCy} r={hr} fill={skin} />
        {/* fringe / styles */}
        {a.hair !== 5 && a.hair !== 1 && a.hair !== 2 && (
          <path d={`M ${cx - hr} ${headCy - 3} Q ${cx - 2} ${headCy - hr - 2} ${cx + hr} ${headCy - 5} L ${cx + hr} ${headCy - hr} L ${cx - hr} ${headCy - hr} Z`} fill={hair} />
        )}
        {a.hair === 2 && <circle cx={cx} cy={headCy - hr - 2} r={4} fill={hair} />}
        {a.hair === 3 && (
          <g fill={hair}>
            <rect x={cx - hr - 1} y={headCy - 2} width={4.5} height={18} rx={2} />
            <rect x={cx + hr - 3.5} y={headCy - 2} width={4.5} height={18} rx={2} />
          </g>
        )}
        {a.hair === 4 && [-1, 0, 1].map((i) => <circle key={i} cx={cx + i * 6.5} cy={headCy - hr + 1} r={4.2} fill={hair} />)}
        {/* eyes */}
        <circle cx={cx - 3.8} cy={eyeY} r={1.5} fill={dark} />
        <circle cx={cx + 3.8} cy={eyeY} r={1.5} fill={dark} />
        {/* mouth */}
        <path d={mouth} stroke="#7a4a3a" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        {/* accessories */}
        {a.accessory === "glasses" && (
          <g stroke={dark} strokeWidth={1.2} fill="rgba(255,255,255,0.12)">
            <circle cx={cx - 3.8} cy={eyeY} r={3.4} />
            <circle cx={cx + 3.8} cy={eyeY} r={3.4} />
            <line x1={cx - 0.4} y1={eyeY} x2={cx + 0.4} y2={eyeY} />
          </g>
        )}
        {a.accessory === "headphones" && (
          <g>
            <path d={`M ${cx - hr - 2} ${headCy} Q ${cx} ${headCy - hr - 7} ${cx + hr + 2} ${headCy}`} stroke={dark} strokeWidth={3} fill="none" />
            <rect x={cx - hr - 4} y={headCy - 3} width={5} height={9} rx={2} fill={dark} />
            <rect x={cx + hr - 1} y={headCy - 3} width={5} height={9} rx={2} fill={dark} />
          </g>
        )}
        {a.accessory === "cap" && (
          <g>
            <path d={`M ${cx - hr - 1} ${headCy - hr + 2} Q ${cx} ${headCy - hr - 7} ${cx + hr + 1} ${headCy - hr + 2} Z`} fill={shirt} />
            <rect x={cx - hr - 6} y={headCy - hr + 1} width={8} height={3.4} rx={1.5} fill={shirt} />
          </g>
        )}
        {a.accessory === "beanie" && (
          <g>
            <path d={`M ${cx - hr - 1} ${headCy - 1} Q ${cx} ${headCy - hr - 8} ${cx + hr + 1} ${headCy - 1} Z`} fill={shirt} />
            <rect x={cx - hr - 1} y={headCy - 3} width={hr * 2 + 2} height={4} rx={2} fill="#ffffff" opacity={0.18} />
          </g>
        )}
        {a.accessory === "earrings" && (
          <g fill="#d4af37">
            <circle cx={cx - hr + 0.5} cy={eyeY + 4} r={1.5} />
            <circle cx={cx + hr - 0.5} cy={eyeY + 4} r={1.5} />
          </g>
        )}
      </g>
      {/* mood ring */}
      <circle cx={22} cy={22} r={21} fill="none" stroke={MOOD_COLOR[band]} strokeWidth={2.5} />
    </svg>
  );
}
