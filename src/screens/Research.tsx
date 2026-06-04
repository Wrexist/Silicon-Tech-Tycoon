import { Check, FlaskConical, Lock, Users } from "lucide-react";
import { Button, Card, SectionHeader, StatPill } from "../design/primitives.tsx";
import type { Tab } from "../components/BottomNav.tsx";
import { AnimatedInt } from "../design/AnimatedNumber.tsx";
import { COMPONENT_LINES, maxTier, tierDef } from "../engine/catalogs.ts";
import { eraName } from "../engine/eras.ts";
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

export function Research({ onNavigate }: { onNavigate?: (t: Tab) => void } = {}) {
  const { state, research, buyProject } = useGame();
  const kinds = Object.keys(COMPONENT_LINES) as ComponentKind[];
  const rp = Math.floor(state.researchPoints);
  const perWeek = weeklyRpGen(state);

  return (
    <div className="rd">
      {/* RP banner */}
      <Card className="rd__bank">
        <div className="rd__bank-main">
          <FlaskConical size={22} />
          <div>
            <div className="rd__bank-value tnum"><AnimatedInt value={rp} /> RP</div>
            <div className="rd__bank-sub">+{perWeek.toFixed(1)} / week</div>
          </div>
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
        ) : (
          <p className="rd__bank-hint">Assign staff to R&amp;D (Company tab) to earn more Research Points.</p>
        )}
      </Card>

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
                    <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => buyProject(p.id)}>
                      {p.rpCost} RP
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })}

      {/* Component tech */}
      <SectionHeader title="Component tech" accessory="unlock higher tiers" />
      {kinds.map((kind) => {
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
          <Card key={kind}>
            <SectionHeader title={line.displayName} accessory={<span className="rd__tier">T{cur}/{max}</span>} />
            <div className="rd__tier-pips">
              {Array.from({ length: max }).map((_, i) => (
                <span key={i} className={`rd__tier-pip${i < cur ? " rd__tier-pip--on" : ""}`} />
              ))}
            </div>
            <div className="rd__current">
              <StatPill label="Current" value={curDef?.name ?? "—"} />
              {curDef && <span className="rd__contrib">{contributesLabel(curDef.contributes)}</span>}
            </div>

            {maxed ? (
              <div className="rd__maxed"><Check size={14} strokeWidth={2.5} /> Fully researched</div>
            ) : eraLocked ? (
              <div className="rd__locked"><Lock size={12} /> Unlocks in the {eraName(nextDef!.era)}</div>
            ) : (
              <div className="rd__next">
                <div className="rd__next-info">
                  <span className="rd__next-name">{nextDef?.name}</span>
                  <span className="rd__contrib">{nextDef && contributesLabel(nextDef.contributes)}</span>
                </div>
                <Button size="sm" variant={affordable ? "primary" : "tertiary"} disabled={!affordable} onClick={() => research(kind)}>
                  {cost !== null ? `${cost} RP` : "—"}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
