import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, Check, FlaskConical, FlipHorizontal2, Hammer, Lock, Megaphone, Minus, Plus, Rocket, Search, Share2, Sparkles, TrendingDown, TrendingUp, Tv, Users, Factory, type LucideIcon } from "lucide-react";
import { Button, Card, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { launchOutcome } from "../design/launchFeedback.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORIES, COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { isCategoryUnlocked } from "../engine/eras.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { suggestNextName } from "../engine/naming.ts";
import { format, dollars, sub, toDollars } from "../engine/money.ts";
import { effectiveWeights, priceGuidance, scoreLaunch } from "../engine/market.ts";
import { MARKETING_CHANNELS, type ChannelId } from "../engine/marketing.ts";
import { buildCost, componentSynergy, computeStats, effectiveRefreshRate, effectiveStorage, maxRefreshRate, maxStorage, missingSlots, overallScore } from "../engine/product.ts";
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
  lensUnlockCost,
  finishUnlockCost,
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
    refreshRate: 60,
    storage: 128,
  };
  // Auto-price: start at a fair market price based on actual component stats so new players
  // aren't unknowingly launching severely overpriced T1 products.
  const stats = computeStats(base);
  const fairPrice = Math.max(49, Math.round(toDollars(priceGuidance(stats, "phone").fair) / 10) * 10);
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

/** What the just-completed build produced — drives the "Design complete" celebration sheet. */
interface CompletedBuild {
  product: Product;
  units: number;
  weeks: number;
  overall: number;
  projectedSales: number;
  projectedProfit: ReturnType<typeof sub>;
  sellsOut: boolean;
}

export function DesignLab({
  seed,
  onSeedConsumed,
  onGoToHQ,
}: {
  seed?: Product | null;
  onSeedConsumed?: () => void;
  onGoToHQ?: () => void;
} = {}) {
  const { state, build, launchReady, unlockLens, unlockFinish } = useGame();
  const [draft, setDraft] = useState<Product>(() => (seed ? successorDraft(seed) : freshDraft(state)));
  const [face, setFace] = useState<"front" | "back">("front");
  const [wizard, setWizard] = useState(false);
  const [completed, setCompleted] = useState<CompletedBuild | null>(null);
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

  // B5 — the player sees a price BAND (where fit stays healthy), never the exact peak; where to
  // sit inside it (value play vs margin play) is their call. Zone/accent stay ratio-relative.
  const guidance = priceGuidance(stats, draft.category);
  const fairPriceDollars = Math.max(1, toDollars(guidance.fair));
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
    : priceRatio < 1.8 ? "var(--warning)"
    : "var(--negative)";

  // Component-combination synergy (weak-link penalty / coherent-build bonus) — surfaced live so the
  // player sees how the MIX of components scores, not just each slot maxed in isolation.
  const syn = componentSynergy(draft);
  const breakdown = scoreLaunch({
    stats,
    category: draft.category,
    price: draft.price,
    trends: state.trends,
    reputation: state.reputation,
    marketerSkill: marketerSkill(state),
    competitorStrength: 0,
    hypeBonus: hypeBonus(state),
    synergy: syn.factor,
  });
  const fit = Math.round(breakdown.demand);
  const missing = missingSlots(draft);
  const ceiling = designTierCeiling(state);

  // Refresh rate (Hz): the options the chosen display tier can drive, plus the effective value.
  const hasDisplay = CATEGORIES[draft.category].slots.includes("display");
  const maxHz = maxRefreshRate(draft.tiers.display ?? 1);
  const effHz = effectiveRefreshRate(draft);
  const hzOptions = BALANCE.design.refreshRate.options
    .filter((h) => h <= maxHz)
    .map((h) => [h, `${h}Hz`] as [number, string]);
  // Storage (GB): options the software/OS tier supports, plus the effective value.
  const hasSoftware = CATEGORIES[draft.category].slots.includes("software");
  const maxStor = maxStorage(draft.tiers.software ?? 1);
  const effStor = effectiveStorage(draft);
  const storLabel = (g: number) => (g >= 1024 ? "1TB" : `${g}GB`);
  const storOptions = BALANCE.design.storage.options
    .filter((g) => g <= maxStor)
    .map((g) => [g, storLabel(g)] as [number, string]);

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
  // Item 1: the verdict can swing while "Fit" is unchanged because rivals (competitionFactor)
  // drag the effective score. Flag that so the label never looks like it flipped at random.
  const competitionDrag = !!preview && preview.competitionFactor < 0.85 && (preview.betterRivals > 0 || preview.matchingRivals > 0);

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
    // Snapshot the finished design + its forecast BEFORE building (state mutates after) so the
    // completion sheet can celebrate exactly what just shipped to the factory floor.
    const finished = draft;
    const plan = planProduction(state, finished, units, channelId);
    const weeks = buildWeeksFor(state);
    const res = build(finished, units, channelId);
    if (!res.ok) {
      haptic.error();
      showToast(res.reason ?? "Can't build yet", { tone: "negative", glyph: <AlertTriangle size={15} /> });
      return;
    }
    haptic.success();
    sfx("build");
    setWizard(false);
    setCompleted({
      product: finished,
      units,
      weeks,
      overall: overallScore(productStats(state, finished), finished.category),
      projectedSales: plan.projectedSales,
      projectedProfit: plan.projectedProfit,
      sellsOut: plan.sellsOut,
    });
    setDraft({ ...freshDraft(state), name: suggestNextName(finished.name) });
  }

  // Launch a finished product straight from the Lab — same premium beat HQ uses (haptics, sound,
  // celebrate FX on a hit, verdict toast) so the whole loop (design → build → launch) lives in one
  // place and never forces a trip to another tab.
  function onLaunch(id: string) {
    // Snapshot the launched list BEFORE launchReady records this product (for first-ever/first-hit).
    const launchedBefore = state.launched;
    const res = launchReady(id);
    if (!res.ok) return;
    haptic.success();
    // launchOutcome keys the celebration off the ACTUAL recorded verdict (competition-adjusted),
    // not the raw score — and is shared with HQ so the two launch surfaces can't drift.
    const { isHit, feedback } = launchOutcome(res, launchedBefore);
    sfx("launch");
    if (isHit) {
      setTimeout(() => sfx("hit"), 380);
      emitCelebrate();
    }
    showToast(feedback.text, { tone: feedback.tone, glyph: <Rocket size={15} /> });
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
      {/* Production pipeline — launch finished products right here, so the whole loop
          (design → build → launch) stays in one place with no trip to HQ. */}
      {state.ready.length > 0 && (
        <Card className="lab__pipeline lab__pipeline--ready">
          <SectionHeader title="Ready to launch" accessory="market & release" />
          {state.ready.map((p) => (
            <div className="lab__pipe-row" key={p.id}>
              <div className="lab__pipe-thumb"><DeviceRenderer product={p} size={52} /></div>
              <div className="lab__pipe-info">
                <span className="lab__pipe-name">{p.name}</span>
                {p.plannedUnits != null && <span className="lab__pipe-sub">{p.plannedUnits.toLocaleString()} units ready</span>}
              </div>
              <Button size="sm" onClick={() => onLaunch(p.id)}>
                <Rocket size={15} /> Launch
              </Button>
            </div>
          ))}
        </Card>
      )}
      {state.building.length > 0 && (
        <Card className="lab__pipeline">
          <SectionHeader title="In production" accessory="manufacturing" />
          {state.building.map((job) => {
            const pct = Math.min(100, Math.round((job.weeksElapsed / job.totalWeeks) * 100));
            const weeksLeft = Math.max(0, job.totalWeeks - job.weeksElapsed);
            return (
              <div className="lab__pipe-build" key={job.product.id}>
                <div className="lab__pipe-row">
                  <div className="lab__pipe-thumb"><DeviceRenderer product={job.product} size={44} /></div>
                  <div className="lab__pipe-build-body">
                    <div className="lab__pipe-build-head">
                      <span className="lab__pipe-name">{job.product.name}</span>
                      <span className="lab__pipe-pct tnum">
                        {pct}%{weeksLeft > 0 && <span className="lab__pipe-eta"> · wk {state.week + weeksLeft}</span>}
                      </span>
                    </div>
                    <div className="lab__pipe-track">
                      <div className="lab__pipe-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

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
          <StatPill label="Fit" value={<>{fit}<span className="lab__den">/100</span></>} tone={fit >= 60 ? "positive" : "neutral"} />
          {syn.weakest && <StatPill label="Weak link" value={`${syn.weakest[0].toUpperCase()}${syn.weakest.slice(1)}`} tone="negative" />}
          <StatPill value={verdict.label} tone={verdict.tone} />
        </div>
        {competitionDrag && preview && (
          <p className="lab__verdict-note">
            {preview.betterRivals > 0
              ? `${preview.betterRivals} rival${preview.betterRivals > 1 ? "s" : ""} currently outclass this — that's pulling the forecast down, not your design.`
              : `${preview.matchingRivals} rival${preview.matchingRivals > 1 ? "s" : ""} match you right now — they'll split this market.`}
          </p>
        )}
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
                return (
                  <div className="lab__comp" key={kind}>
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
                      {atMax && maxTier(kind) > maxT && (() => {
                        // Show the NAME of the next component you'd unlock (e.g. "TurboCore A2"),
                        // not a dry "T2" — it's the upgrade to get excited about and research toward.
                        const nextDef = tierDef(kind, maxT + 1);
                        if (!nextDef) return null;
                        return (
                          <span className="lab__comp-locked">
                            <Lock size={10} aria-hidden />
                            <span className="lab__comp-locked-name">{nextDef.name}</span>
                          </span>
                        );
                      })()}
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
              {(() => {
                // Premium finishes (titanium, gold) are RP-unlocked — locked chips render masked
                // with a lock, and an inline research buy unlocks + selects the next material.
                const finishLimit = state.finishLimit ?? (BALANCE.design.freeFinishes - 1);
                const nextIdx = finishLimit + 1;
                const nextCost = finishUnlockCost(state);
                const rp = Math.floor(state.researchPoints);
                return (
                  <>
                    <div className="lab__chips">
                      {FINISHES.map((f, i) => {
                        const locked = i > finishLimit;
                        return (
                          <button
                            key={f}
                            className={`lab__chip${draft.finish === f ? " lab__chip--on" : ""}${locked ? " lab__chip--locked" : ""}`}
                            aria-pressed={draft.finish === f}
                            disabled={locked}
                            title={locked ? "Unlock with research below" : undefined}
                            onClick={() => { haptic.light(); set({ finish: f, colorIndex: 0 }); }}
                          >
                            {locked && <Lock size={11} aria-hidden />}{FINISH_LABEL[f]}
                          </button>
                        );
                      })}
                    </div>
                    {nextCost !== null && (
                      <Button
                        block
                        size="sm"
                        variant={rp >= nextCost ? "primary" : "tertiary"}
                        disabled={rp < nextCost}
                        onClick={() => {
                          unlockFinish();
                          set({ finish: FINISHES[nextIdx], colorIndex: 0 });
                          haptic.success();
                          sfx("upgrade");
                        }}
                      >
                        <FlaskConical size={14} /> Unlock {FINISH_LABEL[FINISHES[nextIdx]]} · {nextCost} RP
                      </Button>
                    )}
                  </>
                );
              })()}
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
                {(() => {
                  // Lens counts beyond the current limit are RESEARCH unlocks (RP), not free
                  // picker options — designing a triple/quad module is something you earn.
                  const lensCap = Math.min(4, state.lensLimit ?? 2);
                  const nextLensCost = lensUnlockCost(state);
                  const rp = Math.floor(state.researchPoints);
                  const atCap = draft.camera.count >= lensCap;
                  return (
                    <>
                      <div className="lab__comp">
                        <div className="lab__comp-info">
                          <span className="lab__comp-name">Lenses</span>
                          <span className="lab__comp-tier">{draft.camera.count} {draft.camera.count === 1 ? "lens" : "lenses"}</span>
                        </div>
                        <div className="lab__stepper">
                          <button aria-label="Fewer lenses" disabled={draft.camera.count <= 1} onClick={() => setCam({ count: draft.camera.count - 1 })}><Minus size={16} /></button>
                          <span className="lab__stepper-val tnum">{draft.camera.count}</span>
                          <button
                            aria-label={atCap && nextLensCost !== null ? "More lenses (research the next module below)" : "More lenses"}
                            disabled={atCap}
                            onClick={() => setCam({ count: draft.camera.count + 1 })}
                          ><Plus size={16} /></button>
                        </div>
                      </div>
                      {atCap && nextLensCost !== null && (
                        <Button
                          block
                          size="sm"
                          variant={rp >= nextLensCost ? "primary" : "tertiary"}
                          disabled={rp < nextLensCost}
                          onClick={() => {
                            unlockLens();
                            // Step straight onto the new lens (instant gratification) — unless the
                            // draft is a grandfathered design already above the old cap.
                            if (lensCap + 1 > draft.camera.count) setCam({ count: lensCap + 1 });
                            haptic.success();
                            sfx("upgrade");
                          }}
                        >
                          <FlaskConical size={14} /> Unlock {lensCap + 1 === 3 ? "triple-lens module" : "quad-lens array"} · {nextLensCost} RP
                        </Button>
                      )}
                    </>
                  );
                })()}
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
            {hasDisplay && (
              <Card>
                <SectionHeader title="Display" accessory={maxHz < 144 ? `${effHz}Hz · max ${maxHz}` : `${effHz}Hz`} />
                <Seg<number>
                  label="Refresh rate"
                  value={effHz}
                  options={hzOptions}
                  onPick={(v) => { haptic.light(); setFace("front"); set({ refreshRate: v }); }}
                />
              </Card>
            )}
            {hasSoftware && (
              <Card>
                <SectionHeader title="Storage" accessory={maxStor < 1024 ? `${storLabel(effStor)} · max ${storLabel(maxStor)}` : storLabel(effStor)} />
                <Seg<number>
                  label="Capacity"
                  value={effStor}
                  options={storOptions}
                  onPick={(v) => { haptic.light(); set({ storage: v }); }}
                />
              </Card>
            )}
          </>
        )}

        {/* ── 4: Launch (stats · price · name · build) ─────── */}
        {labTab === "launch" && (
          <>
            <Card>
              <SectionHeader title="Stats" accessory={`Overall ${overall}`} />
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
                      <span>{met ? <><Check size={12} aria-hidden /> Competitive</> : `Target: ${target}+ Overall`}</span>
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
              <SectionHeader title="Price" />
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
                <StatPill label="Unit cost" value={format(unitCost)} />
                <StatPill label="Margin" value={`${format(margin)} · ${marginPct}%`} tone={marginPct > 0 ? "positive" : "negative"} />
                <StatPill label="Buyers expect" value={`$${Math.round(toDollars(guidance.lo) / 10) * 10}–$${Math.round(toDollars(guidance.hi) / 10) * 10}`} />
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
                    <div className="lab__bom-total lab__bom-subtotal">
                      <span>Parts (BOM)</span>
                      <span className="tnum">${total.toFixed(0)}</span>
                    </div>
                    <div className="lab__bom-assembly">
                      <span>Assembly &amp; overhead</span>
                      <span className="tnum">+${Math.max(0, Math.round(toDollars(unitCost) - total))}</span>
                    </div>
                    <div className="lab__bom-total">
                      <span>Unit cost</span>
                      <span className="tnum">${Math.round(toDollars(unitCost))}</span>
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
              {missing.length > 0 && <p className="lab__warn">Pick every component before building.</p>}
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

      {/* Sticky step nav above the tab bar — Back (left) + Next (right) so the design flow reads
          as clear steps. Fixed (stays put while the pane scrolls). The Launch step has its own
          Build CTA, so Next hides there. Suppressed during the first-build tutorial, where the
          Coach occupies the same bottom band and provides the guidance instead. */}
      {state.tutorialDone && (() => {
        const i = LAB_TABS.findIndex((t) => t.id === labTab);
        const prev = i > 0 ? LAB_TABS[i - 1] : null;
        const next = i < LAB_TABS.length - 1 ? LAB_TABS[i + 1] : null;
        return (
          <div className="lab__nav">
            {prev
              ? <Button variant="secondary" onClick={() => { haptic.light(); setLabTab(prev.id); }}><ArrowLeft size={16} /> Back</Button>
              : <span className="lab__nav-spacer" aria-hidden />}
            {next
              ? <Button onClick={() => { haptic.light(); setLabTab(next.id); }}>Next: {next.label} <ArrowRight size={16} /></Button>
              : <span className="lab__nav-spacer" aria-hidden />}
          </div>
        );
      })()}

      <Sheet open={wizard} onClose={() => setWizard(false)}>
        {wizard && <BuildWizard draft={draft} state={state} onConfirm={confirmBuild} onClose={() => setWizard(false)} />}
      </Sheet>

      <Sheet open={!!completed} onClose={() => setCompleted(null)}>
        {completed && (
          <DesignCompleteCard
            done={completed}
            onGoToHQ={() => { setCompleted(null); onGoToHQ?.(); }}
            onDesignAnother={() => setCompleted(null)}
          />
        )}
      </Sheet>
    </div>
  );
}

/** The closing beat of the design flow: confirms the device is finished and now manufacturing,
 *  then points the player to where they'll launch it (HQ). Turns a silent toast into a clear
 *  "you made something → here's what's next" moment. */
function DesignCompleteCard({
  done,
  onGoToHQ,
  onDesignAnother,
}: {
  done: CompletedBuild;
  onGoToHQ: () => void;
  onDesignAnother: () => void;
}) {
  const profD = toDollars(done.projectedProfit);
  return (
    <div className="done">
      <div className="done__badge" aria-hidden><Check size={24} strokeWidth={3} /></div>
      <h2 className="done__title">Design complete</h2>
      <p className="done__sub">“{done.product.name}” is finished and headed to the factory.</p>

      <div className="done__hero">
        <DeviceRenderer product={done.product} size={150} idle shimmer />
      </div>

      <div className="done__grid">
        <Stat label="Overall" value={`${done.overall}`} hint={done.overall >= 75 ? "flagship tier" : done.overall >= 55 ? "strong build" : done.overall >= 35 ? "mid-tier" : "entry tier"} />
        <Stat label="Run size" value={done.units.toLocaleString()} />
        <Stat
          label="Est. sales"
          value={done.projectedSales.toLocaleString()}
          tone={done.sellsOut ? "positive" : undefined}
          hint={done.sellsOut ? "would sell out" : undefined}
        />
        <Stat label="Est. profit" value={format(done.projectedProfit)} tone={profD >= 0 ? "positive" : "negative"} />
      </div>

      <div className="done__next">
        <div className="done__step">
          <span className="done__step-icon"><Factory size={16} /></span>
          <span>Manufacturing now — <b>ready in ~{done.weeks} {done.weeks === 1 ? "week" : "weeks"}</b>.</span>
        </div>
        <div className="done__step">
          <span className="done__step-icon"><Rocket size={16} /></span>
          <span>When it’s built, <b>launch it right here</b> — it’ll appear at the top of the Lab, ready to release.</span>
        </div>
      </div>

      <Button block onClick={onDesignAnother}><Sparkles size={16} /> Design another</Button>
      <button className="wiz__cancel" onClick={onGoToHQ}>View in HQ</button>
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
  const balanceLabel = plan.synergy >= 1.0 ? "Balanced" : plan.synergy >= 0.95 ? "Slightly off" : "Unbalanced";
  const balanceTone = plan.synergy >= 1.0 ? "positive" : plan.synergy >= 0.95 ? "accent" : "negative";

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
                <button key={c.id} className={`wiz__channel${channel === c.id ? " wiz__channel--on" : ""}`} disabled={!aff && c.id !== "none"} aria-pressed={channel === c.id} onClick={() => { setChannel(c.id); haptic.light(); }}>
                  <span className="wiz__channel-icon"><Icon size={18} /></span>
                  <div className="wiz__channel-text">
                    <span className="wiz__channel-name">{c.name}</span>
                    <span className="wiz__channel-blurb">{c.blurb}</span>
                  </div>
                  <div className="wiz__channel-meta">
                    <span>{c.cost > 0 ? format(c.cost) : "Free"}</span>
                    {demandDelta > 0 && (
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
            <Stat label="Demand fit" value={<>{Math.round(plan.demandFit)}<span className="lab__den">/100</span></>} tone={fitTone} hint={fitLabel} />
            <Stat label="Price fit" value={priceFit.label} tone={priceFit.tone} />
            <Stat label="Competition" value={compLabel} tone={compTone} />
            <Stat label="Balance" value={balanceLabel} tone={balanceTone} hint={plan.synergy < 0.97 ? "a weak component drags this down" : "components are well-matched"} />

            {plan.selfCompeting > 0 && (
              <Stat
                label="Cannibalization"
                value={`${plan.selfCompeting} of yours`}
                tone="accent"
                hint="your own products still selling here split this demand"
              />
            )}
            <Stat label="Your fans" value={state.fans.toLocaleString()} />
            <Stat label="Run size" value={plan.plannedUnits.toLocaleString()} />
            <Stat label="Projected sales" value={plan.projectedSales.toLocaleString()} tone={plan.sellsOut ? "positive" : undefined} hint={plan.sellsOut ? "run sells out — you could make more" : plan.projectedSales < plan.plannedUnits ? "some unsold" : undefined} />
            <Stat label="Projected profit" value={format(plan.projectedProfit)} tone={plan.projectedProfit >= 0 ? "positive" : "negative"} />
            <Stat
              label="Cash after build starts"
              value={format(cashAfter)}
              tone={cashAfter < 0 ? "negative" : undefined}
            />
            <Stat
              label="Runway"
              value={runway === Infinity || runway >= 520 ? "10+ yr" : runway >= 104 ? `${Math.round(runway / 52)} yr` : `${runway} wk`}
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

function Seg<T extends string | number>({
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
