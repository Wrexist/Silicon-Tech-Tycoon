import { useState } from "react";
import { ArrowUp, Award, BarChart3, FlaskConical, PencilRuler, Megaphone, Rocket, Search, Trophy, Users, X } from "lucide-react";
import { Button, Card, EmptyState, SectionHeader, Sheet, Stat, StatPill } from "../design/primitives.tsx";
import { AchievementsSheet } from "./Achievements.tsx";
import { ACHIEVEMENT_COUNT, deriveFacts } from "../engine/achievements.ts";
import { Avatar } from "../components/Avatar.tsx";
import { CategoryIcon, RoleIcon } from "../design/icons.tsx";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { RESEARCH_PROJECTS } from "../engine/research.ts";
import { assignedSkill, designCeiling, runwayWeeks, trainCost, weeklyPayroll, xpToNext } from "../engine/economy.ts";
import { xpMult, visionaryHype, perfectionistCeilingBonus } from "../engine/staff.ts";
import { cents, format, sub, toDollars } from "../engine/money.ts";
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
import {
  burn,
  facilityRent,
  facility,
  nextWeekRevenue,
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

export function Company() {
  const { state, fire, assign, train, recruit, hireCandidate, dismissCandidates } = useGame();
  const [statsOpen, setStatsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const achievementCount = state.unlockedAchievements.length;
  const fac = facility(state);
  const wkBurn = burn(state);
  const wkPayroll = weeklyPayroll(state.staff);
  const wkRent = facilityRent(state);
  const wkRev = nextWeekRevenue(state);
  const runway = runwayWeeks(state.cash, wkBurn, wkRev);
  const cashData = state.cashHistory.map((h) => h.cash);
  const activeSales = state.launched
    .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
    .map((lp) => ({
      lp,
      weeklyRevenue: cents(lp.weeklyUnits[lp.weeksElapsed] * (lp.product.price - lp.unitCost)),
    }))
    .sort((a, b) => b.weeklyRevenue - a.weeklyRevenue);

  return (
    <div className="co">
      {/* Financials */}
      <Card>
        <SectionHeader
          title="Financials"
          accessory={
            <button className="co__stats-link" onClick={() => setStatsOpen(true)} aria-label="View company stats">
              <BarChart3 size={14} /> Stats
            </button>
          }
        />
        <div className="co__fin-grid">
          <Stat label="Cash" value={<AnimatedMoney value={state.cash} />} />
          <Stat label="Weekly burn" value={format(wkBurn)} tone="negative" />
          <Stat label="Weekly income" value={format(wkRev)} tone="positive" />
          <Stat label="Research" value={`+${weeklyRpGen(state).toFixed(1)} RP`} tone="neutral" />
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
        </div>
        <div className="co__spark">
          <Sparkline data={cashData} stroke={state.cash >= 0 ? "var(--accent)" : "var(--negative)"} />
        </div>
        {state.staff.length > 0 && (
          <p className="co__burn-breakdown">
            Payroll {format(wkPayroll)} · Rent {format(wkRent)} weekly
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
              const weeksLeft = lp.weeklyUnits.length - lp.weeksElapsed;
              return (
                <div key={lp.product.id} className="co__active-row">
                  <span className="co__active-name">{lp.product.name}</span>
                  <span className="co__active-meta">
                    <span className="co__active-rev">{format(weeklyRevenue)}/wk</span>
                    <span className="co__active-eta">{weeksLeft} wk left</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* All-time top products */}
      {state.launched.length >= 2 && <TopProductsCard launched={state.launched} />}

      {/* Achievements entry */}
      <button className="co__ach-row" onClick={() => setAchievementsOpen(true)} aria-label="View achievements">
        <span className="co__ach-glyph" aria-hidden><Award size={20} /></span>
        <span className="co__ach-info">
          <span className="co__ach-title">Achievements</span>
          <span className="co__ach-sub">Milestones on the road to an empire</span>
        </span>
        <span className="co__ach-count tnum">{achievementCount}<span className="co__ach-count-total">/{ACHIEVEMENT_COUNT}</span></span>
      </button>

      {/* Team output summary */}
      <TeamOutputCard state={state} />

      {/* Staff roster */}
      <Card>
        <SectionHeader title="Team" accessory={`${state.staff.length} people`} />
        {state.staff.length === 0 ? (
          <EmptyState glyph={<Users size={36} strokeWidth={1.6} />} title="No staff" sub="Hire your first team member below." />
        ) : (
          <ul className="co__roster">
            {state.staff.map((s) => (
              <Member key={s.id} s={s} cash={state.cash} onAssign={assign} onTrain={train} onFire={fire} />
            ))}
          </ul>
        )}
      </Card>

      {/* Recruitment */}
      <SectionHeader title="Recruitment" accessory={`${state.staff.length}/${fac.staffCapacity} desks`} />
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
          <button className="co__stats-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
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
        <button className="co__stats-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--fs-caption)", fontWeight: 600, color: moodColor }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: moodColor, display: "inline-block", flexShrink: 0 }} />
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
      {idleCount > 0 && (
        <p className="co__output-idle">{idleCount} staff idle — assign them to a function to generate output.</p>
      )}
    </Card>
  );
}

const ASSIGNMENTS: Assignment[] = ["rnd", "design", "marketing", "idle"];

function Member({
  s,
  cash,
  onAssign,
  onTrain,
  onFire,
}: {
  s: Staff;
  cash: number;
  onAssign: (id: string, a: Assignment) => void;
  onTrain: (id: string) => void;
  onFire: (id: string) => void;
}) {
  const maxed = s.skill >= BALANCE.staff.maxSkill;
  const cost = trainCost(s.skill);
  const xpPct = maxed ? 100 : Math.min(100, Math.round((s.xp / xpToNext(s.skill)) * 100));
  const weeklyXpRate = maxed ? 0 : (s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask) * xpMult(s.trait);
  const weeksToLevel = !maxed && weeklyXpRate > 0 ? Math.ceil((xpToNext(s.skill) - s.xp) / weeklyXpRate) : null;
  const band = moodBand(s.mood);
  // Best-fit: find the discipline this person scores highest in, then check if their current
  // assignment uses a different (weaker) discipline — flag it if the fit score is below 40.
  const activeDisc = ACTIVE_DISCIPLINE[s.assignment];
  const fitScore = activeDisc !== null ? s.skills[activeDisc] : 100;
  const isMisfit = s.assignment !== "idle" && fitScore < 40;
  const bestFitDisc = (["engineering", "design", "marketing"] as Discipline[]).reduce(
    (top, d) => s.skills[d] > s.skills[top] ? d : top, "engineering" as Discipline,
  );
  const bestFitAssign = DISCIPLINE_TO_ASSIGN[bestFitDisc];
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
          <button className="co__fire" onClick={() => onFire(s.id)} aria-label={`Let go ${s.name}`}>
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
      </div>

      {/* per-discipline skills (0..100) — the active one (matching their assignment) is highlighted */}
      <div className="co__cand-skills">
        {(["engineering", "design", "marketing"] as Discipline[]).map((d) => {
          const active = ACTIVE_DISCIPLINE[s.assignment] === d;
          return (
            <div key={d} className="co__cand-skill" style={active ? undefined : { opacity: 0.5 }}>
              <span className="co__cand-skill-label">{DISCIPLINE_LABEL[d]}</span>
              <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${s.skills[d]}%`, background: active ? ROLE_COLOR[s.role] : "var(--ink-3)" }} /></span>
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
              {xpPct}%{weeksToLevel !== null ? <span className="co__xp-eta"> · ~{weeksToLevel}wk</span> : null}
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
              onClick={() => onAssign(s.id, a)}
            >
              {ASSIGN_LABEL[a]}
            </button>
          ))}
        </div>
        <Button size="sm" variant={cash >= cost && !maxed ? "secondary" : "tertiary"} disabled={maxed || cash < cost} onClick={() => onTrain(s.id)}>
          <ArrowUp size={13} /> {maxed ? "Max" : format(cost)}
        </Button>
      </div>
      {isMisfit && (
        <p className="co__fit-hint">
          Low {DISCIPLINE_LABEL[activeDisc!]} fit · try <strong>{ASSIGN_LABEL[bestFitAssign]}</strong> for better output
        </p>
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
    return (
      <>
        <p className="co__hint">
          {full ? "At capacity — free up a desk to sign someone. " : ""}
          Shortlist available for {weeksLeft} more week{weeksLeft === 1 ? "" : "s"}.
        </p>
        {state.candidates.map((c) => (
          <CandidateCard key={c.id} c={c} canHire={!full && state.cash >= c.hireFee} onHire={() => onHire(c.id)} />
        ))}
        <Button size="sm" variant="tertiary" onClick={onDismiss}>Dismiss shortlist</Button>
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
              onClick={() => onRecruit(tier)}
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
  const disciplines: Discipline[] = ["engineering", "design", "marketing"];
  return (
    <Card>
      <div className="co__hire-head">
        <span className="co__member-glyph" aria-hidden style={{ background: "color-mix(in srgb, " + ROLE_COLOR[c.role] + " 16%, transparent)", color: ROLE_COLOR[c.role] }}><RoleIcon role={c.role} /></span>
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
            <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${c.skills[d]}%`, background: ROLE_COLOR[c.role] }} /></span>
            <span className="co__cand-skill-num tnum">{c.skills[d]}</span>
          </div>
        ))}
      </div>
      <div className="co__hire-controls">
        <span className="co__hint">{format(c.salary)}/wk salary · {TRAIT_INFO[c.trait].blurb}</span>
        <Button size="sm" variant={canHire ? "primary" : "tertiary"} disabled={!canHire} onClick={onHire}>Sign · {format(c.hireFee)}</Button>
      </div>
    </Card>
  );
}
