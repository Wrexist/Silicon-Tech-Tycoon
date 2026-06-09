import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, FlipHorizontal2, Hammer, Megaphone, Minus, Plus, Search, Share2, Sparkles, TrendingDown, TrendingUp, Tv, Users, Factory, type LucideIcon } from "lucide-react";
import { Button, Card, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { haptic } from "../design/haptics.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORIES, COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { isCategoryUnlocked } from "../engine/eras.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { suggestNextName } from "../engine/naming.ts";
import { format, dollars, sub, toDollars } from "../engine/money.ts";
import { effectiveWeights, scoreLaunch } from "../engine/market.ts";
import { MARKETING_CHANNELS, type ChannelId } from "../engine/marketing.ts";
import { buildCost, computeStats, missingSlots, overallScore } from "../engine/product.ts";
import { BALANCE } from "../engine/balance.ts";
import { defaultCameraDesign } from "../engine/types.ts";
import type {
  CameraLayout,
  CameraModuleShape,
  CameraPosition,
  ComponentKind,
  FinishId,
  NotchStyle,
  Product,
  Stats,
} from "../engine/types.ts";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { FINISH_SWATCHES } from "../render/deviceStyle.ts";
import {
  buildWeeksFor,
  burn,
  designTierCeiling,
  hypeBonus,
  marketerSkill,
  planProduction,
  productStats,
  recommendedRun,
  researchedTier,
  verdictBands,
  type GameState,
} from "../state/gameState.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { useGame } from "../state/useGame.tsx";
import { StatBars } from "../components/charts.tsx";
import "./designLab.css";

const STAT_ABBR: Record<keyof Stats, string> = {
  performance: "Perf", quality: "Qual", battery: "Bat", design: "Dsn", ecosystem: "Eco",
};

function contribLabel(c: Partial<Stats>): string {
  return STAT_KEYS.filter((k) => c[k]).map((k) => `+${Math.round(c[k]!)} ${STAT_ABBR[k]}`).join(" · ");
}

const FINISHES: FinishId[] = ["plastic", "aluminium", "titanium", "gold"];
const FINISH_LABEL: Record<FinishId, string> = {
  plastic: "Polymer",
  aluminium: "Aluminium",
  titanium: "Titanium",
  gold: "Gold",
};

type LabTab = "components" | "style" | "camera" | "launch";
const LAB_TABS: { id: LabTab; label: string }[] = [
  { id: "components", label: "Components" },
  { id: "style", label: "Style" },
  { id: "camera", label: "Camera" },
  { id: "launch", label: "Launch" },
];

function newestProductName(state: GameState): string | null {
  if (state.building.length) return state.building[state.building.length - 1].product.name;
  if (state.ready.length) return state.ready[state.ready.length - 1].name;
  if (state.launched.length) return state.launched[0].product.name;
  return null;
}

function freshDraft(state: GameState): Product {
  const tiers: Product["tiers"] = {};
  for (const k of CATEGORIES.phone.slots) tiers[k] = Math.min(1, researchedTier(state, k));
  const prev = newestProductName(state);
  const base: Product = {
    id: "draft",
    name: prev ? suggestNextName(prev) : "Aurora One",
    category: "phone",
    tiers,
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(499),
    designTier: 1,
    camera: defaultCameraDesign(),
    notch: "punch",
  };
  // Auto-price: start at a fair market price based on actual component stats so new players
  // aren't unknowingly launching severely overpriced T1 products.
  const stats = computeStats(base);
  const overall = overallScore(stats, "phone");
  const fairPrice = Math.max(49, Math.round(overall * toDollars(BALANCE.market.price.valueToPrice) / 10) * 10);
  return { ...base, price: dollars(fairPrice) };
}

/** Seed a brand-new draft from an already-launched product: keep its whole design (category,
 *  components, finish, camera, price…) but give it the next name in the series and a clean id, so
 *  "Design successor" lets the player iterate on a proven (or failed) product without rebuilding it
 *  from scratch. Non-destructive — the original launched product is untouched. */
function successorDraft(prev: Product): Product {
  return {
    ...prev,
    id: "draft",
    name: suggestNextName(prev.name),
    plannedUnits: undefined,
    channelId: undefined,
  };
}

export function DesignLab({
  seed,
  onSeedConsumed,
}: {
  seed?: Product | null;
  onSeedConsumed?: () => void;
} = {}) {
  const { state, build } = useGame();
  const [draft, setDraft] = useState<Product>(() => (seed ? successorDraft(seed) : freshDraft(state)));
  const [face, setFace] = useState<"front" | "back">("front");
  const [wizard, setWizard] = useState(false);
  const [labTab, setLabTab] = useState<LabTab>("components");

  const cat = CATEGORIES[draft.category];
  const hasCamera = cat.slots.includes("camera");

  // Auto-switch device face when entering the Camera tab for a camera-capable category.
  // Non-camera categories stay on front (no back to show).
  useEffect(() => {
    setFace(labTab === "camera" && hasCamera ? "back" : "front");
  }, [labTab, hasCamera]);

  // A successor seed handed in from a launched product's detail sheet: adopt it as the draft, then
  // tell the parent to clear it so re-renders don't keep overwriting the player's edits.
  useEffect(() => {
    if (!seed) return;
    setDraft(successorDraft(seed));
    setFace("front");
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);
  const flippable = draft.category === "phone" || draft.category === "tablet";
  const unlockedCats = useMemo(
    () => Object.values(CATEGORIES).filter((c) => isCategoryUnlocked(c.id, state.era)),
    [state.era],
  );

  const stats = productStats(state, draft);
  const unitCost = buildCost(draft);
  const margin = sub(draft.price, unitCost);
  const marginPct = toDollars(draft.price) > 0 ? Math.round((toDollars(margin) / toDollars(draft.price)) * 100) : 0;
  const overall = overallScore(stats, draft.category);
  const weights = effectiveWeights(state.trends, draft.category);

  const fairPriceDollars = Math.max(1, overall * toDollars(BALANCE.market.price.valueToPrice));
  const priceRatio = toDollars(draft.price) / fairPriceDollars;
  const [priceZone, priceZoneTone] =
    priceRatio < 0.65 ? ["Underpriced", "accent" as const]
    : priceRatio < 0.95 ? ["Good value", "positive" as const]
    : priceRatio < 1.3 ? ["Fair", "positive" as const]
    : priceRatio < 1.8 ? ["Premium", "neutral" as const]
    : ["Overpriced", "negative" as const];
  const priceSliderAccent =
    priceRatio < 0.65 ? "var(--accent)"
    : priceRatio < 1.3 ? "var(--positive)"
    : priceRatio < 1.8 ? "#f59e0b"
    : "var(--negative)";

  const breakdown = scoreLaunch({
    stats,
    category: draft.category,
    price: draft.price,
    trends: state.trends,
    reputation: state.reputation,
    marketerSkill: marketerSkill(state),
    competitorStrength: 0,
    hypeBonus: hypeBonus(state),
  });
  const fit = Math.round(breakdown.demand);
  const missing = missingSlots(draft);
  const ceiling = designTierCeiling(state);

  // B7 — the lab's projected verdict must use the SAME gate the launch actually applies:
  // effectiveScore = launchScore × competitionFactor, compared to the era-scaled verdict bands.
  // planProduction supplies the count-based competitionFactor (rivals matching/beating you) that
  // launchReady uses, and verdictBands(era) is the SAME helper launchReady applies, so "Projected
  // hit" here matches what happens at launch — including the rising bar in later eras.
  const preview = missing.length === 0 ? planProduction(state, draft, BALANCE.build.minRun, "none") : null;
  const effectiveScore = preview ? preview.launchScore * preview.competitionFactor : breakdown.launchScore;
  const bands = verdictBands(state.era);
  const verdict =
    effectiveScore >= bands.hit ? { label: "Projected hit", tone: "positive" as const }
      : effectiveScore <= bands.flop ? { label: "Likely flop", tone: "negative" as const }
        : effectiveScore >= bands.solid ? { label: "Solid performer", tone: "positive" as const }
          : { label: "Steady seller", tone: "accent" as const };

  function set(partial: Partial<Product>) {
    setDraft((d) => ({ ...d, ...partial }));
  }
  function setTier(kind: ComponentKind, delta: number) {
    const maxT = researchedTier(state, kind);
    const cur = draft.tiers[kind] ?? 0;
    const next = Math.max(1, Math.min(maxT, cur + delta));
    haptic.light();
    set({ tiers: { ...draft.tiers, [kind]: next } });
  }
  function setCam(partial: Partial<Product["camera"]>) {
    haptic.light();
    setFace("back");
    setDraft((d) => ({ ...d, camera: { ...d.camera, ...partial } }));
  }

  function suggestPrice() {
    const fair = dollars(Math.max(50, overall * toDollars(dollars(9))));
    haptic.light();
    if (fair === draft.price) {
      showToast("Price looks about right already", { tone: "neutral" });
    } else {
      set({ price: fair });
      showToast(`Price set to ${format(fair)}`, { tone: "positive" });
    }
  }

  function openWizard() {
    if (missing.length > 0 || state.bankrupt) {
      haptic.error();
      showToast(missing.length > 0 ? "Pick every component first." : "Company is bankrupt.", { tone: "negative", glyph: <AlertTriangle size={15} /> });
      return;
    }
    haptic.light();
    setWizard(true);
  }

  function confirmBuild(units: number, channelId: ChannelId) {
    const res = build(draft, units, channelId);
    if (!res.ok) {
      haptic.error();
      showToast(res.reason ?? "Can't build yet", { tone: "negative", glyph: <AlertTriangle size={15} /> });
      return;
    }
    haptic.success();
    setWizard(false);
    showToast(`Production started — ${units.toLocaleString()} units on the line.`, { tone: "positive", glyph: <Hammer size={15} /> });
    setDraft({ ...freshDraft(state), name: suggestNextName(draft.name) });
  }

  // Derive top-wanted stat for the market hint (highest target weight vs current weight delta)
  const topWanted = STAT_KEYS.reduce((best, k) => {
    const d = state.trends.targetWeights[k] - state.trends.weights[k];
    const bestD = state.trends.targetWeights[best] - state.trends.weights[best];
    return d > bestD ? k : best;
  }, STAT_KEYS[0]);
  const topWantedDelta = state.trends.targetWeights[topWanted] - state.trends.weights[topWanted];
  const STAT_LABEL_FULL: Record<keyof Stats, string> = { performance: "Performance", quality: "Quality", battery: "Battery life", design: "Design", ecosystem: "Ecosystem" };

  return (
    <div className="lab">
      {/* Market hints — always visible */}
      {topWantedDelta > 0.02 && (
        <div className="lab__market-hint">
          <span className="lab__market-hint-dot" />
          <span>
            <strong>{STAT_LABEL_FULL[topWanted]}</strong> is trending up — build it into your next product for a demand boost.
          </span>
        </div>
      )}
      {(() => {
        const weeksToShift = state.trendRetargetWeek - state.week;
        if (weeksToShift > 5 || weeksToShift < 0) return null;
        return (
          <div className="lab__trend-shift">
            <span className="lab__trend-shift-dot" />
            <span>
              Trends shift in <strong>{weeksToShift} week{weeksToShift !== 1 ? "s" : ""}</strong> — launch before the shift to ride current demand, or hold for the next cycle.
            </span>
          </div>
        );
      })()}

      {/* Hero device — always visible, updates live as you design */}
      <div className="lab__hero">
        <DeviceRenderer product={draft} size={236} idle shimmer flip={flippable} face={face} />
        {flippable && (
          <button
            className="lab__flip"
            onClick={() => {
              haptic.light();
              setFace((f) => (f === "front" ? "back" : "front"));
            }}
          >
            <FlipHorizontal2 size={15} /> {face === "front" ? "View back" : "View front"}
          </button>
        )}
        <div className="lab__verdict">
          <StatPill label="Fit" value={`${fit}`} tone={fit >= 60 ? "positive" : "neutral"} />
          <StatPill value={missing.length === 0 ? `${verdict.label} · ${Math.round(effectiveScore)}` : verdict.label} tone={verdict.tone} />
        </div>
      </div>

      {/* Category — always visible above the tab strip */}
      <Card>
        <SectionHeader title="Category" accessory={`${unlockedCats.length} unlocked`} />
        <div className="lab__chips">
          {unlockedCats.map((c) => {
            const genCount = state.launched.filter((lp) => lp.product.category === c.id).length;
            const activeSelling = state.launched.some(
              (lp) => lp.product.category === c.id && lp.weeksElapsed < lp.weeklyUnits.length,
            );
            return (
              <button
                key={c.id}
                className={`lab__chip${draft.category === c.id ? " lab__chip--on" : ""}`}
                aria-pressed={draft.category === c.id}
                onClick={() => {
                  haptic.light();
                  const tiers: Product["tiers"] = {};
                  for (const k of c.slots) tiers[k] = Math.min(draft.tiers[k] ?? 1, researchedTier(state, k)) || 1;
                  set({ category: c.id, tiers });
                }}
              >
                <CategoryIcon id={c.id} size={15} /> {c.displayName}
                {genCount > 0 && (
                  <span className={`lab__chip-gen${activeSelling ? " lab__chip-gen--live" : ""}`}>
                    G{genCount + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="lab__hint">
          {cat.displayName} — {
            cat.marketSize >= 0.8 ? "large market" :
            cat.marketSize >= 0.55 ? "mid-size market" : "niche market"
          } · rewards {
            Object.entries(cat.statEmphasis)
              .filter(([, v]) => (v as number) >= 1.0)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([k]) => k)
              .slice(0, 2)
              .join(" & ")
          }
        </p>
        {(() => {
          const prev = state.launched.find((lp) => lp.product.category === draft.category);
          if (!prev) return null;
          const prevScore = overallScore(prev.stats, prev.product.category);
          const scoreImproved = overall > prevScore;
          return (
            <div className="lab__prev-product">
              <span className="lab__prev-label">Last in category:</span>
              <span className="lab__prev-name">{prev.product.name}</span>
              <span className={`lab__prev-score${scoreImproved ? " lab__prev-score--up" : ""}`}>
                {scoreImproved ? <TrendingUp size={11} aria-hidden /> : null}
                Overall {prevScore}
              </span>
            </div>
          );
        })()}
      </Card>

      {/* ── Section tab strip ───────────────────────────────── */}
      <div className="lab__tabs" role="tablist" aria-label="Design sections">
        {LAB_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={labTab === t.id}
            className={`lab__tab${labTab === t.id ? " lab__tab--on" : ""}`}
            onClick={() => { haptic.light(); setLabTab(t.id); }}
          >
            {t.id === "camera" && !hasCamera ? "Front" : t.label}
          </button>
        ))}
      </div>

      {/* Tab content — key forces remount → CSS fade-in on every tab switch */}
      <div className="lab__pane" key={labTab}>

        {/* ── 1: Components ───────────────────────────────── */}
        {labTab === "components" && (
          <Card>
            <SectionHeader title="Components" accessory="tier gated by R&D" />
            <div className="lab__components">
              {cat.slots.map((kind) => {
                const tier = draft.tiers[kind] ?? 1;
                const def = tierDef(kind, tier);
                const maxT = researchedTier(state, kind);
                const totalT = maxTier(kind);
                const atMax = tier >= maxT;
                const isMissing = missing.includes(kind);
                return (
                  <div className={`lab__comp${isMissing ? " lab__comp--missing" : ""}`} key={kind}>
                    <div className="lab__comp-info">
                      <span className="lab__comp-name">
                        {COMPONENT_LINES[kind].displayName}
                        <span className="lab__comp-pips" aria-hidden>
                          {Array.from({ length: totalT }).map((_, i) => (
                            <span
                              key={i}
                              className={`lab__comp-pip${i < tier ? " lab__comp-pip--on" : i < maxT ? " lab__comp-pip--unlocked" : ""}`}
                            />
                          ))}
                        </span>
                      </span>
                      <span className="lab__comp-tier">
                        {def?.name ?? "—"}
                        {def && toDollars(def.unitCost) > 0 && (
                          <span className="lab__comp-cost"> · {format(def.unitCost)}</span>
                        )}
                      </span>
                      {def && contribLabel(def.contributes) && (
                        <span className="lab__comp-contrib">{contribLabel(def.contributes)}</span>
                      )}
                      {atMax && maxTier(kind) > maxT && (
                        <span className="lab__comp-locked">T{maxT + 1} unlockable in R&amp;D</span>
                      )}
                    </div>
                    <div className="lab__stepper">
                      <button onClick={() => setTier(kind, -1)} disabled={tier <= 1} aria-label="Lower tier"><Minus size={16} /></button>
                      <span className="lab__stepper-val tnum">T{tier}</span>
                      <button onClick={() => setTier(kind, +1)} disabled={atMax} aria-label="Higher tier"><Plus size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── 2: Style (finish · colour · design effort) ─── */}
        {labTab === "style" && (
          <>
            <Card>
              <SectionHeader title="Finish & colour" />
              <div className="lab__chips">
                {FINISHES.map((f) => (
                  <button
                    key={f}
                    className={`lab__chip${draft.finish === f ? " lab__chip--on" : ""}`}
                    aria-pressed={draft.finish === f}
                    onClick={() => { haptic.light(); set({ finish: f, colorIndex: 0 }); }}
                  >
                    {FINISH_LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="lab__swatches">
                {FINISH_SWATCHES[draft.finish].map((sw, i) => (
                  <button
                    key={sw.name}
                    className={`lab__swatch${draft.colorIndex === i ? " lab__swatch--on" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${sw.bodyLight}, ${sw.bodyDark})` }}
                    title={sw.name}
                    aria-label={sw.name}
                    aria-pressed={draft.colorIndex === i}
                    onClick={() => { haptic.light(); set({ colorIndex: i }); }}
                  />
                ))}
              </div>
            </Card>
            <Card>
              <SectionHeader title="Design effort" accessory={`ceiling T${ceiling}`} />
              <div className="lab__stepper lab__stepper--wide">
                <button onClick={() => { haptic.light(); set({ designTier: Math.max(1, draft.designTier - 1) }); }} disabled={draft.designTier <= 1} aria-label="Lower design tier"><Minus size={16} /></button>
                <span className="lab__stepper-val tnum" style={{ color: "var(--fn-design)" }}>Tier {draft.designTier}</span>
                <button onClick={() => { haptic.light(); set({ designTier: Math.min(ceiling, draft.designTier + 1) }); }} disabled={draft.designTier >= ceiling} aria-label="Higher design tier"><Plus size={16} /></button>
              </div>
              <p className="lab__hint">Higher design effort raises the Design stat ceiling. Hire designers to lift the cap.</p>
            </Card>
          </>
        )}

        {/* ── 3: Camera & Front ────────────────────────────── */}
        {labTab === "camera" && (
          <>
            {hasCamera && (
              <Card>
                <SectionHeader title="Camera" accessory="back of device" />
                <div className="lab__comp">
                  <div className="lab__comp-info">
                    <span className="lab__comp-name">Lenses</span>
                    <span className="lab__comp-tier">{draft.camera.count} {draft.camera.count === 1 ? "lens" : "lenses"}</span>
                  </div>
                  <div className="lab__stepper">
                    <button aria-label="Fewer lenses" disabled={draft.camera.count <= 1} onClick={() => setCam({ count: draft.camera.count - 1 })}><Minus size={16} /></button>
                    <span className="lab__stepper-val tnum">{draft.camera.count}</span>
                    <button aria-label="More lenses" disabled={draft.camera.count >= 4} onClick={() => setCam({ count: draft.camera.count + 1 })}><Plus size={16} /></button>
                  </div>
                </div>
                <Seg<CameraLayout>
                  label="Layout"
                  value={draft.camera.layout}
                  disabled={draft.camera.count < 2}
                  options={[["vertical", "Vertical"], ["horizontal", "Row"], ["square", "Square"], ["triangle", "Triangle"]]}
                  onPick={(v) => setCam({ layout: v })}
                />
                <Seg<CameraPosition>
                  label="Position"
                  value={draft.camera.position}
                  options={[["topLeft", "Corner"], ["topCenter", "Top"], ["center", "Center"]]}
                  onPick={(v) => setCam({ position: v })}
                />
                <Seg<CameraModuleShape>
                  label="Module"
                  value={draft.camera.module}
                  options={[["squircle", "Bump"], ["circle", "Circle"], ["pill", "Pill"]]}
                  onPick={(v) => setCam({ module: v })}
                />
                <div className="lab__toggle-row">
                  <span className="lab__seg-label">Flash</span>
                  <button
                    className={`lab__toggle${draft.camera.flash ? " lab__toggle--on" : ""}`}
                    role="switch"
                    aria-checked={draft.camera.flash}
                    onClick={() => setCam({ flash: !draft.camera.flash })}
                  >
                    <span className="lab__toggle-knob" />
                  </button>
                </div>
              </Card>
            )}
            <Card>
              <SectionHeader title="Front" accessory="selfie camera" />
              <Seg<NotchStyle>
                label="Cutout"
                value={draft.notch}
                options={[["punch", "Punch-hole"], ["island", "Island"], ["notch", "Notch"], ["none", "None"]]}
                onPick={(v) => { haptic.light(); setFace("front"); set({ notch: v }); }}
              />
            </Card>
          </>
        )}

        {/* ── 4: Launch (stats · price · name · build) ─────── */}
        {labTab === "launch" && (
          <>
            <Card>
              <SectionHeader title="Stats" accessory={<span className="lab__stats-head">Overall {overall} · hit ≥{bands.hit}</span>} />
              <StatBars
                stats={stats}
                weights={weights}
                trendDeltas={Object.fromEntries(
                  STAT_KEYS.map((k) => [k, state.trends.targetWeights[k] - state.trends.weights[k]])
                ) as Record<keyof typeof stats, number>}
              />
              <p className="lab__hint">Green = what market wants most · ↑↓ = shifting demand</p>
              {(() => {
                const prev = state.launched.find((lp) => lp.product.category === draft.category);
                if (!prev) return null;
                const deltas = STAT_KEYS.map((k) => ({ k, d: Math.round(stats[k] - prev.stats[k]) })).filter((x) => x.d !== 0);
                if (deltas.length === 0) return null;
                return (
                  <div className="lab__stat-deltas">
                    {deltas.map(({ k, d }) => (
                      <span key={k} className={`lab__delta-pill${d > 0 ? " lab__delta-pill--up" : " lab__delta-pill--down"}`}>
                        {d > 0 ? "+" : ""}{d} {STAT_ABBR[k]}
                      </span>
                    ))}
                    <span className="lab__delta-vs">vs. {prev.product.name}</span>
                  </div>
                );
              })()}
              {(() => {
                const rivalMaxStr = state.competitors.reduce((max, c) => {
                  return Math.max(max, ((c.strengthByCategory ?? {}) as Record<string, number>)[draft.category] ?? 0);
                }, 0);
                const lastInCat = state.launched.find((lp) => lp.product.category === draft.category);
                const baseTarget = Math.max(
                  lastInCat ? Math.round(overallScore(lastInCat.stats, lastInCat.product.category) * 1.1) : 0,
                  Math.round(rivalMaxStr * 1.05),
                  45,
                );
                const target = Math.min(baseTarget, 85);
                if (overall >= 85) return null;
                const pct = Math.min(100, Math.round((overall / target) * 100));
                const met = overall >= target;
                return (
                  <div className={`lab__score-target${met ? " lab__score-target--met" : ""}`}>
                    <div className="lab__score-target-head">
                      <span>{met ? "✓ Competitive" : `Target: ${target}+ Overall`}</span>
                      <span className="tnum">{overall} / {target}</span>
                    </div>
                    <div className="lab__score-target-track">
                      <div className="lab__score-target-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}
              {(() => {
                let best: { kind: ComponentKind; tierName: string; gain: number } | null = null;
                for (const kind of cat.slots) {
                  const cur = draft.tiers[kind] ?? 1;
                  const maxR = researchedTier(state, kind);
                  if (cur >= maxR) continue;
                  const nextTier = cur + 1;
                  const nextDef = tierDef(kind, nextTier);
                  if (!nextDef) continue;
                  const newStats = productStats(state, { ...draft, tiers: { ...draft.tiers, [kind]: nextTier } });
                  const gain = overallScore(newStats, draft.category) - overall;
                  if (gain > 0 && (best === null || gain > best.gain)) {
                    best = { kind, tierName: nextDef.name, gain };
                  }
                }
                if (!best || best.gain < 2) return null;
                return (
                  <div className="lab__upgrade-hint">
                    <TrendingUp size={11} aria-hidden />
                    <span>
                      <strong>{COMPONENT_LINES[best.kind].displayName} T{(draft.tiers[best.kind] ?? 1) + 1}</strong>
                      {" "}would add <strong>+{best.gain}</strong> Overall
                    </span>
                  </div>
                );
              })()}
              {preview != null && (
                <div className={`lab__vs${preview.betterRivals > 0 ? " lab__vs--behind" : preview.matchingRivals > 0 ? " lab__vs--even" : " lab__vs--ahead"}`}>
                  {preview.betterRivals > 0 ? (
                    <><TrendingDown size={12} aria-hidden /> {preview.betterRivals} rival{preview.betterRivals > 1 ? "s are" : " is"} stronger in {cat.displayName} — upgrade components to compete.</>
                  ) : preview.matchingRivals > 0 ? (
                    <><TrendingUp size={12} aria-hidden /> Matched by {preview.matchingRivals} rival{preview.matchingRivals > 1 ? "s" : ""} in {cat.displayName} — a small edge could win the market.</>
                  ) : (
                    <><Check size={12} aria-hidden /> Clear field in {cat.displayName} — no strong rival competition right now.</>
                  )}
                </div>
              )}
              {(() => {
                const STAT_FULL: Record<keyof Stats, string> = { performance: "Perf", quality: "Quality", battery: "Battery", design: "Design", ecosystem: "Ecosys" };
                const top2 = STAT_KEYS
                  .filter((k) => (cat.statEmphasis[k] ?? 0) >= 1.0)
                  .sort((a, b) => ((cat.statEmphasis[b] ?? 0) - (cat.statEmphasis[a] ?? 0)))
                  .slice(0, 2);
                if (top2.length === 0) return null;
                return (
                  <div className="lab__cat-focus">
                    <span className="lab__cat-focus-label">{cat.displayName} buyers want:</span>
                    {top2.map((k) => {
                      const delta = state.trends.targetWeights[k] - state.trends.weights[k];
                      const trend = delta > 0.03 ? "up" : delta < -0.03 ? "down" : "flat";
                      const statVal = stats[k];
                      const good = statVal >= 50;
                      return (
                        <span key={k} className={`lab__cat-focus-stat${good ? " lab__cat-focus-stat--good" : ""}`}>
                          {STAT_FULL[k]}
                          {trend === "up" && <span className="lab__cat-focus-arrow lab__cat-focus-arrow--up" aria-label="rising" />}
                          {trend === "down" && <span className="lab__cat-focus-arrow lab__cat-focus-arrow--down" aria-label="falling" />}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>

            <Card>
              <SectionHeader title="Price" accessory={<Button size="sm" variant="secondary" onClick={suggestPrice}>Suggest</Button>} />
              <div className="lab__price-display rounded tnum">{format(draft.price)}</div>
              <Slider
                value={toDollars(draft.price)}
                min={0}
                max={5000}
                step={10}
                ariaLabel="Price"
                accent={priceSliderAccent}
                onChange={(v) => set({ price: dollars(v) })}
              />
              <div className="lab__price-meta">
                <StatPill label="Build" value={format(unitCost)} />
                <StatPill label="Margin" value={`${format(margin)} · ${marginPct}%`} tone={marginPct > 0 ? "positive" : "negative"} />
                <StatPill label="Fair ~" value={`$${Math.round(fairPriceDollars / 10) * 10}`} />
                <StatPill value={priceZone} tone={priceZoneTone} />
              </div>
              {(() => {
                const rows = cat.slots
                  .map((kind) => {
                    const tier = draft.tiers[kind] ?? 1;
                    const def = tierDef(kind, tier);
                    return def && toDollars(def.unitCost) > 0
                      ? { name: def.name, cost: toDollars(def.unitCost) }
                      : null;
                  })
                  .filter(Boolean) as { name: string; cost: number }[];
                if (rows.length === 0) return null;
                const total = rows.reduce((s, r) => s + r.cost, 0);
                return (
                  <div className="lab__bom">
                    {rows.map((r) => (
                      <div key={r.name} className="lab__bom-row">
                        <span className="lab__bom-name">{r.name}</span>
                        <span className="lab__bom-bar-wrap">
                          <span className="lab__bom-bar" style={{ width: `${Math.round((r.cost / total) * 100)}%` }} />
                        </span>
                        <span className="lab__bom-val tnum">${r.cost}</span>
                      </div>
                    ))}
                    <div className="lab__bom-total">
                      <span>BOM total</span>
                      <span className="tnum">${total.toFixed(0)}</span>
                    </div>
                  </div>
                );
              })()}
            </Card>

            <Card>
              <SectionHeader title="Name & build" accessory={`~${buildWeeksFor(state)} wk to make`} />
              <input
                className="lab__name"
                value={draft.name}
                maxLength={22}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Product name"
                aria-label="Product name"
              />
              {missing.length > 0 && (
                <p className="lab__warn">
                  Missing: {missing.map((k) => COMPONENT_LINES[k].displayName).join(", ")} — go to the Components tab.
                </p>
              )}
              <Button block onClick={openWizard} disabled={missing.length > 0 || state.bankrupt} haptics="none">
                <Hammer size={17} /> Plan production
              </Button>
              <p className="lab__hint">Next you'll choose how many units to manufacture and how to market it.</p>
              {missing.length === 0 && (() => {
                const rec = recommendedRun(state, draft, "none");
                const plan = planProduction(state, draft, rec, "none");
                const revD = toDollars(plan.projectedRevenue);
                const profD = toDollars(plan.projectedProfit);
                if (revD <= 0) return null;
                return (
                  <div className="lab__rev-estimate">
                    <div className="lab__rev-row">
                      <span className="lab__rev-label">Est. revenue</span>
                      <span className="lab__rev-val tnum">{format(plan.projectedRevenue)}</span>
                    </div>
                    <div className="lab__rev-row">
                      <span className="lab__rev-label">Est. profit</span>
                      <span className={`lab__rev-val tnum${profD >= 0 ? " lab__rev-val--pos" : " lab__rev-val--neg"}`}>{format(plan.projectedProfit)}</span>
                    </div>
                    <p className="lab__rev-note">{rec.toLocaleString()} units, no campaign</p>
                  </div>
                );
              })()}
              {state.launched.length > 0 && (() => {
                const sameCat = state.launched.filter((lp) => lp.product.category === draft.category);
                if (sameCat.length === 0) return null;
                const best = sameCat.reduce((a, b) => b.launchScore > a.launchScore ? b : a);
                const bestOverall = overallScore(best.stats, best.product.category);
                const ahead = missing.length === 0 && overall > bestOverall + 2;
                return (
                  <div className="lab__prev-best">
                    <span className="lab__prev-best-label">Your best {CATEGORIES[draft.category].displayName}</span>
                    <div className="lab__prev-best-row">
                      <span className="lab__prev-best-name">{best.product.name}</span>
                      <span className="lab__prev-best-score tnum">score {Math.round(bestOverall)}</span>
                      {ahead && <span className="lab__prev-best-beat">+{Math.round(overall - bestOverall)} pts</span>}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </>
        )}

      </div>

      <Sheet open={wizard} onClose={() => setWizard(false)}>
        {wizard && <BuildWizard draft={draft} state={state} onConfirm={confirmBuild} onClose={() => setWizard(false)} />}
      </Sheet>
    </div>
  );
}

const WIZARD_CHANNEL_ICONS: Record<string, LucideIcon> = { Ban, Share2, Search, Megaphone, Users, Tv, Sparkles };

/** The multi-step production wizard: run size → marketing → review (with a smart demand forecast). */
function BuildWizard({
  draft,
  state,
  onConfirm,
  onClose,
}: {
  draft: Product;
  state: GameState;
  onConfirm: (units: number, channelId: ChannelId) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<ChannelId>("none");
  const [units, setUnits] = useState(() => recommendedRun(state, draft, "none"));

  const plan = useMemo(() => planProduction(state, draft, units, channel), [state, draft, units, channel]);
  const recommended = useMemo(() => recommendedRun(state, draft, channel), [state, draft, channel]);
  const baseDemand = useMemo(() => planProduction(state, draft, units, "none").totalDemand, [state, draft, units]);
  const affordable = state.cash >= plan.totalUpfront;
  const variancePct = state.completedProjects.includes("demandSensing") ? 0.08 : 0.12;
  const demandLow = Math.round(plan.totalDemand * (1 - variancePct));
  const demandHigh = Math.round(plan.totalDemand * (1 + variancePct));

  // B1b — readable build-risk: cash left the instant the run is paid for, the runway that buys at
  // current burn (no revenue arrives until launch), and the build duration. If the runway can't
  // outlast the build, the run may bankrupt the player mid-manufacture — surface it, don't block it.
  const buildWks = buildWeeksFor(state);
  const cashAfter = sub(state.cash, plan.totalUpfront);
  const weeklyBurnAfter = burn(state);
  const runway = runwayWeeks(cashAfter, weeklyBurnAfter);
  const runwayRisky = affordable && runway < buildWks;

  // B8 — price-fit indicator (Overpriced / On the money / Value buy) alongside demand-fit. Derived
  // from price vs the fair value the market expects (same valueToPrice scale market.ts uses).
  const fairDollars = Math.max(1, plan.overall * toDollars(BALANCE.market.price.valueToPrice));
  const priceRatio = toDollars(draft.price) / fairDollars;
  const priceFit =
    priceRatio > 1.18 ? { label: `Overpriced −${Math.round((priceRatio - 1) * 100)}%`, tone: "negative" as const }
      : priceRatio < 0.82 ? { label: "Value buy", tone: "positive" as const }
        : { label: "On the money", tone: "accent" as const };

  const fitLabel = plan.demandFit >= 60 ? "Strong fit" : plan.demandFit >= 35 ? "Decent fit" : "Weak fit";
  const fitTone = plan.demandFit >= 60 ? "positive" : plan.demandFit >= 35 ? "accent" : "negative";
  const compLabel =
    plan.betterRivals > 0 ? `${plan.betterRivals} rival${plan.betterRivals > 1 ? "s" : ""} beat you`
      : plan.matchingRivals > 0 ? `${plan.matchingRivals} rival${plan.matchingRivals > 1 ? "s" : ""} match you`
        : "Clear field";
  const compTone = plan.betterRivals > 0 ? "negative" : plan.matchingRivals > 0 ? "accent" : "positive";

  return (
    <div className="wiz">
      <div className="wiz__head">
        <div className="wiz__thumb"><DeviceRenderer product={draft} size={56} /></div>
        <div>
          <h2 className="wiz__title">{draft.name}</h2>
          <p className="wiz__sub">Step {step + 1} of 3 · {step === 0 ? "Production run" : step === 1 ? "Marketing" : "Review & build"}</p>
        </div>
      </div>
      <div className="wiz__steps">{[0, 1, 2].map((i) => <span key={i} className={`wiz__step${i <= step ? " wiz__step--on" : ""}`} />)}</div>

      {step === 0 && (
        <div className="wiz__body">
          <p className="wiz__lead">How many <b>{draft.name}</b> should the factory produce? You pay for the whole run upfront, so match it to demand.</p>
          <div className="wiz__units rounded tnum">{units.toLocaleString()} <span className="wiz__units-label">units</span></div>
          <Slider value={units} min={BALANCE.build.minRun} max={Math.max(BALANCE.build.minRun * 2, plan.maxAffordableUnits || BALANCE.build.minRun * 2)} step={50} ariaLabel="Units to produce" accent="var(--fn-design)" onChange={setUnits} />
          <div className="wiz__chips">
            {[plan.preOrders || BALANCE.build.minRun, recommended, plan.maxAffordableUnits].map((n, i) => (
              <button key={i} className="wiz__chip" onClick={() => { setUnits(Math.max(BALANCE.build.minRun, Math.round(n))); haptic.light(); }}>
                {i === 0 ? "Fans only" : i === 1 ? "Recommended" : "Max"}
              </button>
            ))}
          </div>
          <div className="wiz__grid">
            <Stat label="Pre-orders (fans)" value={plan.preOrders.toLocaleString()} hint={`${state.fans.toLocaleString()} fans`} />
            <Stat label="Projected demand" value={plan.totalDemand.toLocaleString()} tone={plan.sellsOut ? "positive" : undefined} hint={plan.sellsOut ? "would sell out" : `${demandLow.toLocaleString()}–${demandHigh.toLocaleString()} range`} />
            <Stat label="Unit cost" value={format(plan.unitCost)} />
            <Stat label="Run cost" value={format(plan.productionCost)} tone="negative" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wiz__body">
          <p className="wiz__lead">Pick a launch campaign — bigger campaigns add hype (more demand) for an upfront cost.</p>
          <div className="wiz__channels">
            {MARKETING_CHANNELS.map((c) => {
              const Icon = WIZARD_CHANNEL_ICONS[c.icon] ?? Ban;
              const aff = state.cash >= c.cost;
              const chanDemand = planProduction(state, draft, units, c.id).totalDemand;
              const demandDelta = chanDemand - baseDemand;
              return (
                <button key={c.id} className={`wiz__channel${channel === c.id ? " wiz__channel--on" : ""}${!aff && c.id !== "none" ? " wiz__channel--locked" : ""}`} disabled={!aff && c.id !== "none"} aria-pressed={channel === c.id} onClick={() => { setChannel(c.id); haptic.light(); }}>
                  <span className="wiz__channel-icon"><Icon size={18} /></span>
                  <div className="wiz__channel-text">
                    <span className="wiz__channel-name">{c.name}</span>
                    <span className="wiz__channel-blurb">{c.blurb}</span>
                  </div>
                  <div className="wiz__channel-meta">
                    <span>{c.cost > 0 ? format(c.cost) : "Free"}</span>
                    {!aff && c.id !== "none" && (
                      <span className="wiz__channel-need">Need {format(sub(c.cost, state.cash))} more</span>
                    )}
                    {aff && demandDelta > 0 && (
                      <span className="wiz__channel-demand">+{demandDelta.toLocaleString()} units</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wiz__body">
          <div className="wiz__review">
            <Stat label="Demand fit" value={`${Math.round(plan.demandFit)}`} tone={fitTone} hint={fitLabel} />
            <Stat label="Price fit" value={priceFit.label} tone={priceFit.tone} />
            <Stat label="Competition" value={compLabel} tone={compTone} />
            <Stat label="Your fans" value={state.fans.toLocaleString()} />
            <Stat label="Run size" value={plan.plannedUnits.toLocaleString()} />
            <Stat label="Projected sales" value={plan.projectedSales.toLocaleString()} tone={plan.sellsOut ? "positive" : undefined} hint={plan.sellsOut ? "sells out" : plan.projectedSales < plan.plannedUnits ? "some unsold" : undefined} />
            <Stat label="Projected profit" value={format(plan.projectedProfit)} tone={plan.projectedProfit >= 0 ? "positive" : "negative"} />
            <Stat
              label="Cash after build starts"
              value={format(cashAfter)}
              tone={cashAfter < 0 ? "negative" : undefined}
            />
            <Stat
              label="Runway"
              value={runway === Infinity ? "∞" : `${runway} wk`}
              tone={runwayRisky ? "negative" : undefined}
              hint={`build takes ${buildWks} wk`}
            />
          </div>
          <div className="wiz__total">
            <span>Upfront cost</span>
            <span className={`rounded tnum${affordable ? "" : " wiz__total--bad"}`}>{format(plan.totalUpfront)}</span>
          </div>
          {!affordable && (
            <p className="wiz__warn">
              Need {format(sub(plan.totalUpfront, state.cash))} more — reduce the run size or pick a cheaper campaign.
            </p>
          )}
          {affordable && runwayRisky && (
            <p className="wiz__warn wiz__warn--risk">
              <AlertTriangle size={14} /> Tight runway: at {format(weeklyBurnAfter)}/wk you have {runway} wk of cash but the build takes {buildWks} wk. No revenue arrives until launch — this run may bankrupt you mid-build. Consider a smaller run.
            </p>
          )}
        </div>
      )}

      <div className="wiz__nav">
        {step > 0 && <Button variant="secondary" onClick={() => { setStep(step - 1); haptic.light(); }}>Back</Button>}
        {step < 2 ? (
          <Button block onClick={() => { setStep(step + 1); haptic.light(); }}>Next</Button>
        ) : (
          <Button block disabled={!affordable} onClick={() => onConfirm(units, channel)} haptics="none">
            <Factory size={16} /> Build {units.toLocaleString()} units
          </Button>
        )}
      </div>
      <button className="wiz__cancel" onClick={onClose}>Cancel</button>
    </div>
  );
}

function Seg<T extends string>({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`lab__seg${disabled ? " lab__seg--disabled" : ""}`}>
      <span className="lab__seg-label">{label}</span>
      <div className="lab__seg-track">
        {options.map(([v, lbl]) => (
          <button
            key={v}
            className={`lab__seg-opt${value === v ? " lab__seg-opt--on" : ""}`}
            aria-pressed={value === v}
            aria-label={`${label}: ${lbl}`}
            disabled={disabled}
            onClick={() => onPick(v)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
