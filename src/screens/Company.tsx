import { useState } from "react";
import { ArrowUp, Award, BarChart3, Minus, Plus, Rocket, Trophy, Users, X } from "lucide-react";
import { Button, Card, EmptyState, SectionHeader, Sheet, Stat } from "../design/primitives.tsx";
import { AchievementsSheet } from "./Achievements.tsx";
import { ACHIEVEMENT_COUNT } from "../engine/achievements.ts";
import { Avatar } from "../components/Avatar.tsx";
import { RoleIcon } from "../design/icons.tsx";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { runwayWeeks, salaryFor, trainCost, xpToNext } from "../engine/economy.ts";
import { format } from "../engine/money.ts";
import {
  MOOD_LABEL,
  moodBand,
  MOOD_COLOR,
  SPECIALTY_TITLE,
  TRAIT_INFO,
} from "../engine/staff.ts";
import type { Assignment, LaunchedProduct, Staff, StaffRole } from "../engine/types.ts";
import {
  burn,
  facility,
  hireCostFor,
  nextWeekRevenue,
  weeklyRpGen,
  type GameState,
} from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import { Sparkline } from "../components/charts.tsx";
import "./company.css";

const ROLE_LABEL: Record<StaffRole, string> = {
  engineer: "Engineer",
  designer: "Designer",
  marketer: "Marketer",
};
const ROLE_EFFECT: Record<StaffRole, string> = {
  engineer: "Cheaper, faster R&D",
  designer: "Raises Design ceiling",
  marketer: "More launch hype",
};
const NAMES = ["Riley", "Sam", "Jordan", "Casey", "Ari", "Noa", "Quinn", "Devin", "Max", "Robin"];

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
const ASSIGN_COLOR: Record<Assignment, string> = {
  rnd: "var(--fn-eng)",
  design: "var(--fn-design)",
  marketing: "var(--fn-mkt)",
  idle: "var(--ink-3)",
};
const ROLE_COLOR: Record<StaffRole, string> = {
  engineer: "var(--fn-eng)",
  designer: "var(--fn-design)",
  marketer: "var(--fn-mkt)",
};

export function Company() {
  const { state, hire, fire, assign, train } = useGame();
  const [statsOpen, setStatsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const achievementCount = state.unlockedAchievements.length;
  const fac = facility(state);
  const wkBurn = burn(state);
  const wkRev = nextWeekRevenue(state);
  const runway = runwayWeeks(state.cash, wkBurn, wkRev);
  const cashData = state.cashHistory.map((h) => h.cash);

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
        </div>
        <div className="co__spark">
          <Sparkline data={cashData} stroke={state.cash >= 0 ? "var(--accent)" : "var(--negative)"} />
        </div>
        <p className="co__hint">Lifetime revenue {format(state.cumulativeRevenue)}.</p>
      </Card>

      {/* Achievements entry */}
      <button className="co__ach-row" onClick={() => setAchievementsOpen(true)} aria-label="View achievements">
        <span className="co__ach-glyph" aria-hidden><Award size={20} /></span>
        <span className="co__ach-info">
          <span className="co__ach-title">Achievements</span>
          <span className="co__ach-sub">Milestones on the road to an empire</span>
        </span>
        <span className="co__ach-count tnum">{achievementCount}<span className="co__ach-count-total">/{ACHIEVEMENT_COUNT}</span></span>
      </button>

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

      {/* Hiring */}
      <SectionHeader title="Hire" accessory={state.staff.length >= fac.staffCapacity ? "at capacity" : undefined} />
      {(["engineer", "designer", "marketer"] as StaffRole[]).map((role) => (
        <HireCard key={role} role={role} state={state} onHire={hire} capacity={fac.staffCapacity} />
      ))}

      <Sheet open={statsOpen} onClose={() => setStatsOpen(false)}>
        <StatsSheet state={state} onClose={() => setStatsOpen(false)} />
      </Sheet>

      <Sheet open={achievementsOpen} onClose={() => setAchievementsOpen(false)}>
        <AchievementsSheet unlocked={state.unlockedAchievements} onClose={() => setAchievementsOpen(false)} />
      </Sheet>
    </div>
  );
}

/* ---------- Company stats / history ---------- */

function StatsSheet({ state, onClose }: { state: GameState; onClose: () => void }) {
  const launched = state.launched;
  const cashData = state.cashHistory.map((h) => h.cash);
  const netWorth = state.cash;

  // Aggregates derived from existing tracked data (no invented engine state).
  const productsShipped = launched.length;
  const unitsSold = launched.reduce((sum, lp) => sum + lp.unitsSold, 0);
  const hits = launched.filter((lp) => lp.verdict === "hit").length;
  const flops = launched.filter((lp) => lp.verdict === "flop").length;
  const best = launched.reduce<LaunchedProduct | null>(
    (top, lp) => (top == null || lp.unitsSold > top.unitsSold ? lp : top),
    null,
  );

  if (launched.length === 0) {
    return (
      <div className="co__stats">
        <h2 className="co__stats-title">Company stats</h2>
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
      <h2 className="co__stats-title">Company stats</h2>
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

      {best && (
        <div className="co__stats-best">
          <span className="co__stats-best-glyph" aria-hidden><Trophy size={20} /></span>
          <div className="co__stats-best-info">
            <span className="co__stats-best-label">Best seller</span>
            <span className="co__stats-best-name">{best.product.name}</span>
            <span className="co__stats-best-sub">{best.unitsSold.toLocaleString()} units · {format(best.revenueToDate)}</span>
          </div>
        </div>
      )}

      <div className="co__stats-grid">
        <Stat label="Lifetime revenue" value={format(state.cumulativeRevenue)} tone="positive" />
        <Stat label="Units sold" value={unitsSold.toLocaleString()} />
        <Stat label="Products shipped" value={productsShipped} />
        <Stat label="Hits / flops" value={`${hits} / ${flops}`} tone={hits >= flops ? "positive" : "negative"} />
        <Stat label="Reputation" value={`${Math.round(state.reputation)}`} hint="out of 100" tone="accent" />
        <Stat label="Fans" value={state.fans.toLocaleString()} />
      </div>

      <Button block onClick={onClose}>Done</Button>
    </div>
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
  const band = moodBand(s.mood);
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

      <div className="co__xp">
        <div className="co__xp-head">
          <span>Skill {s.skill}{maxed ? " (max)" : ""}</span>
          {!maxed && <span className="co__xp-next tnum">{xpPct}%</span>}
        </div>
        <div className="co__xp-track"><div className="co__xp-fill" style={{ width: `${xpPct}%` }} /></div>
      </div>

      <div className="co__member-actions">
        <div className="co__assign">
          {ASSIGNMENTS.map((a) => (
            <button
              key={a}
              className={`co__assign-opt${s.assignment === a ? " co__assign-opt--on" : ""}`}
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
    </li>
  );
}

function HireCard({
  role,
  state,
  onHire,
  capacity,
}: {
  role: StaffRole;
  state: GameState;
  onHire: (role: StaffRole, skill: number, name: string) => void;
  capacity: number;
}) {
  const [skill, setSkill] = useState(3);
  const fee = hireCostFor(role, skill);
  const salary = salaryFor(role, skill);
  const full = state.staff.length >= capacity;
  const affordable = state.cash >= fee && !full;

  return (
    <Card>
      <div className="co__hire-head">
        <span className="co__member-glyph" aria-hidden style={{ background: "color-mix(in srgb, " + ROLE_COLOR[role] + " 16%, transparent)", color: ROLE_COLOR[role] }}><RoleIcon role={role} /></span>
        <div className="co__member-info">
          <span className="co__member-name">{ROLE_LABEL[role]}</span>
          <span className="co__member-role">{ROLE_EFFECT[role]}</span>
        </div>
      </div>
      <div className="co__hire-controls">
        <div className="co__skill">
          <button onClick={() => setSkill((s) => Math.max(1, s - 1))} disabled={skill <= 1} aria-label="Lower skill"><Minus size={15} /></button>
          <span className="tnum">Skill {skill}</span>
          <button onClick={() => setSkill((s) => Math.min(10, s + 1))} disabled={skill >= 10} aria-label="Higher skill"><Plus size={15} /></button>
        </div>
        <Button
          size="sm"
          variant={affordable ? "primary" : "tertiary"}
          disabled={!affordable}
          onClick={() => onHire(role, skill, NAMES[(state.staffCounter + skill) % NAMES.length])}
        >
          Hire · {format(fee)}
        </Button>
      </div>
      <p className="co__hint">Then {format(salary)}/wk salary.</p>
    </Card>
  );
}
