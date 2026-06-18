// Flat front-elevation vector "showroom" thumbnails for every shop furniture piece — so the
// office shop shows what each item LOOKS like instead of a generic glyph. Pure SVG (zero image
// assets, per the design pillars). Theme-aware via the token palette in furnitureThumb.css.
//
// Style: clean catalog product-shot — soft contact shadow, rounded fills, one signature detail
// per piece. Coordinate space is a 48×40 viewBox; the floor baseline sits at y=35, centre x=24.
import { type ReactNode } from "react";
import type { FurnitureId } from "../engine/furniture.ts";
import "./furnitureThumb.css";

const W = 48;
const H = 40;
const FLOOR = 35;
const CX = 24;

/* ---------- shared primitives ---------- */

function Shadow({ rx = 14 }: { rx?: number }) {
  return <ellipse cx={CX} cy={FLOOR + 1.6} rx={rx} ry={2.3} fill="var(--ft-shadow)" />;
}

/** Flat slab (desk/table top, shelf, counter lip). */
function Slab({ y, h = 3, hw = 16, fill = "var(--ft-wood)", rx = 1.4 }: { y: number; h?: number; hw?: number; fill?: string; rx?: number }) {
  return <rect x={CX - hw} y={y} width={hw * 2} height={h} rx={rx} fill={fill} />;
}

/** Two legs dropping from a top slab to the floor. */
function Legs({ top, hw = 14, fill = "var(--ft-leg)", t = 2.2, inset = 1 }: { top: number; hw?: number; fill?: string; t?: number; inset?: number }) {
  return (
    <>
      <rect x={CX - hw + inset} y={top} width={t} height={FLOOR - top} rx={0.6} fill={fill} />
      <rect x={CX + hw - inset - t} y={top} width={t} height={FLOOR - top} rx={0.6} fill={fill} />
    </>
  );
}

/** A screen on a stand (monitor). */
function Monitor({ cx = CX, y = 8, w = 13, h = 9 }: { cx?: number; y?: number; w?: number; h?: number }) {
  return (
    <>
      <rect x={cx - w / 2} y={y} width={w} height={h} rx={1.4} fill="var(--ft-frame)" />
      <rect x={cx - w / 2 + 1.2} y={y + 1.2} width={w - 2.4} height={h - 2.4} rx={0.8} fill="var(--ft-screen)" />
      <rect x={cx - 1} y={y + h} width={2} height={2.4} fill="var(--ft-metal-d)" />
    </>
  );
}

/** Trapezoid plant pot. */
function Pot({ hw = 5, top = 27, fill = "var(--ft-pot)" }: { hw?: number; top?: number; fill?: string }) {
  return <path d={`M ${CX - hw} ${top} L ${CX + hw} ${top} L ${CX + hw - 1.4} ${FLOOR} L ${CX - hw + 1.4} ${FLOOR} Z`} fill={fill} />;
}

/** A solid box from the floor up (cabinets, machines). */
function Box({ y, hw = 10, fill = "var(--ft-panel)", rx = 1.6, bottom = FLOOR }: { y: number; hw?: number; fill?: string; rx?: number; bottom?: number }) {
  return <rect x={CX - hw} y={y} width={hw * 2} height={bottom - y} rx={rx} fill={fill} />;
}

/* ---------- per-piece recipes ---------- */

const DRAW: Record<FurnitureId, () => ReactNode> = {
  // ---- Desks ----
  desk: () => (<><Shadow /><Monitor y={9} /><Legs top={20} hw={15} /><Slab y={19} hw={16} /></>),
  deskL: () => (<><Shadow rx={15} /><Monitor cx={20} y={9} w={12} /><Legs top={20} hw={15} /><Slab y={19} hw={16} /><rect x={32} y={22} width={9} height={3} rx={1.2} fill="var(--ft-wood-d)" /><rect x={37} y={25} width={2} height={10} rx={0.6} fill="var(--ft-leg)" /></>),
  standingDesk: () => (<><Shadow rx={13} /><Monitor y={4} /><rect x={CX - 1.4} y={15} width={2.8} height={2} fill="var(--ft-metal-d)" /><Legs top={15} hw={14} t={2.6} /><Slab y={14} hw={15} /></>),
  dualDesk: () => (<><Shadow rx={15} /><Monitor cx={17} y={9} w={11} h={8} /><Monitor cx={31} y={9} w={11} h={8} /><Legs top={20} hw={15} /><Slab y={19} hw={16} /></>),
  reception: () => (<><Shadow rx={16} /><Box y={17} hw={16} fill="var(--ft-wood-d)" rx={2} /><Slab y={14} hw={17} h={3.4} fill="var(--ft-wood)" /><rect x={CX - 12} y={20} width={24} height={2} rx={1} fill="var(--ft-accent)" opacity={0.5} /></>),
  executiveDesk: () => (<><Shadow rx={17} /><Monitor cx={20} y={8} w={12} /><Slab y={18} hw={17} h={3.4} /><Box y={22} hw={5} fill="var(--ft-wood-d)" /><rect x={CX + 7} y={22} width={9} height={13} rx={1.4} fill="var(--ft-wood-d)" /></>),

  // ---- Seating ----
  chair: () => (<><Shadow rx={9} /><rect x={CX - 6} y={11} width={5} height={11} rx={2} fill="var(--ft-fabric-d)" /><rect x={CX - 7} y={20} width={14} height={4} rx={2} fill="var(--ft-fabric)" /><rect x={CX - 1} y={24} width={2} height={6} fill="var(--ft-metal-d)" /><path d="M16 35 L24 30 L32 35" stroke="var(--ft-metal-d)" strokeWidth={2} fill="none" strokeLinecap="round" /></>),
  armchair: () => (<><Shadow rx={11} /><rect x={CX - 9} y={14} width={18} height={11} rx={3} fill="var(--ft-fabric-d)" /><rect x={CX - 9} y={20} width={4} height={13} rx={2} fill="var(--ft-fabric)" /><rect x={CX + 5} y={20} width={4} height={13} rx={2} fill="var(--ft-fabric)" /><rect x={CX - 5} y={21} width={10} height={6} rx={2} fill="var(--ft-fabric)" /></>),
  sofa: () => (<><Shadow rx={16} /><rect x={CX - 16} y={15} width={32} height={10} rx={3} fill="var(--ft-fabric-d)" /><rect x={CX - 16} y={20} width={5} height={13} rx={2.4} fill="var(--ft-fabric)" /><rect x={CX + 11} y={20} width={5} height={13} rx={2.4} fill="var(--ft-fabric)" /><rect x={CX - 10} y={21} width={9} height={7} rx={2} fill="var(--ft-fabric)" /><rect x={CX + 1} y={21} width={9} height={7} rx={2} fill="var(--ft-fabric)" /></>),
  stool: () => (<><Shadow rx={7} /><ellipse cx={CX} cy={20} rx={7} ry={2.6} fill="var(--ft-fabric)" /><rect x={CX - 1} y={21} width={2} height={13} fill="var(--ft-metal-d)" /><ellipse cx={CX} cy={34} rx={5} ry={1.6} fill="var(--ft-metal-d)" /></>),
  beanbag: () => (<><Shadow rx={12} /><path d="M11 33 Q9 20 24 19 Q39 20 37 33 Z" fill="var(--ft-fabric-d)" /><path d="M16 26 Q24 22 32 26" stroke="var(--ft-fabric)" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} /></>),
  gamingChair: () => (<><Shadow rx={9} /><rect x={CX - 6} y={8} width={12} height={15} rx={3.5} fill="var(--ft-fabric-d)" /><rect x={CX - 3.5} y={10} width={7} height={11} rx={2} fill="var(--ft-accent)" opacity={0.55} /><rect x={CX - 7} y={21} width={14} height={4} rx={2} fill="var(--ft-fabric-d)" /><rect x={CX - 1} y={25} width={2} height={5} fill="var(--ft-metal-d)" /><path d="M16 35 L24 30 L32 35" stroke="var(--ft-metal-d)" strokeWidth={2} fill="none" strokeLinecap="round" /></>),
  bench: () => (<><Shadow rx={15} /><Slab y={22} hw={15} h={4} fill="var(--ft-wood)" /><Legs top={26} hw={13} /></>),
  loungeChair: () => (<><Shadow rx={12} /><path d="M12 33 L14 18 L22 22 L36 22 L36 33 Z" fill="var(--ft-fabric-d)" /><rect x={20} y={20} width={16} height={4} rx={2} fill="var(--ft-fabric)" /><rect x={14} y={31} width={22} height={3} rx={1.4} fill="var(--ft-metal-d)" /></>),
  sofaL: () => (<><Shadow rx={16} /><rect x={CX - 16} y={15} width={22} height={10} rx={3} fill="var(--ft-fabric-d)" /><rect x={CX + 4} y={15} width={12} height={18} rx={3} fill="var(--ft-fabric-d)" /><rect x={CX - 16} y={20} width={5} height={13} rx={2.4} fill="var(--ft-fabric)" /><rect x={CX - 10} y={21} width={9} height={7} rx={2} fill="var(--ft-fabric)" /></>),

  // ---- Tables ----
  coffeeTable: () => (<><Shadow rx={13} /><Slab y={24} hw={13} h={3} /><Legs top={27} hw={11} /></>),
  meetingTable: () => (<><Shadow rx={17} /><Slab y={20} hw={17} h={3.4} /><Legs top={23} hw={15} /></>),
  roundTable: () => (<><Shadow rx={12} /><ellipse cx={CX} cy={21} rx={13} ry={3.4} fill="var(--ft-wood)" /><rect x={CX - 1.2} y={23} width={2.4} height={12} fill="var(--ft-metal-d)" /><ellipse cx={CX} cy={34} rx={7} ry={1.8} fill="var(--ft-metal-d)" /></>),
  sideTable: () => (<><Shadow rx={8} /><Slab y={24} hw={8} h={3} /><Legs top={27} hw={6.5} /></>),
  barTable: () => (<><Shadow rx={9} /><ellipse cx={CX} cy={13} rx={9} ry={2.6} fill="var(--ft-wood)" /><rect x={CX - 1.4} y={15} width={2.8} height={19} fill="var(--ft-metal-d)" /><ellipse cx={CX} cy={34} rx={6} ry={1.8} fill="var(--ft-metal-d)" /></>),

  // ---- Storage ----
  bookshelf: () => (<><Shadow rx={10} /><Box y={12} hw={9} fill="var(--ft-panel)" /><rect x={CX - 7} y={15} width={4} height={6} fill="var(--ft-accent)" /><rect x={CX - 2.5} y={15} width={4} height={6} fill="var(--ft-plant)" /><rect x={CX + 2} y={15} width={4} height={6} fill="var(--ft-wood)" /><rect x={CX - 7} y={25} width={14} height={1.6} fill="var(--ft-panel-d)" /></>),
  cabinet: () => (<><Shadow rx={12} /><Box y={20} hw={12} fill="var(--ft-panel)" /><rect x={CX - 0.6} y={21} width={1.2} height={14} fill="var(--ft-panel-d)" /><circle cx={CX - 3} cy={28} r={1} fill="var(--ft-metal-d)" /><circle cx={CX + 3} cy={28} r={1} fill="var(--ft-metal-d)" /></>),
  lockers: () => (<><Shadow rx={9} /><Box y={11} hw={8} fill="var(--ft-panel)" /><rect x={CX - 0.6} y={12} width={1.2} height={23} fill="var(--ft-panel-d)" /><rect x={CX - 5} y={15} width={3} height={1.6} fill="var(--ft-metal-d)" /><rect x={CX + 2} y={15} width={3} height={1.6} fill="var(--ft-metal-d)" /></>),
  filingCabinet: () => (<><Shadow rx={8} /><Box y={16} hw={8} fill="var(--ft-panel)" />{[19, 25, 31].map((y) => (<g key={y}><rect x={CX - 6} y={y} width={12} height={4} rx={1} fill="var(--ft-panel-d)" /><rect x={CX - 2} y={y + 1.4} width={4} height={1.2} rx={0.6} fill="var(--ft-metal-d)" /></g>))}</>),
  shelfUnit: () => (<><Shadow rx={9} /><rect x={CX - 9} y={12} width={2} height={23} fill="var(--ft-panel-d)" /><rect x={CX + 7} y={12} width={2} height={23} fill="var(--ft-panel-d)" />{[14, 21, 28].map((y) => <rect key={y} x={CX - 9} y={y} width={18} height={2} fill="var(--ft-panel)" />)}</>),
  crates: () => (<><Shadow rx={11} /><rect x={CX - 9} y={24} width={11} height={11} rx={1.4} fill="var(--ft-wood)" /><rect x={CX + 1} y={20} width={10} height={15} rx={1.4} fill="var(--ft-wood-d)" /><path d="M16 24 L21.5 30.5 M21.5 24 L16 30.5" stroke="var(--ft-panel-d)" strokeWidth={1} /></>),
  wardrobe: () => (<><Shadow rx={11} /><Box y={10} hw={11} fill="var(--ft-panel)" /><rect x={CX - 0.6} y={11} width={1.2} height={24} fill="var(--ft-panel-d)" /><rect x={CX - 3} y={20} width={1.4} height={5} rx={0.7} fill="var(--ft-metal-d)" /><rect x={CX + 1.6} y={20} width={1.4} height={5} rx={0.7} fill="var(--ft-metal-d)" /></>),

  // ---- Plants ----
  plantTall: () => (<><Shadow rx={7} /><Pot hw={4.5} top={28} />{[-6, 0, 6].map((dx, i) => (<path key={i} d={`M${CX} 28 Q${CX + dx * 1.6} ${18 - i} ${CX + dx} ${8 + i * 2}`} stroke="var(--ft-plant)" strokeWidth={3} fill="none" strokeLinecap="round" />))}</>),
  plantPot: () => (<><Shadow rx={7} /><Pot hw={5} top={27} /><circle cx={CX} cy={19} r={7} fill="var(--ft-plant)" /><circle cx={CX - 5} cy={22} r={5} fill="var(--ft-plant-d)" /><circle cx={CX + 5} cy={22} r={5} fill="var(--ft-plant-d)" /></>),
  cactus: () => (<><Shadow rx={6} /><Pot hw={4.5} top={28} /><rect x={CX - 2.6} y={12} width={5.2} height={18} rx={2.6} fill="var(--ft-plant)" /><rect x={CX - 7} y={18} width={4} height={3.4} rx={1.7} fill="var(--ft-plant)" /><rect x={CX - 8} y={15} width={3.4} height={5} rx={1.7} fill="var(--ft-plant)" /><rect x={CX + 4} y={20} width={4} height={3.4} rx={1.7} fill="var(--ft-plant)" /></>),
  planterBox: () => (<><Shadow rx={13} /><rect x={CX - 12} y={26} width={24} height={9} rx={1.6} fill="var(--ft-pot)" />{[-7, 0, 7].map((dx, i) => <circle key={i} cx={CX + dx} cy={21 - (i % 2) * 2} r={5} fill={i % 2 ? "var(--ft-plant-d)" : "var(--ft-plant)"} />)}</>),
  monstera: () => (<><Shadow rx={7} /><Pot hw={4.5} top={28} /><path d="M24 28 Q12 24 14 12 Q24 14 24 28" fill="var(--ft-plant)" /><path d="M24 28 Q36 24 34 12 Q24 14 24 28" fill="var(--ft-plant-d)" /><path d="M18 14 L20 18 M30 14 L28 18" stroke="var(--ft-pot)" strokeWidth={0.8} /></>),
  bonsai: () => (<><Shadow rx={8} /><rect x={CX - 8} y={29} width={16} height={6} rx={1.6} fill="var(--ft-pot)" /><rect x={CX - 1} y={20} width={2} height={10} fill="var(--ft-wood-d)" /><ellipse cx={CX - 4} cy={18} rx={6} ry={4} fill="var(--ft-plant)" /><ellipse cx={CX + 5} cy={19} rx={5} ry={3.5} fill="var(--ft-plant-d)" /></>),

  // ---- Decor ----
  rug: () => (<><ellipse cx={CX} cy={30} rx={17} ry={6} fill="var(--ft-fabric-d)" /><ellipse cx={CX} cy={30} rx={12} ry={4} fill="none" stroke="var(--ft-accent)" strokeWidth={1.4} opacity={0.6} /></>),
  rugRound: () => (<><ellipse cx={CX} cy={30} rx={14} ry={6} fill="var(--ft-fabric)" /><ellipse cx={CX} cy={30} rx={9} ry={3.6} fill="var(--ft-fabric-d)" /><ellipse cx={CX} cy={30} rx={4} ry={1.6} fill="var(--ft-accent)" opacity={0.6} /></>),
  tvStand: () => (<><Shadow rx={15} /><rect x={CX - 13} y={9} width={26} height={15} rx={2} fill="var(--ft-frame)" /><rect x={CX - 11} y={11} width={22} height={11} rx={1} fill="var(--ft-screen)" /><Slab y={28} hw={11} h={4} fill="var(--ft-wood-d)" /></>),
  easel: () => (<><Shadow rx={11} /><rect x={CX - 11} y={8} width={22} height={15} rx={1.6} fill="var(--ft-board)" /><path d="M30 24 L18 30 M30 24 L24 35 M18 30 L18 35" stroke="var(--ft-metal-d)" strokeWidth={1.6} fill="none" strokeLinecap="round" /><path d="M19 14 L23 18 L29 11" stroke="var(--ft-accent)" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>),
  neonSign: () => (<><Shadow rx={10} /><rect x={CX - 11} y={14} width={22} height={4} rx={1} fill="var(--ft-metal-d)" /><path d="M16 13 L23 13 L20 19 L28 19 L19 28 L22 21 L15 21 Z" fill="var(--ft-accent)" stroke="var(--ft-accent)" strokeWidth={1.4} strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 2px var(--ft-accent))" }} /></>),
  artStand: () => (<><Shadow rx={9} /><rect x={CX - 9} y={9} width={18} height={20} rx={1.4} fill="var(--ft-frame)" /><rect x={CX - 7} y={11} width={14} height={16} rx={0.8} fill="var(--ft-board)" /><circle cx={CX - 2} cy={17} r={2.4} fill="var(--ft-accent)" /><path d="M18 24 L23 19 L30 24" stroke="var(--ft-plant)" strokeWidth={1.6} fill="none" /><rect x={CX - 1} y={29} width={2} height={6} fill="var(--ft-metal-d)" /></>),
  globe: () => (<><Shadow rx={8} /><circle cx={CX} cy={16} r={9} fill="var(--ft-screen)" /><path d="M15 16 Q24 12 33 16 M15 16 Q24 20 33 16 M24 7 L24 25" stroke="var(--ft-frame)" strokeWidth={0.8} fill="none" opacity={0.6} /><path d="M24 25 L20 34 L28 34 Z" fill="var(--ft-wood-d)" /></>),
  floorClock: () => (<><Shadow rx={7} /><rect x={CX - 6} y={6} width={12} height={29} rx={2} fill="var(--ft-wood-d)" /><circle cx={CX} cy={14} r={4.4} fill="var(--ft-board)" /><path d="M24 14 L24 11 M24 14 L26.5 15.5" stroke="var(--ft-metal-d)" strokeWidth={1} strokeLinecap="round" /></>),
  sculpture: () => (<><Shadow rx={8} /><rect x={CX - 7} y={31} width={14} height={4} rx={1} fill="var(--ft-panel-d)" /><circle cx={CX} cy={12} r={5} fill="var(--ft-accent)" /><path d="M19 31 Q24 18 29 31 Z" fill="var(--ft-metal)" /><circle cx={CX} cy={12} r={5} fill="none" stroke="var(--ft-metal-d)" strokeWidth={0.6} /></>),
  divider: () => (<><Shadow rx={14} /><rect x={CX - 14} y={11} width={9} height={24} rx={1.4} fill="var(--ft-panel)" /><rect x={CX - 4.5} y={9} width={9} height={26} rx={1.4} fill="var(--ft-panel-d)" /><rect x={CX + 5} y={11} width={9} height={24} rx={1.4} fill="var(--ft-panel)" /></>),
  floorVase: () => (<><Shadow rx={7} /><path d="M20 35 Q16 24 22 18 Q19 12 24 9 Q29 12 26 18 Q32 24 28 35 Z" fill="var(--ft-pot)" /><path d="M24 9 Q24 14 24 18" stroke="var(--ft-plant)" strokeWidth={2} strokeLinecap="round" /></>),

  // ---- Lighting ----
  floorLamp: () => (<><Shadow rx={7} /><ellipse cx={CX} cy={12} rx={2} ry={2} fill="var(--ft-glow)" /><path d="M19 13 L29 13 L26 6 L22 6 Z" fill="var(--ft-shade)" /><rect x={CX - 1} y={13} width={2} height={20} fill="var(--ft-metal-d)" /><ellipse cx={CX} cy={34} rx={6} ry={1.8} fill="var(--ft-metal-d)" /></>),
  arcLamp: () => (<><Shadow rx={9} /><path d="M16 34 Q16 8 30 9" stroke="var(--ft-metal-d)" strokeWidth={2} fill="none" strokeLinecap="round" /><path d="M27 9 L33 9 L31.5 15 L28.5 15 Z" fill="var(--ft-shade)" /><ellipse cx={30} cy={16} rx={2} ry={1.4} fill="var(--ft-glow)" /><ellipse cx={16} cy={34} rx={6} ry={1.8} fill="var(--ft-metal-d)" /></>),
  lantern: () => (<><Shadow rx={6} /><rect x={CX - 1} y={20} width={2} height={14} fill="var(--ft-metal-d)" /><ellipse cx={CX} cy={34} rx={5} ry={1.6} fill="var(--ft-metal-d)" /><rect x={CX - 5} y={11} width={10} height={11} rx={1.6} fill="var(--ft-shade)" /><rect x={CX - 3} y={13} width={6} height={7} rx={1} fill="var(--ft-glow)" /></>),
  cubeLamp: () => (<><Shadow rx={8} /><rect x={CX - 8} y={19} width={16} height={16} rx={2.4} fill="var(--ft-glow)" /><rect x={CX - 8} y={19} width={16} height={16} rx={2.4} fill="none" stroke="var(--ft-shade)" strokeWidth={1} /></>),

  // ---- Fun ----
  arcade: () => (<><Shadow rx={9} /><rect x={CX - 9} y={6} width={18} height={29} rx={2.4} fill="var(--ft-panel-d)" /><rect x={CX - 6} y={8} width={12} height={3} rx={1} fill="var(--ft-accent)" /><rect x={CX - 6.5} y={12} width={13} height={9} rx={1} fill="var(--ft-screen)" /><rect x={CX - 6} y={23} width={12} height={5} rx={1} fill="var(--ft-frame)" /><circle cx={CX - 2} cy={25.5} r={1.2} fill="var(--ft-accent)" /></>),
  pingpong: () => (<><Shadow rx={16} /><Slab y={22} hw={16} h={3} fill="var(--ft-plant-d)" /><Legs top={25} hw={14} /><rect x={CX - 0.6} y={15} width={1.2} height={7} fill="var(--ft-board)" /><rect x={CX - 9} y={20} width={18} height={2} fill="var(--ft-board)" opacity={0.8} /></>),
  watercooler: () => (<><Shadow rx={7} /><path d="M20 12 Q24 6 28 12 Z" fill="var(--ft-screen)" opacity={0.7} /><rect x={CX - 4} y={11} width={8} height={4} rx={1} fill="var(--ft-screen)" opacity={0.7} /><rect x={CX - 6} y={15} width={12} height={20} rx={2} fill="var(--ft-panel)" /><rect x={CX - 2} y={20} width={4} height={3} rx={1} fill="var(--ft-metal-d)" /></>),
  foosball: () => (<><Shadow rx={16} /><Slab y={22} hw={16} h={4} fill="var(--ft-plant-d)" /><Legs top={26} hw={14} />{[-9, -3, 3, 9].map((dx) => (<g key={dx}><rect x={CX + dx - 8} y={23} width={16} height={1.4} fill="var(--ft-metal)" /><circle cx={CX + dx + 7} cy={23.7} r={1.4} fill="var(--ft-accent)" /></g>))}</>),
  vending: () => (<><Shadow rx={9} /><rect x={CX - 9} y={6} width={18} height={29} rx={2.4} fill="var(--ft-panel-d)" /><rect x={CX - 7} y={8} width={9} height={19} rx={1.2} fill="var(--ft-screen)" opacity={0.8} />{[10, 15, 20].map((y) => [0, 1].map((i) => <rect key={`${y}-${i}`} x={CX - 6 + i * 4} y={y} width={2.6} height={3} rx={0.6} fill="var(--ft-accent)" opacity={0.8} />))}<rect x={CX + 3} y={22} width={4} height={5} rx={1} fill="var(--ft-metal-d)" /></>),
  poolTable: () => (<><Shadow rx={17} /><rect x={CX - 16} y={18} width={32} height={9} rx={2} fill="var(--ft-wood-d)" /><rect x={CX - 14} y={19} width={28} height={6} rx={1.4} fill="var(--ft-plant-d)" /><circle cx={CX - 11} cy={19.4} r={1.2} fill="var(--ft-panel-d)" /><circle cx={CX + 11} cy={19.4} r={1.2} fill="var(--ft-panel-d)" /><circle cx={CX + 2} cy={22} r={1.4} fill="var(--ft-board)" /><Legs top={27} hw={14} /></>),
  treadmill: () => (<><Shadow rx={13} /><path d="M12 33 L30 33 L30 28 L16 33 Z" fill="var(--ft-panel-d)" /><rect x={28} y={12} width={2.4} height={18} fill="var(--ft-metal-d)" /><rect x={26} y={9} width={9} height={5} rx={1.2} fill="var(--ft-frame)" /><rect x={27.5} y={10.4} width={6} height={2.4} rx={0.6} fill="var(--ft-screen)" /></>),
  guitar: () => (<><Shadow rx={6} /><rect x={CX - 1} y={5} width={2} height={16} rx={1} fill="var(--ft-wood-d)" /><rect x={CX - 2.4} y={4} width={4.8} height={3} rx={1} fill="var(--ft-panel-d)" /><circle cx={CX} cy={26} r={9} fill="var(--ft-wood)" /><circle cx={CX} cy={24} r={6} fill="var(--ft-wood-d)" /><circle cx={CX} cy={24} r={2.4} fill="var(--ft-panel-d)" /></>),
  coffeeBar: () => (<><Shadow rx={15} /><Box y={20} hw={14} fill="var(--ft-wood-d)" rx={2} /><Slab y={17} hw={15} h={3.2} fill="var(--ft-wood)" /><rect x={CX + 2} y={9} width={9} height={8} rx={1.4} fill="var(--ft-metal)" /><rect x={CX + 4} y={11} width={5} height={3} rx={0.6} fill="var(--ft-screen)" /><rect x={CX - 10} y={11} width={3} height={6} rx={1} fill="var(--ft-panel)" /></>),

  // ---- Tech ----
  serverRack: () => (<><Shadow rx={8} /><rect x={CX - 7} y={6} width={14} height={29} rx={2} fill="var(--ft-panel-d)" />{[9, 13, 17, 21, 25, 29].map((y) => (<g key={y}><rect x={CX - 5} y={y} width={10} height={2.4} rx={0.6} fill="var(--ft-frame)" /><circle cx={CX + 3} cy={y + 1.2} r={0.7} fill={y % 8 === 1 ? "var(--ft-plant)" : "var(--ft-accent)"} /></g>))}</>),
  printer: () => (<><Shadow rx={9} /><rect x={CX - 9} y={9} width={18} height={26} rx={2.4} fill="var(--ft-panel)" /><rect x={CX - 7} y={11} width={14} height={3} rx={1} fill="var(--ft-metal-d)" /><rect x={CX - 1} y={14} width={2} height={6} fill="var(--ft-metal-d)" /><rect x={CX - 6} y={26} width={12} height={2} rx={1} fill="var(--ft-accent)" opacity={0.6} /><rect x={CX - 6} y={20} width={12} height={4} rx={1} fill="var(--ft-screen)" opacity={0.3} /></>),
  robotArm: () => (<><Shadow rx={8} /><rect x={CX - 7} y={30} width={14} height={5} rx={1.4} fill="var(--ft-panel-d)" /><path d="M24 30 L20 18 L31 14" stroke="var(--ft-metal)" strokeWidth={3.4} fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx={CX} cy={30} r={2.4} fill="var(--ft-metal-d)" /><circle cx={20} cy={18} r={2} fill="var(--ft-metal-d)" /><circle cx={31} cy={14} r={2.2} fill="var(--ft-accent)" /></>),
  towerPC: () => (<><Shadow rx={12} /><rect x={CX - 13} y={14} width={11} height={21} rx={2} fill="var(--ft-panel-d)" /><circle cx={CX - 7.5} cy={18} r={1} fill="var(--ft-accent)" /><rect x={CX - 11} y={22} width={7} height={1.4} rx={0.6} fill="var(--ft-frame)" /><rect x={CX} y={11} width={14} height={10} rx={1.4} fill="var(--ft-frame)" /><rect x={CX + 1.4} y={12.4} width={11.2} height={7.2} rx={0.8} fill="var(--ft-screen)" /><rect x={CX + 6} y={21} width={2} height={4} fill="var(--ft-metal-d)" /></>),

  // ---- Garage ----
  workbench: () => (<><Shadow rx={16} /><rect x={CX - 13} y={8} width={26} height={9} rx={1.4} fill="var(--ft-peg)" />{[-8, -3, 2, 7].map((dx, i) => <circle key={i} cx={CX + dx} cy={12} r={0.8} fill="var(--ft-panel-d)" />)}<rect x={CX - 9} y={9} width={2.4} height={5} rx={0.6} fill="var(--ft-metal-d)" /><Slab y={22} hw={15} h={3.4} fill="var(--ft-wood)" /><Legs top={25} hw={13} /></>),
  toolCabinet: () => (<><Shadow rx={9} /><rect x={CX - 9} y={12} width={18} height={23} rx={2} fill="var(--ft-chest)" /><rect x={CX - 9} y={12} width={18} height={6} rx={2} fill="var(--ft-chest-top)" />{[20, 25, 30].map((y) => (<g key={y}><rect x={CX - 7} y={y} width={14} height={3} rx={0.8} fill="var(--ft-chest-d)" /><rect x={CX - 2.5} y={y + 0.8} width={5} height={1.2} rx={0.6} fill="var(--ft-metal)" /></g>))}</>),
  tireStack: () => (<><Shadow rx={10} />{[30, 24, 18].map((cy, i) => (<g key={cy}><ellipse cx={CX} cy={cy} rx={9 - i * 0.4} ry={4} fill="var(--ft-panel-d)" /><ellipse cx={CX} cy={cy} rx={4} ry={1.8} fill="var(--ft-metal-d)" /></g>))}</>),
  ladder: () => (<><Shadow rx={11} /><path d="M16 35 L22 9 M32 35 L26 9" stroke="var(--ft-metal)" strokeWidth={2.2} strokeLinecap="round" />{[14, 20, 26, 32].map((y, i) => <rect key={y} x={CX - 6 + i * 0.5} y={y} width={12 - i} height={1.6} rx={0.8} fill="var(--ft-metal-d)" />)}<path d="M22 9 L26 9" stroke="var(--ft-metal)" strokeWidth={2} strokeLinecap="round" /></>),
  oilDrum: () => (<><Shadow rx={8} /><ellipse cx={CX} cy={13} rx={8} ry={2.6} fill="var(--ft-metal)" /><rect x={CX - 8} y={13} width={16} height={20} fill="var(--ft-panel)" /><ellipse cx={CX} cy={33} rx={8} ry={2.6} fill="var(--ft-panel-d)" /><rect x={CX - 8} y={19} width={16} height={1.6} fill="var(--ft-metal-d)" /><rect x={CX - 8} y={26} width={16} height={1.6} fill="var(--ft-metal-d)" /></>),
};

/** A flat catalog-style vector preview of a furniture piece, drawn entirely in code. */
export function FurnitureThumb({ id, size = 44 }: { id: FurnitureId; size?: number }) {
  const draw = DRAW[id];
  return (
    <span className="furn-thumb" style={{ width: size, height: size * (H / W) }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
        {draw ? draw() : (<><Shadow /><Box y={16} hw={10} /></>)}
      </svg>
    </span>
  );
}
