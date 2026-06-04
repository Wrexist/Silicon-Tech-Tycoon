import { useState } from "react";
import { Building2, Lightbulb, Minus, Newspaper, Package, Plus, Sparkles, TrendingDown, TrendingUp, Wand2, X, type LucideIcon } from "lucide-react";
import { Button, Card, EmptyState, Sheet, SectionHeader, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { CATEGORY_LIST } from "../engine/catalogs.ts";
import { eraName } from "../engine/eras.ts";
import { dollars, format, sub, toDollars, cents } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { buyCost, sellProceeds } from "../engine/stocks.ts";
import {
  burn,
  canList,
  companyValuation,
  founderStakeValue,
  netWorth,
  nextWeekRevenue,
  type FeedItem,
} from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import type { CategoryId, CompetitorState, LaunchedProduct, Product, Stats } from "../engine/types.ts";
import { STAT_KEYS } from "../engine/types.ts";
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

const STAT_LABEL: Record<keyof Stats, string> = {
  performance: "Performance",
  quality: "Quality",
  battery: "Battery",
  design: "Design",
  ecosystem: "Ecosystem",
};

function changePct(history: number[]): number {
  if (history.length < 2) return 0;
  const a = history[history.length - 2];
  const b = history[history.length - 1];
  return a > 0 ? ((b - a) / a) * 100 : 0;
}

export function Market({ onDesignSuccessor, onOpenDesignLab }: { onDesignSuccessor?: (p: Product) => void; onOpenDesignLab?: () => void } = {}) {
  const { state } = useGame();
  const trends = state.trends;
  const comps = state.competitors;
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
  const [feedOpen, setFeedOpen] = useState(false);
  const detail = state.launched.find((l) => l.product.id === detailId) ?? null;

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

  return (
    <div className="mkt">
      {/* Net worth banner */}
      <Card className="mkt__networth">
        <div className="mkt__nw-main">
          <span className="mkt__nw-label">Net worth</span>
          <span className="mkt__nw-value rounded tnum">{format(net)}</span>
        </div>
        <div className="mkt__nw-row">
          <StatPill label="Cash" value={format(state.cash)} />
          <StatPill label="Fans" value={state.fans >= 1000 ? `${(state.fans / 1000).toFixed(1)}k` : String(state.fans)} tone={state.fans > 0 ? "positive" : "neutral"} />
          <StatPill label="Reputation" value={Math.round(state.reputation)} tone={state.reputation >= 50 ? "positive" : "neutral"} />
          <StatPill label="Weekly" value={`${wkFlowD >= 0 ? "+" : ""}${format(wkFlow)}`} tone={wkFlowD >= 0 ? "positive" : "negative"} />
        </div>
      </Card>

      {/* Your company (equity) */}
      <Card className="mkt__co">
        <SectionHeader title={state.companyName} accessory={state.listed ? "publicly traded" : "private"} />
        <div className="mkt__co-grid">
          <Stat label="Valuation" value={format(valuation)} />
          <Stat label="You own" value={`${Math.round(state.ownership * 100)}%`} />
          <Stat label="Your stake" value={format(stake)} tone="positive" />
        </div>
        {!state.listed ? (
          listable ? (
            <Button block onClick={() => { setIpo(true); haptic.light(); }}>
              <Building2 size={16} /> Take {state.companyName} public (IPO)
            </Button>
          ) : (
            <p className="mkt__co-hint">
              IPO unlocks at {format(BALANCE.ipo.minRevenueToList)} lifetime revenue — you're at {format(state.cumulativeRevenue)}.
            </p>
          )
        ) : (
          <Button block variant="secondary" onClick={() => { setSellStake(true); haptic.light(); }} disabled={state.ownership <= 0.06}>
            Sell more shares
          </Button>
        )}
      </Card>

      {/* Your launched products — tap one to see why it performed + design a successor */}
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
                    className="mkt__product"
                    onClick={() => { setDetailId(lp.product.id); haptic.light(); }}
                    aria-label={`View ${lp.product.name} performance`}
                  >
                    <span className="mkt__product-row">
                      <span className="mkt__product-thumb"><DeviceRenderer product={lp.product} size={44} /></span>
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
                        {live && !endingSoon && <span className="mkt__product-live">selling</span>}
                        {endingSoon && <span className="mkt__product-ending">last {lp.weeklyUnits.length - lp.weeksElapsed}wk</span>}
                        {!live && lp.plannedUnits && lp.plannedUnits > 0 && (
                          <span className={`mkt__product-thru tnum${Math.round((lp.unitsSold / lp.plannedUnits) * 100) >= 90 ? " mkt__product-thru--full" : ""}`}>
                            {Math.min(100, Math.round((lp.unitsSold / lp.plannedUnits) * 100))}% sold
                          </span>
                        )}
                      </span>
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
                    ? `${expiredHits[0].product.name} has run its course — time for a follow-up.`
                    : `${expiredHits.length} products have run their cycle — design successors to keep revenue flowing.`}
                </span>
                <Button size="sm" variant="secondary" onClick={() => { onDesignSuccessor(expiredHits[0].product); haptic.light(); }}>
                  <Wand2 size={13} /> Redesign
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Stock exchange */}
      <SectionHeader title="Stock Exchange" accessory="trade rival shares" />
      {comps.map((c) => {
        const ch = changePct(c.priceHistory);
        const owned = state.holdings[c.id] ?? 0;
        const activeCats = Object.entries(c.strengthByCategory)
          .filter(([, s]) => (s as number) > 20)
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 3)
          .map(([cat]) => cat as CategoryId);
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
              {activeCats.length > 0 && (
                <div className="mkt__stock-cats">
                  {activeCats.map((cat) => (
                    <span key={cat} className="mkt__stock-cat">
                      <CategoryIcon id={cat} size={10} />{CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </Card>
        );
      })}

      {/* Competition landscape — which categories rivals are currently contesting */}
      {unlockedCats.length > 1 && (
        <Card>
          <SectionHeader title="Competition landscape" accessory="rival presence by category" />
          {(() => {
            const activeCats = new Set(
              state.launched
                .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
                .map((lp) => lp.product.category),
            );
            return (
              <div className="mkt__compmap">
                {unlockedCats.map((cat) => {
                  const totalStr = comps.reduce(
                    (s, c) => s + ((c.strengthByCategory as Record<string, number>)[cat.id] ?? 0), 0,
                  );
                  const activeRivals = comps.filter(
                    (c) => ((c.strengthByCategory as Record<string, number>)[cat.id] ?? 0) > 5,
                  ).length;
                  const pct = Math.min(100, Math.round((totalStr / 220) * 100));
                  const heat: "positive" | "accent" | "negative" =
                    pct >= 65 ? "negative" : pct >= 30 ? "accent" : "positive";
                  const youHere = activeCats.has(cat.id);
                  return (
                    <div key={cat.id} className="mkt__compmap-row">
                      <span className="mkt__compmap-cat">
                        <span className={`mkt__compmap-dot${youHere ? " mkt__compmap-dot--on" : ""}`} aria-hidden />
                        <CategoryIcon id={cat.id} size={11} />{cat.displayName}
                      </span>
                      <div className="mkt__compmap-track">
                        <div className={`mkt__compmap-fill mkt__compmap-fill--${heat}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`mkt__compmap-label mkt__compmap-label--${heat}`}>
                        {activeRivals > 0 ? `${activeRivals} rival${activeRivals > 1 ? "s" : ""}` : "Open"}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <p className="mkt__compmap-hint">● = you're selling there · Green = weak competition.</p>
        </Card>
      )}

      {/* Trends */}
      <Card>
        <SectionHeader
          title="What the market wants"
          accessory={`${eraName(state.era)} · shift ~wk ${state.trendRetargetWeek}`}
        />
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
      </Card>

      {/* Market opportunity */}
      {(hotStatDelta > 0.005 || weakestCat != null) && (
        <Card className="mkt__intel">
          <SectionHeader title="Market opportunity" accessory="based on current data" />
          <div className="mkt__intel-list">
            {hotStatDelta > 0.005 && (
              <div className="mkt__intel-row">
                <TrendingUp size={14} className="mkt__intel-icon mkt__intel-icon--up" />
                <span className="mkt__intel-text">
                  <strong>{STAT_LABEL[hotStat]}</strong> demand is rising — lead with it in your next product.
                </span>
              </div>
            )}
            {weakestCat != null && (
              <div className="mkt__intel-row">
                <span className="mkt__intel-icon mkt__intel-icon--opp" aria-hidden>◎</span>
                <span className="mkt__intel-text">
                  <strong>{weakestCat.displayName}</strong> has the least rival competition right now.
                </span>
              </div>
            )}
            {state.reputation >= 65 && (
              <div className="mkt__intel-row">
                <span className="mkt__intel-icon mkt__intel-icon--rep" aria-hidden>★</span>
                <span className="mkt__intel-text">
                  Your reputation ({Math.round(state.reputation)}) supports premium pricing on your next launch.
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

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

      <Sheet open={!!detail} onClose={() => setDetailId(null)}>
        {detail && (
          <ProductDetailSheet
            lp={detail}
            onClose={() => setDetailId(null)}
            onDesignSuccessor={onDesignSuccessor ? (p) => { setDetailId(null); onDesignSuccessor(p); } : undefined}
          />
        )}
      </Sheet>

      <Sheet open={!!trade} onClose={() => setTrade(null)}>
        {trade && <TradeSheet comp={comps.find((c) => c.id === trade.id) ?? trade} onClose={() => setTrade(null)} />}
      </Sheet>
      <Sheet open={ipo} onClose={() => setIpo(false)}>
        {ipo && <IPOSheet onClose={() => setIpo(false)} />}
      </Sheet>
      <Sheet open={sellStake} onClose={() => setSellStake(false)}>
        {sellStake && <SellStakeSheet onClose={() => setSellStake(false)} />}
      </Sheet>
      <Sheet open={feedOpen} onClose={() => setFeedOpen(false)}>
        <FeedSheet feed={state.feed} onClose={() => setFeedOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ---------- Post-launch product detail ---------- */

type DriverTone = "positive" | "accent" | "negative" | "neutral";
interface Driver {
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
      label: "Demand fit",
      value: `${f}/100`,
      detail: f >= 60 ? "Closely matched what the market wanted." : f >= 35 ? "A decent match for the trend." : "Out of step with what buyers wanted.",
      tone: f >= 60 ? "positive" : f >= 35 ? "accent" : "negative",
    });
  } else {
    const hi = lp.launchScore >= 76;
    const lo = lp.launchScore <= 22;
    drivers.push({
      label: "Demand fit",
      value: hi ? "Strong" : lo ? "Weak" : "Fair",
      detail: hi ? "Read the market well at launch." : lo ? "Mistimed the market." : "An average read on the trend.",
      tone: hi ? "positive" : lo ? "negative" : "accent",
    });
  }

  // 2) Price positioning — value buy vs. on-the-money vs. overpriced.
  if (ins) {
    const pf = ins.priceFit;
    const over = pf < 0.8;
    const under = pf > 1.12;
    drivers.push({
      label: "Price",
      value: over ? "Overpriced" : under ? "Value buy" : "On the money",
      detail: over ? "Buyers felt it cost too much for the spec." : under ? "Priced below its perceived value — drove volume." : "Priced fairly for what it delivered.",
      tone: over ? "negative" : under ? "positive" : "accent",
    });
  }

  // 3) Competition pressure — rivals splitting or beating the market.
  if (ins) {
    const beats = ins.betterRivals;
    const matches = ins.matchingRivals;
    const kept = Math.round(ins.competitionFactor * 100);
    drivers.push({
      label: "Competition",
      value: beats > 0 ? `${beats} ahead` : matches > 0 ? `${matches} matched` : "Clear field",
      detail: beats > 0
        ? `Rivals outclassed you — you kept ~${kept}% of demand.`
        : matches > 0
          ? `Rivals split the market — you kept ~${kept}% of demand.`
          : "No rival came close — you owned the category.",
      tone: beats > 0 ? "negative" : matches > 0 ? "accent" : "positive",
    });
  }

  // 4) Hype — reputation + marketing reach at launch.
  if (ins) {
    const h = ins.hype;
    const strong = h >= 1.6;
    const weak = h < 1.1;
    drivers.push({
      label: "Hype",
      value: strong ? "High" : weak ? "Low" : "Moderate",
      detail: strong ? "Reputation and marketing gave a big launch boost." : weak ? "Little buzz — few buyers knew it existed." : "A steady amount of launch buzz.",
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
    tips.push("Poor trend match — check the Market tab before designing and build toward what consumers are currently demanding.");
  }
  if (ins.priceFit < 0.8) {
    tips.push("Buyers found this overpriced. Try the 'Suggest' button in the Design Lab to dial in a fairer price next time.");
  } else if (ins.priceFit > 1.12 && v !== "hit") {
    tips.push("Underpriced — the quality supported a higher price. Charging a bit more improves margins without hurting demand.");
  }
  if (ins.betterRivals >= 2) {
    tips.push("Multiple rivals outclassed this product — upgrade components to higher tiers and invest in R&D to unlock better tech.");
  } else if (ins.betterRivals === 1) {
    tips.push("One rival edged you out — a single component upgrade or a tighter price could swing the category your way.");
  }
  if (ins.hype < 1.05 && tips.length < 3) {
    tips.push("Very little launch buzz. A paid marketing channel (Social, Search, or TV) can multiply demand at launch.");
  }
  if (tips.length === 0 && v === "hit") {
    tips.push("Strong launch — maintain momentum by designing a successor before this product finishes its run.");
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
  const v = verdictOf(lp);
  const drivers = performanceDrivers(lp);
  const tips = generateTips(lp);
  const sellThrough = lp.plannedUnits && lp.plannedUnits > 0
    ? Math.min(100, Math.round((lp.unitsSold / lp.plannedUnits) * 100))
    : null;
  const live = lp.weeksElapsed < lp.weeklyUnits.length;

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
        <DeviceRenderer product={lp.product} size={150} idle />
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
      </div>

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

      {/* Why it performed */}
      <div className="pd__why">
        <div className="pd__why-head">
          <Sparkles size={15} aria-hidden />
          <span>Why it {v === "hit" ? "won" : v === "flop" ? "flopped" : v === "solid" ? "delivered" : "performed"}</span>
        </div>
        <ul className="pd__drivers">
          {drivers.map((d) => (
            <li className="pd__driver" key={d.label}>
              <div className="pd__driver-top">
                <span className="pd__driver-label">{d.label}</span>
                <span className={`pd__driver-value pd__driver-value--${d.tone} tnum`}>{d.value}</span>
              </div>
              <p className="pd__driver-detail">{d.detail}</p>
            </li>
          ))}
        </ul>
        {!lp.insight && (
          <p className="pd__why-note">Detailed launch metrics weren't recorded for this older product — shown as an overall read.</p>
        )}
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

function TradeSheet({ comp, onClose }: { comp: CompetitorState; onClose: () => void }) {
  const { state, buyShares, sellShares } = useGame();
  const [qty, setQty] = useState(1);
  const owned = state.holdings[comp.id] ?? 0;
  const cost = buyCost(comp.sharePrice, qty);
  const proceeds = sellProceeds(comp.sharePrice, qty);
  const canBuy = state.cash >= cost;
  const maxBuy = Math.floor(toDollars(state.cash) / (toDollars(cost) / qty || 1));

  return (
    <div className="trade">
      <div className="trade__head">
        <div>
          <h2 className="trade__title">{comp.name}</h2>
          <p className="trade__sub">{comp.blurb}</p>
        </div>
        <span className="trade__price rounded tnum">{format(cents(comp.sharePrice))}</span>
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${owned} sh`} />
        <StatPill label="Value" value={format(cents(owned * comp.sharePrice))} tone={owned > 0 ? "positive" : "neutral"} />
        <StatPill label="Rep" value={Math.round(comp.reputation)} tone={comp.reputation >= 60 ? "positive" : "neutral"} />
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
          onClick={() => { buyShares(comp.id, qty); haptic.success(); sfx("tap"); showToast(`Bought ${qty} ${comp.name}`, { tone: "positive" }); }}
        >
          Buy · {format(cost)}
        </Button>
        <Button
          block
          variant="secondary"
          disabled={owned <= 0}
          onClick={() => { const q = Math.min(qty, owned); sellShares(comp.id, q); haptic.light(); showToast(`Sold ${q} ${comp.name}`, { tone: "neutral" }); }}
        >
          Sell · {format(proceeds)}
        </Button>
      </div>
      {owned > 0 && (
        <Button block variant="tertiary" onClick={() => { sellShares(comp.id, owned); haptic.medium(); onClose(); }}>
          Sell all {owned}
        </Button>
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
          <p className="trade__sub">Sell a stake on the exchange for a cash infusion — you keep the rest.</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="Valuation" value={format(valuation)} tone="accent" />
        <StatPill label="You'll keep" value={`${Math.round(100 - pct)}%`} tone="positive" />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={5} max={BALANCE.ipo.maxStakePerSale * 100} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { listCompany(pct / 100); haptic.success(); sfx("era"); showToast(`${state.companyName} is now public!`, { tone: "positive", glyph: <Building2 size={15} /> }); onClose(); }}>
        Confirm IPO
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
          <p className="trade__sub">Cash out more of your stake (you'll keep at least 5%).</p>
        </div>
      </div>
      <div className="trade__row">
        <StatPill label="You own" value={`${Math.round(state.ownership * 100)}%`} />
        <StatPill label="After" value={`${Math.round(state.ownership * 100 - pct)}%`} />
      </div>
      <div className="trade__ipo-amount rounded tnum">+{format(dollars(Math.round(raised)))}</div>
      <Slider value={pct} min={1} max={Math.max(1, maxSell)} step={1} ariaLabel="Stake to sell" accent="var(--accent)" onChange={setPct} />
      <p className="trade__ipo-pct">Sell {Math.round(pct)}%</p>
      <Button block onClick={() => { sellOwnStake(pct / 100); haptic.success(); showToast(`Sold ${Math.round(pct)}% of ${state.companyName}`, { tone: "positive" }); onClose(); }}>
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
