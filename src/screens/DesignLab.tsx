import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Ban, Check, CircleDollarSign, FlaskConical, FlipHorizontal2, Globe, Hammer, Layers, Lock, Megaphone, Minus, Plus, Rocket, Scale, Search, Share2, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Trophy, Tv, Users, Factory, type LucideIcon } from "lucide-react";
import { Button, Card, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon, ComponentIcon } from "../design/icons.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { buildLaunchReveal, emitLaunchReveal } from "../design/launchReveal.ts";
import { maybePromptFirstLaunchReview } from "../state/review.ts";
import { launchOutcome, currentHitStreak } from "../design/launchFeedback.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORIES, COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { unlockedSuppliers, supplierFor, DEFAULT_SUPPLIER_ID, supplierLoyaltyTier, buildsToNextTier, supplierLoyaltyProgress, CONTRACT_TERMS, contractDiscount } from "../engine/suppliers.ts";
import { availableFactories, factoryFor, DEFAULT_FACTORY_ID, type CapacityStrategy } from "../engine/factories.ts";
import { eraModifier, isCategoryUnlocked } from "../engine/eras.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { suggestNextName } from "../engine/naming.ts";
import { format, dollars, sub, scale, toDollars } from "../engine/money.ts";
import { effectiveWeights, priceGuidance, scoreLaunch } from "../engine/market.ts";
import { MARKETING_CHANNELS, type ChannelId } from "../engine/marketing.ts";
import { componentSynergy, computeStats, effectiveRefreshRate, effectiveStorage, maxRefreshRate, maxStorage, missingSlots, overallScore } from "../engine/product.ts";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
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
  ProductTuning,
  RegionId,
  Stats,
  SupplierId,
} from "../engine/types.ts";
import { REGIONS, regionTasteFit } from "../engine/regions.ts";
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
  capacityPlan,
  contractSignFee,
  effectiveUnitCost,
  productStats,
  recommendedRun,
  researchedTier,
  verdictBands,
  osDisplayName,
  osEcoBonus,
  type GameState,
} from "../state/gameState.ts";
import { runwayWeeks } from "../engine/economy.ts";
import { forecastConfidence, forecastBand, forecastConfidenceLabel } from "../engine/forecast.ts";
import { useGame } from "../state/useGame.tsx";
import { StatBars } from "../components/charts.tsx";
import { segmentDemand, type SegmentDemand } from "../engine/segments.ts";
import { styleAppeal, styleAppealLabel } from "../engine/aesthetics.ts";
import { brandEquity, franchiseStem, equityHypeBonus, brandEquityLabel, playerFranchises } from "../engine/franchise.ts";
import { segmentWantsById } from "../engine/glossary.ts";
import { StatGlossary } from "../components/StatGlossary.tsx";
import "./designLab.css";

/** Epic A — "Who it's for": the per-segment positioning readout in the build wizard. Each bar is how
 *  much of that buyer segment's potential the product captures (fit × price reaction), so the player
 *  sees the trade-offs of their design before building (pillar #5; the positioning lever Epic A adds). */
function SegmentBreakdown({ segments }: { segments: SegmentDemand }) {
  const rows = segments.perSegment.map((r) => ({
    ...r,
    winRate: r.size > 0 ? Math.min(1, r.captured / r.size) : 0,
  }));
  const top = rows.reduce((a, b) => (b.captured > a.captured ? b : a));
  const low = rows.reduce((a, b) => (b.captured < a.captured ? b : a));
  const reason = low.priceFit < 0.6 ? "priced out" : low.fit < 35 ? "specs miss" : "niche fit";
  return (
    <div className="wiz__segs">
      <div className="wiz__segs-head">
        <span className="wiz__segs-title">Who it's for</span>
        <span className="wiz__segs-note">
          Best fit <b>{top.name}</b> · weakest {low.name} ({reason})
        </span>
      </div>
      <div className="wiz__seg-list">
        {rows.map((r) => {
          const pct = Math.round(r.winRate * 100);
          return (
            <div
              key={r.id}
              role="group"
              className={`wiz__seg-row${r.id === top.id ? " wiz__seg-row--top" : ""}`}
              aria-label={`${r.name}: wins ${pct}% of the segment. ${segmentWantsById(r.id)}`}
            >
              <div className="wiz__seg-main">
                <span className="wiz__seg-name">{r.name}</span>
                <div className="wiz__seg-bar" aria-hidden>
                  <span className="wiz__seg-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="wiz__seg-pct tnum" aria-hidden>{pct}%</span>
              </div>
              {/* C3 — plain-language "what this buyer wants", derived live from the segment weights */}
              <span className="wiz__seg-wants" aria-hidden>{segmentWantsById(r.id)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// Intentionally the most compact register (denser than glossary STAT_INFO.abbr) — these feed the
// tight inline component-contribution chips, where "Quality"/"Battery" would wrap. Kept local on
// purpose; the canonical label/abbr/prose registers live in engine/glossary.ts STAT_INFO.
const STAT_ABBR: Record<keyof Stats, string> = {
  performance: "Perf", quality: "Qual", battery: "Bat", design: "Dsn", ecosystem: "Eco",
};

function contribLabel(c: Partial<Stats>): string {
  return STAT_KEYS.filter((k) => c[k]).map((k) => `+${Math.round(c[k]!)} ${STAT_ABBR[k]}`).join(" · ");
}

const FINISHES: FinishId[] = ["plastic", "aluminium", "titanium", "gold"];
const TUNINGS: { id: ProductTuning; label: string; hint: string }[] = [
  { id: "efficiency", label: "Efficiency", hint: "+battery, −performance" },
  { id: "balanced", label: "Balanced", hint: "no trade-off" },
  { id: "performance", label: "Performance", hint: "+performance, −battery" },
  { id: "value", label: "Value", hint: "cheaper to build, −quality & design" },
  { id: "premium", label: "Premium", hint: "+quality & design, costs more to build" },
];
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

function newestProduct(state: GameState): Product | null {
  if (state.building.length) return state.building[state.building.length - 1].product;
  if (state.ready.length) return state.ready[state.ready.length - 1];
  if (state.launched.length) return state.launched[0].product;
  return null;
}

function freshDraft(state: GameState): Product {
  const tiers: Product["tiers"] = {};
  for (const k of CATEGORIES.phone.slots) tiers[k] = Math.min(1, researchedTier(state, k));
  const prevP = newestProduct(state);
  const base: Product = {
    id: "draft",
    name: prevP ? suggestNextName(prevP.name) : "Aurora One",
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
    tuning: "balanced",
    // Inherit the player's standing supply chain so they don't re-pick supplier/factory every design
    // (an owned line stays owned; a contract line stays available as the era only ever rises).
    supplierId: prevP?.supplierId,
    factoryId: prevP?.factoryId,
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
  const { state, build, launchReady, unlockLens, unlockFinish, negotiateContract } = useGame();
  const [contractSheet, setContractSheet] = useState<SupplierId | null>(null);
  const [draft, setDraft] = useState<Product>(() => (seed ? successorDraft(seed) : freshDraft(state)));
  const [face, setFace] = useState<"front" | "back">("front");
  const [wizard, setWizard] = useState(false);
  const [completed, setCompleted] = useState<CompletedBuild | null>(null);
  const [labTab, setLabTab] = useState<LabTab>("components");

  const cat = CATEGORIES[draft.category];
  const hasCamera = cat.slots.includes("camera");
  // Form-factor realism: only a handheld with a front screen + rear glass (phone / tablet) carries a
  // selfie cutout and a *designable* rear camera module (bump shape, position, layout, flash). Other
  // devices that still HAVE a camera — AR glasses — get a sensor count that feeds stats, but no
  // phone-style module or notch, so the Lab never offers controls the device can't have.
  const handheld = draft.category === "phone" || draft.category === "tablet";

  // Auto-switch device face when entering the Camera tab — but only for handhelds, which are the
  // only devices that render a back (and a designable rear module). Everything else stays on front.
  useEffect(() => {
    setFace(labTab === "camera" && handheld ? "back" : "front");
  }, [labTab, handheld]);

  // A successor seed handed in from a launched product's detail sheet: adopt it as the draft, then
  // tell the parent to clear it so re-renders don't keep overwriting the player's edits.
  useEffect(() => {
    if (!seed) return;
    setDraft(successorDraft(seed));
    setFace("front");
    onSeedConsumed?.();
  }, [seed, onSeedConsumed]);
  const unlockedCats = useMemo(
    () => Object.values(CATEGORIES).filter((c) => isCategoryUnlocked(c.id, state.era)),
    [state.era],
  );

  const stats = productStats(state, draft);
  // The TRUE per-unit cost — includes the full supply chain (supplier, dual-source, factory, loyalty
  // and any contract) so every sourcing/manufacturing choice the player makes moves this number live.
  const unitCost = effectiveUnitCost(state, draft);
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
  // player sees how the MIX of components scores, not just each slot maxed in isolation. G2 — show
  // BOTH sides: the bottleneck to fix AND the flagship bonus a coherent high-end build earns.
  const syn = componentSynergy(draft);
  const synPct = Math.round((syn.factor - 1) * 100);
  const synState: "flagship" | "weak" | "balanced" =
    syn.factor > 1.001 ? "flagship" : syn.weakest ? "weak" : "balanced";
  const capSlot = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
  // G1 — the device's form lifts the Style segment. Drive the LIVE breakdown through the SAME segment
  // model the wizard/launch use (demand + price overrides), so the always-visible "Fit" is consistent
  // with the actual launch math (it was previously the old single-trend demandScore).
  const styleAp = styleAppeal(draft);
  const styleLabel = styleAppealLabel(styleAp);
  const liveSegments = segmentDemand(stats, draft.price, state.trends, draft.category, styleAp);
  const formMatters = CATEGORIES[draft.category].slots.includes("camera") || CATEGORIES[draft.category].slots.includes("display");
  const mktMult = eraModifier(state.era).marketingHype; // Epic D — late eras amplify marketing reach
  const liveBrand = brandEquity(state.launched, franchiseStem(draft.name)); // brand-line anticipation
  const breakdown = scoreLaunch({
    stats,
    category: draft.category,
    price: draft.price,
    trends: state.trends,
    reputation: state.reputation,
    marketerSkill: marketerSkill(state) * mktMult,
    competitorStrength: 0,
    hypeBonus: hypeBonus(state) * mktMult + equityHypeBonus(liveBrand.equity),
    synergy: syn.factor,
    demandOverride: liveSegments.demandIndex,
    priceFitOverride: liveSegments.effectivePriceFit,
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
    if (handheld) setFace("back"); // only handhelds show a rear module to flip to
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

  function confirmBuild(units: number, channelId: ChannelId, regions: RegionId[], strategy: CapacityStrategy) {
    // Snapshot the finished design + its forecast BEFORE building (state mutates after) so the
    // completion sheet can celebrate exactly what just shipped to the factory floor. Bake the chosen
    // capacity strategy and (for "defects") its run-size-dependent quality hit onto the product.
    const base = { ...draft, regions, capacityStrategy: strategy };
    const penalty = strategy === "defects" ? capacityPlan(state, base, units).qualityPenalty : 0;
    const finished = penalty > 0 ? { ...base, defectPenalty: penalty } : base;
    const plan = planProduction(state, finished, units, channelId);
    const weeks = plan.buildWeeks; // strategy-resolved (longer under "stretch")
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
    const product = state.ready.find((p) => p.id === id);
    // Pre-launch plan + stats feed the deterministic critic reviews shown in the reveal.
    const plan = product ? planProduction(state, product, product.plannedUnits ?? BALANCE.build.minRun, (product.channelId as ChannelId) ?? "none") : null;
    const res = launchReady(id);
    if (!res.ok) return;
    haptic.success();
    // launchOutcome keys the celebration off the ACTUAL recorded verdict (competition-adjusted),
    // not the raw score — and is shared with HQ so the two launch surfaces can't drift.
    const { isHit } = launchOutcome(res, launchedBefore);
    sfx("launch");
    if (isHit) setTimeout(() => sfx("hit"), 380);
    // Debut peak — first product ever ships (mirrors HQ): heavier thump + a triumphant chime atop
    // the reveal's confetti so the core-loop payoff lands as a genuine high.
    if (launchedBefore.length === 0) {
      haptic.heavy();
      if (!isHit) setTimeout(() => sfx("hit"), 420);
    }
    // Hit-streak dopamine (mirrors HQ): a hit extends the pre-launch streak; anything else breaks it.
    const streak = isHit ? currentHitStreak(launchedBefore) + 1 : 0;
    if (streak >= 3) setTimeout(() => haptic.heavy(), 200);
    if (product && plan) {
      emitLaunchReveal(buildLaunchReveal({
        product,
        stats: productStats(state, product),
        verdict: res.verdict ?? "steady",
        demandFit: plan.demandFit,
        priceFit: plan.priceFit,
        betterRivals: plan.betterRivals,
        units: plan.projectedSales,
        isHit,
        firstLaunch: launchedBefore.length === 0,
        streak,
      }));
      // First product ever shipped — a real high point. Ask for an App Store review (once).
      if (launchedBefore.length === 0) maybePromptFirstLaunchReview();
    }
  }

  // Derive top-wanted stat for the market hint (highest target weight vs current weight delta)
  const topWanted = STAT_KEYS.reduce((best, k) => {
    const d = state.trends.targetWeights[k] - state.trends.weights[k];
    const bestD = state.trends.targetWeights[best] - state.trends.weights[best];
    return d > bestD ? k : best;
  }, STAT_KEYS[0]);
  const topWantedDelta = state.trends.targetWeights[topWanted] - state.trends.weights[topWanted];
  // Sentence-form labels for the "X is trending up" hint — "Battery life" reads better mid-sentence
  // than the canonical "Battery". Kept local on purpose; canonical copy lives in glossary STAT_INFO.
  const STAT_LABEL_FULL: Record<keyof Stats, string> = { performance: "Performance", quality: "Quality", battery: "Battery life", design: "Design", ecosystem: "Ecosystem" };

  return (
    <div className="lab">
      {/* Header strip — subtitle + the live projected-verdict badge (mockup's "Steady Seller"). */}
      <div className="lab__head">
        <p className="lab__subtitle">Build iconic devices. Define the future.</p>
        <span className={`lab__verdict-badge lab__verdict-badge--${verdict.tone}`}>
          <ShieldCheck size={14} aria-hidden /> {verdict.label}
        </span>
      </div>
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

      {/* Hero device — always visible, updates live as you design. Two-column card:
          device on a green glow (left), live design read-out (right). */}
      <Card className="lab__hero">
        <div className="lab__hero-grid">
          <div className="lab__hero-stage">
            <span className="lab__hero-glow" aria-hidden />
            <DeviceRenderer product={draft} size={160} idle shimmer flip={handheld} face={face} />
            <div className="lab__hero-cats">
              {unlockedCats.map((c) => (
                <button
                  key={c.id}
                  className={`lab__hero-cat${draft.category === c.id ? " lab__hero-cat--on" : ""}`}
                  aria-pressed={draft.category === c.id}
                  onClick={() => {
                    haptic.light();
                    const tiers: Product["tiers"] = {};
                    for (const k of c.slots) tiers[k] = Math.min(draft.tiers[k] ?? 1, researchedTier(state, k)) || 1;
                    set({ category: c.id, tiers });
                  }}
                >
                  <CategoryIcon id={c.id} size={14} /> {c.displayName}
                </button>
              ))}
            </div>
          </div>
          <div className="lab__hero-info">
            <div className="lab__hero-name-row">
              <span className="lab__hero-name">{draft.name || "Untitled"}</span>
              <span className="lab__hero-tag">Concept</span>
            </div>
            <div className="lab__hero-fit">
              <span className="lab__hero-fit-label">Fit</span>
              <span className="lab__hero-fit-val tnum">{fit} <span className="lab__den">/ 100</span></span>
              <div className="lab__hero-bar"><div className="lab__hero-bar-fill" style={{ width: `${Math.max(0, Math.min(100, fit))}%` }} /></div>
            </div>
            <div className="lab__hero-line">
              <span className="lab__hero-line-label">Build</span>
              <span className={`lab__hero-line-val lab__hero-line-val--${synState}`}>
                <Scale size={15} aria-hidden /> {synState === "flagship" ? `Flagship +${synPct}%` : synState === "weak" ? `Weak: ${capSlot(syn.weakest!)}` : "Balanced"}
              </span>
            </div>
            {formMatters && (
              <div className="lab__hero-line">
                <span className="lab__hero-line-label">Design Language</span>
                <span className="lab__hero-line-val">
                  <Sparkles size={14} aria-hidden /> <strong>{styleLabel}</strong>
                  <span className="lab__hero-line-hint">{styleLabel === "Striking" ? " — wins style-led buyers" : " — refine form for appeal"}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        {handheld && (
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
        {synState !== "balanced" && (
          <p className="lab__verdict-note">
            {synState === "flagship"
              ? "Coherent high-end build — every part pulls its weight, earning a flagship bonus."
              : `${capSlot(syn.weakest!)} is the weak link dragging this build down — raise it to lift the whole product.`}
          </p>
        )}
        {competitionDrag && preview && (
          <p className="lab__verdict-note">
            {preview.betterRivals > 0
              ? `${preview.betterRivals} rival${preview.betterRivals > 1 ? "s" : ""} currently outclass this — that's pulling the forecast down, not your design.`
              : `${preview.matchingRivals} rival${preview.matchingRivals > 1 ? "s" : ""} match you right now — they'll split this market.`}
          </p>
        )}
      </Card>

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
            {/* The 3rd tab is "Camera" only when the device has one; otherwise it holds display/
                storage specs (a monitor's refresh, a desktop's capacity), so label it "Specs". */}
            {t.id === "camera" ? (hasCamera ? "Camera" : "Specs") : t.label}
          </button>
        ))}
      </div>

      {/* Tab content — key forces remount → CSS fade-in on every tab switch */}
      <div className="lab__pane" key={labTab}>

        {/* ── 1: Components ───────────────────────────────── */}
        {labTab === "components" && (
          <>
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
                    <span className="lab__comp-tile" aria-hidden><ComponentIcon kind={kind} size={20} /></span>
                    <div className="lab__comp-info">
                      <span className="lab__comp-cat">
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
                      <span className="lab__comp-name">{def?.name ?? "—"}</span>
                      <span className="lab__comp-meta">
                      {def && toDollars(def.unitCost) > 0 && (
                        <span className="lab__comp-cost">{format(def.unitCost)}</span>
                      )}
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
                      </span>
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

          {/* Sourcing — pick the component supplier. Trades unit cost vs build quality vs lead time;
              the choice rides on the product and is shown again in the build wizard summary. */}
          <Card>
            <SectionHeader title="Sourcing" accessory="component supplier" />
            <div className="lab__suppliers">
              {unlockedSuppliers(state.era).map((sup) => {
                const on = (draft.supplierId ?? DEFAULT_SUPPLIER_ID) === sup.id;
                const costPct = Math.round((sup.costMult - 1) * 100);
                const builds = state.supplierLoyalty?.[sup.id] ?? 0;
                const tier = supplierLoyaltyTier(builds);
                const toNext = buildsToNextTier(builds);
                return (
                  <button
                    key={sup.id}
                    className={`lab__supplier${on ? " lab__supplier--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => { haptic.light(); set({ supplierId: sup.id }); }}
                  >
                    <span className="lab__supplier-main">
                      <span className="lab__supplier-name">{sup.name}</span>
                      <span className="lab__supplier-blurb">{sup.blurb}</span>
                      <span className="lab__supplier-tags">
                        <span className={`lab__sup-tag lab__sup-tag--${costPct > 0 ? "cost-up" : costPct < 0 ? "cost-down" : "neutral"}`}>
                          {costPct === 0 ? "baseline cost" : `${costPct > 0 ? "+" : ""}${costPct}% cost`}
                        </span>
                        {sup.qualityDelta !== 0 && (
                          <span className={`lab__sup-tag lab__sup-tag--${sup.qualityDelta > 0 ? "good" : "bad"}`}>
                            {sup.qualityDelta > 0 ? "+" : ""}{sup.qualityDelta} quality
                          </span>
                        )}
                        {sup.leadWeeks > 0 && (
                          <span className="lab__sup-tag lab__sup-tag--bad">+{sup.leadWeeks} wk lead</span>
                        )}
                        {sup.crunchMult < 1 && (
                          <span className="lab__sup-tag lab__sup-tag--good">shock-resistant</span>
                        )}
                        {sup.crunchMult > 1 && (
                          <span className="lab__sup-tag lab__sup-tag--bad">crunch-exposed</span>
                        )}
                        {tier.discount > 0 && (
                          <span className="lab__sup-tag lab__sup-tag--good">{tier.name} · −{Math.round(tier.discount * 100)}%</span>
                        )}
                      </span>
                      {builds > 0 && (
                        <span className="lab__rel">
                          <span className="lab__rel-bar"><span className="lab__rel-fill" style={{ width: `${Math.round(supplierLoyaltyProgress(builds) * 100)}%` }} /></span>
                          <span className="lab__rel-label">{toNext != null ? `${builds} build${builds === 1 ? "" : "s"} · ${toNext} to next tier` : `${builds} builds · top tier`}</span>
                        </span>
                      )}
                    </span>
                    <span className="lab__supplier-check" aria-hidden>{on && <Check size={16} />}</span>
                  </button>
                );
              })}
            </div>
            <div className="lab__toggle-row lab__dual">
              <span className="lab__dual-text">
                <span className="lab__seg-label">Dual-source</span>
                <small>+{Math.round(BALANCE.supply.dualSource.costPremium * 100)}% unit cost · about half the crunch risk</small>
              </span>
              <button
                className={`lab__toggle${draft.dualSource ? " lab__toggle--on" : ""}`}
                role="switch"
                aria-label="Dual-source components"
                aria-checked={!!draft.dualSource}
                onClick={() => { haptic.light(); set({ dualSource: !draft.dualSource }); }}
              >
                <span className="lab__toggle-knob" />
              </button>
            </div>
            {(() => {
              const sid = (draft.supplierId ?? DEFAULT_SUPPLIER_ID) as SupplierId;
              const c = state.supplierContracts?.[sid];
              const active = !!c && c.weeksLeft > 0;
              return (
                <div className="lab__contract">
                  <span className="lab__dual-text">
                    <span className="lab__seg-label">Contract · {supplierFor(sid).name}</span>
                    <small>{active ? `−${Math.round(c!.discount * 100)}% locked · ${c!.weeksLeft} wk left · crunch-proof` : "Lock a discounted, crunch-proof price for a term"}</small>
                  </span>
                  <Button size="sm" variant={active ? "tertiary" : "secondary"} onClick={() => { haptic.light(); setContractSheet(sid); }}>
                    {active ? "Renew" : "Negotiate"}
                  </Button>
                </div>
              );
            })()}
          </Card>

          {/* Manufacturing — pick the factory. Trades tooling / per-unit cost / build speed and a
              throughput capacity (over-capacity runs pay overtime, surfaced in the build wizard). */}
          <Card>
            <SectionHeader title="Manufacturing" accessory="factory" />
            <div className="lab__suppliers">
              {availableFactories(state.era, state.ownedFactories).map((fac) => {
                const on = (draft.factoryId ?? DEFAULT_FACTORY_ID) === fac.id;
                const toolPct = Math.round((fac.toolingMult - 1) * 100);
                const unitPct = Math.round((fac.unitMult - 1) * 100);
                return (
                  <button
                    key={fac.id}
                    className={`lab__supplier${on ? " lab__supplier--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => { haptic.light(); set({ factoryId: fac.id }); }}
                  >
                    <span className="lab__supplier-main">
                      <span className="lab__supplier-name">{fac.name}</span>
                      <span className="lab__supplier-blurb">{fac.blurb}</span>
                      <span className="lab__supplier-tags">
                        <span className={`lab__sup-tag lab__sup-tag--${fac.speedMult < 1 ? "good" : fac.speedMult > 1 ? "bad" : "neutral"}`}>
                          {fac.speedMult < 1 ? "faster build" : fac.speedMult > 1 ? "slower build" : "standard speed"}
                        </span>
                        {toolPct !== 0 && (
                          <span className={`lab__sup-tag lab__sup-tag--${toolPct < 0 ? "cost-down" : "cost-up"}`}>{toolPct > 0 ? "+" : ""}{toolPct}% tooling</span>
                        )}
                        {unitPct !== 0 && (
                          <span className={`lab__sup-tag lab__sup-tag--${unitPct < 0 ? "cost-down" : "cost-up"}`}>{unitPct > 0 ? "+" : ""}{unitPct}% unit</span>
                        )}
                        <span className="lab__sup-tag">
                          {Number.isFinite(fac.capacityPerWeek) ? `${fac.capacityPerWeek.toLocaleString()}/wk cap` : "no capacity limit"}
                        </span>
                      </span>
                    </span>
                    <span className="lab__supplier-check" aria-hidden>{on && <Check size={16} />}</span>
                  </button>
                );
              })}
            </div>
          </Card>
          </>
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
              <SectionHeader title="Tuning" accessory={TUNINGS.find((t) => t.id === (draft.tuning ?? "balanced"))?.hint} />
              <div className="lab__chips">
                {TUNINGS.map((t) => {
                  const on = (draft.tuning ?? "balanced") === t.id;
                  return (
                    <button
                      key={t.id}
                      className={`lab__chip${on ? " lab__chip--on" : ""}`}
                      aria-pressed={on}
                      title={t.hint}
                      onClick={() => { haptic.light(); set({ tuning: t.id }); }}
                    >
                      {t.label}
                    </button>
                  );
                })}
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
                <SectionHeader title="Camera" accessory={handheld ? "back of device" : "sensor array"} />
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
                {/* The bump shape / position / layout / flash are a phone-style rear MODULE — only
                    handhelds render one. Devices like AR glasses just carry a sensor count (above),
                    which still feeds the photography stat, so we hide the module-design controls. */}
                {handheld ? (
                  <>
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
                        aria-label="Flash"
                        aria-checked={draft.camera.flash}
                        onClick={() => setCam({ flash: !draft.camera.flash })}
                      >
                        <span className="lab__toggle-knob" />
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="lab__hint">More sensors sharpen the photography rating; this device has no rear module to style.</p>
                )}
              </Card>
            )}
            {handheld && (
              <Card>
                <SectionHeader title="Front" accessory="selfie camera" />
                <Seg<NotchStyle>
                  label="Cutout"
                  value={draft.notch}
                  options={[["punch", "Punch-hole"], ["island", "Island"], ["notch", "Notch"], ["none", "None"]]}
                  onPick={(v) => { haptic.light(); setFace("front"); set({ notch: v }); }}
                />
              </Card>
            )}
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
              <StatGlossary />
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
              <SectionHeader
                title="Price"
                accessory={
                  <button
                    type="button"
                    className="lab__suggest"
                    onClick={() => { set({ price: dollars(fairPriceDollars) }); haptic.light(); }}
                  >
                    Suggest
                  </button>
                }
              />
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
              <SectionHeader title="Name & build" accessory={`~${buildWeeksFor(state, draft)} wk to make`} />
              {(() => {
                // "Continue a line" — one-tap sequels: name the draft as the next entry in one of your
                // existing lines (and inherit its brand equity). Same-category lines first.
                const lines = playerFranchises(state.launched)
                  .sort((a, b) => Number(b.categories.includes(draft.category)) - Number(a.categories.includes(draft.category)))
                  .slice(0, 4);
                if (lines.length === 0) return null;
                return (
                  <div className="lab__lines">
                    <span className="lab__lines-label">Continue a line</span>
                    <div className="lab__lines-chips">
                      {lines.map((f) => (
                        <button
                          key={f.stem}
                          className="lab__line-chip"
                          onClick={() => { set({ name: suggestNextName(f.latestName) }); haptic.light(); }}
                        >
                          {f.name}
                          <span className={`lab__line-tag lab__line-tag--${f.label.toLowerCase().replace(/\s+/g, "")}`}>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
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

      {/* Persistent build summary — cost / score / market fit at a glance (mockup footer bar). */}
      <Card className="lab__summary">
        <div className="lab__summary-cell">
          <CircleDollarSign size={18} className="lab__summary-icon" aria-hidden />
          <span className="lab__summary-text">
            <span className="lab__summary-label">Est. Cost</span>
            <AnimatedMoney value={unitCost} className="lab__summary-val tnum" />
          </span>
        </div>
        <div className="lab__summary-cell">
          <Trophy size={18} className="lab__summary-icon" aria-hidden />
          <span className="lab__summary-text">
            <span className="lab__summary-label">Est. Score</span>
            <span className="lab__summary-val tnum">{overall} <span className="lab__den">/ 100</span></span>
          </span>
        </div>
        <div className="lab__summary-cell">
          <TrendingUp size={18} className="lab__summary-icon" aria-hidden />
          <span className="lab__summary-text">
            <span className="lab__summary-label">Market Fit</span>
            <span className="lab__summary-val">{fit >= 70 ? "Excellent" : fit >= 50 ? "Strong" : fit >= 35 ? "Good" : fit >= 20 ? "Fair" : "Weak"}</span>
          </span>
        </div>
      </Card>

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

      <Sheet open={!!contractSheet} onClose={() => setContractSheet(null)}>
        {contractSheet && (
          <ContractSheet
            supplierId={contractSheet}
            state={state}
            onSign={(termId) => { negotiateContract(contractSheet, termId); haptic.success(); sfx("cash"); setContractSheet(null); }}
            onClose={() => setContractSheet(null)}
          />
        )}
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
      <p className="done__sub">
        “{done.product.name}” is finished and headed to {done.product.factoryId && done.product.factoryId !== DEFAULT_FACTORY_ID ? factoryFor(done.product.factoryId).name : "the factory"}.
      </p>

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
          <span>The moment it's built, a <b>launch popup</b> appears wherever you are — ship it in one tap.</span>
        </div>
      </div>

      <Button block onClick={onDesignAnother}><Sparkles size={16} /> Design another</Button>
      <button className="wiz__cancel" onClick={onGoToHQ}>View in Office</button>
    </div>
  );
}

const WIZARD_CHANNEL_ICONS: Record<string, LucideIcon> = { Ban, Share2, Search, Megaphone, Users, Tv, Sparkles };

/** Negotiate a fixed-price supplier contract — lock a discount + crunch immunity for a term, for an
 *  upfront fee. Reputation is the negotiating leverage (sweetens the discount). */
function ContractSheet({
  supplierId,
  state,
  onSign,
  onClose,
}: {
  supplierId: SupplierId;
  state: GameState;
  onSign: (termId: typeof CONTRACT_TERMS[number]["id"]) => void;
  onClose: () => void;
}) {
  const sup = supplierFor(supplierId);
  const repBonusPct = Math.round((Math.min(100, Math.max(0, state.reputation)) / 100) * BALANCE.supply.contract.repDiscountMax * 100);
  const active = state.supplierContracts?.[supplierId];
  return (
    <div className="ctr">
      <h2 className="ctr__title">Contract · {sup.name}</h2>
      <p className="ctr__sub">
        Lock a discounted unit price for a fixed term — and while it holds, this supplier is <b>crunch-proof</b>.
        Your reputation ({Math.round(state.reputation)}) negotiates <b>+{repBonusPct}%</b> off.
      </p>
      {active && active.weeksLeft > 0 && (
        <p className="ctr__active">Current deal: −{Math.round(active.discount * 100)}% · {active.weeksLeft} wk left. Signing again replaces it.</p>
      )}
      <div className="ctr__terms">
        {CONTRACT_TERMS.map((t) => {
          const disc = Math.round(contractDiscount(t, state.reputation, BALANCE.supply.contract.repDiscountMax) * 100);
          const fee = contractSignFee(state.era, t);
          const afford = state.cash >= fee;
          return (
            <button key={t.id} type="button" className="ctr__term" disabled={!afford} onClick={() => onSign(t.id)}>
              <span className="ctr__term-main">
                <span className="ctr__term-name">{t.name} <span className="ctr__term-disc">−{disc}%</span></span>
                <span className="ctr__term-meta">{t.weeks} wk · price-locked · crunch-proof</span>
              </span>
              <span className={`ctr__term-fee tnum${afford ? "" : " ctr__term-fee--bad"}`}>{format(fee)}</span>
            </button>
          );
        })}
      </div>
      <button className="wiz__cancel" onClick={onClose}>Maybe later</button>
    </div>
  );
}

/** The multi-step production wizard: run size → marketing → review (with a smart demand forecast). */
function BuildWizard({
  draft,
  state,
  onConfirm,
  onClose,
}: {
  draft: Product;
  state: GameState;
  onConfirm: (units: number, channelId: ChannelId, regions: RegionId[], strategy: CapacityStrategy) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<ChannelId>("none");
  // Regions this product ships to. Default to the draft's selection (filtered to what's unlocked),
  // else Home. The Regions step only appears once the player has expanded beyond Home, so early-game
  // builds stay a clean 3-step flow.
  const [regions, setRegions] = useState<RegionId[]>(() => {
    const chosen = (draft.regions ?? ["home"]).filter((id) => state.unlockedRegions.includes(id));
    return chosen.length ? chosen : ["home"];
  });
  const expanded = state.unlockedRegions.length > 1;
  const steps = useMemo<("regions" | "run" | "marketing" | "review")[]>(
    () => (expanded ? ["regions", "run", "marketing", "review"] : ["run", "marketing", "review"]),
    [expanded],
  );
  const cur = steps[step];
  const lastStep = steps.length - 1;
  // Capacity strategy for an over-capacity run (pay overtime / stretch the schedule / accept defects).
  const [strategy, setStrategy] = useState<CapacityStrategy>(draft.capacityStrategy ?? "overtime");
  // The product as it will actually ship: region selection + capacity strategy. The defect penalty
  // (only under "defects") depends on run size, so it's baked below once `units` is known.
  const prodBase = useMemo(() => ({ ...draft, regions, capacityStrategy: strategy }), [draft, regions, strategy]);
  const [units, setUnits] = useState(() => recommendedRun(state, prodBase, "none"));
  // Bake the prospective quality hit so every forecast (and the launch) reflects the chosen strategy.
  const defectPenalty = useMemo(
    () => (strategy === "defects" ? capacityPlan(state, prodBase, units).qualityPenalty : 0),
    [state, prodBase, units, strategy],
  );
  const prod = useMemo(
    () => (defectPenalty > 0 ? { ...prodBase, defectPenalty } : prodBase),
    [prodBase, defectPenalty],
  );

  const plan = useMemo(() => planProduction(state, prod, units, channel), [state, prod, units, channel]);
  const recommended = useMemo(() => recommendedRun(state, prod, channel), [state, prod, channel]);
  const baseDemand = useMemo(() => planProduction(state, prod, units, "none").totalDemand, [state, prod, units]);
  const affordable = state.cash >= plan.totalUpfront;
  // C2 — the forecast band tightens as the player invests in market knowledge (marketer skill +
  // Demand Sensing). The SAME confidence scales the realized launch variance, so this band is honest.
  const forecastConf = forecastConfidence({
    marketerSkill: marketerSkill(state),
    demandSensing: state.completedProjects.includes("demandSensing"),
  });
  const variancePct = forecastBand(forecastConf) * eraModifier(state.era).demandVariance; // Epic D — AI era is volatile
  const confLabel = forecastConfidenceLabel(forecastConf);
  const demandLow = Math.round(plan.totalDemand * (1 - variancePct));
  const demandHigh = Math.round(plan.totalDemand * (1 + variancePct));

  // B1b — readable build-risk: cash left the instant the run is paid for, the runway that buys at
  // current burn (no revenue arrives until launch), and the build duration. If the runway can't
  // outlast the build, the run may bankrupt the player mid-manufacture — surface it, don't block it.
  const buildWks = plan.buildWeeks; // strategy-resolved (stretch can extend it)
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
          <p className="wiz__sub">Step {step + 1} of {steps.length} · {cur === "regions" ? "Markets" : cur === "run" ? "Production run" : cur === "marketing" ? "Marketing" : "Review & build"}</p>
        </div>
      </div>
      <div className="wiz__steps">{steps.map((_, i) => <span key={i} className={`wiz__step${i <= step ? " wiz__step--on" : ""}`} />)}</div>

      {cur === "regions" && (
        <div className="wiz__body">
          <p className="wiz__lead">Where should <b>{draft.name}</b> sell? Each market adds demand, but buyers value different things — ship where your design fits.</p>
          <div className="wiz__regions">
            {REGIONS.filter((r) => state.unlockedRegions.includes(r.id)).map((r) => {
              const on = regions.includes(r.id);
              const fit = regionTasteFit(productStats(state, prod), r);
              const fitLabel = r.id === "home" ? "Home" : fit >= 1.12 ? "Great fit" : fit >= 1.0 ? "Good fit" : fit >= 0.85 ? "Modest fit" : "Poor fit";
              const fitTone = r.id === "home" ? "accent" : fit >= 1.0 ? "positive" : fit >= 0.85 ? "accent" : "negative";
              const toggle = () => {
                haptic.light();
                setRegions((cur2) => {
                  const next = cur2.includes(r.id) ? cur2.filter((x) => x !== r.id) : [...cur2, r.id];
                  return next.length ? next : ["home"]; // never empty
                });
              };
              return (
                <button key={r.id} className={`wiz__region${on ? " wiz__region--on" : ""}`} aria-pressed={on} onClick={toggle}>
                  <span className="wiz__region-check">{on ? <Check size={14} /> : <Globe size={14} />}</span>
                  <div className="wiz__region-text">
                    <span className="wiz__region-name">{r.name}</span>
                    <span className="wiz__region-blurb">{r.blurb}</span>
                  </div>
                  <span className={`wiz__region-fit wiz__region-fit--${fitTone}`}>{fitLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="wiz__grid">
            <Stat label="Markets selected" value={`${regions.length} of ${state.unlockedRegions.length}`} />
            <Stat label="Projected demand" value={plan.totalDemand.toLocaleString()} tone={plan.sellsOut ? "positive" : undefined} hint="across selected markets" />
          </div>
        </div>
      )}

      {cur === "run" && (
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
          {plan.overCapacity && (
            <div className="wiz__capacity">
              <span className="wiz__capacity-head">
                <AlertTriangle size={14} aria-hidden /> Over <b>{factoryFor(prod.factoryId).name}</b>'s capacity ({plan.factoryCapacityPerWeek.toLocaleString()}/wk) — {plan.overtimeUnits.toLocaleString()} extra units. How to handle it?
              </span>
              <div className="wiz__capacity-opts" role="group" aria-label="Over-capacity strategy">
                {(["overtime", "stretch", "defects"] as CapacityStrategy[]).map((opt) => {
                  const o = capacityPlan(state, { ...prodBase, capacityStrategy: opt }, units);
                  const label = opt === "overtime" ? "Pay overtime" : opt === "stretch" ? "Stretch" : "Accept defects";
                  const detail =
                    opt === "overtime" ? `+${format(scale(plan.unitCost, o.overUnits * o.overtimeFraction))}`
                    : opt === "stretch" ? `+${Math.max(0, o.buildWeeks - plan.assemblyWeeks)} wk`
                    : `−${o.qualityPenalty} quality`;
                  const on = strategy === opt;
                  return (
                    <button key={opt} type="button" className={`wiz__cap-opt${on ? " wiz__cap-opt--on" : ""}`} aria-pressed={on} onClick={() => { setStrategy(opt); haptic.light(); }}>
                      <span className="wiz__cap-opt-label">{label}</span>
                      <span className="wiz__cap-opt-detail">{detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className={`wiz__forecast wiz__forecast--${confLabel.toLowerCase()}`}>
            <span className="wiz__forecast-label">Forecast confidence</span>
            <span className="wiz__forecast-val">{confLabel}</span>
            <span className="wiz__forecast-note">
              {confLabel === "High" ? "tight, reliable demand band" : "marketers + Demand Sensing research tighten this"}
            </span>
          </div>
          {plan.brand.entries > 0 && (
            <div className={`wiz__brand wiz__brand--${brandEquityLabel(plan.brand).toLowerCase().replace(/\s+/g, "")}`}>
              <TrendingUp size={13} aria-hidden />
              <span className="wiz__brand-name">{plan.brand.stem.replace(/\b\w/g, (c) => c.toUpperCase())} line</span>
              <span className="wiz__brand-tag">{brandEquityLabel(plan.brand)}</span>
              <span className="wiz__brand-note">
                {plan.brand.equity > 0 ? "loyal pre-orders + anticipation" : plan.brand.equity < 0 ? "a past flop is hurting this line" : "no track record yet"}
              </span>
            </div>
          )}
        </div>
      )}

      {cur === "marketing" && (
        <div className="wiz__body">
          <p className="wiz__lead">Pick a launch campaign — bigger campaigns add hype (more demand) for an upfront cost.</p>
          <div className="wiz__channels">
            {MARKETING_CHANNELS.map((c) => {
              const Icon = WIZARD_CHANNEL_ICONS[c.icon] ?? Ban;
              const aff = state.cash >= c.cost;
              const chanDemand = planProduction(state, prod, units, c.id).totalDemand;
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

      {cur === "review" && (
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
            {(() => {
              const sup = supplierFor(draft.supplierId);
              const costPct = Math.round((sup.costMult - 1) * 100);
              const bits = [costPct === 0 ? "baseline cost" : `${costPct > 0 ? "+" : ""}${costPct}% cost`];
              if (sup.qualityDelta !== 0) bits.push(`${sup.qualityDelta > 0 ? "+" : ""}${sup.qualityDelta} quality`);
              if (sup.leadWeeks > 0) bits.push(`+${sup.leadWeeks} wk lead`);
              if (draft.dualSource) bits.push("dual-sourced");
              return <Stat label="Sourced via" value={draft.dualSource ? `${sup.name} ×2` : sup.name} hint={bits.join(" · ")} />;
            })()}
            <Stat
              label="Built at"
              value={factoryFor(prod.factoryId).name}
              tone={plan.overCapacity ? "negative" : undefined}
              hint={plan.overCapacity ? `over capacity · ${plan.capacityStrategy}` : "within capacity"}
            />
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
          <SegmentBreakdown segments={plan.segments} />
          {state.platformUnlocked && osEcoBonus(state) > 0 && (
            <div className="wiz__os-note">
              <Layers size={13} aria-hidden />
              <span>
                Runs <strong>{osDisplayName(state)} v{state.osVersion}.0</strong> · +{osEcoBonus(state)} ecosystem
                from {state.osFeatures.length} {state.osFeatures.length === 1 ? "module" : "modules"}
              </span>
            </div>
          )}
          <div className="wiz__total">
            <span>Upfront cost</span>
            <span className={`rounded tnum${affordable ? "" : " wiz__total--bad"}`}>{format(plan.totalUpfront)}</span>
          </div>
          {plan.overCapacity && (
            <p className="wiz__warn wiz__warn--risk">
              <AlertTriangle size={14} /> {plan.overtimeUnits.toLocaleString()} units over {factoryFor(prod.factoryId).name}'s capacity —{" "}
              {plan.capacityStrategy === "overtime" ? <>built on overtime (<b>+{format(plan.overtimeCost)}</b>).</>
                : plan.capacityStrategy === "stretch" ? <>schedule stretched to <b>{plan.buildWeeks} wk</b> to fit capacity.</>
                : <>shipping with a <b>−{prod.defectPenalty ?? 0} quality</b> defect hit.</>}{" "}
              Change it in the Run step, pick a bigger line, or trim the run.
            </p>
          )}
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
        {step < lastStep ? (
          <Button block onClick={() => { setStep(step + 1); haptic.light(); }}>Next</Button>
        ) : (
          <Button block disabled={!affordable} onClick={() => onConfirm(units, channel, regions, strategy)} haptics="none">
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
