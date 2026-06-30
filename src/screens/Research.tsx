import { useState } from "react";
import { Check, ChevronRight, FlaskConical, Lock, MapPin, Users } from "lucide-react";
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
import { RESEARCH_PROJECTS, forkLockedBy, projectById } from "../engine/research.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import { FINISH_ORDER, STAT_KEYS, type ComponentKind, type Stats } from "../engine/types.ts";
import { rdRpCostFor, researchedTier, weeklyRpGen, weeklyRpSources, lensUnlockCost, finishUnlockCost } from "../state/gameState.ts";
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

export function Research({ onNavigate }: { onNavigate?: (t: Tab) => void } = {}) {
  const { state, research, buyProject, unlockLens, unlockFinish } = useGame();
  // Once many projects are complete, the full-blurb list grows into a long scroll. Default to a
  // compact chip cloud; the player can expand to the detailed effects on demand.
  const [boostsExpanded, setBoostsExpanded] = useState(false);
  const kinds = Object.keys(COMPONENT_LINES) as ComponentKind[];
  const rp = Math.floor(state.researchPoints);
  const perWeek = weeklyRpGen(state);

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
    .filter((p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp < p.rpCost && !forkLockedBy(state.completedProjects, p.id))
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
              (p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp >= p.rpCost && !forkLockedBy(state.completedProjects, p.id),
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
        ) : (
          <p className="rd__bank-hint">Assign staff to R&amp;D (Finance tab) to earn more Research Points.</p>
        )}
      </Card>

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
                      <Button
                        size="sm"
                        variant={affordable ? "primary" : "tertiary"}
                        disabled={!affordable}
                        onClick={() => { research(kind); haptic.success(); sfx("upgrade"); }}
                      >
                        {cost} RP
                      </Button>
                      {!affordable && <span className="rd__weeks-away">~{weeksAway}wk</span>}
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
      {[1, 2, 3].filter((era) => era <= state.era).map((era) => {
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
              const affordable = rp >= p.rpCost && !locked && !forkLock;
              const weeksAway = !affordable && !locked && !forkLock && perWeek > 0 ? Math.ceil((p.rpCost - rp) / perWeek) : null;
              return (
                <Card key={p.id} className={`rd__project${p.fork ? " rd__project--fork" : ""}`}>
                  <div className="rd__project-info">
                    <span className="rd__next-name">
                      {p.name}
                      {p.fork && <span className="rd__fork-tag" title="A doctrine — choosing one locks out the others">Pick one</span>}
                    </span>
                    <span className="rd__contrib rd__contrib--muted">{p.blurb}</span>
                  </div>
                  {done ? (
                    <span className="rd__maxed"><Check size={14} strokeWidth={2.5} /> {p.fork ? "Chosen" : "Done"}</span>
                  ) : locked ? (
                    <span className="rd__locked"><Lock size={12} /> Era {p.era}</span>
                  ) : forkLock ? (
                    <span className="rd__locked" title={`You chose ${projectById(forkLock).name}`}><Lock size={12} /> Locked</span>
                  ) : (
                    <div className="rd__project-action">
                      <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => { buyProject(p.id); haptic.success(); sfx("upgrade"); }}>
                        {p.rpCost} RP
                      </Button>
                      {weeksAway !== null && <span className="rd__weeks-away">~{weeksAway}wk</span>}
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
                    <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => { research(kind); haptic.success(); sfx("upgrade"); }}>
                      {cost !== null ? `${cost} RP` : "—"}
                    </Button>
                    {!affordable && cost !== null && perWeek > 0 && (
                      <span className="rd__weeks-away">~{Math.ceil((cost - rp) / perWeek)}wk</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
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
