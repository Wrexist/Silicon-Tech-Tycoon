import {
  Archive, ArrowUp, Armchair, BookOpen, Bot, Box, Boxes, Building2, Check, CircleDot, Clock, Coffee,
  Construction, Copy, Cpu, Cylinder, Disc, Factory, FlaskConical, Footprints, Gamepad2, GlassWater, Globe, Hammer,
  Image as ImageIcon, Lamp, LayoutGrid, Library, Lightbulb, Megaphone, Monitor, Music, PaintbrushVertical, PencilRuler, Presentation, Printer,
  Refrigerator, RotateCw, Rocket, Search, Server, Shapes, Sofa, Sparkles, Sprout, Square, Table,
  Table2, Target, Trash2, TrendingUp, Trees, Tv, Undo2, Users, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";
import { Button, Card, SectionHeader, StatPill } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { BALANCE } from "../engine/balance.ts";
import { eraName, maxEra } from "../engine/eras.ts";
import { format } from "../engine/money.ts";
import {
  canPlace,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  footprint,
  FURNITURE,
  furnitureDef,
  GRID,
  searchFurniture,
  type FurnitureCategory,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import { FLOOR_FINISHES, WALL_STYLES } from "../engine/roomStyle.ts";
import { UPGRADE_LINES, type UpgradeId } from "../engine/upgrades.ts";
import { canAdvance, canIPO, facility, upgradeCost } from "../state/gameState.ts";
import { Suspense, lazy, useRef, useState, type CSSProperties } from "react";
import { useGame } from "../state/useGame.tsx";
import { useSettings } from "../state/settings.ts";
import { IsoScene } from "../components/IsoScene.tsx";
import { isDarkTheme, prefersReducedMotion, webglSupported } from "../garage3d/support.ts";
import type { BuildProps } from "../garage3d/Garage3D.tsx";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import type { Tab } from "../components/BottomNav.tsx";
import "./hq.css";


const FURN_ICONS: Record<string, LucideIcon> = {
  Table, Table2, Armchair, Sofa, Coffee, Presentation, BookOpen, Archive, Box, Trees, Sprout,
  Square, CircleDot, Lamp, Tv, PencilRuler, Gamepad2, GlassWater, Server, Printer,
  Monitor, Building2, Library, Boxes, Zap, Image: ImageIcon, Globe, Clock, Shapes, Lightbulb, Refrigerator,
  Target, Music, Footprints, Bot, Hammer, Wrench, Disc, Construction, Cylinder,
};

const UPGRADE_ICONS: Record<string, LucideIcon> = { Cpu, PencilRuler, FlaskConical, Megaphone, Coffee, Factory };
// Each upgrade line is colour-coded by the company function it powers.
const UPGRADE_FN: Record<UpgradeId, { accent: string; soft: string }> = {
  computers: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
  designSuite: { accent: "var(--fn-design)", soft: "var(--fn-design-soft)" },
  testLab: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
  marketing: { accent: "var(--fn-mkt)", soft: "var(--fn-mkt-soft)" },
  amenities: { accent: "var(--fn-team)", soft: "var(--fn-team-soft)" },
  assembly: { accent: "var(--fn-eng)", soft: "var(--fn-eng-soft)" },
};

const Garage3D = lazy(() => import("../garage3d/Garage3D.tsx").then((m) => ({ default: m.Garage3D })));

export function HQ({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const { state, advanceEra, launchReady, goPublic } = useGame();
  const settings = useSettings();
  const onLaunch = (id: string) => {
    const res = launchReady(id);
    if (res.ok) {
      haptic.success();
      const sc = res.launchScore ?? 0;
      sfx("launch");
      if (sc >= 76) setTimeout(() => sfx("hit"), 380);
      showToast(
        sc >= 76 ? "Launched — it's a hit!" : sc <= 22 ? "Launched — sales are slow." : sc >= 45 ? "Launched — solid performance." : "Launched into the market.",
        { tone: sc <= 22 ? "negative" : "positive", glyph: <Rocket size={15} /> },
      );
    }
  };
  const use3d = settings.garage3d && webglSupported() && !prefersReducedMotion();
  const ipoReady = canIPO(state);
  const hasProduction =
    state.building.length > 0 || state.launched.some((l) => l.weeksElapsed < l.weeklyUnits.length);
  const advanceReady = canAdvance(state);
  const latest = state.feed[state.feed.length - 1];

  return (
    <div className="hq">
      <OfficeScene use3d={use3d} hasProduction={hasProduction} />

      {ipoReady && (
        <Card className="hq__era hq__ipo">
          <div className="hq__era-body">
            <span className="hq__era-title">Ready to go public</span>
            <span className="hq__era-sub">Your reputation is world-class. Take the company to IPO.</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              goPublic();
              haptic.success();
              sfx("era");
            }}
          >
            <TrendingUp size={15} /> IPO
          </Button>
        </Card>
      )}

      {advanceReady && (
        <Card className="hq__era">
          <div className="hq__era-body">
            <span className="hq__era-title">New era unlocked</span>
            <span className="hq__era-sub">Advance to the {eraName(state.era + 1)} for new tech & categories.</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              advanceEra();
              haptic.success();
              showToast(`Welcome to the ${eraName(state.era + 1)}`, { tone: "positive", glyph: <Sparkles size={15} /> });
            }}
          >
            Advance
          </Button>
        </Card>
      )}

      <div className="hq__stats">
        <StatPill label="Products" value={state.launched.length} />
        <StatPill label="Team" value={state.staff.length} />
        <StatPill label="Reputation" value={Math.round(state.reputation)} tone={state.reputation >= 50 ? "positive" : "neutral"} />
        {state.era < maxEra() && <StatPill label="Era" value={`${state.era}/${maxEra()}`} tone="accent" />}
      </div>

      {/* Ready to launch */}
      {state.ready.length > 0 && (
        <Card className="hq__ready">
          <SectionHeader title="Ready to launch" accessory="market & release" />
          {state.ready.map((p) => (
            <div className="hq__ready-row" key={p.id}>
              <div className="hq__ready-thumb"><DeviceRenderer product={p} size={52} /></div>
              <div className="hq__ready-info">
                <span className="hq__ready-name">{p.name}</span>
                {p.plannedUnits != null && <span className="hq__ready-sub">{p.plannedUnits.toLocaleString()} units ready</span>}
              </div>
              <Button size="sm" onClick={() => onLaunch(p.id)}>
                <Rocket size={15} /> Launch
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* In production */}
      {state.building.length > 0 && (
        <Card>
          <SectionHeader title="In production" accessory="manufacturing" />
          {state.building.map((job) => {
            const pct = Math.min(100, Math.round((job.weeksElapsed / job.totalWeeks) * 100));
            const weeksLeft = Math.max(0, job.totalWeeks - job.weeksElapsed);
            return (
              <div className="hq__build" key={job.product.id}>
                <div className="hq__build-head">
                  <span className="hq__ready-name">{job.product.name}</span>
                  <span className="hq__build-pct tnum">
                    {pct}%{weeksLeft > 0 && <span className="hq__build-eta"> · {weeksLeft} wk{weeksLeft === 1 ? "" : "s"}</span>}
                  </span>
                </div>
                <div className="hq__build-track">
                  <div className="hq__build-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Upgrades />

      {state.launched.length === 0 ? (
        <Card>
          <SectionHeader title="Get started" />
          <p className="hq__cta-text">Your garage is ready. Design your first product and launch it into the market.</p>
          <Button block onClick={() => onNavigate("design")}><PencilRuler size={17} /> Open the Design Lab</Button>
        </Card>
      ) : (
        latest && (
          <Card>
            <SectionHeader title="Latest" />
            <p className="hq__latest">{latest.text}</p>
            <Button block variant="secondary" onClick={() => onNavigate("market")}>View the market</Button>
          </Card>
        )
      )}
    </div>
  );
}

// The garage/office scene + the interactive furniture builder ("Decorate" mode).
function OfficeScene({ use3d, hasProduction }: { use3d: boolean; hasProduction: boolean }) {
  const { state, placeFurniture, moveFurniture, rotateFurniture, removeFurniture, duplicateFurniture, resetFurniture, setLayout, setFloorStyle, setWallStyle } = useGame();
  const [build, setBuild] = useState(false);
  const [placingType, setPlacingType] = useState<FurnitureId | null>(null);
  const [placeRot, setPlaceRot] = useState<Rot>(0);
  const [selectedIid, setSelectedIid] = useState<string | null>(null);
  const [cat, setCat] = useState<FurnitureCategory>("desks");
  const [search, setSearch] = useState("");
  const [roomTab, setRoomTab] = useState(false);
  const history = useRef<PlacedItem[][]>([]);
  const [histLen, setHistLen] = useState(0); // mirror of history depth so Undo's disabled state stays live
  const dark = isDarkTheme();
  // If the GPU drops the WebGL context mid-game, fall back to the 2D IsoScene instead of black.
  const [glLost, setGlLost] = useState(false);

  const selected = build ? state.layout.find((x) => x.iid === selectedIid) ?? null : null;
  const searching = search.trim().length > 0;
  const visibleItems = searching ? searchFurniture(search) : FURNITURE.filter((f) => f.category === cat);

  const snapshot = () => {
    history.current.push(state.layout);
    if (history.current.length > 40) history.current.shift();
    setHistLen(history.current.length);
  };
  const undo = () => {
    const prev = history.current.pop();
    setHistLen(history.current.length);
    if (prev) {
      setLayout(prev);
      setSelectedIid(null);
      setPlacingType(null);
      haptic.medium();
    }
  };

  const builder: BuildProps = {
    build,
    layout: state.layout,
    placingType,
    placeRot,
    selectedIid,
    onPlaceCell: (c, r) => {
      if (!placingType) return;
      snapshot();
      placeFurniture(placingType, c, r, placeRot);
      haptic.light();
      sfx("tap");
    },
    onMoveItem: (iid, c, r) => {
      snapshot();
      moveFurniture(iid, c, r);
      haptic.light();
    },
    onSelectItem: (iid) => {
      setSelectedIid(iid);
      if (iid) setPlacingType(null);
    },
  };

  const exit = () => {
    setBuild(false);
    setPlacingType(null);
    setSelectedIid(null);
    history.current = [];
    setHistLen(0);
  };

  // Tapping a catalog item drops it into the first free cell + selects it, so the player can
  // immediately drag it where they want.
  const pick = (type: FurnitureId) => {
    const def = furnitureDef(type);
    for (let r = 0; r <= GRID.n - 1; r++) {
      for (let c = 0; c <= GRID.n - 1; c++) {
        const fp = footprint(def, 0);
        if (c + fp.w > GRID.n || r + fp.d > GRID.n) continue;
        if (canPlace(state.layout, type, c, r, 0)) {
          snapshot();
          placeFurniture(type, c, r, 0);
          setSelectedIid(`f${state.furnitureCounter}`);
          setPlacingType(null);
          haptic.success();
          sfx("tap");
          return;
        }
      }
    }
    showToast("No room — remove something first.", { tone: "negative" });
    haptic.error();
  };

  return (
    <Card variant="flush">
      <div className={`hq__scene${build ? " hq__scene--build" : ""}`}>
        {use3d && !glLost ? (
          <ErrorBoundary fallback={<IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />}>
            <Suspense fallback={<IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />}>
              <Garage3D
                staff={state.staff}
                staffCount={state.staff.length}
                facilityTier={state.facilityTier}
                hasProduction={hasProduction}
                upgrades={state.upgrades}
                companyName={state.companyName}
                dark={dark}
                onContextLost={() => setGlLost(true)}
                builder={builder}
                roomStyle={state.roomStyle}
                height={build ? 460 : 420}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <IsoScene staff={state.staff} staffCount={state.staff.length} facilityTier={state.facilityTier} hasProduction={hasProduction} />
        )}
        {!build && <div className="hq__scene-tag">{eraName(state.era)}</div>}
        {use3d && !build && <div className="hq__camhint" aria-hidden>WASD to look around</div>}
        {use3d && !build && (
          <button className="hq__decorate" onClick={() => { setBuild(true); haptic.light(); }}>
            <LayoutGrid size={15} /> Decorate
          </button>
        )}
        {build && (
          <div className="hqb__top">
            <span className="hqb__title">Decorate your office</span>
            <div className="hqb__top-actions">
              <button className="hqb__icon" aria-label="Undo" disabled={histLen === 0} onClick={undo}>
                <Undo2 size={15} />
              </button>
              <button className="hqb__icon" aria-label="Reset layout" onClick={() => { snapshot(); resetFurniture(); setSelectedIid(null); setPlacingType(null); haptic.medium(); }}>
                <Trash2 size={15} />
              </button>
              <Button size="sm" onClick={exit}><Check size={14} /> Done</Button>
            </div>
          </div>
        )}
      </div>

      {build && (
        <div className="hqb__panel">
          {selected ? (
            <div className="hqb__toolbar">
              <div className="hqb__sel">
                <span className="hqb__sel-name">{furnitureDef(selected.type).name}</span>
                <span className="hqb__sel-hint">Drag it to move · or use the buttons</span>
              </div>
              <div className="hqb__row">
                <button className="hqb__tool" onClick={() => { snapshot(); rotateFurniture(selected.iid); haptic.light(); }}><RotateCw size={16} /> Rotate</button>
                <button className="hqb__tool" onClick={() => { snapshot(); duplicateFurniture(selected.iid); haptic.light(); }}><Copy size={16} /> Duplicate</button>
                <button className="hqb__tool hqb__tool--danger" onClick={() => { snapshot(); removeFurniture(selected.iid); setSelectedIid(null); haptic.medium(); }}><Trash2 size={16} /> Remove</button>
                <button className="hqb__tool" onClick={() => setSelectedIid(null)}><X size={16} /> Deselect</button>
              </div>
            </div>
          ) : (
            <>
              <div className="hqb__search">
                <Search size={15} className="hqb__search-icon" />
                <input
                  className="hqb__search-input"
                  value={search}
                  placeholder="Search furniture…"
                  aria-label="Search furniture"
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searching && (
                  <button className="hqb__search-clear" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>
                )}
              </div>
              {!searching && (
                <div className="hqb__cats">
                  <button className={`hqb__cat hqb__cat--room${roomTab ? " hqb__cat--on" : ""}`} onClick={() => { setRoomTab(true); setPlacingType(null); haptic.light(); }}>
                    <PaintbrushVertical size={13} /> Room
                  </button>
                  {CATEGORY_ORDER.map((c) => (
                    <button key={c} className={`hqb__cat${!roomTab && cat === c ? " hqb__cat--on" : ""}`} onClick={() => { setCat(c); setRoomTab(false); haptic.light(); }}>
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
              )}
              {!searching && roomTab ? (
                <div className="hqb__room">
                  <div className="hqb__room-group">
                    <span className="hqb__room-label">Floor</span>
                    <div className="hqb__swatches">
                      {FLOOR_FINISHES.map((f, i) => (
                        <button key={f.id} className={`hqb__sw${state.roomStyle.floor === i ? " hqb__sw--on" : ""}`} aria-pressed={state.roomStyle.floor === i} aria-label={`${f.name} floor`} onClick={() => { setFloorStyle(i); haptic.light(); }}>
                          <span className="hqb__sw-chip" style={{ background: dark ? f.dark : f.light }} />
                          <span className="hqb__sw-name">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="hqb__room-group">
                    <span className="hqb__room-label">Walls</span>
                    <div className="hqb__swatches">
                      {WALL_STYLES.map((w, i) => (
                        <button key={w.id} className={`hqb__sw${state.roomStyle.wall === i ? " hqb__sw--on" : ""}`} aria-pressed={state.roomStyle.wall === i} aria-label={`${w.name} walls`} onClick={() => { setWallStyle(i); haptic.light(); }}>
                          <span className="hqb__sw-chip" style={{ background: dark ? w.dark : w.light }} />
                          <span className="hqb__sw-name">{w.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              {placingType && (
                <div className="hqb__placing">
                  <span className="hqb__placing-text">Placing <b>{furnitureDef(placingType).name}</b> — tap the floor</span>
                  <div className="hqb__row">
                    <button className="hqb__tool" onClick={() => { setPlaceRot((r) => ((r + 1) % 4) as Rot); haptic.light(); }}><RotateCw size={15} /> Rotate</button>
                    <button className="hqb__tool" onClick={() => setPlacingType(null)}><X size={15} /> Cancel</button>
                  </div>
                </div>
              )}
              {visibleItems.length === 0 ? (
                <p className="hqb__empty">No furniture matches “{search.trim()}”.</p>
              ) : (
                <div className="hqb__items">
                  {visibleItems.map((f) => {
                    const Icon = FURN_ICONS[f.icon] ?? Box;
                    return (
                      <button key={f.id} className={`hqb__item${placingType === f.id ? " hqb__item--on" : ""}`} aria-pressed={placingType === f.id} aria-label={`Place ${f.name}`} onClick={() => pick(f.id)}>
                        <span className="hqb__item-glyph"><Icon size={20} /></span>
                        <span className="hqb__item-name">{f.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function Upgrades() {
  const { state, buyUpgrade, upgradeHQ } = useGame();
  const fac = facility(state);
  const nextFac = BALANCE.facilities[state.facilityTier];

  // Overall progression — every tier bought across all lines + facility moves.
  const builtTiers =
    UPGRADE_LINES.reduce((a, l) => a + (state.upgrades[l.id] ?? 0), 0) + (state.facilityTier - 1);
  const maxTiers =
    UPGRADE_LINES.reduce((a, l) => a + l.maxTier, 0) + (BALANCE.facilities.length - 1);
  const pct = Math.round((builtTiers / maxTiers) * 100);

  return (
    <>
      <SectionHeader title="Grow your company" accessory="upgrades & facility" />

      <Card className="hqu__power">
        <div className="hqu__power-head">
          <span className="hqu__power-title">Company power</span>
          <span className="hqu__power-val tnum">{builtTiers}<span className="hqu__power-max">/{maxTiers}</span></span>
        </div>
        <div className="hqu__power-track">
          <div className="hqu__power-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="hqu__power-sub">Every upgrade compounds across all the products you ship.</p>
      </Card>

      {/* Facility (the headquarters itself) */}
      <Card className="hqu__fac">
        <div className="hqu__card-head">
          <span className="hqu__glyph hqu__glyph--fac" aria-hidden><Users size={18} /></span>
          <div className="hqu__info">
            <span className="hqu__name">{fac.name}</span>
            <span className="hqu__effect">{state.staff.length}/{fac.staffCapacity} desks · {format(fac.weeklyRent)}/wk rent</span>
          </div>
          <span className="hqu__lv tnum">Tier {state.facilityTier}</span>
        </div>
        {nextFac ? (
          <Button
            block
            size="sm"
            variant={state.cash >= nextFac.upgradeCost ? "primary" : "tertiary"}
            disabled={state.cash < nextFac.upgradeCost}
            onClick={upgradeHQ}
          >
            <ArrowUp size={14} /> Move to {nextFac.name} · {format(nextFac.upgradeCost)}
          </Button>
        ) : (
          <div className="hqu__maxed"><Check size={14} strokeWidth={2.5} /> Largest facility</div>
        )}
      </Card>

      {/* Office upgrade lines — colour-coded by function, glowing tier pips. */}
      <div className="hqu__grid">
        {UPGRADE_LINES.map((line) => {
          const cur = state.upgrades[line.id] ?? 0;
          const cost = upgradeCost(state, line.id);
          const maxed = cur >= line.maxTier;
          const affordable = cost !== null && state.cash >= cost;
          const Icon = UPGRADE_ICONS[line.icon] ?? Cpu;
          const fn = UPGRADE_FN[line.id];
          return (
            <Card
              key={line.id}
              className="hqu__card"
              style={{ "--accent": fn.accent, "--accent-soft": fn.soft } as CSSProperties}
            >
              <div className="hqu__card-head">
                <span className="hqu__glyph" aria-hidden><Icon size={18} /></span>
                <div className="hqu__info">
                  <span className="hqu__name">{line.name}</span>
                  <span className="hqu__effect">{cur > 0 ? line.effectAt(cur) : line.blurb}</span>
                </div>
                <span className="hqu__lv tnum">{maxed ? "MAX" : `Lv ${cur}`}</span>
              </div>
              <div className="hqu__pips">
                {Array.from({ length: line.maxTier }).map((_, i) => (
                  <span key={i} className={`hqu__pip${i < cur ? " hqu__pip--on" : ""}`} />
                ))}
              </div>
              {maxed ? (
                <div className="hqu__maxed"><Check size={14} strokeWidth={2.5} /> Fully upgraded</div>
              ) : (
                <Button
                  block
                  size="sm"
                  variant={affordable ? "primary" : "tertiary"}
                  disabled={!affordable}
                  onClick={() => { buyUpgrade(line.id); haptic.success(); sfx("tap"); }}
                >
                  <ArrowUp size={14} /> {line.tierNames[cur]} · {cost !== null ? format(cost) : "—"}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
