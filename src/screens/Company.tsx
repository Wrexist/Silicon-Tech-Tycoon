import { useState } from "react";
import { ArrowUp, BarChart3, Boxes, Building2, Coffee, Factory, FlaskConical, GraduationCap, Landmark, Layers, PencilRuler, Megaphone, Rocket, Search, Smile, Sparkles, TrendingDown, Trophy, Users, Wand2, X } from "lucide-react";
import { Button, Card, EmptyState, SectionHeader, Sheet, Slider, Stat, StatPill } from "../design/primitives.tsx";
import { PlatformSheet } from "./Platform.tsx";
import { osDisplayName, canFoundPlatform, platformFoundingCost, navAttention } from "../state/gameState.ts";
import { ACHIEVEMENTS, deriveFacts } from "../engine/achievements.ts";
import { AchievementIcon } from "../design/achievementIcons.tsx";
import { Avatar } from "../components/Avatar.tsx";
import { CategoryIcon, RoleIcon } from "../design/icons.tsx";
import { AnimatedMoney } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { RESEARCH_PROJECTS, projectById, hasProject } from "../engine/research.ts";
import { acquirableFactories, factoryFor, totalFactoryUpkeep } from "../engine/factories.ts";
import type { FactoryId } from "../engine/types.ts";
import { assignedSkill, designCeiling, runwayWeeks, salaryFor, trainCost, weeklyPayroll, xpToNext } from "../engine/economy.ts";
import { disciplineOutput, xpMult, visionaryHype, perfectionistCeilingBonus } from "../engine/staff.ts";
import { cents, dollars, format, formatShortDollars, sub, toDollars } from "../engine/money.ts";
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
  canAutoAssign,
  canAutoResearch,
  DELEGATION_REQ,
  specialistHireFee,
  SPECIALIST_SKILL,
  deskCapacity,
  facilityRent,
  facility,
  loanCreditAvailable,
  loanRateNow,
  moraleCost,
  canBoostMorale,
  type MoraleKind,
  nextWeekRevenue,
  restCost,
  weeklyEcosystemRevenue,
  weeklyOutflow,
  weeklyRpGen,
  type GameState,
} from "../state/gameState.ts";
import { totalDebt, weeklyDebtService, weeklyPaymentFor } from "../engine/financing.ts";
import { isDisciplineLead, mentorshipXpMult } from "../engine/org.ts";
import { useGame } from "../state/useGame.tsx";
import { Sparkline } from "../components/charts.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { Celebration } from "../design/Celebration.tsx";
import type { CSSProperties } from "react";
import "./company.css";

const ROLE_LABEL: Record<StaffRole, string> = {
  engineer: "Engineer",
  designer: "Designer",
  marketer: "Marketer",
  hr: "People Lead",
  researcher: "Lead Researcher",
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
  researcher: "var(--fn-eng)",
  hr: "var(--accent)",
};
const DISCIPLINE_COLOR: Record<Discipline, string> = {
  engineering: "var(--fn-eng)",
  design: "var(--fn-design)",
  marketing: "var(--fn-mkt)",
};

export function Company() {
  const { state, fire, assign, train, recruit, hireCandidate, dismissCandidates, giveRaise, rest, setAutomation, hireSpecialist, foundPlatform, acquireFactory } = useGame();
  const [foundedCelebrate, setFoundedCelebrate] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Company is three destinations, not one endless scroll: Overview (money + ops), Team (roster,
  // morale, hiring) and Platform — the OS division promoted from a buried one-line card to a
  // first-class tab, since it's a whole business in its own right late game.
  const [coTab, setCoTab] = useState<"overview" | "team" | "platform">("overview");
  const fac = facility(state);
  // Progressive disclosure: the meta/progression layer (achievements, scenarios, challenges,
  // museum, the Platform-founding goal) only appears once the player has shipped their first
  // product — or is a returning prestige founder — so a day-one garage isn't buried under
  // systems before the core design→launch loop is learned.
  const hasShipped = state.launched.length >= 1 || state.legacy > 0;
  const wkBurn = burn(state); // operating burn only (payroll + rent + lines) — for the itemised view
  const wkOut = weeklyOutflow(state); // the TRUE weekly outflow: burn + loan debt service
  const wkDebt = sub(wkOut, wkBurn); // debt service alone, for the breakdown line
  const wkPayroll = weeklyPayroll(state.staff);
  const wkRent = facilityRent(state);
  const wkUpkeep = totalFactoryUpkeep(state.ownedFactories);
  const wkRev = nextWeekRevenue(state);
  const ecoRev = weeklyEcosystemRevenue(state);
  const runway = runwayWeeks(state.cash, wkOut, wkRev);
  const cashData = state.cashHistory.map((h) => h.cash);
  // Margin, not revenue (units × (price − unitCost)) — labelled "profit/wk" in the row so it
  // can't be confused with the revenue/wk figures HQ Performance and Market show for the same
  // product (units × price).
  const activeSales = state.launched
    .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
    .map((lp) => ({
      lp,
      weeklyProfit: cents(lp.weeklyUnits[lp.weeksElapsed] * (lp.product.price - lp.unitCost)),
    }))
    .sort((a, b) => b.weeklyProfit - a.weeklyProfit);

  return (
    <div className="co">
      {/* Sub-navigation — three destinations so Company isn't one endless scroll, and Platform gets
          the prominence a whole-business feature deserves. */}
      <div className="co__subnav" role="tablist" aria-label="Company sections">
        {([["overview", "Overview"], ["team", "Team"], ["platform", "Platform"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={coTab === id}
            className={`co__subtab${coTab === id ? " co__subtab--on" : ""}`}
            onClick={() => { haptic.light(); setCoTab(id); }}
          >
            {id === "platform" && <Layers size={14} aria-hidden />}{label}
            {id === "platform" && navAttention(state).company && <span className="co__subtab-dot" aria-hidden />}
          </button>
        ))}
      </div>

      {coTab === "overview" && (<>
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
          {toDollars(ecoRev) > 0 && (
            <Stat label="Services" value={format(ecoRev)} tone="positive" hint="/wk" />
          )}
          <Stat
            label="Runway"
            value={runway === Infinity ? "Profitable" : `${runway} wk`}
            tone={runwayTone(runway)}
          />
          {(() => {
            const net = sub(wkRev, wkOut); // net of the FULL outflow, so it agrees with Runway
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
        {toDollars(wkOut) > 0 && (() => {
          const weeklyNet = toDollars(sub(wkRev, wkOut));
          const weeks = 8;
          const bars: number[] = [];
          let cash = toDollars(state.cash);
          for (let i = 1; i <= weeks; i++) {
            cash += weeklyNet;
            bars.push(cash);
          }
          const peak = Math.max(...bars.map(Math.abs), 1);
          return (
            <div className="co__proj" aria-label="Projected cash over next 8 weeks">
              <span className="co__proj-label">Projected · 8 weeks</span>
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
        {(state.staff.length > 0 || wkUpkeep > 0 || toDollars(wkDebt) > 0) && (
          <p className="co__burn-breakdown">
            Payroll {format(wkPayroll)} · Rent {format(wkRent)}{wkUpkeep > 0 ? ` · Lines ${format(wkUpkeep)}` : ""}{toDollars(wkDebt) > 0 ? ` · Debt ${format(wkDebt)}` : ""} weekly
          </p>
        )}
        {(() => {
          const openDesks = Math.min(fac.staffCapacity, deskCapacity(state)) - state.staff.length;
          return runway > 20 && openDesks > 0 && (
            <p className="co__hire-hint">
              {openDesks} open desk{openDesks > 1 ? "s" : ""}, runway supports a new hire
            </p>
          );
        })()}
        {state.launched.length > 0 && (
          <div className="co__track">
            {state.launched.slice(-16).map((lp) => {
              // verdict is absent on older saves — fall back so the dot + accessible name never
              // read "undefined" (matches the `?? "steady"` default used elsewhere on this screen).
              const verdict = lp.verdict ?? "steady";
              return (
                <span
                  key={lp.product.id}
                  className={`co__track-dot co__track-dot--${verdict}`}
                  role="img"
                  aria-label={`${lp.product.name}: ${verdict}`}
                  title={`${lp.product.name}: ${verdict}`}
                />
              );
            })}
            <span className="co__track-label">{state.launched.length} shipped</span>
          </div>
        )}
        <p className="co__hint">Lifetime revenue {format(state.cumulativeRevenue)}.</p>
      </Card>

      {/* Financing — borrow to extend runway or fund a bet; pay it back weekly (Track C) */}
      {(hasShipped || (state.loans?.length ?? 0) > 0 || (runway !== Infinity && runway <= 30)) && (
        <FinancingCard state={state} />
      )}

      {/* Selling now */}
      {activeSales.length > 0 && (
        <Card>
          <SectionHeader title="Selling now" accessory={`${activeSales.length} active`} />
          <div className="co__active-list">
            {activeSales.map(({ lp, weeklyProfit }) => {
              const weeksLeft = lp.weeklyUnits.length - lp.weeksElapsed;
              const nextIdx = lp.weeksElapsed + 1;
              const nextWkProfit = nextIdx < lp.weeklyUnits.length
                ? cents(lp.weeklyUnits[nextIdx] * (lp.product.price - lp.unitCost))
                : null;
              const trend = nextWkProfit !== null ? Math.sign(nextWkProfit - weeklyProfit) : 0;
              return (
                <div key={lp.product.id} className="co__active-row">
                  <span className="co__active-name">{lp.product.name}</span>
                  <span className="co__active-meta">
                    <span className={`co__active-rev${toDollars(weeklyProfit) < 0 ? " co__active-rev--neg" : ""}`}>{format(weeklyProfit)} profit/wk</span>
                    {nextWkProfit !== null && trend !== 0 && (
                      <span className={`co__active-trend co__active-trend--${trend > 0 ? "up" : "down"}`}>
                        {trend > 0 ? <ArrowUp size={10} aria-hidden /> : <TrendingDown size={10} aria-hidden />}
                        {format(nextWkProfit)}
                      </span>
                    )}
                    <span className="co__active-eta">{weeksLeft} wk left</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Operations — owned manufacturing lines (engine/factories.ts) */}
      <OperationsSection state={state} onAcquire={acquireFactory} />

      {/* All-time top products */}
      {state.launched.length >= 2 && <TopProductsCard launched={state.launched} />}

      {/* Achievements · Scenarios · Challenges · Device Museum moved to the Progress hub (HUD
          trophy) so this tab is just money + team + ops. Platform stays — it's an ops division. */}

      {/* Near-achievement progress — only once the player is chasing milestones (post first ship). */}
      {hasShipped && <NearMilestonesCard state={state} />}
      </>)}

      {coTab === "team" && (<>
      {/* Team output summary */}
      <TeamOutputCard state={state} />

      {/* Team morale — a proactive, company-wide spend vs. saving cash (Track C) */}
      {(hasShipped || state.staff.length >= 2) && <MoraleCard state={state} />}

      {/* Staff roster */}
      <Card>
        <SectionHeader title="Team" accessory={`${state.staff.length} ${state.staff.length === 1 ? "bot" : "bots"}`} />
        {state.staff.length === 0 ? (
          <EmptyState glyph={<Users size={36} strokeWidth={1.6} />} title="No staff" sub="Hire your first team member below." />
        ) : (
          <ul className="co__roster">
            {state.staff.map((s) => (
              <Member key={s.id} s={s} staff={state.staff} cash={state.cash} era={state.era} onAssign={assign} onTrain={train} onFire={fire} onRaise={giveRaise} onRest={rest} />
            ))}
          </ul>
        )}
      </Card>

      {/* Delegation — only surfaced once it's relevant: a growing team, an eligible lead, or already
          in use. Keeps it off a day-one garage where it would just be a dead, fully-locked card. */}
      {(state.staff.length >= 2 || canAutoAssign(state) || canAutoResearch(state) || state.automation.autoAssign || state.automation.autoResearch
        || hasProject(state.completedProjects, DELEGATION_REQ.autoAssign.project) || hasProject(state.completedProjects, DELEGATION_REQ.autoResearch.project)) && (
        <DelegationCard state={state} onToggle={setAutomation} onHireSpecialist={hireSpecialist} />
      )}

      {/* Recruitment — seats are PLACED desks: you hire into a desk you actually bought. */}
      <SectionHeader title="Recruitment" accessory={`${state.staff.length}/${deskCapacity(state)} desks`} />
      {(() => {
        const nextFac = BALANCE.facilities[state.facilityTier]; // index = facilityTier (0-based array, tier is 1-based)
        if (!nextFac || state.staff.length < fac.staffCapacity) return null;
        return (
          <div className="co__fac-nudge">
            <Building2 size={15} className="co__fac-nudge-icon" aria-hidden />
            <span className="co__fac-nudge-text">
              <strong>At facility capacity</strong>. Move to {nextFac.name} from Office upgrades to make room for more staff ({format(nextFac.upgradeCost)}).
            </span>
          </div>
        );
      })()}
      {state.staff.length >= deskCapacity(state) && state.staff.length < fac.staffCapacity && (
        <div className="co__fac-nudge">
          <PencilRuler size={15} className="co__fac-nudge-icon" aria-hidden />
          <span className="co__fac-nudge-text">
            <strong>Every desk is taken</strong>. Buy a desk on the Office tab (in the Shop)
            and your next hire sits down at it.
          </span>
        </div>
      )}
      <RecruitPanel state={state} capacity={Math.min(fac.staffCapacity, deskCapacity(state))} noDesk={state.staff.length >= deskCapacity(state)} onRecruit={recruit} onHire={hireCandidate} onDismiss={dismissCandidates} />
      </>)}

      {coTab === "platform" && (
        state.platformUnlocked ? (
          <PlatformSheet onClose={() => setCoTab("overview")} />
        ) : hasShipped ? (() => {
          const cost = platformFoundingCost();
          const can = canFoundPlatform(state);
          const shortBy = sub(cost, state.cash);
          return (
            <Card className="co__found">
              <div className="co__found-head">
                <span className="co__found-glyph" aria-hidden><Layers size={22} /></span>
                <div className="co__found-info">
                  <span className="co__found-title">Found the Platform division</span>
                  <span className="co__found-sub">Turn {osDisplayName(state)} into a business in its own right: recurring services, OS licensing to rivals, feature modules, and a platform identity.</span>
                </div>
              </div>
              <Button
                block
                variant={can ? "primary" : "tertiary"}
                disabled={!can}
                onClick={() => { haptic.success(); foundPlatform(); setFoundedCelebrate(true); }}
              >
                {can ? <>Found · {format(cost)}</> : <>Save up {format(shortBy)} more · {format(cost)}</>}
              </Button>
            </Card>
          );
        })() : (
          <EmptyState glyph={<Layers size={36} strokeWidth={1.6} />} title="Platform locked" sub="Ship your first product, then found your OS as a business in its own right — services, licensing and feature modules." />
        )
      )}

      <Sheet open={statsOpen} onClose={() => setStatsOpen(false)} label="Company stats">
        <StatsSheet state={state} onClose={() => setStatsOpen(false)} />
      </Sheet>

      {foundedCelebrate && (
        <Celebration
          eyebrow="Division founded"
          title={`${osDisplayName(state)} is live`}
          sub="Your operating system is now a business in its own right. Shape its identity, ship versions, build features, and license it to the industry."
          icon={<Layers size={32} />}
          chips={[
            { icon: <Sparkles size={14} />, value: "New", label: "OS philosophy" },
            { icon: <Boxes size={14} />, value: "8", label: "feature modules" },
          ]}
          confirmLabel="Open the division"
          onConfirm={() => { setFoundedCelebrate(false); setCoTab("platform"); }}
          secondaryLabel="Later"
          onSecondary={() => setFoundedCelebrate(false)}
        />
      )}

    </div>
  );
}

/* ---------- Financing (Track C) ---------- */

/** Debt financing: borrow against revenue + reputation to extend runway or fund a bet, repaid weekly.
 *  Good reputation earns a cheaper rate; leverage makes it pricier. A loan is a real bet — it can buy
 *  the runway to land a launch, or sink you faster if the bet misses. */
function FinancingCard({ state }: { state: GameState }) {
  const { takeLoan, repayLoan } = useGame();
  const loans = state.loans ?? [];
  const debt = totalDebt(loans);
  const service = weeklyDebtService(loans);
  const available = Math.floor(toDollars(loanCreditAvailable(state))); // whole dollars of headroom
  const apr = Math.round(loanRateNow(state) * 52 * 100);
  const minLoan = BALANCE.financing.minLoan / 100; // dollars
  const canBorrow = available >= minLoan && !state.bankrupt;
  // Interactive borrow slider: pick any amount between the minimum and the live credit limit, with a
  // running preview of the weekly repayment. Snapped to a tidy step that scales with the headroom.
  const step = Math.max(5_000, Math.round(available / 40 / 5_000) * 5_000);
  const [rawAmount, setRawAmount] = useState(100_000);
  const amount = Math.min(Math.max(rawAmount, minLoan), Math.max(minLoan, available));
  const weeklyPay = weeklyPaymentFor(amount * 100, loanRateNow(state), BALANCE.financing.termWeeks);
  return (
    <Card>
      <SectionHeader title="Financing" accessory={<span className="co__stats-link"><Landmark size={14} /> Debt</span>} />
      {debt > 0 ? (
        <>
          <div className="co__fin-grid">
            <Stat label="Outstanding debt" value={format(cents(Math.round(debt)))} tone="negative" tile />
            <Stat label="Weekly service" value={format(cents(service))} tone="negative" hint="/wk" tile />
          </div>
          <div className="co__loan-list">
            {loans.map((l) => {
              const payoff = cents(Math.round(l.balance));
              const paidFrac = Math.max(0, Math.min(1, 1 - l.balance / Math.max(1, l.principal)));
              return (
                <div key={l.id} className="co__loan-row">
                  <div className="co__loan-info">
                    <span className="co__loan-bal">{format(payoff)}</span>
                    <span className="co__loan-meta">{format(cents(l.weeklyPayment))}/wk · {Math.round(l.ratePerWeek * 52 * 100)}% APR</span>
                    {/* every other wait in the game has a bar — the climb out of debt deserves one */}
                    <span className="co__loan-track" role="progressbar" aria-valuenow={Math.round(paidFrac * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Loan repaid">
                      <span className="co__loan-fill" style={{ width: `${Math.round(paidFrac * 100)}%` }} />
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={state.cash < payoff}
                    haptics="none"
                    onClick={() => {
                      repayLoan(l.id);
                      haptic.success();
                      sfx("cash");
                      showToast(`Loan cleared — ${format(cents(l.weeklyPayment))}/wk freed up`, { tone: "positive", glyph: <Landmark size={15} /> });
                    }}
                  >
                    Pay off
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="co__hint">No debt. Borrow to extend runway or fund a launch, repaid weekly over a year.</p>
      )}
      {canBorrow ? (
        <div className="co__borrow">
          <div className="co__borrow-head">
            <div className="co__borrow-amount tnum">{formatShortDollars(amount)}</div>
            <div className="co__borrow-credit">of {formatShortDollars(available)} · ~{apr}% APR</div>
          </div>
          <Slider
            value={amount}
            min={minLoan}
            max={Math.max(minLoan, available)}
            step={step}
            ariaLabel="Loan amount"
            onChange={setRawAmount}
          />
          <div className="co__borrow-preview">
            <Landmark size={13} aria-hidden />
            <span>
              You receive <b className="tnum">{formatShortDollars(Math.round(amount * (1 - BALANCE.financing.originationFee)))}</b>
              {BALANCE.financing.originationFee > 0 ? ` after a ${Math.round(BALANCE.financing.originationFee * 100)}% fee` : ""},
              repay <b className="tnum">{format(cents(weeklyPay))}</b>/wk for {BALANCE.financing.termWeeks} wks
            </span>
          </div>
          <Button block variant="primary" onClick={() => { takeLoan(amount * 100); haptic.success(); sfx("cash"); }}>
            Borrow {formatShortDollars(amount)}
          </Button>
        </div>
      ) : debt > 0 ? (
        <p className="co__hint">Credit maxed out, pay down debt to borrow again.</p>
      ) : (
        // No debt AND no headroom: say WHY borrowing is unavailable instead of a silent dead end.
        <p className="co__hint">
          Your credit line grows with revenue and reputation — it unlocks at a {formatShortDollars(minLoan)} minimum loan.
        </p>
      )}
    </Card>
  );
}

/* ---------- Team morale (Track C) ---------- */

/** A proactive, company-wide morale lever: a bonus or an offsite lifts the whole team's mood (which
 *  raises output and makes them harder to poach), for a payroll-scaled cost on a cooldown. The spend-
 *  vs-save decision, opposite the reactive per-person Rest. */
function MoraleCard({ state }: { state: GameState }) {
  const { boostMorale } = useGame();
  const avg = state.staff.length
    ? Math.round(state.staff.reduce((a, s) => a + s.mood, 0) / state.staff.length)
    : 0;
  const band = moodBand(avg);
  const cooldownLeft = Math.max(0, (state.moraleCooldownUntil ?? 0) - state.week);
  const options: { kind: MoraleKind; label: string; lift: number }[] = [
    { kind: "bonus", label: "Team bonus", lift: BALANCE.morale.bonusMoodLift },
    { kind: "offsite", label: "Company offsite", lift: BALANCE.morale.offsiteMoodLift },
  ];
  return (
    <Card>
      <SectionHeader
        title="Team morale"
        accessory={<span className="co__stats-link" style={{ color: MOOD_COLOR[band] }}><Smile size={14} /> {MOOD_LABEL[band]}</span>}
      />
      <div className="co__morale-bar" role="img" aria-label={`Average mood ${avg} of 100`}>
        <div className="co__morale-fill" style={{ width: `${avg}%`, background: MOOD_COLOR[band] }} />
      </div>
      <p className="co__hint">Average mood {avg}/100. Happy teams build faster and are harder to poach.</p>
      {cooldownLeft > 0 ? (
        <p className="co__hint">Next company morale spend available in {cooldownLeft} wk.</p>
      ) : (
        <div className="co__loan-presets">
          {options.map((o) => (
            <Button
              key={o.kind}
              variant={o.kind === "offsite" ? "primary" : "secondary"}
              disabled={!canBoostMorale(state, o.kind)}
              haptics="none"
              onClick={() => {
                boostMorale(o.kind);
                haptic.success();
                sfx("confirm");
                showToast(`${o.label} — team mood +${o.lift}`, { tone: "positive", glyph: <Smile size={15} /> });
              }}
            >
              {o.label} · +{o.lift} · {format(moraleCost(state, o.kind))}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Near-milestone progress tracker ---------- */

/** Delegation card (Epic E): toggles that automate repetitive ops. Each is a premium, EARNED
 *  capability: open a research division (high RP), then recruit the specialist who runs it (their
 *  salary is the standing weekly cost), so the player moves from operator to decider deliberately.
 *  Pre-gating saves keep whatever they already had on (grandfathered). */
function DelegationCard({
  state,
  onToggle,
  onHireSpecialist,
}: {
  state: GameState;
  onToggle: (patch: Partial<GameState["automation"]>) => void;
  onHireSpecialist: (which: "autoAssign" | "autoResearch") => void;
}) {
  const rows: { key: "autoAssign" | "autoResearch"; icon: typeof Wand2; label: string; sub: string; can: boolean; perk?: string }[] = [
    {
      key: "autoAssign",
      icon: Wand2,
      label: "Auto-assign staff",
      sub: "Idle hires are put on their discipline each week, never a wasted seat.",
      can: canAutoAssign(state),
      perk: "Your People Lead also keeps the whole team happy and heads off burnout.",
    },
    {
      key: "autoResearch",
      icon: Sparkles,
      label: "Auto-research",
      sub: "Claim the cheapest affordable project each week. You can still research by hand.",
      can: canAutoResearch(state),
    },
  ];
  const seats = Math.min(facility(state).staffCapacity, deskCapacity(state));
  return (
    <Card>
      <SectionHeader title="Delegation" accessory="Ops" />
      <div className="co__deleg">
        {rows.map((r) => {
          const enabled = state.automation[r.key];
          const req = DELEGATION_REQ[r.key];
          const project = projectById(req.project);
          const hasDivision = hasProject(state.completedProjects, req.project);
          const roleLabel = ROLE_LABEL[req.role];
          // Stage of the unlock ladder this row sits at.
          const needsDivision = !r.can && !hasDivision;
          const needsHire = !r.can && hasDivision;
          const fee = specialistHireFee(state, r.key);
          const salary = salaryFor(req.role, SPECIALIST_SKILL);
          const seatFree = state.staff.length < seats;
          const canHire = seatFree && state.cash >= fee;
          return (
            <div key={r.key} className={`co__deleg-row${needsDivision ? " co__deleg-row--locked" : ""}`}>
              <span className="co__deleg-icon"><r.icon size={17} /></span>
              <div className="co__deleg-text">
                <span className="co__deleg-label">{r.label}</span>
                <span className="co__deleg-sub">
                  {r.can
                    ? r.sub
                    : needsDivision
                      ? <>Research <b>{project.name}</b> ({project.rpCost} RP) to open this division.</>
                      : enabled
                        ? <>Paused — recruit a {roleLabel} to resume it.</>
                        : <><b>{project.name}</b> is open. Recruit a {roleLabel} to run it.</>}
                </span>
                {needsHire && (
                  <button
                    className="co__deleg-hire"
                    disabled={!canHire}
                    onClick={() => { haptic.medium(); onHireSpecialist(r.key); }}
                  >
                    <RoleIcon role={req.role} size={13} />
                    <span>Recruit {roleLabel}</span>
                    <span className="co__deleg-hire-cost">{format(fee)} + {format(salary)}/wk</span>
                  </button>
                )}
                {needsHire && !canHire && (
                  <span className="co__deleg-gate">{seatFree ? "Not enough cash to sign them." : "Buy a desk on the Office tab to seat them."}</span>
                )}
                {r.perk && (r.can || needsHire) && (
                  <span className="co__deleg-perk"><Smile size={12} /> {r.perk}</span>
                )}
              </div>
              <button
                className={`co__switch${enabled ? " co__switch--on" : ""}`}
                role="switch"
                aria-checked={enabled}
                aria-label={r.label}
                // Can always turn an automation OFF; can only turn it ON once the capability is met.
                disabled={!r.can && !enabled}
                onClick={() => { haptic.light(); onToggle({ [r.key]: !enabled }); }}
              >
                <span className="co__switch-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
    .filter(({ pct }) => pct >= 20)
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

/** Operations — your owned manufacturing lines, plus any you can acquire at this era. Owned lines
 *  cut tooling + per-unit cost and add capacity, but carry weekly upkeep whether they run or not. */
function OperationsSection({ state, onAcquire }: { state: GameState; onAcquire: (id: FactoryId) => void }) {
  const owned = (state.ownedFactories ?? []).map((id) => factoryFor(id));
  const acquirable = acquirableFactories(state.era, state.ownedFactories);
  if (owned.length === 0 && acquirable.length === 0) return null; // nothing to show pre-era-2
  const capLabel = (cap: number) => (Number.isFinite(cap) ? `${cap.toLocaleString()}/wk` : "unlimited");
  const speedLabel = (m: number) => (m < 1 ? `${Math.round((1 - m) * 100)}% faster` : m > 1 ? `${Math.round((m - 1) * 100)}% slower` : "standard");
  return (
    <Card>
      <SectionHeader title="Manufacturing lines" accessory="operations" />
      <div className="co__lines">
        {owned.map((f) => {
          // Live utilization: a line earns its upkeep only while it's building. Surfacing "idle —
          // costing $X/wk" makes the fixed-cost tension of owning a line visceral.
          const jobs = state.building.filter((j) => j.product.factoryId === f.id);
          const busy = jobs.length > 0;
          return (
            <div key={f.id} className="co__line co__line--owned">
              <div className="co__line-info">
                <span className="co__line-name">
                  {f.name} <span className="co__line-badge">Owned</span>
                  <span className={`co__line-status co__line-status--${busy ? "busy" : "idle"}`}>
                    <span className="co__line-dot" aria-hidden />
                    {busy ? `Building ${jobs[0].product.name}${jobs.length > 1 ? ` +${jobs.length - 1}` : ""}` : "Idle"}
                  </span>
                </span>
                <span className="co__line-meta">{capLabel(f.capacityPerWeek)} · {speedLabel(f.speedMult)} · {format(f.weeklyUpkeep)}/wk upkeep</span>
              </div>
            </div>
          );
        })}
        {acquirable.map((f) => {
          const afford = state.cash >= f.acquireCost;
          return (
            <div key={f.id} className="co__line">
              <div className="co__line-info">
                <span className="co__line-name">{f.name}</span>
                <span className="co__line-blurb">{f.blurb}</span>
                <span className="co__line-meta">{capLabel(f.capacityPerWeek)} · {speedLabel(f.speedMult)} · {format(f.weeklyUpkeep)}/wk upkeep</span>
              </div>
              <Button
                size="sm"
                variant={afford ? "primary" : "tertiary"}
                disabled={!afford}
                haptics="none"
                onClick={() => {
                  onAcquire(f.id);
                  // An owned manufacturing line is an era-defining purchase — celebrate it like one.
                  haptic.success();
                  sfx("upgrade");
                  showToast(`${f.name} acquired — tooling and unit costs drop`, { tone: "positive", glyph: <Factory size={15} /> });
                }}
              >
                {format(f.acquireCost)}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="co__hint">Owned lines slash tooling + per-unit cost and lift capacity, but the weekly upkeep is charged whether they build or sit idle.</p>
    </Card>
  );
}

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
          <span className="ds-stat__value tnum" style={{ color: netWorth >= 0 ? "var(--positive-text)" : "var(--negative-text)" }}>
            {format(netWorth)}
          </span>
        </div>
        <Sparkline data={cashData} stroke={netWorth >= 0 ? "var(--accent)" : "var(--negative)"} label="Cash over time" />
      </div>

      {revData.length >= 2 && (
        <div className="co__stats-spark">
          <div className="co__stats-spark-cap">
            <span className="co__stats-spark-label">Lifetime revenue</span>
            <span className="ds-stat__value tnum" style={{ color: "var(--positive-text)" }}>
              {format(state.cumulativeRevenue)}
            </span>
          </div>
          <Sparkline data={revData} stroke="var(--positive)" label="Weekly revenue over time" />
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
                  <span className="co__stats-best-item-val tnum">{formatShortDollars(peakWkRev)}</span>
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
        <p className="co__output-idle">{idleCount} staff idle, assign them to a function to generate output.</p>
      )}
      {(() => {
        const soonest = state.staff
          .filter((s) => s.skill < BALANCE.staff.maxSkill)
          .map((s) => {
            // Mirror the roster card's rate, including the mentorship bonus, so the summary and the
            // per-person ETA can't disagree about who levels next.
            const weeklyXpRate = (s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask) * xpMult(s.trait) * mentorshipXpMult(s, state.staff);
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
      {avgMood < 55 && (() => {
        const amenitiesLvl = state.upgrades.amenities ?? 0;
        const recentFlops = state.launched.slice(-3).filter((lp) => lp.verdict === "flop").length;
        if (amenitiesLvl === 0) {
          return (
            <p className="co__output-levelup co__output-mood-warn">
              {avgMood < 30 ? "Morale critically low" : "Morale is low"}. Upgrading <strong>Amenities</strong> on the Office tab will help.
            </p>
          );
        }
        if (recentFlops >= 2) {
          return (
            <p className="co__output-levelup co__output-mood-warn">
              Recent flops are weighing on the team; landing a hit will bounce morale back.
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
  staff,
  cash,
  era,
  onAssign,
  onTrain,
  onFire,
  onRaise,
  onRest,
}: {
  s: Staff;
  staff: readonly Staff[];
  cash: number;
  era: number;
  onAssign: (id: string, a: Assignment) => void;
  onTrain: (id: string) => void;
  onFire: (id: string) => void;
  onRaise: (id: string) => void;
  onRest: (id: string) => void;
}) {
  const [confirmFire, setConfirmFire] = useState(false);
  const maxed = s.skill >= BALANCE.staff.maxSkill;
  const cost = trainCost(s.skill);
  const xpPct = maxed ? 100 : Math.min(100, Math.round((s.xp / xpToNext(s.skill)) * 100));
  // Org structure (Track C): the discipline lead mentors juniors → their XP rate (and so the
  // displayed time-to-level) reflects the mentorship boost.
  const isLead = isDisciplineLead(s, staff);
  const mentorMult = mentorshipXpMult(s, staff);
  const isMentored = mentorMult > 1;
  const weeklyXpRate = maxed ? 0 : (s.assignment === "idle" ? BALANCE.staff.xpPerWeekIdle : BALANCE.staff.xpPerWeekOnTask) * xpMult(s.trait) * mentorMult;
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
  const isLowMood = (s.moodLowWeeks ?? 0) >= 3;
  return (
    <li className="co__member-card">
      <div className="co__member-top">
        <Avatar appearance={s.appearance} mood={s.mood} size={46} />
        <div className="co__member-info">
          <span className="co__member-name">{s.name}</span>
          <span className="co__member-role">{ROLE_LABEL[s.role]} · {SPECIALTY_TITLE[s.specialty]}</span>
          <span className="co__member-sub">{format(s.salary)}/wk</span>
        </div>
        {s.id !== "s0" && !confirmFire && (
          <button className="co__fire" onClick={() => setConfirmFire(true)} aria-label={`Let go ${s.name}`}>
            <X size={15} />
          </button>
        )}
      </div>

      {confirmFire && (
        // Firing is irreversible and wipes accumulated skill/XP — confirm before it happens
        // (mirrors the save-wipe confirms in Settings/Scenarios) and give real feedback on commit.
        <div className="co__confirm" role="group" aria-label={`Confirm letting go ${s.name}`}>
          <span className="co__confirm-text">Let go {s.name}? Their training is lost for good.</span>
          <div className="co__confirm-row">
            <Button size="sm" variant="tertiary" onClick={() => setConfirmFire(false)}>Keep</Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { onFire(s.id); haptic.warning(); showToast(`${s.name} left the company`, { tone: "neutral" }); }}
            >
              Let go
            </Button>
          </div>
        </div>
      )}

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
          <span className="co__tag co__tag--burnout">Burnout risk</span>
        )}
        {isLead && (
          <span className="co__tag co__tag--lead" title="Strongest in their discipline — mentors the juniors working alongside them">
            <GraduationCap size={11} aria-hidden /> Lead
          </span>
        )}
        {isMentored && (
          <span className="co__tag co__tag--mentored" title={`Learning faster under the lead (+${Math.round((mentorMult - 1) * 100)}% XP)`}>
            <Sparkles size={11} aria-hidden /> Mentored
          </span>
        )}
      </div>
      <div className="co__mood-bar" role="progressbar" aria-valuenow={Math.round(s.mood)} aria-valuemin={0} aria-valuemax={100} aria-label={`Morale ${Math.round(s.mood)}%`}>
        <div className="co__mood-bar-fill" style={{ width: `${s.mood}%`, background: MOOD_COLOR[band] }} />
      </div>

      {/* per-discipline skills (0..100) — the active one (matching their assignment) is highlighted */}
      <div className="co__cand-skills">
        {(["engineering", "design", "marketing"] as Discipline[]).map((d) => {
          const active = ACTIVE_DISCIPLINE[s.assignment] === d;
          return (
            <div key={d} className="co__cand-skill" style={active ? undefined : { opacity: 0.5 }}>
              <span className="co__cand-skill-label">{DISCIPLINE_LABEL[d]}</span>
              <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${s.skills[d] ?? 0}%`, background: DISCIPLINE_COLOR[d] }} /></span>
              <span className="co__cand-skill-num tnum">{s.skills[d] ?? 0}</span>
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
        <div className="co__xp-track" role="progressbar" aria-valuenow={xpPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Skill progress ${xpPct}%`}><div className="co__xp-fill" style={{ width: `${xpPct}%` }} /></div>
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
              onClick={() => { onAssign(s.id, a); haptic.light(); }}
            >
              {ASSIGN_LABEL[a]}
            </button>
          ))}
        </div>
        <Button size="sm" variant={cash >= cost && !maxed ? "secondary" : "tertiary"} disabled={maxed || cash < cost} onClick={() => { onTrain(s.id); haptic.medium(); }}>
          <ArrowUp size={13} /> {maxed ? "Max skill" : `Train · ${format(cost)}`}
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
        <button className="co__raise-btn" onClick={() => { onRaise(s.id); haptic.success(); sfx("confirm"); }}>
          <ArrowUp size={12} aria-hidden /> Raise to {format(marketSalary)}/wk
        </button>
      )}
      {/* Rest — paid time off that recharges morale and pulls them out of the burnout
          countdown. Shown only when it's actually useful (low/sinking mood). */}
      {s.mood < 100 && (s.mood < 50 || isLowMood) && (
        <button
          className={`co__rest-btn${isLowMood ? " co__rest-btn--urgent" : ""}`}
          disabled={cash < restCost(s)}
          title="Paid time off, restores morale and eases burnout"
          onClick={() => { onRest(s.id); haptic.success(); }}
        >
          <Coffee size={12} aria-hidden /> {isLowMood ? "Rest, recharge morale" : "Rest"} · {format(restCost(s))}
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
  noDesk,
  onRecruit,
  onHire,
  onDismiss,
}: {
  state: GameState;
  capacity: number;
  /** True when desks (not the facility) are the binding constraint — drives the hint copy. */
  noDesk: boolean;
  onRecruit: (tier: RecruitTier) => void;
  onHire: (id: string) => void;
  onDismiss: () => void;
}) {
  const full = state.staff.length >= capacity;
  // A shortlist cost real cash + weeks to produce, so dismissing it is a two-tap confirm (mirrors
  // the fire flow) instead of a single irreversible tap.
  const [confirmDismiss, setConfirmDismiss] = useState(false);

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
            {(() => {
              const total = Math.max(1, BALANCE.recruitment.tiers[state.recruitment.tier].weeks);
              const pct = Math.round((1 - wl / total) * 100);
              return (
                <span className="co__loan-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Recruiter search progress">
                  <span className="co__loan-fill" style={{ width: `${pct}%` }} />
                </span>
              );
            })()}
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
          {full ? (noDesk ? "Every desk is taken, buy a desk on the Office tab to open a seat. " : "At capacity, free up a seat to sign someone. ") : ""}
          Shortlist available for {weeksLeft} more week{weeksLeft === 1 ? "" : "s"}.
        </p>
        {state.candidates.map((c) => (
          <CandidateCard
            key={c.id}
            c={c}
            canHire={!full && state.cash >= c.hireFee}
            onHire={() => {
              onHire(c.id);
              // A person joining the company is a moment, not a silent debit.
              haptic.success();
              sfx("confirm");
              showToast(`${c.name} joined as ${ROLE_LABEL[c.role] ?? c.role}`, { tone: "positive", glyph: <Users size={15} /> });
            }}
          />
        ))}
        {confirmDismiss ? (
          <div className="co__confirm" role="group" aria-label="Confirm dismissing the shortlist">
            <span className="co__confirm-text">Dismiss all {state.candidates.length} candidate{state.candidates.length === 1 ? "" : "s"}? The search fee isn't refunded.</span>
            <div className="co__confirm-row">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDismiss(false)}>Keep</Button>
              <Button size="sm" variant="destructive" onClick={() => { setConfirmDismiss(false); onDismiss(); }}>Dismiss</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="tertiary" onClick={() => setConfirmDismiss(true)}>Dismiss shortlist</Button>
        )}
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
              <span className="co__recruit-tier-meta">{t.weeks} wk · skill {t.minLevel}–{t.maxLevel}</span>
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
            <span className="co__cand-bar"><span className="co__cand-bar-fill" style={{ width: `${c.skills[d] ?? 0}%`, background: DISCIPLINE_COLOR[d] }} /></span>
            <span className="co__cand-skill-num tnum">{c.skills[d] ?? 0}</span>
          </div>
        ))}
      </div>
      {projContrib && <p className="co__cand-contrib">{projContrib}</p>}
      <div className="co__hire-controls">
        <span className="co__hint">{format(c.salary)}/wk salary · {TRAIT_INFO[c.trait].blurb}</span>
        <Button size="sm" variant={canHire ? "primary" : "tertiary"} disabled={!canHire} haptics="none" onClick={onHire}>Sign · {format(c.hireFee)}</Button>
      </div>
    </Card>
  );
}
