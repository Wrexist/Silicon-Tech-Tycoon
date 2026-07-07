import { useEffect, useState } from "react";
import { ArrowRight, Building2, ChevronRight, Clock, Crown, Globe, Lightbulb, Lock, Megaphone, Minus, Newspaper, Package, Plus, Rocket, RotateCw, Sparkles, Star, Target, TrendingDown, TrendingUp, Wand2, X, type LucideIcon } from "lucide-react";
import { Button, Card, EmptyState, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { rivalDef, rivalDoctrine, rivalMarketCap, DOCTRINE_LABEL, DOCTRINE_EXPLAINER } from "../engine/competitors.ts";
import { playerFranchises, rivalLines, franchiseStem, type FranchiseSummary } from "../engine/franchise.ts";
import { rivalLicenseFee } from "../engine/platform.ts";
import type { RivalRelease } from "../engine/rivalAI.ts";
import { eraName } from "../engine/eras.ts";
import { overallScore } from "../engine/product.ts";
import { dollars, format, formatShortDollars, sub, toDollars, cents } from "../engine/money.ts";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { priceFit } from "../engine/market.ts";
import { postMortem, type FactorKey } from "../engine/postmortem.ts";
import { criticReviews } from "../engine/reviews.ts";
import { buyCost, holdingsValue, sellProceeds, weeklyDividends } from "../engine/stocks.ts";
import {
  burn,
  canList,
  canAcquire,
  acquisitionCost,
  companyValuation,
  founderStakeValue,
  industryLeaderboard,
  industryRank,
  marketingPushQuote,
  netWorth,
  nextWeekRevenue,
  osDisplayName,
  osTierInfo,
  productStats,
  type FeedItem,
} from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import type { CategoryId, CompetitorState, LaunchedProduct, Product, Stats } from "../engine/types.ts";
import { STAT_KEYS } from "../engine/types.ts";
import { REGIONS, regionById, regionTasteFit, shippableRegions } from "../engine/regions.ts";
import { supplierFor, DEFAULT_SUPPLIER_ID } from "../engine/suppliers.ts";
import { factoryFor, DEFAULT_FACTORY_ID } from "../engine/factories.ts";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import { StatGlossary } from "../components/StatGlossary.tsx";
import { Sparkline, SalesCurveChart } from "../components/charts.tsx";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import "./market.css";

const CATEGORY_LABEL: Record<string, string> = {
  phone: "Phone", tablet: "Tablet", laptop: "Laptop", desktop: "Desktop",
  monitor: "Monitor", console: "Console", wearable: "Wearable", experimental: "AR/VR",
};

type Verdict = "hit" | "solid" | "steady" | "flop";
const VERDICT_LABEL: Record<Verdict, string> = { hit: "Hit", solid: "Solid", steady: "Steady", flop: "Flop" };
const VERDICT_TONE: Record<Verdict, "positive" | "accent" | "negative"> = {
  hit: "positive", solid: "positive", steady: "accent", flop: "negative",
};
/** Verdict for a launched product — stored if present, else derived from the launch score. */
function verdictOf(lp: LaunchedProduct): Verdict {
  if (lp.verdict) return lp.verdict as Verdict;
  return lp.launchScore >= 76 ? "hit" : lp.launchScore <= 22 ? "flop" : lp.launchScore >= 45 ? "solid" : "steady";
}

// Title-Case stat labels, single-sourced from the glossary (was a local duplicate that drifted).
const STAT_LABEL: Record<keyof Stats, string> = {
  performance: STAT_INFO.performance.label,
  quality: STAT_INFO.quality.label,
  battery: STAT_INFO.battery.label,
  design: STAT_INFO.design.label,
  ecosystem: STAT_INFO.ecosystem.label,
};

function changePct(history: number[]): number {
  if (history.length < 2) return 0;
  const a = history[history.length - 2];
  const b = history[history.length - 1];
  return a > 0 ? ((b - a) / a) * 100 : 0;
}

export function Market({ onDesignSuccessor, onOpenDesignLab, focusProductId, onFocusConsumed }: {
  onDesignSuccessor?: (p: Product) => void;
  onOpenDesignLab?: () => void;
  /** Transient deep-link from the launch reveal's "See the full breakdown" — opens this product's
   *  post-mortem sheet on mount, then is consumed (same hand-off pattern as the successor seed). */
  focusProductId?: string | null;
  onFocusConsumed?: () => void;
} = {}) {
  const { state, unlockRegion } = useGame();
  const trends = state.trends;
  const comps = state.competitors;
  // Only show releases from rivals still on the board — an acquired rival's historical releases would
  // otherwise be clickable but open an empty profile (the competitor is gone).
  const activeRivalIds = new Set(comps.map((c) => c.id));
  const visibleRivalReleases = state.rivalReleases.filter((r) => activeRivalIds.has(r.rivalId));
  const feedItems = [...state.feed].slice(-12).reverse();
  const maxTrend = Math.max(...STAT_KEYS.map((k) => Math.max(trends.weights[k], trends.targetWeights[k])));
  const [trade, setTrade] = useState<CompetitorState | null>(null);
  const [ipo, setIpo] = useState(false);
  const [sellStake, setSellStake] = useState(false);
  const sortedProducts = [...state.launched].sort((a, b) => {
    const aLive = a.weeksElapsed < a.weeklyUnits.length ? 1 : 0;
    const bLive = b.weeksElapsed < b.weeklyUnits.length ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return b.revenueToDate - a.revenueToDate;
  });
  const expiredHits = sortedProducts.filter(
    (lp) => lp.weeksElapsed >= lp.weeklyUnits.length && (lp.verdict === "hit" || lp.verdict === "solid"),
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  // Deep-link hand-off from the launch reveal: open the named product's post-mortem once, consume.
  useEffect(() => {
    if (!focusProductId) return;
    if (state.launched.some((l) => l.product.id === focusProductId)) setDetailId(focusProductId);
    onFocusConsumed?.();
    // Consume-once on mount/prop-change; state.launched is read fresh at that moment by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProductId]);
  const [feedOpen, setFeedOpen] = useState(false);
  const [rivalProfile, setRivalProfile] = useState<string | null>(null);
  // Market is a lot of ground — split it into three destinations instead of one long scroll:
  // Standing (you vs. the field), Products (your catalogue) and Demand (the market itself).
  const [mktTab, setMktTab] = useState<"standing" | "products" | "demand">("standing");
  const detail = state.launched.find((l) => l.product.id === detailId) ?? null;

  // Progressive disclosure: the Stock Exchange is a side activity with no scaffolding for a
  // brand-new player. Introduce it once the player has shipped their first product (or already
  // holds shares, or is a returning prestige founder) so week-one isn't a wall of tradeable rivals.
  const hasShipped = state.launched.length >= 1 || state.legacy > 0;
  const hasHoldings = Object.values(state.holdings).some((v) => (v ?? 0) > 0);
  const showStocks = hasShipped || hasHoldings;

  const valuation = companyValuation(state);
  const stake = founderStakeValue(state);
  const net = netWorth(state);
  const wkFlow = sub(nextWeekRevenue(state), burn(state));
  const wkFlowD = toDollars(wkFlow);
  const listable = canList(state);

  // Market opportunity synthesis
  const hotStat = STAT_KEYS.reduce((best, k) => {
    const delta = trends.targetWeights[k] - trends.weights[k];
    const bestDelta = trends.targetWeights[best] - trends.weights[best];
    return delta > bestDelta ? k : best;
  }, STAT_KEYS[0]);
  const hotStatDelta = trends.targetWeights[hotStat] - trends.weights[hotStat];
  const unlockedCats = CATEGORY_LIST.filter((c) => c.unlockEra <= state.era && c.unlockEra > 0);
  const weakestCat = unlockedCats.length > 0
    ? unlockedCats.reduce((best, cat) => {
        const bestStr = comps.reduce((s, c) => s + ((c.strengthByCategory as Record<string, number>)[best.id] ?? 0), 0);
        const catStr = comps.reduce((s, c) => s + ((c.strengthByCategory as Record<string, number>)[cat.id] ?? 0), 0);
        return catStr < bestStr ? cat : best;
      })
    : null;

  // Active products where a rival is clearly stronger in their category
  const pressuredProducts = state.launched
    .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
    .filter((lp) => {
      const bestRival = comps.reduce(
        (m, c) => Math.max(m, ((c.strengthByCategory as Record<string, number>)[lp.product.category] ?? 0)),
        0,
      );
      return bestRival > overallScore(lp.stats, lp.product.category) + 5;
    });

  return (
    <div className="mkt">
      {/* Net worth banner */}
      <Card className="mkt__networth">
        <div className="mkt__nw-main">
          <span className="mkt__nw-label">Net worth</span>
          <AnimatedMoney value={net} className="mkt__nw-value rounded" />
        </div>
        <div className="mkt__nw-row">
          <StatPill label="Cash" value={format(state.cash)} />
          <StatPill label="Fans" value={state.fans >= 1000 ? `${(state.fans / 1000).toFixed(1)}k` : String(state.fans)} tone={state.fans >= 500 ? "positive" : "neutral"} />
          <StatPill label="Reputation" value={Math.round(state.reputation)} tone={state.reputation >= 50 ? "positive" : "neutral"} />
          <StatPill label="Weekly" value={`${wkFlowD >= 0 ? "+" : ""}${format(wkFlow)}`} tone={wkFlowD >= 0 ? "positive" : "negative"} />
        </div>
      </Card>

      {/* Sub-navigation — Standing (you vs. the field) · Products (your catalogue) · Demand (the market). */}
      <div className="mkt__subnav" role="tablist" aria-label="Market sections">
        {([["standing", "Standing"], ["products", "Products"], ["demand", "Demand"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={mktTab === id}
            className={`mkt__subtab${mktTab === id ? " mkt__subtab--on" : ""}`}
            onClick={() => { haptic.light(); setMktTab(id); }}
          >
            {label}
          </button>
        ))}
      </div>

      {mktTab === "standing" && (<>
      {/* Your company (equity) */}
      <Card className="mkt__co">
        <SectionHeader title={state.companyName} accessory={state.listed ? "publicly traded" : "private"} />
        {(state.valuationHistory?.length ?? 0) >= 2 && (() => {
          const hist = state.valuationHistory!;
          const ch = changePct(hist);
          return (
            <div className="mkt__co-spark">
              <Sparkline data={hist} stroke={ch >= 0 ? "var(--positive)" : "var(--negative)"} height={38} />
              <span className={`mkt__co-change mkt__co-change--${ch >= 0 ? "up" : "down"}`}>
                {ch >= 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />} {Math.abs(ch).toFixed(1)}%
              </span>
            </div>
          );
        })()}
        <div className="mkt__co-grid">
          <Stat label="Valuation" value={format(valuation)} />
          <Stat label="You own" value={`${Math.round(state.ownership * 100)}%`} />
          <Stat label="Your stake" value={format(stake)} tone="positive" />
        </div>
        {!state.listed ? (
          listable ? (
            <Button block onClick={() => { setIpo(true); haptic.light(); }}>
              <Building2 size={16} /> List on the stock exchange
            </Button>
          ) : (() => {
            // Item 19: turn the IPO threshold into a motivating progress bar — a visible
            // long-term goal to climb toward, not just a line of text.
            const haveD = Math.max(0, toDollars(state.cumulativeRevenue));
            const needD = Math.max(1, toDollars(BALANCE.ipo.minRevenueToList));
            const pct = Math.min(100, Math.round((haveD / needD) * 100));
            return (
              <div className="mkt__ipo">
                <div className="mkt__ipo-head">
                  <span className="mkt__ipo-label">Road to the stock exchange</span>
                  <span className="mkt__ipo-pct tnum">{pct}%</span>
                </div>
                <div className="mkt__ipo-track"><div className="mkt__ipo-fill" style={{ width: `${pct}%` }} /></div>
                <p className="mkt__co-hint">
                  Unlocks at {format(BALANCE.ipo.minRevenueToList)} lifetime revenue. You're at {format(state.cumulativeRevenue)}.
                </p>
              </div>
            );
          })()
        ) : state.ownership < 0.06 ? (
          <p className="mkt__co-hint">Selling more would cut below your 5% founder minimum, so there are no more shares to sell.</p>
        ) : (
          <Button block variant="secondary" onClick={() => { setSellStake(true); haptic.light(); }}>
            Sell more shares
          </Button>
        )}
      </Card>

      {/* Industry leaderboard — the climb from a garage to the #1 company in the industry */}
      {(() => {
        const board = industryLeaderboard(state);
        const myRank = industryRank(state);
        const me = board.find((e) => e.isPlayer)!;
        const above = myRank > 1 ? board[myRank - 2] : null;
        const gap = above ? sub(above.valuation, me.valuation) : null;
        return (
          <Card className="mkt__board">
            <SectionHeader title="Industry leaderboard" accessory={`#${myRank} of ${board.length}`} />
            <div className="mkt__board-list">
              {board.map((e, i) => (
                <div key={e.id} className={`mkt__board-row${e.isPlayer ? " mkt__board-row--me" : ""}`}>
                  <span className={`mkt__board-rank${i === 0 ? " mkt__board-rank--first" : ""}`}>{i === 0 ? <Crown size={13} aria-hidden /> : i + 1}</span>
                  <span className="mkt__board-name">{e.name}{e.isPlayer ? " · you" : ""}</span>
                  <span className="mkt__board-val tnum">{format(e.valuation)}</span>
                </div>
              ))}
            </div>
            {above && gap ? (
              <p className="mkt__board-nudge">
                <TrendingUp size={12} aria-hidden /> {format(gap)} to overtake <strong>{above.name}</strong> for #{myRank - 1}.
              </p>
            ) : myRank === 1 ? (
              <p className="mkt__board-nudge mkt__board-nudge--top">
                <Sparkles size={12} aria-hidden /> You're the #1 company in the industry.
              </p>
            ) : null}
          </Card>
        );
      })()}

      </>)}

      {mktTab === "demand" && (<>
      {/* Global expansion, open new markets to grow your addressable demand (engine/regions.ts) */}
      <Card className="mkt__regions">
        <SectionHeader title="Global markets" accessory={`${state.unlockedRegions.length} of ${REGIONS.length} open`} />
        <p className="mkt__regions-lead">Expand beyond your home market. Each region adds demand, but its buyers value different things, so design with your markets in mind.</p>
        <div className="mkt__region-list">
          {(() => {
            // Where this week's sales are coming from: each active product's weekly revenue,
            // apportioned across its shipped regions by share × taste fit (the same weights that
            // sized its launch). Keeps the card alive once every region is unlocked — an open
            // region shows its contribution instead of a static "Open" tag.
            const regionRev = new Map<string, number>();
            for (const lp of state.launched) {
              if (lp.weeksElapsed >= lp.weeklyUnits.length) continue;
              const wkRev = lp.weeklyUnits[lp.weeksElapsed] * toDollars(lp.product.price);
              if (wkRev <= 0) continue;
              const stats = productStats(state, lp.product);
              const parts = shippableRegions(state.unlockedRegions, lp.product.regions)
                .map((id) => { const r = regionById(id)!; return { id, w: r.share * regionTasteFit(stats, r) }; });
              const total = parts.reduce((a, p) => a + p.w, 0) || 1;
              for (const p of parts) regionRev.set(p.id, (regionRev.get(p.id) ?? 0) + (wkRev * p.w) / total);
            }
            return REGIONS.map((r) => {
              const open = state.unlockedRegions.includes(r.id);
              const afford = state.cash >= r.unlockCost;
              const rev = regionRev.get(r.id) ?? 0;
              return (
                <div key={r.id} className={`mkt__region${open ? " mkt__region--open" : ""}`}>
                  <span className="mkt__region-icon">{open ? <Globe size={16} /> : <Lock size={15} />}</span>
                  <div className="mkt__region-text">
                    <span className="mkt__region-name">{r.name}</span>
                    <span className="mkt__region-blurb">{r.blurb}</span>
                  </div>
                  {open ? (
                    rev >= 1 ? (
                      <span className="mkt__region-tag mkt__region-tag--rev tnum">≈{formatShortDollars(rev)}/wk</span>
                    ) : (
                      <span className="mkt__region-tag">{r.id === "home" ? "Home" : "Open"}</span>
                    )
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={!afford}
                      haptics="none"
                      onClick={() => {
                        unlockRegion(r.id);
                        // Opening an entire market is a milestone, not a silent debit.
                        haptic.success();
                        sfx("upgrade");
                        showToast(`${r.name} is open — new demand for every launch`, { tone: "positive", glyph: <Globe size={15} /> });
                      }}
                    >
                      <Globe size={14} aria-hidden /> Unlock · {format(r.unlockCost)}
                    </Button>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* Rival releases, the real products rivals have shipped (Epic B): see and learn from them */}
      {visibleRivalReleases.length > 0 && (
        <Card>
          <SectionHeader title="Rival releases" accessory={`${Math.min(6, visibleRivalReleases.length)} recent`} />
          <div className="mkt__rivals">
            {visibleRivalReleases.slice(0, 6).map((r, i) => (
              <button
                key={`${r.product.id}-${i}`}
                className="mkt__rival mkt__rival--btn"
                onClick={() => { setRivalProfile(r.rivalId); haptic.light(); }}
                aria-label={`View ${r.rivalName} company profile`}
              >
                <span className="mkt__rival-thumb"><DeviceRenderer product={r.product} size={44} /></span>
                <span className="mkt__rival-info">
                  <span className="mkt__rival-name">{r.product.name}</span>
                  <span className="mkt__rival-sub">
                    <CategoryIcon id={r.category} size={12} /> {CATEGORY_LABEL[r.category] ?? r.category} · wk {r.week}
                  </span>
                </span>
                <span className="mkt__rival-meta">
                  <span className="mkt__rival-price tnum">{format(r.product.price)}</span>
                  <span className={`mkt__rival-tone mkt__rival-tone--${r.contested ? "undercut" : r.tone}`}>
                    {r.contested ? "undercut" : r.tone}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      </>)}

      {mktTab === "products" && (<>
      {/* Your launched products, tap one to see why it performed + design a successor */}
      <Card>
        <SectionHeader title="Your products" accessory={state.launched.length > 0 ? `${state.launched.length} launched` : undefined} />
        {state.launched.length === 0 ? (
          <EmptyState
            glyph={<Package size={36} strokeWidth={1.6} />}
            title="Nothing launched yet"
            sub="Design a product, build it, and launch it to see how the market responds."
            action={onOpenDesignLab && <Button variant="secondary" onClick={onOpenDesignLab}>Open Design Lab</Button>}
          />
        ) : (
          <>
            <div className="mkt__products">
              {sortedProducts.map((lp) => {
                const v = verdictOf(lp);
                const live = lp.weeksElapsed < lp.weeklyUnits.length;
                const endingSoon = live && (lp.weeklyUnits.length - lp.weeksElapsed) <= 3;
                return (
                  <button
                    key={lp.product.id}
                    className={`mkt__product${live ? " mkt__product--live" : ""}`}
                    onClick={() => { setDetailId(lp.product.id); haptic.light(); }}
                    aria-label={`View ${lp.product.name} performance${live ? ", still selling" : ""}`}
                  >
                    <span className="mkt__product-row">
                      <span className="mkt__product-thumb">
                        <DeviceRenderer product={lp.product} size={44} />
                        {live && <span className="mkt__product-livedot" aria-hidden />}
                      </span>
                      <span className="mkt__product-info">
                        <span className="mkt__product-name">{lp.product.name}</span>
                        <span className="mkt__product-sub">
                          <CategoryIcon id={lp.product.category} size={12} />
                          {live
                            ? <>{format(cents(lp.weeklyUnits[lp.weeksElapsed] * lp.product.price))}<span className="mkt__product-period">/wk</span> · {format(lp.revenueToDate)} total</>
                            : <>{lp.unitsSold.toLocaleString()} sold · {format(lp.revenueToDate)}</>
                          }
                        </span>
                      </span>
                      <span className="mkt__product-end">
                        <StatPill value={VERDICT_LABEL[v]} tone={VERDICT_TONE[v]} />
                        {live && (() => {
                          const bestRival = comps.reduce(
                            (m, c) => Math.max(m, ((c.strengthByCategory as Record<string, number>)[lp.product.category] ?? 0)),
                            0,
                          );
                          if (bestRival < 15) return null;
                          const score = overallScore(lp.stats, lp.product.category);
                          if (bestRival > score + 5) return <span className="mkt__product-rival mkt__product-rival--threat">rival ahead</span>;
                          if (bestRival >= score - 10) return <span className="mkt__product-rival mkt__product-rival--match">≈ rival</span>;
                          return null;
                        })()}
                        {live && !endingSoon && (() => {
                          const peakWk = BALANCE.sales.peakWeek;
                          if (lp.weeksElapsed < peakWk) return <span className="mkt__product-stage mkt__product-stage--ramp">rising</span>;
                          if (lp.weeksElapsed === peakWk) return <span className="mkt__product-stage mkt__product-stage--peak">peak</span>;
                          return <span className="mkt__product-stage mkt__product-stage--decline">fading</span>;
                        })()}
                        {endingSoon && <span className="mkt__product-ending">last {lp.weeklyUnits.length - lp.weeksElapsed}wk</span>}
                        {!live && lp.plannedUnits && lp.plannedUnits > 0 && (
                          <span className={`mkt__product-thru tnum${Math.round((lp.unitsSold / lp.plannedUnits) * 100) >= 90 ? " mkt__product-thru--full" : ""}`}>
                            {Math.min(100, Math.round((lp.unitsSold / lp.plannedUnits) * 100))}% sold
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} className="mkt__product-chev" aria-hidden />
                    </span>
                    {live && lp.weeklyUnits.length > 0 && (
                      <span className="mkt__product-lc" aria-hidden>
                        <SalesCurveChart weekly={lp.weeklyUnits} elapsed={lp.weeksElapsed} height={16} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {expiredHits.length > 0 && onDesignSuccessor && (
              <div className="mkt__successor-nudge">
                <span className="mkt__successor-text">
                  {expiredHits.length === 1
                    ? `${expiredHits[0].product.name} has run its course, time for a follow-up.`
                    : `${expiredHits.length} products have run their cycle, design successors to keep revenue flowing.`}
                </span>
                <Button size="sm" variant="secondary" onClick={() => { onDesignSuccessor(expiredHits[0].product); haptic.light(); }}>
                  <Wand2 size={13} /> Design a successor
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Your franchises, product lines grouped by brand equity (the IP lens over your catalog) */}
      <FranchisesCard launched={state.launched} />

      {/* Portfolio revenue breakdown by category */}
      {(() => {
        type CatData = { rev: number; count: number };
        const byCat = new Map<string, CatData>();
        for (const lp of state.launched) {
          const e = byCat.get(lp.product.category);
          if (e) { e.rev += lp.revenueToDate; e.count += 1; }
          else byCat.set(lp.product.category, { rev: lp.revenueToDate, count: 1 });
        }
        if (byCat.size < 2) return null;
        const sorted = [...byCat.entries()].sort((a, b) => b[1].rev - a[1].rev);
        const totalRev = sorted.reduce((s, [, e]) => s + e.rev, 0);
        if (totalRev <= 0) return null;
        const peakRev = sorted[0][1].rev;
        return (
          <Card>
            <SectionHeader title="Revenue by category" accessory={`${sorted.length} segments`} />
            <div className="mkt__portfolio">
              {sorted.map(([cat, { rev, count }]) => {
                const share = Math.round((rev / totalRev) * 100);
                const barW = Math.round((rev / peakRev) * 100);
                return (
                  <div key={cat} className="mkt__portfolio-row">
                    <span className="mkt__portfolio-cat">
                      <CategoryIcon id={cat as CategoryId} size={11} />
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                    <div className="mkt__portfolio-track">
                      <div className="mkt__portfolio-fill" style={{ width: `${barW}%` }} />
                    </div>
                    <span className="mkt__portfolio-rev tnum">{format(cents(rev))}</span>
                    <span className="mkt__portfolio-share tnum">{share}%</span>
                    <span className="mkt__portfolio-cnt tnum">{count}×</span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      </>)}

      {mktTab === "standing" && (<>
      {/* Stock exchange, gated behind the first ship (see `showStocks`). */}
      {showStocks && <SectionHeader title="Stock exchange" accessory="trade rival shares" />}
      {showStocks && Object.values(state.holdings).some((v) => (v ?? 0) > 0) && (() => {
        const portfolioVal = holdingsValue(state.holdings, comps);
        const divPerWk = weeklyDividends(state.holdings, comps);
        return (
          <div className="mkt__portfolio-summary">
            <span className="mkt__portfolio-summary-label">Portfolio value</span>
            <span className="mkt__portfolio-summary-val tnum">{format(portfolioVal)}</span>
            {toDollars(divPerWk) >= 1 && (
              <span className="mkt__portfolio-summary-div">+{format(divPerWk)}/wk</span>
            )}
          </div>
        );
      })()}
      {showStocks && comps.map((c) => {
        const ch = changePct(c.priceHistory);
        const owned = state.holdings[c.id] ?? 0;
        const def = rivalDef(c.id);
        const activeCats = Object.entries(c.strengthByCategory)
          .filter(([, s]) => (s as number) > 20)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([cat]) => cat as CategoryId);
        // Show preferred categories as "home turf" tags when the rival isn't currently active.
        const homeTurf: CategoryId[] = activeCats.length === 0 && def
          ? (def.preferredCategories as CategoryId[]).slice(0, 2)
          : [];
        // Highlight if a preferred category overlaps with player's active products.
        const playerActiveCats = new Set(
          state.launched
            .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
            .map((lp) => lp.product.category),
        );
        const threatCats = activeCats.filter((cat) => playerActiveCats.has(cat));
        return (
          <Card key={c.id} className="mkt__stock">
            <button className="mkt__stock-btn" onClick={() => { setTrade(c); haptic.light(); }} aria-label={`Trade ${c.name}`}>
              <div className="mkt__stock-head">
                <div className="mkt__stock-id">
                  <span className="mkt__stock-name">{c.name}</span>
                  <span className="mkt__stock-blurb">{c.blurb}</span>
                </div>
                <div className="mkt__stock-price">
                  <span className="tnum">{format(cents(c.sharePrice))}</span>
                  <span className={`mkt__stock-chg ${ch >= 0 ? "up" : "down"} tnum`}>
                    {ch >= 0 ? <TrendingUp size={12} aria-hidden /> : <TrendingDown size={12} aria-hidden />} {Math.abs(ch).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mkt__stock-foot">
                <div className="mkt__stock-spark"><Sparkline data={c.priceHistory} stroke={ch >= 0 ? "var(--positive)" : "var(--negative)"} /></div>
                {owned > 0 && <span className="mkt__stock-owned">{owned} sh · {format(cents(owned * c.sharePrice))}</span>}
              </div>
              {(activeCats.length > 0 || homeTurf.length > 0) && (
                <div className="mkt__stock-cats">
                  {activeCats.map((cat) => (
                    <span key={cat} className={`mkt__stock-cat${threatCats.includes(cat) ? " mkt__stock-cat--threat" : ""}`}>
                      <CategoryIcon id={cat} size={10} />{CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  ))}
                  {homeTurf.map((cat) => (
                    <span key={cat} className="mkt__stock-cat mkt__stock-cat--home">
                      <CategoryIcon id={cat} size={10} />{CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  ))}
                </div>
              )}
              {(() => {
                const wks = c.nextLaunchWeek - state.week;
                if (wks < 0 || wks > 5) return null;
                return (
                  <div className="mkt__stock-upcoming">
                    <Rocket size={9} aria-hidden />
                    {wks === 0 ? "Launching this week" : `Launching in ${wks} wk`}
                  </div>
                );
              })()}
            </button>
          </Card>
        );
      })}

      {/* Competition landscape — your position vs. rivals by category */}
      {unlockedCats.length > 1 && (
        <Card>
          <SectionHeader title="Market position" accessory="you vs. rivals" />
          {(() => {
            const activeCats = new Set(
              state.launched
                .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
                .map((lp) => lp.product.category),
            );
            const MAX_SCORE = 100;
            return (
              <div className="mkt__compmap">
                <div className="mkt__compmap-legend">
                  <span><span className="mkt__compmap-legend-swatch mkt__compmap-legend-swatch--you" /> You</span>
                  <span><span className="mkt__compmap-legend-swatch mkt__compmap-legend-swatch--rival" /> Best rival</span>
                </div>
                {unlockedCats.map((cat) => {
                  const maxRivalStr = comps.reduce(
                    (m, c) => Math.max(m, ((c.strengthByCategory as Record<string, number>)[cat.id] ?? 0)), 0,
                  );
                  const activeRivals = comps.filter(
                    (c) => ((c.strengthByCategory as Record<string, number>)[cat.id] ?? 0) > 5,
                  ).length;
                  const bestYours = state.launched
                    .filter((lp) => lp.product.category === cat.id)
                    .reduce<number>((m, lp) => Math.max(m, overallScore(lp.stats, cat.id)), 0);
                  const youPct = Math.round((bestYours / MAX_SCORE) * 100);
                  const rivalPct = Math.round((maxRivalStr / MAX_SCORE) * 100);
                  const youHere = activeCats.has(cat.id);
                  const youWinning = bestYours > 0 && bestYours >= maxRivalStr;
                  const statusLabel = bestYours === 0 ? (activeRivals === 0 ? "Open" : `${activeRivals} rival${activeRivals > 1 ? "s" : ""}`) : youWinning ? "Leading" : "Trailing";
                  const statusTone = bestYours === 0 ? (activeRivals === 0 ? "positive" : "accent") : youWinning ? "positive" : "negative";
                  return (
                    <div key={cat.id} className="mkt__compmap-row">
                      <span className="mkt__compmap-cat">
                        <span className={`mkt__compmap-dot${youHere ? " mkt__compmap-dot--on" : ""}`} aria-hidden />
                        <CategoryIcon id={cat.id} size={11} />{cat.displayName}
                      </span>
                      <div className="mkt__compmap-bars">
                        <div className="mkt__compmap-barrow">
                          <div className="mkt__compmap-track">
                            {rivalPct > 0 && <div className="mkt__compmap-fill mkt__compmap-fill--rival" style={{ width: `${rivalPct}%` }} />}
                            {youPct > 0 && <div className="mkt__compmap-fill mkt__compmap-fill--you" style={{ width: `${youPct}%` }} />}
                          </div>
                        </div>
                      </div>
                      <span className={`mkt__compmap-label mkt__compmap-label--${statusTone}`}>{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <p className="mkt__compmap-hint">● = you have a product selling there · score out of 100.</p>
        </Card>
      )}

      </>)}

      {mktTab === "demand" && (<>
      {/* Trends */}
      <Card>
        <SectionHeader title="What buyers want" accessory={eraName(state.era)} />
        <div className="mkt__trends">
          {STAT_KEYS.map((k) => {
            const cur = trends.weights[k];
            const target = trends.targetWeights[k];
            const curPct = maxTrend > 0 ? Math.round((cur / maxTrend) * 100) : 0;
            const targetPct = maxTrend > 0 ? Math.round((target / maxTrend) * 100) : 0;
            const delta = target - cur;
            const rising = delta > 0.008;
            const falling = delta < -0.008;
            return (
              <div key={k} className="mkt__trend">
                <span className="mkt__trend-label">
                  {STAT_LABEL[k]}
                  {rising && <TrendingUp size={11} className="mkt__trend-arrow mkt__trend-arrow--up" aria-label="rising" />}
                  {falling && <TrendingDown size={11} className="mkt__trend-arrow mkt__trend-arrow--down" aria-label="falling" />}
                </span>
                <div className="mkt__trend-bar">
                  {/* ghost = target weight (where market is heading) */}
                  <div className="mkt__trend-fill mkt__trend-fill--target" style={{ width: `${targetPct}%` }} />
                  {/* solid = current weight (what affects launch scores today) */}
                  <div className="mkt__trend-fill" style={{ width: `${curPct}%` }} />
                </div>
                <span className="mkt__trend-val tnum">{Math.round(cur * 100)}</span>
              </div>
            );
          })}
        </div>
        {(() => {
          const wks = state.trendRetargetWeek - state.week;
          if (wks > 8 || wks < 0) return null;
          return (
            <div className="mkt__trend-footer">
              <Clock size={11} />
              <span>Consumer preference shifts in <strong>{wks} week{wks !== 1 ? "s" : ""}</strong>, so products launched now ride the current demand curve.</span>
            </div>
          );
        })()}
      </Card>

      {/* Market opportunity */}
      {(() => {
        const upcomingLaunches = comps.filter((c) => {
          const wks = c.nextLaunchWeek - state.week;
          return wks >= 0 && wks <= 3;
        }).sort((a, b) => (a.nextLaunchWeek - state.week) - (b.nextLaunchWeek - state.week));
        const showIntel = hotStatDelta > 0.005 || weakestCat != null || pressuredProducts.length > 0 || upcomingLaunches.length > 0;
        if (!showIntel) return null;
        return (
        <Card className="mkt__intel">
          <SectionHeader title="Market opportunity" accessory="based on current data" />
          <div className="mkt__intel-list">
            {upcomingLaunches.length > 0 && (() => {
              const c = upcomingLaunches[0];
              const wks = c.nextLaunchWeek - state.week;
              return (
                <div className="mkt__intel-row">
                  <Clock size={14} className="mkt__intel-icon mkt__intel-icon--warn" />
                  <span className="mkt__intel-text">
                    <strong>{c.name}</strong> launches in <strong>{wks}</strong> week{wks !== 1 ? "s" : ""}, so launch first to capture demand before their arrival.
                  </span>
                </div>
              );
            })()}
            {hotStatDelta > 0.005 && (
              <div className="mkt__intel-row">
                <TrendingUp size={14} className="mkt__intel-icon mkt__intel-icon--up" />
                <span className="mkt__intel-text">
                  <strong>{STAT_LABEL[hotStat]}</strong> demand is rising, so lead with it in your next product.
                </span>
              </div>
            )}
            {weakestCat != null && (
              <div className="mkt__intel-row">
                <Target size={14} className="mkt__intel-icon mkt__intel-icon--opp" aria-hidden />
                <span className="mkt__intel-text">
                  <strong>{weakestCat.displayName}</strong> has the least rival competition right now.
                </span>
              </div>
            )}
            {pressuredProducts.length > 0 && (
              <div className="mkt__intel-row">
                <TrendingDown size={14} className="mkt__intel-icon mkt__intel-icon--down" />
                <span className="mkt__intel-text">
                  <strong>{pressuredProducts[0].product.name}</strong> is under pressure in{" "}
                  {CATEGORY_LABEL[pressuredProducts[0].product.category]}, rivals are outspeccing it. Plan a successor with higher-tier components.
                </span>
              </div>
            )}
            {state.reputation >= 65 && (
              <div className="mkt__intel-row">
                <Star size={14} fill="currentColor" className="mkt__intel-icon mkt__intel-icon--rep" aria-hidden />
                <span className="mkt__intel-text">
                  Your reputation ({Math.round(state.reputation)}) supports premium pricing on your next launch.
                </span>
              </div>
            )}
          </div>
        </Card>
        );
      })()}

      </>)}

      {mktTab === "standing" && (<>
      {/* Activity feed */}
      <Card>
        <SectionHeader
          title="Activity"
          accessory={
            state.feed.length > 12 ? (
              <button className="mkt__feed-all" onClick={() => setFeedOpen(true)}>
                View all {state.feed.length}
              </button>
            ) : "latest"
          }
        />
        {feedItems.length === 0 ? (
          <EmptyState
            glyph={<Newspaper size={36} strokeWidth={1.6} />}
            title={state.launched.length > 0 ? "Activity will appear soon" : "No activity yet"}
            sub={state.launched.length > 0
              ? "Market events and product milestones appear here as the weeks advance."
              : "Launch your first product to start seeing market headlines."}
            action={state.launched.length === 0 && onOpenDesignLab
              ? <Button variant="secondary" onClick={onOpenDesignLab}>Open Design Lab</Button>
              : undefined}
          />
        ) : (
          <ul className="mkt__feed">
            {feedItems.map((f) => {
              const Icon: LucideIcon = f.tone === "positive" ? TrendingUp : f.tone === "negative" ? TrendingDown : f.tone === "accent" ? Sparkles : Newspaper;
              return (
                <li key={f.id} className={`mkt__feed-item mkt__feed-item--${f.tone}`}>
                  <span className="mkt__feed-icon" aria-hidden><Icon size={11} strokeWidth={2.5} /></span>
                  <span className="mkt__feed-week">wk {f.week}</span>
                  {f.text}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      </>)}

      <Sheet open={!!detail} onClose={() => setDetailId(null)} label="Product detail">
        {detail && (
          <ProductDetailSheet
            lp={detail}
            onClose={() => setDetailId(null)}
            onDesignSuccessor={onDesignSuccessor ? (p) => { setDetailId(null); onDesignSuccessor(p); } : undefined}
          />
        )}
      </Sheet>

      <Sheet open={!!trade} onClose={() => setTrade(null)} label="Trade rival shares">
        {trade && <TradeSheet comp={comps.find((c) => c.id === trade.id) ?? trade} onClose={() => setTrade(null)} />}
      </Sheet>
      <Sheet open={!!rivalProfile} onClose={() => setRivalProfile(null)} label="Rival profile">
        {rivalProfile && (() => {
          const comp = comps.find((c) => c.id === rivalProfile);
          return comp ? (
            <RivalProfileSheet
              comp={comp}
              releases={state.rivalReleases.filter((r) => r.rivalId === rivalProfile)}
              onTrade={() => { setRivalProfile(null); setTrade(comp); }}
              onClose={() => setRivalProfile(null)}
            />
          ) : null;
        })()}
      </Sheet>
      <Sheet open={ipo} onClose={() => setIpo(false)} label="Go public">
        {ipo && <IPOSheet onClose={() => setIpo(false)} />}
      </Sheet>
      <Sheet open={sellStake} onClose={() => setSellStake(false)} label="Sell your stake">
        {sellStake && <SellStakeSheet onClose={() => setSellStake(false)} />}
      </Sheet>
      <Sheet open={feedOpen} onClose={() => setFeedOpen(false)} label="Market feed">
        <FeedSheet feed={state.feed} onClose={() => setFeedOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ---------- Post-launch product detail ---------- */

type DriverTone = "positive" | "accent" | "negative" | "neutral";
interface Driver {
  key: FactorKey;
  label: string;
  value: string;
  detail: string;
  tone: DriverTone;
}

/** Build the "why it performed" drivers in plain language. Prefers the launch-moment snapshot
 *  (insight) recorded on the product; falls back to a qualitative read from the launch score for
 *  saves written before insight existed — never fabricating numbers we don't have. */
function performanceDrivers(lp: LaunchedProduct): Driver[] {
  const ins = lp.insight;
  const drivers: Driver[] = [];

  // 1) Demand fit — how well the stats matched what consumers wanted at launch.
  if (ins) {
    const f = Math.round(ins.demandFit);
    drivers.push({
      key: "demand",
      label: "Demand fit",
      value: `${f}/100`,
      detail: f >= 60 ? "Closely matched what the market wanted." : f >= 35 ? "A decent match for the trend." : "Out of step with what buyers wanted.",
      tone: f >= 60 ? "positive" : f >= 35 ? "accent" : "negative",
    });
  } else {
    const hi = lp.launchScore >= 76;
    const lo = lp.launchScore <= 22;
    drivers.push({
      key: "demand",
      label: "Demand fit",
      value: hi ? "Strong" : lo ? "Weak" : "Fair",
      detail: hi ? "Read the market well at launch." : lo ? "Mistimed the market." : "An average read on the trend.",
      tone: hi ? "positive" : lo ? "negative" : "accent",
    });
  }

  // 1b) Audience — which buyer segment this product won and which it lost (Epic A). Additive:
  // skipped for saves written before segments existed (no dominantSegment recorded).
  if (ins?.dominantSegment && ins.perSegment && ins.perSegment.length) {
    const top = ins.perSegment.find((s) => s.id === ins.dominantSegment) ?? ins.perSegment[0];
    const low = ins.perSegment.find((s) => s.id === ins.weakestSegment) ?? ins.perSegment[ins.perSegment.length - 1];
    const lowReason = low.priceFit < 0.6 ? "priced out" : low.fit < 35 ? "specs missed" : "niche appeal";
    drivers.push({
      key: "audience",
      label: "Audience",
      value: top.name,
      detail: `Strongest with ${top.name} buyers; weakest with ${low.name} (${lowReason}).`,
      tone: "accent",
    });
  }

  // 2) Price positioning — value buy vs. on-the-money vs. overpriced.
  if (ins) {
    const pf = ins.priceFit;
    const over = pf < 0.8;
    const under = pf > 1.12;
    drivers.push({
      key: "price",
      label: "Price",
      value: over ? "Overpriced" : under ? "Value buy" : "On the money",
      detail: over ? "Buyers felt it cost too much for the spec." : under ? "Priced below its perceived value, which drove volume." : "Priced fairly for what it delivered.",
      tone: over ? "negative" : under ? "positive" : "accent",
    });
  }

  // 3) Competition pressure — rivals splitting or beating the market.
  if (ins) {
    const beats = ins.betterRivals;
    const matches = ins.matchingRivals;
    const kept = Math.round(ins.competitionFactor * 100);
    drivers.push({
      key: "competition",
      label: "Competition",
      value: beats > 0 ? `${beats} ahead` : matches > 0 ? `${matches} matched` : "Clear field",
      detail: beats > 0
        ? `Rivals outclassed you; you kept ~${kept}% of demand.`
        : matches > 0
          ? `Rivals split the market; you kept ~${kept}% of demand.`
          : "No rival came close; you owned the category.",
      tone: beats > 0 ? "negative" : matches > 0 ? "accent" : "positive",
    });
  }

  // 4) Hype — reputation + marketing reach at launch.
  if (ins) {
    const h = ins.hype;
    const strong = h >= 1.6;
    const weak = h < 1.1;
    drivers.push({
      key: "hype",
      label: "Hype",
      value: strong ? "High" : weak ? "Low" : "Moderate",
      detail: strong ? "Reputation and marketing gave a big launch boost." : weak ? "Little buzz; few buyers knew it existed." : "A steady amount of launch buzz.",
      tone: strong ? "positive" : weak ? "negative" : "accent",
    });
  }

  return drivers;
}

/** Derive up to 3 actionable post-launch tips from the recorded launch insight. */
function generateTips(lp: LaunchedProduct): string[] {
  const ins = lp.insight;
  if (!ins) return [];
  const v = verdictOf(lp);
  const tips: string[] = [];
  if (ins.demandFit < 40) {
    tips.push("Poor trend match: check the Market tab before designing and build toward what consumers are currently demanding.");
  }
  if (ins.priceFit < 0.8) {
    tips.push("Buyers found this overpriced. Try the 'Suggest' button in the Design Lab to dial in a fairer price next time.");
  } else if (ins.priceFit > 1.12 && v !== "hit") {
    tips.push("Underpriced: the quality supported a higher price. Charging a bit more improves margins without hurting demand.");
  }
  if (ins.betterRivals >= 2) {
    tips.push("Multiple rivals outclassed this product: upgrade components to higher tiers and invest in R&D to unlock better tech.");
  } else if (ins.betterRivals === 1) {
    tips.push("One rival edged you out: a single component upgrade or a tighter price could swing the category your way.");
  }
  if (ins.hype < 1.05 && tips.length < 3) {
    tips.push("Very little launch buzz. Put a team member on Marketing for an ongoing hype boost, or run a paid campaign (Social, Search, or TV) to multiply demand at the next launch.");
  }
  if (tips.length === 0 && v === "hit") {
    tips.push("Strong launch: maintain momentum by designing a successor before this product finishes its run.");
  }
  return tips.slice(0, 3);
}

function ProductDetailSheet({
  lp,
  onClose,
  onDesignSuccessor,
}: {
  lp: LaunchedProduct;
  onClose: () => void;
  onDesignSuccessor?: (p: Product) => void;
}) {
  const { cutProductPrice, marketingPush } = useGame();
  const [priceCutOpen, setPriceCutOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  // Only phones & tablets are flat slabs with a real back face (camera module); for those, let the
  // player flip the hardware to inspect the rear.
  const canFlip = lp.product.category === "phone" || lp.product.category === "tablet";
  const [face, setFace] = useState<"front" | "back">("front");
  const v = verdictOf(lp);
  const drivers = performanceDrivers(lp);
  // C1 — rank the drivers by how DECISIVE each was and synthesize a headline (2–3 dominant factors,
  // not a fog). Only when the launch-moment insight was recorded; older saves keep the plain list.
  const pm = lp.insight ? postMortem(lp.insight, v) : null;
  const orderedDrivers = pm
    ? [...drivers].sort((a, b) => (pm.impacts[b.key]?.impact ?? 0) - (pm.impacts[a.key]?.impact ?? 0))
    : drivers;
  const tips = generateTips(lp);
  // Fictional tech-press reviews derived from the recorded launch metrics (pure, presentation
  // only — never affects the sim). Falls back to neutral drivers for pre-insight saves.
  const reviews = criticReviews({
    productId: lp.product.id,
    stats: lp.stats,
    verdict: v,
    demandFit: lp.insight?.demandFit ?? 60,
    priceFit: lp.insight?.priceFit ?? 1,
    betterRivals: lp.insight?.betterRivals ?? 0,
  });
  const reviewBand = reviews.aggregate >= 75 ? "high" : reviews.aggregate >= 55 ? "mid" : "low";
  const sellThrough = lp.plannedUnits && lp.plannedUnits > 0
    ? Math.min(100, Math.round((lp.unitsSold / lp.plannedUnits) * 100))
    : null;
  const live = lp.weeksElapsed < lp.weeklyUnits.length;
  // Suggest cutting to ~85% of current price (or to unit cost if higher)
  const suggestedCut = dollars(Math.max(toDollars(lp.unitCost) + 1, Math.round(toDollars(lp.product.price) * 0.85 / 10) * 10));
  // Marketing push quote — only offered when there's genuine surplus inventory left to clear.
  const pushQuote = marketingPushQuote(lp);
  const pushed = (lp.marketingPushes ?? 0) >= 1;

  return (
    <div className="pd">
      <div className="pd__head">
        <span className="pd__cat" aria-hidden><CategoryIcon id={lp.product.category} size={18} /></span>
        <div className="pd__head-text">
          <h2 className="pd__title">{lp.product.name}</h2>
          <p className="pd__sub">{CATEGORY_LABEL[lp.product.category] ?? lp.product.category} · launched week {lp.launchedWeek}</p>
        </div>
        <StatPill value={VERDICT_LABEL[v]} tone={VERDICT_TONE[v]} />
      </div>

      <div className="pd__hero">
        <DeviceRenderer product={lp.product} size={150} idle flip={canFlip} face={face} />
        {canFlip && (
          <button
            className="pd__flip"
            onClick={() => { setFace((f) => (f === "front" ? "back" : "front")); haptic.light(); }}
            aria-label={face === "front" ? "Flip to see the back" : "Flip to see the front"}
          >
            <RotateCw size={15} aria-hidden />
            <span>{face === "front" ? "Back" : "Front"}</span>
          </button>
        )}
      </div>

      {/* Press reception — the buzz, surfaced right under the device (it's the fun payoff) */}
      <div className="pd__reviews">
        <div className="pd__reviews-head">
          <Newspaper size={15} aria-hidden />
          <span>Press reception</span>
          <span className={`pd__reviews-score pd__reviews-score--${reviewBand} tnum`}>
            {reviews.aggregate}<span className="pd__reviews-max">/100</span>
          </span>
        </div>
        <blockquote className="pd__reviews-quote">“{reviews.headline}”</blockquote>
        <div className="pd__reviews-outlets">
          {reviews.outlets.map((o) => (
            <div className="pd__reviews-outlet" key={o.outlet}>
              <span className="pd__reviews-outlet-score tnum"><Star size={11} aria-hidden /> {o.score}</span>
              <span className="pd__reviews-outlet-name">{o.outlet}</span>
            </div>
          ))}
        </div>
        <div className="pd__reviews-pc">
          {reviews.pros.map((p) => (
            <span className="pd__reviews-pro" key={p}><Plus size={12} aria-hidden /> {p}</span>
          ))}
          {reviews.cons.map((c) => (
            <span className="pd__reviews-con" key={c}><Minus size={12} aria-hidden /> {c}</span>
          ))}
        </div>
      </div>

      {/* Sales curve */}
      <div className="pd__curve">
        <div className="pd__curve-cap">
          <span className="pd__curve-label">Sales by week{live ? " · still selling" : ""}</span>
          <span className="pd__curve-week tnum">wk {Math.min(lp.weeksElapsed, lp.weeklyUnits.length)}/{lp.weeklyUnits.length}</span>
        </div>
        <SalesCurveChart weekly={lp.weeklyUnits} elapsed={lp.weeksElapsed} />
      </div>

      <div className="pd__stats">
        <Stat label="Units sold" value={lp.unitsSold.toLocaleString()} hint={`of ${lp.totalUnits.toLocaleString()} forecast`} />
        <Stat label="Revenue" value={format(lp.revenueToDate)} tone="positive" />
        <Stat
          label="Sell-through"
          value={sellThrough != null ? `${sellThrough}%` : "—"}
          tone={sellThrough != null && sellThrough >= 90 ? "positive" : "neutral"}
          hint={lp.plannedUnits != null ? `${lp.plannedUnits.toLocaleString()} made` : undefined}
        />
        {(() => {
          const grossProfitD = lp.unitsSold * (toDollars(lp.product.price) - toDollars(lp.unitCost));
          const gp = dollars(Math.round(grossProfitD));
          return (
            <Stat
              label="Gross profit"
              value={format(gp)}
              tone={grossProfitD >= 0 ? "positive" : "negative"}
              hint="excl. campaign"
            />
          );
        })()}
      </div>
      {/* How it was built — the supply-chain retrospective, shown only when it wasn't a default run. */}
      {(() => {
        const supCustom = (lp.product.supplierId ?? DEFAULT_SUPPLIER_ID) !== DEFAULT_SUPPLIER_ID || !!lp.product.dualSource;
        const facCustom = (lp.product.factoryId ?? DEFAULT_FACTORY_ID) !== DEFAULT_FACTORY_ID;
        if (!supCustom && !facCustom) return null;
        const parts: string[] = [];
        if (facCustom) parts.push(`built at ${factoryFor(lp.product.factoryId).name}`);
        if (supCustom) parts.push(`sourced via ${supplierFor(lp.product.supplierId).name}${lp.product.dualSource ? " (dual)" : ""}`);
        return <p className="pd__supply"><Package size={12} aria-hidden /> {parts.join(" · ")}</p>;
      })()}
      {/* Lifecycle phase breakdown — only for finished products with a full sales curve */}
      {!live && lp.weeklyUnits.length > 0 && (() => {
        const peakWk = BALANCE.sales.peakWeek;
        const priceD = toDollars(lp.product.price);
        const rushUnits = lp.weeklyUnits.slice(0, peakWk).reduce((s, u) => s + u, 0);
        const peakUnits = lp.weeklyUnits[peakWk] ?? 0;
        const declineUnits = lp.weeklyUnits.slice(peakWk + 1).reduce((s, u) => s + u, 0);
        const totalForecast = rushUnits + peakUnits + declineUnits;
        if (totalForecast <= 0) return null;
        const phases = [
          { label: "Launch rush", units: rushUnits },
          { label: "Peak week", units: peakUnits },
          { label: "Long tail", units: declineUnits },
        ];
        const maxUnits = Math.max(...phases.map((p) => p.units), 1);
        return (
          <div className="pd__phases">
            <span className="pd__phases-title">Sales by phase</span>
            {phases.map(({ label, units }) => (
              <div key={label} className="pd__phase-row">
                <span className="pd__phase-label">{label}</span>
                <div className="pd__phase-track">
                  <div className="pd__phase-fill" style={{ width: `${Math.round((units / maxUnits) * 100)}%` }} />
                </div>
                <span className="pd__phase-rev tnum">{format(dollars(Math.round(units * priceD)))}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Product specs */}
      <div className="pd__specs">
        {STAT_KEYS.map((k) => (
          <div key={k} className="pd__spec">
            <span className="pd__spec-label">{STAT_LABEL[k]}</span>
            <div className="pd__spec-track">
              <div className="pd__spec-fill" style={{ width: `${Math.min(100, lp.stats[k])}%` }} />
            </div>
            <span className="pd__spec-val tnum">{Math.round(lp.stats[k])}</span>
          </div>
        ))}
      </div>

      {/* Mid-lifecycle price cut — only for live products */}
      {live && (
        <div className="pd__pricecut">
          {(lp.priceCuts ?? 0) >= 1 ? (
            <div className="pd__pricecut-done">
              <TrendingDown size={13} aria-hidden />
              <span>Price reduced to <strong className="tnum">{format(lp.product.price)}</strong></span>
            </div>
          ) : !priceCutOpen ? (
            <button className="pd__pricecut-trigger" onClick={() => { setPriceCutOpen(true); haptic.light(); }}>
              <TrendingDown size={13} aria-hidden />
              <span>Reduce price · <span className="tnum">{format(lp.product.price)}</span> now</span>
              <ChevronRight size={14} className="pd__pricecut-caret" aria-hidden />
            </button>
          ) : (
            <div className="pd__pricecut-panel">
              <div className="pd__pricecut-title">
                <TrendingDown size={14} aria-hidden />
                <span>Reduce price</span>
              </div>
              <div className="pd__pricecut-row">
                <span className="pd__pricecut-from tnum">{format(lp.product.price)}</span>
                <ArrowRight size={14} className="pd__pricecut-arrow" aria-hidden />
                <span className="pd__pricecut-to tnum">{format(suggestedCut)}</span>
              </div>
              {(() => {
                const oldFit = priceFit(lp.product.price, lp.stats, lp.product.category);
                const newFit = priceFit(suggestedCut, lp.stats, lp.product.category);
                const boostPct = oldFit > 0 ? Math.round(((newFit / oldFit) - 1) * 100) : 0;
                return (
                  <p className="pd__pricecut-hint">
                    {boostPct > 0 ? `~+${boostPct}% estimated demand uplift · ` : ""}One adjustment per product.
                  </p>
                );
              })()}
              <div className="pd__pricecut-actions">
                <Button
                  block
                  onClick={() => {
                    const result = cutProductPrice(lp.product.id, suggestedCut);
                    if (result.ok) {
                      haptic.success();
                      showToast("Price reduced", { tone: "positive" });
                      setPriceCutOpen(false);
                    } else {
                      haptic.medium();
                      showToast(result.reason ?? "Can't adjust price", { tone: "negative" });
                    }
                  }}
                >
                  Confirm · {format(suggestedCut)}
                </Button>
                <Button block variant="tertiary" onClick={() => { setPriceCutOpen(false); haptic.light(); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mid-lifecycle marketing push — the margin-preserving sibling of a price cut. Only shown
          when there's surplus inventory to clear (pushQuote != null) or one has already run. */}
      {live && (pushed || pushQuote) && (
        <div className="pd__pricecut">
          {pushed ? (
            <div className="pd__pricecut-done">
              <Megaphone size={13} aria-hidden />
              <span>Marketing campaign running</span>
            </div>
          ) : !pushOpen ? (
            <button className="pd__pricecut-trigger" onClick={() => { setPushOpen(true); haptic.light(); }}>
              <Megaphone size={13} aria-hidden />
              <span>Marketing push · keep your <span className="tnum">{format(lp.product.price)}</span> price</span>
              <ChevronRight size={14} className="pd__pricecut-caret" aria-hidden />
            </button>
          ) : (
            <div className="pd__pricecut-panel">
              <div className="pd__pricecut-title">
                <Megaphone size={14} aria-hidden />
                <span>Marketing push</span>
              </div>
              <p className="pd__pricecut-hint">
                Sell ~<strong className="tnum">{pushQuote!.addedUnits.toLocaleString()}</strong> more units at full price, no margin cut. One campaign per product.
              </p>
              <div className="pd__pricecut-actions">
                <Button
                  block
                  onClick={() => {
                    const result = marketingPush(lp.product.id);
                    if (result.ok) {
                      haptic.success();
                      showToast("Campaign launched", { tone: "positive" });
                      setPushOpen(false);
                    } else {
                      haptic.medium();
                      showToast(result.reason ?? "Can't run campaign", { tone: "negative" });
                    }
                  }}
                >
                  Confirm · {format(pushQuote!.cost)}
                </Button>
                <Button block variant="tertiary" onClick={() => { setPushOpen(false); haptic.light(); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Why it performed */}
      <div className="pd__why">
        <div className="pd__why-head">
          <Sparkles size={15} aria-hidden />
          <span>Why it {v === "hit" ? "won" : v === "flop" ? "flopped" : v === "solid" ? "delivered" : "performed"}</span>
        </div>
        {pm && <p className="pd__why-headline">{pm.headline}</p>}
        {pm && <p className="pd__why-story">{pm.narrative}</p>}
        <ul className="pd__drivers">
          {orderedDrivers.map((d) => {
            const key = pm?.dominant.includes(d.key);
            return (
              <li className={`pd__driver${key ? " pd__driver--key" : ""}`} key={d.label}>
                <div className="pd__driver-top">
                  <span className="pd__driver-label">{d.label}{key && <span className="pd__driver-tag">key factor</span>}</span>
                  <span className={`pd__driver-value pd__driver-value--${d.tone} tnum`}>{d.value}</span>
                </div>
                <p className="pd__driver-detail">{d.detail}</p>
              </li>
            );
          })}
        </ul>
        {!lp.insight && (
          <p className="pd__why-note">Detailed launch metrics weren't recorded for this older product, shown as an overall read.</p>
        )}
        <StatGlossary label="What these stats mean" />
      </div>

      {tips.length > 0 && (
        <div className="pd__tips">
          <div className="pd__tips-head">
            <Lightbulb size={15} aria-hidden />
            <span>Tips for next time</span>
          </div>
          <ul className="pd__tips-list">
            {tips.map((t, i) => <li key={i} className="pd__tip">{t}</li>)}
          </ul>
        </div>
      )}

      {onDesignSuccessor && (
        <Button block onClick={() => { onDesignSuccessor(lp.product); haptic.success(); }}>
          <Wand2 size={16} /> Design a successor
        </Button>
      )}
      <Button block variant="tertiary" onClick={onClose}>Close</Button>
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.floor(n / 1000)}k`;
  return n.toLocaleString();
}

/** The player's product lines grouped by brand equity — the IP lens over the catalog. Each row opens
 *  a detail sheet: the line's "chapters" (every product, newest first) with its verdict + numbers. */
function FranchisesCard({ launched }: { launched: LaunchedProduct[] }) {
  const lines = playerFranchises(launched);
  const [open, setOpen] = useState<FranchiseSummary | null>(null);
  if (lines.length === 0) return null;
  return (
    <Card>
      <SectionHeader title="Your franchises" accessory={`${lines.length} line${lines.length > 1 ? "s" : ""}`} />
      <div className="mkt__fr-list">
        {lines.map((f) => (
          <button key={f.stem} className="mkt__fr mkt__fr--tap" onClick={() => { haptic.light(); setOpen(f); }}>
            <div className="mkt__fr-head">
              <span className="mkt__fr-name">{f.name} line</span>
              <span className={`mkt__fr-tag mkt__fr-tag--${f.label.toLowerCase().replace(/\s+/g, "")}`}>{f.label}</span>
              <ChevronRight size={16} className="mkt__fr-chev" aria-hidden />
            </div>
            <div className="mkt__fr-sub">
              {f.entries} product{f.entries > 1 ? "s" : ""} · {fmtCompact(f.unitsSold)} sold · {format(f.revenue)} · latest {f.latestName}
            </div>
            <div className="mkt__fr-bar" aria-hidden><span className="mkt__fr-fill" style={{ width: `${Math.round(Math.max(0, f.equity) * 100)}%` }} /></div>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} label="Product detail">
        {open && <FranchiseDetail summary={open} launched={launched} />}
      </Sheet>
    </Card>
  );
}

/** A single franchise's story: every product in the line, newest first, with a device thumbnail,
 *  verdict, units and revenue — so the brand-equity loop's payoff is visible and tangible. */
function FranchiseDetail({ summary, launched }: { summary: FranchiseSummary; launched: LaunchedProduct[] }) {
  const products = launched
    .filter((lp) => franchiseStem(lp.product.name) === summary.stem)
    .sort((a, b) => b.launchedWeek - a.launchedWeek);
  const equityPct = Math.round(Math.max(0, summary.equity) * 100);
  return (
    <div className="frd">
      <div className="frd__head">
        <div>
          <h2 className="frd__title">{summary.name} line</h2>
          <p className="frd__sub">{summary.entries} chapter{summary.entries > 1 ? "s" : ""} · {summary.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(" · ")}</p>
        </div>
        <span className={`mkt__fr-tag mkt__fr-tag--${summary.label.toLowerCase().replace(/\s+/g, "")}`}>{summary.label}</span>
      </div>

      <div className="frd__stats">
        <Stat label="Lifetime revenue" value={format(summary.revenue)} tone="positive" />
        <Stat label="Units sold" value={fmtCompact(summary.unitsSold)} />
        <Stat label="Brand equity" value={`${equityPct}%`} tone="accent" />
      </div>

      <div className="frd__list">
        {products.map((lp, i) => {
          const v = verdictOf(lp);
          return (
            <div key={lp.product.id ?? `${lp.product.name}-${i}`} className="frd__row">
              <div className="frd__thumb" aria-hidden><DeviceRenderer product={lp.product} size={48} /></div>
              <div className="frd__row-main">
                <span className="frd__row-name">{lp.product.name}</span>
                <span className="frd__row-meta">{CATEGORY_LABEL[lp.product.category] ?? lp.product.category} · wk {lp.launchedWeek} · {fmtCompact(lp.unitsSold)} sold</span>
              </div>
              <div className="frd__row-side">
                <span className={`frd__verdict frd__verdict--${VERDICT_TONE[v]}`}>{VERDICT_LABEL[v]}</span>
                <span className="frd__row-rev tnum">{format(lp.revenueToDate)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A rival's company card + their product lines + recent releases (tap a rival release to open). */
function RivalProfileSheet({ comp, releases, onTrade, onClose }: { comp: CompetitorState; releases: RivalRelease[]; onTrade: () => void; onClose: () => void }) {
  const { state, acquireRival } = useGame();
  const [armAcquire, setArmAcquire] = useState(false);
  const cap = rivalMarketCap(comp);
  const ch = changePct(comp.priceHistory);
  const lines = rivalLines(releases.map((r) => ({ name: r.product.name, week: r.week, overall: r.overall, category: r.category })));
  const acquirable = canAcquire(state, comp.id);
  const buyout = acquisitionCost(state, comp.id);
  const established = toDollars(state.cumulativeRevenue) >= toDollars(BALANCE.ipo.minRevenueToList);
  const atFloor = state.competitors.length <= BALANCE.mergers.minActiveRivals;
  // Your relationships with this rival: do they license your OS, and do you hold their shares?
  const licensed = state.osLicensees.includes(comp.id);
  const licenseFee = licensed ? rivalLicenseFee(comp.reputation, osTierInfo(state).tier) : null;
  const held = state.holdings[comp.id] ?? 0;
  const totalShares = rivalDef(comp.id)?.shares ?? 0;
  const ownPct = totalShares > 0 ? (held / totalShares) * 100 : 0;
  return (
    <div className="rprof">
      <div className="rprof__head">
        <span className="rprof__brand" aria-hidden><Building2 size={20} /></span>
        <div>
          <h2 className="rprof__title">{comp.name}</h2>
          <p className="rprof__sub">{comp.blurb}</p>
        </div>
      </div>
      <div className="rprof__spark">
        <Sparkline data={comp.priceHistory} stroke={ch >= 0 ? "var(--positive)" : "var(--negative)"} height={40} />
      </div>
      <div className="rprof__stats">
        <StatPill label="Reputation" value={Math.round(comp.reputation)} tone={comp.reputation >= 60 ? "positive" : "neutral"} />
        <StatPill label="Market cap" value={format(cap)} />
        <StatPill label="Share" value={`${format(cents(comp.sharePrice))} · ${ch >= 0 ? "+" : "−"}${Math.abs(ch).toFixed(1)}%`} tone={ch >= 0 ? "positive" : "negative"} />
        <StatPill label="Strategy" value={DOCTRINE_LABEL[rivalDoctrine(comp.id)] ?? "—"} />
      </div>

      {rivalDef(comp.id)?.bio && <p className="rprof__bio">{rivalDef(comp.id)!.bio}</p>}
      <p className="rprof__doctrine">
        <Building2 size={13} aria-hidden /> <strong>{DOCTRINE_LABEL[rivalDoctrine(comp.id)]}:</strong> {DOCTRINE_EXPLAINER[rivalDoctrine(comp.id)]}
      </p>

      {(licensed || held > 0) && (
        <div className="rprof__status">
          {licensed && licenseFee && (
            <span className="rprof__badge rprof__badge--license">
              Licenses {osDisplayName(state)} · {format(licenseFee)}/wk
            </span>
          )}
          {held > 0 && (
            <span className="rprof__badge">
              You own {held.toLocaleString()} share{held !== 1 ? "s" : ""}{ownPct >= 0.1 ? ` · ${ownPct.toFixed(1)}%` : ""}
            </span>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <Card>
          <SectionHeader title="Product lines" accessory={`${lines.length}`} />
          <div className="mkt__fr-list">
            {lines.map((l) => (
              <div key={l.stem} className="mkt__fr">
                <div className="mkt__fr-head">
                  <span className="mkt__fr-name">{l.name}</span>
                  <span className="mkt__fr-tag">{l.entries} {l.entries > 1 ? "entries" : "entry"}</span>
                </div>
                <div className="mkt__fr-sub">
                  <CategoryIcon id={l.categories[0]} size={11} /> latest {l.latestName} · avg quality {l.avgOverall}/100
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader title="Recent releases" accessory={`${releases.length}`} />
        <div className="mkt__rivals">
          {releases.slice(0, 5).map((r, i) => (
            <div key={`${r.product.id}-${i}`} className="mkt__rival">
              <span className="mkt__rival-thumb"><DeviceRenderer product={r.product} size={40} /></span>
              <span className="mkt__rival-info">
                <span className="mkt__rival-name">{r.product.name}</span>
                <span className="mkt__rival-sub"><CategoryIcon id={r.category} size={12} /> {CATEGORY_LABEL[r.category] ?? r.category} · wk {r.week}</span>
              </span>
              <span className="mkt__rival-meta"><span className="mkt__rival-price tnum">{format(r.product.price)}</span></span>
            </div>
          ))}
        </div>
      </Card>

      <Button block variant="secondary" onClick={onTrade}>Trade {comp.name} shares</Button>

      {established && buyout && (
        <div className="rprof__acquire">
          <Button
            block
            variant={armAcquire ? "primary" : "tertiary"}
            disabled={!acquirable}
            onClick={() => {
              if (!armAcquire) { setArmAcquire(true); haptic.medium(); return; }
              if (!acquireRival(comp.id)) { haptic.error(); setArmAcquire(false); return; }
              haptic.success(); sfx("era"); emitCelebrate();
              showToast(`Acquired ${comp.name}`, { tone: "positive", glyph: <Crown size={15} /> });
              onClose();
            }}
          >
            <Crown size={14} />
            {armAcquire ? `Confirm buyout · ${format(buyout)}` : `Acquire ${comp.name} · ${format(buyout)}`}
          </Button>
          <p className="rprof__acquire-note">
            {acquirable
              ? "Buy them out: remove them from competition and absorb their brand + customers."
              : atFloor
                ? "The market needs at least a couple of rivals, you can't acquire any more right now."
                : state.cash < buyout
                  ? `You need ${format(sub(buyout, state.cash))} more cash to take control.`
                  : "Acquisitions unlock once your company is established."}
          </p>
        </div>
      )}
      <Button block variant="tertiary" onClick={onClose}>Done</Button>
    </div>
  );
}

function TradeSheet({ comp, onClose }: { comp: CompetitorState; onClose: () => void }) {
  const { state, buyShares, sellShares, acquireRival } = useGame();
  const [qty, setQty] = useState(1);
  const [armAcquire, setArmAcquire] = useState(false);
  const owned = state.holdings[comp.id] ?? 0;
  // B3 — outright acquisition. Surface once the company is established (past the revenue bar); the
  // button explains itself when gated (field floor / not enough cash).
  const established = toDollars(state.cumulativeRevenue) >= toDollars(BALANCE.ipo.minRevenueToList);
  const buyout = acquisitionCost(state, comp.id);
  const acquirable = canAcquire(state, comp.id);
  const atFloor = state.competitors.length <= BALANCE.mergers.minActiveRivals;
  const cost = buyCost(comp.sharePrice, qty);
  const proceeds = sellProceeds(comp.sharePrice, qty);
  const canBuy = state.cash >= cost;
  const maxBuy = Math.floor(toDollars(state.cash) / (toDollars(cost) / qty || 1));
  const ch = changePct(comp.priceHistory);
  const strongCats = Object.entries(comp.strengthByCategory as Record<string, number>)
    .filter(([, s]) => s > 10)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">{comp.name}</h2>
          <p className="trade__sub">{comp.blurb}</p>
        </div>
        <div className="trade__head-right">
          <span className="trade__price rounded tnum">{format(cents(comp.sharePrice))}</span>
          <span className={`trade__ch tnum ${ch >= 0 ? "trade__ch--up" : "trade__ch--down"}`}>
            {ch >= 0 ? <TrendingUp size={11} aria-hidden /> : <TrendingDown size={11} aria-hidden />}
            {Math.abs(ch).toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="trade__spark">
        <Sparkline data={comp.priceHistory} stroke={ch >= 0 ? "var(--positive)" : "var(--negative)"} height={44} />
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${owned} sh`} />
        <StatPill label="Value" value={format(cents(owned * comp.sharePrice))} tone={owned > 0 ? "positive" : "neutral"} />
        <StatPill label="Rep" value={Math.round(comp.reputation)} tone={comp.reputation >= 60 ? "positive" : "neutral"} />
      </div>
      {strongCats.length > 0 && (
        <div className="trade__cats">
          {strongCats.slice(0, 4).map(([cat, str]) => {
            const pct = Math.min(100, Math.round((str / 100) * 100));
            return (
              <div key={cat} className="trade__cat-row">
                <span className="trade__cat-name">
                  <CategoryIcon id={cat as CategoryId} size={11} />{CATEGORY_LABEL[cat] ?? cat}
                </span>
                <div className="trade__cat-bar">
                  <div className="trade__cat-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="trade__cat-pct tnum">{pct}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Investment context */}
      <div className="trade__invest">
        {(() => {
          const wks = comp.nextLaunchWeek - state.week;
          if (wks >= 0 && wks <= 6) {
            return (
              <span className="trade__invest-row trade__invest-row--launch">
                <Rocket size={11} aria-hidden />
                {wks === 0 ? "Launching this week, share price may spike" : `Launching in ${wks} week${wks !== 1 ? "s" : ""}, watch for a price bump`}
              </span>
            );
          }
          return null;
        })()}
        <span className="trade__invest-row">
          ~{format(cents(Math.round(comp.sharePrice * 100 * BALANCE.stocks.dividendYieldPerWeek)))}/wk per 100 shares · {(BALANCE.stocks.dividendYieldPerWeek * 52 * 100).toFixed(1)}% annual yield
        </span>
      </div>
      <div className="trade__qty">
        <span className="trade__qty-label">Shares</span>
        <div className="trade__stepper">
          <button onClick={() => { setQty((q) => Math.max(1, q - 1)); haptic.light(); }} aria-label="Fewer shares"><Minus size={16} /></button>
          <span className="trade__qty-val tnum">{qty}</span>
          <button onClick={() => { setQty((q) => q + 1); haptic.light(); }} aria-label="More shares"><Plus size={16} /></button>
        </div>
      </div>
      <div className="trade__presets">
        {[5, 25, 100].map((n) => (
          <button key={n} className="trade__preset" onClick={() => { setQty(n); haptic.light(); }}>{n}</button>
        ))}
        {maxBuy > 0 && <button className="trade__preset" onClick={() => { setQty(Math.max(1, maxBuy)); haptic.light(); }}>Max</button>}
      </div>

      <div className="trade__actions">
        <Button
          block
          disabled={!canBuy}
          onClick={() => { buyShares(comp.id, qty); haptic.success(); sfx("confirm"); showToast(`Bought ${qty} ${comp.name}`, { tone: "positive" }); }}
        >
          Buy · {format(cost)}
        </Button>
        <Button
          block
          variant="secondary"
          disabled={owned <= 0}
          onClick={() => { const q = Math.min(qty, owned); sellShares(comp.id, q); haptic.light(); sfx("cash"); showToast(`Sold ${q} ${comp.name}`, { tone: "neutral" }); }}
        >
          Sell · {format(proceeds)}
        </Button>
      </div>
      {owned > 0 && (
        <Button block variant="tertiary" onClick={() => { sellShares(comp.id, owned); haptic.medium(); sfx("cash"); onClose(); }}>
          Sell all {owned}
        </Button>
      )}

      {established && buyout && (
        <div className="trade__acquire">
          <Button
            block
            variant={armAcquire ? "primary" : "tertiary"}
            disabled={!acquirable}
            onClick={() => {
              if (!armAcquire) { setArmAcquire(true); haptic.medium(); return; }
              if (!acquireRival(comp.id)) { haptic.error(); setArmAcquire(false); return; }
              haptic.success(); sfx("era"); emitCelebrate();
              showToast(`Acquired ${comp.name}`, { tone: "positive", glyph: <Crown size={15} /> });
              onClose();
            }}
          >
            <Crown size={14} />
            {armAcquire ? `Confirm buyout · ${format(buyout)}` : `Acquire ${comp.name} · ${format(buyout)}`}
          </Button>
          <p className="trade__acquire-note">
            {acquirable
              ? "Buy out the company: remove it from competition and absorb its brand + customers."
              : atFloor
                ? "The market needs at least a couple of rivals, you can't acquire any more right now."
                : state.cash < buyout
                  ? `You need ${format(sub(buyout, state.cash))} more cash to take control.`
                  : "Acquisitions unlock once your company is established."}
          </p>
        </div>
      )}
    </div>
  );
}

function IPOSheet({ onClose }: { onClose: () => void }) {
  const { state, listCompany } = useGame();
  const [pct, setPct] = useState(BALANCE.ipo.defaultStake * 100);
  const valuation = companyValuation(state);
  const raised = toDollars(valuation) * (pct / 100);
  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">Take {state.companyName} public</h2>
          <p className="trade__sub">Sell a stake on the exchange for a cash infusion, and you keep the rest. Going public can't be undone.</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="Valuation" value={format(valuation)} tone="accent" />
        <StatPill label="You'll keep" value={`${Math.round(100 - pct)}%`} tone="positive" />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={5} max={BALANCE.ipo.maxStakePerSale * 100} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { listCompany(pct / 100); haptic.success(); sfx("era"); emitCelebrate(); showToast(`${state.companyName} is now public!`, { tone: "positive", glyph: <Building2 size={15} /> }); onClose(); }}>
        Confirm listing
      </Button>
    </div>
  );
}

function SellStakeSheet({ onClose }: { onClose: () => void }) {
  const { state, sellOwnStake } = useGame();
  const maxSell = Math.max(0, state.ownership - 0.05) * 100;
  const [pct, setPct] = useState(Math.min(10, maxSell));
  const valuation = companyValuation(state);
  const raised = toDollars(valuation) * (pct / 100);
  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">Sell shares</h2>
          <p className="trade__sub">Cash out more of your stake (you'll keep at least 5%). Sold shares can't be bought back.</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${Math.round(state.ownership * 100)}%`} />
        <StatPill label="After" value={`${Math.round(state.ownership * 100 - pct)}%`} />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={1} max={Math.max(1, maxSell)} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { sellOwnStake(pct / 100); haptic.success(); sfx("cash"); showToast(`Sold ${Math.round(pct)}% of ${state.companyName}`, { tone: "positive" }); onClose(); }}>
        Confirm sale
      </Button>
    </div>
  );
}

function FeedSheet({ feed, onClose }: { feed: FeedItem[]; onClose: () => void }) {
  const sorted = [...feed].reverse();
  return (
    <div className="mkt__feed-sheet">
      <div className="mkt__feed-sheet-hdr">
        <h2 className="mkt__feed-sheet-title">Activity log</h2>
        <button className="mkt__feed-sheet-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="mkt__feed-sheet-sub">{feed.length} events recorded</p>
      <ul className="mkt__feed mkt__feed--full">
        {sorted.map((f) => {
          const Icon: LucideIcon = f.tone === "positive" ? TrendingUp : f.tone === "negative" ? TrendingDown : f.tone === "accent" ? Sparkles : Newspaper;
          return (
            <li key={f.id} className={`mkt__feed-item mkt__feed-item--${f.tone}`}>
              <span className="mkt__feed-icon" aria-hidden><Icon size={11} strokeWidth={2.5} /></span>
              <span className="mkt__feed-week">wk {f.week}</span>
              {f.text}
            </li>
          );
        })}
      </ul>
      <Button block variant="secondary" onClick={onClose}>Close</Button>
    </div>
  );
}
