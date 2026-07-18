import { useState } from "react";
import { Check, ChevronRight, Clock, FlaskConical, Lightbulb, Lock, MapPin, Rocket, TriangleAlert, Users } from "lucide-react";
import { Button, Card, SectionHeader } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { ComponentIcon } from "../design/icons.tsx";
import { CircuitMotif } from "../design/CircuitMotif.tsx";
import type { Tab } from "../components/BottomNav.tsx";
import { AnimatedInt } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { CATEGORY_LIST, COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { eraContext, eraName, maxEra } from "../engine/eras.ts";
import { formatShortDollars, toDollars, type Money } from "../engine/money.ts";
import { RESEARCH_PROJECTS, forkLockedBy, prereqsMissing, projectById } from "../engine/research.ts";
import { MOONSHOTS, moonshotCooldownLeft, moonshotRefund, type Moonshot } from "../engine/moonshots.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import { FINISH_ORDER, STAT_KEYS, type ComponentKind, type Stats } from "../engine/types.ts";
import { KEYNOTE_FANS, KEYNOTE_REP, KEYNOTE_RP_COST, moonshotAttemptable, rdRpCostFor, researchedTier, weeklyRpGen, weeklyRpSources, lensUnlockCost, finishUnlockCost, eurekaInsight, researchQueueFull, tierResearchStatus, projectResearchStatus, type ResearchSlotStatus } from "../state/gameState.ts";
import { ResearchProgress } from "../components/ResearchProgress.tsx";
import { useGame } from "../state/useGame.tsx";
import "./research.css";

// Compact stat labels derive from the single source (glossary STAT_INFO) so they can't drift.
const STAT_SHORT: Record<keyof Stats, string> = Object.fromEntries(
  STAT_KEYS.map((k) => [k, STAT_INFO[k].abbr]),
) as Record<keyof Stats, string>;

function contributesLabel(c: Partial<Stats>): string {
  return STAT_KEYS.filter((k) => c[k]).map((k) => `+${Math.round(c[k]!)} ${STAT_SHORT[k]}`).join(" · ");
}

/** Show the improvement from upgrading (delta) rather than the tier's total contribution. */
function deltaLabel(cur: Partial<Stats>, next: Partial<Stats>): string {
  const parts = STAT_KEYS
    .filter((k) => (next[k] ?? 0) > (cur[k] ?? 0))
    .map((k) => `+${Math.round((next[k] ?? 0) - (cur[k] ?? 0))} ${STAT_SHORT[k]}`);
  return parts.length > 0 ? parts.join(" · ") : contributesLabel(next);
}


function EraRoadmap({ currentEra, reputation, cumulativeRevenueDollars }: {
  currentEra: number;
  reputation: number;
  cumulativeRevenueDollars: number;
}) {
  const eraMax = maxEra();
  const eras = BALANCE.eras;

  return (
    <Card className="rd__roadmap">
      <SectionHeader title="Era roadmap" accessory={<span className="rd__era-badge">{eraName(currentEra)}</span>} />
      <div className="rd__roadmap-list">
        {eras.map((eraDef, idx) => {
          const done = currentEra > eraDef.era;
          const active = currentEra === eraDef.era;
          const future = currentEra < eraDef.era;
          const nextLocked = future && eraDef.era > currentEra + 1;

          const newCats = CATEGORY_LIST.filter((c) => c.unlockEra === eraDef.era);
          const newCompTiers = Object.values(COMPONENT_LINES).reduce((count, line) => {
            return count + line.tiers.filter((t) => t.era === eraDef.era).length;
          }, 0);

          const revGoalD = eraDef.revToAdvance === Infinity ? null : toDollars(eraDef.revToAdvance as Money);
          const repGoal = Number.isFinite(eraDef.repToAdvance) ? eraDef.repToAdvance : null;

          let progressLabel = "";
          if (active && eraDef.era < eraMax) {
            const repPct = repGoal ? Math.min(100, Math.round((reputation / repGoal) * 100)) : 0;
            const revPct = revGoalD ? Math.min(100, Math.round((cumulativeRevenueDollars / revGoalD) * 100)) : 0;
            const bestPct = Math.max(repPct, revPct);
            const label = repPct >= revPct
              ? `${Math.round(reputation)} / ${repGoal} rep`
              : `${formatShortDollars(cumulativeRevenueDollars)} / ${formatShortDollars(revGoalD!)} rev`;
            progressLabel = `${bestPct}%, ${label}`;
          }

          return (
            <div
              key={eraDef.era}
              className={`rd__roadmap-row${done ? " rd__roadmap-row--done" : active ? " rd__roadmap-row--active" : " rd__roadmap-row--future"}`}
            >
              <div className="rd__roadmap-marker">
                {done ? <Check size={11} strokeWidth={3} /> : active ? <MapPin size={11} strokeWidth={2.5} /> : <ChevronRight size={11} strokeWidth={2.5} />}
                {idx < eras.length - 1 && <div className="rd__roadmap-line" />}
              </div>
              <div className="rd__roadmap-body">
                <div className="rd__roadmap-head">
                  <span className="rd__roadmap-name">{eraDef.name}</span>
                  {future && eraDef.era < eraMax && (
                    <span className="rd__roadmap-req">
                      {repGoal ? `${repGoal} rep` : ""}
                      {repGoal && revGoalD ? " or " : ""}
                      {revGoalD ? `${formatShortDollars(revGoalD)} rev` : ""}
                    </span>
                  )}
                </div>
                <p className="rd__roadmap-flavor">{eraContext(eraDef.era).tagline}</p>
                {active && <p className="rd__roadmap-story">{eraContext(eraDef.era).story}</p>}
                {active && progressLabel && (
                  <p className="rd__roadmap-progress">{progressLabel}</p>
                )}
                {(newCats.length > 0 || newCompTiers > 0) && (
                  <div className="rd__roadmap-unlocks">
                    {newCats.map((c) => (
                      <span key={c.id} className={`rd__roadmap-tag${future && nextLocked ? " rd__roadmap-tag--locked" : done ? " rd__roadmap-tag--done" : ""}`}>
                        {c.displayName}
                      </span>
                    ))}
                    {newCompTiers > 0 && (
                      <span className={`rd__roadmap-tag rd__roadmap-tag--comp${done ? " rd__roadmap-tag--done" : future && nextLocked ? " rd__roadmap-tag--locked" : ""}`}>
                        +{newCompTiers} comp tiers
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** The developer-keynote CTA — the repeatable surplus-RP sink. Shared so the "saving toward" and
 *  "all researched" branches can't drift on copy/rewards. */
function KeynoteButton({ rp, onHost }: { rp: number; onHost: () => void }) {
  return (
    <Button size="sm" variant="secondary" disabled={rp < KEYNOTE_RP_COST} onClick={onHost}>
      <Users size={14} /> Host keynote · {KEYNOTE_RP_COST} RP → +{KEYNOTE_FANS} fans, +{KEYNOTE_REP} rep
    </Button>
  );
}

/** The per-row research control: an "In lab" / "Queued" status pill when that line/project is already
 *  developing or lined up, otherwise a start-or-queue button (disabled when unaffordable or the queue
 *  is full). One place so all three lists (sprint picks, projects, component tech) stay consistent. */
function ResearchAction({ status, cost, affordable, queueFull, weeksAway, onStart }: {
  status: ResearchSlotStatus; cost: number | null; affordable: boolean; queueFull: boolean; weeksAway?: number | null; onStart: () => void;
}) {
  if (status === "active") return <span className="rd__slot rd__slot--active"><FlaskConical size={12} aria-hidden /> In lab</span>;
  if (status === "queued") return <span className="rd__slot rd__slot--queued"><Clock size={12} aria-hidden /> Queued</span>;
  return (
    <>
      <Button size="sm" variant={affordable && !queueFull ? "primary" : "tertiary"} disabled={!affordable || queueFull} haptics="none" onClick={onStart}>
        {queueFull ? "Queue full" : cost !== null ? `${cost} RP` : "—"}
      </Button>
      {!queueFull && !affordable && weeksAway != null && <span className="rd__weeks-away">~{weeksAway}wk</span>}
    </>
  );
}

/** Moonshot R&D gambles (feature #5) — the opt-in, high-cost experimental track (era 3+). Each card
 *  shows the plain-language odds, the steep RP cost, the unique reward, and a two-tap arm/confirm attempt
 *  button (it's a gamble — never a single mis-tap). Won moonshots read as completed; a failed attempt
 *  shows its retry cooldown. Only rendered from era 3, so early-game players never see it. */
function MoonshotsSection({ state, rp, onAttempt }: {
  state: ReturnType<typeof useGame>["state"];
  rp: number;
  onAttempt: (id: string) => void;
}) {
  const [armedId, setArmedId] = useState<string | null>(null);
  const won = state.moonshotsWon ?? [];
  const attempts = state.moonshotAttempts ?? {};
  return (
    <div className="rd__moonshots">
      <SectionHeader
        title="Moonshots"
        accessory={<span className="rd__moonshot-count"><Rocket size={12} aria-hidden /> {won.length}/{MOONSHOTS.length}</span>}
      />
      <p className="rd__moonshot-intro">
        High-cost experimental gambles with <strong>visible odds</strong>. Success banks a unique, permanent
        reward; a miss burns most of the RP (a quarter is salvaged) and can be retried later.
      </p>
      {MOONSHOTS.map((m: Moonshot) => {
        const isWon = won.includes(m.id);
        const locked = m.era > state.era;
        const cd = moonshotCooldownLeft(state.week, attempts[m.id]);
        const refund = moonshotRefund(m.rpCost);
        const affordable = rp >= m.rpCost;
        const canAttempt = moonshotAttemptable(state, m.id);
        const armed = armedId === m.id;
        const pct = Math.round(m.successChance * 100);
        return (
          <Card key={m.id} className={`rd__moonshot${isWon ? " rd__moonshot--won" : ""}`}>
            <div className="rd__moonshot-info">
              <span className="rd__moonshot-name">
                <Rocket size={14} aria-hidden /> {m.name}
                {!isWon && !locked && <span className="rd__moonshot-odds">{pct}% chance</span>}
              </span>
              <span className="rd__moonshot-flavor">{m.flavor}</span>
              <span className="rd__moonshot-reward">
                <Check size={11} strokeWidth={2.5} aria-hidden /> Reward: {m.reward.label}
              </span>
              {!isWon && !locked && (
                <span className="rd__moonshot-terms">
                  {m.rpCost} RP · {pct}% success · miss refunds {refund} RP
                </span>
              )}
            </div>
            {isWon ? (
              <span className="rd__maxed"><Check size={14} strokeWidth={2.5} /> Achieved</span>
            ) : locked ? (
              <span className="rd__locked"><Lock size={12} /> Era {m.era}</span>
            ) : cd > 0 ? (
              <span className="rd__moonshot-cooldown"><Clock size={12} aria-hidden /> Retry in {cd}wk</span>
            ) : armed ? (
              <div className="rd__moonshot-confirm">
                <span className="rd__moonshot-warn"><TriangleAlert size={11} aria-hidden /> Gamble {m.rpCost} RP?</span>
                <div className="rd__moonshot-confirm-row">
                  <Button size="sm" variant="tertiary" haptics="light" onClick={() => setArmedId(null)}>Cancel</Button>
                  <Button size="sm" variant="primary" haptics="none" onClick={() => { setArmedId(null); onAttempt(m.id); }}>
                    Attempt
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rd__moonshot-action">
                <Button
                  size="sm"
                  variant={affordable ? "primary" : "tertiary"}
                  disabled={!canAttempt}
                  haptics="light"
                  onClick={() => setArmedId(m.id)}
                >
                  {affordable ? `Attempt · ${m.rpCost} RP` : `${m.rpCost} RP`}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function Research({ onNavigate }: { onNavigate?: (t: Tab) => void } = {}) {
  const { state, research, buyProject, hostKeynote, attemptMoonshot, unlockLens, unlockFinish } = useGame();
  // Once many projects are complete, the full-blurb list grows into a long scroll. Default to a
  // compact chip cloud; the player can expand to the detailed effects on demand.
  const [boostsExpanded, setBoostsExpanded] = useState(false);
  // Two destinations: Projects (RP income, the sprint picks, company-wide research projects + era
  // roadmap) and Components (the device-tech tiers + design-capability unlocks).
  const [rdTab, setRdTab] = useState<"projects" | "components">("projects");
  const kinds = Object.keys(COMPONENT_LINES) as ComponentKind[];
  const rp = Math.floor(state.researchPoints);
  const perWeek = weeklyRpGen(state);
  // One research develops at a time; buying more lines them up in the queue (shown on the ring card).
  // The action per row depends on whether that line/project is already developing, queued, or startable.
  const queueFull = researchQueueFull(state);

  // Sort component tech by actionability: affordable → saveable (≤10wk) → needs time → locked → maxed
  const sortedKinds = [...kinds].sort((a, b) => {
    const priority = (kind: ComponentKind) => {
      const cur = researchedTier(state, kind);
      if (cur >= maxTier(kind)) return 4;
      const nextD = tierDef(kind, cur + 1);
      if (nextD && nextD.era > state.era) return 3;
      const c = rdRpCostFor(state, kind);
      if (c === null) return 4;
      if (rp >= c) return 0;
      if (perWeek > 0 && (c - rp) / perWeek <= 10) return 1;
      return 2;
    };
    return priority(a) - priority(b);
  });

  // Find the cheapest unaffordable project the player could save toward (excluding fork-locked
  // doctrine siblings, which can't be researched once a doctrine is chosen).
  const nextGoal = RESEARCH_PROJECTS
    .filter((p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp < p.rpCost && !forkLockedBy(state.completedProjects, p.id) && prereqsMissing(state.completedProjects, p.id).length === 0)
    .sort((a, b) => a.rpCost - b.rpCost)[0] ?? null;
  const goalPct = nextGoal ? Math.min(100, Math.round((rp / nextGoal.rpCost) * 100)) : 0;
  const goalWeeks = nextGoal && perWeek > 0 ? Math.ceil((nextGoal.rpCost - rp) / perWeek) : null;

  return (
    <div className="rd">
      {/* Header strip — subtitle + era badge, mirroring the Design Lab's header treatment. */}
      <div className="rd__head">
        <p className="rd__subtitle">Spend Research Points to unlock new tech and abilities.</p>
        <span className="rd__era-badge"><FlaskConical size={13} aria-hidden /> {eraName(state.era)}</span>
      </div>
      {/* Active research — the hero when the lab is developing something (a filling progress ring). */}
      {state.activeResearch && (
        <Card className="rd__active">
          <ResearchProgress research={state.activeResearch} />
        </Card>
      )}
      {/* RP banner */}
      <Card className="rd__bank">
        <div className="rd__bank-backdrop" aria-hidden>
          <span className="rd__bank-glow" />
          <span className="rd__bank-grid" />
          <CircuitMotif className="rd__bank-circuit" />
        </div>
        <div className="rd__bank-main">
          <FlaskConical size={22} style={{ color: "var(--fn-eng)", flexShrink: 0 }} />
          <div>
            <div className="rd__bank-value tnum" style={{ color: "var(--fn-eng)" }}><AnimatedInt value={rp} /> RP</div>
            <div className="rd__bank-sub">+{perWeek.toFixed(1)}/wk</div>
          </div>
          {(() => {
            const buyableNow = RESEARCH_PROJECTS.filter(
              (p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp >= p.rpCost && !forkLockedBy(state.completedProjects, p.id) && prereqsMissing(state.completedProjects, p.id).length === 0,
            ).length;
            if (buyableNow === 0) return null;
            return (
              <span className="rd__bank-ready">
                <Check size={10} strokeWidth={3} /> {buyableNow} unlock{buyableNow > 1 ? "s" : ""} ready
              </span>
            );
          })()}
        </div>
        {perWeek === 0 ? (
          <div className="rd__bank-cta">
            <p className="rd__bank-hint">No R&amp;D output yet. Assign staff to the R&amp;D task to start earning Research Points.</p>
            {onNavigate && (
              <Button size="sm" variant="secondary" onClick={() => onNavigate("company")}>
                <Users size={14} /> Manage team
              </Button>
            )}
          </div>
        ) : nextGoal ? (
          <>
          <div className="rd__bank-goal">
            <div className="rd__bank-goal-head">
              <span className="rd__bank-goal-label">Saving toward</span>
              <span className="rd__bank-goal-name">{nextGoal.name}</span>
              {goalWeeks !== null && <span className="rd__bank-goal-eta">~{goalWeeks}wk</span>}
            </div>
            <div className="rd__bank-goal-track">
              <div className="rd__bank-goal-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="rd__bank-goal-nums">
              <span className="tnum">{rp} / {nextGoal.rpCost} RP</span>
              <span className="tnum">{goalPct}%</span>
            </div>
          </div>
          {rp >= KEYNOTE_RP_COST && (
            <div className="rd__bank-cta">
              <KeynoteButton rp={rp} onHost={() => { hostKeynote(); haptic.success(); }} />
            </div>
          )}
          </>
        ) : (
          // Every project in this era is researched and RP still flows — give the surplus a real,
          // repeatable outlet (the developer keynote) alongside the remaining one-time sinks.
          <div className="rd__bank-cta">
            <p className="rd__bank-hint">
              Every project here is researched. Spend RP on component tech below{state.platformUnlocked ? ", OS modules in Platform," : ""} or rally the community with a keynote{state.era < maxEra() ? " — new projects arrive with the next era" : ""}.
            </p>
            <KeynoteButton rp={rp} onHost={() => { hostKeynote(); haptic.success(); }} />
          </div>
        )}
        {/* Eureka insight meter — a funded lab occasionally has a flash of insight (a bank-or-chase
            breakthrough). This gauge shows it priming; only meaningful once the lab is active + past era 1. */}
        {state.era >= BALANCE.research.eureka.minEra && perWeek > 0 && (
          <div className="rd__insight" title="A funded lab occasionally has a flash of insight — a bank-or-chase breakthrough.">
            <span className="rd__insight-label"><Lightbulb size={12} aria-hidden /> Insight</span>
            <div className="rd__insight-track"><i style={{ width: `${Math.round(eurekaInsight(state) * 100)}%` }} /></div>
            <span className="rd__insight-hint">the lab is onto something</span>
          </div>
        )}
      </Card>

      {/* Sub-navigation — Projects (strategy + income) · Components (device tech tiers). */}
      <div className="rd__subnav" role="tablist" aria-label="Research sections">
        {([["projects", "Projects"], ["components", "Components"]] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={rdTab === id}
            className={`rd__subtab${rdTab === id ? " rd__subtab--on" : ""}`}
            onClick={() => { haptic.light(); setRdTab(id); }}
          >
            {label}
          </button>
        ))}
      </div>

      {rdTab === "projects" && (<>
      {/* Research income — where the weekly RP comes from, so the player can see how to grow it
          (skilled engineers on R&D, the era multiplier). Read-only; the sum equals the banner's +/wk. */}
      {perWeek > 0 && (() => {
        const sources = weeklyRpSources(state).filter((s) => s.rp >= 0.05);
        const maxRp = Math.max(...sources.map((s) => s.rp), 0.01);
        return (
          <Card className="rd__income">
            <SectionHeader title="Research income" accessory={`+${perWeek.toFixed(1)}/wk`} />
            <ul className="rd__income-list">
              {sources.map((s) => (
                <li key={s.id} className="rd__income-row">
                  <span className="rd__income-label">{s.id === "founder" ? "Founder trickle" : s.label}</span>
                  <span className="rd__income-bar" aria-hidden><i style={{ width: `${Math.round((s.rp / maxRp) * 100)}%` }} /></span>
                  <span className="rd__income-rp tnum">+{s.rp.toFixed(1)}</span>
                </li>
              ))}
            </ul>
            <p className="rd__income-hint">Assign more skilled engineers to R&amp;D to grow this, and each era multiplies your output.</p>
          </Card>
        );
      })()}

      </>)}

      {rdTab === "components" && (<>
      {/* Design unlocks — the device-design capabilities RP buys (camera lenses + premium
          finishes), surfaced in the same hub as component tiers + projects so the RP economy
          reads as one thing. Hidden once both tracks are fully unlocked. */}
      {(() => {
        const lensCost = lensUnlockCost(state);
        const finishCost = finishUnlockCost(state);
        if (lensCost === null && finishCost === null) return null;
        const lensLimit = state.lensLimit ?? 2;
        const finishLimit = state.finishLimit ?? 1;
        const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
        return (
          <Card className="rd__unlocks">
            <SectionHeader title="Design unlocks" accessory="device R&D" />
            <div className="rd__unlock-list">
              <UnlockTrack
                name="Camera lenses"
                sub={lensCost === null ? "Quad-lens array, maxed" : `Designs use up to ${lensLimit} lenses · more = sharper photos`}
                cta={lensCost === null ? null : `Unlock ${lensLimit + 1}-lens`}
                cost={lensCost}
                rp={rp}
                onBuy={() => { unlockLens(); haptic.success(); sfx("upgrade"); }}
              />
              <UnlockTrack
                name="Premium finishes"
                sub={finishCost === null ? "Gold, maxed" : `${finishLimit + 1} of ${FINISH_ORDER.length} materials · premium = +design appeal`}
                cta={finishCost === null ? null : `Unlock ${cap(FINISH_ORDER[finishLimit + 1])}`}
                cost={finishCost}
                rp={rp}
                onBuy={() => { unlockFinish(); haptic.success(); sfx("upgrade"); }}
              />
            </div>
          </Card>
        );
      })()}

      </>)}

      {rdTab === "projects" && (<>
      {/* R&D sprint: top picks — up to 3 actionable component upgrades */}
      {perWeek > 0 && (() => {
        const trendStat = [...STAT_KEYS].sort((a, b) => {
          const da = (state.trends.targetWeights[a] ?? 0) - (state.trends.weights[a] ?? 0);
          const db = (state.trends.targetWeights[b] ?? 0) - (state.trends.weights[b] ?? 0);
          return db - da;
        })[0];
        const trendDelta = trendStat
          ? (state.trends.targetWeights[trendStat] ?? 0) - (state.trends.weights[trendStat] ?? 0)
          : 0;

        const picks = kinds
          .map((kind) => {
            const cur = researchedTier(state, kind);
            if (cur >= maxTier(kind)) return null;
            const next = tierDef(kind, cur + 1);
            if (!next || next.era > state.era) return null;
            const cost = rdRpCostFor(state, kind);
            if (cost === null) return null;
            const weeksAway = rp >= cost ? 0 : perWeek > 0 ? Math.ceil((cost - rp) / perWeek) : Infinity;
            if (weeksAway > 12) return null; // only show near-term picks
            const statGain = Object.values(next.contributes).reduce((a, v) => a + (v ?? 0), 0);
            return { kind, next, cost, weeksAway, statGain };
          })
          .filter(Boolean)
          .sort((a, b) => (a!.weeksAway - b!.weeksAway) || (b!.statGain - a!.statGain))
          .slice(0, 3) as { kind: ComponentKind; next: ReturnType<typeof tierDef> & NonNullable<unknown>; cost: number; weeksAway: number; statGain: number }[];

        if (picks.length === 0) return null;
        return (
          <Card className="rd__sprint">
            <SectionHeader title="Top picks" accessory="next 12 weeks" />
            <div className="rd__sprint-list">
              {picks.map(({ kind, next, cost, weeksAway }) => {
                const line = COMPONENT_LINES[kind];
                const affordable = rp >= cost;
                const curTierDef = tierDef(kind, researchedTier(state, kind));
                const contribRaw = curTierDef
                  ? deltaLabel(curTierDef.contributes, next.contributes)
                  : contributesLabel(next.contributes);
                // A single-stat line whose stat IS the line ("Battery · +16 Battery") reads
                // redundant — drop the repeated word: "Battery · +16".
                const contrib = !contribRaw.includes(" · ") && contribRaw.endsWith(` ${line.displayName}`)
                  ? contribRaw.slice(0, -line.displayName.length - 1)
                  : contribRaw;
                const isTrending = trendDelta > 0.02 && trendStat && (next.contributes[trendStat] ?? 0) > 0;
                return (
                  <div key={kind} className="rd__sprint-row">
                    <div className="rd__sprint-info">
                      <div className="rd__sprint-name-row">
                        <span className="rd__sprint-name">{next.name}</span>
                        {isTrending && <span className="rd__trend-badge">Trending</span>}
                      </div>
                      <span className="rd__sprint-line">{contrib ? `${line.displayName} · ${contrib}` : line.displayName}</span>
                    </div>
                    <div className="rd__sprint-action">
                      <ResearchAction status={tierResearchStatus(state, kind)} cost={cost} affordable={affordable} queueFull={queueFull} weeksAway={weeksAway} onStart={() => research(kind)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Active project boosts — compact chip cloud by default, expandable to full effects */}
      {state.completedProjects.length > 0 && (
        <Card>
          <SectionHeader
            title="Active boosts"
            accessory={
              <button
                type="button"
                className="rd__boosts-toggle"
                aria-expanded={boostsExpanded}
                onClick={() => { haptic.light(); setBoostsExpanded((v) => !v); }}
              >
                {state.completedProjects.length} projects · {boostsExpanded ? "Hide" : "Details"}
              </button>
            }
          />
          {boostsExpanded ? (
            <div className="rd__boosts">
              {state.completedProjects.map((id) => {
                const p = RESEARCH_PROJECTS.find((rp) => rp.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="rd__boost">
                    <span className="rd__boost-name"><Check size={11} strokeWidth={2.5} /> {p.name}</span>
                    <span className="rd__boost-blurb">{p.blurb}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rd__boost-cloud">
              {state.completedProjects.map((id) => {
                const p = RESEARCH_PROJECTS.find((rp) => rp.id === id);
                if (!p) return null;
                return (
                  <span key={id} className="rd__boost-chip" title={p.blurb}>
                    <Check size={10} strokeWidth={3} aria-hidden /> {p.name}
                  </span>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Era roadmap */}
      <EraRoadmap currentEra={state.era} reputation={state.reputation} cumulativeRevenueDollars={toDollars(state.cumulativeRevenue)} />

      {/* Research projects — grouped by era. Progressive disclosure: only the eras you've reached
          render (the EraRoadmap above already previews what's ahead), so a first-time researcher
          isn't staring at a wall of locked future-era project cards. */}
      <SectionHeader title="Research projects" accessory="evolve the company" />
      {Array.from({ length: maxEra() }, (_, i) => i + 1).filter((era) => era <= state.era).map((era) => {
        const eraProjects = RESEARCH_PROJECTS.filter((p) => p.era === era);
        if (eraProjects.length === 0) return null;
        const eraLocked = era > state.era;
        const eraDone = eraProjects.filter((p) => state.completedProjects.includes(p.id)).length;
        return (
          <div key={era} className="rd__era-group">
            <span className={`rd__era-label${eraLocked ? " rd__era-label--locked" : ""}`}>
              {eraLocked ? <Lock size={11} /> : null}
              {eraName(era)}
              {!eraLocked && <span className="rd__era-progress">{eraDone}/{eraProjects.length}</span>}
            </span>
            {eraProjects.map((p) => {
              const done = state.completedProjects.includes(p.id);
              const locked = p.era > state.era;
              // Research-tree fork (Track D): a forked project is locked once a sibling doctrine is chosen.
              const forkLock = !done ? forkLockedBy(state.completedProjects, p.id) : null;
              // Item 4.2 — prerequisites: a capstone is locked until its required projects are done.
              const prereqLock = !done && !locked && !forkLock ? prereqsMissing(state.completedProjects, p.id) : [];
              const affordable = rp >= p.rpCost && !locked && !forkLock && prereqLock.length === 0;
              const weeksAway = !affordable && !locked && !forkLock && prereqLock.length === 0 && perWeek > 0 ? Math.ceil((p.rpCost - rp) / perWeek) : null;
              return (
                <Card key={p.id} className={`rd__project${p.fork ? " rd__project--fork" : ""}${p.capstone ? " rd__project--capstone" : ""}`}>
                  <div className="rd__project-info">
                    <span className="rd__next-name">
                      {p.name}
                      {p.fork && <span className="rd__fork-tag" title="A doctrine — choosing one locks out the others">Pick one</span>}
                      {p.capstone && <span className="rd__fork-tag" title="A capstone — the end of this era's tree, behind its prerequisites">Capstone</span>}
                    </span>
                    <span className="rd__contrib rd__contrib--muted">{p.blurb}</span>
                    {/* Item A3 — the "why" that used to live in a hover title, now inline (touch-visible). */}
                    {p.fork && !done && !forkLock && <span className="rd__fork-note">Doctrine — you can only ever pick ONE of these; it permanently stamps every product you ship.</span>}
                    {p.capstone && !done && <span className="rd__fork-note">Capstone — the end of this era's tree, unlocked once its prerequisite projects are complete.</span>}
                  </div>
                  {done ? (
                    <span className="rd__maxed"><Check size={14} strokeWidth={2.5} /> {p.fork ? "Chosen" : "Done"}</span>
                  ) : locked ? (
                    <span className="rd__locked"><Lock size={12} /> Era {p.era}</span>
                  ) : forkLock ? (
                    <span className="rd__locked"><Lock size={12} /> {projectById(forkLock).name} chosen</span>
                  ) : prereqLock.length > 0 ? (
                    <span className="rd__locked" title={`Requires ${prereqLock.map((r) => projectById(r).name).join(", ")}`}><Lock size={12} /> Requires {prereqLock.map((r) => projectById(r).name).join(", ")}</span>
                  ) : (
                    <div className="rd__project-action">
                      <ResearchAction status={projectResearchStatus(state, p.id)} cost={p.rpCost} affordable={affordable} queueFull={queueFull} weeksAway={weeksAway} onStart={() => buyProject(p.id)} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}
      {state.era < 3 && (
        <p className="rd__roadmap-hint">
          <Lock size={11} aria-hidden /> More research projects unlock as you advance eras.
        </p>
      )}

      {/* Moonshot R&D gambles (feature #5) — the era-3+ experimental track: visible-odds RP gambles for
          unique rewards. Hidden before era 3 so the early tree stays a clean, solvable checklist. */}
      {state.era >= 3 && <MoonshotsSection state={state} rp={rp} onAttempt={attemptMoonshot} />}

      </>)}

      {rdTab === "components" && (<>
      {/* Component tech */}
      {(() => {
        const eraKinds = kinds.filter((kind) => {
          const next = tierDef(kind, researchedTier(state, kind) + 1);
          return !next || next.era <= state.era;
        });
        const maxed = eraKinds.filter((kind) => researchedTier(state, kind) >= maxTier(kind)).length;
        const total = eraKinds.length;
        if (total === 0) return null;
        const pct = Math.round((maxed / total) * 100);
        return (
          <div className="rd__comp-coverage">
            <div className="rd__comp-coverage-head">
              <span className="rd__comp-coverage-label">Component tech coverage</span>
              <span className="rd__comp-coverage-pct tnum">{maxed}/{total}</span>
            </div>
            <div className="rd__comp-coverage-track">
              <div className="rd__comp-coverage-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}
      {/* Component tech — one card of compact tile rows (was 6 stacked cards) to match the
          Design Lab language and cut the wall-of-cards scroll. */}
      <Card className="rd__comp-card">
        <SectionHeader title="Component tech" accessory="unlock higher tiers" />
        <div className="rd__comp-list">
          {sortedKinds.map((kind) => {
            const line = COMPONENT_LINES[kind];
            const cur = researchedTier(state, kind);
            const max = maxTier(kind);
            const curDef = tierDef(kind, cur);
            const nextDef = tierDef(kind, cur + 1);
            const cost = rdRpCostFor(state, kind);
            const eraLocked = !!nextDef && nextDef.era > state.era;
            const maxed = cur >= max;
            const affordable = cost !== null && rp >= cost;

            return (
              <div className="rd__comp-row" key={kind}>
                <span className="rd__comp-tile" aria-hidden><ComponentIcon kind={kind} size={20} /></span>
                <div className="rd__comp-info">
                  <span className="rd__comp-cat">
                    {line.displayName}
                    <span className="rd__comp-pips" aria-hidden>
                      {Array.from({ length: max }).map((_, i) => (
                        <span key={i} className={`rd__comp-pip${i < cur ? " rd__comp-pip--on" : ""}`} />
                      ))}
                    </span>
                    <span className="rd__comp-tcount tnum">T{cur}/{max}</span>
                  </span>
                  <span className="rd__comp-name">{curDef?.name ?? "—"}</span>
                  <span className="rd__comp-meta">
                    {maxed ? (
                      <span className="rd__comp-done"><Check size={12} strokeWidth={2.5} aria-hidden /> Fully researched</span>
                    ) : eraLocked ? (
                      <span className="rd__comp-eralock"><Lock size={11} aria-hidden /> Unlocks in the {eraName(nextDef!.era)}</span>
                    ) : (
                      <span className="rd__comp-next">
                        <ChevronRight size={12} aria-hidden /> {nextDef?.name}
                        {nextDef && (
                          <span className="rd__comp-delta">{curDef ? deltaLabel(curDef.contributes, nextDef.contributes) : contributesLabel(nextDef.contributes)}</span>
                        )}
                      </span>
                    )}
                  </span>
                </div>
                {!maxed && !eraLocked && (
                  <div className="rd__comp-buy">
                    <ResearchAction status={tierResearchStatus(state, kind)} cost={cost} affordable={affordable} queueFull={queueFull}
                      weeksAway={cost !== null && perWeek > 0 ? Math.ceil((cost - rp) / perWeek) : null} onStart={() => research(kind)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      </>)}
    </div>
  );
}

/** One device-design unlock track in the R&D hub: name + effect, and a buy button (or a
 *  "Maxed" check when the track is fully unlocked). */
function UnlockTrack({ name, sub, cta, cost, rp, onBuy }: {
  name: string;
  sub: string;
  cta: string | null;
  cost: number | null;
  rp: number;
  onBuy: () => void;
}) {
  return (
    <div className="rd__unlock-row">
      <div className="rd__unlock-info">
        <span className="rd__unlock-name">{name}</span>
        <span className="rd__unlock-sub">{sub}</span>
      </div>
      {cost === null || cta === null ? (
        <span className="rd__unlock-done"><Check size={13} strokeWidth={2.5} aria-hidden /> Maxed</span>
      ) : (
        <Button size="sm" variant={rp >= cost ? "primary" : "tertiary"} disabled={rp < cost} onClick={onBuy}>
          {cta} · {cost} RP
        </Button>
      )}
    </div>
  );
}
