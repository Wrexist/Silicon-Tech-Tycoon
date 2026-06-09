import { Check, ChevronRight, FlaskConical, Lock, MapPin, Users } from "lucide-react";
import { Button, Card, SectionHeader, StatPill } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { CategoryIcon } from "../design/icons.tsx";
import type { Tab } from "../components/BottomNav.tsx";
import { AnimatedInt } from "../design/AnimatedNumber.tsx";
import { BALANCE } from "../engine/balance.ts";
import { CATEGORY_LIST, COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { eraName, maxEra } from "../engine/eras.ts";
import { toDollars, type Money } from "../engine/money.ts";
import { RESEARCH_PROJECTS } from "../engine/research.ts";
import { STAT_KEYS, type ComponentKind, type Stats } from "../engine/types.ts";
import { rdRpCostFor, researchedTier, weeklyRpGen } from "../state/gameState.ts";
import { useGame } from "../state/useGame.tsx";
import "./research.css";

const STAT_SHORT: Record<keyof Stats, string> = {
  performance: "Perf",
  quality: "Quality",
  battery: "Battery",
  design: "Design",
  ecosystem: "Ecosys",
};

function contributesLabel(c: Partial<Stats>): string {
  return STAT_KEYS.filter((k) => c[k]).map((k) => `+${Math.round(c[k]!)} ${STAT_SHORT[k]}`).join("  ");
}

/** Show the improvement from upgrading (delta) rather than the tier's total contribution. */
function deltaLabel(cur: Partial<Stats>, next: Partial<Stats>): string {
  const parts = STAT_KEYS
    .filter((k) => (next[k] ?? 0) > (cur[k] ?? 0))
    .map((k) => `+${Math.round((next[k] ?? 0) - (cur[k] ?? 0))} ${STAT_SHORT[k]}`);
  return parts.length > 0 ? parts.join("  ") : contributesLabel(next);
}

function fmtRevGoal(dollars: number): string {
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(0)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}k`;
  return `$${dollars}`;
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
          // Era 1 uses OR logic (either threshold advances); Era 2+ requires both (AND).
          const isOrEra = eraDef.era === 1;

          let progressLabel = "";
          let progressLabel2 = "";
          let progressDone = false;
          let progressDone2 = false;
          if (active && eraDef.era < eraMax) {
            const repPct = repGoal ? Math.min(100, Math.round((reputation / repGoal) * 100)) : 0;
            const revPct = revGoalD ? Math.min(100, Math.round((cumulativeRevenueDollars / revGoalD) * 100)) : 0;
            if (isOrEra) {
              const bestPct = Math.max(repPct, revPct);
              const label = repPct >= revPct
                ? `${Math.round(reputation)} / ${repGoal} rep`
                : `${fmtRevGoal(cumulativeRevenueDollars)} / ${fmtRevGoal(revGoalD!)} rev`;
              progressLabel = `${bestPct}% — ${label}`;
            } else {
              if (repGoal) { progressLabel = repPct >= 100 ? `Rep ✓` : `${repPct}% rep — ${Math.round(reputation)} / ${repGoal}`; progressDone = repPct >= 100; }
              if (revGoalD) { progressLabel2 = revPct >= 100 ? `Rev ✓` : `${revPct}% rev — ${fmtRevGoal(cumulativeRevenueDollars)} / ${fmtRevGoal(revGoalD)}`; progressDone2 = revPct >= 100; }
            }
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
                      {repGoal && revGoalD ? (isOrEra ? " or " : " and ") : ""}
                      {revGoalD ? `${fmtRevGoal(revGoalD)} rev` : ""}
                    </span>
                  )}
                </div>
                {active && progressLabel && (
                  <p className={`rd__roadmap-progress${progressDone ? " rd__roadmap-progress--done" : ""}`}>{progressLabel}</p>
                )}
                {active && progressLabel2 && (
                  <p className={`rd__roadmap-progress${progressDone2 ? " rd__roadmap-progress--done" : ""}`}>{progressLabel2}</p>
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
  const { state, research, buyProject } = useGame();
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

  // Find the cheapest unaffordable project the player could save toward
  const nextGoal = RESEARCH_PROJECTS
    .filter((p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp < p.rpCost)
    .sort((a, b) => a.rpCost - b.rpCost)[0] ?? null;
  const goalPct = nextGoal ? Math.min(100, Math.round((rp / nextGoal.rpCost) * 100)) : 0;
  const goalWeeks = nextGoal && perWeek > 0 ? Math.ceil((nextGoal.rpCost - rp) / perWeek) : null;

  return (
    <div className="rd">
      {/* RP banner */}
      <Card className="rd__bank">
        <div className="rd__bank-main">
          <FlaskConical size={22} style={{ color: "var(--fn-eng)", flexShrink: 0 }} />
          <div>
            <div className="rd__bank-value tnum" style={{ color: "var(--fn-eng)" }}><AnimatedInt value={rp} /> RP</div>
            <div className="rd__bank-sub">+{perWeek.toFixed(1)} / week</div>
          </div>
          {(() => {
            const buyableNow = RESEARCH_PROJECTS.filter(
              (p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp >= p.rpCost,
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
            <p className="rd__bank-hint">No R&amp;D output yet — assign staff to the R&amp;D task to start earning Research Points.</p>
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
              {goalWeeks !== null && <span className="rd__bank-goal-eta">~{goalWeeks} wk</span>}
            </div>
            <div className="rd__bank-goal-track">
              <div className="rd__bank-goal-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="rd__bank-goal-nums">
              <span className="tnum">{rp} / {nextGoal.rpCost} RP</span>
              <span className="tnum">{goalPct}%</span>
            </div>
          </div>
        ) : (() => {
          const allCurrentEraDone = RESEARCH_PROJECTS
            .filter((p) => p.era <= state.era)
            .every((p) => state.completedProjects.includes(p.id) || rp >= p.rpCost);
          if (allCurrentEraDone) {
            return <p className="rd__bank-hint">All current-era projects are researched or affordable — check the lists below.</p>;
          }
          return <p className="rd__bank-hint">Saving up. Keep staff on R&amp;D to accumulate Research Points faster.</p>;
        })()}
      </Card>

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

        if (picks.length === 0) {
          const allMaxed = kinds.every((k) => researchedTier(state, k) >= maxTier(k) || (tierDef(k, researchedTier(state, k) + 1)?.era ?? 0) > state.era);
          return (
            <Card className="rd__sprint">
              <SectionHeader title="Top picks" accessory="next 12 weeks" />
              <p className="rd__bank-hint">
                {allMaxed
                  ? "All component tech for this era is fully researched. Advance to the next era to unlock more."
                  : "No research is affordable in the next 12 weeks. Keep accumulating RP — check back soon."}
              </p>
            </Card>
          );
        }
        return (
          <Card className="rd__sprint">
            <SectionHeader title="Top picks" accessory="next 12 weeks" />
            <div className="rd__sprint-list">
              {picks.map(({ kind, next, cost, weeksAway }) => {
                const line = COMPONENT_LINES[kind];
                const affordable = rp >= cost;
                const curTierDef = tierDef(kind, researchedTier(state, kind));
                const contrib = curTierDef
                  ? deltaLabel(curTierDef.contributes, next.contributes)
                  : contributesLabel(next.contributes);
                const isTrending = trendDelta > 0.02 && trendStat && (next.contributes[trendStat] ?? 0) > 0;
                return (
                  <div key={kind} className="rd__sprint-row">
                    <div className="rd__sprint-info">
                      <div className="rd__sprint-name-row">
                        <span className="rd__sprint-name">{next.name}</span>
                        {isTrending && <span className="rd__trend-badge">Trending</span>}
                      </div>
                      <span className="rd__sprint-line">{contrib ? `${line.displayName} · ${contrib}` : line.displayName}</span>
                      {(() => {
                        const inCat = (cat: string) => CATEGORY_LIST.some((c) => c.id === cat && c.slots.includes(kind));
                        const liveName = state.launched.find(
                          (lp) => lp.weeksElapsed < lp.weeklyUnits.length && inCat(lp.product.category),
                        )?.product.name;
                        const buildName = !liveName && state.building.find((j) => inCat(j.product.category))?.product.name;
                        const readyName = !liveName && !buildName && state.ready.find((p) => inCat(p.category))?.name;
                        const hint = liveName ?? buildName ?? readyName;
                        if (!hint) return null;
                        const label = liveName ? "Active" : buildName ? "In production" : "Ready";
                        return <span className="rd__sprint-active">{label}: {hint}</span>;
                      })()}
                    </div>
                    <div className="rd__sprint-action">
                      <Button
                        size="sm"
                        variant={affordable ? "primary" : "tertiary"}
                        disabled={!affordable}
                        onClick={() => {
                          haptic.success();
                          sfx("rp");
                          showToast(`${next.name} unlocked`, { tone: "positive", action: onNavigate ? () => onNavigate("design") : undefined, actionLabel: onNavigate ? "Design Lab" : undefined });
                          research(kind);
                        }}
                      >
                        {cost} RP
                      </Button>
                      {!affordable && <span className="rd__weeks-away">~{weeksAway} wk</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Active project boosts */}
      {state.completedProjects.length > 0 && (
        <Card>
          <SectionHeader title="Active boosts" accessory={`${state.completedProjects.length} projects`} />
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
        </Card>
      )}

      {/* Era roadmap */}
      <EraRoadmap currentEra={state.era} reputation={state.reputation} cumulativeRevenueDollars={toDollars(state.cumulativeRevenue)} />

      {/* Research projects — grouped by era */}
      <SectionHeader title="Research projects" accessory="evolve the company" />
      {[1, 2, 3].map((era) => {
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
              const affordable = rp >= p.rpCost && !locked;
              const weeksAway = !affordable && !locked && perWeek > 0 ? Math.ceil((p.rpCost - rp) / perWeek) : null;
              return (
                <Card key={p.id} className="rd__project">
                  <div className="rd__project-info">
                    <span className="rd__next-name">{p.name}</span>
                    <span className="rd__contrib rd__contrib--muted">{p.blurb}</span>
                  </div>
                  {done ? (
                    <span className="rd__maxed"><Check size={14} strokeWidth={2.5} /> Done</span>
                  ) : locked ? (
                    <span className="rd__locked"><Lock size={12} /> Era {p.era}</span>
                  ) : (
                    <div className="rd__project-action">
                      <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => { haptic.success(); sfx("levelup"); showToast(`${p.name} — ${p.blurb}`, { tone: "positive" }); buyProject(p.id); }}>
                        {p.rpCost} RP
                      </Button>
                      {weeksAway !== null && <span className="rd__weeks-away">~{weeksAway} wk</span>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

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
      <SectionHeader title="Component tech" accessory="unlock higher tiers" />
      {(() => {
        const maxedKinds = sortedKinds.filter((k) => researchedTier(state, k) >= maxTier(k));
        const activeKinds = sortedKinds.filter((k) => researchedTier(state, k) < maxTier(k));
        return (
          <>
            {activeKinds.map((kind) => {
              const line = COMPONENT_LINES[kind];
              const cur = researchedTier(state, kind);
              const max = maxTier(kind);
              const curDef = tierDef(kind, cur);
              const nextDef = tierDef(kind, cur + 1);
              const cost = rdRpCostFor(state, kind);
              const eraLocked = !!nextDef && nextDef.era > state.era;
              const affordable = cost !== null && rp >= cost;

              // A tier is "newly available" when the next tier to unlock belongs to the current
              // era and the player is still on a tier from an earlier era — i.e. this era just
              // opened the door to a meaningful spec jump they couldn't access before.
              const isNewThisEra = !eraLocked && !!nextDef && nextDef.era === state.era && (curDef?.era ?? 0) < state.era;
              return (
                <Card key={kind}>
                  <SectionHeader title={line.displayName} accessory={isNewThisEra ? <span className="rd__tier-new">New tier</span> : <span className="rd__tier">T{cur}/{max}</span>} />
                  <div className="rd__tier-pips">
                    {Array.from({ length: max }).map((_, i) => (
                      <span key={i} className={`rd__tier-pip${i < cur ? " rd__tier-pip--on" : ""}`} />
                    ))}
                  </div>
                  {(() => {
                    const usedIn = CATEGORY_LIST.filter(
                      (c) => c.unlockEra <= state.era && c.slots.includes(kind),
                    );
                    if (usedIn.length === 0) return null;
                    return (
                      <div className="rd__used-in">
                        {usedIn.map((c) => (
                          <span key={c.id} className="rd__used-cat">
                            <CategoryIcon id={c.id} size={10} />{c.displayName}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {!eraLocked && (() => {
                    const active = state.launched.filter(
                      (lp) =>
                        lp.weeksElapsed < lp.weeklyUnits.length &&
                        CATEGORY_LIST.some((c) => c.id === lp.product.category && c.slots.includes(kind)),
                    );
                    if (active.length === 0) return null;
                    const prod = active[0];
                    const prodTier = prod.product.tiers[kind] ?? 0;
                    return (
                      <p className="rd__active-hint">
                        Active: <strong>{prod.product.name}</strong> using T{prodTier} — upgrade to unlock T{cur + 1} for your next design.
                      </p>
                    );
                  })()}
                  <div className="rd__current">
                    <StatPill label="Current" value={curDef?.name ?? "—"} />
                    {curDef && <span className="rd__contrib">{contributesLabel(curDef.contributes)}</span>}
                  </div>
                  {eraLocked ? (
                    <div className="rd__locked"><Lock size={12} /> Unlocks in the {eraName(nextDef!.era)}</div>
                  ) : (
                    <div className="rd__next">
                      <div className="rd__next-info">
                        <span className="rd__next-name">{nextDef?.name}</span>
                        <span className="rd__contrib">{nextDef && (curDef ? deltaLabel(curDef.contributes, nextDef.contributes) : contributesLabel(nextDef.contributes))}</span>
                      </div>
                      <div className="rd__project-action">
                        <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => {
                            haptic.success();
                            sfx("rp");
                            showToast(`${nextDef?.name ?? "Tech"} unlocked`, { tone: "positive", action: onNavigate ? () => onNavigate("design") : undefined, actionLabel: onNavigate ? "Design Lab" : undefined });
                            research(kind);
                          }}>
                          {cost !== null ? `${cost} RP` : "—"}
                        </Button>
                        {!affordable && cost !== null && perWeek > 0 && (
                          <span className="rd__weeks-away">~{Math.ceil((cost - rp) / perWeek)} wk</span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {maxedKinds.length > 0 && (
              <div className="rd__maxed-group">
                <span className="rd__maxed-group-label">
                  <Check size={11} strokeWidth={3} /> Fully researched · {maxedKinds.length}
                </span>
                <div className="rd__maxed-chips">
                  {maxedKinds.map((kind) => {
                    const cur = researchedTier(state, kind);
                    const max = maxTier(kind);
                    return (
                      <span key={kind} className="rd__maxed-chip">
                        {COMPONENT_LINES[kind].displayName}
                        <span className="rd__maxed-chip-tier">T{cur}/{max}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
