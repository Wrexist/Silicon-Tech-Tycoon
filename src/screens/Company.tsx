import { useState } from "react";
import { ArrowUp, Award, BarChart3, Building2, ChevronRight, FlaskConical, PencilRuler, Megaphone, Rocket, Search, TrendingDown, Trophy, Users, X } from "lucide-react";
import { Button, Card, EmptyState, SectionHeader, Sheet, Stat, StatPill } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { AchievementsSheet } from "./Achievements.tsx";
import { ACHIEVEMENT_COUNT, ACHIEVEMENTS, deriveFacts } from "../engine/achievements.ts";
import { AchievementIcon } from "../design/achievementIcons.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { CategoryIcon, RoleIcon } from "../design/icons.tsx";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { RESEARCH_PROJECTS } from "../engine/research.ts";
import { assignedSkill, designCeiling, runwayWeeks, salaryFor, trainCost, weeklyPayroll, xpToNext } from "../engine/economy.ts";
import { disciplineOutput, xpMult, visionaryHype, perfectionistCeilingBonus } from "../engine/staff.ts";
import { cents, dollars, format, sub, toDollars } from "../engine/money.ts";
import { designCeilingBonus, marketingHype } from "../engine/upgrades.ts";
import {
  DISCIPLINE_LABEL,
  type Discipline,
  MOOD_LABEL,
  moodBand,
  MOOD_COLOR,
  SPECIALTY_TITLE,
  TRAIT_INFO,
} from "../engine/staff.ts";
import type { Assignment, Candidate, LaunchedProduct, RecruitTier, Staff, StaffRole } from "../engine/types.ts";
import type { Tab } from "../components/BottomNav.tsx";
import {
  burn,
  facilityRent,
  facility,
  nextWeekRevenue,
  weeklyEcosystemRevenue,
  weeklyRpGen,
  type GameState,
} from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import { Sparkline } from "../components/charts.tsx";
import type { CSSProperties } from "react";
import "./company.css";

const ROLE_LABEL: Record<StaffRole, string> = {
  engineer: "Engineer",
  designer: "Designer",
  marketer: "Marketer",
};

function runwayTone(weeks: number): "positive" | "negative" | "neutral" {
  if (weeks === Infinity) return "positive";
  if (weeks < 6) return "negative";
  return "neutral";
}

const ASSIGN_LABEL: Record<Assignment, string> = {
  rnd: "R&D",
  design: "Design",
  marketing: "Mkt",
  idle: "Idle",
};
// Which 0..100 discipline each assignment draws on (idle → none). Mirrors the engine mapping.
const ACTIVE_DISCIPLINE: Record<Assignment, Discipline | null> = {
  rnd: "engineering",
  design: "design",
  marketing: "marketing",
  idle: null,
};
const ASSIGN_COLOR: Record<Assignment, string> = {
  rnd: "var(--fn-eng)",
  design: "var(--fn-design)",
  marketing: "var(--fn-mkt)",
  idle: "var(--ink-3)",
};
// Maps a discipline back to the assignment that draws on it — used for best-fit suggestions.
const DISCIPLINE_TO_ASSIGN: Record<Discipline, Exclude<Assignment, "idle">> = {
  engineering: "rnd",
  design: "design",
  marketing: "marketing",
};
const ROLE_COLOR: Record<StaffRole, string> = {
  engineer: "var(--fn-eng)",
  designer: "var(--fn-design)",
  marketer: "var(--fn-mkt)",
};
const DISCIPLINE_COLOR: Record<Discipline, string> = {
  engineering: "var(--fn-eng)",
  design: "var(--fn-design)",
  marketing: "var(--fn-mkt)",
};

export function Company({ onNavigate }: { onNavigate?: (t: Tab) => void } = {}) {
  const { state, fire, assign, train, recruit, hireCandidate, dismissCandidates, giveRaise } = useGame();
  const [statsOpen, setStatsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const achievementCount = state.unlockedAchievements.length;
  const fac = facility(state);
  const wkBurn = burn(state);
  const wkPayroll = weeklyPayroll(state.staff);
  const wkRent = facilityRent(state);
  const wkRev = nextWeekRevenue(state);
  const ecoRev = weeklyEcosystemRevenue(state);
  const runway = runwayWeeks(state.cash, wkBurn, wkRev);
  const cashData = state.cashHistory.map((h) => h.cash);
  const activeSales = state.launched
    .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
    .map((lp) => ({
      lp,
      // v9+: production paid upfront — each unit sold brings full price into cash.
      weeklyRevenue: cents(lp.weeklyUnits[lp.weeksElapsed] * lp.product.price),
    }))
    .sort((a, b) => b.weeklyRevenue - a.weeklyRevenue);

  return (
    <div className="co">
      {/* Financials */}
      <Card>
        <SectionHeader
          title="Financials"
          accessory={
            <button className="co__stats-link" onClick={() => { haptic.light(); setStatsOpen(true); }} aria-label="View company stats">
              <BarChart3 size={14} /> Stats
            </button>
          }
        />
        <div className="co__fin-grid">
          <Stat label="Cash" value={<AnimatedMoney value={state.cash} />} />
          <Stat label="Weekly burn" value={format(wkBurn)} tone="negative" />
          <Stat label="Weekly income" value={format(wkRev)} tone="positive" />
          <Stat label="Research" value={`+${weeklyRpGen(state).toFixed(1)} RP`} tone="neutral" />
          {toDollars(ecoRev) > 0 && (
            <Stat label="Services" value={format(ecoRev)} tone="positive" hint="/wk" />
          )}
          <Stat
            label="Runway"
            value={runway === Infinity ? "Profitable" : `${runway} wk`}
            tone={runwayTone(runway)}
          />
          {(() => {
            const net = sub(wkRev, wkBurn);
            const netD = toDollars(net);
            return (
              <Stat
                label="Weekly net"
                value={`${netD >= 0 ? "+" : ""}${format(net)}`}
                tone={netD >= 0 ? "positive" : "negative"}
              />
            );
          })()}
          {state.staff.length > 0 && toDollars(wkRev) > 0 && (
            <Stat
              label="Rev / headcount"
              value={format(dollars(Math.round(toDollars(wkRev) / state.staff.length)))}
              tone="accent"
              hint="/wk"
            />
          )}
        </div>
        <div className="co__spark">
          <Sparkline data={cashData} stroke={state.cash >= 0 ? "var(--accent)" : "var(--negative)"} />
        </div>
        {wkBurn > 0 && (() => {
          const weeklyNet = toDollars(sub(wkRev, wkBurn));
          const weeks = 8;
          const bars: number[] = [];
          let cash = toDollars(state.cash);
          for (let i = 1; i <= weeks; i++) {
            cash += weeklyNet;
            bars.push(cash);
          }
          const peak = Math.max(...bars.map(Math.abs), 1);
          const netChange = bars[bars.length - 1] - toDollars(state.cash);
          return (
            <div className="co__proj" aria-label="Projected cash over next 8 weeks">
              <div className="co__proj-header">
                <span className="co__proj-label">Projected · 8 weeks</span>
                <span className={`co__proj-outcome tnum${netChange >= 0 ? " co__proj-outcome--pos" : " co__proj-outcome--neg"}`}>
                  {netChange >= 0 ? "+" : ""}{fmtRevShort(netChange)}
                </span>
              </div>
              <div className="co__proj-bars">
                {bars.map((v, i) => {
                  const pos = v >= 0;
                  const h = Math.round((Math.abs(v) / peak) * 100);
                  return (
                    <div key={i} className="co__proj-col">
                      <div className="co__proj-bar-wrap">
                        <div className={`co__proj-bar${pos ? "" : " co__proj-bar--neg"}`} style={{ height: `${Math.max(4, h)}%` }} />
                      </div>
                      <span className="co__proj-wk tnum">+{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {state.staff.length > 0 && (() => {
          const byRole: { label: string; pay: number; color: string }[] = [
            { label: "Eng", pay: state.staff.filter(s => s.role === "engineer").reduce((a, s) => a + toDollars(s.salary), 0), color: "var(--fn-eng)" },
            { label: "Design", pay: state.staff.filter(s => s.role === "designer").reduce((a, s) => a + toDollars(s.salary), 0), color: "var(--fn-design)" },
            { label: "Mkt", pay: state.staff.filter(s => s.role === "marketer").reduce((a, s) => a + toDollars(s.salary), 0), color: "var(--fn-mkt)" },
          ].filter(r => r.pay > 0);
          const multiRole = byRole.length >= 2;
          return (
            <div className="co__burn-breakdown">
              <span>Payroll {format(wkPayroll)} · Rent {format(wkRent)}/wk</span>
              {multiRole && (
                <span className="co__payroll-split">
                  {byRole.map((r, i) => (
                    <span key={r.label}>
                      {i > 0 && <span className="co__payroll-sep">·</span>}
                      <span style={{ color: r.color }}>{r.label}</span> {format(dollars(Math.round(r.pay)))}
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })()}
        {runway !== Infinity && runway <= 5 && (
          <p className="co__hint co__hint--urgent">
            {runway <= 2
              ? `Cash gone in ${runway} week${runway === 1 ? "" : "s"} — launch a product or let staff go.`
              : `${runway} weeks of runway — design and launch a product before the cash runs out.`}
          </p>
        )}
        {runway > 20 && fac.staffCapacity > state.staff.length && (
          <p className="co__hire-hint">
            {fac.staffCapacity - state.staff.length} open desk{fac.staffCapacity - state.staff.length > 1 ? "s" : ""} — runway supports a new hire
          </p>
        )}
        {state.launched.length > 0 && (
          <div className="co__track">
            {state.launched.slice(-16).map((lp) => (
              <span
                key={lp.product.id}
                className={`co__track-dot co__track-dot--${lp.verdict}`}
                title={`${lp.product.name}: ${lp.verdict}`}
              />
            ))}
            <span className="co__track-label">{state.launched.length} shipped</span>
          </div>
        )}
        <p className="co__hint">Lifetime revenue {format(state.cumulativeRevenue)}.</p>
      </Card>

      {/* Selling now */}
      {activeSales.length > 0 && (
        <Card>
          <SectionHeader title="Selling now" accessory={`${activeSales.length} active`} />
          <div className="co__active-list">
            {activeSales.map(({ lp, weeklyRevenue }) => {
              const totalWeeks = lp.weeklyUnits.length;
              const weeksLeft = totalWeeks - lp.weeksElapsed;
              const elapsedPct = totalWeeks > 0 ? Math.round((lp.weeksElapsed / totalWeeks) * 100) : 0;
              const nextIdx = lp.weeksElapsed + 1;
              const nextWkRevenue = nextIdx < totalWeeks
                ? cents(lp.weeklyUnits[nextIdx] * lp.product.price)
                : null;
              const trend = nextWkRevenue !== null ? Math.sign(nextWkRevenue - weeklyRevenue) : 0;
              const Row = onNavigate ? "button" : "div";
              return (
                <Row
                  key={lp.product.id}
                  className={`co__active-row${onNavigate ? " co__active-row--link" : ""}`}
                  {...(onNavigate ? { onClick: () => { haptic.light(); onNavigate("market"); } } : {})}
                  aria-label={onNavigate ? `View ${lp.product.name} on Market` : undefined}
                >
                  <span className="co__active-name">{lp.product.name}</span>
                  <span className="co__active-meta">
                    <span className="co__active-rev">{format(weeklyRevenue)}/wk</span>
                    {nextWkRevenue !== null && trend !== 0 && (
                      <span className={`co__active-trend co__active-trend--${trend > 0 ? "up" : "down"}`}>
                        {trend > 0 ? <ArrowUp size={10} aria-hidden /> : <TrendingDown size={10} aria-hidden />}
                        {format(nextWkRevenue)}
                      </span>
                    )}
                    <span className="co__active-eta">{weeksLeft} wk left</span>
                    {onNavigate && <ChevronRight size={12} className="co__active-chevron" aria-hidden />}
                  </span>
                  <div className="co__active-bar" aria-hidden>
                    <div className="co__active-bar-fill" style={{ width: `${elapsedPct}%` }} />
                  </div>
                </Row>
              );
            })}
          </div>
        </Card>
      )}

      {/* All-time top products */}
      {state.launched.length >= 2 && <TopProductsCard launched={state.launched} />}

      {/* Achievements entry */}
      <button className="co__ach-row" onClick={() => { haptic.light(); setAchievementsOpen(true); }} aria-label="View achievements">
        <span className="co__ach-glyph" aria-hidden><Award size={20} /></span>
        <span className="co__ach-info">
          <span className="co__ach-title">Achievements</span>
          <span className="co__ach-sub">Milestones on the road to an empire</span>
        </span>
        <span className="co__ach-count tnum">{achievementCount}<span className="co__ach-count-total">/{ACHIEVEMENT_COUNT}</span></span>
      </button>

      {/* Near-achievement progress */}
      <NearMilestonesCard state={state} />

      {/* Team output summary */}
      <TeamOutputCard state={state} />

      {/* Staff roster */}
      <Card>
        <SectionHeader title="Team" accessory={`${state.staff.length} member${state.staff.length === 1 ? "" : "s"}`} />
        {state.staff.length === 0 ? (
          <EmptyState glyph={<Users size={36} strokeWidth={1.6} />} title="No staff" sub="Hire your first team member below." />
        ) : (
          <ul className="co__roster">
            {state.staff.map((s) => (
              <Member key={s.id} s={s} cash={state.cash} era={state.era} onAssign={assign} onTrain={train} onFire={fire} onRaise={giveRaise} />
            ))}
          </ul>
        )}
      </Card>

      {/* Recruitment */}
      <SectionHeader title="Recruitment" accessory={`${state.staff.length}/${fac.staffCapacity} desks`} />
      {(() => {
        const nextFac = BALANCE.facilities[state.facilityTier]; // index = facilityTier (0-based array, tier is 1-based)
        if (!nextFac || state.staff.length < fac.staffCapacity) return null;
        return (
          <div className="co__fac-nudge">
            <Building2 size={15} className="co__fac-nudge-icon" aria-hidden />
            <span className="co__fac-nudge-text">
              <strong>At capacity</strong> — move to {nextFac.name} from HQ Upgrades to unlock {nextFac.staffCapacity} desks ({format(nextFac.upgradeCost)}).
            </span>
          </div>
        );
      })()}
      <RecruitPanel state={state} capacity={fac.staffCapacity} onRecruit={recruit} onHire={hireCandidate} onDismiss={dismissCandidates} />

      <Sheet open={statsOpen} onClose={() => setStatsOpen(false)}>
        <StatsSheet state={state} onClose={() => setStatsOpen(false)} />
      </Sheet>

      <Sheet open={achievementsOpen} onClose={() => setAchievementsOpen(false)}>
        <AchievementsSheet unlocked={state.unlockedAchievements} onClose={() => setAchievementsOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ---------- Near-milestone progress tracker ---------- */

function NearMilestonesCard({ state }: { state: GameState }) {
  const facts = deriveFacts(state);
  const unlocked = new Set(state.unlockedAchievements);

  // Map achievement id → [current, target] for achievements with numeric progress
  const prog: Partial<Record<string, [number, number]>> = {
    "first-ship": [facts.productsShipped, 1],
    "ship-5": [facts.productsShipped, 5],
    "ship-10": [facts.productsShipped, 10],
    "ship-25": [facts.productsShipped, 25],
    "ship-100": [facts.productsShipped, 100],
    "first-hit": [facts.hits, 1],
    "hat-trick": [facts.hitStreak, 3],
    "hit-streak-5": [facts.hitStreak, 5],
    "rev-1m": [facts.cumulativeRevenue, 1_000_000],
    "rev-10m": [facts.cumulativeRevenue, 10_000_000],
    "rev-100m": [facts.cumulativeRevenue, 100_000_000],
    "rev-500m": [facts.cumulativeRevenue, 500_000_000],
    "rev-1b": [facts.cumulativeRevenue, 1_000_000_000],
    "fans-10k": [facts.fans, 10_000],
    "fans-100k": [facts.fans, 100_000],
    "fans-1m": [facts.fans, 1_000_000],
    "rep-50": [facts.reputation, 50],
    "rep-75": [facts.reputation, 75],
    "rep-85": [facts.reputation, 85],
    "first-hire": [facts.staffCount, 2],
    "team-5": [facts.staffCount, 5],
    "team-10": [facts.staffCount, 10],
    "investor": [facts.rivalsInvested, 3],
    "all-rivals": [facts.rivalsInvested, 6],
    "first-research": [facts.completedProjects, 1],
    "research-4": [facts.completedProjects, 4],
    "research-all": [facts.completedProjects, RESEARCH_PROJECTS.length],
    "big-run": [facts.biggestRun, 50_000],
    "mega-run": [facts.biggestRun, 200_000],
    "networth-1m": [facts.netWorth, 1_000_000],
    "networth-10m": [facts.netWorth, 10_000_000],
    "networth-100m": [facts.netWorth, 100_000_000],
    "dual-category": [facts.categoriesShipped, 2],
    "diversified-mfg": [facts.categoriesShipped, 3],
    "flop-proof": [facts.productsShipped >= 10 && facts.flops === 0 ? 10 : facts.productsShipped, 10],
  };

  const candidates = ACHIEVEMENTS
    .filter((a) => !unlocked.has(a.id) && prog[a.id] !== undefined)
    .map((a) => {
      const [cur, target] = prog[a.id]!;
      const pct = Math.min(99, Math.round((cur / target) * 100));
      return { a, pct };
    })
    .filter(({ pct }) => pct >= 10)
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3);

  if (candidates.length === 0) return null;

  return (
    <Card className="co__near-ach">
      <SectionHeader title="Milestones within reach" />
      <div className="co__near-list">
        {candidates.map(({ a, pct }) => (
          <div key={a.id} className="co__near-row">
            <div className="co__near-head">
              <span className="co__near-icon" aria-hidden><AchievementIcon name={a.icon} size={14} strokeWidth={2.2} /></span>
              <span className="co__near-title">{a.title}</span>
              <span className="co__near-pct tnum">{pct}%</span>
            </div>
            <div className="co__near-track">
              <div className="co__near-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="co__near-hint">{a.hint}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Top products (all-time revenue leaderboard) ---------- */

type VerdictLabel = "Hit" | "Solid" | "Steady" | "Flop";
const VERDICT_LABEL: Record<string, VerdictLabel> = {
  hit: "Hit", solid: "Solid", steady: "Steady", flop: "Flop",
};
const VERDICT_TONE: Record<string, "positive" | "accent" | "negative"> = {
  hit: "positive", solid: "positive", steady: "accent", flop: "negative",
};

function TopProductsCard({ launched }: { launched: LaunchedProduct[] }) {
  const top = [...launched].sort((a, b) => b.revenueToDate - a.revenueToDate).slice(0, 5);
  return (
    <Card>
      <SectionHeader title="All-time leaders" accessory="by revenue" />
      <div className="co__top-list">
        {top.map((lp, i) => {
          const v = lp.verdict as string ?? "steady";
          return (
            <div key={lp.product.id} className="co__top-row">
              <span className="co__top-rank tnum">#{i + 1}</span>
              <span className="co__top-cat"><CategoryIcon id={lp.product.category} size={13} /></span>
              <span className="co__top-name">{lp.product.name}</span>
              <span className="co__top-meta">
                <StatPill value={VERDICT_LABEL[v] ?? "Steady"} tone={VERDICT_TONE[v] ?? "accent"} />
                <span className="co__top-rev tnum">{format(lp.revenueToDate)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function fmtRevShort(d: number): string {
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1_000) return `$${Math.round(d / 1_000)}k`;
  return `$${Math.round(d)}`;
}

/* ---------- Company stats / history ---------- */

function buildRevenueHistory(launched: LaunchedProduct[], cashHistory: { week: number; cash: number }[]): number[] {
  if (cashHistory.length < 2 || launched.length === 0) return [];
  const minWeek = cashHistory[0].week;
  const maxWeek = cashHistory[cashHistory.length - 1].week;
  const weeks = maxWeek - minWeek + 1;
  const history = new Array(weeks).fill(0);
  for (const lp of launched) {
    for (let i = 0; i < lp.weeklyUnits.length; i++) {
      const histIdx = lp.launchedWeek + i - minWeek;
      if (histIdx >= 0 && histIdx < weeks) {
        history[histIdx] += lp.weeklyUnits[i] * toDollars(lp.product.price);
      }
    }
  }
  return history;
}

function StatsSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  const launched = state.launched;
  const cashData = state.cashHistory.map((h) => h.cash);
  const revData = buildRevenueHistory(launched, state.cashHistory);
  const netWorth = state.cash;

  // Aggregates derived from existing tracked data (no invented engine state).
  const facts = deriveFacts(state);
  const productsShipped = launched.length;
  const unitsSold = launched.reduce((sum, lp) => sum + lp.unitsSold, 0);
  const hitsStrict = launched.filter((lp) => lp.verdict === "hit").length;
  const solids = launched.filter((lp) => lp.verdict === "solid").length;
  const hits = hitsStrict + solids;
  const flops = launched.filter((lp) => lp.verdict === "flop").length;
  const best = launched.reduce<LaunchedProduct | null>(
    (top, lp) => (top == null || lp.unitsSold > top.unitsSold ? lp : top),
    null,
  );
  const bestRevenue = launched.reduce<LaunchedProduct | null>(
    (top, lp) => (top == null || lp.revenueToDate > top.revenueToDate ? lp : top),
    null,
  );

  if (launched.length === 0) {
    return (
      <div className="co__stats">
        <div className="co__stats-hdr">
          <h2 className="co__stats-title">Company stats</h2>
          <button className="co__stats-x" onClick={() => { haptic.light(); onClose(); }} aria-label="Close"><X size={18} /></button>
        </div>
        <EmptyState
          glyph={<Rocket size={36} strokeWidth={1.6} />}
          title="No history yet"
          sub="Launch your first product to start building a track record."
          action={<Button variant="secondary" onClick={onClose}>Close</Button>}
        />
      </div>
    );
  }

  return (
    <div className="co__stats">
      <div className="co__stats-hdr">
        <h2 className="co__stats-title">Company stats</h2>
        <button className="co__stats-x" onClick={() => { haptic.light(); onClose(); }} aria-label="Close"><X size={18} /></button>
      </div>
      <p className="co__stats-sub">{state.companyName} · week {state.week}</p>

      <div className="co__stats-spark">
        <div className="co__stats-spark-cap">
          <span className="co__stats-spark-label">Cash over time</span>
          <span className="ds-stat__value tnum" style={{ color: netWorth >= 0 ? "var(--positive)" : "var(--negative)" }}>
            {format(netWorth)}
          </span>
        </div>
        <Sparkline data={cashData} stroke={netWorth >= 0 ? "var(--accent)" : "var(--negative)"} />
      </div>

      {revData.length >= 2 && (
        <div className="co__stats-spark">
          <div className="co__stats-spark-cap">
            <span className="co__stats-spark-label">Weekly revenue</span>
            <span className="ds-stat__value tnum" style={{ color: "var(--positive)" }}>
              {format(state.cumulativeRevenue)}
            </span>
          </div>
          <Sparkline data={revData} stroke="var(--positive)" />
        </div>
      )}

      {best && (
        <div className="co__stats-best">
          <span className="co__stats-best-glyph" aria-hidden><Trophy size={20} /></span>
          <div className="co__stats-best-info">
            <span className="co__stats-best-label">Top seller</span>
            <span className="co__stats-best-name">{best.product.name}</span>
            <span className="co__stats-best-sub">{best.unitsSold.toLocaleString()} units</span>
          </div>
          {bestRevenue && bestRevenue.product.id !== best.product.id && (
            <div className="co__stats-best-info">
              <span className="co__stats-best-label">Top revenue</span>
              <span className="co__stats-best-name">{bestRevenue.product.name}</span>
              <span className="co__stats-best-sub">{format(bestRevenue.revenueToDate)}</span>
            </div>
          )}
        </div>
      )}

      {launched.length >= 2 && (() => {
        let bestLaunchScore = 0;
        let bestScoreName = "";
        for (const lp of launched) {
          if (lp.launchScore > bestLaunchScore) {
            bestLaunchScore = lp.launchScore;
            bestScoreName = lp.product.name;
          }
        }
        let peakWkRev = 0;
        let peakWkName = "";
        for (const lp of launched) {
          for (const units of lp.weeklyUnits) {
            const rev = units * toDollars(lp.product.price);
            if (rev > peakWkRev) { peakWkRev = rev; peakWkName = lp.product.name; }
          }
        }
        return (
          <div className="co__stats-bests">
            <p className="co__stats-bests-title">Personal bests</p>
            <div className="co__stats-bests-grid">
              {bestLaunchScore > 0 && (
                <div className="co__stats-best-item">
                  <span className="co__stats-best-item-val tnum">{Math.round(bestLaunchScore)}</span>
                  <span className="co__stats-best-item-label">Best launch score</span>
                  <span className="co__stats-best-item-sub">{bestScoreName}</span>
                </div>
              )}
              {peakWkRev > 0 && (
                <div className="co__stats-best-item">
                  <span className="co__stats-best-item-val tnum">{fmtRevShort(peakWkRev)}</span>
                  <span className="co__stats-best-item-label">Peak weekly rev</span>
                  <span className="co__stats-best-item-sub">{peakWkName}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="co__stats-grid">
        <Stat label="Lifetime revenue" value={format(state.cumulativeRevenue)} tone="positive" />
        <Stat label="Units sold" value={unitsSold.toLocaleString()} />
        <Stat label="Products shipped" value={productsShipped} />
        <Stat label="Hits / solid / flops" value={`${hitsStrict} / ${solids} / ${flops}`} tone={hits >= flops ? "positive" : "negative"} />
        <Stat label="Reputation" value={`${Math.round(state.reputation)}`} hint="out of 100" tone="accent" />
        <Stat label="Fans" value={state.fans.toLocaleString()} />
        {facts.hitStreak >= 2 && <Stat label="Hit streak" value={String(facts.hitStreak)} tone="positive" hint="consecutive hits" />}
        <Stat label="Research projects" value={`${state.completedProjects.length}/${RESEARCH_PROJECTS.length}`} tone={state.completedProjects.length >= 6 ? "positive" : "neutral"} />
      </div>

      <Button block onClick={onClose}>Done</Button>
    </div>
  );
}

/* ---------- Team output summary ---------- */

function TeamOutputCard({ state }: { state: GameState }) {
  if (state.staff.length === 0) return null;
  const rndCount = state.staff.filter((s) => s.assignment === "rnd").length;
  const designCount = state.staff.filter((s) => s.assignment === "design").length;
  const mktCount = state.staff.filter((s) => s.assignment === "marketing").length;
  const idleCount = state.staff.filter((s) => s.assignment === "idle").length;
  const rpPerWk = weeklyRpGen(state);
  const mktSkill = assignedSkill(state.staff, "marketing");
  const ceil =
    designCeiling(assignedSkill(state.staff, "design")) +
    designCeilingBonus(state.upgrades) +
    perfectionistCeilingBonus(state.staff);
  const hypeBonus = Math.round(mktSkill * 5 + visionaryHype(state.staff) * 100 + marketingHype(state.upgrades) * 100);
  type FnRow = { label: string; count: number; metric: string; color: string; Icon: typeof FlaskConical };
  const rows: FnRow[] = [
    { label: "R&D", count: rndCount, metric: rndCount > 0 ? `+${rpPerWk.toFixed(1)} RP/wk` : "no output", color: "var(--fn-eng)", Icon: FlaskConical },
    { label: "Design", count: designCount, metric: `tier ${ceil} ceiling`, color: "var(--fn-design)", Icon: PencilRuler },
    { label: "Marketing", count: mktCount, metric: mktCount > 0 ? `+${hypeBonus}% hype` : "no output", color: "var(--fn-mkt)", Icon: Megaphone },
  ];
  const avgMood = state.staff.length > 0
    ? Math.round(state.staff.reduce((s, p) => s + p.mood, 0) / state.staff.length)
    : 0;
  const moodBandVal = moodBand(avgMood);
  const moodColor = MOOD_COLOR[moodBandVal];

  return (
    <Card>
      <SectionHeader
        title="Team output"
        accessory={
          <span className="co__morale-chip" style={{ color: moodColor }}>
            <span className="co__morale-dot" style={{ background: moodColor }} />
            {MOOD_LABEL[moodBandVal]} morale
          </span>
        }
      />
      <div className="co__output-grid">
        {rows.map((r) => (
          <div key={r.label} className="co__output-fn" style={{ "--co-fn-color": r.color } as CSSProperties}>
            <span className="co__output-fn-icon"><r.Icon size={14} /></span>
            <span className="co__output-fn-label">{r.label}</span>
            <span className="co__output-fn-count tnum">{r.count}</span>
            <span className="co__output-fn-metric">{r.metric}</span>
          </div>
        ))}
      </div>
      {/* Staff allocation bar — proportional coloured strip */}
      {(() => {
        const segs = [
          { label: "R&D", count: rndCount, color: "var(--fn-eng)" },
          { label: "Design", count: designCount, color: "var(--fn-design)" },
          { label: "Mkt", count: mktCount, color: "var(--fn-mkt)" },
          { label: "Idle", count: idleCount, color: "var(--ink-3)" },
        ].filter((s) => s.count > 0);
        if (segs.length === 0) return null;
        return (
          <div className="co__alloc-bar" aria-label="Staff allocation">
            {segs.map((seg) => (
              <div
                key={seg.label}
                className="co__alloc-seg"
                style={{ flex: seg.count, background: seg.color }}
                title={`${seg.label}: ${seg.count}`}
              />
            ))}
          </div>
        );
      })()}
      {idleCount > 0 && (
        <p className="co__output-idle">{idleCount} staff idle — assign them to a function to generate output.</p>
      )}
      {(() => {
        const soonest = state.staff
          .filter((s) => s.skill < BALANCE.staff.maxSkill)
          .map((s) => {
            const weeklyXpRate = (s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask) * xpMult(s.trait);
            if (weeklyXpRate <= 0) return null;
            const weeksToLevel = Math.ceil((xpToNext(s.skill) - s.xp) / weeklyXpRate);
            return { name: s.name, weeksToLevel, skill: s.skill };
          })
          .filter(Boolean)
          .sort((a, b) => a!.weeksToLevel - b!.weeksToLevel)[0];
        if (!soonest) return null;
        return (
          <p className="co__output-levelup">
            Next level-up: <strong>{soonest.name}</strong> reaches skill {soonest.skill + 1} in ~{soonest.weeksToLevel} week{soonest.weeksToLevel !== 1 ? "s" : ""}.
          </p>
        );
      })()}
      {state.staff.length > 0 && avgMood < 55 && (() => {
        const amenitiesLvl = state.upgrades.amenities ?? 0;
        const recentFlops = state.launched.slice(-3).filter((lp) => lp.verdict === "flop").length;
        if (amenitiesLvl === 0) {
          return (
            <p className="co__output-levelup co__output-mood-warn">
              {avgMood < 30 ? "Morale critically low" : "Morale is low"} — upgrading <strong>Amenities</strong> in HQ will help.
            </p>
          );
        }
        if (recentFlops >= 2) {
          return (
            <p className="co__output-levelup co__output-mood-warn">
              Recent flops are weighing on the team — landing a hit will bounce morale back.
            </p>
          );
        }
        return null;
      })()}
    </Card>
  );
}

const ASSIGNMENTS: Assignment[] = ["rnd", "design", "marketing", "idle"];

function Member({
  s,
  cash,
  era,
  onAssign,
  onTrain,
  onFire,
  onRaise,
}: {
  s: Staff;
  cash: number;
  era: number;
  onAssign: (id: string, a: Assignment) => void;
  onTrain: (id: string) => void;
  onFire: (id: string) => void;
  onRaise: (id: string) => void;
}) {
  const maxed = s.skill >= BALANCE.staff.maxSkill;
  const cost = trainCost(s.skill);
  const xpPct = maxed ? 100 : Math.min(100, Math.round((s.xp / xpToNext(s.skill)) * 100));
  const weeklyXpRate = maxed ? 0 : (s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask) * xpMult(s.trait);
  const weeksToLevel = !maxed && weeklyXpRate > 0 ? Math.ceil((xpToNext(s.skill) - s.xp) / weeklyXpRate) : null;
  const band = moodBand(s.mood);
  // Best-fit: find the discipline this person scores highest in. Only flag a misfit when their
  // current assignment uses a different, weaker discipline AND a genuinely better slot exists —
  // never suggest the assignment they're already on (e.g. an Engineer on R&D told to "try R&D").
  const activeDisc = ACTIVE_DISCIPLINE[s.assignment];
  const fitScore = activeDisc !== null ? s.skills[activeDisc] : 100;
  const bestFitDisc = (["engineering", "design", "marketing"] as Discipline[]).reduce(
    (top, d) => s.skills[d] > s.skills[top] ? d : top, "engineering" as Discipline,
  );
  const bestFitAssign = DISCIPLINE_TO_ASSIGN[bestFitDisc];
  const isMisfit =
    s.assignment !== "idle" && fitScore < 40 && bestFitAssign !== s.assignment && s.skills[bestFitDisc] > fitScore + 4;
  const marketSalary = s.id !== "s0" ? salaryFor(s.role, s.skill) : s.salary;
  const isUnderpaid = s.id !== "s0" && toDollars(s.salary) < toDollars(marketSalary);
  const moodLowWks = s.moodLowWeeks ?? 0;
  const isLowMood = moodLowWks >= 3;
  const quitRiskWeeks = Math.max(0, BALANCE.churn.weeksUntilQuitRisk - moodLowWks);
  return (
    <li className="co__member-card">
      <div className="co__member-top">
        <Avatar appearance={s.appearance} mood={s.mood} size={46} />
        <div className="co__member-info">
          <span className="co__member-name">{s.name}</span>
          <span className="co__member-role">{ROLE_LABEL[s.role]} · {SPECIALTY_TITLE[s.specialty]}</span>
          <span className="co__member-sub">{format(s.salary)}/wk</span>
        </div>
        {s.id !== "s0" && (
          <button className="co__fire" onClick={() => { haptic.medium(); sfx("error"); showToast(`${s.name} let go`); onFire(s.id); }} aria-label={`Let go ${s.name}`}>
            <X size={15} />
          </button>
        )}
      </div>

      <div className="co__tags">
        <span className="co__tag co__tag--trait" style={{ color: ROLE_COLOR[s.role] }} title={TRAIT_INFO[s.trait].blurb}>
          <RoleIcon role={s.role} size={12} /> {TRAIT_INFO[s.trait].label}
        </span>
        <span className="co__tag" style={{ color: MOOD_COLOR[band] }}>
          <span className="co__tag-dot" style={{ background: MOOD_COLOR[band] }} /> {MOOD_LABEL[band]}
        </span>
        {isUnderpaid && (
          <span className="co__tag co__tag--warn" title={`Market rate: ${format(marketSalary)}/wk`}>
            <TrendingDown size={11} aria-hidden /> Wants raise
          </span>
        )}
        {isLowMood && (
          <span className="co__tag co__tag--burnout">
            Burnout risk · {quitRiskWeeks <= 1 ? "1 wk" : `${quitRiskWeeks} wk`}
          </span>
        )}
      </div>
      <div className="co__mood-bar" aria-label={`Morale ${Math.round(s.mood)}%`}>
        <div className="co__mood-bar-fill" style={{ width: `${s.mood}%`, background: MOOD_COLOR[band] }} />
      </div>

      {/* per-discipline skills (0..100) — the active one (matching their assignment) is highlighted */}
      <div className="co__cand-skills">
        {(["engineering", "design", "marketing"] as Discipline[]).map((d) => {
          const active = ACTIVE_DISCIPLINE[s.assignment] === d;
          return (
            <div key={d} className="co__cand-skill" style={active ? undefined : { opacity: 0.5 }}>
              <span className="co__cand-skill-label">{DISCIPLINE_LABEL[d]}</span>
              <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${s.skills[d]}%`, background: DISCIPLINE_COLOR[d] }} /></span>
              <span className="co__cand-skill-num tnum">{s.skills[d]}</span>
            </div>
          );
        })}
      </div>

      <div className="co__xp">
        <div className="co__xp-head">
          <span>Skill {s.skill}{maxed ? " (max)" : ""}</span>
          {!maxed && (
            <span className="co__xp-next tnum">
              {xpPct}%{weeksToLevel !== null ? <span className="co__xp-eta"> · ~{weeksToLevel} wk</span> : null}
            </span>
          )}
        </div>
        <div className="co__xp-track"><div className="co__xp-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>

      <div className="co__member-actions">
        <div className="co__assign">
          {ASSIGNMENTS.map((a) => (
            <button
              key={a}
              className={`co__assign-opt${s.assignment === a ? " co__assign-opt--on" : ""}${isMisfit && s.assignment === a ? " co__assign-opt--misfit" : ""}`}
              style={s.assignment === a ? { background: ASSIGN_COLOR[a] } : undefined}
              aria-pressed={s.assignment === a}
              aria-label={`Assign ${s.name} to ${ASSIGN_LABEL[a]}`}
              onClick={() => { haptic.light(); onAssign(s.id, a); }}
            >
              {ASSIGN_LABEL[a]}
            </button>
          ))}
        </div>
        <Button size="sm" variant={cash >= cost && !maxed ? "secondary" : "tertiary"} disabled={maxed || cash < cost} onClick={() => { haptic.success(); sfx("levelup"); showToast(`${s.name} trained to level ${s.skill + 1}`, { tone: "positive" }); onTrain(s.id); }}>
          <ArrowUp size={13} /> {maxed ? "Maxed" : `Lv ${s.skill + 1} · ${format(cost)}`}
        </Button>
      </div>
      {isMisfit && (
        <p className="co__fit-hint">
          Low {DISCIPLINE_LABEL[activeDisc!]} fit · try <strong>{ASSIGN_LABEL[bestFitAssign]}</strong> for better output
        </p>
      )}
      {s.assignment !== "idle" && (() => {
        const disc = ACTIVE_DISCIPLINE[s.assignment]!;
        const dOut = disciplineOutput(s, disc);
        let label = "";
        if (s.assignment === "rnd") {
          const eraLen = BALANCE.research.eraMultiplier.length;
          const eraMult = BALANCE.research.eraMultiplier[Math.max(1, Math.min(era, eraLen)) - 1];
          const per = s.role === "engineer" ? BALANCE.research.rpPerEngineerSkill : BALANCE.research.rpPerAssignedResearcher;
          label = `+${(dOut * per * eraMult).toFixed(1)} RP/wk`;
        } else if (s.assignment === "design") {
          label = `+${dOut.toFixed(1)} design pts`;
        } else if (s.assignment === "marketing") {
          label = `+${Math.round(dOut * 5)}% launch hype`;
        }
        return label ? <p className="co__member-contrib">{label}</p> : null;
      })()}
      {isUnderpaid && (
        <button className="co__raise-btn" onClick={() => { haptic.success(); sfx("cash"); showToast(`${s.name}'s salary raised to ${format(marketSalary)}/wk`, { tone: "positive" }); onRaise(s.id); }}>
          <ArrowUp size={12} aria-hidden /> Raise to {format(marketSalary)}/wk
        </button>
      )}
    </li>
  );
}

// Recruitment: open a paid search → after a couple of weeks a shortlist of varied applicants
// arrives → sign whoever fits (if there's a free desk + cash).
function RecruitPanel({
  state,
  capacity,
  onRecruit,
  onHire,
  onDismiss,
}: {
  state: GameState;
  capacity: number;
  onRecruit: (tier: RecruitTier) => void;
  onHire: (id: string) => void;
  onDismiss: () => void;
}) {
  const full = state.staff.length >= capacity;

  // Searching…
  if (state.recruitment) {
    const wl = state.recruitment.weeksLeft;
    const label = BALANCE.recruitment.tiers[state.recruitment.tier].label;
    return (
      <Card>
        <div className="co__hire-head">
          <span className="co__member-glyph" aria-hidden style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}><Search size={18} /></span>
          <div className="co__member-info">
            <span className="co__member-name">{label} search…</span>
            <span className="co__member-role">{wl} week{wl === 1 ? "" : "s"} until the shortlist arrives</span>
          </div>
        </div>
        <p className="co__hint">Advance the weeks to interview candidates.</p>
      </Card>
    );
  }

  // Shortlist ready
  if (state.candidates.length) {
    const weeksLeft = Math.max(0, state.candidatesExpire - state.week);
    const urgent = weeksLeft <= 2;
    return (
      <>
        <p className={urgent ? "co__hint co__hint--urgent" : "co__hint"}>
          {full ? "At capacity — free up a desk to sign someone. " : ""}
          {urgent
            ? `Shortlist expires in ${weeksLeft} week${weeksLeft === 1 ? "" : "s"} — decide now.`
            : `Shortlist available for ${weeksLeft} more week${weeksLeft === 1 ? "" : "s"}.`}
        </p>
        {state.candidates.map((c) => (
          <CandidateCard key={c.id} c={c} canHire={!full && state.cash >= c.hireFee} onHire={() => onHire(c.id)} />
        ))}
        <Button size="sm" variant="tertiary" onClick={() => { haptic.light(); onDismiss(); }}>Dismiss shortlist</Button>
      </>
    );
  }

  // Idle — pick a channel
  return (
    <Card>
      <div className="co__hire-head">
        <span className="co__member-glyph" aria-hidden style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}><Search size={18} /></span>
        <div className="co__member-info">
          <span className="co__member-name">Find new talent</span>
          <span className="co__member-role">Run a search · {BALANCE.recruitment.candidates} candidates each</span>
        </div>
      </div>
      <div className="co__recruit-tiers">
        {(["board", "headhunter"] as RecruitTier[]).map((tier) => {
          const t = BALANCE.recruitment.tiers[tier];
          const affordable = state.cash >= t.cost;
          return (
            <button
              key={tier}
              className="co__recruit-tier"
              disabled={!affordable}
              onClick={() => { haptic.light(); sfx("tap"); showToast(`${t.label} search started — results in ${t.weeks} weeks`, { tone: "neutral" }); onRecruit(tier); }}
            >
              <span className="co__recruit-tier-name">{t.label}</span>
              <span className="co__recruit-tier-meta">{t.weeks} wks · skill {t.minLevel}–{t.maxLevel}</span>
              <span className="co__recruit-tier-cost">{format(t.cost)}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CandidateCard({ c, canHire, onHire }: { c: Candidate; canHire: boolean; onHire: () => void }) {
  const { state } = useGame();
  const disciplines: Discipline[] = ["engineering", "design", "marketing"];

  // Projected contribution in natural role (engineer→R&D, designer→Design, marketer→Marketing)
  const moodM = 0.82 + (Math.max(0, Math.min(100, c.mood)) / 100) * 0.36;
  const traitM = c.trait === "hustler" ? 1.2 : c.trait === "veteran" ? 1.05 : 1;
  const projContrib = (() => {
    if (c.role === "engineer") {
      const dOut = (c.skills.engineering / 10) * moodM * traitM;
      const eraIdx = Math.max(1, Math.min(state.era, BALANCE.research.eraMultiplier.length)) - 1;
      const eraMult = BALANCE.research.eraMultiplier[eraIdx];
      const per = BALANCE.research.rpPerEngineerSkill;
      return `+${(dOut * per * eraMult).toFixed(1)} RP/wk in R&D`;
    }
    if (c.role === "designer") {
      const dOut = (c.skills.design / 10) * moodM * traitM;
      return `+${dOut.toFixed(1)} design pts in Design`;
    }
    if (c.role === "marketer") {
      const dOut = (c.skills.marketing / 10) * moodM * traitM;
      return `+${Math.round(dOut * 5)}% launch hype in Marketing`;
    }
    return null;
  })();

  return (
    <Card>
      <div className="co__hire-head">
        <Avatar appearance={c.appearance} mood={c.mood} size={46} />
        <div className="co__member-info">
          <span className="co__member-name">{c.name} · {ROLE_LABEL[c.role]}</span>
          <span className="co__member-role">{SPECIALTY_TITLE[c.specialty]} · {TRAIT_INFO[c.trait].label}</span>
        </div>
        <span className="co__cand-level tnum">Lv {c.skill}</span>
      </div>
      <div className="co__cand-skills">
        {disciplines.map((d) => (
          <div key={d} className="co__cand-skill">
            <span className="co__cand-skill-label">{DISCIPLINE_LABEL[d]}</span>
            <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${c.skills[d]}%`, background: DISCIPLINE_COLOR[d] }} /></span>
            <span className="co__cand-skill-num tnum">{c.skills[d]}</span>
          </div>
        ))}
      </div>
      {projContrib && <p className="co__cand-contrib">{projContrib}</p>}
      <div className="co__hire-controls">
        <div>
          <span className="co__hint">{format(c.salary)}/wk salary · {TRAIT_INFO[c.trait].blurb}</span>
          {toDollars(c.hireFee) > 0 && toDollars(c.salary) > 0 && (() => {
            const feeWeeks = Math.round(toDollars(c.hireFee) / toDollars(c.salary));
            if (feeWeeks < 2) return null;
            return <span className="co__cand-fee-hint">Sign fee ≈ {feeWeeks} wk salary</span>;
          })()}
        </div>
        <Button size="sm" variant={canHire ? "primary" : "tertiary"} disabled={!canHire} onClick={() => { haptic.success(); sfx("levelup"); showToast(`${c.name} joined the team`, { tone: "positive" }); onHire(); }}>Sign · {format(c.hireFee)}</Button>
      </div>
    </Card>
  );
}
